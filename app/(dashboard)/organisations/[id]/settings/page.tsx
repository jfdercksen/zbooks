import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"

export const metadata: Metadata = {
  title: "Chart of Accounts",
}

type AccountRow = {
  id: string
  code: string
  name: string
  type: "income" | "expense" | "asset" | "liability" | "equity"
  vat_type: "standard" | "zero_rated" | "exempt" | "none"
  is_active: boolean
}

const TYPE_ORDER: AccountRow["type"][] = ["income", "expense", "asset", "liability", "equity"]

const TYPE_LABELS: Record<AccountRow["type"], string> = {
  income: "Income",
  expense: "Expenses",
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
}

const VAT_LABELS: Record<AccountRow["vat_type"], string> = {
  standard: "Standard 15%",
  zero_rated: "Zero Rated",
  exempt: "Exempt",
  none: "N/A",
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const [orgResult, accountsResult] = await Promise.all([
    db.from("organisations")
      .select("id, name, registration_number, vat_number, financial_year_start")
      .eq("id", id)
      .single(),
    db.from("accounts")
      .select("id, code, name, type, vat_type, is_active")
      .eq("organisation_id", id)
      .order("code"),
  ])
  const org = orgResult.data as {
    id: string
    name: string
    registration_number: string | null
    vat_number: string | null
    financial_year_start: number
  } | null
  const accounts = accountsResult.data as AccountRow[] | null

  if (!org) notFound()

  const grouped = TYPE_ORDER.reduce<Record<string, AccountRow[]>>((acc, type) => {
    acc[type] = (accounts ?? []).filter((a) => a.type === type)
    return acc
  }, {} as Record<string, AccountRow[]>)

  return (
    <div>
      <PageHeader
        title="Chart of accounts"
        description={org.name}
      />

      {/* Org details */}
      <div className="mt-6 rounded-lg border bg-card p-5 grid gap-2 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Organisation</p>
          <p className="font-medium">{org.name}</p>
        </div>
        {org.registration_number && (
          <div>
            <p className="text-xs text-muted-foreground">Registration</p>
            <p className="font-medium">{org.registration_number}</p>
          </div>
        )}
        {org.vat_number && (
          <div>
            <p className="text-xs text-muted-foreground">VAT number</p>
            <p className="font-medium">{org.vat_number}</p>
          </div>
        )}
      </div>

      {/* Chart of accounts */}
      <div className="mt-6 space-y-6">
        {TYPE_ORDER.map((type) => {
          const rows = grouped[type]
          if (!rows?.length) return null
          return (
            <div key={type}>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Badge
                  variant={type as AccountRow["type"]}
                  className="capitalize"
                >
                  {TYPE_LABELS[type]}
                </Badge>
                <span className="text-muted-foreground font-normal">{rows.length} accounts</span>
              </h2>
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-20">Code</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Account name</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell">VAT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((account) => (
                      <tr
                        key={account.id}
                        className={`hover:bg-muted/30 transition-colors ${!account.is_active ? "opacity-50" : ""}`}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{account.code}</td>
                        <td className="px-4 py-2.5 font-medium">{account.name}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                          {VAT_LABELS[account.vat_type]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        {!accounts?.length && (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            No accounts found. The default chart of accounts should have been created automatically.
          </div>
        )}
      </div>
    </div>
  )
}
