import type { Metadata } from "next"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { PayrollDashboard } from "@/components/payroll/payroll-dashboard"

export const metadata: Metadata = { title: "Payroll" }

export default async function PayrollPage() {
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
    ? await db.from("organisations").select("id, name").in("id", orgIds).order("name")
    : { data: [] }

  const orgs = (orgsData ?? []) as Array<{ id: string; name: string }>

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payroll"
        description="Monthly payroll runs — SA PAYE/UIF/SDL calculations (2025/26 SARS tables)"
      />
      <PayrollDashboard orgs={orgs} />
    </div>
  )
}
