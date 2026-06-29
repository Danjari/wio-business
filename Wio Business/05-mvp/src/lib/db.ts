import { supabase } from './supabase'
import type { Card, Transaction, Approval, ProcessedApproval } from '../data'

// ── Mappers (snake_case DB → camelCase frontend) ──────────────────────────────

function mapCard(r: Record<string, unknown>): Card {
  return {
    id:         r.id as string,
    holderId:   r.holder_id as string,
    label:      r.label as string,
    last4:      r.last4 as string,
    limit:      r.limit_aed as number,
    spent:      r.spent as number,
    categories: r.categories as string[],
    status:     r.status as 'active' | 'frozen',
  }
}

function mapTransaction(r: Record<string, unknown>): Transaction {
  return {
    id:         r.id as string,
    cardId:     r.card_id as string,
    merchant:   r.merchant as string,
    category:   r.category as string,
    amount:     Number(r.amount),
    currency:   (r.currency as string) || 'AED',
    date:       r.date as string,
    status:     r.status as Transaction['status'],
    hasReceipt: r.has_receipt as boolean,
    zohoSynced: r.zoho_synced as boolean,
    note:       r.note as string | undefined,
  }
}

function mapApproval(r: Record<string, unknown>): Approval {
  return {
    id:             r.id as string,
    txId:           r.tx_id as string,
    requestedById:  r.requested_by_id as string,
    amount:         Number(r.amount),
    merchant:       r.merchant as string,
    category:       r.category as string,
    cardId:         r.card_id as string,
    note:           (r.note ?? '') as string,
    date:           r.date as string,
    requiredLevel:  r.required_level as 'manager' | 'founder',
  }
}

function mapProcessed(r: Record<string, unknown>): ProcessedApproval {
  return {
    ...mapApproval(r),
    outcome:     r.outcome as 'approved' | 'declined',
    processedAt: r.processed_at as string,
  }
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function fetchCards(): Promise<Card[]> {
  const { data, error } = await supabase.from('cards').select('*').order('id')
  if (error) throw error
  return (data ?? []).map(mapCard)
}

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapTransaction)
}

export async function fetchApprovals(): Promise<{ pending: Approval[]; processed: ProcessedApproval[] }> {
  const { data, error } = await supabase.from('approvals').select('*').order('date', { ascending: false })
  if (error) throw error

  const pending: Approval[] = []
  const processed: ProcessedApproval[] = []

  for (const row of data ?? []) {
    if (row.outcome == null) pending.push(mapApproval(row))
    else processed.push(mapProcessed(row))
  }

  return { pending, processed }
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function resolveApproval(
  approvalId: string,
  txId: string,
  outcome: 'approved' | 'declined',
): Promise<void> {
  const now = new Date().toISOString()

  const [approvalRes, txRes] = await Promise.all([
    supabase
      .from('approvals')
      .update({ outcome, processed_at: now })
      .eq('id', approvalId)
      .select('id'),
    supabase
      .from('transactions')
      .update({ status: outcome })
      .eq('id', txId)
      .select('id'),
  ])

  if (approvalRes.error) throw approvalRes.error
  if (txRes.error) throw txRes.error
  // 0 rows → RLS silently blocked the write
  if (!approvalRes.data?.length) throw new Error('Approval write blocked — disable RLS on approvals table in Supabase')
  if (!txRes.data?.length) throw new Error('Transaction write blocked — disable RLS on transactions table in Supabase')
}

export async function createCard(card: Omit<Card, 'id' | 'spent'>): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .insert({
      id:         crypto.randomUUID(),
      holder_id:  card.holderId,
      label:      card.label,
      last4:      card.last4,
      limit_aed:  card.limit,
      spent:      0,
      categories: card.categories,
      status:     'active',
    })
    .select()
    .single()
  if (error) throw error
  return mapCard(data as Record<string, unknown>)
}

export async function updateCardStatus(cardId: string, status: 'active' | 'frozen'): Promise<void> {
  const { data, error } = await supabase.from('cards').update({ status }).eq('id', cardId).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('Card update blocked — disable RLS on cards table in Supabase')
}
