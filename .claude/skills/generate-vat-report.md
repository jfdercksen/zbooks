---
name: generate-vat-report
description: Generate a VAT201 report for a Z-Books organisation. Fire when the user says "VAT report", "VAT201", "generate VAT", "tax report", "input VAT", or "output VAT". Produces the report and PDF export.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: organisation_id period_start period_end
---

# /generate-vat-report — Z-Books VAT201 Report Generator

Generate a SARS-aligned VAT201 report for a given tax period.

## Live Context

VAT report API route:
!`cat app/api/reports/vat/route.ts 2>/dev/null | head -30`

VAT utility:
!`cat lib/financial/vat.ts 2>/dev/null`

Transactions schema:
!`grep -A20 "CREATE TABLE transactions" supabase/migrations/*.sql 2>/dev/null`

## VAT Calculation Logic

### SA VAT Types
```typescript
// lib/financial/vat.ts
export type VATType = 
  | 'standard'    // 15% — taxable supply at standard rate
  | 'zero_rated'  // 0% — taxable supply at 0% (food, exports, etc.)
  | 'exempt'      // No VAT — financial services, residential rent, etc.
  | 'outside'     // Outside scope of VAT — not a supply

export const VAT_RATE = 0.15  // 15% current SARS rate

// Reverse calculation — when gross amount is given
export function extractVATFromGross(grossAmount: number): number {
  // gross = net × 1.15, so VAT = gross × (15/115) = gross × (3/23)
  return Math.round((grossAmount * 15 / 115) * 100) / 100
}

// Forward calculation — when net amount is given  
export function calculateVATOnNet(netAmount: number): number {
  return Math.round(netAmount * VAT_RATE * 100) / 100
}
```

### VAT201 Report Query

```sql
-- Output VAT (from sales/income)
SELECT 
  SUM(credit_amount) as total_income,
  SUM(vat_amount) FILTER (WHERE vat_type = 'standard') as output_vat_standard,
  SUM(credit_amount) FILTER (WHERE vat_type = 'zero_rated') as zero_rated_supplies,
  SUM(credit_amount) FILTER (WHERE vat_type = 'exempt') as exempt_supplies
FROM transactions
WHERE organisation_id = $org_id
  AND date >= $period_start
  AND date <= $period_end
  AND transaction_type = 'income';

-- Input VAT (from purchases/expenses)
SELECT
  SUM(debit_amount) as total_expenses,
  SUM(vat_amount) FILTER (WHERE vat_type = 'standard') as input_vat_claimable,
  SUM(debit_amount) FILTER (WHERE vat_type = 'zero_rated') as zero_rated_purchases
FROM transactions
WHERE organisation_id = $org_id
  AND date >= $period_start
  AND date <= $period_end
  AND transaction_type = 'expense';

-- Net VAT payable
-- output_vat_standard - input_vat_claimable = VAT payable (positive) or refund (negative)
```

## VAT201 Report Format

```
┌──────────────────────────────────────────────────────┐
│ VAT201 RETURN                                        │
│ [Company Name] | VAT No: [number]                   │
│ Tax Period: [month] [YYYY] ([start] – [end])        │
├──────────────────────────────────────────────────────┤
│ FIELD 1 — STANDARD RATED SUPPLIES                   │
│ Total Value of Supplies (excl. VAT)    R [amount]   │
│ Output VAT (15%)                       R [amount]   │
├──────────────────────────────────────────────────────┤
│ FIELD 1A — ZERO RATED SUPPLIES                      │
│ Total Value of Zero Rated Supplies     R [amount]   │
├──────────────────────────────────────────────────────┤
│ FIELD 1B — EXEMPT SUPPLIES                          │
│ Total Value of Exempt Supplies         R [amount]   │
├──────────────────────────────────────────────────────┤
│ FIELD 4 — INPUT TAX                                 │
│ Total Purchases (excl. VAT)            R [amount]   │
│ Input VAT Claimable                    R [amount]   │
├──────────────────────────────────────────────────────┤
│ FIELD 5 — VAT PAYABLE / REFUNDABLE                  │
│ Output VAT                             R [amount]   │
│ Less: Input VAT                       (R [amount])  │
│ NET VAT PAYABLE / (REFUNDABLE)         R [amount]   │
└──────────────────────────────────────────────────────┘
```

## Rules

1. All amounts use Dinero.js — no raw float arithmetic for VAT
2. Zero-rated ≠ exempt — they are different VAT types with different treatment
3. Input VAT only claimable on `standard` rated purchases — not `exempt`
4. VAT period is typically 2 months for SA businesses (bi-monthly cycle)
5. Report export as PDF via @react-pdf/renderer with professional formatting
6. Export as CSV for bookkeeper to verify against eFiling submission

## Output

```
## VAT Report Generated

Organisation: [org name] | VAT No: [number]
Period: [start date] – [end date]

SUMMARY:
Output VAT (standard rated):     R [amount]
Input VAT (claimable):          (R [amount])
Net VAT Payable/(Refundable):    R [amount]

Supplies breakdown:
Standard rated: R [amount]
Zero rated:     R [amount]
Exempt:         R [amount]

PDF exported: ✅ reports/vat-[period].pdf
CSV exported: ✅ reports/vat-[period].csv

Note: [Any transactions with missing VAT classification]
```
