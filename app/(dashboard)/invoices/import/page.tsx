import type { Metadata } from "next"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { CSVImport } from "@/components/invoices/csv-import"

export const metadata: Metadata = { title: "Import Invoices" }

export default async function InvoiceImportPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authClient = (await createServerClient()) as any
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createServiceRoleClient()) as any

  const { data: memberships } = await db
    .from("organisation_members")
    .select("organisation_id, role")
    .eq("user_id", user.id)
    .in("role", ["admin", "editor"])

  const orgIds = (memberships ?? []).map((m: { organisation_id: string }) => m.organisation_id)

  const [orgsResult, accountsResult] = await Promise.all([
    orgIds.length
      ? db.from("organisations").select("id, name").in("id", orgIds).order("name")
      : Promise.resolve({ data: [] }),
    orgIds.length
      ? db.from("accounts").select("id, code, name, type, organisation_id").in("organisation_id", orgIds).eq("is_active", true).order("code")
      : Promise.resolve({ data: [] }),
  ])

  const orgs = (orgsResult.data ?? []) as Array<{ id: string; name: string }>
  const accounts = (accountsResult.data ?? []) as Array<{
    id: string; code: string; name: string; type: string; organisation_id: string
  }>

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Import Invoices from CSV"
        description="Upload a Vtiger, Sage, or any CSV invoice export — columns are mapped in the next step"
      />
      <CSVImport orgs={orgs} accounts={accounts} />
    </div>
  )
}
