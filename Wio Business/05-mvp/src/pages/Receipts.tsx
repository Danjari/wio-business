import React, { useState, useMemo } from 'react'
import { Upload, CheckCircle, MessageCircle, X } from 'lucide-react'
import { TEAM, ALL_CATEGORIES, fmtAED, fmtDate } from '../data'
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
}

const shadow = '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'

type UploadState = 'idle' | 'uploading' | 'matched'

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 7,
  fontSize: 12, color: C.textMid, background: '#fff', outline: 'none', cursor: 'pointer',
}

function getHolderId(cardId: string, cards: AppState['cards']): string {
  return cards.find(c => c.id === cardId)?.holderId ?? ''
}

function inAmountRange(amount: number, range: string): boolean {
  if (range === 'all') return true
  if (range === 'u500') return amount < 500
  if (range === '500-2000') return amount >= 500 && amount <= 2000
  if (range === 'a2000') return amount > 2000
  return true
}

export default function Receipts({ transactions, setTransactions, cards, showToast }: AppState) {
  const [uploadStates, setUploadStates] = useState<Record<string, UploadState>>({})
  const [bulkUploading, setBulkUploading] = useState(false)

  const [holderFilter, setHolderFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('all')
  const [amountFilter, setAmountFilter] = useState('all')

  const missing = transactions.filter(t => !t.hasReceipt && t.status === 'approved')

  const filtered = useMemo(() => {
    let list = [...missing].sort((a, b) => b.date.localeCompare(a.date))
    if (holderFilter !== 'all') list = list.filter(t => getHolderId(t.cardId, cards) === holderFilter)
    if (catFilter !== 'all') list = list.filter(t => t.category === catFilter)
    list = list.filter(t => inAmountRange(t.amount, amountFilter))
    return list
  }, [missing, holderFilter, catFilter, amountFilter, cards])

  const isFiltered = holderFilter !== 'all' || catFilter !== 'all' || amountFilter !== 'all'
  const clearFilters = () => { setHolderFilter('all'); setCatFilter('all'); setAmountFilter('all') }

  const getCardholder = (cardId: string) => {
    const card = cards.find(c => c.id === cardId)
    return card ? TEAM.find(t => t.id === card.holderId) : null
  }

  const handleUpload = (txId: string) => {
    setUploadStates(prev => ({ ...prev, [txId]: 'uploading' }))
    setTimeout(() => {
      setUploadStates(prev => ({ ...prev, [txId]: 'matched' }))
      setTimeout(() => {
        setTransactions(prev => prev.map(t => t.id === txId ? { ...t, hasReceipt: true, zohoSynced: true } : t))
        setUploadStates(prev => { const n = { ...prev }; delete n[txId]; return n })
        showToast('Receipt matched — Zoho Books updated')
      }, 1400)
    }, 1500)
  }

  const handleBulkUpload = () => {
    if (bulkUploading || filtered.length === 0) return
    setBulkUploading(true)
    const ids = filtered.map(t => t.id)
    setTimeout(() => {
      setTransactions(prev => prev.map(t => ids.includes(t.id) ? { ...t, hasReceipt: true, zohoSynced: true } : t))
      setBulkUploading(false)
      showToast(`${ids.length} receipt${ids.length > 1 ? 's' : ''} matched — Zoho Books updated`)
    }, 2000)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: C.textDark, display: 'flex', alignItems: 'center', gap: 8 }}>
            Missing receipts
            {missing.length > 0 && (
              <span style={{ fontSize: 12, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: '#FEF3C7', color: '#D97706' }}>
                {missing.length}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: C.textLight, marginTop: 3 }}>Attach receipts to complete these transactions</div>
        </div>
        {filtered.length > 0 && (
          <button
            onClick={handleBulkUpload}
            disabled={bulkUploading}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 7,
              border: 'none', cursor: bulkUploading ? 'default' : 'pointer', fontFamily: 'inherit',
              background: bulkUploading ? '#E5E7EB' : C.purple,
              color: bulkUploading ? '#9CA3AF' : '#fff',
              fontSize: 12, fontWeight: 500, transition: 'all 150ms', flexShrink: 0,
            }}
          >
            {bulkUploading ? <><Spin />&nbsp;Matching all…</> : <><Upload size={13} /> Upload all ({filtered.length})</>}
          </button>
        )}
      </div>

      {missing.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: shadow, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={holderFilter} onChange={e => setHolderFilter(e.target.value)} style={selectStyle}>
            <option value="all">All cardholders</option>
            {TEAM.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={selectStyle}>
            <option value="all">All categories</option>
            {ALL_CATEGORIES.filter(c => c !== 'All Categories').map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={amountFilter} onChange={e => setAmountFilter(e.target.value)} style={selectStyle}>
            <option value="all">All amounts</option>
            <option value="u500">Under AED 500</option>
            <option value="500-2000">AED 500 – 2,000</option>
            <option value="a2000">Above AED 2,000</option>
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            {isFiltered && (
              <button onClick={clearFilters} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: C.purple, fontFamily: 'inherit' }}>
                <X size={12} /> Clear
              </button>
            )}
            <span style={{ fontSize: 12, color: C.textLight }}>{filtered.length} of {missing.length} missing</span>
          </div>
        </div>
      )}

      {missing.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 12, padding: 48, textAlign: 'center', boxShadow: shadow }}>
          <CheckCircle size={32} color={C.green} style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: C.textDark, marginBottom: 6 }}>All receipts collected</div>
          <div style={{ fontSize: 12, color: C.textLight }}>Every approved transaction has documentation</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 10, padding: 32, textAlign: 'center', boxShadow: shadow }}>
          <div style={{ fontSize: 13, color: C.textLight }}>No transactions match your filters</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(tx => {
            const holder = getCardholder(tx.cardId)
            const state = uploadStates[tx.id] ?? 'idle'
            const isUploading = state === 'uploading'
            const isMatched = state === 'matched'

            return (
              <div key={tx.id} style={{
                background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: shadow,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: C.purple, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
                    {holder?.initials ?? '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, marginBottom: 2 }}>{tx.merchant}</div>
                    <div style={{ fontSize: 11, color: C.textLight }}>
                      {holder?.name} · {fmtDate(tx.date)} · {tx.category}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.textDark, whiteSpace: 'nowrap' }}>{fmtAED(tx.amount)}</div>
                  {isMatched ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7, background: '#DCFCE7' }}>
                      <CheckCircle size={14} color={C.green} />
                      <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 500 }}>AI matched</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpload(tx.id)}
                      disabled={isUploading || bulkUploading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 7,
                        fontSize: 12, fontWeight: 500, cursor: (isUploading || bulkUploading) ? 'default' : 'pointer',
                        border: `1px solid ${(isUploading || bulkUploading) ? '#E5E7EB' : C.purple}`,
                        color: (isUploading || bulkUploading) ? '#9CA3AF' : C.purple,
                        background: 'none', transition: 'all 150ms', fontFamily: 'inherit',
                      }}
                    >
                      {isUploading ? <><Spin /> Matching…</> : <><Upload size={13} /> Upload receipt</>}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ background: '#EEE8FF', borderRadius: 10, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <MessageCircle size={16} color={C.purple} style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: C.purple, marginBottom: 4 }}>Push notification the moment a transaction clears</div>
          <div style={{ fontSize: 12, color: '#5700CC', lineHeight: 1.6 }}>
            One tap to capture the receipt — no chasing team members at month end. OCR extracts the amount, date, merchant, and VAT number automatically.
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function Spin() {
  return <span style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid #E5E7EB', borderTopColor: '#9CA3AF', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
}
