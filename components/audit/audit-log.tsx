"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react"

interface Org { id: string; name: string }

interface LogEntry {
  id: string
  table_name: string
  record_id: string
  action: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  user_id: string | null
}

interface Props {
  orgs: Org[]
  logs: LogEntry[]
  selectedOrg: string
  selectedTable: string
  page: number
  totalPages: number
  totalCount: number
}

const ACTION_COLORS: Record<string, string> = {
  INSERT: "text-green-700 border-green-200 bg-green-50",
  UPDATE: "text-blue-700 border-blue-200 bg-blue-50",
  DELETE: "text-destructive border-destructive/20 bg-red-50",
}

const TABLE_LABELS: Record<string, string> = {
  transactions: "Transactions",
  bank_statements: "Bank Statements",
  organisations: "Organisations",
  accounts: "Accounts",
  employees: "Employees",
  payroll_runs: "Payroll Runs",
  payroll_entries: "Payroll Entries",
  invoices: "Invoices",
  clients: "Clients",
  bank_accounts: "Bank Accounts",
}

const WATCHED_TABLES = Object.keys(TABLE_LABELS)

function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function DiffCell({ label, value }: { label: string; value: unknown }) {
  const str = value === null || value === undefined ? "—" : String(value)
  return (
    <span className="inline-flex flex-col">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="truncate max-w-[180px]" title={str}>{str}</span>
    </span>
  )
}

function ChangeSummary({ action, oldData, newData }: {
  action: string
  oldData: Record<string, unknown> | null
  newData: Record<string, unknown> | null
}) {
  if (action === "INSERT" && newData) {
    // Show a few key fields from the new record
    const keys = ["description", "name", "amount", "date", "status"].filter((k) => k in newData)
    if (!keys.length) return <span className="text-xs text-muted-foreground">New record created</span>
    return (
      <div className="flex flex-wrap gap-3 text-xs">
        {keys.slice(0, 3).map((k) => <DiffCell key={k} label={k} value={newData[k]} />)}
      </div>
    )
  }

  if (action === "DELETE" && oldData) {
    const keys = ["description", "name", "amount", "date", "status"].filter((k) => k in oldData)
    if (!keys.length) return <span className="text-xs text-muted-foreground">Record deleted</span>
    return (
      <div className="flex flex-wrap gap-3 text-xs">
        {keys.slice(0, 3).map((k) => <DiffCell key={k} label={k} value={oldData[k]} />)}
      </div>
    )
  }

  if (action === "UPDATE" && oldData && newData) {
    const changed = Object.keys(newData).filter(
      (k) => !["updated_at"].includes(k) && JSON.stringify(newData[k]) !== JSON.stringify(oldData[k])
    )
    if (!changed.length) return <span className="text-xs text-muted-foreground">No field changes detected</span>
    return (
      <div className="flex flex-wrap gap-4 text-xs">
        {changed.slice(0, 4).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">{k}:</span>
            <span className="line-through text-muted-foreground truncate max-w-[80px]" title={String(oldData[k])}>
              {String(oldData[k] ?? "—")}
            </span>
            <span>→</span>
            <span className="truncate max-w-[80px]" title={String(newData[k])}>
              {String(newData[k] ?? "—")}
            </span>
          </span>
        ))}
        {changed.length > 4 && (
          <span className="text-muted-foreground">+{changed.length - 4} more</span>
        )}
      </div>
    )
  }

  return null
}

export function AuditLog({ orgs, logs, selectedOrg, selectedTable, page, totalPages, totalCount }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v); else sp.delete(k)
    }
    router.push(`/audit?${sp.toString()}`)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 flex items-center gap-3 flex-wrap">
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
          <p className="text-xs text-muted-foreground font-medium">Table</p>
          <select
            value={selectedTable}
            onChange={(e) => navigate({ table: e.target.value, page: "1" })}
            className="h-8 text-sm border rounded-md px-2.5 bg-background"
          >
            <option value="">All tables</option>
            {WATCHED_TABLES.map((t) => (
              <option key={t} value={t}>{TABLE_LABELS[t] ?? t}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto text-xs text-muted-foreground">
          {totalCount.toLocaleString()} entries
        </div>
      </div>

      {/* Log entries */}
      {logs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ScrollText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No audit entries yet</p>
          <p className="text-xs mt-1">Changes to transactions, accounts, and other records will appear here</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-40">Timestamp</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-28">Action</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-36">Table</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {formatTs(log.created_at)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant="outline" className={`text-xs ${ACTION_COLORS[log.action] ?? ""}`}>
                      {log.action}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs font-medium">
                    {TABLE_LABELS[log.table_name] ?? log.table_name}
                  </td>
                  <td className="px-4 py-2.5">
                    <ChangeSummary action={log.action} oldData={log.old_data} newData={log.new_data} />
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
            Page {page} of {totalPages}
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
