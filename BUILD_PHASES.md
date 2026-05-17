# Z-Books — Implementation Workflow
**Agency:** Ai Dynamic Advisory
**Updated:** May 2026

This file is the step-by-step build guide. Read the relevant phase section at the start of each work session.

---

## How to Read This File

Each phase has:
- **Goal** — what "done" looks like
- **Tasks** — ordered steps (A and B = parallel workstreams)
- **Definition of Done** — what to verify before marking phase complete
- **Staging Verification** — what to test on the Vercel Preview URL

---

## PHASE 0 — Foundation and Infrastructure
**Duration:** ~3 hours | **Branch:** `main` (initial setup only)

### Goal
Fully operational project scaffold deployed to Vercel. Database schema live on Supabase. Auth working. Zero features — but the rails are laid.

### Tasks

#### Task 0.1 — Project scaffold ✅
- [x] Next.js 15 + TypeScript strict + Tailwind + shadcn/ui initialised
- [x] `package.json` with all dependencies
- [x] `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`
- [x] `vitest.config.ts` and `vitest.setup.ts`
- [x] `.env.local` and `.env.example`
- [x] `.gitignore` (excludes `.env*.local`)

#### Task 0.2 — Supabase schema ✅
- [x] Migration file: `supabase/migrations/20260511_000000_initial_schema.sql`
- [ ] **MANUAL STEP:** Apply migration in Supabase SQL Editor (see below)
- [x] `seed.sql` with `seed_default_accounts()` function
- [x] TypeScript types in `types/database.ts`

#### Task 0.3 — Supabase client files ✅
- [x] `lib/supabase/client.ts` — browser client
- [x] `lib/supabase/server.ts` — server client (async cookies)
- [x] `lib/supabase/middleware.ts` — session refresh + auth redirect
- [x] `middleware.ts` — Next.js middleware entry point

#### Task 0.4 — Auth UI ✅
- [x] `app/(auth)/layout.tsx` — auth layout with Z-Books branding
- [x] `app/(auth)/login/page.tsx` + `components/auth/login-form.tsx`
- [x] `app/(auth)/signup/page.tsx` + `components/auth/signup-form.tsx`

#### Task 0.5 — Dashboard shell ✅
- [x] `app/(dashboard)/layout.tsx` — server component with auth check
- [x] `app/(dashboard)/dashboard/page.tsx` — welcome + org list
- [x] `components/shared/sidebar.tsx` — sidebar nav with sign out
- [x] `components/shared/page-header.tsx` — reusable page header
- [x] `lib/utils.ts` — cn(), formatZAR(), formatDate()

#### Task 0.6 — Install dependencies and verify build
- [ ] `npm install`
- [ ] `npx tsc --noEmit` — zero type errors
- [ ] `npm run build` — production build passes
- [ ] `npm run dev` — app runs at localhost:3000

#### Task 0.7 — Git setup and Vercel deploy
- [ ] `git init && git add . && git commit -m "feat(phase-0): initial scaffold"`
- [ ] `git remote add origin https://github.com/jfdercksen/zbooks`
- [ ] `git push -u origin main`
- [ ] Vercel auto-deploys → verify URL loads login page

### Manual Step — Apply Supabase Schema

1. Go to: https://supabase.com/dashboard/project/hiwpabemogofaqunmafw/sql/new
2. Open file: `supabase/migrations/20260511_000000_initial_schema.sql`
3. Copy entire contents and paste into SQL editor
4. Click **Run**
5. Verify: Tables tab shows all 9 tables (organisations, organisation_members, bank_accounts, accounts, bank_statements, transactions, employees, payroll_runs, payroll_entries, audit_log)

### Definition of Done — Phase 0
- [ ] All 9 tables visible in Supabase dashboard
- [ ] `npm run build` exits with 0 errors
- [ ] `/login` page loads in browser
- [ ] Sign up creates a user in Supabase Auth
- [ ] Sign in redirects to `/dashboard`
- [ ] Sign out returns to `/login`
- [ ] Vercel preview URL accessible

---

## PHASE 1 — Organisation and Company Setup
**Duration:** ~6 hours | **Branch:** `feature/phase-1-organisations`

### Goal
Bookkeeper can create an organisation, configure chart of accounts, import historical Excel data, and add bank accounts.

### Tasks

#### Task 1.1 — Organisation CRUD
- [ ] `app/(dashboard)/organisations/page.tsx` — list all organisations
- [ ] `app/(dashboard)/organisations/new/page.tsx` — create organisation form
- [ ] `app/(dashboard)/organisations/[id]/page.tsx` — organisation overview
- [ ] `app/(dashboard)/organisations/[id]/settings/page.tsx` — edit company profile
- [ ] Server Action: create org → insert to `organisations` → insert to `organisation_members` as admin → call `seed_default_accounts()`
- [ ] `components/organisations/organisation-form.tsx`

#### Task 1.2 — Chart of Accounts
- [ ] `app/(dashboard)/organisations/[id]/settings/page.tsx` — accounts section
- [ ] Display standard chart of accounts (seeded in Task 0.2)
- [ ] Add/edit/deactivate custom accounts
- [ ] `components/accounts/accounts-table.tsx`
- [ ] `components/accounts/account-form.tsx`

#### Task 1.3 — Bank Account Management
- [ ] `app/(dashboard)/organisations/[id]/bank-accounts/page.tsx`
- [ ] Add, edit, deactivate bank accounts
- [ ] `components/bank-accounts/bank-account-form.tsx`

#### Task 1.4 — Excel Historical Import
- [ ] `app/(dashboard)/organisations/[id]/import/page.tsx`
- [ ] `app/api/import/excel/route.ts` — SheetJS parsing endpoint
- [ ] `lib/excel/importer.ts` — parse, validate, column-map
- [ ] Column mapper UI: bookkeeper maps Excel columns to DB fields
- [ ] Preview step before import confirmation
- [ ] `components/import/column-mapper.tsx`
- [ ] `components/import/import-preview.tsx`

### Definition of Done — Phase 1
- [ ] Can create an organisation with company profile
- [ ] Chart of accounts populated on create
- [ ] Can add/edit accounts
- [ ] Can add bank accounts
- [ ] Can upload `Accounts2026.xlsx` and import transactions
- [ ] All imported transactions visible on `/transactions`

---

## PHASE 2 — Bank Statement Processing (AI Engine)
**Duration:** ~10 hours | **Branch:** `feature/phase-2-pdf-processing`

### Goal
Bookkeeper uploads a PDF bank statement → Claude API extracts transactions → bookkeeper reviews in split-screen → categorises → commits to ledger.

### Tasks

#### Task 2.1 — PDF Upload
- [ ] `app/(dashboard)/bank-statements/page.tsx` — upload + history
- [ ] `components/bank-statements/upload-zone.tsx` — drag-and-drop
- [ ] Upload to Supabase Storage bucket `bank-statements/{org_id}/{filename}`
- [ ] Insert `bank_statements` row with status `pending`
- [ ] Duplicate detection: check if statement for same period already exists

#### Task 2.2 — Claude API Extraction
- [ ] `app/api/bank-statements/process/route.ts`
- [ ] `lib/claude/pdf-extractor.ts`
- [ ] Upload PDF to Claude Files API → get `file_id`
- [ ] Send to `claude-haiku-4-5` with structured extraction prompt
- [ ] Validate JSON response with Zod (`ExtractionResult` schema)
- [ ] Retry once with stricter prompt if validation fails
- [ ] Fallback to `claude-sonnet-4-5` if haiku fails twice
- [ ] Insert extracted rows into `transactions` with status `pending`
- [ ] Update `bank_statements.status` to `review`

#### Task 2.3 — Transaction Review UI
- [ ] `app/(dashboard)/bank-statements/[id]/review/page.tsx`
- [ ] Split-screen: PDF viewer (left) + transaction table (right)
- [ ] `components/bank-statements/review-table.tsx`
- [ ] `components/bank-statements/pdf-viewer.tsx` (react-pdf)
- [ ] `components/bank-statements/category-selector.tsx`

#### Task 2.4 — Auto-suggest Categorisation
- [ ] Pattern matching: if description matches previous categorisation, pre-fill account
- [ ] Query: `SELECT account_id FROM transactions WHERE description ILIKE $1 AND status = 'committed' ORDER BY created_at DESC LIMIT 1`
- [ ] Show suggestion with confidence indicator

#### Task 2.5 — Batch Commit
- [ ] Select multiple transactions → assign category to all
- [ ] Validate: all transactions must have `account_id` before commit
- [ ] Commit: update all `status = 'committed'`, update `bank_statements.status = 'committed'`

### Definition of Done — Phase 2
- [ ] PDF upload stores file in Supabase Storage
- [ ] Claude API extracts transactions from FNB/ABSA/Nedbank/Standard Bank PDF
- [ ] Extracted transactions show in review UI with PDF visible alongside
- [ ] Bookkeeper can categorise and commit transactions
- [ ] Auto-suggest works for recurring transactions (e.g. "SHELL" → "Fuel")
- [ ] Committed transactions appear in `/transactions` ledger

---

## PHASE 3 — Financial Reporting
**Duration:** ~10 hours | **Branch:** `feature/phase-3-reports`

### Goal
P&L, Cash Flow and VAT reports generated on demand, exportable as PDF and CSV.

### Tasks

#### Task 3.1 — Report API Endpoints
- [ ] `app/api/reports/profit-loss/route.ts`
- [ ] `app/api/reports/cash-flow/route.ts`
- [ ] `app/api/reports/vat/route.ts`
- [ ] `lib/financial/calculations.ts` — Dinero.js wrappers
- [ ] `lib/financial/vat.ts` — VAT calculation helpers

#### Task 3.2 — P&L Report
- [ ] `app/(dashboard)/reports/profit-loss/page.tsx`
- [ ] `components/reports/profit-loss-table.tsx`
- [ ] Date range picker (financial year or custom)
- [ ] Year-on-year comparison column

#### Task 3.3 — Cash Flow Statement
- [ ] `app/(dashboard)/reports/cash-flow/page.tsx`
- [ ] `components/reports/cash-flow-table.tsx`
- [ ] Operating/investing/financing split (indirect method)

#### Task 3.4 — VAT Report
- [ ] `app/(dashboard)/reports/vat/page.tsx`
- [ ] `components/reports/vat-report-table.tsx`
- [ ] Output VAT, input VAT, net payable
- [ ] Period filter matching VAT submission period

#### Task 3.5 — Export
- [ ] `components/reports/report-export-button.tsx`
- [ ] PDF export via `@react-pdf/renderer`
- [ ] CSV export

#### Task 3.6 — Charts Dashboard
- [ ] Monthly P&L trend (Recharts line chart)
- [ ] Expense category breakdown (Recharts pie chart)
- [ ] Cash position over time (Recharts area chart)

### Definition of Done — Phase 3
- [ ] P&L report generates correctly for a given period
- [ ] VAT report matches manual calculation on test data
- [ ] All three reports export to PDF (print-ready)
- [ ] Charts render on dashboard

---

## PHASE 4 — Payroll Module
**Duration:** ~8 hours | **Branch:** `feature/phase-4-payroll`

### Goal
Monthly payroll run produces payslips and auto-posts expense journal to ledger.

### Tasks

#### Task 4.1 — Employee Records
- [ ] `app/(dashboard)/payroll/employees/page.tsx` — list
- [ ] `app/(dashboard)/payroll/employees/[id]/page.tsx` — detail + payslip history
- [ ] `components/payroll/employee-form.tsx`
- [ ] CRUD: create, edit, deactivate employees

#### Task 4.2 — PAYE Calculation Engine
- [ ] `lib/financial/paye.ts` — 2025/26 SARS tax tables
- [ ] `lib/financial/__tests__/paye.test.ts` — 100% coverage required
- [ ] Implement: annualise monthly salary, apply brackets, subtract rebates, monthly tax = annual ÷ 12
- [ ] UIF: 1% employee + 1% employer, capped at R17,712 monthly earnings ceiling (R177.12 max)
- [ ] SDL: 1% of gross payroll

#### Task 4.3 — Payroll Run
- [ ] `app/(dashboard)/payroll/runs/new/page.tsx` — new run form
- [ ] `app/(dashboard)/payroll/page.tsx` — run history
- [ ] `components/payroll/payroll-run-form.tsx`
- [ ] Select employees, confirm calculations, finalise run
- [ ] `components/payroll/payslip-preview.tsx` — PDF preview

#### Task 4.4 — Payroll → Ledger Journal
- [ ] On finalise: auto-insert transactions to `transactions` table
  - DR Salaries and Wages (5100) — gross salary
  - CR PAYE Payable (2200) — PAYE amount
  - CR UIF Payable — employer + employee UIF
  - CR Bank Account — net pay

### 2025/26 SARS Tax Tables (implement exactly)
| Annual Income | Rate |
|---|---|
| R0 – R237,100 | 18% |
| R237,101 – R370,500 | 26% |
| R370,501 – R512,800 | 31% |
| R512,801 – R673,000 | 36% |
| R673,001 – R857,900 | 39% |
| R857,901 – R1,817,000 | 41% |
| R1,817,001+ | 45% |

Rebates: Primary R17,235 | Secondary (65+) R9,444 | Tertiary (75+) R3,145
Tax threshold: R95,750 (below this = R0 PAYE)

### Definition of Done — Phase 4
- [ ] Employee created with gross salary
- [ ] PAYE calculated correctly against known SARS test cases
- [ ] Payslip PDF generated with employee details + deductions
- [ ] Journal entry visible in transaction ledger after payroll run

---

## PHASE 5 — Audit Trail and POPIA
**Duration:** ~6 hours | **Branch:** `feature/phase-5-audit`

### Goal
Complete audit trail active on all financial tables. POPIA compliance features live.

### Tasks

#### Task 5.1 — Audit Log Viewer
- [ ] `app/(dashboard)/audit/page.tsx`
- [ ] Filter by: user, table, date range, action type
- [ ] Display: timestamp, user email, table, action, record ID, diff view

#### Task 5.2 — POPIA Compliance Features
- [ ] Privacy Policy page (`app/(auth)/privacy/page.tsx`)
- [ ] Cookie consent banner (`components/shared/cookie-banner.tsx`)
- [ ] Data export: bookkeeper can download all org data as JSON
- [ ] Account deletion: 30-day grace period, confirm modal
- [ ] `app/api/data-export/route.ts`
- [ ] `app/api/account-delete/route.ts`

#### Task 5.3 — User Management
- [ ] `/organisations/[id]/settings/page.tsx` — Members section
- [ ] Invite bookkeeper by email (Supabase Auth invite)
- [ ] Change role: admin / editor / viewer
- [ ] Remove member from organisation

### Definition of Done — Phase 5
- [ ] Audit log shows all transaction changes with before/after data
- [ ] Privacy policy accessible from auth pages
- [ ] Data export downloads all org data
- [ ] Cannot delete audit_log records (RLS — no DELETE policy)

---

## PHASE 6 — Polish and Production Launch
**Duration:** ~8 hours | **Branch:** `feature/phase-6-polish`

### Goal
Mobile-responsive polish, performance audit, production deployment verified end-to-end.

### Tasks

#### Task 6.1 — Mobile Responsiveness
- [ ] Spawn `@qa-visual` — screenshot all routes at 375px, 768px, 1280px
- [ ] Fix any overflow, text truncation, tap target issues
- [ ] Mobile sidebar: hamburger menu + slide-out drawer
- [ ] `components/shared/mobile-nav.tsx`

#### Task 6.2 — Error Handling
- [ ] `app/error.tsx` — global error boundary
- [ ] `app/(dashboard)/error.tsx` — dashboard error boundary
- [ ] `app/not-found.tsx` — 404 page
- [ ] Loading states: `loading.tsx` for every page that fetches data

#### Task 6.3 — Performance
- [ ] Lighthouse score > 85 on all critical pages
- [ ] Image optimisation (Next.js Image component where applicable)
- [ ] Query optimisation: add missing indexes if queries are slow
- [ ] TanStack Query caching for report data

#### Task 6.4 — Production Deploy
- [ ] All environment variables set in Vercel dashboard
- [ ] `npm run build` passes on main branch
- [ ] Vercel production URL (z-books.co.za or Vercel subdomain) loads
- [ ] Sign up → sign in → create org → upload statement → review → commit → run report → generate payslip (full smoke test)

### Definition of Done — Phase 6 (MVP Complete)
- [ ] Lighthouse Performance > 85 on mobile
- [ ] All 7 phases complete
- [ ] Full smoke test passes end-to-end
- [ ] Production URL accessible and stable
- [ ] BUILD_STATUS.md updated to "COMPLETE"

---

## Quick Reference

### Commands
```bash
npm run dev              # Start dev server (Turbopack)
npm run build            # Production build
npm test                 # Run Vitest
npx tsc --noEmit         # Type check only
```

### Key URLs
| Resource | URL |
|---|---|
| Supabase Dashboard | https://supabase.com/dashboard/project/hiwpabemogofaqunmafw |
| Supabase SQL Editor | https://supabase.com/dashboard/project/hiwpabemogofaqunmafw/sql/new |
| Vercel Project | https://vercel.com/content-engines-projects/zbooks |
| GitHub Repo | https://github.com/jfdercksen/zbooks |

### Branch Strategy
```
main                    → production deploy
feature/phase-N-name    → new feature branch
fix/description         → bug fix branch
```

### Spawn Agents
```
@code-reviewer    → after every feature
@qa-unit          → after every function/route
@qa-visual        → after every UI change
@code-auditor     → after each phase ships
@db-expert        → for new tables or schema changes
```
