---
name: add-component
description: Create a new typed React component for Z-Books. Fire when the user says "add component", "create component", "new UI element", "build a form", "add a card", or "new widget". Uses shadcn/ui and follows design-rules.md.
allowed-tools: Read, Write, Edit, Bash
argument-hint: component-name [description of what it does and what props it needs]
---

# /add-component — Z-Books Component Generator

Create a new typed React component following Z-Books design standards.

## Live Context

Existing components:
!`find components -name "*.tsx" | sort`

shadcn/ui components installed:
!`ls components/ui/ 2>/dev/null`

## Process

1. Read `design-rules.md` — apply brand tokens and mobile-first rules
2. Read `technical-defaults.md` — apply TypeScript and component rules
3. Check `components/ui/` — use existing shadcn components, don't rebuild them
4. Create the component file in the correct directory
5. Export the component with full TypeScript types
6. Add it to the parent index if one exists

## Component Template

```typescript
// components/[category]/[component-name].tsx
"use client" // Only add if using browser APIs, state, or event handlers

import { ComponentProps } from "react"
// Import shadcn/ui components — never rebuild from scratch
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

// Always define props interface — never inline
interface [ComponentName]Props {
  // Required props first
  // Optional props with ? and defaults
  className?: string
}

export function [ComponentName]({ className, ...props }: [ComponentName]Props) {
  return (
    <div className={cn("", className)}>
      {/* Implementation */}
    </div>
  )
}
```

## Financial Amount Display Pattern

```typescript
// Always use this pattern for ZAR amounts
import { formatZAR } from "@/lib/financial/calculations"

// In JSX:
<span className={cn(
  "font-mono tabular-nums",
  amount > 0 ? "text-income" : "text-expense"
)}>
  {formatZAR(amount)}
</span>
```

## Rules

1. Mobile-first — default styles are mobile, use `md:` and `lg:` for larger screens
2. Minimum touch target 44px height on all interactive elements
3. Use `cn()` from `@/lib/utils` for conditional classnames
4. Financial amounts: monospace font, right-aligned, colour-coded
5. All shadcn components added via CLI, not copy-pasted: `npx shadcn@latest add [component]`
6. `"use client"` only when actually needed — Server Component by default

## Output

After creating the component:
```
## Component Created

File: components/[category]/[name].tsx
Type: Server Component | Client Component
Props: [list of props with types]
shadcn/ui used: [list]
Mobile-first: ✅

Usage:
import { [ComponentName] } from "@/components/[category]/[name]"
<[ComponentName] prop1={value} />
```
