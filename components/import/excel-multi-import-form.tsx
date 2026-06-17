"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle, AlertCircle, FileSpreadsheet,
  Loader2, SkipForward, ChevronRight, List, BarChart3,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Org { id: string; name: string }

interface Sheet { name: string; company: string }

type SheetStatus = "pending" | "importing" | "done" | "skipped" | "error"

interface SheetMapping {
  sheetName: string
  companyName: string
  matchedOrgId: string
  status: SheetStatus
  result?: { imported: number; rows: number; newAccountsCreated: number; rulesCreated: number; company: string }
  errorMessage?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

function matchOrg(sheetCompany: string, sheetName: string, orgs: Org[]): string {
  const normSheet = normalize(sheetCompany || sheetName)

  // Try substring match in both directions
  for (const org of orgs) {
    const normOrg = normalize(org.name)
    if (normOrg.includes(normSheet) || normSheet.includes(normOrg)) return org.id
  }

  // Try first-token match
  const sheetToken = normSheet.substring(0, Math.min(normSheet.length, 6))
  for (const org of orgs) {
    const orgToken = normalize(org.name).substring(0, Math.min(normalize(org.name).length, 6))
    if (sheetToken === orgToken) return org.id
  }

  return orgs[0]?.id ?? ""
}

const STATUS_BADGE: Record<SheetStatus, { label: string; className: string }> = {
  pending:   { label: "Ready",      className: "text-muted-foreground border-muted-foreground/30" },
  importing: { label: "Importing…", className: "text-blue-700 border-blue-200 bg-blue-50" },
  done:      { label: "Done",       className: "text-green-700 border-green-200 bg-green-50" },
  skipped:   { label: "Skipped",    className: "text-muted-foreground/50 border-muted-foreground/20" },
  error:     { label: "Error",      className: "text-destructive border-destructive/20 bg-red-50" },
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ExcelMultiImportForm({ orgs }: { orgs: Org[] }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [mappings, setMappings] = useState<SheetMapping[] | null>(null)
  const [pageStatus, setPageStatus] = useState<"idle" | "loading" | "mapping" | "importing" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  // ── File selected ─────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setMappings(null)
    setPageStatus("loading")
    setErrorMsg("")

    const fd = new FormData()
    fd.append("file", f)
    fd.append("action", "list")

    try {
      const res = await fetch("/api/import/excel", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) { setPageStatus("error"); setErrorMsg(json.error); return }

      const sheets = json.data.sheets as Sheet[]
      const initial: SheetMapping[] = sheets.map((s) => ({
        sheetName: s.name,
        companyName: s.company,
        matchedOrgId: matchOrg(s.company, s.name, orgs),
        status: "pending",
      }))
      setMappings(initial)
      setPageStatus("mapping")
    } catch {
      setPageStatus("error")
      setErrorMsg("Failed to read file")
    }
  }

  function setOrgForSheet(sheetName: string, orgId: string) {
    setMappings(prev => prev?.map(m =>
      m.sheetName === sheetName ? { ...m, matchedOrgId: orgId } : m
    ) ?? null)
  }

  function toggleSkip(sheetName: string) {
    setMappings(prev => prev?.map(m => {
      if (m.sheetName !== sheetName) return m
      return { ...m, status: m.status === "skipped" ? "pending" : "skipped" }
    }) ?? null)
  }

  // ── Import all ────────────────────────────────────────────────────────────
  async function handleImportAll() {
    if (!file || !mappings) return
    setPageStatus("importing")

    const toImport = mappings.filter(m => m.status !== "skipped" && m.matchedOrgId)

    for (const mapping of toImport) {
      setMappings(prev => prev?.map(m =>
        m.sheetName === mapping.sheetName ? { ...m, status: "importing" } : m
      ) ?? null)

      try {
        const fd = new FormData()
        fd.append("file", file)
        fd.append("organisation_id", mapping.matchedOrgId)
        fd.append("sheet_name", mapping.sheetName)
        fd.append("action", "import")

        const res = await fetch("/api/import/excel", { method: "POST", body: fd })
        const json = await res.json()

        if (!res.ok) {
          setMappings(prev => prev?.map(m =>
            m.sheetName === mapping.sheetName ? { ...m, status: "error", errorMessage: json.error } : m
          ) ?? null)
        } else {
          setMappings(prev => prev?.map(m =>
            m.sheetName === mapping.sheetName ? { ...m, status: "done", result: json.data } : m
          ) ?? null)
        }
      } catch {
        setMappings(prev => prev?.map(m =>
          m.sheetName === mapping.sheetName ? { ...m, status: "error", errorMessage: "Network error" } : m
        ) ?? null)
      }
    }

    setPageStatus("done")
  }

  // ─── Idle / upload ────────────────────────────────────────────────────────
  if (pageStatus === "idle" || pageStatus === "error") {
    return (
      <div className="space-y-4 max-w-2xl">
        <div className="rounded-lg bg-muted/50 border p-4 text-sm text-muted-foreground">
          Upload your <strong className="text-foreground">Accounts2026.xlsx</strong> file. Each sheet
          represents a company — the system will auto-match each sheet to one of your organisations
          and import all of them in a single pass.
        </div>

        <label className="flex items-center gap-4 rounded-lg border-2 border-dashed p-6 cursor-pointer hover:border-primary/50 transition-colors max-w-md">
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">{file ? file.name : "Click to select your Excel file"}</p>
            <p className="text-xs text-muted-foreground mt-0.5">.xlsx files only</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        {pageStatus === "error" && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMsg}
          </div>
        )}
      </div>
    )
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (pageStatus === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" />
        Reading sheets…
      </div>
    )
  }

  // ─── Mapping + importing + done ───────────────────────────────────────────
  if (!mappings) return null

  const activeCount = mappings.filter(m => m.status !== "skipped").length
  const doneCount   = mappings.filter(m => m.status === "done").length
  const errorCount  = mappings.filter(m => m.status === "error").length
  const isRunning   = pageStatus === "importing"

  const totalImported = mappings.reduce((s, m) => s + (m.result?.imported ?? 0), 0)
  const totalNew      = mappings.reduce((s, m) => s + (m.result?.newAccountsCreated ?? 0), 0)

  return (
    <div className="space-y-5 max-w-4xl">

      {/* File + progress header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm font-medium">{file?.name}</span>
          <span className="text-xs text-muted-foreground">· {mappings.length} sheets</span>
        </div>
        {pageStatus === "done" && (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700 font-medium">
              {doneCount} imported · {totalImported.toLocaleString()} transactions
              {totalNew > 0 && ` · ${totalNew} new accounts`}
            </span>
          </div>
        )}
      </div>

      {/* Sheet → org mapping table */}
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Sheet</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Detected company</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-56">Import into</th>
              <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-28">Status</th>
              <th className="px-4 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {mappings.map((m) => (
              <tr
                key={m.sheetName}
                className={`transition-colors ${m.status === "skipped" ? "opacity-40" : "hover:bg-muted/20"}`}
              >
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{m.sheetName}</td>
                <td className="px-4 py-2.5 font-medium text-sm">{m.companyName}</td>
                <td className="px-4 py-2.5">
                  <select
                    value={m.matchedOrgId}
                    disabled={isRunning || m.status === "done" || m.status === "skipped"}
                    onChange={(e) => setOrgForSheet(m.sheetName, e.target.value)}
                    className="h-7 text-xs border rounded px-2 bg-background w-full disabled:opacity-50"
                  >
                    {orgs.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  {m.status === "importing" ? (
                    <div className="flex items-center gap-1.5 text-xs text-blue-700">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Importing…
                    </div>
                  ) : m.status === "done" && m.result ? (
                    <div className="text-xs text-green-700 space-y-0.5">
                      <div className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {m.result.imported.toLocaleString()} transactions
                      </div>
                      {m.result.newAccountsCreated > 0 && (
                        <div className="text-[10px] text-green-600">+{m.result.newAccountsCreated} new accounts</div>
                      )}
                    </div>
                  ) : m.status === "error" ? (
                    <div className="flex items-center gap-1 text-xs text-destructive" title={m.errorMessage}>
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {m.errorMessage ?? "Error"}
                    </div>
                  ) : (
                    <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE[m.status].className}`}>
                      {STATUS_BADGE[m.status].label}
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-2.5">
                  {!isRunning && m.status !== "done" && (
                    <button
                      onClick={() => toggleSkip(m.sheetName)}
                      title={m.status === "skipped" ? "Include this sheet" : "Skip this sheet"}
                      className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {pageStatus === "mapping" && (
        <div className="flex items-center gap-3">
          <Button onClick={handleImportAll} disabled={activeCount === 0}>
            <ChevronRight className="h-4 w-4" />
            Import {activeCount} {activeCount === 1 ? "sheet" : "sheets"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setPageStatus("idle")
              setFile(null)
              setMappings(null)
              if (fileRef.current) fileRef.current.value = ""
            }}
          >
            Cancel
          </Button>
          <p className="text-xs text-muted-foreground">
            Click <SkipForward className="h-3 w-3 inline" /> on any row to exclude it from the import.
          </p>
        </div>
      )}

      {pageStatus === "done" && (
        <div className="space-y-3">
          {errorCount > 0 && (
            <p className="text-sm text-destructive">{errorCount} sheet{errorCount > 1 ? "s" : ""} failed — check the errors above.</p>
          )}
          {totalImported > 0 && (
            <div className="rounded-lg border bg-green-50 border-green-200 p-4">
              <p className="text-sm font-semibold text-green-900 mb-2">Your historical data is now in the app — view it here:</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/transactions" className="inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-50 transition-colors">
                  <List className="h-3.5 w-3.5" />
                  Transactions ledger
                </Link>
                <Link href="/reports/profit-loss" className="inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-50 transition-colors">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Profit &amp; Loss report
                </Link>
              </div>
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => {
              setPageStatus("idle")
              setFile(null)
              setMappings(null)
              if (fileRef.current) fileRef.current.value = ""
            }}
          >
            Import another file
          </Button>
        </div>
      )}
    </div>
  )
}
