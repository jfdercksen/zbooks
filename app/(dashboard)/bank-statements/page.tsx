import type { Metadata } from "next"
import Link from "next/link"
import { createServerClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { BankStatementUpload } from "@/components/bank-statements/upload-zone"
import { FileText, Plus } from "lucide-react"
import { formatDate } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Bank Statements",
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "secondary",
  processing: "secondary",
  review: "default",
  committed: "outline",
  failed: "destructive",
}

export default async function BankStatementsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerClient()) as any

  const { data: orgsData } = await supabase
    .from("organisations")
    .select("id, name")
    .order("name")
  const orgs = (orgsData ?? []) as Array<{ id: string; name: string }>

  const { data: statementsData } = await supabase
    .from("bank_statements")
    .select(`
      id, file_name, status, statement_date_from, statement_date_to, created_at,
      organisations(name),
      bank_accounts(name, bank_name)
    `)
    .order("created_at", { ascending: false })
    .limit(50)
  const statements = (statementsData ?? []) as Array<{
    id: string
    file_name: string
    status: string
    statement_date_from: string | null
    statement_date_to: string | null
    created_at: string
    organisations: { name: string }
    bank_accounts: { name: string; bank_name: string }
  }>

  const { data: bankAccountsData } = await supabase
    .from("bank_accounts")
    .select("id, name, bank_name, organisation_id")
    .order("name")
  const bankAccounts = (bankAccountsData ?? []) as Array<{
    id: string
    name: string
    bank_name: string
    organisation_id: string
  }>

  return (
    <div>
      <PageHeader
        title="Bank Statements"
        description="Upload PDF statements — Claude will extract and categorise each transaction"
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Upload form */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Plus className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Upload new statement</h2>
          </div>
          {orgs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              <Link href="/organisations/new" className="text-primary hover:underline">Create an organisation</Link> first.
            </p>
          ) : bankAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Add a bank account to an organisation first.
            </p>
          ) : (
            <BankStatementUpload orgs={orgs} bankAccounts={bankAccounts} />
          )}
        </div>

        {/* Recent statements */}
        <div>
          <h2 className="text-sm font-semibold mb-3">
            {statements.length > 0 ? `${statements.length} statement${statements.length !== 1 ? "s" : ""}` : "No statements yet"}
          </h2>
          <div className="space-y-2">
            {statements.map((stmt) => (
              <div key={stmt.id} className="rounded-lg border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{stmt.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {stmt.organisations?.name} · {stmt.bank_accounts?.name}
                      </p>
                      {stmt.statement_date_from && (
                        <p className="text-xs text-muted-foreground">
                          {formatDate(stmt.statement_date_from)}
                          {stmt.statement_date_to && ` – ${formatDate(stmt.statement_date_to)}`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Badge variant={STATUS_VARIANT[stmt.status] ?? "outline"} className="capitalize text-xs">
                      {stmt.status}
                    </Badge>
                    {stmt.status === "review" && (
                      <Link
                        href={`/bank-statements/${stmt.id}/review`}
                        className="text-xs text-primary hover:underline"
                      >
                        Review →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
