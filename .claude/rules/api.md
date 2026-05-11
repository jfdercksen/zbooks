# Z-Books — API Rules
**Scope:** `app/api/**`
**Updated:** May 2026

These rules load automatically when working with API route files.

---

## Every API Route Must Follow This Structure

```typescript
// app/api/[path]/route.ts

import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

// 1. Define request schema with Zod — ALWAYS
const RequestSchema = z.object({
  organisation_id: z.string().uuid(),
  // ... other required fields
})

export async function [METHOD](request: NextRequest) {
  try {
    // 2. Authenticate — ALWAYS FIRST
    const supabase = await createServerClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    // 3. Validate request — ALWAYS SECOND
    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      )
    }

    // 4. Check org membership — ALWAYS THIRD
    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", parsed.data.organisation_id)
      .eq("user_id", user.id)
      .single()
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // 5. Business logic
    // ...

    // 6. Return success
    return NextResponse.json({ success: true, data: {} }, { status: 200 })

  } catch (error) {
    // 7. Handle errors — generic message only
    console.error("[route-name]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

## HTTP Status Codes

| Code | When to Use |
|---|---|
| 200 | Successful GET or action |
| 201 | Resource created |
| 400 | Bad request — validation failed |
| 401 | Not authenticated |
| 403 | Authenticated but no permission |
| 404 | Resource not found |
| 409 | Conflict — duplicate detected |
| 500 | Server error — generic message only |

## Claude API Route — Special Rules

Only `app/api/bank-statements/process/route.ts` may use `ANTHROPIC_API_KEY`.
```typescript
// Only in this file:
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
```

This route must also:
- Validate PDF file type and size before sending to Claude
- Validate Claude's JSON response with Zod before database insert
- Never auto-commit — return extracted data for human review
- Handle timeout with page-by-page processing

## Error Response Shape

```typescript
// Always consistent shape
type ErrorResponse = { error: string; details?: unknown }
type SuccessResponse<T> = { success: true; data: T }
```

## GET Routes

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check
  // Build query — always include organisation_id filter
  // RLS will also enforce this — defence in depth
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("id", params.id)
    .eq("organisation_id", userOrganisationId)  // Always explicit
    .single()
}
```
