import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { ReviewTable } from "@/components/bank-statements/review-table"
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

  const [{ data: stmtData }, { data: txData }, { data: accountsData }] = await Promise.all([
    supabase
      .from("bank_statements")
      .select("id, file_name, status, statement_date_from, statement_date_to, organisation_id, bank_accounts(name, bank_name)")
      .eq("id", id)
      .single(),
    supabase
      .from("transactions")
      .select("id, date, description, debit_amount, credit_amount, balance, account_id, vat_type, status, reference")
      .eq("bank_statement_id", id)
      .order("date")
      .order("id"),
    supabase
      .from("accounts")
      .select("id, code, name, type")
      .eq("is_active", true)
      .order("code"),
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
  }>

  // Filter accounts to only this org — re-query with org filter
  const { data: orgAccountsData } = await supabase
    .from("accounts")
    .select("id, code, name, type")
    .eq("organisation_id", stmt.organisation_id)
    .eq("is_active", true)
    .order("code")

  const accounts = (orgAccountsData ?? accountsData ?? []) as Array<{
    id: string
    code: string
    name: string
    type: string
  }>

  const dateRange = [stmt.statement_date_from, stmt.statement_date_to]
    .filter(Boolean)
    .map((d) => formatDate(d!))
    .join(" – ")

  return (
    <div>
      <PageHeader
        title="Review transactions"
        description={`${stmt.bank_accounts?.bank_name} · ${stmt.bank_accounts?.name}${dateRange ? ` · ${dateRange}` : ""}`}
      />
      <ReviewTable
        statementId={id}
        transactions={transactions}
        accounts={accounts}
        statementStatus={stmt.status}
      />
    </div>
  )
}
