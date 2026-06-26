import React, { useState, useMemo } from 'react'
import { Search, CheckCircle2, AlertCircle, Clock, X } from 'lucide-react'
import { TEAM, ALL_CATEGORIES, fmtAED, fmtDate } from '../data'
import type { AppState } from '../App'

const C = {
  purple: '#5700FF',
  textDark: '#1a1a1a',
  textMid: '#555555',
  textLight: '#999999',
  border: '#EBEBEB',
  bg: '#F7F7F9',
  green: '#22C55E',
  amber: '#F59E0B',
  red: '#EF4444',
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    approved: { label: 'Approved', bg: '#DCFCE7', color: '#16A34A' },
    pending_approval: { label: 'Pending', bg: '#FEF3C7', color: '#D97706' },
    declined: { label: 'Declined', bg: '#FEE2E2', color: '#DC2626' },
    out_of_policy: { label: 'Out of policy', bg: '#FEE2E2', color: '#DC2626' },
  }
  const s = map[status] ?? { label: status, bg: C.bg, color: C.textLight }
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 7,
  fontSize: 12, color: C.textMid, background: '#fff', outline: 'none', cursor: 'pointer', minWidth: 120,
}

function getHolderId(cardId: string, cards: AppState['cards']): string {
  return cards.find(c => c.id === cardId)?.holderId ?? ''
}

function inAmountRange(amount: number, range: string): boolean {
  if (range === 'all') return true
  if (range === 'u500') return amount < 500
  if (range === '500-2000') return amount >= 500 && amount <= 2000
  if (range === '2000-5000') return amount > 2000 && amount <= 5000
  if (range === 'a5000') return amount > 5000
  return true
}

function inDateRange(date: string, range: string): boolean {
  if (range === 'all') return true
  const d = new Date(date)
  if (range === 'month') return d >= new Date('2026-06-01')
  if (range === 'last30') { const c = new Date('2026-06-26'); c.setDate(c.getDate() - 30); return d >= c }
  if (range === 'last90') { const c = new Date('2026-06-26'); c.setDate(c.getDate() - 90); return d >= c }
  return true
}

export default function Transactions({ transactions, cards }: AppState) {
  const [search, setSearch] = useState('')
  const [holderFilter, setHolderFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [amountFilter, setAmountFilter] = useState('all')

  const isFiltered = !!(search.trim()) || holderFilter !== 'all' || catFilter !== 'all' || statusFilter !== 'all' || dateFilter !== 'all' || amountFilter !== 'all'
  const clearAll = () => { setSearch(''); setHolderFilter('all'); setCatFilter('all'); setStatusFilter('all'); setDateFilter('all'); setAmountFilter('all') }

  const filtered = useMemo(() => {
    let list = [...transactions].sort((a, b) => b.date.localeCompare(a.date))
    if (search.trim()) list = list.filter(t => t.merchant.toLowerCase().includes(search.toLowerCase()))
    if (holderFilter !== 'all') list = list.filter(t => getHolderId(t.cardId, cards) === holderFilter)
    if (catFilter !== 'all') list = list.filter(t => t.category === catFilter)
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter)
    list = list.filter(t => inDateRange(t.date, dateFilter))
    list = list.filter(t => inAmountRange(t.amount, amountFilter))
    return list
  }, [transactions, search, holderFilter, catFilter, statusFilter, dateFilter, amountFilter, cards])

  const getCardholder = (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    return card ? TEAM.find(t => t.id === card.holderId) : null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filters — no containing box */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', minWidth: 180 }}>
          <Search size={13} color={C.textLight} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search merchant…"
            style={{ ...selectStyle, paddingLeft: 30, width: '100%' }}
          />
        </div>
        <select value={holderFilter} onChange={e => setHolderFilter(e.target.value)} style={selectStyle}>
          <option value="all">All cardholders</option>
          {TEAM.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={selectStyle}>
          <option value="all">All categories</option>
          {ALL_CATEGORIES.filter(c => c !== 'All Categories').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="pending_approval">Pending approval</option>
          <option value="declined">Declined</option>
        </select>
        <select value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={selectStyle}>
          <option value="all">All time</option>
          <option value="month">This month</option>
          <option value="last30">Last 30 days</option>
          <option value="last90">Last 90 days</option>
        </select>
        <select value={amountFilter} onChange={e => setAmountFilter(e.target.value)} style={selectStyle}>
          <option value="all">All amounts</option>
          <option value="u500">Under AED 500</option>
          <option value="500-2000">AED 500 – 2,000</option>
          <option value="2000-5000">AED 2,000 – 5,000</option>
          <option value="a5000">Above AED 5,000</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
          {isFiltered && (
            <button onClick={clearAll} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.purple, fontFamily: 'inherit', padding: 0 }}>
              <X size={12} /> Clear filters
            </button>
          )}
          <span style={{ fontSize: 12, color: C.textLight, whiteSpace: 'nowrap' }}>
            Showing {filtered.length} of {transactions.length}
          </span>
        </div>
      </div>

      {/* Table — no outer box */}
      <div className="table-scroll">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr>
            {['Date', 'Merchant', 'Cardholder', 'Category', 'Amount', 'Status', 'Receipt', 'Zoho'].map(h => (
              <th key={h} style={{
                textAlign: h === 'Amount' ? 'right' : 'left',
                fontSize: 10, fontWeight: 500, color: C.textLight,
                padding: '0 14px 14px 0', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ padding: '36px 0', textAlign: 'center', color: C.textLight, fontSize: 13 }}>
                No transactions match your filters
              </td>
            </tr>
          ) : filtered.map((tx, i) => {
            const holder = getCardholder(tx.cardId)
            return (
              <tr
                key={tx.id}
                style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background 100ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#FAFAFA' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
              >
                <td style={{ padding: '13px 14px 13px 0', fontSize: 12, color: C.textLight, whiteSpace: 'nowrap' }}>{fmtDate(tx.date)}</td>
                <td style={{ padding: '13px 14px 13px 0', fontSize: 13, color: C.textDark, maxWidth: 180 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.merchant}</div>
                  {tx.note && <div style={{ fontSize: 10, color: C.textLight, marginTop: 1 }}>{tx.note}</div>}
                </td>
                <td style={{ padding: '13px 14px 13px 0', fontSize: 12, color: C.textMid, whiteSpace: 'nowrap' }}>{holder?.name ?? '—'}</td>
                <td style={{ padding: '13px 14px 13px 0' }}>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99, background: '#F3F4F6', color: C.textMid }}>{tx.category}</span>
                </td>
                <td style={{ padding: '13px 14px 13px 0', fontSize: 13, fontWeight: 500, color: C.textDark, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtAED(tx.amount)}</td>
                <td style={{ padding: '13px 14px 13px 0' }}><StatusBadge status={tx.status} /></td>
                <td style={{ padding: '13px 14px 13px 0' }}>
                  {tx.hasReceipt ? <CheckCircle2 size={15} color="#16A34A" /> : <AlertCircle size={15} color={C.amber} />}
                </td>
                <td style={{ padding: '13px 0' }}>
                  {tx.zohoSynced
                    ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#16A34A' }}><CheckCircle2 size={13} />Synced</span>
                    : <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: C.textLight }}><Clock size={13} />Pending</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      </div>
    </div>
  )
}
