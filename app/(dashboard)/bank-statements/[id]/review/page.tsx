import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { ReviewTable } from "@/components/bank-statements/review-table"
import { ChatPanel } from "@/components/ai/chat-panel"
import { formatDate } from "@/lib/utils"

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
      .select("id, file_name, status, statement_date_from, statement_date_to, organisation_id, bank_accounts(name, bank_name)")
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

  // Load accounts for the statement's org
  const { data: orgAccountsData } = await db
    .from("accounts")
    .select("id, code, name, type")
    .eq("organisation_id", stmt.organisation_id)
    .eq("is_active", true)
    .order("code")

  const accounts = (orgAccountsData ?? []) as Array<{
    id: string
    code: string
    name: string
    type: string
  }>

  // Load subsidiary orgs for the split UI
  const { data: subsidiaries } = await db
    .from("organisations")
    .select("id, name")
    .eq("parent_organisation_id", stmt.organisation_id)

  const dateRange = [stmt.statement_date_from, stmt.statement_date_to]
    .filter(Boolean)
    .map((d) => formatDate(d!))
    .join(" – ")

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <PageHeader
        title="Review transactions"
        description={`${stmt.bank_accounts?.bank_name} · ${stmt.bank_accounts?.name}${dateRange ? ` · ${dateRange}` : ""}`}
      />

      {/* Split panel: transactions left, chat right */}
      <div className="flex-1 min-h-0 flex gap-4 mt-4">
        {/* Transaction table — takes remaining width */}
        <div className="flex-1 min-w-0 overflow-auto rounded-xl border bg-card">
          <ReviewTable
            statementId={id}
            transactions={transactions}
            accounts={accounts}
            statementStatus={stmt.status}
          />
        </div>

        {/* AI chat panel — fixed width sidebar */}
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
