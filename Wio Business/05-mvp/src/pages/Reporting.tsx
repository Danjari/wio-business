import React, { useState, useMemo } from 'react'
import { TrendingUp, CheckCircle2, Shield, User, AlertCircle } from 'lucide-react'
import { TEAM, fmtAED } from '../data'
import type { AppState } from '../App'

const C = {
  purple: '#5700FF',
  purpleLight: '#EEE8FF',
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

function KPI({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', boxShadow: shadow }}>
      <div style={{ fontSize: 11, color: C.textLight, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 500, color: accent ?? C.textDark, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.textLight, marginTop: 6 }}>{sub}</div>}
    </div>
  )
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header + period selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 15, fontWeight: 500, color: C.textDark }}>Reporting</div>
        <div style={{ display: 'flex', background: '#fff', borderRadius: 8, padding: 3, gap: 2, boxShadow: shadow }}>
          {PERIODS.map(p => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={{
              padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, fontWeight: 400, transition: 'all 120ms',
              background: period === p.value ? C.purple : 'none',
              color: period === p.value ? '#fff' : C.textLight,
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KPI label="Total spend" value={fmtAED(totalSpend)} sub={`${approved.length} transactions`} accent={C.purple} />
        <KPI label="Avg transaction" value={fmtAED(avgTx)} sub="per approved transaction" />
        <KPI label="Transactions processed" value={String(periodTxs.length)} sub={`${approved.length} approved`} />
        <KPI
          label="Receipt capture rate"
          value={`${captureRate}%`}
          sub={`${approved.filter(t => t.hasReceipt).length} of ${approved.length} receipts`}
          accent={captureRate >= 80 ? '#16A34A' : captureRate >= 50 ? '#D97706' : C.red}
        />
      </div>

      {/* Category + member */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: shadow }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, marginBottom: 16 }}>Spend by category</div>
          {catList.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textLight, textAlign: 'center', padding: '24px 0' }}>No data for this period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {catList.map(([cat, amount]) => {
                const pct = Math.round((amount / totalSpend) * 100)
                const barW = Math.round((amount / maxCat) * 100)
                return (
                  <div key={cat}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: C.textMid }}>{cat}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: C.textDark }}>{fmtAED(amount)}</span>
                    </div>
                    <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barW}%`, background: C.purple, borderRadius: 3, transition: 'width 400ms ease-out' }} />
                    </div>
                    <div style={{ fontSize: 10, color: C.textLight, marginTop: 3 }}>{pct}% of total</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: shadow }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, marginBottom: 16 }}>Spend by team member</div>
          {memberList.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textLight, textAlign: 'center', padding: '24px 0' }}>No data for this period</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {memberList.map(([memberId, amount]) => {
                const member = TEAM.find(m => m.id === memberId)
                const pct = Math.round((amount / totalSpend) * 100)
                const barW = Math.round((amount / maxMember) * 100)
                return (
                  <div key={memberId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.purple, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 500 }}>
                          {member?.initials ?? '?'}
                        </div>
                        <span style={{ fontSize: 12, color: C.textMid }}>{member?.name ?? 'Unknown'}</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: C.textDark }}>{fmtAED(amount)}</span>
                    </div>
                    <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barW}%`, background: '#CEB6FF', borderRadius: 3, transition: 'width 400ms ease-out' }} />
                    </div>
                    <div style={{ fontSize: 10, color: C.textLight, marginTop: 3 }}>{pct}% of total</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Monthly trend */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 24, boxShadow: shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
          <TrendingUp size={16} color={C.purple} />
          <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>Month-over-month spend</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 160 }}>
          {MONTHLY_TREND.map(({ month, amount }) => {
            const barH = Math.round((amount / trendMax) * 120)
            const isCurrent = month === 'Jun'
            return (
              <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: isCurrent ? C.purple : C.textLight }}>
                  {fmtAED(amount).replace('AED ', '')}
                </div>
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    width: '70%', height: barH, borderRadius: '4px 4px 0 0',
                    background: isCurrent ? C.purple : '#CEB6FF',
                    transition: 'height 400ms ease-out',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: isCurrent ? C.purple : C.textLight, fontWeight: isCurrent ? 500 : 400 }}>{month}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Policy compliance */}
      <div style={{ background: '#fff', borderRadius: 10, padding: 20, boxShadow: shadow }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, marginBottom: 16 }}>Policy compliance</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          <ComplianceStat
            icon={<CheckCircle2 size={15} color="#16A34A" />}
            label="Auto-approved"
            sublabel="Under AED 500"
            count={autoApproved}
            total={totalForPolicy}
            bg="#DCFCE7"
            color="#16A34A"
          />
          <ComplianceStat
            icon={<User size={15} color="#D97706" />}
            label="Manager approval"
            sublabel="AED 500 – 5,000"
            count={managerApproval}
            total={totalForPolicy}
            bg="#FEF3C7"
            color="#D97706"
          />
          <ComplianceStat
            icon={<Shield size={15} color={C.purple} />}
            label="Founder approval"
            sublabel="Above AED 5,000"
            count={founderApproval}
            total={totalForPolicy}
            bg="#EEE8FF"
            color={C.purple}
          />
          <div style={{ background: '#DCFCE7', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <AlertCircle size={15} color="#16A34A" />
              <span style={{ fontSize: 12, fontWeight: 500, color: '#16A34A' }}>Out-of-policy</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 500, color: '#16A34A', lineHeight: 1, marginBottom: 4 }}>0</div>
            <div style={{ fontSize: 11, color: '#16A34A' }}>Clean — no violations</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ComplianceStat({ icon, label, sublabel, count, total, bg, color }: {
  icon: React.ReactNode; label: string; sublabel: string; count: number; total: number; bg: string; color: string
}) {
  const pct = Math.round((count / total) * 100)
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        {icon}
        <span style={{ fontSize: 12, fontWeight: 500, color }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, color, lineHeight: 1, marginBottom: 4 }}>{count}</div>
      <div style={{ fontSize: 11, color, opacity: 0.8 }}>{sublabel}</div>
      <div style={{ fontSize: 11, color, marginTop: 4 }}>{pct}% of period</div>
    </div>
  )
}
