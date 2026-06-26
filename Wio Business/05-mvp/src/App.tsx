import React, { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, CreditCard, CheckCircle, Receipt, ArrowLeftRight,
  Users, BarChart2, BookOpen, Bell,
} from 'lucide-react'
import {
  TEAM, INITIAL_CARDS, INITIAL_TRANSACTIONS, INITIAL_APPROVALS,
  ACCOUNT_BALANCE, fmtAED,
  type Card, type Transaction, type Approval, type ProcessedApproval,
} from './data'
import Dashboard from './pages/Dashboard'
import Cards from './pages/Cards'
import Approvals from './pages/Approvals'
import Receipts from './pages/Receipts'
import Transactions from './pages/Transactions'
import Team from './pages/Team'
import Reporting from './pages/Reporting'
import Accounting from './pages/Accounting'

type Page = 'dashboard' | 'cards' | 'approvals' | 'receipts' | 'transactions' | 'team' | 'reporting' | 'accounting'

export type Toast = { id: number; message: string; variant?: 'success' | 'error' }

export type AppState = {
  cards: Card[]
  setCards: React.Dispatch<React.SetStateAction<Card[]>>
  transactions: Transaction[]
  setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
  approvals: Approval[]
  setApprovals: React.Dispatch<React.SetStateAction<Approval[]>>
  processed: ProcessedApproval[]
  setProcessed: React.Dispatch<React.SetStateAction<ProcessedApproval[]>>
  navigate: (p: Page) => void
  showToast: (message: string, variant?: 'success' | 'error') => void
}

const C = {
  purple: '#5700FF',
  navy: '#0F1A38',
  textDark: '#333333',
  textMid: '#555555',
  textLight: '#6A6D78',
  border: '#F0F0F0',
  bg: '#FAFAFA',
  sidebar: '#FFFFFF',
}

const NAV: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={16} /> },
  { id: 'cards', label: 'Cards', icon: <CreditCard size={16} /> },
  { id: 'approvals', label: 'Approvals', icon: <CheckCircle size={16} /> },
  { id: 'receipts', label: 'Receipts', icon: <Receipt size={16} /> },
  { id: 'transactions', label: 'Transactions', icon: <ArrowLeftRight size={16} /> },
  { id: 'team', label: 'Team', icon: <Users size={16} /> },
  { id: 'reporting', label: 'Reporting', icon: <BarChart2 size={16} /> },
  { id: 'accounting', label: 'Accounting', icon: <BookOpen size={16} /> },
]

let toastCounter = 0

export default function App() {
  const [page, setPage] = useState<Page>('dashboard')
  const [cards, setCards] = useState<Card[]>(INITIAL_CARDS)
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS)
  const [approvals, setApprovals] = useState<Approval[]>(INITIAL_APPROVALS)
  const [processed, setProcessed] = useState<ProcessedApproval[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [hoveredNav, setHoveredNav] = useState<Page | null>(null)

  const pendingCount = approvals.length
  const missingReceiptCount = transactions.filter(t => !t.hasReceipt && t.status !== 'pending_approval' && t.status !== 'declined').length

  const navigate = useCallback((p: Page) => setPage(p), [])

  const showToast = useCallback((message: string, variant: 'success' | 'error' = 'success') => {
    const id = ++toastCounter
    setToasts(prev => [...prev, { id, message, variant }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPage('dashboard')
    }
    window.addEventListener('keydown', fn)
    return () => window.removeEventListener('keydown', fn)
  }, [])

  const appState: AppState = {
    cards, setCards,
    transactions, setTransactions,
    approvals, setApprovals,
    processed, setProcessed,
    navigate,
    showToast,
  }

  const founder = TEAM.find(t => t.isFounder)!

  return (
    <div style={{ display: 'flex', height: '100%', background: '#F7F7F9' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, flexShrink: 0, background: '#FAFAFA',
        borderRight: '1px solid #EBEBEB',
        display: 'flex', flexDirection: 'column',
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 30,
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #EBEBEB' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: C.purple,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontSize: 11, fontWeight: 500 }}>W</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark, lineHeight: 1.2 }}>Wio Business</div>
              <div style={{ fontSize: 10, color: C.textLight, fontWeight: 400 }}>Spend Management</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {NAV.map(item => {
            const active = page === item.id
            const hovered = hoveredNav === item.id && !active
            const badge = item.id === 'approvals' ? pendingCount
              : item.id === 'receipts' ? missingReceiptCount
              : item.id === 'cards' ? cards.length
              : 0
            const badgeVariant = item.id === 'approvals' ? 'red'
              : item.id === 'receipts' ? 'amber'
              : 'gray'
            return (
              <button
                key={item.id}
                onClick={() => setPage(item.id)}
                onMouseEnter={() => setHoveredNav(item.id)}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  marginBottom: 2,
                  background: active ? C.purple : hovered ? '#F5F3FF' : 'transparent',
                  color: active ? '#fff' : C.textMid,
                  fontSize: 13, fontWeight: active ? 500 : 400,
                  transition: 'background 120ms, color 120ms',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ opacity: active ? 1 : 0.7 }}>{item.icon}</span>
                  {item.label}
                </span>
                {badge > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 500, lineHeight: 1,
                    padding: '2px 6px', borderRadius: 99,
                    background: active
                      ? 'rgba(255,255,255,0.25)'
                      : badgeVariant === 'red' ? '#FEE2E2'
                      : badgeVariant === 'amber' ? '#FEF3C7'
                      : '#F0F0F0',
                    color: active
                      ? '#fff'
                      : badgeVariant === 'red' ? '#DC2626'
                      : badgeVariant === 'amber' ? '#D97706'
                      : C.textLight,
                  }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid #EBEBEB' }}>
          <div style={{ fontSize: 10, color: C.textLight, fontWeight: 400 }}>MVP Demo · June 2026</div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ marginLeft: 220, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
        {/* Header */}
        <header style={{
          height: 56, background: '#fff', borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 28px', position: 'sticky', top: 0, zIndex: 20, flexShrink: 0,
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: C.textDark }}>
            {NAV.find(n => n.id === page)?.label ?? 'Dashboard'}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {/* Balance */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: C.textLight, fontWeight: 400 }}>Operating balance</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.textDark }}>{fmtAED(ACCOUNT_BALANCE)}</div>
            </div>

            {/* Bell */}
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textLight, display: 'flex', padding: 4, borderRadius: 6 }}>
              <Bell size={17} />
            </button>

            {/* Avatar */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: C.purple, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 500, cursor: 'pointer', flexShrink: 0,
            }}>
              {founder.initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, padding: '32px 36px', overflowY: 'auto', background: '#fff' }}>
          <div key={page} style={{ animation: 'pageFade 200ms ease-out' }}>
            {page === 'dashboard' && <Dashboard {...appState} />}
            {page === 'cards' && <Cards {...appState} />}
            {page === 'approvals' && <Approvals {...appState} />}
            {page === 'receipts' && <Receipts {...appState} />}
            {page === 'transactions' && <Transactions {...appState} />}
            {page === 'team' && <Team {...appState} />}
            {page === 'reporting' && <Reporting {...appState} />}
            {page === 'accounting' && <Accounting {...appState} />}
          </div>
        </main>
      </div>

      {/* Toasts */}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            background: t.variant === 'error' ? '#EF4444' : C.navy,
            color: '#fff', padding: '10px 16px', borderRadius: 8,
            fontSize: 13, fontWeight: 400, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
            animation: 'slideIn 200ms ease-out',
            pointerEvents: 'auto',
          }}>
            {t.message}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes pageFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
