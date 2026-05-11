# Z-Books — Code Style Rules
**Scope:** All files (global — loads every session)
**Updated:** May 2026

---

## TypeScript Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Components | PascalCase | `TransactionReviewTable` |
| Functions | camelCase | `calculatePAYE` |
| Variables | camelCase | `organisationId` |
| Constants | UPPER_SNAKE_CASE | `VAT_RATE`, `UIF_CAP_MONTHLY` |
| Types/Interfaces | PascalCase | `Transaction`, `PayrollRun` |
| Enums | PascalCase | `TransactionStatus` |
| Files — components | kebab-case | `transaction-review-table.tsx` |
| Files — utilities | kebab-case | `paye-calculator.ts` |
| Files — API routes | `route.ts` (fixed) | `app/api/reports/vat/route.ts` |
| Database columns | snake_case | `organisation_id`, `created_at` |
| CSS classes | kebab-case (Tailwind) | `font-mono`, `text-income` |

## File Organisation

```
components/
  [feature]/           # Feature-specific components
    [component].tsx    # One component per file
  shared/              # Reusable across features
  ui/                  # shadcn/ui (auto-generated — never manual edits)

lib/
  supabase/            # Supabase clients only
  financial/           # All financial calculation logic
  claude/              # Claude API wrapper only
  excel/               # Excel parsing logic
  utils.ts             # Shared helpers (cn, formatters)

app/
  (auth)/              # Login/signup only — no dashboard layout
  (dashboard)/         # All authenticated app routes
  api/                 # Server-side API routes only
```

## Import Order (enforced by Prettier)

```typescript
// 1. React
import { useState, useEffect } from "react"
// 2. Next.js
import { redirect } from "next/navigation"
import { Metadata } from "next"
// 3. External libraries
import { z } from "zod"
import { dinero, add } from "dinero.js"
// 4. Internal — absolute (from @/)
import { createServerClient } from "@/lib/supabase/server"
import { formatZAR } from "@/lib/financial/calculations"
// 5. Internal — components
import { TransactionTable } from "@/components/transactions/transaction-table"
import { Button } from "@/components/ui/button"
// 6. Types
import type { Database } from "@/types/database"
```

## Component Structure

```typescript
// Standard order within a component file:
// 1. Imports
// 2. Types/interfaces
// 3. Constants (if needed)
// 4. Component function
// 5. Helper functions used only in this component
// 6. Default export (if needed — prefer named exports)
```

## Commit Message Format

```
feat(phase-N):    new feature
fix(module):      bug fix
chore:            non-code changes
refactor:         code improvement
test:             test changes
docs:             documentation
perf:             performance
security:         security fix
```

## What Never Goes in Committed Code

- `console.log()` — use structured error handling
- `TODO` without a KNOWN_ISSUES.md entry — track it properly
- `any` type — use `unknown` + type narrowing
- Hardcoded organisation IDs or user IDs
- Raw float arithmetic for money
- Direct `.env` edits — update `.env.example` only
