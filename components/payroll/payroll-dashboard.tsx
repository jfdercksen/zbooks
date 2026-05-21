"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, Users, CheckCircle } from "lucide-react"
import { formatZAR } from "@/lib/utils"
import Link from "next/link"

interface Org { id: string; name: string }

interface PayrollRun {
  id: string
  period_month: number
  period_year: number
  total_gross: string
  total_paye: string
  total_net: string
  status: string
  created_at: string
}

interface Props { orgs: Org[] }

const MONTH_NAMES = ["January","February","March","April","May","June",
  "July","August","September","October","November","December"]

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  )
}

export function PayrollDashboard({ orgs }: Props) {
  const now = new Date()
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "")
  const [runs, setRuns] = useState<PayrollRun[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [finalising, setFinalising] = useState<string | null>(null)
  const [runError, setRunError] = useState("")
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())

  const loadRuns = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/payroll/runs?organisation_id=${orgId}`)
      const data = await res.json()
      if (res.ok) setRuns(data.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { loadRuns() }, [loadRuns])

  async function handleCreateRun() {
    if (!orgId) return
    setCreating(true)
    setRunError("")
    try {
      const res = await fetch("/api/payroll/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organisation_id: orgId, period_month: month, period_year: year }),
      })
      const data = await res.json()
      if (!res.ok) { setRunError(data.error ?? "Failed to create run"); return }
      await loadRuns()
    } finally {
      setCreating(false)
    }
  }

  async function handleFinalise(runId: string) {
    setFinalising(runId)
    setRunError("")
    try {
      const res = await fetch(`/api/payroll/runs/${runId}/finalise`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) { setRunError(data.error ?? "Failed to finalise"); return }
      await loadRuns()
    } finally {
      setFinalising(null)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i)

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Organisation</p>
            <Select value={orgId} onValueChange={(v) => { setOrgId(v); setRuns([]) }}>
              <SelectTrigger className="h-8 text-sm w-52">
                <SelectValue placeholder="Select organisation" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Month</p>
            <Select value={String(month)} onValueChange={(v) => setMonth(parseInt(v))}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">Year</p>
            <Select value={String(year)} onValueChange={(v) => setYear(parseInt(v))}>
              <SelectTrigger className="h-8 text-sm w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Button size="sm" onClick={handleCreateRun} disabled={!orgId || creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Run payroll
          </Button>

          <Link href="/payroll/employees">
            <Button size="sm" variant="outline">
              <Users className="h-4 w-4" /> Manage employees
            </Button>
          </Link>
        </div>
        {runError && <p className="text-xs text-destructive">{runError}</p>}
      </div>

      {/* Runs list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No payroll runs yet</p>
          <p className="text-xs mt-1">Select a period and click &ldquo;Run payroll&rdquo; to calculate PAYE, UIF and SDL</p>
        </div>
      ) : (
        runs.map((run) => {
          const gross = parseFloat(run.total_gross)
          const paye = parseFloat(run.total_paye)
          const net = parseFloat(run.total_net)
          const isFinalised = run.status === "finalised"
          return (
            <div key={run.id} className="rounded-xl border bg-card overflow-hidden">
              <div className="px-5 py-3 border-b bg-muted/30 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm">
                    {MONTH_NAMES[run.period_month - 1]} {run.period_year}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(run.created_at).toLocaleDateString("en-ZA")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={isFinalised ? "text-green-700 border-green-200" : "text-amber-700 border-amber-200"}
                  >
                    {isFinalised ? "Finalised" : "Draft"}
                  </Badge>
                  {!isFinalised && (
                    <Button
                      size="sm"
                      onClick={() => handleFinalise(run.id)}
                      disabled={finalising === run.id}
                    >
                      {finalising === run.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <CheckCircle className="h-4 w-4" />}
                      Post to ledger
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-3">
                <StatCard label="Gross payroll" value={formatZAR(gross)} />
                <StatCard label="PAYE (SARS)" value={formatZAR(paye)} sub="Withheld from employees" />
                <StatCard label="Net pay" value={formatZAR(net)} sub="Paid to employees" />
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
