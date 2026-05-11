---
name: audit
description: Run a comprehensive 9-category health check on the Z-Books codebase. Fire when the user says "audit", "health check", "check everything", "review all", or "how's the codebase". Runs checks in parallel via isolated fork — cannot modify files.
allowed-tools: Read, Glob, Grep, Bash
context: fork
agent: Explore
---

# /audit — Z-Books Codebase Health Check

Run all 9 checks in parallel. Report findings with severity ratings.

## Live Context

Current git status:
!`git status --short`

Recent changes:
!`git log --oneline -10`

TypeScript errors:
!`npx tsc --noEmit 2>&1 | head -30`

Test results:
!`npm test --silent 2>&1 | tail -20`

## 9-Category Parallel Health Checks

### 1. Build Integrity
```bash
npm run build 2>&1 | tail -30
```
Checks: build passes, no webpack errors, no missing modules

### 2. TypeScript Type Safety
```bash
npx tsc --noEmit 2>&1
```
Checks: zero type errors (strict mode), no `any` types, Supabase types current

### 3. Security Scan
```bash
# Check for exposed secrets
grep -rn "ANTHROPIC_API_KEY\|SERVICE_ROLE_KEY" --include="*.tsx" . | grep -v "route.ts" | grep -v ".env"
# Check for API routes missing auth
grep -rL "getUser\|auth\|session" app/api --include="route.ts" 2>/dev/null
# Check for hardcoded credentials
grep -rE "(password|secret|apikey)\s*[:=]\s*['\"][^'\"]{8,}" --include="*.ts" --include="*.tsx" . 2>/dev/null
```

### 4. Test Coverage
```bash
npm test -- --coverage 2>&1 | tail -30
```
Checks: financial calculations covered, API routes covered, no critical paths untested

### 5. Dead Code Detection
```bash
# Unused exports
grep -rn "export" --include="*.ts" --include="*.tsx" . | grep -v node_modules | head -50
# Unused components
find components -name "*.tsx" | xargs grep -L "import" 2>/dev/null
```

### 6. Financial Safety Scan
```bash
# Check for float usage in financial calculations
grep -rn "parseFloat\|toFixed\|Math\.round.*amount\|Math\.floor.*amount" --include="*.ts" --include="*.tsx" . | grep -v node_modules
# Check for FLOAT columns in migrations
grep -rn "FLOAT\|REAL\|DOUBLE" supabase/migrations/ 2>/dev/null
```

### 7. RLS Coverage
```bash
# Tables in migrations
grep -h "CREATE TABLE" supabase/migrations/*.sql 2>/dev/null | grep -v "IF NOT EXISTS"
# RLS enablement
grep -h "ENABLE ROW LEVEL SECURITY" supabase/migrations/*.sql 2>/dev/null
```
Checks: every table has RLS enabled

### 8. Dependencies
```bash
npm audit --audit-level=high 2>&1 | head -30
```
Checks: no high/critical CVEs in dependencies

### 9. Documentation Gaps
```bash
# Routes without metadata export
grep -rL "export.*metadata\|generateMetadata" app --include="page.tsx" 2>/dev/null
# Missing loading.tsx
find app -name "page.tsx" -exec dirname {} \; | while read d; do [ ! -f "$d/loading.tsx" ] && echo "Missing loading.tsx: $d"; done 2>/dev/null | head -10
```

## Output Format

```
## Z-Books Codebase Audit — [Date]

### Health Score: [N]/100

| Category | Status | Issues |
|---|---|---|
| Build | ✅/❌ | [N] errors |
| TypeScript | ✅/❌ | [N] errors |
| Security | ✅/❌ | [N] issues |
| Test Coverage | ✅/❌ | [N]% coverage |
| Dead Code | ✅/❌ | [N] unused |
| Financial Safety | ✅/❌ | [N] violations |
| RLS Coverage | ✅/❌ | [N] tables without RLS |
| Dependencies | ✅/❌ | [N] CVEs |
| Documentation | ✅/❌ | [N] gaps |

### 🔴 Top 3 Priority Fixes
1. [Most critical issue with file:line]
2. [Second most critical]
3. [Third most critical]

### Full Findings
[Detailed findings per category]
```
