import type { Metadata } from "next"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { InvoicesPage } from "@/components/invoices/invoices-page"

export const metadata: Metadata = { title: "Invoices" }

export default async function InvoicesListPage({
  searchParams,
}: {
  searchParams: Promise<{ organisation_id?: string }>
}) {
  const { organisation_id: defaultOrgId } = await searchParams
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

  const membershipMap: Record<string, string> = {}
  const orgIds: string[] = []
  for (const m of (memberships ?? [])) {
    membershipMap[m.organisation_id] = m.role
    orgIds.push(m.organisation_id)
  }

  const { data: orgsData } = orgIds.length
    ? await db.from("organisations").select("id, name").in("id", orgIds).order("name")
    : { data: [] }

  const orgs = (orgsData ?? []) as Array<{ id: string; name: string }>

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Invoices"
        description="Issued invoices imported from your billing system — used for accrual-basis P&L"
      />
      <InvoicesPage orgs={orgs} membershipMap={membershipMap} defaultOrgId={defaultOrgId} />
    </div>
  )
}
