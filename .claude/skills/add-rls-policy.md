---
name: add-rls-policy
description: Add a Row Level Security policy to an existing Supabase table in Z-Books. Fire when the user says "add RLS policy", "add row level security", "fix access control", or "restrict table access". Creates the policy in a migration file.
allowed-tools: Read, Write, Edit, Bash
argument-hint: table-name policy-type "description of access rule"
---

# /add-rls-policy — Z-Books RLS Policy Generator

Add a Row Level Security policy to an existing table.

## Live Context

Tables with RLS status:
!`npx supabase db diff --schema public 2>/dev/null | head -30`

Existing RLS policies in migrations:
!`grep -h "CREATE POLICY" supabase/migrations/*.sql 2>/dev/null`

Current timestamp:
!`date +"%Y%m%d_%H%M%S"`

## Policy Templates

### Standard Organisation-Scoped Policy (most common)
```sql
-- supabase/migrations/[timestamp]_add_rls_[table]_[policy_name].sql

-- [Policy description]
CREATE POLICY "[table]_[operation]_[description]" ON [table]
  FOR [SELECT|INSERT|UPDATE|DELETE]
  [USING|WITH CHECK] (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid()
      [AND role IN ('admin', 'editor')]  -- add role restriction if needed
    )
  );
```

### Admin-Only Policy
```sql
CREATE POLICY "[table]_admin_only" ON [table]
  FOR ALL USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
```

### Own Record Policy (user can only see/edit their own records)
```sql
CREATE POLICY "[table]_own_records" ON [table]
  FOR ALL USING (created_by = auth.uid());
```

### Audit Log — Read Only, No Delete
```sql
-- audit_log is special — users can read but NEVER delete
CREATE POLICY "audit_log_select" ON audit_log
  FOR SELECT USING (
    organisation_id IN (
      SELECT organisation_id FROM organisation_members
      WHERE user_id = auth.uid()
    )
  );
-- Note: No INSERT/UPDATE/DELETE policies — triggers write directly via SECURITY DEFINER
```

## Process

1. Identify the table and required access pattern
2. Generate timestamp
3. Create migration file with the policy SQL
4. Run `npx supabase db push`
5. Verify with test query

## Verification Query

```sql
-- Check all policies on a table
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = '[table_name]';
```

## Rules

1. Every policy must be in a migration file — never via Supabase dashboard
2. Policy names must be unique and descriptive: `[table]_[operation]_[description]`
3. SELECT policies use `USING` — INSERT uses `WITH CHECK` — UPDATE uses both
4. Never create a DELETE policy on `audit_log`
5. Always test the policy works from the user's perspective after applying

## Output

```
## RLS Policy Added

Migration: supabase/migrations/[timestamp]_add_rls_[table]_[name].sql
Table: [table_name]
Policy: [policy_name]
Operation: [SELECT|INSERT|UPDATE|DELETE]
Access rule: [plain English description]

Verify:
SELECT policyname FROM pg_policies WHERE tablename = '[table_name]';
```
