# Known Issues and Blockers — Z-Books

> Add issues here as they are discovered during the build.
> Claude reads this at the start of every session.
> Move to Resolved when fixed.

---

## Active Issues

| ID | Issue | Severity | File / Location | Reported | Status |
|---|---|---|---|---|---|
| — | No active issues | — | — | — | — |

Severity: 🔴 Critical | 🟡 High | 🟢 Medium | ⚪ Low

---

## Known Risks (Pre-Build)

| ID | Risk | Severity | Mitigation |
|---|---|---|---|
| R001 | Claude API returns malformed JSON for unusual bank PDF layouts | 🟡 High | Validate all Claude responses with Zod; retry once with stricter prompt; fall back to claude-sonnet-4-5 |
| R002 | Supabase free tier pauses after 1 week of inactivity | ⚪ Low | Keep local Supabase CLI running during development; or use `supabase start` |
| R003 | Vercel function timeout (10s default) on large PDF processing | 🟡 High | Process PDFs page-by-page, not as whole document; use streaming response |
| R004 | Excel historical data format inconsistent with expected columns | 🟢 Medium | Build flexible column-mapper in import UI — bookkeeper maps columns manually before import |
| R005 | PAYE edge cases (mid-year starters, annual bonuses) produce incorrect calculations | 🟢 Medium | Restrict Phase 1 to regular monthly salary only; document edge cases for Phase 2 |

---

## Resolved Issues

| ID | Issue | Fix Applied | Resolved Date |
|---|---|---|---|
| ORG-CREATE-500 | Organisation creation RLS 42501 | Use service role client for DB writes; anon client can't INSERT into orgs before being a member. Also apply migration `20260513_000000_fix_org_members_rls.sql` to live Supabase. | May 2026 |

---

## How to Add an Issue

When you find a bug or blocker during the build:
1. Add it to **Active Issues** with: ID (I001, I002...), description, severity, file location, date
2. Add a note to the current session in BUILD_STATUS.md
3. Commit: `git add KNOWN_ISSUES.md && git commit -m "chore: log known issue [ID]"`
4. When fixed: move to **Resolved** with fix description and date
5. Add the pattern to `.claude/rules/no-bad-patterns.md` so it never happens again
