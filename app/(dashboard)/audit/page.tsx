import type { Metadata } from "next"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { AuditLog } from "@/components/audit/audit-log"

export const metadata: Metadata = { title: "Audit Trail" }

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; table?: string; page?: string }>
}) {
  const sp = await searchParams
  const selectedOrg = sp.org ?? ""
  const selectedTable = sp.table ?? ""
  const page = parseInt(sp.page ?? "1")
  const PAGE_SIZE = 50

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

  // Default to first org
  const orgId = selectedOrg || orgs[0]?.id || ""

  let query = db
    .from("audit_log")
    .select("id, table_name, record_id, action, old_data, new_data, created_at, user_id", { count: "exact" })
    .eq("organisation_id", orgId)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (selectedTable) query = query.eq("table_name", selectedTable)

  const { data: logsData, count } = await query

  const logs = (logsData ?? []) as Array<{
    id: string
    table_name: string
    record_id: string
    action: string
    old_data: Record<string, unknown> | null
    new_data: Record<string, unknown> | null
    created_at: string
    user_id: string | null
  }>

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit Trail"
        description="Immutable record of all changes — INSERT, UPDATE and DELETE operations"
      />
      <AuditLog
        orgs={orgs}
        logs={logs}
        selectedOrg={orgId}
        selectedTable={selectedTable}
        page={page}
        totalPages={totalPages}
        totalCount={count ?? 0}
      />
    </div>
  )
}
