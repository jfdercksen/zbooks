# Implementation Workflow
## Z-Books — Ai Dynamic Advisory
## Revised: May 2026 (Existing Project Enhancer v2.0)

**This file tells you HOW to work every session. WHAT to build lives in [BUILD_PHASES.md](BUILD_PHASES.md).**

Open this file at the start of every development cycle. Every numbered step names the exact agent, skill, or command to invoke.

---

## Pre-flight (every session — no exceptions)

1. Run `/restore-session` — reads `BUILD_STATUS.md`, `KNOWN_ISSUES.md`, recent git log, and in-progress changes; outputs a single "what to do next" recommendation
2. Confirm current phase and task in `BUILD_STATUS.md` are still accurate
3. Check `KNOWN_ISSUES.md` — know your active blockers before writing a line of code
4. If reorienting after more than a day away: run `/visualise` for a full codebase map

---

## Define

5. Write the change spec in 2–3 sentences — describe the exact user-visible behaviour that will exist when done. No code yet.
6. If the change touches an unfamiliar API, library, or pattern: spawn `@research` with the spec before implementing anything
7. If the change requires a new database table or schema change: spawn `@db-expert` with the spec now — before writing any application code

---

## Plan

8. Ask Claude directly: "Give me a numbered implementation plan for: [spec]" — receive a step-by-step plan before writing any code
9. Read the plan back critically: reject any step that exceeds spec, adds unrequested features, or skips a phase task from `BUILD_PHASES.md`

---

## Implement

10. Write code following the plan and the patterns in `.claude/rules/` (loaded automatically per file type)
11. Run `npm test` incrementally — do not let the test suite accumulate failures
12. PostToolUse hooks auto-format (Prettier) and type-check (`tsc --noEmit`) after every file write — fix failures before continuing to the next file
13. **API routes:** follow the 7-step auth → validate → org-check → business logic → return pattern in `.claude/rules/api.md`
14. **Financial calculations:** use `lib/financial/calculations.ts` (Dinero.js wrappers) — never raw JS floats or `toFixed()`
15. **New tables:** use `/add-supabase-table` — it generates the migration file and RLS policies together so neither is forgotten
16. **New pages:** use `/add-route` — it scaffolds loading.tsx and error.tsx alongside the page
17. **New components:** use `/add-component` — it wires shadcn/ui props and TypeScript interfaces correctly

---

## Review

18. Spawn `@code-reviewer` — applies the Z-Books-specific checklist and reads `.claude/memory/code-reviewer.md` for patterns accumulated across previous sessions
19. Spawn `@code-auditor` — adversarial review; it assumes the implementation has at least 3 problems and tries to break it
    - Run steps 18 and 19 **in parallel** when they cover independent concerns
20. If the change is security-sensitive (auth flow, RLS policy, API key handling, POPIA data): also spawn `@security-auditor`

---

## Resolve

21. Fix **all CRITICAL and HIGH** findings from `@code-auditor` before moving on — these are non-negotiable
22. MEDIUM and LOW findings: judgment call — document any deliberate deferrals in `KNOWN_ISSUES.md` with a severity rating
23. If `@code-reviewer` found a new pattern (good or bad): add it to `.claude/rules/no-bad-patterns.md` immediately and commit that file

---

## Test and Commit

24. Run the full test suite: `npm test`
25. Run type check: `npx tsc --noEmit`
26. If all pass — create the sentinel file:
    - PowerShell: `New-Item /tmp/tests-passed -Force`
    - bash: `touch /tmp/tests-passed`
27. `git commit` — the PreToolUse hook gates on the sentinel; it will block without it
28. If the commit is blocked: investigate the root cause — do **not** manually create the sentinel to bypass it

---

## Phase Sign-off (when a full phase is complete)

29. Spawn `@code-auditor` for a full phase adversarial review — not just the last feature
30. Run `/audit` — 9-category codebase health check; fix anything rated 🔴 before proceeding
31. Run `/security-check` — vulnerability scan before merging to main
32. Update `BUILD_STATUS.md` — mark phase complete, set next phase and task, add session note
33. `git push origin [branch]` — Vercel generates the preview URL automatically
34. Test the Vercel preview URL against the staging checklist for that phase in `BUILD_PHASES.md`
35. Merge to `main` when preview is approved — GitHub Actions CI runs type check + tests + build + secrets scan

---

## Retro (when something went wrong)

36. If a bug shipped, `@code-auditor` caught something `@code-reviewer` missed, or the same mistake recurred:
    - Add the specific pattern to `.claude/rules/no-bad-patterns.md` (format: bad code → correct code → why)
    - If the workflow step itself failed, update **this file** (`IMPLEMENTATION_WORKFLOW.md`)
    - If a new skill or agent would have prevented the problem, propose it and document the decision in `DECISIONS.md`

---

## Agents in This Project

| Agent | Model | When to Spawn |
|---|---|---|
| `@code-reviewer` | sonnet | After every feature, bug fix, or refactor — reads accumulated memory |
| `@code-auditor` | opus | After code-reviewer; adversarial — assume 3 problems exist |
| `@db-expert` | sonnet | New tables, schema changes, RLS policies, query optimisation |
| `@payroll-agent` | sonnet | PAYE/UIF/SDL calculations, payroll runs, payslip generation |
| `@pdf-processor-agent` | sonnet | Claude API PDF extraction, bank statement parsing |
| `@qa-unit` | sonnet | After any new function, utility, API route, or financial calculation |
| `@qa-visual` | sonnet | After any UI component, page, or layout change |
| `@research` | sonnet | Before implementing anything unfamiliar — fetches official docs |
| `@security-auditor` | opus | Auth flows, RLS policies, API exposure, POPIA compliance |

---

## Skills in This Project

| Skill | When to Use |
|---|---|
| `/restore-session` | **Step 1 of every session** — non-negotiable |
| `/audit` | Start of session, before merges, after major changes |
| `/visualise` | When reorienting or exploring project structure |
| `/security-check` | Before every commit on security-sensitive changes |
| `/add-route` | New Next.js App Router page |
| `/add-component` | New React component with shadcn/ui |
| `/add-api-route` | New validated API route handler |
| `/add-supabase-table` | New database table (migration + RLS generated together) |
| `/add-rls-policy` | RLS policy on an existing table |
| `/process-bank-statement` | Run the Claude API PDF extraction workflow |
| `/import-excel-history` | Run the Excel historical data import workflow |
| `/generate-vat-report` | Generate VAT201 report for a date range |
| `/generate-financial-report` | Generate P&L or Cash Flow statement |

---

## MCP Servers in Use

| Server | Purpose |
|---|---|
| `supabase` | Direct DB access — run queries, apply migrations, inspect RLS |
| `github` | Repository management — create issues, PRs, branches |

---

## Quick Reference — Commands

```bash
npm run dev              # Dev server (Turbopack)
npm run build            # Production build — run before every merge
npm test                 # Vitest test suite
npm run test:coverage    # With coverage report
npx tsc --noEmit         # TypeScript check only

# Mark tests passed (required before git commit)
New-Item /tmp/tests-passed -Force   # PowerShell
touch /tmp/tests-passed              # bash
```

## Quick Reference — Key URLs

| Resource | URL |
|---|---|
| Supabase Dashboard | https://supabase.com/dashboard/project/hiwpabemogofaqunmafw |
| Supabase SQL Editor | https://supabase.com/dashboard/project/hiwpabemogofaqunmafw/sql/new |
| Vercel Project | https://vercel.com/content-engines-projects/zbooks |
| GitHub Repo | https://github.com/jfdercksen/zbooks |

## Key Files

| File | Purpose |
|---|---|
| `BUILD_PHASES.md` | Phase-by-phase task backlog — WHAT to build |
| `BUILD_STATUS.md` | Current phase, task, and blockers — live state |
| `KNOWN_ISSUES.md` | Active bugs and blockers |
| `DECISIONS.md` | Architectural decisions log |
| `.claude/memory/code-reviewer.md` | Code reviewer's accumulated cross-session knowledge |
| `.claude/rules/no-bad-patterns.md` | Compound learning — grows each session |
