# Code Reviewer — Z-Books Accumulated Memory

This file is read at the start of every `@code-reviewer` session and appended at the end.
Format: `[Date] [File:Line] — [finding and correct pattern]`

---

## Known Patterns — Confirmed Correct

_(empty — first review will populate this)_

---

## Known Violations — Flag on Next Occurrence

### Supabase Type Casting
May 2026 — `app/api/organisations/route.ts` — Supabase JS v2.105+ resolves table types as `never` when the manually written `Database` type doesn't match its internal `GenericSchema` constraint. Workaround: cast client `as any` in API routes until `npx supabase gen types` is run against the live schema and `types/database.ts` is regenerated. See `.claude/rules/no-bad-patterns.md` for full detail.

---

## Architectural Decisions Observed

_(empty — populate as decisions are confirmed during reviews)_
