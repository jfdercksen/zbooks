"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Upload, Loader2, FileText, Trash2 } from "lucide-react"
import { formatZAR } from "@/lib/utils"

interface Org {
  id: string
  name: string
}

interface Invoice {
  id: string
  invoice_number: string | null
  invoice_date: string
  due_date: string | null
  billing_period: string | null
  client_name_raw: string | null
  description: string | null
  subtotal: string
  tax_amount: string
  total_amount: string
  status: string
  source: string
  clients: { id: string; name: string } | null
  accounts: { id: string; code: string; name: string } | null
}

interface Props {
  orgs: Org[]
  membershipMap: Record<string, string>
  defaultOrgId?: string
}

const STATUS_COLORS: Record<string, string> = {
  paid: "text-green-700 bg-green-50 border-green-200",
  sent: "text-blue-700 bg-blue-50 border-blue-200",
  partial: "text-amber-700 bg-amber-50 border-amber-200",
  draft: "text-gray-500 bg-gray-50 border-gray-200",
  cancelled: "text-muted-foreground bg-muted border-border",
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })
}

export function InvoicesPage({ orgs, membershipMap, defaultOrgId }: Props) {
  const [orgId, setOrgId] = useState(defaultOrgId ?? orgs[0]?.id ?? "")
  const [status, setStatus] = useState("all")
  const [loading, setLoading] = useState(false)
  const [invoices, setInvoices] = useState<Invoice[] | null>(null)
  const [error, setError] = useState("")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const canDelete = membershipMap[orgId] === "admin"

  async function load() {
    if (!orgId) return
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({ organisation_id: orgId })
      if (status !== "all") params.set("status", status)
      const res = await fetch(`/api/invoices?${params}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to load"); return }
      setInvoices(data.data)
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this invoice? This cannot be undone.")) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" })
      if (!res.ok) { alert("Delete failed"); return }
      setInvoices((prev) => prev?.filter((i) => i.id !== id) ?? null)
    } finally {
      setDeletingId(null)
    }
  }

  const totalAmount = invoices?.reduce((s, i) => s + parseFloat(i.total_amount), 0) ?? 0
  const outstanding = invoices?.filter((i) => ["sent", "partial"].includes(i.status)).reduce((s, i) => s + parseFloat(i.total_amount), 0) ?? 0

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Organisation</p>
            <Select value={orgId} onValueChange={(v) => { setOrgId(v); setInvoices(null) }}>
              <SelectTrigger className="h-8 text-sm w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Status</p>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="sent">Sent / Outstanding</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={load} disabled={loading || !orgId}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Load
          </Button>
          <div className="ml-auto">
            <Button size="sm" variant="outline" asChild>
              <Link href="/invoices/import">
                <Upload className="h-4 w-4" /> Import CSV
              </Link>
            </Button>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      {/* Summary cards */}
      {invoices && invoices.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Total Invoiced</p>
            <p className="text-lg font-semibold tabular-nums mt-1">{formatZAR(totalAmount)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Outstanding</p>
            <p className="text-lg font-semibold tabular-nums mt-1 text-amber-700">{formatZAR(outstanding)}</p>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground font-medium">Count</p>
            <p className="text-lg font-semibold tabular-nums mt-1">{invoices.length}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {invoices !== null && (
        invoices.length === 0 ? (
          <div className="rounded-xl border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
            No invoices found. Import a CSV to get started.
          </div>
        ) : (
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Period</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Invoice #</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Account</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Ex VAT</th>
                  <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Total</th>
                  <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                  {canDelete && <th className="w-10" />}
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2.5 tabular-nums text-xs text-muted-foreground">{formatDate(inv.invoice_date)}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums">{inv.billing_period ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs font-mono">{inv.invoice_number ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs">{inv.clients?.name ?? inv.client_name_raw ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{inv.accounts ? `${inv.accounts.code} ${inv.accounts.name}` : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">{formatZAR(parseFloat(inv.subtotal))}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium">{formatZAR(parseFloat(inv.total_amount))}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-xs border ${STATUS_COLORS[inv.status] ?? ""}`}>
                        {inv.status}
                      </span>
                    </td>
                    {canDelete && (
                      <td className="px-2 py-2.5">
                        <button
                          onClick={() => handleDelete(inv.id)}
                          disabled={deletingId === inv.id}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                        >
                          {deletingId === inv.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {invoices === null && !loading && (
        <div className="text-center py-20 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Select an organisation and click Load</p>
        </div>
      )}
    </div>
  )
}
