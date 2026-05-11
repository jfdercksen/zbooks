# Z-Books — Build Workflow
**Agency:** Ai Dynamic Advisory
**Updated:** May 2026

---

## The 7-Step Build Workflow

Every task — every single one — follows these 7 steps. No shortcuts.

```
1. WRITE    → Implement the feature
2. REVIEW   → Spawn @code-reviewer
3. QA UNIT  → Spawn @qa-unit
4. QA VISUAL→ Spawn @qa-visual (all frontend work)
5. FIX      → Apply all findings from steps 2–4
6. BUILD    → npm run build && npx tsc --noEmit
7. SHIP     → Commit, push, verify Vercel preview URL
```

Steps 2, 3, 4 can be spawned in **parallel** when they cover independent concerns.

After shipping → spawn `@code-auditor` for adversarial review.

---

## Daily Development Flow

```bash
# 1. Start the day — read project state
cat BUILD_STATUS.md

# 2. Create a feature branch
git checkout -b feature/phase-N-task-name

# 3. Start local dev server
npm run dev

# 4. Do the work following IMPLEMENTATION_WORKFLOW.md

# 5. Before committing — run tests
npm test
# If tests pass:
touch /tmp/tests-passed

# 6. Type check
npx tsc --noEmit

# 7. Commit (blocked by hook if tests haven't passed)
git add -A
git commit -m "feat(phase-N): description of what was built"

# 8. Push — generates Vercel Preview URL automatically
git push origin feature/phase-N-task-name

# 9. Review the Vercel preview URL

# 10. Merge when satisfied
git checkout main
git merge feature/phase-N-task-name
git push origin main
# → CI runs → production deploys

# 11. Update BUILD_STATUS.md
# 12. Commit BUILD_STATUS.md
git add BUILD_STATUS.md && git commit -m "chore: update build status"
git push origin main
```

---

## Git Commit Convention

```
feat(phase-N):    new feature
fix(module):      bug fix
chore:            non-code changes (BUILD_STATUS, DECISIONS, etc.)
refactor:         code improvement with no behaviour change
test:             adding or fixing tests
docs:             documentation changes
perf:             performance improvement
security:         security fix
```

Examples:
```
feat(phase-2): add Claude API PDF extraction endpoint
fix(reports): correct VAT calculation for zero-rated transactions
chore: update build status — Phase 2 complete
security: add RLS policy to payroll_runs table
```

---

## Research Workflow

Before implementing anything unfamiliar:
```
Spawn @research agent with:
- The specific question or technology
- The official documentation URL to fetch
- What you need to know to proceed

@research returns: answer, key details, sources, recommendation
Only then start implementing.
```

---

## Three-Environment Workflow

| Environment | Trigger | URL | Who Reviews |
|---|---|---|---|
| Local | `npm run dev` | `localhost:3000` | Developer |
| Preview | Any branch push / PR | `z-books-[hash].vercel.app` | Developer + client |
| Production | Push to `main` (after CI) | `https://z-books.co.za` | Everyone |

**Never push directly to `main`.** Always branch → PR → review preview → merge.

---

## Spawning Agents

```
# Single agent
@code-reviewer review the transaction categorisation logic in app/api/bank-statements/process/route.ts

# Parallel agent team
Spawn a team:
- @code-reviewer to review the payroll calculation logic
- @qa-unit to write and run tests for lib/financial/paye.ts
- @qa-visual to screenshot the payroll run form at 375px, 768px, 1280px

# Adversarial review
@code-auditor audit the entire bank statement processing pipeline — assume it's broken
```

---

## Using Skills

```
# Process a bank statement
/process-bank-statement organisation_id=abc123 bank_account_id=def456

# Add a new table
/add-supabase-table name=payroll_runs columns="id, organisation_id, period_start, period_end, total_gross, total_net, status"

# Add a route
/add-route path=/reports/balance-sheet purpose="Balance sheet report with assets, liabilities, equity"

# Run security scan
/security-check

# Audit the codebase
/audit
```

---

## Testing Approach

- **Test runner:** Vitest (`npm test`)
- **Financial logic:** Unit test every calculation in `lib/financial/` — PAYE, VAT, Dinero.js wrappers
- **API routes:** Integration tests with mocked Supabase and Claude API responses
- **Components:** Vitest + React Testing Library for form validation and state
- **No real API calls in tests** — always `vi.mock()` external services
- **Critical test cases:**
  - PAYE: R0 tax (below threshold), 18%, 26%, 31%, 36%, 39%, 41%, 45% brackets
  - VAT: 15% standard, 0% zero-rated, exempt exclusion
  - Dinero.js: ZAR addition, subtraction, rounding to 2dp

---

## Database Migration Workflow

```bash
# 1. Write migration file
# supabase/migrations/YYYYMMDD_HHMMSS_description.sql

# 2. Test locally
npx supabase db reset

# 3. Verify schema
npx supabase db diff

# 4. Push to production Supabase
npx supabase db push

# 5. Regenerate TypeScript types
npx supabase gen types typescript --linked > types/database.ts

# 6. Commit everything
git add supabase/migrations/ types/database.ts
git commit -m "chore: migration — description"
```

---

## End-of-Session Checklist

Before closing Claude Code:
- [ ] All work committed and pushed
- [ ] BUILD_STATUS.md updated (current phase, completed tasks, blockers)
- [ ] KNOWN_ISSUES.md updated with any new bugs found
- [ ] DECISIONS.md updated with any architectural decisions made
- [ ] Session note added to BUILD_STATUS.md
- [ ] `git add BUILD_STATUS.md DECISIONS.md KNOWN_ISSUES.md && git commit -m "chore: session end — [date]"`
