"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, TrendingDown, Activity } from "lucide-react"
import { formatZAR } from "@/lib/utils"

interface Org {
  id: string
  name: string
  parent_organisation_id: string | null
}

interface MonthlyFlow {
  month: string
  cash_in: number
  cash_out: number
  net: number
}

interface CashFlowReport {
  organisation_name: string
  from_date: string
  to_date: string
  is_consolidated: boolean
  monthly: MonthlyFlow[]
  total_cash_in: number
  total_cash_out: number
  net_cash_flow: number
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

function formatMonthLabel(m: string) {
  return new Date(m + "-02").toLocaleDateString("en-ZA", { month: "short", year: "numeric" })
}

function formatMonthFull(d: string) {
  return new Date(d + "-02").toLocaleDateString("en-ZA", { month: "long", year: "numeric" })
}

export function CashFlowReport({ orgs }: Props) {
  const defaults = getDateRange("this_year")
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "")
  const [preset, setPreset] = useState("this_year")
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate] = useState(defaults.to)
  const [consolidated, setConsolidated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<CashFlowReport | null>(null)
  const [error, setError] = useState("")

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
      const res = await fetch(`/api/reports/cash-flow?${params}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to generate report"); return }
      setReport(data.data)
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  // Compute cumulative net for each month
  let cumulative = 0

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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
            Generate
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground font-medium">Total Cash In</p>
              <p className="text-lg font-semibold text-green-700 tabular-nums mt-1">
                {formatZAR(report.total_cash_in)}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground font-medium">Total Cash Out</p>
              <p className="text-lg font-semibold text-destructive tabular-nums mt-1">
                {formatZAR(report.total_cash_out)}
              </p>
            </div>
            <div className={`rounded-xl border p-4 ${report.net_cash_flow >= 0 ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-1.5">
                {report.net_cash_flow >= 0
                  ? <TrendingUp className="h-3.5 w-3.5 text-green-700" />
                  : <TrendingDown className="h-3.5 w-3.5 text-destructive" />}
                <p className="text-xs font-medium text-muted-foreground">Net Cash Flow</p>
              </div>
              <p className={`text-lg font-semibold tabular-nums mt-1 ${report.net_cash_flow >= 0 ? "text-green-700" : "text-destructive"}`}>
                {report.net_cash_flow >= 0
                  ? formatZAR(report.net_cash_flow)
                  : `(${formatZAR(Math.abs(report.net_cash_flow))})`}
              </p>
            </div>
          </div>

          {/* Monthly table */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-6 py-3 border-b bg-muted/30 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm">{report.organisation_name}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatMonthFull(report.from_date)} – {formatMonthFull(report.to_date)}
                </p>
              </div>
              {report.is_consolidated && (
                <Badge variant="outline" className="text-xs">Consolidated</Badge>
              )}
            </div>

            {report.monthly.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                No committed transactions found in this period
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="text-left px-6 py-2.5 text-xs font-medium text-muted-foreground">Month</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Cash In</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Cash Out</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Net</th>
                    <th className="text-right px-6 py-2.5 text-xs font-medium text-muted-foreground">Cumulative</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {report.monthly.map((row) => {
                    cumulative += row.net
                    return (
                      <tr key={row.month} className="hover:bg-muted/10 transition-colors">
                        <td className="px-6 py-2.5 font-medium">{formatMonthLabel(row.month)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-green-700">
                          {formatZAR(row.cash_in)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-destructive">
                          ({formatZAR(row.cash_out)})
                        </td>
                        <td className={`px-4 py-2.5 text-right tabular-nums font-medium ${row.net >= 0 ? "text-green-700" : "text-destructive"}`}>
                          {row.net >= 0 ? formatZAR(row.net) : `(${formatZAR(Math.abs(row.net))})`}
                        </td>
                        <td className={`px-6 py-2.5 text-right tabular-nums ${cumulative >= 0 ? "text-foreground" : "text-destructive"}`}>
                          {cumulative >= 0 ? formatZAR(cumulative) : `(${formatZAR(Math.abs(cumulative))})`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-6 py-3 text-sm">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm text-green-700">
                      {formatZAR(report.total_cash_in)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm text-destructive">
                      ({formatZAR(report.total_cash_out)})
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums text-sm ${report.net_cash_flow >= 0 ? "text-green-700" : "text-destructive"}`}>
                      {report.net_cash_flow >= 0
                        ? formatZAR(report.net_cash_flow)
                        : `(${formatZAR(Math.abs(report.net_cash_flow))})`}
                    </td>
                    <td className="px-6 py-3" />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="text-center py-20 text-muted-foreground">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Select an organisation and period, then click Generate</p>
        </div>
      )}
    </div>
  )
}
