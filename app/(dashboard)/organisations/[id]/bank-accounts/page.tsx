import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { BankAccountForm } from "@/components/organisations/bank-account-form"
import { CreditCard } from "lucide-react"

export const metadata: Metadata = {
  title: "Bank Accounts",
}

export default async function BankAccountsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const [orgResult, accountsResult] = await Promise.all([
    db.from("organisations").select("id, name").eq("id", id).single(),
    db.from("bank_accounts").select("*").eq("organisation_id", id).order("name"),
  ])
  const org = orgResult.data as { id: string; name: string } | null
  const accounts = accountsResult.data as Array<{
    id: string
    name: string
    bank_name: string
    account_number: string | null
    account_type: string
  }> | null

  if (!org) notFound()

  return (
    <div>
      <PageHeader
        title="Bank accounts"
        description={org.name}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Existing accounts */}
        <div>
          <h2 className="text-sm font-medium mb-3">
            {accounts?.length ? `${accounts.length} account${accounts.length !== 1 ? "s" : ""}` : "No accounts yet"}
          </h2>
          <div className="space-y-2">
            {accounts?.map((account) => (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-lg border bg-card p-4"
              >
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.bank_name}
                    {account.account_number && ` • ${account.account_number}`}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize shrink-0">
                  {account.account_type}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Add account form */}
        <div className="rounded-lg border bg-card p-5">
          <h2 className="text-sm font-semibold mb-4">Add bank account</h2>
          <BankAccountForm organisationId={id} />
        </div>
      </div>
    </div>
  )
}
