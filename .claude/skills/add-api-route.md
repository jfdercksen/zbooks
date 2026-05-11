---
name: add-api-route
description: Add a new API route handler to Z-Books. Fire when the user says "add API endpoint", "add backend route", "create API", "new route handler", or "add webhook endpoint". Creates validated, auth-protected Next.js API routes.
allowed-tools: Read, Write, Edit, Bash
argument-hint: /api/path METHOD "Description of what the endpoint does"
---

# /add-api-route — Z-Books API Route Generator

Add a validated, auth-protected Next.js API route handler.

## Live Context

Existing API routes:
!`find app/api -name "route.ts" | sort`

Zod schemas available:
!`find lib -name "*.ts" | xargs grep -l "z\.object" 2>/dev/null`

## API Route Template

```typescript
// app/api/[path]/route.ts
import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

// Define request schema — always validate with Zod
const RequestSchema = z.object({
  organisation_id: z.string().uuid(),
  // ... other fields
})

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorised" },
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      )
    }

    // 3. Verify user belongs to the requested organisation
    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", parsed.data.organisation_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    // 4. Business logic here
    // Use supabase client — RLS enforces data isolation
    
    // 5. Return success response
    return NextResponse.json({ success: true, data: {} }, { status: 200 })

  } catch (error) {
    // 6. Never expose internal errors to client
    console.error("[route-name] error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

## Rules

1. **Auth check is mandatory** — every route verifies `getUser()` first
2. **Organisation membership check** — verify user belongs to the org before processing
3. **Zod validation** — validate ALL request inputs before touching database
4. **Never expose stack traces** — generic error messages to client only
5. **Explicit HTTP status codes** — 200, 201, 400, 401, 403, 404, 500
6. **ANTHROPIC_API_KEY routes** — only in `app/api/bank-statements/process/route.ts`
7. **Use server Supabase client** — never browser client in API routes

## Output

```
## API Route Created

File: app/api/[path]/route.ts
Method(s): [GET | POST | PUT | DELETE]
Auth: ✅ (getUser + org membership check)
Validation: ✅ (Zod schema: [fields])

Request shape:
[TypeScript interface]

Response shape:
[TypeScript interface]

Test with:
curl -X POST http://localhost:3000/api/[path] \
  -H "Content-Type: application/json" \
  -H "Cookie: [session cookie]" \
  -d '{"organisation_id": "uuid-here"}'
```
