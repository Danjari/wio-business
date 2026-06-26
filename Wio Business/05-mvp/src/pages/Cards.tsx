import React, { useState, useEffect } from 'react'
import { Plus, X, Zap, Lock, Snowflake } from 'lucide-react'
import { TEAM, ALL_CATEGORIES, fmtAED, type Card } from '../data'
import type { AppState } from '../App'
import { FlipCard } from '../components/CreditCard'

const C = {
  purple: '#5700FF',
  textDark: '#1a1a1a',
  textMid: '#555555',
  textLight: '#999999',
  border: '#EBEBEB',
  bg: '#F7F7F9',
  amber: '#F59E0B',
  green: '#22C55E',
}

const shadow = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'

const GRADIENTS = [
  // Deep royal navy — rich midnight blue with a brighter blue sweep
  'linear-gradient(140deg, #04091A 0%, #071640 40%, #0D2B72 65%, #061230 100%)',
  // Gunmetal iron — warm charcoal with a lifted steel midpoint
  'linear-gradient(135deg, #0E0E0E 0%, #1E2330 38%, #2E3545 62%, #131519 100%)',
  // Slate / brushed titanium — cool blue-grey with a silver lift
  'linear-gradient(125deg, #141E28 0%, #243448 35%, #3A5068 58%, #1A2A3C 100%)',
  // Obsidian — near-black with subtle violet depth
  'linear-gradient(150deg, #0A080F 0%, #16122A 40%, #211B3A 62%, #100E1E 100%)',
  // Dark petrol — deep teal-navy, like carbon-coated ocean
  'linear-gradient(130deg, #060F1E 0%, #0C2040 38%, #173655 62%, #09192F 100%)',
]

function IssueCardModal({ onClose, onIssue }: { onClose: () => void; onIssue: (card: Card) => void }) {
  const [label, setLabel] = useState('')
  const [holderId, setHolderId] = useState(TEAM[1].id)
  const [limit, setLimit] = useState('')
  const [cats, setCats] = useState<string[]>([])
  const [validity, setValidity] = useState<'none' | '30' | '90'>('none')

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [onClose])

  const holder = TEAM.find(t => t.id === holderId)!
  const valid = label.trim().length > 0 && Number(limit) > 0 && cats.length > 0

  const handleSubmit = () => {
    if (!valid) return
    const newCard: Card = {
      id: `c${Date.now()}`,
      holderId,
      label: label.trim(),
      last4: String(Math.floor(1000 + Math.random() * 9000)),
      limit: Number(limit),
      spent: 0,
      categories: cats,
      status: 'active',
      expiresIn: validity === '30' ? '30 days' : validity === '90' ? '90 days' : undefined,
    }
    onIssue(newCard)
  }

  const toggleCat = (cat: string) => {
    if (cat === 'All Categories') {
      setCats(prev => prev.includes('All Categories') ? [] : ['All Categories'])
    } else {
      setCats(prev => {
        const without = prev.filter(c => c !== 'All Categories')
        return without.includes(cat) ? without.filter(c => c !== cat) : [...without, cat]
      })
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 14, width: 780, maxHeight: '90vh',
          display: 'flex', overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(0,0,0,0.2)',
        }}
      >
        {/* Form */}
        <div style={{ flex: 1, padding: 28, overflowY: 'auto', borderRight: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.textDark }}>Issue new card</div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight }}><X size={18} /></button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <label>
              <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Card label</div>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Engineering, HR, Travel"
                style={inputStyle}
              />
            </label>

            <label>
              <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Cardholder</div>
              <select value={holderId} onChange={e => setHolderId(e.target.value)} style={inputStyle}>
                {TEAM.map(t => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}
              </select>
            </label>

            <label>
              <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Spending limit</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: C.textLight }}>AED</span>
                <input
                  type="number"
                  value={limit}
                  onChange={e => setLimit(e.target.value)}
                  placeholder="0"
                  style={{ ...inputStyle, paddingLeft: 50 }}
                />
              </div>
            </label>

            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Allowed categories</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ALL_CATEGORIES.map(cat => {
                  const sel = cats.includes(cat)
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCat(cat)}
                      style={{
                        padding: '5px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', fontWeight: 400,
                        border: `1px solid ${sel ? C.purple : C.border}`,
                        background: sel ? '#EEE8FF' : '#fff',
                        color: sel ? C.purple : C.textMid,
                        transition: 'all 120ms',
                      }}
                    >
                      {cat}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Validity</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['none', '30', '90'] as const).map(v => (
                  <button
                    key={v}
                    onClick={() => setValidity(v)}
                    style={{
                      padding: '6px 16px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontWeight: 400,
                      border: `1px solid ${validity === v ? C.purple : C.border}`,
                      background: validity === v ? '#EEE8FF' : '#fff',
                      color: validity === v ? C.purple : C.textMid,
                      transition: 'all 120ms',
                    }}
                  >
                    {v === 'none' ? 'No expiry' : `${v} days`}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={!valid}
              style={{
                padding: '12px 0', borderRadius: 8, border: 'none', cursor: valid ? 'pointer' : 'not-allowed',
                background: valid ? C.purple : '#E5E7EB',
                color: valid ? '#fff' : '#9CA3AF',
                fontSize: 13, fontWeight: 500, marginTop: 4,
                transition: 'background 150ms',
              }}
            >
              Issue card
            </button>
          </div>
        </div>

        {/* Preview */}
        <div style={{ width: 300, padding: 28, background: C.bg, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Preview</div>
          <FlipCard
            gradient={GRADIENTS[0]}
            label={label || 'New Card'}
            last4="0000"
            holderName={holder.name}
            limit={Number(limit) || undefined}
            fmtAED={fmtAED}
          />

          {/* Policy summary */}
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: shadow }}>
            <div style={{ fontSize: 10, fontWeight: 500, color: C.textLight, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Policy</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <PolicyRow icon={<Lock size={12} />} label="Limit" value={limit ? fmtAED(Number(limit)) : '—'} />
              <PolicyRow icon={<Zap size={12} />} label="Categories" value={cats.length === 0 ? 'None set' : cats.includes('All Categories') ? 'All' : `${cats.length} selected`} />
              <PolicyRow icon={<Zap size={12} />} label="Validity" value={validity === 'none' ? 'No expiry' : `${validity} days`} />
            </div>
            {cats.length > 0 && !cats.includes('All Categories') && (
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {cats.map(c => (
                  <span key={c} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, background: '#EEE8FF', color: C.purple }}>{c}</span>
                ))}
              </div>
            )}
          </div>

          <div style={{ fontSize: 11, color: C.textLight, lineHeight: 1.6 }}>
            Spend outside these categories is automatically declined at the point of sale.
          </div>
        </div>
      </div>
    </div>
  )
}

function PolicyRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.textLight }}>{icon}{label}</span>
      <span style={{ fontSize: 12, fontWeight: 500, color: C.textDark }}>{value}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8,
  fontSize: 13, color: '#1a1a1a', outline: 'none', background: '#fff',
  appearance: 'none' as const,
  transition: 'border-color 150ms',
}

export default function Cards({ cards, setCards, transactions, navigate, showToast }: AppState) {
  const [showModal, setShowModal] = useState(false)

  const handleIssue = (card: Card) => {
    setCards(prev => [...prev, card])
    setShowModal(false)
    showToast('Card issued successfully')
  }

  const toggleFreeze = (cardId: string) => {
    setCards(prev => prev.map(c => {
      if (c.id !== cardId) return c
      const next = c.status === 'active' ? 'frozen' : 'active'
      showToast(next === 'frozen' ? 'Card frozen' : 'Card unfrozen')
      return { ...c, status: next }
    }))
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textDark }}>Cards</div>
          <div style={{ fontSize: 12, color: C.textLight, marginTop: 3 }}>
            {cards.filter(c => c.status === 'active').length} active
            {cards.filter(c => c.status === 'frozen').length > 0 && ` · ${cards.filter(c => c.status === 'frozen').length} frozen`}
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', background: C.purple, color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}
        >
          <Plus size={14} /> Issue new card
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        {cards.map((card, idx) => {
          const holder = TEAM.find(t => t.id === card.holderId)
          const pct = Math.min((card.spent / card.limit) * 100, 100)
          const warn = pct > 80
          const frozen = card.status === 'frozen'
          const cardTxs = transactions.filter(t => t.cardId === card.id)

          return (
            <div key={card.id} style={{
              background: '#fff', borderRadius: 16, padding: 22,
              boxShadow: shadow,
              opacity: frozen ? 0.75 : 1, transition: 'opacity 200ms',
            }}>
              <FlipCard
                gradient={GRADIENTS[idx % GRADIENTS.length]}
                label={card.label}
                last4={card.last4}
                holderName={holder?.name ?? '—'}
                limit={card.limit}
                frozen={frozen}
                fmtAED={fmtAED}
              />

              <div style={{ marginTop: 18 }}>
                {/* Spend progress */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 12, color: C.textMid }}>{fmtAED(card.spent)} spent</span>
                    <span style={{ fontSize: 12, color: warn ? C.amber : C.textLight }}>{fmtAED(card.limit)} limit</span>
                  </div>
                  <div style={{ height: 4, background: '#F3F4F6', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: warn ? C.amber : C.purple, borderRadius: 2, transition: 'width 400ms ease' }} />
                  </div>
                </div>

                {/* Categories */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 16 }}>
                  {card.categories.map(cat => (
                    <span key={cat} style={{ fontSize: 10, padding: '3px 9px', borderRadius: 99, background: '#F3F4F6', color: '#777' }}>{cat}</span>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                  <button
                    onClick={() => navigate('transactions')}
                    style={{ fontSize: 12, color: C.purple, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 400 }}
                  >
                    {cardTxs.length} transaction{cardTxs.length !== 1 ? 's' : ''}
                  </button>
                  <button
                    onClick={() => toggleFreeze(card.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                      border: `1px solid ${frozen ? '#22C55E30' : C.border}`,
                      background: frozen ? '#F0FDF4' : 'none',
                      color: frozen ? '#22C55E' : C.textLight,
                      fontWeight: 400, transition: 'all 150ms',
                    }}
                  >
                    <Snowflake size={12} />
                    {frozen ? 'Unfreeze' : 'Freeze'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <IssueCardModal
          onClose={() => setShowModal(false)}
          onIssue={handleIssue}
        />
      )}
    </div>
  )
}
