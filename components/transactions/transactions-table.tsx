"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, List } from "lucide-react"

interface Org { id: string; name: string }

interface Transaction {
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
}

interface Props {
  orgs: Org[]
  transactions: Transaction[]
  selectedOrg: string
  selectedStatus: string
  page: number
  totalPages: number
  totalCount: number
}

const STATUS_STYLE: Record<string, string> = {
  committed:   "text-green-700 border-green-200 bg-green-50",
  categorised: "text-blue-700 border-blue-200 bg-blue-50",
  pending:     "text-amber-700 border-amber-200 bg-amber-50",
}

const VAT_LABEL: Record<string, string> = {
  standard:  "15%",
  zero_rated: "0%",
  exempt:    "Exempt",
  none:      "—",
}

function fmt(val: string) {
  const n = parseFloat(val)
  if (!n) return ""
  return `R ${n.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function TransactionsTable({
  orgs, transactions, selectedOrg, selectedStatus, page, totalPages, totalCount,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v); else sp.delete(k)
    }
    router.push(`/transactions?${sp.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 flex items-center gap-4 flex-wrap">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Organisation</p>
          <select
            value={selectedOrg}
            onChange={(e) => navigate({ org: e.target.value, page: "1" })}
            className="h-8 text-sm border rounded-md px-2.5 bg-background"
          >
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Status</p>
          <select
            value={selectedStatus}
            onChange={(e) => navigate({ status: e.target.value, page: "1" })}
            className="h-8 text-sm border rounded-md px-2.5 bg-background"
          >
            <option value="">All</option>
            <option value="committed">Committed</option>
            <option value="categorised">Categorised</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          {totalCount.toLocaleString()} transactions
        </div>
      </div>

      {/* Table */}
      {transactions.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <List className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No transactions found</p>
          <p className="text-xs mt-1">Import historical data or process a bank statement to get started</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-28">Date</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-40">Account</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground w-32">Debit</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground w-32">Credit</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-20">VAT</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-28">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {transactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {tx.date}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm">{tx.description}</span>
                      {tx.is_split && (
                        <span className="text-[10px] bg-purple-100 text-purple-700 border border-purple-200 rounded px-1">
                          SPLIT
                        </span>
                      )}
                    </div>
                    {tx.notes && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs" title={tx.notes}>
                        {tx.notes}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {tx.accounts
                      ? <span>{tx.accounts.code} · {tx.accounts.name}</span>
                      : <span className="italic">Uncategorised</span>
                    }
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm font-medium text-red-600">
                    {fmt(tx.debit_amount)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-sm font-medium text-green-600">
                    {fmt(tx.credit_amount)}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {VAT_LABEL[tx.vat_type] ?? tx.vat_type}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" className={`text-xs ${STATUS_STYLE[tx.status] ?? ""}`}>
                      {tx.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} · showing {((page - 1) * 100) + 1}–{Math.min(page * 100, totalCount)} of {totalCount.toLocaleString()}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1}
              onClick={() => navigate({ page: String(page - 1) })}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages}
              onClick={() => navigate({ page: String(page + 1) })}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
