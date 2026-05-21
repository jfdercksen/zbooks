import type { Metadata } from "next"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { VatReport } from "@/components/reports/vat-report"

export const metadata: Metadata = { title: "VAT Report" }

export default async function VatReportPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authClient = (await createServerClient()) as any
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createServiceRoleClient()) as any

  const { data: memberships } = await db
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)

  const orgIds = (memberships ?? []).map((m: { organisation_id: string }) => m.organisation_id)

  const { data: orgsData } = orgIds.length
    ? await db
        .from("organisations")
        .select("id, name, parent_organisation_id")
        .in("id", orgIds)
        .order("name")
    : { data: [] }

  const orgs = (orgsData ?? []) as Array<{
    id: string
    name: string
    parent_organisation_id: string | null
  }>

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="VAT Report"
        description="VAT201 — output tax, input tax and net VAT payable to SARS"
      />
      <VatReport orgs={orgs} />
    </div>
  )
}
