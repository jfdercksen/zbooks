"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface Sheet {
  name: string
  company: string
}

interface PreviewRow {
  label: string
  suggestedAccountCode: string
  vatType: string
  amounts: Record<number, number>
}

interface ParsedData {
  companyName: string
  rows: PreviewRow[]
  months: number[]
}

const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const CODE_LABELS: Record<string, string> = {
  "4000": "Sales Revenue",
  "5000": "Cost of Sales",
  "5100": "Salaries",
  "5200": "Rent",
  "5201": "Electricity/Water",
  "5202": "Telephone/Internet",
  "5203": "Office Supplies",
  "5300": "Fuel & Motor",
  "5400": "Advertising",
  "5500": "Bank Charges",
  "5501": "Interest",
  "5600": "Professional Fees",
  "5601": "Accounting",
  "5700": "Insurance",
  "5800": "Repairs",
  "5999": "Miscellaneous",
  "2400": "Loan",
  "3200": "Drawings",
}

interface ExcelImportFormProps {
  organisationId: string
  organisationName: string
}

export function ExcelImportForm({ organisationId, organisationName }: ExcelImportFormProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [sheets, setSheets] = useState<Sheet[] | null>(null)
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null)
  const [preview, setPreview] = useState<ParsedData | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "previewing" | "importing" | "done" | "error">("idle")
  const [message, setMessage] = useState("")
  const [importResult, setImportResult] = useState<{ imported: number; rows: number } | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setSheets(null)
    setSelectedSheet(null)
    setPreview(null)
    setStatus("loading")
    setMessage("")

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

      // Auto-select sheet if org name matches
      const match = json.data.sheets.find((s: Sheet) =>
        s.company.toLowerCase().includes(organisationName.toLowerCase().split(" ")[0].toLowerCase()) ||
        organisationName.toLowerCase().includes(s.company.toLowerCase().split(" ")[0].toLowerCase())
      )
      if (match) setSelectedSheet(match.name)
    } catch {
      setStatus("error")
      setMessage("Failed to read file")
    }
  }

  async function handlePreview() {
    if (!file || !selectedSheet) return
    setStatus("loading")
    setPreview(null)

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
      setStatus("previewing")
    } catch {
      setStatus("error")
      setMessage("Failed to preview")
    }
  }

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
      setStatus("error")
      setMessage("Import failed")
    }
  }

  const isLoading = status === "loading" || status === "importing"

  if (status === "done" && importResult) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 max-w-lg">
        <div className="flex items-center gap-3 mb-3">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <h3 className="font-semibold text-green-900">Import complete</h3>
        </div>
        <p className="text-sm text-green-800">
          Successfully imported <strong>{importResult.imported}</strong> transaction records
          from <strong>{importResult.rows}</strong> account lines.
        </p>
        <p className="text-sm text-green-700 mt-1">
          This historical data will now be used by the AI when categorising future bank statement entries.
        </p>
        <Button
          variant="outline"
          className="mt-4"
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

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Info box */}
      <div className="rounded-lg bg-muted/50 border p-4 text-sm">
        <p className="font-medium mb-1">About this import</p>
        <p className="text-muted-foreground">
          Upload your <strong>Accounts2026.xlsx</strong> file. Each company has its own sheet — select the sheet
          that matches <strong>{organisationName}</strong>. The historical P&L data will be imported as
          committed transactions so the AI can learn this company&apos;s spending patterns.
        </p>
      </div>

      {/* Step 1 — File upload */}
      <div>
        <p className="text-sm font-medium mb-2">Step 1 — Select your Excel file</p>
        <label className="flex items-center gap-3 rounded-lg border-2 border-dashed p-5 cursor-pointer hover:border-primary/50 transition-colors">
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

      {/* Step 2 — Sheet selection */}
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

      {/* Step 3 — Preview */}
      {selectedSheet && status !== "previewing" && (
        <Button onClick={handlePreview} disabled={isLoading}>
          {isLoading ? "Loading…" : "Preview import"}
        </Button>
      )}

      {/* Preview table */}
      {status === "previewing" && preview && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium">
              Step 3 — Preview: {preview.rows.length} account lines to import
            </p>
          </div>

          <div className="rounded-lg border overflow-x-auto mb-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground min-w-[180px]">Line item</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Account</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">VAT</th>
                  {preview.months.map((m) => (
                    <th key={m} className="text-right px-2 py-2 font-medium text-muted-foreground">
                      {MONTH_NAMES[m]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    <td className="px-3 py-1.5 font-medium truncate max-w-[200px]">{row.label}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">
                      {CODE_LABELS[row.suggestedAccountCode] ?? row.suggestedAccountCode}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge variant={row.vatType === "none" ? "outline" : "default"} className="text-[10px] py-0">
                        {row.vatType === "none" ? "No VAT" : "15%"}
                      </Badge>
                    </td>
                    {preview.months.map((m) => (
                      <td key={m} className="px-2 py-1.5 text-right tabular-nums">
                        {row.amounts[m] ? `R${row.amounts[m].toLocaleString("en-ZA", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
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
