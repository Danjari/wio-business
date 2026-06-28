# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A React/TypeScript interactive MVP demo for Wio Business Spend Management — a clickable prototype built to accompany a product pitch deck. All data is static/mock; there is no backend.

## Commands

```bash
npm run dev      # Start dev server on http://localhost:3001
npm run build    # Production build → dist/
npm run lint     # Type-check only (tsc --noEmit) — no ESLint configured
```

No test suite exists.

## Architecture

**Entry point:** `src/main.tsx` → `src/App.tsx`

**Routing:** Custom — a single `page` state string in `App.tsx` selects which page component to render. No React Router. Navigation happens via the `navigate(page)` function passed through `AppState`.

**State management:** All mutable state (`cards`, `transactions`, `approvals`, `processed`) lives in `App.tsx` and is passed as props via the `AppState` type to every page. There is no context, store, or external state library. To add state that multiple pages need, add it to `AppState` in `App.tsx`.

**Data layer:** `src/data.ts` is the single source of truth for:
- All TypeScript types (`Card`, `Transaction`, `Approval`, `ProcessedApproval`, `TeamMember`)
- All mock seed data (`INITIAL_CARDS`, `INITIAL_TRANSACTIONS`, `INITIAL_APPROVALS`, `TEAM`)
- Shared constants (`ACCOUNT_BALANCE`, `APPROVAL_RULES`, `CHART_OF_ACCOUNTS`, `ALL_CATEGORIES`)
- Utility functions (`fmtAED`, `fmtDate`)

**Pages** (`src/pages/`): Dashboard, Cards, Approvals, Receipts, Transactions, Team, Reporting, Accounting — each receives the full `AppState` as props.

**Components** (`src/components/`):
- `Avatar.tsx` — DiceBear Lorelei Neutral avatar generated from a name seed, rendered as inline SVG
- `CreditCard.tsx` — 3D flip card with realistic EMV chip, mag stripe, and WIO/VISA branding; also exports `WioLogo` SVG used elsewhere

## Styling conventions

- **Primary approach:** inline styles, not Tailwind classes. Tailwind v4 is configured but used minimally.
- **Color palette:** Each file defines a local `const C = { ... }` object. The canonical brand colors are `purple: '#5700FF'` and `navy: '#0F1A38'`. New files should copy this pattern rather than using raw hex strings throughout.
- **Mobile responsiveness:** The `useIsMobile()` hook (768px breakpoint) in `App.tsx` passes an `isMobile` flag that adjusts layout inline. `src/index.css` contains CSS utility-class overrides (e.g. `.kpi-strip`, `.dash-body`, `.cards-grid`) that handle mobile layout changes — these are the only Tailwind-adjacent class names in the project.
- **Animations:** Defined via `<style>` injection in `App.tsx` (`pageFade`, `slideIn`) and CSS injected by `CreditCard.tsx` (`FLIP_CSS` string for the 3D flip).

## Toast system

`App.tsx` exposes `showToast(message, variant?)` via `AppState`. It uses a module-level counter for stable IDs and auto-dismisses after 3 seconds. Call `showToast` from any page action that needs feedback.
