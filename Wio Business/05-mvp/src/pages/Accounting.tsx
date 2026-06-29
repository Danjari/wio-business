import React, { useState } from 'react'
import { CheckCircle2, Clock, RefreshCw } from 'lucide-react'
import { TEAM, CHART_OF_ACCOUNTS, fmtAmount, fmtDate } from '../data'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Zoho connection — clean status row, no card box */}
      <div className="acct-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 28, marginBottom: 32, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: '#E6FAF6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 500, color: C.zoho }}>
            ZB
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500, color: C.zoho, marginBottom: 4 }}>Zoho Books</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />
              <span style={{ fontSize: 12, color: C.textMid }}>Connected — syncing in real time</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: C.textLight }}>Last sync</div>
            <div style={{ fontSize: 12, fontWeight: 500, color: C.textDark }}>{lastSync}</div>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'none', color: C.textMid, fontSize: 12, cursor: syncing ? 'default' : 'pointer', fontFamily: 'inherit' }}
          >
            <RefreshCw size={13} style={{ animation: syncing ? 'spin 0.7s linear infinite' : 'none' }} />
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="report-kpi" style={{ display: 'flex', paddingBottom: 32, marginBottom: 40, borderBottom: `1px solid ${C.border}` }}>
        {kpis.map((k, i) => (
          <div key={k.label} style={{ flex: 1, paddingLeft: i === 0 ? 0 : 32, paddingRight: i < kpis.length - 1 ? 32 : 0, borderRight: i < kpis.length - 1 ? `1px solid ${C.border}` : 'none' }}>
            <div style={{ fontSize: 11, color: C.textLight, marginBottom: 10, letterSpacing: '0.02em' }}>{k.label}</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: C.textDark, lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Sync log — table, no outer box */}
      <div className="table-scroll" style={{ marginBottom: 40 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>Sync log</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
          <thead>
            <tr>
              {['Date', 'Merchant', 'Amount', 'Category', 'Chart of accounts', 'Status'].map(h => (
                <th key={h} style={{
                  textAlign: h === 'Amount' ? 'right' : 'left',
                  fontSize: 10, fontWeight: 500, color: C.textLight,
                  padding: '0 14px 14px 0', borderBottom: `1px solid ${C.border}`,
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
                onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = '#FAFAFA' }}
                onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
              >
                <td style={{ padding: '13px 14px 13px 0', fontSize: 12, color: C.textLight }}>{fmtDate(tx.date)}</td>
                <td style={{ padding: '13px 14px 13px 0', fontSize: 13, color: C.textDark }}>{tx.merchant}</td>
                <td style={{ padding: '13px 14px 13px 0', fontSize: 13, fontWeight: 500, color: C.textDark, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtAmount(tx.amount, tx.currency)}</td>
                <td style={{ padding: '13px 14px 13px 0', fontSize: 12, color: C.textMid }}>{tx.category}</td>
                <td style={{ padding: '13px 14px 13px 0', fontSize: 11, color: C.textLight }}>{CHART_OF_ACCOUNTS[tx.category] ?? '6999 — Miscellaneous'}</td>
                <td style={{ padding: '13px 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#16A34A' }}>
                    <CheckCircle2 size={12} /> Synced
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending sync — rows with borderBottom */}
      {unsynced.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 32, marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <Clock size={13} color={C.textLight} />
            <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Pending sync ({unsynced.length})</div>
          </div>
          <div style={{ fontSize: 12, color: C.textLight, marginBottom: 20, lineHeight: 1.6 }}>
            These transactions sync to Zoho Books once approved and receipt is attached.
          </div>
          {unsynced.map((tx, i) => {
            const holder = getCardholder(tx.cardId)
            return (
              <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < unsynced.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <div>
                  <div style={{ fontSize: 13, color: C.textDark }}>{tx.merchant}</div>
                  <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>
                    {holder?.name} · {fmtDate(tx.date)}
                    {!tx.hasReceipt && <span style={{ marginLeft: 8, color: '#D97706' }}>· Missing receipt</span>}
                    {tx.status === 'pending_approval' && <span style={{ marginLeft: 8, color: '#D97706' }}>· Awaiting approval</span>}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{fmtAmount(tx.amount, tx.currency)}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* Coming soon */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>Coming in Phase 2</div>
        <div className="acct-integrations" style={{ display: 'flex', gap: 16 }}>
          {[
            { name: 'QuickBooks Online', color: '#2CA01C' },
            { name: 'Xero', color: '#13B5EA' },
            { name: 'Odoo', color: '#714B67' },
          ].map(int => (
            <div key={int.name} style={{ flex: 1, padding: '14px 16px', borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.6 }}>
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
