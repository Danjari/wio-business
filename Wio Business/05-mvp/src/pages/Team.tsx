import React from 'react'
import { TEAM, fmtAED, toAED } from '../data'
import type { AppState } from '../App'
import Avatar from '../components/Avatar'

const C = {
  purple: '#5700FF',
  navy: '#0F1A38',
  textDark: '#1a1a1a',
  textMid: '#555555',
  textLight: '#999999',
  border: '#EBEBEB',
}

export default function Team({ cards, transactions }: AppState) {
  const members = TEAM.map(member => {
    const memberCards = cards.filter(c => c.holderId === member.id)
    const cardIds = memberCards.map(c => c.id)
    const totalSpend = transactions
      .filter(t => cardIds.includes(t.cardId) && t.status === 'approved')
      .reduce((sum, t) => sum + toAED(t.amount, t.currency), 0)
    const primaryCard = memberCards[0]
    const pct = primaryCard ? Math.min((primaryCard.spent / primaryCard.limit) * 100, 100) : 0
    return { member, memberCards, totalSpend, primaryCard, pct }
  }).sort((a, b) => b.totalSpend - a.totalSpend)

  const maxSpend = Math.max(...members.map(m => m.totalSpend), 1)

  return (
    <>
      {/* Desktop table */}
      <div className="team-table" style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.6fr 1fr 1.4fr', gap: 16, padding: '0 0 12px', borderBottom: `1px solid ${C.border}` }}>
          {['Member', 'Card / Utilization', 'Cards', 'Spend this month'].map((h, i) => (
            <div key={h} style={{ fontSize: 10, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i === 3 ? 'right' : 'left' }}>
              {h}
            </div>
          ))}
        </div>

        {members.map(({ member, memberCards, totalSpend, primaryCard, pct }, i) => {
          const warn = pct > 80
          return (
            <div
              key={member.id}
              style={{
                display: 'grid', gridTemplateColumns: '2fr 1.6fr 1fr 1.4fr', gap: 16, alignItems: 'center',
                padding: '20px 0',
                borderBottom: i < members.length - 1 ? `1px solid ${C.border}` : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Avatar seed={member.name} size={36} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {member.name}
                    {member.isFounder && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: '#F3F4F6', color: C.textLight, fontWeight: 400 }}>You</span>}
                  </div>
                  <div style={{ fontSize: 11, color: C.textLight, marginTop: 1 }}>{member.role}</div>
                </div>
              </div>

              {primaryCard ? (
                <div>
                  <div style={{ fontSize: 11, color: C.textLight, marginBottom: 6 }}>
                    {primaryCard.label} ···· {primaryCard.last4}
                    <span style={{ marginLeft: 8, color: warn ? '#F59E0B' : C.textLight }}>{Math.round(pct)}%</span>
                  </div>
                  <div style={{ height: 3, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden', maxWidth: 160 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: warn ? '#F59E0B' : C.purple, borderRadius: 2 }} />
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: C.textLight }}>No card</div>
              )}

              <div style={{ fontSize: 13, color: C.textMid }}>{memberCards.length} card{memberCards.length !== 1 ? 's' : ''}</div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.textDark, marginBottom: 6 }}>{fmtAED(totalSpend)}</div>
                <div style={{ height: 3, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden', marginLeft: 'auto', width: '100%' }}>
                  <div style={{ height: '100%', width: `${(totalSpend / maxSpend) * 100}%`, background: member.isFounder ? C.navy : C.purple, borderRadius: 2, transition: 'width 500ms ease' }} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mobile card grid */}
      <div className="team-cards" style={{ display: 'none', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
        {members.map(({ member, memberCards, totalSpend }) => (
          <div
            key={member.id}
            style={{
              background: '#FAFAFA', border: `1px solid ${C.border}`, borderRadius: 12,
              padding: '16px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8,
            }}
          >
            <Avatar seed={member.name} size={44} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {member.name}
                {member.isFounder && <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 99, background: '#EEE8FF', color: C.purple, fontWeight: 500 }}>You</span>}
              </div>
              <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{member.role}</div>
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.textDark }}>{fmtAED(totalSpend)}</div>
            <div style={{ fontSize: 11, color: C.textLight }}>{memberCards.length} card{memberCards.length !== 1 ? 's' : ''}</div>
          </div>
        ))}
      </div>
    </>
  )
}
