"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet, Sparkles, GitBranch } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Sheet {
  name: string
  company: string
}

interface PreviewRow {
  label: string
  suggestedAccountCode: string
  accountType: string
  vatType: string
  needsNewAccount: boolean
  allocationNote?: "half" | "full"
  amounts: Record<number, number>
}

interface AllocationRule {
  descriptionPattern: string
  note: "half" | "full"
}

interface ParsedData {
  companyName: string
  rows: PreviewRow[]
  months: number[]
  year: number
  allocationRules: AllocationRule[]
}

interface ImportResult {
  imported: number
  rows: number
  newAccountsCreated: number
  rulesCreated: number
  year: number
  company: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const SECTION_LABELS: Record<string, { label: string; colour: string }> = {
  income:    { label: "Income",         colour: "text-green-700 bg-green-50 border-green-200"   },
  expense:   { label: "Expense",        colour: "text-red-700 bg-red-50 border-red-200"         },
  asset:     { label: "Asset",          colour: "text-blue-700 bg-blue-50 border-blue-200"      },
  liability: { label: "Liability",      colour: "text-orange-700 bg-orange-50 border-orange-200"},
  equity:    { label: "Equity/Drawing", colour: "text-purple-700 bg-purple-50 border-purple-200"},
}

const CODE_LABELS: Record<string, string> = {
  "4000": "Sales Revenue",   "4001": "Service Income",
  "5000": "Cost of Sales",   "5100": "Salaries & Wages",
  "5101": "PAYE",            "5102": "UIF",             "5103": "SDL",
  "5200": "Rent",            "5201": "Electricity/Water",
  "5202": "Telephone/Internet", "5203": "Office Supplies",
  "5300": "Fuel & Motor",    "5400": "Advertising",
  "5500": "Bank Charges",    "5501": "Interest",
  "5600": "Professional Fees","5601": "Accounting",
  "5700": "Insurance",       "5800": "Repairs",
  "5999": "Miscellaneous",   "2400": "Loan",
  "2000": "Accounts Payable","3200": "Drawings",        "1500": "Fixed Assets",
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  organisationId: string
  organisationName: string
}

export function ExcelImportForm({ organisationId, organisationName }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<Sheet[] | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedData | null>(null)
  const [namedSupplierCount, setNamedSupplierCount] = useState(0)
  const [allocationRuleCount, setAllocationRuleCount] = useState(0)
  const [status, setStatus] = useState<"idle" | "loading" | "previewing" | "importing" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // ── File selected → list sheets ──────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setSheets(null); setSelectedSheet(null); setPreview(null)
    setStatus("loading"); setMessage("")

    const fd = new FormData()
    fd.append("file", f)
    fd.append("organisation_id", organisationId)
    fd.append("action", "list")

    try {
      const res = await fetch("/api/import/excel", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) { setStatus("error"); setMessage(json.error); return }
      setSheets(json.data.sheets)
      setStatus("idle")
      // Auto-select best matching sheet
      const first = json.data.sheets[0]?.name ?? null
      const match = json.data.sheets.find((s: Sheet) =>
        s.company.toLowerCase().includes(organisationName.toLowerCase().split(" ")[0].toLowerCase()) ||
        organisationName.toLowerCase().includes(s.company.toLowerCase().split(" ")[0].toLowerCase())
      )
      setSelectedSheet(match?.name ?? first)
    } catch {
      setStatus("error"); setMessage("Failed to read file")
    }
  }

  // ── Preview ──────────────────────────────────────────────────────────────
  async function handlePreview() {
    if (!file || !selectedSheet) return
    setStatus("loading"); setPreview(null)

    const fd = new FormData()
    fd.append("file", file)
    fd.append("organisation_id", organisationId)
    fd.append("sheet_name", selectedSheet)
    fd.append("action", "preview")

    try {
      const res = await fetch("/api/import/excel", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) { setStatus("error"); setMessage(json.error); return }
      setPreview(json.data.parsed)
      setNamedSupplierCount(json.data.namedSupplierCount ?? 0)
      setAllocationRuleCount(json.data.allocationRuleCount ?? 0)
      setStatus("previewing")
    } catch {
      setStatus("error"); setMessage("Failed to preview")
    }
  }

  // ── Import ───────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!file || !selectedSheet) return
    setStatus("importing")

    const fd = new FormData()
    fd.append("file", file)
    fd.append("organisation_id", organisationId)
    fd.append("sheet_name", selectedSheet)
    fd.append("action", "import")

    try {
      const res = await fetch("/api/import/excel", { method: "POST", body: fd })
      const json = await res.json()
      if (!res.ok) { setStatus("error"); setMessage(json.error); return }
      setImportResult(json.data)
      setStatus("done")
    } catch {
      setStatus("error"); setMessage("Import failed")
    }
  }

  const isLoading = status === "loading" || status === "importing"

  // ── Done state ───────────────────────────────────────────────────────────
  if (status === "done" && importResult) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 max-w-xl">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="h-6 w-6 text-green-600 shrink-0" />
          <h3 className="font-semibold text-green-900">Import complete — {importResult.company} ({importResult.year})</h3>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <Stat label="Transactions imported" value={importResult.imported} />
          <Stat label="Account lines processed" value={importResult.rows} />
          {importResult.newAccountsCreated > 0 && (
            <Stat label="New supplier accounts created" value={importResult.newAccountsCreated} highlight />
          )}
          {importResult.rulesCreated > 0 && (
            <Stat label="Allocation rules seeded" value={importResult.rulesCreated} highlight />
          )}
        </div>
        {importResult.newAccountsCreated > 0 && (
          <p className="text-xs text-green-700 mb-2">
            Named supplier accounts (afrihost, microsoft, etc.) were automatically created in your chart of accounts.
          </p>
        )}
        {importResult.rulesCreated > 0 && (
          <p className="text-xs text-green-700 mb-2">
            Expense allocation rules (half/full splits) were seeded — configure the subsidiary split percentages under Organisation Settings.
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => {
            setStatus("idle"); setFile(null); setSheets(null); setSelectedSheet(null); setPreview(null)
            if (fileRef.current) fileRef.current.value = ""
          }}
        >
          Import another sheet
        </Button>
      </div>
    )
  }

  // ── Main form ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl">

      {/* Info */}
      <div className="rounded-lg bg-muted/50 border p-4 text-sm">
        <p className="font-medium mb-1">About this import</p>
        <p className="text-muted-foreground">
          Upload your <strong>Accounts2026.xlsx</strong> file. Each company has its own sheet — select
          the sheet that matches <strong>{organisationName}</strong>. The system will automatically
          create named supplier accounts, detect VAT treatment, and seed expense allocation rules.
        </p>
      </div>

      {/* Step 1 — file */}
      <div>
        <p className="text-sm font-medium mb-2">Step 1 — Select your Excel file</p>
        <label className="flex items-center gap-3 rounded-lg border-2 border-dashed p-5 cursor-pointer hover:border-primary/50 transition-colors max-w-md">
          <FileSpreadsheet className="h-8 w-8 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">{file ? file.name : "Click to select Accounts2026.xlsx"}</p>
            <p className="text-xs text-muted-foreground">.xlsx files only</p>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
            disabled={isLoading}
          />
        </label>
      </div>

      {/* Step 2 — sheet selection */}
      {sheets && sheets.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Step 2 — Select the sheet for {organisationName}</p>
          <div className="flex flex-wrap gap-2">
            {sheets.map((s) => (
              <button
                key={s.name}
                onClick={() => { setSelectedSheet(s.name); setPreview(null); setStatus("idle") }}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                  selectedSheet === s.name
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "hover:border-primary/40 hover:bg-muted"
                }`}
              >
                <span className="font-mono text-xs mr-1.5 text-muted-foreground">{s.name}</span>
                {s.company}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 3 — preview button */}
      {selectedSheet && status !== "previewing" && (
        <Button onClick={handlePreview} disabled={isLoading}>
          {isLoading && status === "loading" ? "Loading…" : "Preview import"}
        </Button>
      )}

      {/* Preview */}
      {status === "previewing" && preview && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold">
                Step 3 — Preview: {preview.rows.length} lines · {preview.year}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {preview.companyName}
              </p>
            </div>
          </div>

          {/* Automation summary cards */}
          {(namedSupplierCount > 0 || allocationRuleCount > 0) && (
            <div className="grid grid-cols-2 gap-3 max-w-lg">
              {namedSupplierCount > 0 && (
                <div className="rounded-lg border bg-blue-50 border-blue-200 p-3 flex items-start gap-2.5">
                  <Sparkles className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-blue-900">{namedSupplierCount} new supplier accounts</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      Named suppliers (afrihost, microsoft…) will be auto-created in your chart of accounts.
                    </p>
                  </div>
                </div>
              )}
              {allocationRuleCount > 0 && (
                <div className="rounded-lg border bg-amber-50 border-amber-200 p-3 flex items-start gap-2.5">
                  <GitBranch className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-amber-900">{allocationRuleCount} allocation rules</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      Half/full expense splits will be seeded. Configure subsidiaries after import.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview table */}
          <div className="rounded-lg border overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground min-w-[180px]">Line item</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-36">Account</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-28">Type</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground w-20">VAT</th>
                  {preview.months.map((m) => (
                    <th key={m} className="text-right px-2 py-2 font-medium text-muted-foreground w-20">
                      {MONTH_NAMES[m]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.rows.map((row, i) => {
                  const typeInfo = SECTION_LABELS[row.accountType]
                  return (
                    <tr key={i} className="hover:bg-muted/20">
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium">{row.label}</span>
                          {row.needsNewAccount && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 rounded px-1 py-0.5 font-medium shrink-0">
                              NEW ACCOUNT
                            </span>
                          )}
                          {row.allocationNote && (
                            <span className={`text-[10px] rounded px-1 py-0.5 font-medium shrink-0 ${
                              row.allocationNote === "half"
                                ? "bg-amber-100 text-amber-700 border border-amber-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}>
                              {row.allocationNote === "half" ? "50/50 SPLIT" : "100% THIS ORG"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {row.needsNewAccount
                          ? <span className="italic">Auto-create</span>
                          : (CODE_LABELS[row.suggestedAccountCode] ?? row.suggestedAccountCode)
                        }
                      </td>
                      <td className="px-3 py-1.5">
                        {typeInfo && (
                          <span className={`text-[10px] border rounded px-1.5 py-0.5 font-medium ${typeInfo.colour}`}>
                            {typeInfo.label}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <Badge
                          variant={row.vatType === "none" || row.vatType === "exempt" ? "outline" : "default"}
                          className="text-[10px] py-0"
                        >
                          {row.vatType === "none" ? "No VAT" : row.vatType === "exempt" ? "Exempt" : "15%"}
                        </Badge>
                      </td>
                      {preview.months.map((m) => (
                        <td key={m} className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                          {row.amounts[m]
                            ? `R${row.amounts[m].toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`
                            : "—"}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Allocation rules list */}
          {preview.allocationRules.length > 0 && (
            <div className="rounded-lg border bg-amber-50 border-amber-200 p-4">
              <p className="text-xs font-semibold text-amber-900 mb-2 flex items-center gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                Allocation rules to seed ({preview.allocationRules.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {preview.allocationRules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-1.5 bg-white rounded border border-amber-200 px-2 py-1 text-xs">
                    <span className="font-medium text-amber-800">{rule.descriptionPattern}</span>
                    <span className={`rounded px-1 text-[10px] font-semibold ${
                      rule.note === "half"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-600"
                    }`}>
                      {rule.note === "half" ? "50 / 50" : "100%"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <Button onClick={handleImport} disabled={isLoading}>
              <Upload className="h-4 w-4" />
              {isLoading ? "Importing…" : `Import ${preview.rows.length} lines`}
            </Button>
            <Button variant="outline" onClick={() => setStatus("idle")}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}
    </div>
  )
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "bg-green-50 border-green-200" : "bg-white"}`}>
      <p className={`text-lg font-bold tabular-nums ${highlight ? "text-green-700" : "text-foreground"}`}>
        {value.toLocaleString()}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}
