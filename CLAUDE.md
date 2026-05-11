# Z-Books — Claude Code Project Context
**Agency:** Ai Dynamic Advisory
**App:** Z-Books — AI-powered multi-tenant bookkeeping platform
**Live URL:** https://z-books.co.za (pending)
**Stack:** Next.js 15 + TypeScript + Supabase + Claude API + Vercel

---

## 🚀 Session Startup — Read This First

Every new chat session MUST follow this sequence before doing anything:

**Step 1 — Read project state:**
```bash
cat BUILD_STATUS.md
cat DECISIONS.md
cat KNOWN_ISSUES.md
```

**Step 2 — Ask the developer:**
> "According to BUILD_STATUS.md we are on [phase and task].
> Confirm:
> 1. Is this still correct?
> 2. Any blockers not in KNOWN_ISSUES.md?
> 3. What do you want to work on today?"

**Step 3 — Wait for answer before doing anything.**

**Step 4 — Load relevant IMPLEMENTATION_WORKFLOW.md section:**
```bash
grep -n "## PHASE" IMPLEMENTATION_WORKFLOW.md
```

---

## Project Identity

| Field | Value |
|---|---|
| **App Name** | Z-Books |
| **Agency** | Ai Dynamic Advisory |
| **Client** | Z-Group |
| **Description** | Multi-tenant bookkeeping web app — AI reads PDF bank statements, bookkeeper categorises, system generates P&L, Cash Flow and VAT reports |
| **Primary Users** | Bookkeepers managing multiple client organisations |
| **Live URL** | https://z-books.co.za |
| **Staging** | Vercel Preview URLs (auto-generated per PR) |
| **Repository** | https://github.com/[your-org]/z-books |

---

## Tech Stack

| Layer | Tool | Version | Official Docs |
|---|---|---|---|
| Framework | Next.js (App Router) | 15.x | https://nextjs.org/docs |
| Language | TypeScript (strict) | 5.x | https://www.typescriptlang.org/docs/ |
| Database | Supabase (PostgreSQL) | Latest | https://supabase.com/docs |
| Auth | Supabase Auth | Built-in | https://supabase.com/docs/guides/auth |
| AI PDF Parser | Anthropic Claude API | claude-haiku-4-5 | https://docs.anthropic.com/en/docs/about-claude/models/overview |
| Excel Import | xlsx (SheetJS) | 0.18.x | https://sheetjs.com |
| UI Components | shadcn/ui | Latest | https://ui.shadcn.com |
| Styling | Tailwind CSS | 3.x | https://tailwindcss.com/docs |
| Financial Math | Dinero.js | 2.x | https://dinerojs.com |
| Forms | React Hook Form + Zod | Latest | https://react-hook-form.com |
| Data Fetching | TanStack Query | 5.x | https://tanstack.com/query/latest |
| Charts | Recharts | 2.x | https://recharts.org |
| Dates | date-fns | 3.x | https://date-fns.org |
| PDF Viewer | react-pdf | 7.x | https://react-pdf.org |
| PDF Generator | @react-pdf/renderer | 3.x | https://react-pdf.org |
| Deployment | Vercel | Latest | https://vercel.com/docs |
| File Storage | Supabase Storage | Built-in | https://supabase.com/docs/guides/storage |

---

## File Structure

```
z-books/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx                  # Sign in page
│   │   └── signup/page.tsx                 # Sign up page
│   ├── (dashboard)/
│   │   ├── layout.tsx                      # Dashboard shell with sidebar nav
│   │   ├── dashboard/page.tsx              # Overview — recent activity, totals
│   │   ├── organisations/
│   │   │   ├── page.tsx                    # Organisation list
│   │   │   ├── new/page.tsx                # Create organisation
│   │   │   └── [id]/
│   │   │       ├── page.tsx                # Organisation overview
│   │   │       ├── settings/page.tsx       # Company profile + chart of accounts
│   │   │       ├── bank-accounts/page.tsx  # Bank account management
│   │   │       └── import/page.tsx         # Excel historical import
│   │   ├── bank-statements/
│   │   │   ├── page.tsx                    # Statement upload + history
│   │   │   └── [id]/
│   │   │       └── review/page.tsx         # Split-screen review + categorise
│   │   ├── transactions/page.tsx           # Full transaction ledger
│   │   ├── reports/
│   │   │   ├── profit-loss/page.tsx        # P&L statement
│   │   │   ├── cash-flow/page.tsx          # Cash flow statement
│   │   │   └── vat/page.tsx                # VAT201 report
│   │   ├── payroll/
│   │   │   ├── page.tsx                    # Payroll dashboard
│   │   │   ├── employees/
│   │   │   │   ├── page.tsx                # Employee list
│   │   │   │   └── [id]/page.tsx           # Employee detail + payslip history
│   │   │   └── runs/
│   │   │       ├── page.tsx                # Payroll run history
│   │   │       └── new/page.tsx            # Create payroll run
│   │   └── audit/page.tsx                  # Audit trail log viewer
│   ├── api/
│   │   ├── bank-statements/
│   │   │   └── process/route.ts            # Claude API PDF extraction endpoint
│   │   ├── import/
│   │   │   └── excel/route.ts              # Excel historical import endpoint
│   │   └── reports/
│   │       ├── profit-loss/route.ts        # P&L report query endpoint
│   │       ├── cash-flow/route.ts          # Cash flow query endpoint
│   │       └── vat/route.ts                # VAT report query endpoint
│   ├── layout.tsx                          # Root layout
│   └── globals.css                         # Global styles + CSS variables
├── components/
│   ├── ui/                                 # shadcn/ui components (auto-generated)
│   ├── bank-statements/
│   │   ├── upload-zone.tsx                 # PDF drag-and-drop upload
│   │   ├── review-table.tsx                # Transaction review grid
│   │   ├── category-selector.tsx           # Account category dropdown
│   │   └── pdf-viewer.tsx                  # Embedded PDF viewer
│   ├── reports/
│   │   ├── profit-loss-table.tsx           # P&L report table
│   │   ├── cash-flow-table.tsx             # Cash flow table
│   │   ├── vat-report-table.tsx            # VAT report table
│   │   └── report-export-button.tsx        # PDF/CSV export button
│   ├── payroll/
│   │   ├── employee-form.tsx               # Employee create/edit form
│   │   ├── payroll-run-form.tsx            # Monthly payroll run form
│   │   └── payslip-preview.tsx             # Payslip PDF preview
│   └── shared/
│       ├── org-switcher.tsx                # Organisation switcher in sidebar
│       ├── data-table.tsx                  # Reusable TanStack Table wrapper
│       └── page-header.tsx                 # Page title + breadcrumb
├── lib/
│   ├── supabase/
│   │   ├── client.ts                       # Browser Supabase client
│   │   ├── server.ts                       # Server-side Supabase client
│   │   └── middleware.ts                   # Auth middleware
│   ├── claude/
│   │   └── pdf-extractor.ts                # Claude API PDF → JSON extraction
│   ├── financial/
│   │   ├── calculations.ts                 # Dinero.js wrappers for all money math
│   │   ├── paye.ts                         # PAYE calculation (2025/26 SARS tables)
│   │   └── vat.ts                          # VAT calculation helpers
│   ├── excel/
│   │   └── importer.ts                     # SheetJS Excel parser
│   └── utils.ts                            # Shared utilities
├── types/
│   ├── database.ts                         # Supabase generated types
│   └── app.ts                              # Application-specific types
├── supabase/
│   ├── migrations/                         # All schema migrations (never manual edits)
│   └── seed.sql                            # Standard SA chart of accounts seed
├── .claude/
│   ├── agents/                             # Subagent definitions
│   ├── skills/                             # Skill (slash command) definitions
│   ├── rules/                              # Path-scoped rule files
│   └── hooks/                              # Hook scripts
├── .github/
│   └── workflows/                          # CI/CD pipelines
├── CLAUDE.md                               # This file
├── settings.json                           # Claude Code permissions + hooks
├── .mcp.json                               # MCP server connections
├── BUILD_STATUS.md                         # Living build tracker — update every session
├── DECISIONS.md                            # Architectural decisions log
├── KNOWN_ISSUES.md                         # Bugs and blockers tracker
├── technical-defaults.md                   # Stack-specific coding standards
├── design-rules.md                         # Brand and UI standards
├── workflow.md                             # 7-step build workflow
└── IMPLEMENTATION_WORKFLOW.md              # Phase-by-phase build guide
```

---

## Route Map

| Route | File | Purpose |
|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | Bookkeeper sign in |
| `/signup` | `app/(auth)/signup/page.tsx` | Bookkeeper registration |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | Overview — recent activity, org totals |
| `/organisations` | `app/(dashboard)/organisations/page.tsx` | All client organisations |
| `/organisations/new` | `app/(dashboard)/organisations/new/page.tsx` | Create new organisation |
| `/organisations/[id]` | `app/(dashboard)/organisations/[id]/page.tsx` | Organisation overview |
| `/organisations/[id]/settings` | `app/(dashboard)/organisations/[id]/settings/page.tsx` | Company profile + accounts |
| `/organisations/[id]/bank-accounts` | `app/(dashboard)/organisations/[id]/bank-accounts/page.tsx` | Bank accounts |
| `/organisations/[id]/import` | `app/(dashboard)/organisations/[id]/import/page.tsx` | Excel import |
| `/bank-statements` | `app/(dashboard)/bank-statements/page.tsx` | Upload + statement history |
| `/bank-statements/[id]/review` | `app/(dashboard)/bank-statements/[id]/review/page.tsx` | Review + categorise |
| `/transactions` | `app/(dashboard)/transactions/page.tsx` | Full transaction ledger |
| `/reports/profit-loss` | `app/(dashboard)/reports/profit-loss/page.tsx` | P&L statement |
| `/reports/cash-flow` | `app/(dashboard)/reports/cash-flow/page.tsx` | Cash flow statement |
| `/reports/vat` | `app/(dashboard)/reports/vat/page.tsx` | VAT201 report |
| `/payroll` | `app/(dashboard)/payroll/page.tsx` | Payroll dashboard |
| `/payroll/employees` | `app/(dashboard)/payroll/employees/page.tsx` | Employee list |
| `/payroll/runs/new` | `app/(dashboard)/payroll/runs/new/page.tsx` | New payroll run |
| `/audit` | `app/(dashboard)/audit/page.tsx` | Audit trail viewer |
| `/api/bank-statements/process` | `app/api/bank-statements/process/route.ts` | Claude PDF extraction |
| `/api/import/excel` | `app/api/import/excel/route.ts` | Excel import endpoint |
| `/api/reports/profit-loss` | `app/api/reports/profit-loss/route.ts` | P&L data endpoint |
| `/api/reports/cash-flow` | `app/api/reports/cash-flow/route.ts` | Cash flow data endpoint |
| `/api/reports/vat` | `app/api/reports/vat/route.ts` | VAT report data endpoint |

---

## Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=          # Safe for browser — public URL only
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Safe for browser — RLS enforces security
SUPABASE_SERVICE_ROLE_KEY=         # SERVER ONLY — never expose to browser

# Anthropic Claude API
ANTHROPIC_API_KEY=                 # SERVER ONLY — used in /api/bank-statements/process only

# App
NEXT_PUBLIC_APP_URL=               # Safe — e.g. https://z-books.co.za

# Security
NEXTAUTH_SECRET=                   # SERVER ONLY — if using NextAuth
```

**Rules:**
- `NEXT_PUBLIC_` prefix = safe for browser. Use for Supabase URL and anon key only.
- `SUPABASE_SERVICE_ROLE_KEY` — NEVER use in client components. Server Actions and API routes only.
- `ANTHROPIC_API_KEY` — NEVER expose to browser. API route only.
- Never edit `.env.local` or `.env` directly — update `.env.example` for documentation.

---

## Three-Environment Workflow

| Environment | Trigger | URL | Purpose |
|---|---|---|---|
| **Local** | `npm run dev` | `localhost:3000` | Development |
| **Preview (Staging)** | Push any branch / open PR | `z-books-[hash].vercel.app` | Review before merging |
| **Production** | Push to `main` (after CI passes) | `https://z-books.co.za` | Live app |

### Daily Development Flow

```bash
# Start a new feature
git checkout -b feature/your-feature-name

# Develop locally
npm run dev

# Check types
npx tsc --noEmit

# Run tests
npm test

# Push for preview deploy
git push origin feature/your-feature-name
# → Vercel generates preview URL automatically

# When reviewed and approved — merge to main
git checkout main
git merge feature/your-feature-name
git push origin main
# → GitHub Actions runs CI → Vercel deploys to production
```

### Local Dev Commands

```bash
npm run dev              # Start Next.js dev server
npm run build            # Production build (verify before merging)
npm test                 # Run Vitest test suite
npx tsc --noEmit         # TypeScript type check only
npx supabase start       # Start local Supabase (requires Supabase CLI)
npx supabase db reset    # Reset local DB and re-run migrations
npx supabase gen types   # Regenerate types/database.ts from schema
```

### Per-Phase Staging Review

| Phase | What to Review on Preview URL |
|---|---|
| Phase 0 | Sign up → sign in → dashboard loads |
| Phase 1 | Create org → import Excel → view chart of accounts |
| Phase 2 | Upload PDF → review extracted transactions → commit |
| Phase 3 | P&L, Cash Flow, VAT report generate correctly + export PDF |
| Phase 4 | Run payroll → generate payslip → view journal entry |
| Phase 5 | Audit trail shows all changes → data export works |
| Phase 6 | Mobile responsiveness on all routes → Lighthouse > 85 |

---

## GitHub Secrets Required

```
SUPABASE_ACCESS_TOKEN          # For Supabase MCP server
VERCEL_TOKEN                   # For Vercel CLI in CI
VERCEL_ORG_ID                  # Vercel organisation ID
VERCEL_PROJECT_ID              # Vercel project ID
NEXT_PUBLIC_SUPABASE_URL       # Production Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Production Supabase anon key
SUPABASE_SERVICE_ROLE_KEY      # Production service role key
ANTHROPIC_API_KEY              # Claude API key
NEXT_PUBLIC_APP_URL            # https://z-books.co.za
```

---

## Build Workflow — 7 Steps

**Do this for every task:**

1. **Write** — implement the feature or fix
2. **Review** — spawn `@code-reviewer` (builds institutional knowledge of Z-Books)
3. **QA Unit** — spawn `@qa-unit` (generates and runs Vitest tests)
4. **QA Visual** — spawn `@qa-visual` (screenshots at 375px, 768px, 1280px)
5. **Fix** — apply all findings from steps 2–4
6. **Build check** — `npm run build && npx tsc --noEmit`
7. **Ship** — commit, push, verify Vercel preview URL

**Spawn code-reviewer + qa-unit + qa-visual in parallel when covering independent concerns.**

**After shipping:** spawn `@code-auditor` for adversarial review — it assumes the implementation is wrong.

---

## Compound Learning Rule

> When you find a bug or bad pattern — add it immediately to `.claude/rules/no-bad-patterns.md` with the file path, what went wrong, and the correct pattern. This file grows with every session. **Never repeat a mistake.**

---

## Agents

| Agent | Model | Description |
|---|---|---|
| `@code-reviewer` | sonnet (memory: project) | Persistent memory reviewer — learns Z-Books patterns across sessions |
| `@code-auditor` | opus | Adversarial auditor — assumes implementation is wrong, finds dangerous issues |
| `@qa-unit` | sonnet | Generates and runs Vitest unit tests — never makes real API calls |
| `@qa-visual` | sonnet | Screenshots routes at 375px/768px/1280px, flags layout issues |
| `@research` | sonnet | Fetches official docs before implementing unfamiliar patterns |
| `@pdf-processor-agent` | sonnet | Specialist in Claude API PDF extraction and transaction parsing |
| `@payroll-agent` | sonnet | Specialist in SA PAYE/UIF/SDL calculations and payroll workflows |
| `@db-expert` | sonnet | Specialist in PostgreSQL schema design, Supabase migrations and RLS policies |
| `@security-auditor` | opus | Deep security review — auth flows, RLS gaps, API exposure, POPIA compliance |

---

## Skills

| Skill | Command | Description |
|---|---|---|
| Audit | `/audit` | 9-category parallel health check — fires on "audit", "check everything", "health check" |
| Visualise | `/visualise` | Interactive codebase tree in browser — fires on "structure", "map", "overview" |
| Restore Session | `/restore-session` | Recovers full context from previous session — fires on "where were we", "continue" |
| Security Check | `/security-check` | Scans for vulnerabilities, missing RLS, exposed keys — fires on "security", "audit auth" |
| Add Component | `/add-component` | Creates typed React component with shadcn/ui — fires on "add component", "new UI" |
| Add Route | `/add-route` | Adds App Router page with metadata and loading state — fires on "add page", "new route" |
| Add API Route | `/add-api-route` | Adds validated Next.js API route handler — fires on "add endpoint", "new API" |
| Add Supabase Table | `/add-supabase-table` | Creates table with migration file and RLS policies — fires on "new table", "add schema" |
| Add RLS Policy | `/add-rls-policy` | Adds Row Level Security policy to existing table — fires on "add policy", "RLS" |
| Process Bank Statement | `/process-bank-statement` | Runs PDF through Claude API extraction workflow — fires on "process statement", "extract PDF" |
| Import Excel History | `/import-excel-history` | Runs Excel historical data import workflow — fires on "import excel", "historical data" |
| Generate VAT Report | `/generate-vat-report` | Generates VAT201 report for a date range — fires on "VAT report", "VAT201" |
| Generate Financial Report | `/generate-financial-report` | Generates P&L or Cash Flow for a period — fires on "P&L", "profit and loss", "cash flow" |

---

## Rules Directory

| File | Loads For | Purpose |
|---|---|---|
| `code-style.md` | All files (global) | TypeScript conventions, naming, file organisation |
| `security.md` | `app/api/**`, `lib/supabase/**`, `middleware.ts` | API security, RLS requirements, secret handling |
| `testing.md` | `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts` | Mock requirements, coverage standards, test naming |
| `no-bad-patterns.md` | All files (global) | Compound learning — grows each session |
| `database.md` | `supabase/migrations/**`, `lib/supabase/**` | Migration rules, never manual schema edits |
| `api.md` | `app/api/**` | API route structure, validation, error handling |

---

## MCP Connections

| Server | Purpose | Setup |
|---|---|---|
| `supabase` | Direct DB access — run queries, create tables, manage RLS | Requires `SUPABASE_ACCESS_TOKEN` — get from supabase.com/dashboard/account/tokens |
| `github` | Repository management — create issues, PRs, branches | Requires `GITHUB_PERSONAL_ACCESS_TOKEN` |

**Setup:**
1. Get Supabase access token: https://supabase.com/dashboard/account/tokens
2. Get GitHub PAT: https://github.com/settings/tokens
3. Add both to your shell environment before starting Claude Code

---

## Common Tasks

### Add a new page
```
Use the /add-route skill. Specify: route path, purpose, what data it needs.
```

### Add a new component
```
Use the /add-component skill. Specify: component name, props, what it renders.
```

### Add a new API route
```
Use the /add-api-route skill. Specify: route path, HTTP method, request/response shape.
```

### Add a new database table
```
Use the /add-supabase-table skill. Specify: table name, columns, which org-level RLS applies.
```

### Run a payroll month
```
Use the /generate-financial-report skill or spawn @payroll-agent. Specify: organisation, payroll period.
```

### Process a bank statement
```
Use the /process-bank-statement skill. Specify: organisation ID, bank account ID, PDF file path.
```
