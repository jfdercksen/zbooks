import * as XLSX from "xlsx"

// ─── Types ────────────────────────────────────────────────────────────────────

export type AccountType = "income" | "expense" | "asset" | "liability" | "equity"
export type VatType = "standard" | "zero_rated" | "exempt" | "none"
type Section = "income" | "cos" | "expenses" | "loans" | "drawings" | "assets"

export interface ExcelRow {
  label: string
  vatType: VatType
  amounts: Record<number, number>    // month 1–12 → amount
  suggestedAccountCode: string       // existing account code, or "5000" fallback
  accountType: AccountType           // derived from section
  needsNewAccount: boolean           // true = named supplier, create new account
  allocationNote?: "half" | "full"   // from NOTES column in BZ-style sheets
  isHeader: boolean
}

export interface AllocationRule {
  descriptionPattern: string         // text to match against bank statement descriptions
  note: "half" | "full"              // half = 50/50 split, full = 100% this entity
}

export interface ParsedSheet {
  companyName: string
  sheetName: string
  rows: ExcelRow[]
  months: number[]
  year: number
  allocationRules: AllocationRule[]
}

// ─── Section triggers ─────────────────────────────────────────────────────────
// These row labels switch the current section. They carry no financial data.

const SECTION_TRIGGERS: Record<string, Section> = {
  "SUPPLIERS (Cost of Sales)": "cos",
  "EXPENSES":                   "expenses",
  "OTHER":                      "expenses",   // sub-section of EXPENSES
  "LOANS":                      "loans",
  "owner drawings":             "drawings",
  "ASSETS BOUGHT":              "assets",
}

const SECTION_TO_ACCOUNT_TYPE: Record<Section, AccountType> = {
  income:   "income",
  cos:      "expense",
  expenses: "expense",
  loans:    "liability",
  drawings: "equity",
  assets:   "asset",
}

// ─── Rows to skip entirely ────────────────────────────────────────────────────

const SKIP_LABELS = new Set([
  "TOTAL INCOME", "TOTAL COST OF SALES", "TOTAL SALES", "TOTAL EXPENSES",
  "PROFIT / LOSS BEFORE EXPENSES", "PROFIT/LOSS BEFORE EXPENSES",
  "TOTAL PROFIT / LOSS", "TOTAL PROFIT/LOSS",
  "Total Profit / Loss", "Total Profit/Loss",
  "Total Nett Profit/Loss after Owners Drawings",
  "Total Nett after Loan & Owners Drawings",
  "FUEL",           // sub-header in consolidated sheet — no data row
  "Other Income",   // sub-header
  "Commission Paid",
  "Gysbert Loan repayment", "Gysbert Loan repayment ",
  "Wayne Strydom - Loan Amount *",
  "SARS", "Zgroup VAT",
  "COMPUTER EQUIPMENT", "COMPUTER EQUIPMENT ",
  "OFFICE EQUIPMENT", "OFFICE EQUIPMENT ",
  // Section headers themselves (also in SECTION_TRIGGERS, belt + braces)
  "SUPPLIERS (Cost of Sales)", "EXPENSES", "OTHER",
  "LOANS", "owner drawings", "ASSETS BOUGHT",
])

// ─── Named vs generic COS ─────────────────────────────────────────────────────
// Generic COS labels = unclassified supplier buckets → map to 5000 Cost of Sales
// Everything else under COS = named supplier → needsNewAccount = true

function isGenericCos(label: string): boolean {
  const l = label.trim()
  // Pure "Suppliers" variants, or entity-prefixed "Ztech Suppliers" / "AiDa "
  return (
    /^suppliers?\s*$/i.test(l) ||
    /\bsuppliers?\s*$/i.test(l) ||
    /^aida\s*$/i.test(l)
  )
}

// ─── Account code lookup ──────────────────────────────────────────────────────
// Returns known code for the label+section, or null (→ named supplier, new account needed)

const EXPENSE_CODE_MAP: Array<[RegExp, string]> = [
  [/^rent\b/i,                                                          "5200"],
  [/^water\b|^electricity\b/i,                                          "5201"],
  [/^salari(es|y)\b/i,                                                  "5100"],
  [/^wages?\b/i,                                                        "5100"],
  [/\bpaye\b/i,                                                         "5101"],
  [/\buif\b/i,                                                          "5102"],
  [/\bsdl\b/i,                                                          "5103"],
  [/\bfuel\b|\bpetrol\b|\bfnb\s*cheque\s*card/i,                       "5300"],
  [/\binsurance\b/i,                                                    "5700"],
  [/^interest\b/i,                                                      "5501"],
  [/\bbank(ing)?\s*(fee|charge|fees|charges)\b/i,                       "5500"],
  [/\bcellphone|cell\s*phone|\bdata\b|\btelephone\b|\bmobile\b/i,       "5202"],
  [/\binternet\b|\bhosting\b/i,                                         "5202"],
  [/\bgoogle\b|\bfacebook\b|\bmeta\b|\badvertis|\bmarketing\b/i,        "5400"],
  [/\baccounti|\baudit\b/i,                                             "5601"],
  [/\bhr\s*(services?|fees?)|\bhuman\s*resources?\b/i,                  "5600"],
  [/\bprofessional\s*fees?\b|\blegal\b/i,                               "5600"],
  [/\boffice\s*(consumables?|supplies?|maintenance)\b/i,                "5203"],
  [/\bvehicle\s*(maintenance|repair)\b/i,                               "5800"],
  [/\bvehicle\s*install|\binstalment\b/i,                               "2400"],
  [/\brepair|\bmaintenance\b/i,                                         "5800"],
  [/\belectricity|\bwater\b|\butilities?\b/i,                           "5201"],
  [/\bsecurity\s*(fee|guard|fees)?\b/i,                                 "5203"],
  [/\bstaff.*entertain|\bclient.*entertain|\bentertain/i,               "5999"],
  [/\bdeposit\b/i,                                                      "2000"],
  [/\brevolving\b/i,                                                    "2400"],
]

function getKnownCode(label: string, section: Section): string | null {
  if (section === "income")   return "4000"
  if (section === "drawings") return "3200"
  if (section === "loans")    return "2400"
  if (section === "assets")   return "1500"

  if (section === "cos") {
    return isGenericCos(label) ? "5000" : null  // null = named supplier
  }

  // expenses / other
  const clean = label.replace(/\s*\(no\s*vat\)/i, "").toLowerCase()
  for (const [pattern, code] of EXPENSE_CODE_MAP) {
    if (pattern.test(clean)) return code
  }
  return "5999"  // Miscellaneous fallback
}

// ─── VAT type detection ───────────────────────────────────────────────────────

function detectVatType(label: string, section: Section, code: string | null): VatType {
  // Explicit marker wins
  if (/\(no\s*vat\)/i.test(label)) return "none"

  // Section-level rules
  if (section === "drawings" || section === "assets") return "none"
  if (section === "loans")   return "none"
  if (section === "income")  return "standard"

  // SA VAT law — specific expense types
  const l = label.toLowerCase()
  if (/\binsurance\b/.test(l))                     return "exempt"  // VAT-exempt in SA
  if (/\bbank(ing)?\s*(fee|charge)/.test(l))       return "exempt"  // VAT-exempt in SA
  if (/^interest\b/.test(l))                       return "exempt"  // financial services exempt
  if (/\brevolving\b/.test(l))                     return "exempt"
  if (/\bsalari|\bwages?\b|\bpaye\b|\buif\b|\bsdl\b/.test(l)) return "none"
  if (/\bhr\s*(services?|fees?)/.test(l))          return "none"
  if (/\bvehicle\s*install|\binstalment/.test(l))  return "none"
  if (/\bdrawings?\b/.test(l))                     return "none"

  // Code-level fallbacks
  if (code === "5501" || code === "2400" || code === "3200") return "none"
  if (code === "5100" || code === "5101" || code === "5102" || code === "5103") return "none"
  if (code === "5700") return "exempt"
  if (code === "5500") return "exempt"

  return "standard"
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE",
  "JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER",
]

function detectYear(text: string): number {
  const m = text.match(/\b(20\d{2})\b/)
  return m ? parseInt(m[1]) : new Date().getFullYear()
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseExcelSheet(buffer: ArrayBuffer, sheetName: string): ParsedSheet {
  const wb = XLSX.read(buffer, { type: "array" })
  const ws = wb.Sheets[sheetName]
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`)

  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" })

  // Row 1: detect month columns
  const monthRow = (raw[1] ?? []) as (string | number)[]
  const colToMonth: Record<number, number> = {}
  monthRow.forEach((cell, col) => {
    const upper = String(cell).trim().toUpperCase().replace(/\s+/g, "")
    const idx = MONTH_NAMES.findIndex((m) => m.replace(/\s+/g, "") === upper)
    if (idx !== -1) colToMonth[col] = idx + 1
  })
  const activeCols = Object.keys(colToMonth).map(Number)

  // Detect NOTES column — BZ sheet puts "NOTES" at col 15 in header row 0
  const notesCol = (() => {
    for (let col = 14; col <= 17; col++) {
      if (/^notes?$/i.test(String(raw[0]?.[col] ?? "").trim())) return col
    }
    return -1
  })()

  const titleStr = String(raw[0]?.[0] ?? "")
  const companyName = titleStr.split(/\bprofit\b|\bfigures\b/i)[0].trim()
  const year = detectYear(titleStr + " " + sheetName)

  let currentSection: Section = "income"
  const rows: ExcelRow[] = []
  const allocationRules: AllocationRule[] = []
  const seenPatterns = new Set<string>()

  for (let r = 2; r < raw.length; r++) {
    const row = (raw[r] ?? []) as (string | number)[]
    const label = String(row[0] ?? "").trim()
    if (!label) continue

    // Section trigger?
    if (SECTION_TRIGGERS[label] !== undefined) {
      currentSection = SECTION_TRIGGERS[label]
      continue
    }

    if (SKIP_LABELS.has(label)) continue

    // Build monthly amounts
    const amounts: Record<number, number> = {}
    let hasData = false
    for (const col of activeCols) {
      const month = colToMonth[col]
      const val = row[col]
      if (val !== "" && val !== null && val !== undefined) {
        const num = typeof val === "number" ? val : parseFloat(String(val))
        if (!isNaN(num) && num !== 0) {
          amounts[month] = Math.abs(num)
          hasData = true
        }
      }
    }
    if (!hasData) continue

    // Allocation note from NOTES column
    let allocationNote: "half" | "full" | undefined
    if (notesCol >= 0) {
      const noteVal = String(row[notesCol] ?? "").trim().toLowerCase()
      if (noteVal === "half" || noteVal === "full") {
        allocationNote = noteVal as "half" | "full"
      }
    }

    const knownCode = getKnownCode(label, currentSection)
    const needsNewAccount = currentSection === "cos" && knownCode === null
    const suggestedAccountCode = knownCode ?? "5000"
    const accountType = SECTION_TO_ACCOUNT_TYPE[currentSection]
    const vatType = detectVatType(label, currentSection, knownCode)

    // Collect allocation rules (deduplicated by pattern)
    if (allocationNote) {
      const pattern = label.replace(/\s*\(no\s*vat\)/i, "").trim()
      if (!seenPatterns.has(pattern.toLowerCase())) {
        seenPatterns.add(pattern.toLowerCase())
        allocationRules.push({ descriptionPattern: pattern, note: allocationNote })
      }
    }

    rows.push({
      label,
      vatType,
      amounts,
      suggestedAccountCode,
      accountType,
      needsNewAccount,
      allocationNote,
      isHeader: false,
    })
  }

  const months = [
    ...new Set(rows.flatMap((r) => Object.keys(r.amounts).map(Number))),
  ].sort((a, b) => a - b)

  return { companyName, sheetName, rows, months, year, allocationRules }
}

// ─── Sheet listing ────────────────────────────────────────────────────────────

// Sheets to skip — consolidated view, helper sheets with no P&L data
const SKIP_SHEETS = new Set(["2026", "Sheet1", "Vehicle"])

export function getSheetNames(buffer: ArrayBuffer): { name: string; company: string }[] {
  const wb = XLSX.read(buffer, { type: "array" })
  return wb.SheetNames
    .filter((n) => !SKIP_SHEETS.has(n))
    .map((name) => {
      const ws = wb.Sheets[name]
      const raw = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" })
      const company = String(raw[0]?.[0] ?? name)
        .split(/\bprofit\b|\bfigures\b/i)[0]
        .trim()
      return { name, company }
    })
}
