import React, { useState, useMemo } from 'react'
import { Shield, User, Check, X, CheckCircle2, ChevronRight } from 'lucide-react'
import { TEAM, APPROVAL_RULES, fmtAED, fmtDate, type ProcessedApproval } from '../data'
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {approvals.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center', boxShadow: shadow }}>
              <CheckCircle2 size={32} color={C.green} style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: C.textDark, marginBottom: 6 }}>All caught up</div>
              <div style={{ fontSize: 12, color: C.textLight }}>No pending approvals right now</div>
            </div>
          ) : (
            <>
              {/* Pending approval cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {approvals.map(item => {
                  const requester = TEAM.find(m => m.id === item.requestedById)
                  const isFounder = item.requiredLevel === 'founder'
                  return (
                    <div key={item.id} style={{ background: '#fff', borderRadius: 12, padding: '22px 24px', boxShadow: shadow }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* Level badge */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <span style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
                              background: isFounder ? '#EEE8FF' : '#FEF3C7',
                              color: isFounder ? C.purple : '#D97706',
                            }}>
                              {isFounder ? <Shield size={11} /> : <User size={11} />}
                              {isFounder ? 'Founder approval' : 'Manager approval'}
                            </span>
                            <span style={{ fontSize: 11, color: C.textLight }}>{fmtDate(item.date)}</span>
                          </div>

                          {/* Merchant + amount */}
                          <div style={{ fontSize: 18, fontWeight: 500, color: C.textDark, marginBottom: 4 }}>{item.merchant}</div>
                          <div style={{ fontSize: 24, fontWeight: 500, color: C.textDark, marginBottom: 12 }}>{fmtAED(item.amount)}</div>

                          {/* Requester */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: C.purple, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 500 }}>
                              {requester?.initials}
                            </div>
                            <span style={{ fontSize: 12, color: C.textMid }}>{requester?.name} · {requester?.role}</span>
                          </div>

                          {/* Note */}
                          {item.note && (
                            <div style={{ fontSize: 12, color: C.textLight, fontStyle: 'italic', lineHeight: 1.6, padding: '10px 14px', background: C.bg, borderRadius: 8 }}>
                              "{item.note}"
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                          <button
                            onClick={() => handleApprove(item.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8,
                              border: 'none', background: C.purple, color: '#fff',
                              fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'opacity 150ms',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            onClick={() => handleDecline(item.id)}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 6, padding: '9px 20px', borderRadius: 8,
                              border: `1px solid ${C.border}`, background: 'none',
                              color: C.textMid, fontSize: 13, fontWeight: 400, cursor: 'pointer',
                            }}
                          >
                            <X size={14} /> Decline
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Approval rules */}
              <div style={{ background: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: shadow }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: C.textLight, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Approval rules</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {APPROVAL_RULES.map((r, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: i < APPROVAL_RULES.length - 1 ? `1px solid ${C.border}` : 'none',
                    }}>
                      <span style={{ fontSize: 13, color: C.textMid }}>{r.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <ChevronRight size={13} color={C.textLight} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{r.action}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'processed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Filters */}
          <div style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: shadow, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
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
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
              {isFiltered && (
                <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.purple, fontFamily: 'inherit' }}>
                  <X size={12} /> Clear
                </button>
              )}
              <span style={{ fontSize: 12, color: C.textLight }}>{filteredProcessed.length} items</span>
            </div>
          </div>

          {filteredProcessed.length === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 36, textAlign: 'center', boxShadow: shadow }}>
              <div style={{ fontSize: 13, color: C.textLight }}>No processed approvals yet</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredProcessed.map(item => {
                const requester = TEAM.find(m => m.id === item.requestedById)
                const approved = item.outcome === 'approved'
                return (
                  <div key={item.id} style={{
                    background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: shadow,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.bg, color: C.textLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, flexShrink: 0 }}>
                        {requester?.initials}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{item.merchant}</div>
                        <div style={{ fontSize: 11, color: C.textLight }}>{requester?.name} · {fmtDate(item.date)}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.textDark, whiteSpace: 'nowrap' }}>{fmtAED(item.amount)}</div>
                    <span style={{
                      fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 99,
                      background: approved ? '#DCFCE7' : '#FEE2E2',
                      color: approved ? '#16A34A' : '#DC2626',
                    }}>
                      {approved ? 'Approved' : 'Declined'}
                    </span>
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
