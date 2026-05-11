# Architecture and Design Decisions — Z-Books

> Every significant decision made during the build is recorded here.
> Claude reads this at the start of every session to avoid contradicting decisions already made.
> Format: ID | Decision | Reason | Date | Decided By

---

## Stack Decisions

### D001 — Next.js 15 App Router over Pages Router
**Decision:** Use Next.js 15 with App Router exclusively. No `/pages` directory.
**Reason:** App Router provides Server Components which reduce client bundle size — critical for mobile-first financial app. Server Actions eliminate the need for many API routes. Better TypeScript integration. Future-proof architecture.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory

---

### D002 — Supabase over custom PostgreSQL
**Decision:** Use Supabase managed cloud for database, auth, and storage.
**Reason:** Eliminates DevOps overhead for a one-developer + AI team on a 1-week timeline. Built-in RLS for multi-tenancy. Built-in auth means no custom auth code. Built-in storage for PDF bank statement files. Free tier covers development. Pro tier at $25/month when scaling.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory

---

### D003 — Vercel over self-hosted VPS
**Decision:** Deploy to Vercel (managed) instead of a VPS with Docker.
**Reason:** R250/month budget cannot cover VPS + Docker setup time on a 1-week timeline. Vercel is free for development, automatic preview URLs per branch, zero DevOps. Upgrade to Vercel Pro ($20/month) when first paying client onboards. Revisit self-hosting in Phase 2 if cost is a concern.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory

---

### D004 — Claude API (claude-haiku-4-5) for PDF bank statement extraction
**Decision:** Use Anthropic Claude API in vision mode to extract transactions from PDF bank statements.
**Reason:** Eliminates need to build per-bank custom parsers. Claude vision handles all SA bank PDF formats (FNB, ABSA, Nedbank, Standard Bank, Capitec, Investec) without custom code. Returns structured JSON. Haiku model is cost-effective (~$0.001–0.005/page). Escalate to Sonnet if haiku fails on complex layouts.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory

---

### D005 — Dinero.js for all financial calculations
**Decision:** All monetary arithmetic uses Dinero.js — never native JavaScript floats.
**Reason:** JavaScript floating-point arithmetic is fundamentally broken for money (0.1 + 0.2 ≠ 0.3). Z-Books is a financial application — precision is non-negotiable. Dinero.js uses integer arithmetic internally and handles ZAR (South African Rand) correctly.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory

---

### D006 — Row Level Security (RLS) for multi-tenancy
**Decision:** Multi-tenancy enforced at the database layer via Supabase RLS policies on every table.
**Reason:** Application-level multi-tenancy is fragile — a missing WHERE clause leaks data. RLS enforces isolation at the Postgres layer — impossible to bypass via application bugs. Every table has `organisation_id` and an RLS policy tied to the authenticated user's organisation membership.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory

---

### D007 — Human review required before transaction commit
**Decision:** Claude API extraction results are never auto-committed. Every transaction goes through a human review queue.
**Reason:** Financial compliance and accuracy requirements. A bookkeeper must review and confirm each extracted transaction before it hits the ledger. This is also a regulatory requirement — automated posting without human sign-off is not acceptable practice for bookkeeping.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory

---

### D008 — DECIMAL(15,2) for all monetary database fields
**Decision:** All monetary values stored as PostgreSQL `DECIMAL(15,2)`. Never `FLOAT`, `REAL`, `DOUBLE`, or `NUMERIC` without explicit precision.
**Reason:** FLOAT and DOUBLE in PostgreSQL are approximate types — they introduce rounding errors for financial data. DECIMAL(15,2) is exact. Handles values up to R999,999,999,999,999.99 — more than sufficient.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory

---

### D009 — PDF-only for bank statement import in Phase 1
**Decision:** Phase 1 supports PDF bank statements only. CSV/OFX/QIF import deferred to Phase 2.
**Reason:** Client intake confirmed PDF is the primary format. Claude API handles all PDF formats without per-bank custom code. CSV import adds complexity and requires per-bank column mapping logic. Scope is controlled for the 1-week timeline.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory (per client intake)

---

### D010 — shadcn/ui component library
**Decision:** Use shadcn/ui as the UI component system, installed via CLI.
**Reason:** shadcn/ui components are unstyled at the source — fully customisable with Tailwind. Matches the FreshBooks-inspired clean financial UI aesthetic. TypeScript-native. Accessible (Radix UI primitives). No runtime dependency — components live in the repo.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory

---

### D011 — Inter font via Google Fonts
**Decision:** Use Inter as the primary typeface.
**Reason:** Inter is designed for screen readability. Used by FreshBooks, Linear, Vercel, and most modern SaaS. Clear digit differentiation (1, l, I) — critical for financial amounts. Variable font weight for flexible hierarchy.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory

---

### D012 — Vitest for testing
**Decision:** Use Vitest as the test runner.
**Reason:** Native ESM support — compatible with Next.js 15. Faster than Jest. Same API as Jest — no learning curve. Built-in TypeScript support. Excellent Vite-based developer experience with hot reloading.
**Date:** May 2026
**Decided by:** Ai Dynamic Advisory
