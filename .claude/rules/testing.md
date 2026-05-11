# Z-Books — Testing Rules
**Scope:** `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`
**Updated:** May 2026

These rules load automatically when working with test files.

---

## Test Runner

**Vitest** — run with `npm test`

```bash
npm test                          # Run all tests
npm test -- --watch               # Watch mode during development
npm test -- lib/financial         # Run specific directory
npm test -- --coverage            # With coverage report
```

## Mock Requirements — Absolute Rules

**Never make real API calls in tests.** Use `vi.mock()` for all external services.

```typescript
// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null
      })
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    }))
  }))
}))

// Mock Anthropic Claude API
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"transactions": []}' }]
      })
    },
    beta: {
      files: {
        upload: vi.fn().mockResolvedValue({ id: 'mock-file-id' })
      }
    }
  }))
}))
```

## Coverage Requirements

| Module | Minimum Coverage | Why |
|---|---|---|
| `lib/financial/paye.ts` | 100% | SARS compliance — wrong calculations = legal risk |
| `lib/financial/vat.ts` | 100% | SARS compliance — wrong VAT = audit risk |
| `lib/financial/calculations.ts` | 95% | Financial precision is non-negotiable |
| `lib/claude/pdf-extractor.ts` | 80% | Core product feature |
| `lib/excel/importer.ts` | 80% | Data integrity on import |
| `app/api/**/route.ts` | 75% | API surface must be tested |

## Test Naming Convention

```typescript
describe("calculatePAYE", () => {
  it("returns R0 for income below tax threshold", () => {})
  it("applies primary rebate of R17,235 for all taxpayers", () => {})
  it("uses 18% bracket for income between R0 and R237,100", () => {})
  it("correctly annualises monthly salary before calculating", () => {})
})

// Pattern: it("[function] [condition] [expected result]")
```

## Critical Test Cases — Must Exist

### PAYE — Required Tests
```typescript
test("R0 tax for annual income R95,749 (below threshold)", ...)
test("18% bracket applied for annual income R150,000", ...)
test("26% bracket for annual income R300,000", ...)
test("Primary rebate of R17,235 deducted for all", ...)
test("Secondary rebate for age 65+", ...)
test("Monthly PAYE is annual tax ÷ 12", ...)
test("UIF capped at R177.12 (R17,712 earnings ceiling)", ...)
```

### VAT — Required Tests
```typescript
test("15% VAT on standard rated supplies", ...)
test("0% VAT on zero rated supplies", ...)
test("Exempt supplies excluded from VAT calculation", ...)
test("Reverse VAT extraction: R115 gross → R15 VAT", ...)
test("Output VAT minus input VAT = net payable", ...)
```

### Dinero.js — Required Tests
```typescript
test("R100 + R50 = R150 exactly (no float errors)", ...)
test("R100 - R50.50 = R49.50", ...)
test("Negative amounts handled correctly", ...)
test("ZAR formatting shows 2 decimal places", ...)
```

## After Tests Pass

```bash
# Required before git commit (commit hook checks this)
touch /tmp/tests-passed
```

The commit hook blocks `git commit` unless `/tmp/tests-passed` exists.

## Test File Location

Tests live alongside the code they test:
```
lib/financial/paye.ts
lib/financial/__tests__/paye.test.ts

app/api/reports/vat/route.ts
app/api/reports/vat/__tests__/route.test.ts
```
