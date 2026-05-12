import * as XLSX from "xlsx"

export interface ExcelRow {
  label: string
  vatType: "standard" | "zero_rated" | "exempt" | "none"
  amounts: Record<number, number> // month 1–12 → amount
  suggestedAccountCode: string
  isHeader: boolean
}

export interface ParsedSheet {
  companyName: string
  sheetName: string
  rows: ExcelRow[]
  months: number[] // which month columns have data
}

const SKIP_LABELS = new Set([
  "TOTAL INCOME",
  "TOTAL COST OF SALES",
  "TOTAL SALES",
  "TOTAL EXPENSES",
  "PROFIT / LOSS BEFORE EXPENSES",
  "PROFIT/LOSS BEFORE EXPENSES",
  "TOTAL PROFIT / LOSS",
  "TOTAL PROFIT/LOSS",
  "Total Profit / Loss",
  "Total Profit/Loss",
  "LOANS",
  "owner drawings",
  "COMPUTER EQUIPMENT",
  "OFFICE EQUIPMENT",
  "Revolving Loan",
  "Gysbert Loan repayment",
  "Wayne Strydom - Loan Amount *",
  "Total Nett Profit/Loss after Owners Drawings",
  "Total Nett after Loan & Owners Drawings",
  "SARS",
  "Zgroup VAT",
  "Commission Paid",
])

const SECTION_HEADERS = new Set([
  "SUPPLIERS (Cost of Sales)",
  "EXPENSES",
  "OTHER",
])

// Maps keywords (lowercase) to account codes
const KEYWORD_TO_CODE: Array<[RegExp, string]> = [
  [/\bsales?\b|\bincome\b/i, "4000"],
  [/\brent\b/i, "5200"],
  [/\bsalari(es|y)\b|\bwages?\b/i, "5100"],
  [/\bfuel\b/i, "5300"],
  [/\binsurance\b/i, "5700"],
  [/\binterest\b/i, "5501"],
  [/\bbank(ing)?\s*fee|\bbank\s*charge/i, "5500"],
  [/\bcellphone|cell\s*phone|\bdata\b|\btelephone|\bmobile\b/i, "5202"],
  [/\binternet|\bhosting|\btelkom|\baxxess|\bvox|\bafrihost|\byebo|\bdomains?|\bsync/i, "5202"],
  [/\bgoogle\b/i, "5400"],
  [/\bfacebook\b|\bmeta\b/i, "5400"],
  [/\badvertis|\bmarketing\b|\bsocial\b/i, "5400"],
  [/\baccounti|\bauditi/i, "5601"],
  [/\bhr\s*(services?|fees?)|\bhuman\s*resources?\b/i, "5600"],
  [/\bprofessional\s*fees?\b|\blegal\b/i, "5600"],
  [/\boffice\s*(consumables?|supplies?|equipment|\bmaintenance\b)/i, "5203"],
  [/\bvehicle\s*(maintenance|repair)/i, "5800"],
  [/\bvehicle\s*installment|\binstalment|\bloan\b|\brevolving/i, "2400"],
  [/\brepair|\bmaintenance\b/i, "5800"],
  [/\belectricity|\bwater\b|\butilities?\b/i, "5201"],
  [/\bsecurity\b/i, "5203"],
  [/\bentertain/i, "5999"],
  [/\bwest(con)?\b|\bnable\b|\beset\b|\bvodacom\b|\bmicrosoft\b|\bsupplier/i, "5000"],
  [/\bsalaries\b/i, "5100"],
  [/\bdrawings?\b/i, "3200"],
]

function suggestAccountCode(label: string): string {
  const clean = label.trim()
  for (const [pattern, code] of KEYWORD_TO_CODE) {
    if (pattern.test(clean)) return code
  }
  return "5999" // Miscellaneous Expense fallback
}

function detectVatType(label: string): "standard" | "zero_rated" | "exempt" | "none" {
  if (/\(NO\s*VAT\)/i.test(label)) return "none"
  const code = suggestAccountCode(label)
  if (code === "5501" || code === "2400" || code === "3200") return "none"
  if (code === "5100") return "none" // salaries
  return "standard"
}

export function parseExcelSheet(buffer: ArrayBuffer, sheetName: string): ParsedSheet {
  const wb = XLSX.read(buffer, { type: "array" })
  const ws = wb.Sheets[sheetName]
  if (!ws) throw new Error(`Sheet "${sheetName}" not found`)

  const raw = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" })

  // Row 1 contains month headers: ["", "JANUARY", "FEBRUARY", ...]
  const monthRow = raw[1] as (string | number)[]
  const MONTH_NAMES = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"]
  const colToMonth: Record<number, number> = {}
  monthRow.forEach((cell, col) => {
    const upper = String(cell).trim().toUpperCase()
    const idx = MONTH_NAMES.indexOf(upper)
    if (idx !== -1) colToMonth[col] = idx + 1
  })

  const activeCols = Object.keys(colToMonth).map(Number)

  // Company name from row 0 col 0
  const companyName = String(raw[0]?.[0] ?? "").split(" PROFIT")[0].split(" FIGURES")[0].trim()

  const rows: ExcelRow[] = []

  for (let r = 2; r < raw.length; r++) {
    const row = raw[r] as (string | number)[]
    const label = String(row[0] ?? "").trim()
    if (!label) continue
    if (SKIP_LABELS.has(label)) continue

    const isHeader = SECTION_HEADERS.has(label)
    if (isHeader) continue // skip section headers, they add no financial data

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

    rows.push({
      label,
      vatType: detectVatType(label),
      amounts,
      suggestedAccountCode: suggestAccountCode(label),
      isHeader,
    })
  }

  const months = [...new Set(rows.flatMap((r) => Object.keys(r.amounts).map(Number)))].sort()

  return { companyName, sheetName, rows, months }
}

export function getSheetNames(buffer: ArrayBuffer): { name: string; company: string }[] {
  const wb = XLSX.read(buffer, { type: "array" })
  return wb.SheetNames.filter((n) => !["2026", "Sheet1", "Vehicle"].includes(n)).map((name) => {
    const ws = wb.Sheets[name]
    const raw = XLSX.utils.sheet_to_json<(string | number)[]>(ws, { header: 1, defval: "" })
    const company = String(raw[0]?.[0] ?? name).split(" PROFIT")[0].split(" FIGURES")[0].trim()
    return { name, company }
  })
}
