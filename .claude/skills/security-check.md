---
name: security-check
description: Scan Z-Books for security vulnerabilities. Fire when the user says "security check", "scan for vulnerabilities", "check auth", "audit security", "check RLS", or "POPIA check". Runs in isolated fork — cannot modify files.
allowed-tools: Read, Grep, Bash, Glob
context: fork
agent: Explore
---

# /security-check — Z-Books Security Scan

Scan the Z-Books codebase for security vulnerabilities. Read-only — never modifies files.

## Live Context

Files changed recently:
!`git diff --name-only HEAD~5 HEAD 2>/dev/null`

API routes:
!`find app/api -name "route.ts" | sort`

Supabase migrations:
!`find supabase/migrations -name "*.sql" | sort`

## Security Scans

### Scan 1 — Exposed Secrets
```bash
# ANTHROPIC_API_KEY outside of server route
grep -rn "ANTHROPIC_API_KEY" --include="*.tsx" --include="*.ts" . | grep -v "route.ts" | grep -v ".env" | grep -v node_modules

# SERVICE_ROLE_KEY in client files
grep -rn "SERVICE_ROLE_KEY" --include="*.tsx" . | grep -v node_modules

# Hardcoded credentials pattern
grep -rEn "(password|secret|api.?key|token)\s*[:=]\s*['\"][a-zA-Z0-9_\-]{8,}" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".env.example"

# NEXT_PUBLIC_ misuse
grep -rn "NEXT_PUBLIC_" --include="*.ts" . | grep -i "secret\|key\|password\|service.role" | grep -v node_modules
```

### Scan 2 — API Routes Missing Auth
```bash
# Routes that don't check authentication
for f in $(find app/api -name "route.ts"); do
  if ! grep -q "getUser\|auth\(\)\|session\|userId" "$f"; then
    echo "UNPROTECTED: $f"
  fi
done
```

### Scan 3 — RLS Coverage
```bash
# Tables created in migrations
grep -h "CREATE TABLE" supabase/migrations/*.sql 2>/dev/null | sed 's/.*CREATE TABLE\s*//' | sed 's/\s.*//' | sed 's/"//g'

# Tables with RLS enabled
grep -h "ENABLE ROW LEVEL SECURITY" supabase/migrations/*.sql 2>/dev/null | sed 's/.*ALTER TABLE\s*//' | sed 's/\s.*//' | sed 's/"//g'
```

### Scan 4 — Financial Safety
```bash
# Float usage in financial code
grep -rn "parseFloat\|toFixed\|\.toFixed\b" --include="*.ts" --include="*.tsx" . | grep -v node_modules | grep -v ".test."

# FLOAT columns in migrations  
grep -rn "FLOAT\|REAL\b\|DOUBLE PRECISION" supabase/migrations/ 2>/dev/null
```

### Scan 5 — POPIA Compliance Checks
```bash
# Check for console.log with potential personal data
grep -rn "console.log" --include="*.ts" --include="*.tsx" . | grep -i "email\|name\|id.no\|registration\|vat" | grep -v node_modules

# Check for audit_log table existence
grep -rn "audit_log" supabase/migrations/ 2>/dev/null | head -5

# Check for delete policy on audit_log (should NOT exist)
grep -A5 "audit_log" supabase/migrations/*.sql 2>/dev/null | grep -i "DELETE"
```

### Scan 6 — File Upload Security
```bash
# PDF upload — MIME type validation
grep -rn "application/pdf\|mimetype\|fileType\|contentType" --include="*.ts" . | grep -v node_modules

# File size limits
grep -rn "maxSize\|MAX_SIZE\|size.*limit\|limit.*size" --include="*.ts" . | grep -v node_modules
```

## Output Format

```
## Security Scan — Z-Books
Scan date: [datetime]
Files scanned: [N]

### 🚨 CRITICAL
[Issue | File:Line | Immediate fix required]

### 🔴 HIGH  
[Issue | File:Line | Fix before launch]

### 🟡 MEDIUM
[Issue | File:Line | Fix soon]

### 🟢 LOW / Hardening
[Issue | File:Line | Improve when possible]

### ✅ Passing Checks
[What's confirmed secure]

### POPIA Status
- [ ] Privacy Policy accessible
- [ ] Cookie consent implemented
- [ ] Audit log immutable (no DELETE policy)
- [ ] Data export endpoint working
- [ ] No PII in console logs

### Verdict
SECURE — [N] low-priority items only
NEEDS ATTENTION — [N] medium+ issues found
CRITICAL — Immediate action required
```
