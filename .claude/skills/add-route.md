---
name: add-route
description: Add a new page to Z-Books. Fire when the user says "add page", "new route", "add screen", "create page", or any specific page name like "add the transactions page". Creates the page, loading state, error boundary, and metadata.
allowed-tools: Read, Write, Edit, Bash
argument-hint: /route/path "Page title and purpose"
---

# /add-route — Z-Books Page Generator

Add a new App Router page with all required files.

## Live Context

Existing routes:
!`find app -name "page.tsx" | sort`

Missing loading.tsx files:
!`find app -name "page.tsx" -exec dirname {} \; | while read d; do [ ! -f "$d/loading.tsx" ] && echo "Missing: $d/loading.tsx"; done 2>/dev/null`

Current layout:
!`cat app/\(dashboard\)/layout.tsx 2>/dev/null | head -40`

## Files to Create

For each new route, create ALL of these:

### 1. page.tsx
```typescript
// app/(dashboard)/[route]/page.tsx
import { Metadata } from "next"
import { createServerClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = {
  title: "[Page Title] | Z-Books",
  description: "[Page description for SEO]"
}

export default async function [PageName]Page() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect("/login")

  // Server-side data fetching here
  
  return (
    <div className="space-y-6">
      <PageHeader
        title="[Page Title]"
        description="[Page subtitle]"
      />
      {/* Page content */}
    </div>
  )
}
```

### 2. loading.tsx
```typescript
// app/(dashboard)/[route]/loading.tsx
import { Skeleton } from "@/components/ui/skeleton"

export default function [PageName]Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
```

### 3. error.tsx
```typescript
// app/(dashboard)/[route]/error.tsx
"use client"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function [PageName]Error({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-64 gap-4">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred"}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  )
}
```

## Rules

1. Auth check (`getUser()`) on every protected page — redirect to `/login` if no user
2. Data fetching in Server Component using `createServerClient` (not browser client)
3. `metadata` export on every page — proper title and description
4. `loading.tsx` created with meaningful skeleton — not just a spinner
5. `error.tsx` created — never let unhandled errors show raw Next.js error page
6. Mobile-first layout — content stacks vertically on mobile

## Output

```
## Route Added

Files created:
- app/(dashboard)/[route]/page.tsx
- app/(dashboard)/[route]/loading.tsx  
- app/(dashboard)/[route]/error.tsx

Route: /[route]
Auth protected: ✅
Metadata: ✅
Mobile-first: ✅

Add to sidebar nav in: app/(dashboard)/layout.tsx
```
