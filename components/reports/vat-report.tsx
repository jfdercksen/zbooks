"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Loader2, Receipt } from "lucide-react"
import { formatZAR } from "@/lib/utils"

interface Org {
  id: string
  name: string
  parent_organisation_id: string | null
}

interface VatBucket {
  gross: number
  vat: number
  nett: number
}

interface VatReport {
  organisation_name: string
  from_date: string
  to_date: string
  is_consolidated: boolean
  output: {
    standard: VatBucket
    zero_rated: VatBucket
    exempt: VatBucket
  }
  input: {
    standard: VatBucket
  }
  total_output_vat: number
  total_input_vat: number
  net_vat_payable: number
}

interface Props {
  orgs: Org[]
}

// SA VAT periods: Jan/Feb, Mar/Apr, May/Jun, Jul/Aug, Sep/Oct, Nov/Dec
function getVatPeriods(): Array<{ label: string; from: string; to: string }> {
  const now = new Date()
  const y = now.getFullYear()
  const pairs = [
    ["01", "02"], ["03", "04"], ["05", "06"],
    ["07", "08"], ["09", "10"], ["11", "12"],
  ]
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  return pairs.map(([s, e]) => {
    const lastDay = new Date(y, parseInt(e), 0).getDate()
    return {
      label: `${months[parseInt(s) - 1]}/${months[parseInt(e) - 1]} ${y}`,
      from: `${y}-${s}-01`,
      to: `${y}-${e}-${String(lastDay).padStart(2, "0")}`,
    }
  })
}

function getDateRange(preset: string): { from: string; to: string } {
  const now = new Date()
  const y = now.getFullYear()
  switch (preset) {
    case "this_year": return { from: `${y}-01-01`, to: `${y}-12-31` }
    case "last_year": return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` }
    default: {
      // VAT period preset: format "YYYY-MM/YYYY-MM"
      const periods = getVatPeriods()
      const p = periods.find((vp) => vp.label === preset)
      if (p) return { from: p.from, to: p.to }
      return { from: `${y}-01-01`, to: `${y}-12-31` }
    }
  }
}

function VatRow({
  label,
  value,
  bold,
  indent,
  highlight,
}: {
  label: string
  value: string
  bold?: boolean
  indent?: boolean
  highlight?: "green" | "red" | "amber"
}) {
  const colors: Record<string, string> = {
    green: "text-green-700",
    red: "text-destructive",
    amber: "text-amber-700",
  }
  return (
    <div className={`flex items-center justify-between px-6 py-2.5 border-b ${highlight ? "" : "hover:bg-muted/10"} transition-colors`}>
      <span className={`text-sm ${indent ? "pl-4" : ""} ${bold ? "font-semibold" : ""}`}>{label}</span>
      <span className={`tabular-nums text-sm ${bold ? "font-semibold" : ""} ${highlight ? colors[highlight] : ""}`}>{value}</span>
    </div>
  )
}

export function VatReport({ orgs }: Props) {
  const vatPeriods = getVatPeriods()

  // Default to the most recent completed VAT period
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const defaultPeriod = vatPeriods.find((p) => {
    const endMonth = parseInt(p.to.substring(5, 7))
    return endMonth < currentMonth
  }) ?? vatPeriods[0]

  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "")
  const [preset, setPreset] = useState(defaultPeriod.label)
  const [fromDate, setFromDate] = useState(defaultPeriod.from)
  const [toDate, setToDate] = useState(defaultPeriod.to)
  const [consolidated, setConsolidated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<VatReport | null>(null)
  const [error, setError] = useState("")

  const isHolding = orgs.some((o) => o.parent_organisation_id === orgId)

  const DATE_PRESETS = [
    ...vatPeriods.map((p) => ({ label: p.label, value: p.label })),
    { label: "This year", value: "this_year" },
    { label: "Last year", value: "last_year" },
    { label: "Custom", value: "custom" },
  ]

  function handlePresetChange(value: string) {
    setPreset(value)
    if (value !== "custom") {
      const range = getDateRange(value)
      setFromDate(range.from)
      setToDate(range.to)
    }
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
      const res = await fetch(`/api/reports/vat?${params}`)
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
            <Select value={orgId} onValueChange={(v) => { setOrgId(v); setReport(null) }}>
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
            <p className="text-xs text-muted-foreground font-medium">VAT period</p>
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            Generate
          </Button>
          {error && <span className="text-sm text-destructive">{error}</span>}
        </div>
      </div>

      {/* Report */}
      {report && (
        <div className="rounded-xl border bg-card overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b bg-muted/30">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold text-base">{report.organisation_name}</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  VAT201 — {report.from_date} to {report.to_date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {report.is_consolidated && (
                  <Badge variant="outline" className="text-xs">Consolidated</Badge>
                )}
                <Badge
                  variant="outline"
                  className={report.net_vat_payable >= 0 ? "text-amber-700 border-amber-200" : "text-green-700 border-green-200"}
                >
                  {report.net_vat_payable >= 0 ? "VAT Payable" : "VAT Refund"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Output Tax */}
          <div>
            <div className="px-6 py-2 bg-blue-50/50 border-b">
              <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">Output Tax (Sales)</p>
            </div>

            {/* Standard rated */}
            <div className="px-6 py-2 border-b bg-muted/10">
              <p className="text-xs font-medium text-muted-foreground">Standard rated supplies (15%)</p>
            </div>
            <VatRow label="Gross sales (incl. VAT)" value={formatZAR(report.output.standard.gross)} indent />
            <VatRow label="Less: VAT portion (15/115)" value={`(${formatZAR(report.output.standard.vat)})`} indent />
            <VatRow label="Nett sales (excl. VAT)" value={formatZAR(report.output.standard.nett)} indent />

            {/* Zero rated */}
            {report.output.zero_rated.gross > 0 && (
              <>
                <div className="px-6 py-2 border-b bg-muted/10">
                  <p className="text-xs font-medium text-muted-foreground">Zero rated supplies (0%)</p>
                </div>
                <VatRow label="Zero rated sales" value={formatZAR(report.output.zero_rated.gross)} indent />
              </>
            )}

            {/* Exempt */}
            {report.output.exempt.gross > 0 && (
              <>
                <div className="px-6 py-2 border-b bg-muted/10">
                  <p className="text-xs font-medium text-muted-foreground">Exempt supplies</p>
                </div>
                <VatRow label="Exempt sales" value={formatZAR(report.output.exempt.gross)} indent />
              </>
            )}

            <div className="flex items-center justify-between px-6 py-3 border-b bg-blue-50/30">
              <span className="text-sm font-semibold">Total Output VAT (Box 6)</span>
              <span className="tabular-nums text-sm font-semibold text-blue-700">
                {formatZAR(report.total_output_vat)}
              </span>
            </div>
          </div>

          {/* Input Tax */}
          <div>
            <div className="px-6 py-2 bg-purple-50/50 border-b">
              <p className="text-xs font-semibold text-purple-800 uppercase tracking-wide">Input Tax (Purchases)</p>
            </div>

            <div className="px-6 py-2 border-b bg-muted/10">
              <p className="text-xs font-medium text-muted-foreground">Standard rated purchases (15%)</p>
            </div>
            <VatRow label="Gross purchases (incl. VAT)" value={formatZAR(report.input.standard.gross)} indent />
            <VatRow label="Less: VAT portion (15/115)" value={`(${formatZAR(report.input.standard.vat)})`} indent />
            <VatRow label="Nett purchases (excl. VAT)" value={formatZAR(report.input.standard.nett)} indent />

            <div className="flex items-center justify-between px-6 py-3 border-b bg-purple-50/30">
              <span className="text-sm font-semibold">Total Input VAT (Box 5)</span>
              <span className="tabular-nums text-sm font-semibold text-purple-700">
                {formatZAR(report.total_input_vat)}
              </span>
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="px-6 py-2 bg-muted/50 border-b">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">VAT Summary</p>
            </div>
            <VatRow label="Output VAT (Box 6)" value={formatZAR(report.total_output_vat)} />
            <VatRow label="Less: Input VAT (Box 5)" value={`(${formatZAR(report.total_input_vat)})`} />

            <div className={`flex items-center justify-between px-6 py-4 ${report.net_vat_payable >= 0 ? "bg-amber-50" : "bg-green-50"}`}>
              <span className="font-bold text-sm">
                {report.net_vat_payable >= 0 ? "Net VAT Payable to SARS" : "Net VAT Refund from SARS"}
              </span>
              <span className={`tabular-nums font-bold text-base ${report.net_vat_payable >= 0 ? "text-amber-700" : "text-green-700"}`}>
                {formatZAR(Math.abs(report.net_vat_payable))}
              </span>
            </div>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="text-center py-20 text-muted-foreground">
          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Select an organisation and VAT period, then click Generate</p>
          <p className="text-xs mt-1">SA VAT periods: Jan/Feb · Mar/Apr · May/Jun · Jul/Aug · Sep/Oct · Nov/Dec</p>
        </div>
      )}
    </div>
  )
}
