import React from 'react'
import { TEAM, fmtAED } from '../data'
import type { AppState } from '../App'

const C = {
  purple: '#5700FF',
  navy: '#0F1A38',
  textDark: '#1a1a1a',
  textMid: '#555555',
  textLight: '#999999',
  border: '#EBEBEB',
  bg: '#F7F7F9',
}

const shadow = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'

export default function Team({ cards, transactions }: AppState) {
  const memberSpend = TEAM.map(member => {
    const memberCards = cards.filter(c => c.holderId === member.id)
    const cardIds = memberCards.map(c => c.id)
    const totalSpend = transactions
      .filter(t => cardIds.includes(t.cardId) && t.status === 'approved')
      .reduce((sum, t) => sum + t.amount, 0)
    const primaryCard = memberCards[0]
    return { member, memberCards, totalSpend, primaryCard }
  }).sort((a, b) => b.totalSpend - a.totalSpend)

  const maxSpend = Math.max(...memberSpend.map(m => m.totalSpend), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: C.textDark }}>Team</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {TEAM.map(member => {
          const memberCards = cards.filter(c => c.holderId === member.id)
          const cardIds = memberCards.map(c => c.id)
          const totalSpend = transactions
            .filter(t => cardIds.includes(t.cardId) && t.status === 'approved')
            .reduce((sum, t) => sum + t.amount, 0)
          const primaryCard = memberCards[0]
          const pct = primaryCard ? Math.min((primaryCard.spent / primaryCard.limit) * 100, 100) : 0

          return (
            <div key={member.id} style={{
              background: '#fff', borderRadius: 12, padding: 20, boxShadow: shadow,
              display: 'flex', flexDirection: 'column', gap: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: member.isFounder ? C.navy : C.purple,
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 500, flexShrink: 0,
                }}>
                  {member.initials}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{member.name}</div>
                  <div style={{ fontSize: 11, color: C.textLight }}>{member.role}</div>
                </div>
                {member.isFounder && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 99, background: '#F3F4F6', color: C.textLight }}>
                    You
                  </span>
                )}
              </div>

              {primaryCard ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: C.textLight }}>{primaryCard.label} ···· {primaryCard.last4}</span>
                    <span style={{ fontSize: 11, color: pct > 80 ? '#F59E0B' : C.textLight }}>{Math.round(pct)}% used</span>
                  </div>
                  <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: pct > 80 ? '#F59E0B' : C.purple, borderRadius: 2 }} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 11, color: C.textLight }}>No card assigned</div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                <span style={{ fontSize: 11, color: C.textLight }}>Spend this month</span>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.textDark }}>{fmtAED(totalSpend)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Spend comparison */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: shadow }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, marginBottom: 18 }}>Spend by team member</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {memberSpend.map(({ member, totalSpend }) => (
            <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: member.isFounder ? C.navy : C.purple,
                color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 500, flexShrink: 0,
              }}>
                {member.initials}
              </div>
              <div style={{ width: 140, flexShrink: 0 }}>
                <div style={{ fontSize: 12, color: C.textMid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name.split(' ')[0]}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 5, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(totalSpend / maxSpend) * 100}%`,
                    background: member.isFounder ? C.navy : C.purple,
                    borderRadius: 3,
                    transition: 'width 500ms ease',
                  }} />
                </div>
              </div>
              <div style={{ width: 100, textAlign: 'right', fontSize: 13, fontWeight: 500, color: C.textDark, flexShrink: 0 }}>
                {fmtAED(totalSpend)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
