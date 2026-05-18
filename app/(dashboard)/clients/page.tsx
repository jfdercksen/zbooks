import type { Metadata } from "next"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { ClientsPage } from "@/components/clients/clients-page"

export const metadata: Metadata = { title: "Clients" }

export default async function ClientsRoute() {
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

  const membershipMap: Record<string, string> = Object.fromEntries(
    (memberships ?? []).map((m: { organisation_id: string; role: string }) => [m.organisation_id, m.role])
  )
  const orgIds = Object.keys(membershipMap)

  const [{ data: orgsData }, { data: clientsData }] = await Promise.all([
    orgIds.length
      ? db.from("organisations").select("id, name").in("id", orgIds).order("name")
      : Promise.resolve({ data: [] }),
    orgIds.length
      ? db
          .from("clients")
          .select("id, organisation_id, name, contact_name, contact_email, contact_phone, notes, is_active")
          .in("organisation_id", orgIds)
          .order("name")
      : Promise.resolve({ data: [] }),
  ])

  const orgs = (orgsData ?? []) as Array<{ id: string; name: string }>
  const clients = (clientsData ?? []) as Array<{
    id: string
    organisation_id: string
    name: string
    contact_name: string | null
    contact_email: string | null
    contact_phone: string | null
    notes: string | null
    is_active: boolean
  }>

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="External clients linked to your organisations — their costs appear as Cost of Sales"
      />
      <ClientsPage orgs={orgs} initialClients={clients} membershipMap={membershipMap} />
    </div>
  )
}
