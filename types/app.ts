import type { Database } from "./database"

// Table row types
export type Organisation = Database["public"]["Tables"]["organisations"]["Row"]
export type OrganisationMember = Database["public"]["Tables"]["organisation_members"]["Row"]
export type BankAccount = Database["public"]["Tables"]["bank_accounts"]["Row"]
export type Account = Database["public"]["Tables"]["accounts"]["Row"]
export type BankStatement = Database["public"]["Tables"]["bank_statements"]["Row"]
export type Transaction = Database["public"]["Tables"]["transactions"]["Row"]
export type Employee = Database["public"]["Tables"]["employees"]["Row"]
export type PayrollRun = Database["public"]["Tables"]["payroll_runs"]["Row"]
export type PayrollEntry = Database["public"]["Tables"]["payroll_entries"]["Row"]
export type AuditLog = Database["public"]["Tables"]["audit_log"]["Row"]

// Insert types
export type OrganisationInsert = Database["public"]["Tables"]["organisations"]["Insert"]
export type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"]
export type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"]

// Enums
export type UserRole = "admin" | "editor" | "viewer"
export type AccountType = "income" | "expense" | "asset" | "liability" | "equity"
export type VatType = "standard" | "zero_rated" | "exempt" | "none"
export type TransactionStatus = "pending" | "categorised" | "committed"
export type StatementStatus = "pending" | "processing" | "review" | "committed" | "failed"
export type PayrollRunStatus = "draft" | "finalised"
export type AuditAction = "INSERT" | "UPDATE" | "DELETE"

// API response shape
export type ApiSuccess<T> = { success: true; data: T }
export type ApiError = { error: string; details?: unknown }

// Extended types with joins
export type TransactionWithAccount = Transaction & {
  account: Pick<Account, "id" | "code" | "name" | "type"> | null
}

export type BankStatementWithAccount = BankStatement & {
  bank_account: Pick<BankAccount, "id" | "name" | "bank_name">
}

export type PayrollEntryWithEmployee = PayrollEntry & {
  employee: Pick<Employee, "id" | "first_name" | "last_name">
}

// Report types
export type ProfitLossLine = {
  account_id: string
  account_code: string
  account_name: string
  account_type: AccountType
  amount: number
}

export type ProfitLossReport = {
  period_from: string
  period_to: string
  income: ProfitLossLine[]
  expenses: ProfitLossLine[]
  total_income: number
  total_expenses: number
  net_profit: number
}

export type VatReportLine = {
  account_name: string
  vat_type: VatType
  taxable_amount: number
  vat_amount: number
}

export type VatReport = {
  period_from: string
  period_to: string
  output_vat_lines: VatReportLine[]
  input_vat_lines: VatReportLine[]
  total_output_vat: number
  total_input_vat: number
  net_vat_payable: number
}

// PDF extraction type (from Claude API)
export type ExtractedTransaction = {
  date: string
  description: string
  debit?: number | null
  credit?: number | null
  balance?: number | null
  reference?: string | null
}

export type ExtractionResult = {
  transactions: ExtractedTransaction[]
  statement_date_from?: string
  statement_date_to?: string
  bank_name?: string
  account_number?: string
}
