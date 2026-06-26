import React, { useState } from 'react'
import { CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { TEAM, CHART_OF_ACCOUNTS, fmtAED, fmtDate } from '../data'
import type { AppState } from '../App'

const C = {
  purple: '#5700FF',
  textDark: '#1a1a1a',
  textMid: '#555555',
  textLight: '#999999',
  border: '#EBEBEB',
  bg: '#F7F7F9',
  green: '#22C55E',
  zoho: '#1AB394',
}

const shadow = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'

export default function Accounting({ transactions, cards, showToast }: AppState) {
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState('2 minutes ago')

  const synced = transactions.filter(t => t.zohoSynced)
  const unsynced = transactions.filter(t => !t.zohoSynced)

  const handleSync = () => {
    setSyncing(true)
    setTimeout(() => {
      setSyncing(false)
      setLastSync('just now')
      showToast('Zoho Books sync complete')
    }, 1200)
  }

  const getCardholder = (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    return card ? TEAM.find(t => t.id === card.holderId) : null
  }

  const kpis = [
    { label: 'Synced today', value: '8' },
    { label: 'Exceptions', value: '0' },
    { label: 'Total this month', value: String(synced.length) },
    { label: 'Success rate', value: '100%' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontSize: 15, fontWeight: 500, color: C.textDark }}>Accounting sync</div>

      {/* Zoho connection card */}
      <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: shadow }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10, background: '#E6FAF6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 500, color: C.zoho,
            }}>
              ZB
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, color: C.zoho, marginBottom: 2 }}>Zoho Books</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green }} />
                <span style={{ fontSize: 12, color: C.textMid }}>Connected — syncing in real time</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: C.textLight }}>Last sync</div>
              <div style={{ fontSize: 12, fontWeight: 500, color: C.textDark }}>{lastSync}</div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 16px', borderRadius: 7, border: `1px solid ${C.border}`,
                background: 'none', color: C.textMid, fontSize: 12, cursor: syncing ? 'default' : 'pointer',
                fontWeight: 400,
              }}
            >
              <RefreshCw size={13} style={{ animation: syncing ? 'spin 0.7s linear infinite' : 'none' }} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: '#fff', borderRadius: 10, padding: '16px 18px', boxShadow: shadow }}>
            <div style={{ fontSize: 22, fontWeight: 500, color: C.textDark, marginBottom: 4 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Sync log */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '20px 22px', boxShadow: shadow }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, marginBottom: 16 }}>Sync log</div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Date', 'Merchant', 'Amount', 'Category', 'Chart of accounts', 'Status'].map(h => (
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
            {synced.slice(0, 8).map((tx, i) => (
              <tr key={tx.id}
                style={{ borderBottom: i < Math.min(synced.length, 8) - 1 ? `1px solid ${C.border}` : 'none', transition: 'background 100ms' }}
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = C.bg }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
              >
                <td style={{ padding: '10px 0', fontSize: 12, color: C.textLight }}>{fmtDate(tx.date)}</td>
                <td style={{ padding: '10px 12px 10px 0', fontSize: 13, color: C.textDark }}>{tx.merchant}</td>
                <td style={{ padding: '10px 12px 10px 0', fontSize: 13, fontWeight: 500, color: C.textDark, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtAED(tx.amount)}</td>
                <td style={{ padding: '10px 12px 10px 0', fontSize: 12, color: C.textMid }}>{tx.category}</td>
                <td style={{ padding: '10px 12px 10px 0', fontSize: 11, color: C.textLight }}>{CHART_OF_ACCOUNTS[tx.category] ?? '6999 — Miscellaneous'}</td>
                <td style={{ padding: '10px 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#16A34A' }}>
                    <CheckCircle2 size={12} /> Synced
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Unsynced */}
      {unsynced.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '20px 22px', boxShadow: shadow }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Clock size={14} color={C.textLight} />
            <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>Pending sync ({unsynced.length})</div>
          </div>
          <div style={{ fontSize: 12, color: C.textLight, marginBottom: 14, lineHeight: 1.6 }}>
            These transactions sync to Zoho Books once approved and receipt is attached.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unsynced.map(tx => {
              const holder = getCardholder(tx.cardId)
              return (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: C.bg, borderRadius: 7 }}>
                  <div>
                    <div style={{ fontSize: 13, color: C.textDark }}>{tx.merchant}</div>
                    <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
                      {holder?.name} · {fmtDate(tx.date)}
                      {!tx.hasReceipt && <span style={{ marginLeft: 8, color: '#D97706' }}>· Missing receipt</span>}
                      {tx.status === 'pending_approval' && <span style={{ marginLeft: 8, color: '#D97706' }}>· Awaiting approval</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{fmtAED(tx.amount)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Coming soon */}
      <div style={{ background: '#fff', borderRadius: 10, padding: '20px 22px', boxShadow: shadow }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Coming in Phase 2</div>
        <div style={{ display: 'flex', gap: 14 }}>
          {[
            { name: 'QuickBooks Online', color: '#2CA01C' },
            { name: 'Xero', color: '#13B5EA' },
            { name: 'Odoo', color: '#714B67' },
          ].map(int => (
            <div key={int.name} style={{
              flex: 1, padding: '14px 16px', borderRadius: 8,
              border: `1px solid ${C.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: C.bg, opacity: 0.7,
            }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: int.color }}>{int.name}</span>
              <span style={{ fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: '#F3F4F6', color: C.textLight }}>Phase 2</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
