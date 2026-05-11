# Z-Books — No Bad Patterns (Compound Learning)
**Scope:** All files (global — loads every session)
**Updated:** Grows with every session

> **CLAUDE INSTRUCTION:** When you find a bug or bad pattern during any session, add it here immediately. Format:
> `### [Short name] — [File where found]`
> `**Problem:** [What went wrong]`
> `**Never do:** [Bad pattern]`
> `**Always do:** [Correct pattern]`
> `**Date:** [Month Year]`
>
> This file grows with every session. **Never repeat a mistake.**

---

## Active Patterns to Avoid

### Supabase type inference breaks with @supabase/supabase-js@2.105+ — app/api/**, app/(dashboard)/**
**Problem:** `@supabase/supabase-js@2.105.4` was installed (package.json lists ^2.47.0). The newer version resolves table types as `never` when the manually written `Database` type doesn't perfectly match its internal `GenericSchema` constraint. INSERT parameters fail with `'name' does not exist in type 'never[]'`.
**Never do:**
```typescript
const supabase = await createServerClient()
await supabase.from("organisations").insert({ name: "..." }) // TS error: never[]
```
**Always do (until schema is applied and types auto-generated):**
```typescript
// API routes:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = (await createServerClient()) as any

// Server component pages (select):
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { data: raw } = await (supabase as any).from("table").select("id, name")
const typed = raw as Array<{ id: string; name: string }> | null
```
**Permanent fix:** Once Supabase schema is applied, run `npx supabase gen types typescript --linked > types/database.ts` then remove all `as any` casts.
**Date:** May 2026
**Discovered by:** TypeScript compiler during Phase 1 build

---

## Template for New Entries

```markdown
### [Short descriptive name] — [file path where found]
**Problem:** [What the bug or bad pattern was — be specific]
**Never do:**
\`\`\`typescript
// The bad code
\`\`\`
**Always do:**
\`\`\`typescript
// The correct code
\`\`\`
**Date:** [Month Year]
**Discovered by:** [code-reviewer | code-auditor | qa-unit | developer]
```

---

## How to Add an Entry

1. Find a bug or bad pattern during review or debugging
2. Add it to this file using the template above
3. Commit: `git add .claude/rules/no-bad-patterns.md && git commit -m "docs: add bad pattern — [short name]"`
4. The next session Claude will read this file and never repeat the mistake
