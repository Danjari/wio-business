export type TeamMember = {
  id: string
  name: string
  role: string
  initials: string
  isFounder?: boolean
}

export type Card = {
  id: string
  holderId: string
  label: string
  last4: string
  limit: number
  spent: number
  categories: string[]
  status: 'active' | 'frozen'
  expiresIn?: string
}

export type TxStatus = 'approved' | 'pending_approval' | 'declined' | 'out_of_policy'

export type Transaction = {
  id: string
  cardId: string
  merchant: string
  category: string
  amount: number
  date: string
  status: TxStatus
  hasReceipt: boolean
  zohoSynced: boolean
  note?: string
}

export type Approval = {
  id: string
  txId: string
  requestedById: string
  amount: number
  merchant: string
  category: string
  cardId: string
  note: string
  date: string
  requiredLevel: 'manager' | 'founder'
}

export type ProcessedApproval = Approval & { outcome: 'approved' | 'declined'; processedAt: string }

export const TEAM: TeamMember[] = [
  { id: 't1', name: 'Sara Al-Rashidi', role: 'Founder & CEO', initials: 'SR', isFounder: true },
  { id: 't2', name: 'Aisha Al-Mansoori', role: 'Operations Lead', initials: 'AA' },
  { id: 't3', name: 'Omar Farooq', role: 'Sales Manager', initials: 'OF' },
  { id: 't4', name: 'Priya Nair', role: 'Marketing Executive', initials: 'PN' },
  { id: 't5', name: 'Khalid Hassan', role: 'Business Development', initials: 'KH' },
]

export const ALL_CATEGORIES = [
  'Travel',
  'Office Supplies',
  'Advertising',
  'SaaS Tools',
  'Client Meals',
  'Entertainment',
  'Utilities',
  'Events',
  'Fuel',
  'All Categories',
]

export const INITIAL_CARDS: Card[] = [
  { id: 'c1', holderId: 't2', label: 'Operations', last4: '4821', limit: 2000, spent: 1340, categories: ['Office Supplies', 'Utilities', 'Travel'], status: 'active' },
  { id: 'c2', holderId: 't3', label: 'Sales & Client', last4: '7753', limit: 5000, spent: 3200, categories: ['Travel', 'Entertainment', 'Client Meals'], status: 'active' },
  { id: 'c3', holderId: 't4', label: 'Marketing', last4: '2196', limit: 3000, spent: 890, categories: ['Advertising', 'SaaS Tools', 'Events'], status: 'active' },
  { id: 'c4', holderId: 't5', label: 'Biz Dev', last4: '9034', limit: 4000, spent: 2100, categories: ['Travel', 'Entertainment', 'Client Meals'], status: 'active' },
  { id: 'c5', holderId: 't1', label: 'Petty Cash', last4: '6612', limit: 500, spent: 120, categories: ['All Categories'], status: 'active' },
]

export const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: 'tx01', cardId: 'c2', merchant: 'Nobu Dubai', category: 'Client Meals', amount: 1840, date: '2026-06-24', status: 'approved', hasReceipt: true, zohoSynced: true },
  { id: 'tx02', cardId: 'c3', merchant: 'Google Ads', category: 'Advertising', amount: 450, date: '2026-06-24', status: 'approved', hasReceipt: true, zohoSynced: true },
  { id: 'tx03', cardId: 'c4', merchant: 'Emirates Business Class', category: 'Travel', amount: 3200, date: '2026-06-23', status: 'pending_approval', hasReceipt: false, zohoSynced: false, note: 'Business class to Riyadh — ADIPEC partner meeting' },
  { id: 'tx04', cardId: 'c2', merchant: 'Jumeirah Beach Hotel', category: 'Travel', amount: 780, date: '2026-06-23', status: 'approved', hasReceipt: false, zohoSynced: false },
  { id: 'tx05', cardId: 'c1', merchant: 'IKEA Dubai', category: 'Office Supplies', amount: 1140, date: '2026-06-22', status: 'approved', hasReceipt: true, zohoSynced: true },
  { id: 'tx06', cardId: 'c3', merchant: 'Canva Pro', category: 'SaaS Tools', amount: 120, date: '2026-06-22', status: 'approved', hasReceipt: true, zohoSynced: true },
  { id: 'tx07', cardId: 'c5', merchant: 'Carrefour Mall', category: 'Office Supplies', amount: 85, date: '2026-06-21', status: 'approved', hasReceipt: false, zohoSynced: false },
  { id: 'tx08', cardId: 'c4', merchant: 'DIFC Restaurant', category: 'Entertainment', amount: 560, date: '2026-06-21', status: 'approved', hasReceipt: false, zohoSynced: false },
  { id: 'tx09', cardId: 'c2', merchant: 'Rotana Hotel Abu Dhabi', category: 'Travel', amount: 6200, date: '2026-06-20', status: 'pending_approval', hasReceipt: false, zohoSynced: false, note: '3-night stay for GITEX client sprint' },
  { id: 'tx10', cardId: 'c1', merchant: 'Staples UAE', category: 'Office Supplies', amount: 200, date: '2026-06-20', status: 'approved', hasReceipt: true, zohoSynced: true },
  { id: 'tx11', cardId: 'c3', merchant: 'Meta Ads', category: 'Advertising', amount: 320, date: '2026-06-19', status: 'approved', hasReceipt: true, zohoSynced: true },
  { id: 'tx12', cardId: 'c4', merchant: 'Al Maha Desert Resort', category: 'Entertainment', amount: 1200, date: '2026-06-18', status: 'approved', hasReceipt: true, zohoSynced: true },
  { id: 'tx13', cardId: 'c2', merchant: 'Uber Business', category: 'Travel', amount: 145, date: '2026-06-18', status: 'approved', hasReceipt: true, zohoSynced: true },
  { id: 'tx14', cardId: 'c1', merchant: 'du Telecom', category: 'Utilities', amount: 399, date: '2026-06-17', status: 'approved', hasReceipt: true, zohoSynced: true },
  { id: 'tx15', cardId: 'c3', merchant: 'HubSpot', category: 'SaaS Tools', amount: 680, date: '2026-06-17', status: 'approved', hasReceipt: true, zohoSynced: true },
]

export const INITIAL_APPROVALS: Approval[] = [
  {
    id: 'ap1',
    txId: 'tx03',
    requestedById: 't5',
    amount: 3200,
    merchant: 'Emirates Business Class',
    category: 'Travel',
    cardId: 'c4',
    note: 'Business class to Riyadh for ADIPEC partner meeting — booked 2 days in advance',
    date: '2026-06-23',
    requiredLevel: 'manager',
  },
  {
    id: 'ap2',
    txId: 'tx09',
    requestedById: 't3',
    amount: 6200,
    merchant: 'Rotana Hotel Abu Dhabi',
    category: 'Travel',
    cardId: 'c2',
    note: '3-night stay for GITEX Global proposal sprint with Mubadala client team',
    date: '2026-06-20',
    requiredLevel: 'founder',
  },
]

export const APPROVAL_RULES = [
  { label: 'Under AED 500', action: 'Auto-approve', variant: 'green' as const },
  { label: 'AED 500 – 5,000', action: 'Manager approval', variant: 'amber' as const },
  { label: 'Above AED 5,000', action: 'Founder approval', variant: 'purple' as const },
  { label: 'Out of category', action: 'Auto-decline + notify', variant: 'red' as const },
]

export const ACCOUNT_BALANCE = 284320
export const ZOHO_SYNCED_TODAY = 8

export const CHART_OF_ACCOUNTS: Record<string, string> = {
  Travel: '5200 — Travel & Entertainment',
  'Client Meals': '5200 — Travel & Entertainment',
  Entertainment: '5200 — Travel & Entertainment',
  Advertising: '6100 — Marketing & Advertising',
  'SaaS Tools': '6200 — Software & Subscriptions',
  'Office Supplies': '6300 — Office Supplies',
  Utilities: '6400 — Utilities',
  Fuel: '5300 — Vehicle & Fuel',
  Events: '6100 — Marketing & Advertising',
}

export function fmtAED(amount: number): string {
  return 'AED ' + new Intl.NumberFormat('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)
}

export function fmtDate(date: string): string {
  return new Date(date).toLocaleDateString('en-AE', { day: 'numeric', month: 'short' })
}
