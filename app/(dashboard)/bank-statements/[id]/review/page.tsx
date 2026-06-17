import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { ReviewTable } from "@/components/bank-statements/review-table"
import { ChatPanel } from "@/components/ai/chat-panel"
import { formatDate } from "@/lib/utils"
import type { SplitLeg } from "@/lib/ai/types"

export const metadata: Metadata = { title: "Review Statement" }

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerClient()) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = (await createServiceRoleClient()) as any

  const [{ data: stmtData }, { data: txData }] = await Promise.all([
    supabase
      .from("bank_statements")
      .select("id, file_name, status, statement_date_from, statement_date_to, organisation_id, bank_accounts(name, bank_name), organisations(company_type, name)")
      .eq("id", id)
      .single(),
    supabase
      .from("transactions")
      .select("id, date, description, debit_amount, credit_amount, balance, account_id, vat_type, status, reference, is_split, allocated_organisation_id")
      .eq("bank_statement_id", id)
      .order("date")
      .order("id"),
  ])

  const stmt = stmtData as {
    id: string
    file_name: string
    status: string
    statement_date_from: string | null
    statement_date_to: string | null
    organisation_id: string
    bank_accounts: { name: string; bank_name: string }
    organisations: { company_type: string; name: string }
  } | null

  if (!stmt) notFound()

  const transactions = (txData ?? []) as Array<{
    id: string
    date: string
    description: string
    debit_amount: string
    credit_amount: string
    balance: string | null
    account_id: string | null
    vat_type: string
    status: string
    reference: string | null
    is_split: boolean
    allocated_organisation_id: string | null
  }>

  // Load subsidiaries first — needed to build the full accounts query
  const txIds = transactions.map((t) => t.id)

  const { data: subsidiariesData } = await db
    .from("organisations")
    .select("id, name")
    .eq("parent_organisation_id", stmt.organisation_id)
    .order("name")

  const childOrgs = (subsidiariesData ?? []) as Array<{ id: string; name: string }>
  const allGroupOrgIds = [stmt.organisation_id, ...childOrgs.map((o) => o.id)]

  // Load accounts for the whole group + splits in parallel
  const [{ data: orgAccountsData }, { data: splitsData }] = await Promise.all([
    db
      .from("accounts")
      .select("id, code, name, type, organisation_id")
      .in("organisation_id", allGroupOrgIds)
      .eq("is_active", true)
      .order("code"),
    txIds.length
      ? db
          .from("transaction_splits")
          .select("transaction_id, organisation_id, account_id, percentage, amount, is_intercompany, organisations(name), accounts(name, code)")
          .in("transaction_id", txIds)
      : Promise.resolve({ data: [] }),
  ])

  const rawAccounts = (orgAccountsData ?? []) as Array<{
    id: string; code: string; name: string; type: string; organisation_id: string
  }>

  // Auto-seed statement org's accounts if missing
  let accounts = rawAccounts.filter((a) => a.organisation_id === stmt.organisation_id)
  if (accounts.length === 0) {
    await db.rpc("seed_default_accounts", { p_organisation_id: stmt.organisation_id })
    const { data: reseeded } = await db
      .from("accounts")
      .select("id, code, name, type, organisation_id")
      .eq("organisation_id", stmt.organisation_id)
      .eq("is_active", true)
      .order("code")
    accounts = (reseeded ?? []) as typeof accounts
  }

  // Include subsidiary accounts so the dropdown resolves UUIDs from any group org
  const subsidiaryAccounts = rawAccounts.filter((a) => a.organisation_id !== stmt.organisation_id)
  // Merge: statement org accounts first (preferred), then subsidiary accounts for any UUID not already present
  const seenIds = new Set(accounts.map((a) => a.id))
  const mergedAccounts = [
    ...accounts,
    ...subsidiaryAccounts.filter((a) => !seenIds.has(a.id)),
  ]
  // Show company column whenever the statement org has subsidiaries
  const subsidiaries = childOrgs
  const isMulti = childOrgs.length > 0

  // Build splitMap: transaction_id → SplitLeg[]
  const splitMap: Record<string, SplitLeg[]> = {}
  for (const s of (splitsData ?? []) as Array<{
    transaction_id: string
    organisation_id: string
    account_id: string | null
    percentage: number
    amount: number
    is_intercompany: boolean
    organisations: { name: string } | null
    accounts: { name: string; code: string } | null
  }>) {
    if (!splitMap[s.transaction_id]) splitMap[s.transaction_id] = []
    splitMap[s.transaction_id].push({
      organisation_id: s.organisation_id,
      organisation_name: s.organisations?.name ?? "Unknown",
      account_id: s.account_id,
      account_name: s.accounts ? `${s.accounts.code} ${s.accounts.name}` : null,
      percentage: s.percentage,
      amount: s.amount,
      is_intercompany: s.is_intercompany,
    })
  }

  const dateRange = [stmt.statement_date_from, stmt.statement_date_to]
    .filter(Boolean)
    .map((d) => formatDate(d!))
    .join(" – ")

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader
        title="Review transactions"
        description={`${stmt.organisations?.name} · ${stmt.bank_accounts?.bank_name} · ${stmt.bank_accounts?.name}${dateRange ? ` · ${dateRange}` : ""}`}
      />

      {/* Split panel: transactions left, chat right */}
      <div className="flex-1 min-h-0 flex gap-4 mt-4">
        {/* Transaction table */}
        <div className="flex-1 min-w-0 overflow-auto rounded-xl border bg-card">
          <ReviewTable
            statementId={id}
            transactions={transactions}
            accounts={mergedAccounts}
            statementStatus={stmt.status}
            splitMap={splitMap}
            isMultiCompany={isMulti}
            subsidiaries={subsidiaries}
          />
        </div>

        {/* AI chat panel */}
        <div className="w-80 xl:w-96 shrink-0 rounded-xl border bg-card overflow-hidden">
          <ChatPanel
            statementId={id}
            organisationId={stmt.organisation_id}
          />
        </div>
      </div>
    </div>
  )
}
