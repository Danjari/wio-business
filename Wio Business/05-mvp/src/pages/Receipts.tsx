import React, { useState, useMemo } from 'react'
import { CheckCircle, MessageCircle, X } from 'lucide-react'
import { TEAM, ALL_CATEGORIES, fmtAmount, fmtDate } from '../data'
import type { AppState } from '../App'
import Avatar from '../components/Avatar'

const C = {
  purple: '#5700FF',
  textDark: '#1a1a1a',
  textMid: '#555555',
  textLight: '#999999',
  border: '#EBEBEB',
  bg: '#F7F7F9',
  green: '#22C55E',
  amber: '#F59E0B',
}


const selectStyle: React.CSSProperties = {
  padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 7,
  fontSize: 12, color: C.textMid, background: '#fff', outline: 'none', cursor: 'pointer',
}

function getHolderId(cardId: string, cards: AppState['cards']): string {
  return cards.find(c => c.id === cardId)?.holderId ?? ''
}

function inAmountRange(amount: number, range: string): boolean {
  if (range === 'all') return true
  if (range === 'u500') return amount < 500
  if (range === '500-2000') return amount >= 500 && amount <= 2000
  if (range === 'a2000') return amount > 2000
  return true
}

export default function Receipts({ transactions, cards }: AppState) {
  const [holderFilter, setHolderFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [amountFilter, setAmountFilter] = useState('all')

  const missing = transactions.filter(t => !t.hasReceipt && t.status === 'approved')

  const filtered = useMemo(() => {
    let list = [...missing].sort((a, b) => b.date.localeCompare(a.date))
    if (holderFilter !== 'all') list = list.filter(t => getHolderId(t.cardId, cards) === holderFilter)
    if (catFilter !== 'all') list = list.filter(t => t.category === catFilter)
    list = list.filter(t => inAmountRange(t.amount, amountFilter))
    return list
  }, [missing, holderFilter, catFilter, amountFilter, cards])

  const isFiltered = holderFilter !== 'all' || catFilter !== 'all' || amountFilter !== 'all'
  const clearFilters = () => { setHolderFilter('all'); setCatFilter('all'); setAmountFilter('all') }

  const getCardholder = (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    return card ? TEAM.find(t => t.id === card.holderId) : null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textDark, display: 'flex', alignItems: 'center', gap: 8 }}>
            Missing receipts
            {missing.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: '#FEF3C7', color: '#D97706' }}>
                {missing.length}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.textLight, marginTop: 3 }}>Send a photo to the Wio bot in Slack — it matches and syncs automatically</div>
        </div>
      </div>

      {/* Filters */}
      {missing.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={holderFilter} onChange={e => setHolderFilter(e.target.value)} style={selectStyle}>
            <option value="all">All cardholders</option>
            {TEAM.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={selectStyle}>
            <option value="all">All categories</option>
            {ALL_CATEGORIES.filter(c => c !== 'All Categories').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={amountFilter} onChange={e => setAmountFilter(e.target.value)} style={selectStyle}>
            <option value="all">All amounts</option>
            <option value="u500">Under AED 500</option>
            <option value="500-2000">AED 500 – 2,000</option>
            <option value="a2000">Above AED 2,000</option>
          </select>
          {isFiltered && (
            <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.purple, fontFamily: 'inherit' }}>
              <X size={12} /> Clear
            </button>
          )}
          <span style={{ fontSize: 12, color: C.textLight, marginLeft: 'auto' }}>{filtered.length} of {missing.length} missing</span>
        </div>
      )}

      {/* Content */}
      {missing.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <CheckCircle size={28} color={C.green} style={{ margin: '0 auto 12px', display: 'block' }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: C.textDark, marginBottom: 4 }}>All receipts collected</div>
          <div style={{ fontSize: 12, color: C.textLight }}>Every approved transaction has documentation</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: C.textLight, fontSize: 13 }}>
          No transactions match your filters
        </div>
      ) : (
        <div>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 16, padding: '0 0 12px', borderBottom: `1px solid ${C.border}` }}>
            {['Transaction', 'Date', 'Amount', ''].map((h, i) => (
              <div key={i} style={{ fontSize: 10, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 2 ? 'right' : 'left' }}>{h}</div>
            ))}
          </div>
          {filtered.map((tx, idx) => {
            const holder = getCardholder(tx.cardId)
            return (
              <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 16, alignItems: 'center', padding: '18px 0', borderBottom: idx < filtered.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                {/* Merchant + holder */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar seed={holder?.name ?? ''} size={32} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{tx.merchant}</div>
                    <div style={{ fontSize: 11, color: C.textLight }}>{holder?.name} · {tx.category}</div>
                  </div>
                </div>
                {/* Date */}
                <div style={{ fontSize: 12, color: C.textLight }}>{fmtDate(tx.date)}</div>
                {/* Amount */}
                <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, textAlign: 'right' }}>{fmtAmount(tx.amount, tx.currency)}</div>
                {/* Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: C.purple, whiteSpace: 'nowrap' }}>
                  <MessageCircle size={13} /> Send via Slack
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Callout */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <MessageCircle size={15} color={C.purple} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.purple, marginBottom: 4 }}>Push notification the moment a transaction clears</div>
          <div style={{ fontSize: 12, color: C.textLight, lineHeight: 1.6 }}>
            One tap to capture the receipt — no chasing team members at month end. OCR extracts the amount, date, merchant, and VAT number automatically.
          </div>
        </div>
      </div>

    </div>
  )
}
