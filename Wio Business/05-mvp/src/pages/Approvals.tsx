import React, { useState, useMemo } from 'react'
import { Shield, User, Check, X, CheckCircle2 } from 'lucide-react'
import { TEAM, APPROVAL_RULES, fmtAED, fmtDate, type ProcessedApproval } from '../data'
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

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 7,
  fontSize: 12, color: C.textMid, background: '#fff', outline: 'none', cursor: 'pointer',
}

export default function Approvals({ approvals, setApprovals, processed, setProcessed, transactions, setTransactions, showToast }: AppState) {
  const [tab, setTab] = useState<'pending' | 'processed'>('pending')
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'approved' | 'declined'>('all')
  const [levelFilter, setLevelFilter] = useState<'all' | 'manager' | 'founder'>('all')
  const [requesterFilter, setRequesterFilter] = useState('all')

  const filteredProcessed = useMemo(() => {
    let list = [...processed].sort((a, b) => b.processedAt.localeCompare(a.processedAt))
    if (outcomeFilter !== 'all') list = list.filter(a => a.outcome === outcomeFilter)
    if (levelFilter !== 'all') list = list.filter(a => a.requiredLevel === levelFilter)
    if (requesterFilter !== 'all') list = list.filter(a => a.requestedById === requesterFilter)
    return list
  }, [processed, outcomeFilter, levelFilter, requesterFilter])

  const isFiltered = outcomeFilter !== 'all' || levelFilter !== 'all' || requesterFilter !== 'all'
  const clearFilters = () => { setOutcomeFilter('all'); setLevelFilter('all'); setRequesterFilter('all') }

  const handleApprove = (id: string) => {
    const item = approvals.find(a => a.id === id)
    if (!item) return
    setApprovals(prev => prev.filter(a => a.id !== id))
    setTransactions(prev => prev.map(t => t.id === item.txId ? { ...t, status: 'approved' as const } : t))
    setProcessed(prev => [...prev, { ...item, outcome: 'approved', processedAt: new Date().toISOString() } as ProcessedApproval])
    showToast('Transaction approved')
  }

  const handleDecline = (id: string) => {
    const item = approvals.find(a => a.id === id)
    if (!item) return
    setApprovals(prev => prev.filter(a => a.id !== id))
    setTransactions(prev => prev.map(t => t.id === item.txId ? { ...t, status: 'declined' as const } : t))
    setProcessed(prev => [...prev, { ...item, outcome: 'declined', processedAt: new Date().toISOString() } as ProcessedApproval])
    showToast('Transaction declined', 'error')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: `1px solid ${C.border}` }}>
        {(['pending', 'processed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', fontWeight: 400,
            background: 'none', fontSize: 13, fontFamily: 'inherit',
            color: tab === t ? C.purple : C.textLight,
            borderBottom: tab === t ? `2px solid ${C.purple}` : '2px solid transparent',
            marginBottom: -1, transition: 'color 150ms',
          }}>
            {t === 'pending' ? `Pending (${approvals.length})` : `Processed (${processed.length})`}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {approvals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <CheckCircle2 size={28} color={C.green} style={{ margin: '0 auto 12px', display: 'block' }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: C.textDark, marginBottom: 4 }}>All caught up</div>
              <div style={{ fontSize: 12, color: C.textLight }}>No pending approvals right now</div>
            </div>
          ) : (
            <>
              {approvals.map((item, i) => {
                const requester = TEAM.find(m => m.id === item.requestedById)
                const isFounder = item.requiredLevel === 'founder'
                const accentColor = isFounder ? C.purple : C.amber
                return (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24,
                    padding: '24px 0',
                    borderBottom: `1px solid ${C.border}`,
                    borderLeft: `3px solid ${accentColor}`,
                    paddingLeft: 20,
                  }}>
                    {/* Left: details */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 500, color: accentColor }}>
                          {isFounder ? <Shield size={11} /> : <User size={11} />}
                          {isFounder ? 'Founder approval' : 'Manager approval'}
                        </span>
                        <span style={{ fontSize: 11, color: C.textLight }}>· {fmtDate(item.date)}</span>
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 500, color: C.textDark, marginBottom: 2 }}>{item.merchant}</div>
                      <div style={{ fontSize: 26, fontWeight: 500, color: C.textDark, marginBottom: 10 }}>{fmtAED(item.amount)}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar seed={requester?.name ?? ''} size={22} />
                        <span style={{ fontSize: 12, color: C.textMid }}>{requester?.name} · {requester?.role}</span>
                      </div>
                      {item.note && (
                        <div style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', marginTop: 10, lineHeight: 1.6 }}>
                          "{item.note}"
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => handleApprove(item.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 7, border: 'none', background: C.purple, color: '#fff', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <Check size={14} /> Approve
                      </button>
                      <button
                        onClick={() => handleDecline(item.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 7, border: `1px solid ${C.border}`, background: 'none', color: C.textMid, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        <X size={14} /> Decline
                      </button>
                    </div>
                  </div>
                )
              })}

              {/* Approval rules */}
              <div style={{ marginTop: 40 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20 }}>Approval rules</div>
                {APPROVAL_RULES.map((r, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: i < APPROVAL_RULES.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <span style={{ fontSize: 13, color: C.textMid }}>{r.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{r.action}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'processed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value as typeof outcomeFilter)} style={selectStyle}>
              <option value="all">All outcomes</option>
              <option value="approved">Approved</option>
              <option value="declined">Declined</option>
            </select>
            <select value={levelFilter} onChange={e => setLevelFilter(e.target.value as typeof levelFilter)} style={selectStyle}>
              <option value="all">All levels</option>
              <option value="manager">Manager</option>
              <option value="founder">Founder</option>
            </select>
            <select value={requesterFilter} onChange={e => setRequesterFilter(e.target.value)} style={selectStyle}>
              <option value="all">All requesters</option>
              {TEAM.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            {isFiltered && (
              <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.purple, fontFamily: 'inherit' }}>
                <X size={12} /> Clear
              </button>
            )}
            <span style={{ fontSize: 12, color: C.textLight, marginLeft: 'auto' }}>{filteredProcessed.length} items</span>
          </div>

          {filteredProcessed.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: C.textLight, fontSize: 13 }}>No processed approvals yet</div>
          ) : (
            <div>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, padding: '0 0 12px', borderBottom: `1px solid ${C.border}` }}>
                {['Merchant / Requester', 'Amount', 'Date', 'Outcome'].map((h, i) => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 500, color: C.textLight, textTransform: 'uppercase', letterSpacing: '0.07em', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
                ))}
              </div>
              {filteredProcessed.map((item, i) => {
                const requester = TEAM.find(m => m.id === item.requestedById)
                const approved = item.outcome === 'approved'
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 16, alignItems: 'center', padding: '16px 0', borderBottom: i < filteredProcessed.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{item.merchant}</div>
                      <div style={{ fontSize: 11, color: C.textLight, marginTop: 2 }}>{requester?.name}</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, textAlign: 'right' }}>{fmtAED(item.amount)}</div>
                    <div style={{ fontSize: 12, color: C.textLight, textAlign: 'right' }}>{fmtDate(item.date)}</div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99, background: approved ? '#DCFCE7' : '#FEE2E2', color: approved ? '#16A34A' : '#DC2626' }}>
                        {approved ? 'Approved' : 'Declined'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
