"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2, Building2 } from "lucide-react"
import { formatZAR } from "@/lib/utils"

interface Org {
  id: string
  name: string
}

interface Account {
  id: string
  code: string
  name: string
  type: string
  organisation_id: string
}

interface Props {
  orgs: Org[]
  accounts: Account[]
  defaultOrgId?: string
}

interface ParsedInvoice {
  invoice_number?: string
  invoice_date: string
  due_date?: string
  billing_period?: string
  client_name_raw?: string
  description?: string
  subtotal: number
  tax_amount: number
  total_amount: number
  status: "draft" | "sent" | "paid" | "partial" | "cancelled"
  _raw: Record<string, string>
  _error?: string
}

const REQUIRED_FIELDS = ["invoice_date", "total_amount"] as const
const OPTIONAL_FIELDS = ["invoice_number", "billing_period", "due_date", "client_name", "description", "subtotal", "tax_amount", "status"] as const
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const
type FieldKey = (typeof ALL_FIELDS)[number]

const FIELD_LABELS: Record<FieldKey, string> = {
  invoice_date: "Invoice Date *",
  total_amount: "Total Amount *",
  invoice_number: "Invoice Number",
  billing_period: "Billing Period (month work was done)",
  due_date: "Due Date",
  client_name: "Client Name",
  description: "Description",
  subtotal: "Sub Total (ex VAT)",
  tax_amount: "Tax / VAT Amount",
  status: "Status",
}

const STATUS_MAP: Record<string, ParsedInvoice["status"]> = {
  created: "sent",
  sent: "sent",
  approved: "sent",
  paid: "paid",
  "fully paid": "paid",
  "partially paid": "partial",
  partial: "partial",
  cancelled: "cancelled",
  "credit invoice": "cancelled",
  draft: "draft",
}

function parseDate(raw: string): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) return d.toISOString().substring(0, 10)
  return null
}

function parsePeriod(raw: string): string | null {
  if (!raw?.trim()) return null
  const s = raw.trim()
  // Already YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) return s
  // YYYY/MM
  if (/^\d{4}\/\d{2}$/.test(s)) return s.replace("/", "-")
  // MM/YYYY or MM-YYYY
  const my = s.match(/^(\d{1,2})[\/\-](\d{4})$/)
  if (my) return `${my[2]}-${my[1].padStart(2, "0")}`
  // Full date — extract YYYY-MM
  const d = parseDate(s)
  if (d) return d.substring(0, 7)
  // "March 2026" or "Mar 2026"
  const months: Record<string, string> = {
    jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
    jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
    january: "01", february: "02", march: "03", april: "04", june: "06",
    july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
  }
  const named = s.match(/^([a-z]+)\s+(\d{4})$/i)
  if (named) {
    const m = months[named[1].toLowerCase()]
    if (m) return `${named[2]}-${m}`
  }
  return null
}

function parseAmount(raw: string): number {
  if (!raw?.trim()) return 0
  const clean = raw.replace(/[R\s,]/g, "").replace(/[()]/g, "-").trim()
  const n = parseFloat(clean)
  return isNaN(n) ? 0 : Math.abs(n)
}

function parseStatus(raw: string): ParsedInvoice["status"] {
  return STATUS_MAP[(raw ?? "").toLowerCase().trim()] ?? "sent"
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (!lines.length) return { headers: [], rows: [] }

  function splitLine(line: string): string[] {
    const fields: string[] = []
    let cur = ""
    let inQuote = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
        else inQuote = !inQuote
      } else if (ch === "," && !inQuote) {
        fields.push(cur.trim())
        cur = ""
      } else {
        cur += ch
      }
    }
    fields.push(cur.trim())
    return fields
  }

  const headers = splitLine(lines[0])
  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitLine(lines[i])
    if (cells.every((c) => !c)) continue
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? "" })
    rows.push(row)
  }
  return { headers, rows }
}

function autoDetectMapping(headers: string[]): Partial<Record<FieldKey, string>> {
  const lower = headers.map((h) => ({ orig: h, low: h.toLowerCase() }))
  const find = (...terms: string[]) =>
    lower.find((h) => terms.some((t) => h.low.includes(t)))?.orig

  return {
    invoice_number: find("invoice no", "invoice number", "inv no", "number"),
    invoice_date: find("invoice date", "inv date", "date"),
    billing_period: find("billing period", "service month", "period", "service period", "month"),
    due_date: find("due date", "payment due"),
    client_name: find("account name", "bill to", "client", "company", "customer"),
    description: find("subject", "description", "title", "item"),
    subtotal: find("sub total", "subtotal", "excl", "ex vat", "amount excl"),
    tax_amount: find("tax amount", "vat amount", "tax", "vat"),
    total_amount: find("grand total", "total", "amount incl", "incl vat"),
    status: find("status", "invoice status"),
  }
}

function applyMapping(rows: Record<string, string>[], mapping: Partial<Record<FieldKey, string>>): ParsedInvoice[] {
  return rows.map((raw) => {
    const dateStr = parseDate(raw[mapping.invoice_date ?? ""] ?? "")
    const total = parseAmount(raw[mapping.total_amount ?? ""] ?? "")
    const subtotalRaw = raw[mapping.subtotal ?? ""] ?? ""
    const subtotal = subtotalRaw ? parseAmount(subtotalRaw) : total / 1.15
    const taxRaw = raw[mapping.tax_amount ?? ""] ?? ""
    const tax = taxRaw ? parseAmount(taxRaw) : total - subtotal

    const inv: ParsedInvoice = {
      invoice_number: raw[mapping.invoice_number ?? ""]?.trim() || undefined,
      invoice_date: dateStr ?? "",
      due_date: parseDate(raw[mapping.due_date ?? ""] ?? "") ?? undefined,
      billing_period: parsePeriod(raw[mapping.billing_period ?? ""] ?? "") ?? undefined,
      client_name_raw: raw[mapping.client_name ?? ""]?.trim() || undefined,
      description: raw[mapping.description ?? ""]?.trim() || undefined,
      subtotal: Math.round(subtotal * 100) / 100,
      tax_amount: Math.round(tax * 100) / 100,
      total_amount: Math.round(total * 100) / 100,
      status: parseStatus(raw[mapping.status ?? ""] ?? ""),
      _raw: raw,
    }

    if (!inv.invoice_date) inv._error = "Cannot parse date"
    else if (inv.total_amount <= 0) inv._error = "Total amount is 0"

    return inv
  })
}

const STATUS_COLORS: Record<string, string> = {
  paid: "text-green-700 bg-green-50 border-green-200",
  sent: "text-blue-700 bg-blue-50 border-blue-200",
  partial: "text-amber-700 bg-amber-50 border-amber-200",
  draft: "text-gray-500 bg-gray-50 border-gray-200",
  cancelled: "text-destructive bg-red-50 border-red-200",
}

export function CSVImport({ orgs, accounts, defaultOrgId }: Props) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [orgId, setOrgId] = useState(defaultOrgId ?? orgs[0]?.id ?? "")
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [filename, setFilename] = useState("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, string>>>({})
  const [accountId, setAccountId] = useState("")
  const [parsed, setParsed] = useState<ParsedInvoice[]>([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; unmatched_clients: string[] } | null>(null)
  const [error, setError] = useState("")

  const selectedOrg = orgs.find((o) => o.id === orgId)
  const incomeAccounts = accounts.filter((a) => a.organisation_id === orgId && a.type === "income")

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a .csv file")
      return
    }
    if (!orgId) {
      setError("Select an organisation first")
      return
    }
    setFilename(file.name)
    setError("")
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers: h, rows: r } = parseCSV(text)
      setHeaders(h)
      setRawRows(r)
      setMapping(autoDetectMapping(h))
      setStep(2)
    }
    reader.readAsText(file)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function goToPreview() {
    if (!mapping.invoice_date || !mapping.total_amount) {
      setError("Invoice Date and Total Amount columns are required")
      return
    }
    if (!accountId) {
      setError("Please select an income account")
      return
    }
    setError("")
    setParsed(applyMapping(rawRows, mapping))
    setStep(3)
  }

  async function confirmImport() {
    const valid = parsed.filter((p) => !p._error)
    if (!valid.length) { setError("No valid rows to import"); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/invoices/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisation_id: orgId,
          account_id: accountId,
          filename,
          invoices: valid.map(({ _raw, _error, ...inv }) => inv),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Import failed"); return }
      setResult(data.data)
    } catch {
      setError("Network error — please try again")
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setStep(1)
    setResult(null)
    setFilename("")
    setRawRows([])
    setParsed([])
    setError("")
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-4">
        <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
        <h2 className="text-lg font-semibold">{result.imported} invoice{result.imported !== 1 ? "s" : ""} imported into <span className="text-primary">{selectedOrg?.name}</span></h2>
        {result.unmatched_clients.length > 0 && (
          <div className="rounded-lg border bg-amber-50 p-4 text-left text-sm">
            <p className="font-medium text-amber-800 mb-1">
              {result.unmatched_clients.length} client name{result.unmatched_clients.length !== 1 ? "s" : ""} could not be matched:
            </p>
            <ul className="list-disc list-inside text-amber-700 space-y-0.5">
              {result.unmatched_clients.map((n) => <li key={n}>{n}</li>)}
            </ul>
            <p className="text-amber-600 mt-2 text-xs">Add these clients in the Clients section to link future imports.</p>
          </div>
        )}
        <div className="flex gap-2 justify-center">
          <Button onClick={() => router.push("/invoices?organisation_id=" + orgId)}>View Invoices</Button>
          <Button variant="outline" onClick={reset}>Import Another</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Organisation selector — always visible and locked after step 1 */}
      <div className={`rounded-xl border p-4 space-y-2 ${step > 1 ? "bg-primary/5 border-primary/20" : "bg-card"}`}>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Importing invoices for</p>
        </div>
        {step === 1 ? (
          <Select value={orgId} onValueChange={(v) => { setOrgId(v); setAccountId("") }}>
            <SelectTrigger className="h-9 text-sm w-72">
              <SelectValue placeholder="Select organisation" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-base font-bold text-primary">{selectedOrg?.name}</p>
            <button onClick={reset} className="text-xs text-muted-foreground underline hover:text-foreground">
              Change
            </button>
          </div>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {([["1", "Upload CSV"], ["2", "Map columns"], ["3", "Preview & import"]] as const).map(([n, label], i) => (
          <div key={n} className="flex items-center gap-2">
            {i > 0 && <div className="w-8 h-px bg-border" />}
            <div className={`flex items-center gap-1.5 ${parseInt(n) === step ? "text-primary font-medium" : parseInt(n) < step ? "text-muted-foreground" : "text-muted-foreground/40"}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold
                ${parseInt(n) === step ? "bg-primary text-primary-foreground" : parseInt(n) < step ? "bg-muted text-muted-foreground" : "border text-muted-foreground/40"}`}>
                {n}
              </div>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="space-y-4">
          <div
            className={`rounded-xl border-2 border-dashed transition-colors p-12 text-center cursor-pointer
              ${orgId ? "border-muted-foreground/20 hover:border-primary/40" : "border-muted-foreground/10 opacity-50 pointer-events-none"}`}
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-medium text-sm">{orgId ? "Drop your CSV file here" : "Select an organisation above first"}</p>
            <p className="text-xs text-muted-foreground mt-1">Supports Vtiger, Sage, QuickBooks, Excel CSV exports</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}

      {/* Step 2: Map columns */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/20 px-4 py-2.5 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">File:</span>
            <span className="font-medium">{filename}</span>
            <span className="text-muted-foreground ml-2">{rawRows.length} rows detected</span>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-medium">Map CSV columns to invoice fields</p>
            <div className="grid grid-cols-2 gap-3">
              {ALL_FIELDS.map((field) => (
                <div key={field} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{FIELD_LABELS[field]}</p>
                  <Select
                    value={mapping[field] ?? "__none__"}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v === "__none__" ? undefined : v }))}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="— not mapped —" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— not mapped —</SelectItem>
                      {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-sm font-medium">Income account</p>
            <p className="text-xs text-muted-foreground">Revenue from these invoices will appear under this account in accrual P&L reports</p>
            {incomeAccounts.length === 0 ? (
              <p className="text-sm text-destructive">No income accounts found for this organisation</p>
            ) : (
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="h-8 text-sm w-80">
                  <SelectValue placeholder="Select income account" />
                </SelectTrigger>
                <SelectContent>
                  {incomeAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="sm" onClick={goToPreview}>
              Preview <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Preview & confirm */}
      {step === 3 && (
        <div className="space-y-4">
          {(() => {
            const valid = parsed.filter((p) => !p._error)
            const invalid = parsed.filter((p) => p._error)
            return (
              <>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-green-700 font-medium">{valid.length} valid</span>
                  {invalid.length > 0 && <span className="text-destructive font-medium">{invalid.length} will be skipped (errors)</span>}
                </div>

                {invalid.length > 0 && (
                  <div className="rounded-lg border border-destructive/20 bg-red-50 p-3 text-sm space-y-1">
                    <div className="flex items-center gap-1.5 text-destructive font-medium">
                      <AlertCircle className="h-4 w-4" /> Rows with errors (will be skipped):
                    </div>
                    {invalid.slice(0, 5).map((row, i) => (
                      <div key={i} className="text-destructive/80 text-xs">Row {parsed.indexOf(row) + 2}: {row._error}</div>
                    ))}
                    {invalid.length > 5 && <p className="text-xs text-destructive/60">…and {invalid.length - 5} more</p>}
                  </div>
                )}

                <div className="rounded-xl border bg-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Period</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Invoice #</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Ex VAT</th>
                        <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Total</th>
                        <th className="px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {valid.slice(0, 20).map((row, i) => (
                        <tr key={i} className="hover:bg-muted/10 transition-colors">
                          <td className="px-4 py-2 text-xs tabular-nums">{row.invoice_date}</td>
                          <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">{row.billing_period ?? "—"}</td>
                          <td className="px-4 py-2 text-xs text-muted-foreground">{row.invoice_number ?? "—"}</td>
                          <td className="px-4 py-2 text-xs">{row.client_name_raw ?? "—"}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-xs">{formatZAR(row.subtotal)}</td>
                          <td className="px-4 py-2 text-right tabular-nums text-xs font-medium">{formatZAR(row.total_amount)}</td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex px-1.5 py-0.5 rounded text-xs border ${STATUS_COLORS[row.status]}`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {valid.length > 20 && (
                    <div className="px-4 py-2 border-t text-xs text-muted-foreground">
                      Showing first 20 of {valid.length} rows
                    </div>
                  )}
                </div>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setStep(2)} disabled={loading}>
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <Button size="sm" onClick={confirmImport} disabled={loading || valid.length === 0}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    Import {valid.length} invoice{valid.length !== 1 ? "s" : ""} into {selectedOrg?.name}
                  </Button>
                </div>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
