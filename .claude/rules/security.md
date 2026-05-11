# Z-Books — Security Rules
**Scope:** `app/api/**`, `lib/supabase/**`, `middleware.ts`, `**/route.ts`
**Updated:** May 2026

These rules load automatically when working with API routes, Supabase clients, or middleware.

---

## Authentication — Non-Negotiable

Every API route must verify authentication as the FIRST operation:

```typescript
// REQUIRED — first lines of every API route handler
const supabase = await createServerClient()
const { data: { user }, error: authError } = await supabase.auth.getUser()

if (authError || !user) {
  return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
}
```

Never skip this. There are no exceptions for "internal" routes.

## Organisation Membership — Required After Auth

After authenticating the user, verify they belong to the requested organisation:

```typescript
// REQUIRED — after auth check, before any data operation
const { data: membership } = await supabase
  .from("organisation_members")
  .select("role")
  .eq("organisation_id", requestedOrgId)
  .eq("user_id", user.id)
  .single()

if (!membership) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

Never trust `organisation_id` from the request body without this check.

## Secret Handling Rules

| Secret | Where It Lives | Where It NEVER Goes |
|---|---|---|
| `ANTHROPIC_API_KEY` | `app/api/bank-statements/process/route.ts` only | Any client component, any `NEXT_PUBLIC_` var |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only, admin operations | Any `.tsx` client file |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe — public Supabase URL only | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe — RLS enforces security | — |

If `ANTHROPIC_API_KEY` or `SERVICE_ROLE_KEY` appears in a client component file → **security incident**.

## Supabase Client Usage

```typescript
// In Server Components and API routes — use server client
import { createServerClient } from "@/lib/supabase/server"
const supabase = await createServerClient()

// In Client Components — use browser client
import { createBrowserClient } from "@/lib/supabase/client"
const supabase = createBrowserClient()
```

Never use `SERVICE_ROLE_KEY` when the user-scoped client + RLS can do the job.

## File Upload Security (PDF Bank Statements)

```typescript
// Validate before processing
const MAX_FILE_SIZE = 10 * 1024 * 1024  // 10MB
const ALLOWED_MIME_TYPES = ['application/pdf']

if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 })
}
if (!ALLOWED_MIME_TYPES.includes(file.type)) {
  return NextResponse.json({ error: "Only PDF files accepted" }, { status: 400 })
}
```

## API Route Error Responses

Never expose internal details in error responses:

```typescript
// CORRECT — generic error to client
catch (error) {
  console.error("[route-name] internal error:", error)  // log internally
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// WRONG — exposes stack traces and DB structure
catch (error) {
  return NextResponse.json({ error: error.message, stack: error.stack }, { status: 500 })
}
```

## RLS Requirement

Every table that stores Z-Books data must have:
1. `ALTER TABLE [table] ENABLE ROW LEVEL SECURITY`
2. At minimum a SELECT policy scoped to `organisation_id`

Run this to verify:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```
All rows must show `rowsecurity = true`.

## POPIA Compliance

- Never log email addresses, ID numbers, or financial amounts to console in production
- Never return full user records in API responses — only the fields the client needs
- Audit trail is immutable — no DELETE policy on `audit_log` table
- Data export endpoint must exist and return all org data on request
