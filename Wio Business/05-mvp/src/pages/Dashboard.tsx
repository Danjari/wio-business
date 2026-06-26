import React from 'react'
import { TrendingUp, CreditCard, Clock, AlertTriangle } from 'lucide-react'
import { TEAM, fmtAED, fmtDate } from '../data'
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

const shadow = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'

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
    {
      label: "This month's spend", value: fmtAED(8205), sub: 'June 2026',
      icon: <TrendingUp size={15} />, onClick: undefined,
    },
    {
      label: 'Active cards', value: String(cards.filter(c => c.status === 'active').length),
      sub: 'across team members', icon: <CreditCard size={15} />, onClick: undefined,
    },
    {
      label: 'Pending approvals', value: String(pendingCount),
      sub: pendingCount > 0 ? 'requires your attention' : 'all clear',
      flagColor: pendingCount > 0 ? C.red : undefined,
      icon: <Clock size={15} />, onClick: () => navigate('approvals'),
    },
    {
      label: 'Missing receipts', value: String(missingCount),
      sub: 'transactions need docs',
      flagColor: missingCount > 0 ? C.amber : undefined,
      icon: <AlertTriangle size={15} />, onClick: () => navigate('receipts'),
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {kpis.map((k, i) => (
          <div
            key={i}
            onClick={k.onClick}
            style={{
              background: '#fff', borderRadius: 12, padding: '20px 22px',
              boxShadow: shadow,
              cursor: k.onClick ? 'pointer' : 'default',
              transition: 'box-shadow 150ms, transform 150ms',
            }}
            onMouseEnter={e => {
              if (k.onClick) {
                (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)'
                ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
              }
            }}
            onMouseLeave={e => {
              if (k.onClick) {
                (e.currentTarget as HTMLDivElement).style.boxShadow = shadow
                ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, color: C.textLight, fontWeight: 400, letterSpacing: '0.01em' }}>{k.label}</span>
              <span style={{ color: '#ccc' }}>{k.icon}</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 500, color: k.flagColor ?? C.textDark, lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.textLight }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Spend by category */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: shadow }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, marginBottom: 18 }}>Spend by category</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {CATEGORY_SPEND.map(c => (
              <div key={c.cat}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: C.textMid }}>{c.cat}</span>
                  <span style={{ fontSize: 12, fontWeight: 500, color: C.textDark }}>{fmtAED(c.amount)}</span>
                </div>
                <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${c.pct}%`, background: C.purple, borderRadius: 2, transition: 'width 500ms ease' }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card utilization */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: shadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>Card utilization</div>
            <button onClick={() => navigate('cards')} style={{ fontSize: 11, color: C.purple, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 400 }}>View cards</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {cards.map(card => {
              const holder = TEAM.find(t => t.id === card.holderId)
              const pct = Math.min((card.spent / card.limit) * 100, 100)
              const warn = pct > 80
              return (
                <div key={card.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: C.purple, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 500,
                  }}>
                    {holder?.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 12, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.label}</span>
                      <span style={{ fontSize: 11, color: warn ? C.amber : C.textLight, flexShrink: 0, marginLeft: 8 }}>{Math.round(pct)}%</span>
                    </div>
                    <div style={{ height: 3, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: warn ? C.amber : C.purple, borderRadius: 2 }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Recent transactions */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: shadow }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>Recent transactions</div>
          <button onClick={() => navigate('transactions')} style={{ fontSize: 11, color: C.purple, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 400 }}>View all</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date', 'Merchant', 'Cardholder', 'Category', 'Amount', 'Status'].map(h => (
                <th key={h} style={{
                  textAlign: h === 'Amount' ? 'right' : 'left',
                  fontSize: 10, fontWeight: 500, color: C.textLight,
                  padding: '0 0 10px', borderBottom: `1px solid ${C.border}`,
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
                  onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.bg }}
                  onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                >
                  <td style={{ padding: '11px 0', fontSize: 12, color: C.textLight, whiteSpace: 'nowrap' }}>{fmtDate(tx.date)}</td>
                  <td style={{ padding: '11px 12px 11px 0', fontSize: 13, color: C.textDark }}>{tx.merchant}</td>
                  <td style={{ padding: '11px 12px 11px 0', fontSize: 12, color: C.textMid }}>{holder?.name ?? '—'}</td>
                  <td style={{ padding: '11px 12px 11px 0', fontSize: 12, color: C.textMid }}>{tx.category}</td>
                  <td style={{ padding: '11px 0', fontSize: 13, fontWeight: 500, color: C.textDark, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtAED(tx.amount)}</td>
                  <td style={{ padding: '11px 0 11px 12px', textAlign: 'right' }}><StatusBadge status={tx.status} /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
