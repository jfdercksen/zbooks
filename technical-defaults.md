# Z-Books — Technical Defaults and Coding Standards
**Agency:** Ai Dynamic Advisory
**Stack:** Next.js 15 + TypeScript + Supabase + Claude API + Vercel
**Updated:** May 2026

Every rule in this document references a specific technology in the Z-Books stack.

---

## Framework Rules — Next.js 15

- Use the **App Router** exclusively. Do not use `/pages` directory.
- Use **Server Components** by default. Add `"use client"` only when component needs browser APIs, event handlers, or state.
- Use **Server Actions** for form submissions and mutations — not separate API routes unless external access is needed.
- All data fetching inside Server Components uses the Supabase server client (`lib/supabase/server.ts`).
- All client-side data fetching uses TanStack Query hooks — never `useEffect` + `fetch` directly.
- Every page must export `metadata` or `generateMetadata` for SEO.
- Every page must have a `loading.tsx` sibling for Suspense boundaries.
- Every page must have an `error.tsx` sibling for error boundaries.
- Ref: https://nextjs.org/docs/app

---

## Language Rules — TypeScript

- **Strict mode is non-negotiable.** `tsconfig.json` must have `"strict": true`.
- Never use `any`. If the type is unknown, use `unknown` and narrow it.
- All Supabase types come from `types/database.ts` — regenerate with `npx supabase gen types typescript --linked > types/database.ts` after every migration.
- All API response shapes must be defined as TypeScript types in `types/app.ts`.
- Use `zod` to validate all external inputs (form data, API request bodies, Claude API responses).
- Use `satisfies` operator for type-safe constants.
- Ref: https://www.typescriptlang.org/docs/handbook/2/types-from-types.html

---

## Frontend Rules — React + shadcn/ui + Tailwind

- Use shadcn/ui components as the foundation — never rebuild from scratch what shadcn provides.
- Add shadcn components via CLI: `npx shadcn@latest add [component]` — never copy-paste manually.
- All styling via Tailwind utility classes — no inline styles, no CSS modules (except globals.css for CSS variables).
- Mobile-first breakpoints: default = mobile, `md:` = tablet, `lg:` = desktop.
- All interactive elements need visible focus states for accessibility.
- Use `lucide-react` for icons — already bundled with shadcn/ui.
- Ref: https://ui.shadcn.com/docs

---

## Financial Calculation Rules — Dinero.js

- **NEVER use JavaScript floats for money.** `0.1 + 0.2 !== 0.3` in JS. This is a financial app.
- All monetary values are stored in the database as `DECIMAL(15,2)` — never `FLOAT`, `REAL`, or `DOUBLE`.
- All in-memory monetary calculations use Dinero.js: `import { dinero, add, subtract, multiply } from 'dinero.js'`.
- All Dinero operations in `lib/financial/calculations.ts` — never scattered across components.
- Currency is ZAR (South African Rand) by default. Use `ZAR` from `@dinero.js/currencies`.
- When displaying amounts: use `toDecimal()` from Dinero.js — never raw `.amount` property.
- Ref: https://dinerojs.com/docs

---

## Database Rules — Supabase (PostgreSQL)

- **Never modify the database schema directly.** Always create a migration file: `supabase/migrations/YYYYMMDD_description.sql`.
- Run migrations via: `npx supabase db push` (never via Supabase dashboard SQL editor in production).
- Every table must have: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`.
- Every table (except `organisations` itself) must have `organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE`.
- Every table must have RLS enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY`.
- Every table must have at least one RLS SELECT policy tied to `organisation_id`.
- Financial amounts stored as `DECIMAL(15,2)` — not NUMERIC without precision, not FLOAT.
- Use PostgreSQL triggers for: updated_at auto-update, audit_log auto-write.
- After every migration: `npx supabase gen types typescript --linked > types/database.ts`.
- Ref: https://supabase.com/docs/guides/database

---

## Auth Rules — Supabase Auth

- Supabase Auth is the single source of truth for authentication. **Never build custom auth.**
- Never store passwords. Never hash passwords manually. Supabase handles all of this.
- Server-side auth: use `createServerClient` from `@supabase/ssr` in Server Components and API routes.
- Client-side auth: use `createBrowserClient` from `@supabase/ssr` in Client Components.
- Auth middleware in `middleware.ts` refreshes sessions on every request — keep it lean.
- After login, redirect to `/dashboard` — never to a raw `/` that might loop.
- Organisation membership is checked via `organisation_members` table — not via JWT claims.
- Ref: https://supabase.com/docs/guides/auth/server-side/nextjs

---

## PDF Processing Rules — Claude API

- PDF extraction endpoint: `app/api/bank-statements/process/route.ts` — this is the ONLY place the Claude API is called.
- `ANTHROPIC_API_KEY` is used server-side ONLY. It must never appear in client components or `NEXT_PUBLIC_` variables.
- Default model: `claude-haiku-4-5` (cost-effective for extraction). Escalate to `claude-sonnet-4-5` if haiku fails.
- Always send PDFs using the Files API (upload once, reference by `file_id`) — not base64 inline for large files.
- Always request structured JSON output with explicit schema in the prompt.
- Always validate Claude's JSON response with Zod before inserting to database.
- Always implement retry logic: if Claude returns malformed JSON, retry once with a stricter prompt.
- Never auto-commit extracted transactions. Always route through the human review queue first.
- Ref: https://docs.anthropic.com/en/docs/about-claude/models/overview

---

## Excel Import Rules — SheetJS

- Excel import is one-time setup per organisation — not a recurring operation.
- Excel parsing in `lib/excel/importer.ts` — never inline in a component or API route.
- Always validate parsed data with Zod before inserting to database.
- Show a preview step: bookkeeper maps Excel columns to database fields before confirming import.
- Handle encoding issues — SA bank exports sometimes use Windows-1252 encoding.
- Ref: https://sheetjs.com/docs/api/parse-options

---

## Code Quality Rules

- Run `npx prettier --write` after every file write (handled by PostToolUse hook).
- Run `npx tsc --noEmit` after every `.ts`/`.tsx` write (handled by PostToolUse hook).
- No `console.log` in committed code — use proper error handling and structured responses.
- All API routes return `NextResponse.json()` with explicit status codes.
- All API routes validate request body with Zod before processing.
- All API routes handle errors explicitly — never let unhandled rejections reach the client.
- Use `try/catch` around all Supabase queries and Claude API calls.

---

## Testing Rules — Vitest

- Test runner: Vitest (`npm test`).
- All tests in `__tests__/` directories alongside the code they test.
- Tests for financial calculations in `lib/financial/__tests__/` — these are critical.
- **Never make real API calls in tests.** Mock Supabase and Claude API with `vi.mock()`.
- Never make real database queries in tests. Use in-memory fixtures.
- Test PAYE calculations against known SARS tax table values.
- Test Dinero.js calculations for ZAR amounts with decimal edge cases.
- After tests pass: `touch /tmp/tests-passed` (required for commit hook).
- Ref: https://vitest.dev/guide/

---

## Deployment Rules — Vercel

- Vercel deploys automatically on push to `main` — no manual deploys.
- Every branch push generates a Vercel Preview URL — use this for review before merging.
- Never push directly to `main` without a PR and at least one preview URL review.
- All secrets in Vercel dashboard under Project → Settings → Environment Variables.
- Production environment: `main` branch only.
- `NEXT_PUBLIC_` variables are baked at build time — never use them for secrets.
- Ref: https://vercel.com/docs/deployments

---

## Security Rules

- `SUPABASE_SERVICE_ROLE_KEY` never leaves the server. One mention in client code = security incident.
- `ANTHROPIC_API_KEY` never leaves the server. API routes only.
- Every `/api/` route must verify the user is authenticated before processing.
- All Supabase queries in API routes use the server client with the authenticated user's JWT — not the service role key (unless doing admin operations that cannot use RLS).
- POPIA: never log personal financial data to console or error tracking without masking.
- Webhook signature verification if any webhooks are added in future phases.

---

## Monitoring Rules

- All `catch` blocks must log the error with enough context to diagnose.
- In production, replace `console.error` with a proper error tracking solution (Sentry — Phase 2).
- Monitor Supabase dashboard weekly for: storage usage, DB size, bandwidth.
- Monitor Vercel dashboard for: function duration, error rate, bandwidth.
- Monitor Anthropic console for: API usage, cost per day.
