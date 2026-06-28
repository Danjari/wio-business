-- Wio Business — seed data (mirrors INITIAL_* from src/data.ts)
-- Run AFTER schema.sql
-- Safe to re-run: uses INSERT ... ON CONFLICT DO NOTHING

-- ── Team ──────────────────────────────────────────────────────────────────────
INSERT INTO team (id, name, role, initials, is_founder) VALUES
  ('t1', 'Sara Al-Rashidi',      'Founder & CEO',        'SR', TRUE),
  ('t2', 'Aisha Al-Mansoori',    'Operations Lead',      'AA', FALSE),
  ('t3', 'Omar Farooq',          'Sales Manager',        'OF', FALSE),
  ('t4', 'Priya Nair',           'Marketing Executive',  'PN', FALSE),
  ('t5', 'Khalid Hassan',        'Business Development', 'KH', FALSE)
ON CONFLICT (id) DO NOTHING;

-- ── Cards ─────────────────────────────────────────────────────────────────────
INSERT INTO cards (id, holder_id, label, last4, limit_aed, spent, categories, status) VALUES
  ('c1', 't2', 'Operations',   '4821', 2000, 1340, ARRAY['Office Supplies','Utilities','Travel'],                  'active'),
  ('c2', 't3', 'Sales & Client','7753', 5000, 3200, ARRAY['Travel','Entertainment','Client Meals'],                'active'),
  ('c3', 't4', 'Marketing',    '2196', 3000,  890, ARRAY['Advertising','SaaS Tools','Events'],                    'active'),
  ('c4', 't5', 'Biz Dev',      '9034', 4000, 2100, ARRAY['Travel','Entertainment','Client Meals'],                'active'),
  ('c5', 't1', 'Petty Cash',   '6612',  500,  120, ARRAY['All Categories'],                                       'active')
ON CONFLICT (id) DO NOTHING;

-- ── Transactions ──────────────────────────────────────────────────────────────
INSERT INTO transactions (id, card_id, merchant, category, amount, date, status, has_receipt, zoho_synced, note) VALUES
  ('tx01','c2','Nobu Dubai',              'Client Meals',   1840,'2026-06-24','approved',        TRUE,  TRUE,  NULL),
  ('tx02','c3','Google Ads',              'Advertising',     450,'2026-06-24','approved',        TRUE,  TRUE,  NULL),
  ('tx03','c4','Emirates Business Class','Travel',          3200,'2026-06-23','pending_approval',FALSE, FALSE, 'Business class to Riyadh — ADIPEC partner meeting'),
  ('tx04','c2','Jumeirah Beach Hotel',   'Travel',           780,'2026-06-23','approved',        FALSE, FALSE, NULL),
  ('tx05','c1','IKEA Dubai',             'Office Supplies', 1140,'2026-06-22','approved',        TRUE,  TRUE,  NULL),
  ('tx06','c3','Canva Pro',              'SaaS Tools',       120,'2026-06-22','approved',        TRUE,  TRUE,  NULL),
  ('tx07','c5','Carrefour Mall',         'Office Supplies',   85,'2026-06-21','approved',        FALSE, FALSE, NULL),
  ('tx08','c4','DIFC Restaurant',        'Entertainment',    560,'2026-06-21','approved',        FALSE, FALSE, NULL),
  ('tx09','c2','Rotana Hotel Abu Dhabi', 'Travel',          6200,'2026-06-20','pending_approval',FALSE, FALSE, '3-night stay for GITEX client sprint'),
  ('tx10','c1','Staples UAE',            'Office Supplies',  200,'2026-06-20','approved',        TRUE,  TRUE,  NULL),
  ('tx11','c3','Meta Ads',               'Advertising',      320,'2026-06-19','approved',        TRUE,  TRUE,  NULL),
  ('tx12','c4','Al Maha Desert Resort',  'Entertainment',   1200,'2026-06-18','approved',        TRUE,  TRUE,  NULL),
  ('tx13','c2','Uber Business',          'Travel',           145,'2026-06-18','approved',        TRUE,  TRUE,  NULL),
  ('tx14','c1','du Telecom',             'Utilities',        399,'2026-06-17','approved',        TRUE,  TRUE,  NULL),
  ('tx15','c3','HubSpot',               'SaaS Tools',       680,'2026-06-17','approved',        TRUE,  TRUE,  NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Approvals ─────────────────────────────────────────────────────────────────
INSERT INTO approvals (id, tx_id, requested_by_id, amount, merchant, category, card_id, note, date, required_level) VALUES
  ('a1c0ffee-0000-0000-0000-000000000001',
   'tx03','t5',3200,'Emirates Business Class','Travel','c4',
   'Business class to Riyadh for ADIPEC partner meeting — booked 2 days in advance',
   '2026-06-23','manager'),
  ('a1c0ffee-0000-0000-0000-000000000002',
   'tx09','t3',6200,'Rotana Hotel Abu Dhabi','Travel','c2',
   '3-night stay for GITEX Global proposal sprint with Mubadala client team',
   '2026-06-20','founder')
ON CONFLICT (id) DO NOTHING;
