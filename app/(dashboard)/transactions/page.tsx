import type { Metadata } from "next"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { TransactionsTable } from "@/components/transactions/transactions-table"

export const metadata: Metadata = { title: "Transactions" }

const PAGE_SIZE = 100

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; status?: string; page?: string }>
}) {
  const sp = await searchParams
  const selectedStatus = sp.status ?? ""
  const page = Math.max(1, parseInt(sp.page ?? "1"))

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
  const orgId = sp.org || orgs[0]?.id || ""

  let query = db
    .from("transactions")
    .select(
      `id, date, description, debit_amount, credit_amount, vat_type, vat_amount, status, notes, is_split,
       accounts(code, name),
       bank_accounts(name)`,
      { count: "exact" }
    )
    .eq("organisation_id", orgId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (selectedStatus) query = query.eq("status", selectedStatus)

  const { data: txData, count } = await query

  const transactions = (txData ?? []) as Array<{
    id: string
    date: string
    description: string
    debit_amount: string
    credit_amount: string
    vat_type: string
    vat_amount: string
    status: string
    notes: string | null
    is_split: boolean
    accounts: { code: string; name: string } | null
    bank_accounts: { name: string } | null
  }>

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Transactions"
        description="All committed and pending transactions across bank accounts"
      />
      <TransactionsTable
        orgs={orgs}
        transactions={transactions}
        selectedOrg={orgId}
        selectedStatus={selectedStatus}
        page={page}
        totalPages={totalPages}
        totalCount={count ?? 0}
      />
    </div>
  )
}
