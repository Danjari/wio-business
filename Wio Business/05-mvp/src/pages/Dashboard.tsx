import React from 'react'
import { TEAM, fmtAED, fmtDate } from '../data'
import type { AppState } from '../App'
import Avatar from '../components/Avatar'

const C = {
  purple: '#5700FF',
  textDark: '#1a1a1a',
  textMid: '#555555',
  textLight: '#999999',
  border: '#EBEBEB',
  bg: '#F7F7F9',
  amber: '#F59E0B',
  red: '#EF4444',
}

const CATEGORY_SPEND = [
  { cat: 'Travel', amount: 4125, pct: 50 },
  { cat: 'Client Meals', amount: 1840, pct: 22 },
  { cat: 'Office Supplies', amount: 1425, pct: 17 },
  { cat: 'SaaS Tools', amount: 800, pct: 10 },
  { cat: 'Advertising', amount: 770, pct: 9 },
]

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    approved: { label: 'Approved', bg: '#DCFCE7', color: '#16A34A' },
    pending_approval: { label: 'Pending', bg: '#FEF3C7', color: '#D97706' },
    declined: { label: 'Declined', bg: '#FEE2E2', color: '#DC2626' },
    out_of_policy: { label: 'Out of policy', bg: '#FEE2E2', color: '#DC2626' },
  }
  const s = map[status] ?? { label: status, bg: C.bg, color: C.textLight }
  return (
    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

export default function Dashboard({ cards, transactions, approvals, navigate }: AppState) {
  const pendingCount = approvals.length
  const missingCount = transactions.filter(t => !t.hasReceipt && t.status === 'approved').length
  const recentTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)

  const getCardholder = (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    if (!card) return null
    return TEAM.find(t => t.id === card.holderId) ?? null
  }

  const kpis = [
    { label: "This month's spend", value: fmtAED(8205), sub: 'June 2026', flagColor: undefined as string | undefined, onClick: undefined as (() => void) | undefined },
    { label: 'Active cards', value: String(cards.filter(c => c.status === 'active').length), sub: 'across team members', flagColor: undefined, onClick: undefined },
    { label: 'Pending approvals', value: String(pendingCount), sub: pendingCount > 0 ? 'requires your attention' : 'all clear', flagColor: pendingCount > 0 ? C.red : undefined, onClick: () => navigate('approvals') },
    { label: 'Missing receipts', value: String(missingCount), sub: 'transactions need docs', flagColor: missingCount > 0 ? C.amber : undefined, onClick: () => navigate('receipts') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* KPI strip */}
      <div className="kpi-strip" style={{ display: 'flex', paddingBottom: 32, marginBottom: 40, borderBottom: `1px solid ${C.border}` }}>
        {kpis.map((k, i) => (
          <div
            key={i}
            onClick={k.onClick}
            style={{
              flex: 1,
              paddingLeft: i === 0 ? 0 : 32,
              paddingRight: i < kpis.length - 1 ? 32 : 0,
              borderRight: i < kpis.length - 1 ? `1px solid ${C.border}` : 'none',
              cursor: k.onClick ? 'pointer' : 'default',
            }}
          >
            <div style={{ fontSize: 11, color: C.textLight, marginBottom: 10, letterSpacing: '0.02em' }}>{k.label}</div>
            <div style={{ fontSize: 30, fontWeight: 500, color: k.flagColor ?? C.textDark, lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: k.onClick ? C.purple : C.textLight }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Two-column body */}
      <div className="dash-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, marginBottom: 48 }}>
        {/* Spend by category */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 22 }}>Spend by category</div>
          {CATEGORY_SPEND.map((c, i) => (
            <div key={c.cat} style={{ paddingBottom: 18, marginBottom: i < CATEGORY_SPEND.length - 1 ? 18 : 0, borderBottom: i < CATEGORY_SPEND.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 13, color: C.textMid }}>{c.cat}</span>
                <span style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{fmtAED(c.amount)}</span>
              </div>
              <div style={{ height: 3, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${c.pct}%`, background: C.purple, borderRadius: 2, transition: 'width 500ms ease' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Card utilization */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
            <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Card utilization</div>
            <button onClick={() => navigate('cards')} style={{ fontSize: 12, color: C.purple, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 400, fontFamily: 'inherit' }}>View cards →</button>
          </div>
          {cards.map((card, i) => {
            const holder = TEAM.find(t => t.id === card.holderId)
            const pct = Math.min((card.spent / card.limit) * 100, 100)
            const warn = pct > 80
            return (
              <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 18, marginBottom: i < cards.length - 1 ? 18 : 0, borderBottom: i < cards.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <Avatar seed={holder?.name ?? ''} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.label}</span>
                    <span style={{ fontSize: 11, color: warn ? C.amber : C.textLight, flexShrink: 0, marginLeft: 8 }}>{Math.round(pct)}%</span>
                  </div>
                  <div style={{ height: 3, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: warn ? C.amber : C.purple, borderRadius: 2 }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent transactions */}
      <div style={{ paddingTop: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Recent transactions</div>
          <button onClick={() => navigate('transactions')} style={{ fontSize: 12, color: C.purple, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 400, fontFamily: 'inherit' }}>View all →</button>
        </div>
        <div className="table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead>
            <tr>
              {['Date', 'Merchant', 'Cardholder', 'Category', 'Amount', 'Status'].map(h => (
                <th key={h} style={{
                  textAlign: h === 'Amount' ? 'right' : 'left',
                  fontSize: 10, fontWeight: 500, color: C.textLight,
                  padding: '0 0 14px', borderBottom: `1px solid ${C.border}`,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {recentTx.map((tx, i) => {
              const holder = getCardholder(tx.cardId)
              return (
                <tr
                  key={tx.id}
                  style={{ borderBottom: i < recentTx.length - 1 ? `1px solid ${C.border}` : 'none', transition: 'background 100ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#FAFAFA' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                >
                  <td style={{ padding: '14px 0', fontSize: 12, color: C.textLight, whiteSpace: 'nowrap' }}>{fmtDate(tx.date)}</td>
                  <td style={{ padding: '14px 16px 14px 0', fontSize: 13, color: C.textDark }}>{tx.merchant}</td>
                  <td style={{ padding: '14px 16px 14px 0', fontSize: 12, color: C.textMid }}>{holder?.name ?? '—'}</td>
                  <td style={{ padding: '14px 16px 14px 0', fontSize: 12, color: C.textMid }}>{tx.category}</td>
                  <td style={{ padding: '14px 0', fontSize: 13, fontWeight: 500, color: C.textDark, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtAED(tx.amount)}</td>
                  <td style={{ padding: '14px 0 14px 16px', textAlign: 'right' }}><StatusBadge status={tx.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
