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

### No entries yet — project just started

This file will grow as patterns are discovered during the build. Check back after Phase 0.

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
