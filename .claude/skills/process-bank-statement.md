---
name: process-bank-statement
description: Run the full bank statement PDF processing workflow for Z-Books. Fire when the user says "process bank statement", "extract PDF", "upload statement", "import bank statement", or names a specific SA bank PDF. Guides implementation of the complete extraction pipeline.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
argument-hint: organisation_id bank_account_id [pdf_file_path or "new upload"]
---

# /process-bank-statement — Z-Books PDF Extraction Workflow

Run the complete bank statement processing pipeline from PDF upload to transaction review queue.

## Live Context

Current extraction endpoint status:
!`cat app/api/bank-statements/process/route.ts 2>/dev/null | head -30`

Claude extractor status:
!`cat lib/claude/pdf-extractor.ts 2>/dev/null | head -20`

Existing bank_statements in schema:
!`grep -A5 "CREATE TABLE bank_statements" supabase/migrations/*.sql 2>/dev/null | head -20`

Recent extraction errors:
!`grep -r "FIXME\|TODO\|extraction" --include="*.ts" . 2>/dev/null | head -10`

## The Full Processing Pipeline

### Step 1 — PDF Upload
```typescript
// POST /api/bank-statements/upload
// 1. Validate: PDF only, max 10MB
// 2. Generate unique filename: {org_id}/{timestamp}_{filename}.pdf
// 3. Upload to Supabase Storage: organisation-statements bucket
// 4. Create bank_statements record with status: 'processing'
// 5. Return: { statement_id, storage_path }
```

### Step 2 — Duplicate Detection
```sql
-- Check for overlapping statement period before extraction
SELECT id FROM bank_statements
WHERE bank_account_id = $bank_account_id
  AND organisation_id = $organisation_id
  AND status = 'committed'
  AND statement_period_start <= $period_end
  AND statement_period_end >= $period_start
LIMIT 1;
```

### Step 3 — Claude API Extraction
```typescript
// POST /api/bank-statements/process
// 1. Download PDF from Supabase Storage
// 2. Upload to Anthropic Files API (process once, reference by file_id)
// 3. Send to claude-haiku-4-5 with extraction prompt
// 4. Validate JSON response with Zod
// 5. If validation fails: retry with claude-sonnet-4-5
// 6. Store extracted transactions as JSON in bank_statements.extracted_data
// 7. Update status: 'extracted'
```

### Step 4 — Auto-Suggest Categories
```typescript
// For each extracted transaction description:
// 1. Normalise: uppercase, strip amounts, strip dates
// 2. Query category_memory table for past matches
// 3. SELECT category_id, confidence FROM category_memory
//    WHERE organisation_id = $org_id
//    AND description_pattern ILIKE $normalised_description
//    ORDER BY match_count DESC LIMIT 1
// 4. Attach suggested_category_id to each extracted transaction
```

### Step 5 — Review Queue
```typescript
// The review UI shows:
// - Original PDF on the left (react-pdf viewer)
// - Extracted transactions on the right
// - Each row: date | description | debit | credit | category (dropdown)
// - Auto-suggested categories pre-selected but editable
// - "Commit All" button only enabled when all rows have a category
```

### Step 6 — Commit Transactions
```typescript
// POST /api/bank-statements/commit
// 1. Validate all rows have category assigned
// 2. Convert amounts to Dinero.js → validate precision
// 3. Insert all transactions into transactions table
// 4. Update category_memory with new pattern matches
// 5. Update bank_statements status: 'committed'
// 6. Calculate running balance for the bank account
```

## Auto-Suggest Learning Query

```sql
-- Update category memory after commit
INSERT INTO category_memory (organisation_id, description_pattern, category_id, match_count)
VALUES ($org_id, $normalised_description, $category_id, 1)
ON CONFLICT (organisation_id, description_pattern)
DO UPDATE SET 
  category_id = EXCLUDED.category_id,
  match_count = category_memory.match_count + 1,
  updated_at = NOW();
```

## Rules

1. Never auto-commit — always route through human review
2. Always store the original PDF before processing — audit trail
3. Always detect duplicates before extraction — no double imports
4. Always validate Claude response with Zod before database insert
5. Always retry with claude-sonnet-4-5 if haiku fails Zod validation
6. Always use Dinero.js for amount conversion — never raw float parsing
7. Process large PDFs page-by-page — avoid Vercel 10s timeout

## Output

```
## Bank Statement Processed

Organisation: [org name]
Bank Account: [account name]
Statement Period: [start] – [end]
PDF stored: ✅ (Supabase Storage)
Duplicate check: CLEAN | DUPLICATE DETECTED

Extraction Results:
Model used: claude-haiku-4-5 | claude-sonnet-4-5 (escalated)
Transactions extracted: [N]
Zod validation: PASS | FAIL
Auto-suggestions: [N] matched from history

Status: Ready for review at /bank-statements/[id]/review
```
