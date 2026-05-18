"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, BarChart3, TrendingUp, TrendingDown } from "lucide-react"
import { formatZAR } from "@/lib/utils"

interface Org {
  id: string
  name: string
  parent_organisation_id: string | null
}

interface PLRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  total: number
}

interface PLReport {
  organisation_name: string
  from_date: string
  to_date: string
  is_consolidated: boolean
  subsidiary_count: number
  revenue: PLRow[]
  expenses: PLRow[]
  total_revenue: number
  total_expenses: number
  net_profit: number
}

interface Props {
  orgs: Org[]
}

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const pad = (n: number) => String(n).padStart(2, "0")
  switch (preset) {
    case "this_year": return { from: `${y}-01-01`, to: `${y}-12-31` }
    case "last_year": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    case "this_month": {
      const last = new Date(y, m, 0).getDate()
      return { from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${last}` }
    }
    case "last_month": {
      const lmY = m === 1 ? y - 1 : y
      const lm = m === 1 ? 12 : m - 1
      const last = new Date(lmY, lm, 0).getDate()
      return { from: `${lmY}-${pad(lm)}-01`, to: `${lmY}-${pad(lm)}-${last}` }
    }
    default: return { from: `${y}-01-01`, to: `${y}-12-31` }
  }
}

const DATE_PRESETS = [
  { label: "This year", value: "this_year" },
  { label: "Last year", value: "last_year" },
  { label: "This month", value: "this_month" },
  { label: "Last month", value: "last_month" },
  { label: "Custom", value: "custom" },
]

function formatMonth(d: string) {
  return new Date(d + "-02").toLocaleDateString("en-ZA", { month: "long", year: "numeric" })
}

export function PLReport({ orgs }: Props) {
  const defaults = getDateRange("this_year")
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "")
  const [preset, setPreset] = useState("this_year")
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)
  const [consolidated, setConsolidated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<PLReport | null>(null)
  const [error, setError] = useState("")

  const selectedOrg = orgs.find((o) => o.id === orgId)
  const isHolding = orgs.some((o) => o.parent_organisation_id === orgId)

  function handlePresetChange(value: string) {
    setPreset(value)
    if (value !== "custom") {
      const range = getDateRange(value)
      setFromDate(range.from)
      setToDate(range.to)
    }
  }

  function handleOrgChange(value: string) {
    setOrgId(value)
    setConsolidated(false)
    setReport(null)
  }

  async function generate() {
    if (!orgId || !fromDate || !toDate) return
    setLoading(true)
    setError("")
    setReport(null)
    try {
      const params = new URLSearchParams({
        organisation_id: orgId,
        from_date: fromDate,
        to_date: toDate,
        consolidated: String(consolidated),
      })
      const res = await fetch(`/api/reports/profit-loss?${params}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to generate report"); return }
      setReport(data.data)
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Organisation</p>
            <Select value={orgId} onValueChange={handleOrgChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Select organisation" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Period</p>
            <Select value={preset} onValueChange={handlePresetChange}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {preset === "custom" && (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">From</p>
                <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                  className="w-full h-8 text-sm border rounded-md px-2.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground font-medium">To</p>
                <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                  className="w-full h-8 text-sm border rounded-md px-2.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {isHolding && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={consolidated} onChange={(e) => setConsolidated(e.target.checked)}
                className="rounded" />
              <span>Consolidated (includes all subsidiaries)</span>
            </label>
          )}
          <Button size="sm" onClick={generate} disabled={!orgId || !fromDate || !toDate || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
            Generate
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="space-y-0 rounded-xl border bg-card overflow-hidden">
          {/* Report header */}
          <div className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-base">{report.organisation_name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatMonth(report.from_date)} – {formatMonth(report.to_date)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {report.is_consolidated && (
                  <Badge variant="outline" className="text-xs">
                    {report.subsidiary_count} subsidiar{report.subsidiary_count === 1 ? "y" : "ies"}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={report.net_profit >= 0 ? "text-green-700 border-green-200" : "text-destructive border-destructive/20"}
                >
                  {report.net_profit >= 0 ? "Profitable" : "Loss"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Revenue */}
          <div>
            <div className="px-6 py-2 bg-green-50/50 border-b">
              <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Revenue</p>
            </div>
            {report.revenue.length === 0 ? (
              <div className="px-6 py-3 text-sm text-muted-foreground italic">No revenue transactions in this period</div>
            ) : (
              report.revenue.map((row) => (
                <div key={row.account_id} className="flex items-center justify-between px-6 py-2.5 border-b hover:bg-muted/10 transition-colors">
                  <span className="text-sm">
                    <span className="text-xs text-muted-foreground mr-2">{row.account_code}</span>
                    {row.account_name}
                  </span>
                  <span className="tabular-nums text-sm font-medium text-green-700">
                    {formatZAR(row.total)}
                  </span>
                </div>
              ))
            )}
            <div className="flex items-center justify-between px-6 py-3 border-b bg-green-50/30">
              <span className="text-sm font-semibold">Total Revenue</span>
              <span className="tabular-nums text-sm font-semibold text-green-700">
                {formatZAR(report.total_revenue)}
              </span>
            </div>
          </div>

          {/* Expenses */}
          <div>
            <div className="px-6 py-2 bg-red-50/50 border-b">
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">Expenses</p>
            </div>
            {report.expenses.length === 0 ? (
              <div className="px-6 py-3 text-sm text-muted-foreground italic">No expense transactions in this period</div>
            ) : (
              report.expenses.map((row) => (
                <div key={row.account_id} className="flex items-center justify-between px-6 py-2.5 border-b hover:bg-muted/10 transition-colors">
                  <span className="text-sm">
                    <span className="text-xs text-muted-foreground mr-2">{row.account_code}</span>
                    {row.account_name}
                  </span>
                  <span className="tabular-nums text-sm font-medium text-destructive">
                    ({formatZAR(row.total)})
                  </span>
                </div>
              ))
            )}
            <div className="flex items-center justify-between px-6 py-3 border-b bg-red-50/30">
              <span className="text-sm font-semibold">Total Expenses</span>
              <span className="tabular-nums text-sm font-semibold text-destructive">
                ({formatZAR(report.total_expenses)})
              </span>
            </div>
          </div>

          {/* Net Profit */}
          <div className={`flex items-center justify-between px-6 py-4 ${report.net_profit >= 0 ? "bg-green-50" : "bg-red-50"}`}>
            <div className="flex items-center gap-2">
              {report.net_profit >= 0
                ? <TrendingUp className="h-4 w-4 text-green-700" />
                : <TrendingDown className="h-4 w-4 text-destructive" />}
              <span className="font-bold text-sm">
                {report.net_profit >= 0 ? "Net Profit" : "Net Loss"}
              </span>
            </div>
            <span className={`tabular-nums font-bold text-base ${report.net_profit >= 0 ? "text-green-700" : "text-destructive"}`}>
              {report.net_profit >= 0 ? formatZAR(report.net_profit) : `(${formatZAR(Math.abs(report.net_profit))})`}
            </span>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="text-center py-20 text-muted-foreground">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Select an organisation and period, then click Generate</p>
        </div>
      )}
    </div>
  )
}
