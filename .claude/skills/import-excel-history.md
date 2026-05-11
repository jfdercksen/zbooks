---
name: import-excel-history
description: Run the Excel historical data import workflow for Z-Books. Fire when the user says "import excel", "historical data", "import spreadsheet", "load historical entries", or "import old data". This is a one-time setup operation per organisation.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: organisation_id excel_file_path
---

# /import-excel-history — Z-Books Excel Import Workflow

Import historical financial data from Excel into a Z-Books organisation. This is a one-time setup operation.

## Live Context

Excel importer status:
!`cat lib/excel/importer.ts 2>/dev/null | head -30`

Import API route:
!`cat app/api/import/excel/route.ts 2>/dev/null | head -20`

Import UI:
!`cat app/\(dashboard\)/organisations/\[id\]/import/page.tsx 2>/dev/null | head -20`

## Expected Excel Format

The Excel file has two expected sheets:

### Sheet 1 — Company Setup
| Column | Required | Example |
|---|---|---|
| Company Name | Yes | Z-Group (Pty) Ltd |
| Registration No | No | 2020/123456/07 |
| VAT Number | No | 4123456789 |
| Financial Year Start | Yes | 2025-03-01 |
| Financial Year End | Yes | 2026-02-28 |

### Sheet 2 — Historical Transactions
| Column | Required | Example |
|---|---|---|
| Date | Yes | 2024-01-15 or 15/01/2024 |
| Description | Yes | SHELL SUNNINGHILL |
| Debit | No | 450.00 |
| Credit | No | |
| Category | No | Fuel |
| Bank Account | No | FNB Cheque |
| Balance | No | 12345.67 |

## Import Process

### Step 1 — Upload and Parse
```typescript
// lib/excel/importer.ts
import * as XLSX from 'xlsx'

export function parseExcelFile(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { 
    type: 'array',
    cellDates: true,  // Parse dates as Date objects
    dense: true
  })
  
  const companySheet = workbook.Sheets[workbook.SheetNames[0]]
  const transactionSheet = workbook.Sheets[workbook.SheetNames[1]]
  
  return {
    company: XLSX.utils.sheet_to_json(companySheet, { header: 1 }),
    transactions: XLSX.utils.sheet_to_json(transactionSheet, { defval: null })
  }
}
```

### Step 2 — Column Mapping UI
The import page shows a preview table and lets the bookkeeper map Excel columns to Z-Books fields:
- Excel Column A → Date
- Excel Column B → Description
- Excel Column C → Debit Amount
- Excel Column D → Credit Amount
- Excel Column E → Category (optional — will need manual categorisation if missing)

### Step 3 — Validation
```typescript
import { z } from 'zod'

const TransactionRowSchema = z.object({
  date: z.coerce.date(),
  description: z.string().min(1),
  debit: z.number().nonnegative().nullable(),
  credit: z.number().nonnegative().nullable(),
  category: z.string().optional()
}).refine(
  row => row.debit !== null || row.credit !== null,
  "Each row must have either a debit or credit amount"
)
```

### Step 4 — Preview and Confirm
- Show first 20 rows with mapped columns
- Show validation errors (rows that failed parsing)
- Show category mapping (matched to chart of accounts)
- "Confirm Import" button — only enabled if < 10% validation failures

### Step 5 — Bulk Insert
```typescript
// Use Supabase batch insert for performance
// Insert in chunks of 500 rows to avoid timeout
const CHUNK_SIZE = 500

for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
  const chunk = transactions.slice(i, i + CHUNK_SIZE)
  await supabase.from('transactions').insert(chunk)
}
```

### Step 6 — Mark Import Complete
```sql
UPDATE organisations 
SET historical_import_complete = true,
    historical_import_date = NOW()
WHERE id = $organisation_id;
```

## Rules

1. This is a one-time operation — check `historical_import_complete` before allowing re-import
2. Show a column-mapper UI — never assume column positions
3. Handle date formats: `DD/MM/YYYY`, `YYYY-MM-DD`, `DD Mon YYYY`, Excel date serial numbers
4. Handle encoding: UTF-8 and Windows-1252 (SA bank exports)
5. Validate with Zod before inserting — show user which rows failed
6. Insert in chunks of 500 — never a single massive insert
7. Imported historical transactions are marked with `source: 'excel_import'`

## Output

```
## Excel Import Complete

Organisation: [org name]
File processed: [filename]

Company Setup:
- Name: ✅ found
- VAT No: ✅ / ⚠️ not found
- Financial Year: ✅ set

Historical Transactions:
Total rows in file: [N]
Valid rows: [N]
Failed rows: [N] (see validation report)
Categories auto-matched: [N]
Categories needing assignment: [N]

All imported transactions marked: source='excel_import'
Status: Import complete | Review needed for [N] uncategorised transactions
```
