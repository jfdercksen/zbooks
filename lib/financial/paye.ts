// SA PAYE / UIF / SDL — 2025/26 tax year (1 March 2025 – 28 February 2026)

// ─── Tax brackets ─────────────────────────────────────────────────────────────

interface Bracket {
  threshold: number
  rate: number
  base: number
}

const TAX_BRACKETS: Bracket[] = [
  { threshold:    237_100, rate: 0.18, base:         0 },
  { threshold:    370_500, rate: 0.26, base:    42_678 },
  { threshold:    512_800, rate: 0.31, base:    77_362 },
  { threshold:    673_000, rate: 0.36, base:   121_475 },
  { threshold:    857_900, rate: 0.39, base:   179_147 },
  { threshold:  1_817_000, rate: 0.41, base:   251_258 },
  { threshold:   Infinity, rate: 0.45, base:   644_489 },
]

const PRIMARY_REBATE   = 17_235
const SECONDARY_REBATE =  9_444   // age 65–74
const TERTIARY_REBATE  =  3_145   // age 75+

const UIF_RATE            = 0.01
const UIF_MONTHLY_CEILING = 17_712  // R17,712 earnings ceiling → max R177.12 p/m
const SDL_RATE            = 0.01

// ─── Annual tax on taxable income ─────────────────────────────────────────────

export function annualTax(annualIncome: number): number {
  for (let i = TAX_BRACKETS.length - 1; i >= 0; i--) {
    const prev = i === 0 ? 0 : TAX_BRACKETS[i - 1].threshold
    if (annualIncome > prev) {
      const b = TAX_BRACKETS[i]
      return b.base + b.rate * (annualIncome - prev)
    }
  }
  return 0
}

// ─── Monthly PAYE ─────────────────────────────────────────────────────────────
// grossMonthly: gross salary before any deductions
// age: employee age in years (determines rebate)

export function monthlyPAYE(grossMonthly: number, age = 30): number {
  const annualIncome = grossMonthly * 12
  let tax = annualTax(annualIncome)

  tax -= PRIMARY_REBATE
  if (age >= 65) tax -= SECONDARY_REBATE
  if (age >= 75) tax -= TERTIARY_REBATE

  const annualPAYE = Math.max(0, tax)
  return Math.round((annualPAYE / 12) * 100) / 100
}

// ─── UIF ──────────────────────────────────────────────────────────────────────
// Both employee and employer contribute 1% (same calculation, called twice)

export function monthlyUIF(grossMonthly: number): number {
  const capped = Math.min(grossMonthly, UIF_MONTHLY_CEILING)
  return Math.round(capped * UIF_RATE * 100) / 100
}

// ─── SDL ──────────────────────────────────────────────────────────────────────
// 1% of gross — technically only applies if annual payroll > R500k,
// but we calculate per employee for the ledger; the employer decides to declare.

export function monthlySDL(grossMonthly: number): number {
  return Math.round(grossMonthly * SDL_RATE * 100) / 100
}

// ─── Full payslip calculation ─────────────────────────────────────────────────

export interface PayslipResult {
  gross:          number
  paye:           number
  uif_employee:   number
  uif_employer:   number
  sdl:            number
  total_deductions: number
  net_pay:        number
}

export function calculatePayslip(grossMonthly: number, age = 30): PayslipResult {
  const paye         = monthlyPAYE(grossMonthly, age)
  const uifEmployee  = monthlyUIF(grossMonthly)
  const uifEmployer  = monthlyUIF(grossMonthly)
  const sdl          = monthlySDL(grossMonthly)
  const totalDeductions = paye + uifEmployee
  const netPay       = grossMonthly - totalDeductions

  return {
    gross:            grossMonthly,
    paye,
    uif_employee:     uifEmployee,
    uif_employer:     uifEmployer,
    sdl,
    total_deductions: totalDeductions,
    net_pay:          netPay,
  }
}
