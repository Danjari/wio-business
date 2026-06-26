import React, { useState, useMemo } from 'react'
import { TrendingUp, CheckCircle2, Shield, User, AlertCircle } from 'lucide-react'
import { TEAM, fmtAED } from '../data'
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
  red: '#EF4444',
}

type Period = 'month' | '3months' | '6months' | 'all'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This month' },
  { value: '3months', label: 'Last 3 months' },
  { value: '6months', label: 'Last 6 months' },
  { value: 'all', label: 'All time' },
]

function periodCutoff(period: Period): string {
  if (period === 'month') return '2026-06-01'
  if (period === '3months') return '2026-03-26'
  if (period === '6months') return '2025-12-26'
  return '2000-01-01'
}

const MONTHLY_TREND = [
  { month: 'Jan', amount: 6800 },
  { month: 'Feb', amount: 7200 },
  { month: 'Mar', amount: 5900 },
  { month: 'Apr', amount: 8100 },
  { month: 'May', amount: 9400 },
  { month: 'Jun', amount: 8205 },
]

export default function Reporting({ transactions, cards }: AppState) {
  const [period, setPeriod] = useState<Period>('month')

  const periodTxs = useMemo(() => {
    const cutoff = periodCutoff(period)
    return transactions.filter(t => t.date >= cutoff && t.status !== 'declined')
  }, [transactions, period])

  const approved = periodTxs.filter(t => t.status === 'approved')
  const totalSpend = approved.reduce((s, t) => s + t.amount, 0)
  const avgTx = approved.length > 0 ? Math.round(totalSpend / approved.length) : 0
  const captureRate = approved.length > 0 ? Math.round((approved.filter(t => t.hasReceipt).length / approved.length) * 100) : 0

  const catMap: Record<string, number> = {}
  approved.forEach(t => { catMap[t.category] = (catMap[t.category] ?? 0) + t.amount })
  const catList = Object.entries(catMap).sort((a, b) => b[1] - a[1])
  const maxCat = catList[0]?.[1] ?? 1

  const memberMap: Record<string, number> = {}
  approved.forEach(t => {
    const card = cards.find(c => c.id === t.cardId)
    if (card) memberMap[card.holderId] = (memberMap[card.holderId] ?? 0) + t.amount
  })
  const memberList = Object.entries(memberMap).sort((a, b) => b[1] - a[1])
  const maxMember = memberList[0]?.[1] ?? 1

  const autoApproved = periodTxs.filter(t => t.amount < 500 && t.status === 'approved').length
  const managerApproval = periodTxs.filter(t => t.amount >= 500 && t.amount <= 5000).length
  const founderApproval = periodTxs.filter(t => t.amount > 5000).length
  const totalForPolicy = periodTxs.length || 1

  const trendMax = Math.max(...MONTHLY_TREND.map(m => m.amount))

  const kpis = [
    { label: 'Total spend', value: fmtAED(totalSpend), sub: `${approved.length} transactions`, accent: C.purple as string | undefined },
    { label: 'Avg transaction', value: fmtAED(avgTx), sub: 'per approved transaction', accent: undefined as string | undefined },
    { label: 'Transactions', value: String(periodTxs.length), sub: `${approved.length} approved`, accent: undefined },
    { label: 'Receipt capture', value: `${captureRate}%`, sub: `${approved.filter(t => t.hasReceipt).length} of ${approved.length}`, accent: captureRate >= 80 ? '#16A34A' : captureRate >= 50 ? '#D97706' : C.red },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header + period selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: C.textDark }}>Reporting</div>
        <div style={{ display: 'flex', gap: 2 }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={{
              padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 400, transition: 'all 120ms',
              background: period === p.value ? C.purple : 'transparent',
              color: period === p.value ? '#fff' : C.textLight,
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'flex', paddingBottom: 32, marginBottom: 40, borderBottom: `1px solid ${C.border}` }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ flex: 1, paddingLeft: i === 0 ? 0 : 32, paddingRight: i < kpis.length - 1 ? 32 : 0, borderRight: i < kpis.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ fontSize: 11, color: C.textLight, marginBottom: 10, letterSpacing: '0.02em' }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: k.accent ?? C.textDark, lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.textLight }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Category + Member — two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, marginBottom: 48 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 22 }}>Spend by category</div>
          {catList.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textLight, padding: '24px 0' }}>No data for this period</div>
          ) : catList.map(([cat, amount], i) => {
            const pct = Math.round((amount / totalSpend) * 100)
            const barW = Math.round((amount / maxCat) * 100)
            return (
              <div key={cat} style={{ paddingBottom: 18, marginBottom: i < catList.length - 1 ? 18 : 0, borderBottom: i < catList.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontSize: 13, color: C.textMid }}>{cat}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{fmtAED(amount)}</span>
                </div>
                <div style={{ height: 3, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barW}%`, background: C.purple, borderRadius: 2, transition: 'width 400ms ease-out' }} />
                </div>
                <div style={{ fontSize: 10, color: C.textLight, marginTop: 4 }}>{pct}% of total</div>
              </div>
            )
          })}
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 22 }}>Spend by team member</div>
          {memberList.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textLight, padding: '24px 0' }}>No data for this period</div>
          ) : memberList.map(([memberId, amount], i) => {
            const member = TEAM.find(m => m.id === memberId)
            const pct = Math.round((amount / totalSpend) * 100)
            const barW = Math.round((amount / maxMember) * 100)
            return (
              <div key={memberId} style={{ paddingBottom: 18, marginBottom: i < memberList.length - 1 ? 18 : 0, borderBottom: i < memberList.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7, alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar seed={member?.name ?? ''} size={22} />
                    <span style={{ fontSize: 13, color: C.textMid }}>{member?.name ?? 'Unknown'}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{fmtAED(amount)}</span>
                </div>
                <div style={{ height: 3, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${barW}%`, background: '#CEB6FF', borderRadius: 2, transition: 'width 400ms ease-out' }} />
                </div>
                <div style={{ fontSize: 10, color: C.textLight, marginTop: 4 }}>{pct}% of total</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Monthly trend */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 36, marginBottom: 48 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <TrendingUp size={14} color={C.purple} />
          <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Month-over-month spend</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 140 }}>
          {MONTHLY_TREND.map(({ month, amount }) => {
            const barH = Math.round((amount / trendMax) * 110)
            const isCurrent = month === 'Jun'
            return (
              <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: isCurrent ? C.purple : C.textLight }}>
                  {fmtAED(amount).replace('AED ', '')}
                </div>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: '65%', height: barH, borderRadius: '3px 3px 0 0', background: isCurrent ? C.purple : '#E8E3FF', transition: 'height 400ms ease-out' }} />
                </div>
                <div style={{ fontSize: 11, color: isCurrent ? C.purple : C.textLight, fontWeight: isCurrent ? 500 : 400 }}>{month}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Policy compliance */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 28 }}>Policy compliance</div>
        <div style={{ display: 'flex' }}>
          {[
            { icon: <CheckCircle2 size={14} color="#16A34A" />, label: 'Auto-approved', sublabel: 'Under AED 500', count: autoApproved, color: '#16A34A' },
            { icon: <User size={14} color="#D97706" />, label: 'Manager approval', sublabel: 'AED 500 – 5,000', count: managerApproval, color: '#D97706' },
            { icon: <Shield size={14} color={C.purple} />, label: 'Founder approval', sublabel: 'Above AED 5,000', count: founderApproval, color: C.purple },
            { icon: <AlertCircle size={14} color="#16A34A" />, label: 'Out-of-policy', sublabel: 'Clean — no violations', count: 0, color: '#16A34A' },
          ].map((item, i) => (
            <div key={item.label} style={{ flex: 1, paddingRight: i < 3 ? 32 : 0, paddingLeft: i > 0 ? 32 : 0, borderRight: i < 3 ? `1px solid ${C.border}` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                {item.icon}
                <span style={{ fontSize: 12, fontWeight: 500, color: item.color }}>{item.label}</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 500, color: item.color, lineHeight: 1, marginBottom: 6 }}>{item.count}</div>
              <div style={{ fontSize: 11, color: C.textLight }}>{item.sublabel}</div>
              <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{Math.round((item.count / totalForPolicy) * 100)}% of period</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
