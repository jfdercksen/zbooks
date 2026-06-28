import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { DeleteOrgButton } from "@/components/organisations/delete-org-button"
import { ParentOrgSelector } from "@/components/organisations/parent-org-selector"
import { AccountsTable } from "@/components/organisations/accounts-table"

export const metadata: Metadata = {
  title: "Chart of Accounts",
}

type AccountRow = {
  id: string
  code: string
  name: string
  type: "income" | "expense" | "asset" | "liability" | "equity"
  vat_type: "standard" | "zero_rated" | "exempt" | "none"
  is_active: boolean
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const serviceDb = (await createServiceRoleClient()) as any

  const [orgResult, accountsResult, { data: { user } }] = await Promise.all([
    db.from("organisations")
      .select("id, name, registration_number, vat_number, financial_year_start, parent_organisation_id")
      .eq("id", id)
      .single(),
    db.from("accounts")
      .select("id, code, name, type, vat_type, is_active")
      .eq("organisation_id", id)
      .order("code"),
    supabase.auth.getUser(),
  ])

  const org = orgResult.data as {
    id: string
    name: string
    registration_number: string | null
    vat_number: string | null
    financial_year_start: number
    parent_organisation_id: string | null
  } | null
  const accounts = accountsResult.data as AccountRow[] | null

  // Load all other orgs this user belongs to for the parent selector
  // Exclude this org and any orgs that already have this org as their parent (prevents circularity)
  const { data: memberOrgs } = user
    ? await serviceDb
        .from("organisation_members")
        .select("organisation_id, organisations(id, name, parent_organisation_id)")
        .eq("user_id", user.id)
    : { data: null }

  const allUserOrgs = (memberOrgs ?? [])
    .map((m: { organisations: { id: string; name: string; parent_organisation_id: string | null } }) => m.organisations)
    .filter(Boolean) as Array<{ id: string; name: string; parent_organisation_id: string | null }>

  // Can be a parent: not itself, not already a child of this org
  const availableParents = allUserOrgs.filter(
    (o) => o.id !== id && o.parent_organisation_id !== id
  )

  if (!org) notFound()

  return (
    <div>
      <PageHeader
        title="Chart of accounts"
        description={org.name}
      />

      {/* Org details */}
      <div className="mt-6 rounded-lg border bg-card p-5 grid gap-2 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Organisation</p>
          <p className="font-medium">{org.name}</p>
        </div>
        {org.registration_number && (
          <div>
            <p className="text-xs text-muted-foreground">Registration</p>
            <p className="font-medium">{org.registration_number}</p>
          </div>
        )}
        {org.vat_number && (
          <div>
            <p className="text-xs text-muted-foreground">VAT number</p>
            <p className="font-medium">{org.vat_number}</p>
          </div>
        )}
      </div>

      {/* Group structure */}
      <div className="mt-6 rounded-lg border bg-card p-5">
        <h2 className="text-sm font-semibold mb-1">Group structure</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Set a holding company to group this organisation under it. The holding company consolidates all subsidiaries in reports and the AI agent.
        </p>
        <ParentOrgSelector
          orgId={org.id}
          currentParentId={org.parent_organisation_id}
          availableParents={availableParents.map((o) => ({ id: o.id, name: o.name }))}
        />
      </div>

      {/* Chart of accounts */}
      <AccountsTable
        orgId={id}
        initialAccounts={(accounts ?? []) as Array<{
          id: string; code: string; name: string
          type: "income" | "expense" | "asset" | "liability" | "equity"
          vat_type: "standard" | "zero_rated" | "exempt" | "none"
          is_active: boolean
        }>}
      />

      {/* Danger zone */}
      <div className="mt-10 rounded-lg border border-destructive/30 p-5">
        <h2 className="text-sm font-semibold text-destructive mb-1">Danger zone</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Permanently delete this organisation and all its data. This cannot be undone.
        </p>
        <DeleteOrgButton orgId={org.id} orgName={org.name} />
      </div>
    </div>
  )
}
