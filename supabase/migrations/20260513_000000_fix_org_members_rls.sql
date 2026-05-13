-- Fix infinite recursion in organisation_members RLS policies
-- The SELECT policy queries organisation_members inside its own USING clause,
-- causing PostgreSQL to detect infinite recursion.
-- Solution: create a SECURITY DEFINER function that bypasses RLS.

-- 1. Create helper function that runs with elevated privileges
CREATE OR REPLACE FUNCTION public.org_member_of(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organisation_members
    WHERE organisation_id = _org_id AND user_id = _user_id
  )
$$;

-- Grant execute to public so policies can call it
GRANT EXECUTE ON FUNCTION public.org_member_of(uuid, uuid) TO anon, authenticated, service_role;

-- 2. Drop existing organisation_members policies
DROP POLICY IF EXISTS "organisation_members_select" ON organisation_members;
DROP POLICY IF EXISTS "organisation_members_insert" ON organisation_members;
DROP POLICY IF EXISTS "organisation_members_update" ON organisation_members;
DROP POLICY IF EXISTS "organisation_members_delete" ON organisation_members;

-- 3. Recreate without recursion
CREATE POLICY "organisation_members_select" ON organisation_members
  FOR SELECT USING (
    org_member_of(organisation_id, auth.uid())
  );

CREATE POLICY "organisation_members_insert" ON organisation_members
  FOR INSERT WITH CHECK (
    -- Allow if inserting own record (e.g. creating org)
    user_id = auth.uid()
    OR
    -- Or if already a member of the org
    org_member_of(organisation_id, auth.uid())
  );

CREATE POLICY "organisation_members_update" ON organisation_members
  FOR UPDATE USING (
    org_member_of(organisation_id, auth.uid())
  );

CREATE POLICY "organisation_members_delete" ON organisation_members
  FOR DELETE USING (
    org_member_of(organisation_id, auth.uid())
  );

-- 4. Also fix organisations table policies that have the same recursion issue
DROP POLICY IF EXISTS "organisations_select" ON organisations;
DROP POLICY IF EXISTS "organisations_insert" ON organisations;
DROP POLICY IF EXISTS "organisations_update" ON organisations;
DROP POLICY IF EXISTS "organisations_delete" ON organisations;

CREATE POLICY "organisations_select" ON organisations
  FOR SELECT USING (
    org_member_of(id, auth.uid())
  );

CREATE POLICY "organisations_insert" ON organisations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "organisations_update" ON organisations
  FOR UPDATE USING (
    org_member_of(id, auth.uid())
  );

CREATE POLICY "organisations_delete" ON organisations
  FOR DELETE USING (
    org_member_of(id, auth.uid())
  );
