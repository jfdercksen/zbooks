---
name: generate-financial-report
description: Generate a P&L or Cash Flow financial report for a Z-Books organisation. Fire when the user says "P&L", "profit and loss", "income statement", "cash flow", "financial report", "generate report", or "month end report".
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: organisation_id report_type[profit-loss|cash-flow] period_start period_end
---

# /generate-financial-report — Z-Books Financial Report Generator

Generate Profit & Loss or Cash Flow statements with PDF export.

## Live Context

Report API routes:
!`find app/api/reports -name "route.ts" | sort`

Financial calculations:
!`cat lib/financial/calculations.ts 2>/dev/null | head -30`

Report components:
!`find components/reports -name "*.tsx" 2>/dev/null | sort`

## Profit & Loss Statement

### P&L SQL Query
```sql
-- Income (credits to income accounts)
SELECT 
  ca.name as category,
  ca.account_code,
  SUM(t.credit_amount - t.debit_amount) as net_amount
FROM transactions t
JOIN chart_of_accounts ca ON t.category_id = ca.id
WHERE t.organisation_id = $org_id
  AND t.date >= $period_start
  AND t.date <= $period_end
  AND ca.account_type = 'income'
GROUP BY ca.name, ca.account_code
ORDER BY ca.account_code;

-- Expenses (debits to expense accounts)
SELECT 
  ca.name as category,
  ca.account_code,
  SUM(t.debit_amount - t.credit_amount) as net_amount
FROM transactions t
JOIN chart_of_accounts ca ON t.category_id = ca.id
WHERE t.organisation_id = $org_id
  AND t.date >= $period_start
  AND t.date <= $period_end
  AND ca.account_type = 'expense'
GROUP BY ca.name, ca.account_code
ORDER BY ca.account_code;
```

### P&L Report Format
```
┌──────────────────────────────────────────────────────────┐
│ PROFIT & LOSS STATEMENT                                  │
│ [Company Name]                                           │
│ For the period: [start date] to [end date]              │
├──────────────────────────────────────────────────────────┤
│ INCOME                             Current    Prior Year │
│   [Income Category 1]              R x,xxx    R x,xxx   │
│   [Income Category 2]              R x,xxx    R x,xxx   │
│ TOTAL INCOME                       R X,XXX    R X,XXX   │
├──────────────────────────────────────────────────────────┤
│ EXPENSES                                                 │
│   [Expense Category 1]             R x,xxx    R x,xxx   │
│   [Expense Category 2]             R x,xxx    R x,xxx   │
│ TOTAL EXPENSES                     R X,XXX    R X,XXX   │
├──────────────────────────────────────────────────────────┤
│ NET PROFIT / (LOSS)                R X,XXX    R X,XXX   │
└──────────────────────────────────────────────────────────┘
```

## Cash Flow Statement (Indirect Method)

### Cash Flow Format
```
┌──────────────────────────────────────────────────────────┐
│ CASH FLOW STATEMENT                                      │
│ [Company Name]                                           │
│ For the period: [start date] to [end date]              │
├──────────────────────────────────────────────────────────┤
│ OPERATING ACTIVITIES                                     │
│   Net profit / (loss)              R x,xxx              │
│   Adjustments:                                          │
│     Add: Depreciation              R x,xxx              │
│ Net cash from operations           R X,XXX              │
├──────────────────────────────────────────────────────────┤
│ INVESTING ACTIVITIES                                     │
│   Purchase of assets              (R x,xxx)             │
│ Net cash from investing           (R X,XXX)             │
├──────────────────────────────────────────────────────────┤
│ FINANCING ACTIVITIES                                     │
│   Loan repayments                 (R x,xxx)             │
│ Net cash from financing           (R X,XXX)             │
├──────────────────────────────────────────────────────────┤
│ NET CHANGE IN CASH                 R X,XXX              │
│ Opening cash balance               R X,XXX              │
│ CLOSING CASH BALANCE               R X,XXX              │
└──────────────────────────────────────────────────────────┘
```

## Monthly Trend Data (for Recharts)

```typescript
// For dashboard P&L trend chart
const monthlyData = [
  { month: 'Jan 2025', income: 45000, expenses: 32000, profit: 13000 },
  { month: 'Feb 2025', income: 52000, expenses: 35000, profit: 17000 },
  // ...
]
```

## Rules

1. All amounts use Dinero.js for calculation — never raw number arithmetic
2. Negative amounts displayed in parentheses `(R 5,000.00)` in reports — not with minus sign
3. Prior year column included on P&L — query same period from previous year
4. PDF export uses @react-pdf/renderer with professional layout
5. CSV export for accountant verification
6. Report generation is read-only — never modifies transactions

## Output

```
## Financial Report Generated

Organisation: [org name]
Report: Profit & Loss | Cash Flow
Period: [start] – [end]

SUMMARY:
Total Income:    R [amount]
Total Expenses:  R [amount]
Net Profit/(Loss): R [amount]

Prior Year Comparison: ✅ | ⚠️ No prior year data
Monthly trend data: ✅ (12 months)

PDF exported: ✅ reports/pl-[period].pdf
CSV exported: ✅ reports/pl-[period].csv
```
