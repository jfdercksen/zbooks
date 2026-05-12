"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckCircle, AlertCircle, ChevronDown } from "lucide-react"
import { formatZAR } from "@/lib/utils"

interface Transaction {
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
}

interface Account {
  id: string
  code: string
  name: string
  type: string
}

interface Props {
  statementId: string
  transactions: Transaction[]
  accounts: Account[]
  statementStatus: string
}

const TYPE_ORDER = ["income", "expense", "asset", "liability", "equity"]
const TYPE_LABELS: Record<string, string> = {
  income: "Income",
  expense: "Expenses",
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
}

function formatDate(d: string) {
  const [y, m, day] = d.split("-")
  return `${day}/${m}/${y.slice(2)}`
}

export function ReviewTable({ statementId, transactions, accounts, statementStatus }: Props) {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Record<string, string | null>>(
    () => Object.fromEntries(transactions.map((t) => [t.id, t.account_id]))
  )
  const [vatTypes, setVatTypes] = useState<Record<string, string>>(
    () => Object.fromEntries(transactions.map((t) => [t.id, t.vat_type ?? "standard"]))
  )
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState("")

  // Group accounts by type for the dropdown
  const accountGroups = TYPE_ORDER.reduce<Record<string, Account[]>>((acc, type) => {
    acc[type] = accounts.filter((a) => a.type === type)
    return acc
  }, {})

  const handleAccountChange = useCallback(
    async (txId: string, accountId: string | null) => {
      setAssignments((prev) => ({ ...prev, [txId]: accountId }))
      setSaving((prev) => ({ ...prev, [txId]: true }))

      try {
        await fetch(`/api/transactions/${txId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            account_id: accountId,
            status: accountId ? "categorised" : "pending",
          }),
        })
      } finally {
        setSaving((prev) => ({ ...prev, [txId]: false }))
      }
    },
    []
  )

  const handleVatChange = useCallback(async (txId: string, vatType: string) => {
    setVatTypes((prev) => ({ ...prev, [txId]: vatType }))
    await fetch(`/api/transactions/${txId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vat_type: vatType }),
    })
  }, [])

  async function handleCommitAll() {
    setCommitting(true)
    setCommitError("")

    try {
      const res = await fetch(`/api/bank-statements/${statementId}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
      const json = await res.json()
      if (!res.ok) {
        setCommitError(json.error ?? "Commit failed")
        return
      }
      router.push("/bank-statements")
      router.refresh()
    } catch {
      setCommitError("Network error")
    } finally {
      setCommitting(false)
    }
  }

  const categorised = transactions.filter((t) => assignments[t.id]).length
  const total = transactions.length
  const allCategorised = categorised === total && total > 0
  const isCommitted = statementStatus === "committed"

  return (
    <div>
      {/* Summary bar */}
      <div className="flex items-center justify-between mb-4 rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-4 text-sm">
          <span>
            <strong className="tabular-nums">{categorised}</strong>
            <span className="text-muted-foreground"> / {total} categorised</span>
          </span>
          {!allCategorised && (
            <span className="text-amber-600 text-xs">
              {total - categorised} still need a category
            </span>
          )}
          {allCategorised && (
            <span className="text-green-600 flex items-center gap-1 text-xs">
              <CheckCircle className="h-3.5 w-3.5" />
              All categorised
            </span>
          )}
        </div>
        {!isCommitted && (
          <div className="flex items-center gap-3">
            {commitError && (
              <span className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                {commitError}
              </span>
            )}
            <Button
              size="sm"
              onClick={handleCommitAll}
              disabled={committing || !allCategorised}
            >
              <CheckCircle className="h-4 w-4" />
              {committing ? "Committing…" : "Commit to ledger"}
            </Button>
          </div>
        )}
        {isCommitted && (
          <Badge variant="outline" className="text-green-600 border-green-200">
            Committed to ledger
          </Badge>
        )}
      </div>

      {/* Transaction table */}
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-20">Date</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Description</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground w-28">Debit</th>
              <th className="text-right px-3 py-2.5 text-xs font-medium text-muted-foreground w-28">Credit</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-52">Account category</th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-24">VAT</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {transactions.map((tx) => {
              const assigned = assignments[tx.id]
              const selectedAccount = assigned ? accounts.find((a) => a.id === assigned) : null
              const debit = parseFloat(tx.debit_amount)
              const credit = parseFloat(tx.credit_amount)

              return (
                <tr
                  key={tx.id}
                  className={`transition-colors ${
                    assigned ? "hover:bg-muted/20" : "bg-amber-50/50 hover:bg-amber-50"
                  }`}
                >
                  <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatDate(tx.date)}
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-xs leading-snug">{tx.description}</p>
                    {tx.reference && (
                      <p className="text-xs text-muted-foreground">{tx.reference}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {debit > 0 ? (
                      <span className="text-destructive font-medium">{formatZAR(debit)}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">
                    {credit > 0 ? (
                      <span className="text-green-700 font-medium">{formatZAR(credit)}</span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {isCommitted ? (
                      <span className="text-xs text-muted-foreground">
                        {selectedAccount ? `${selectedAccount.code} ${selectedAccount.name}` : "Uncategorised"}
                      </span>
                    ) : (
                      <CategoryDropdown
                        value={assigned ?? ""}
                        accountGroups={accountGroups}
                        selectedAccount={selectedAccount ?? null}
                        isSaving={saving[tx.id] ?? false}
                        onChange={(id) => handleAccountChange(tx.id, id || null)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isCommitted ? (
                      <span className="text-xs text-muted-foreground capitalize">{vatTypes[tx.id]?.replace("_", " ")}</span>
                    ) : (
                      <select
                        value={vatTypes[tx.id] ?? "standard"}
                        onChange={(e) => handleVatChange(tx.id, e.target.value)}
                        className="text-xs border rounded px-1.5 py-1 bg-background w-full"
                      >
                        <option value="standard">15% VAT</option>
                        <option value="zero_rated">Zero rated</option>
                        <option value="exempt">Exempt</option>
                        <option value="none">No VAT</option>
                      </select>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CategoryDropdown({
  value,
  accountGroups,
  selectedAccount,
  isSaving,
  onChange,
}: {
  value: string
  accountGroups: Record<string, Account[]>
  selectedAccount: Account | null
  isSaving: boolean
  onChange: (id: string) => void
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full text-xs border rounded px-2 py-1.5 pr-6 bg-background appearance-none cursor-pointer ${
          value ? "text-foreground" : "text-amber-600 border-amber-300 bg-amber-50"
        } ${isSaving ? "opacity-50" : ""}`}
        disabled={isSaving}
      >
        <option value="">— select category —</option>
        {TYPE_ORDER.map((type) => {
          const group = accountGroups[type]
          if (!group?.length) return null
          return (
            <optgroup key={type} label={TYPE_LABELS[type] ?? type}>
              {group.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} · {acc.name}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>
      <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
    </div>
  )
}
