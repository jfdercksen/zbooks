import { NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

// POST /api/payroll/runs/[id]/finalise
// Marks the run as finalised and writes journal entries to the transactions table.
// Journal pattern (per employee):
//   Debit 5100 Salaries   = gross
//   Debit 5101 PAYE       = paye (employer cost — amount remitted to SARS)
//   Debit 5102 UIF        = uif_employer
//   Debit 5103 SDL        = sdl
// All posted to the org's first bank account (payroll clearing account).

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: runId } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: run } = await db
      .from("payroll_runs")
      .select("id, organisation_id, period_month, period_year, status")
      .eq("id", runId)
      .single()

    if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 })
    if (run.status === "finalised") {
      return NextResponse.json({ error: "Run already finalised" }, { status: 409 })
    }

    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", run.organisation_id)
      .eq("user_id", user.id)
      .single()
    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Load payroll entries with employee names
    const { data: entries } = await db
      .from("payroll_entries")
      .select("employee_id, gross_salary, paye, uif_employee, uif_employer, sdl, net_pay, employees(first_name, last_name)")
      .eq("payroll_run_id", runId)

    if (!entries?.length) {
      return NextResponse.json({ error: "No payroll entries found" }, { status: 400 })
    }

    // Get accounts for salary expense codes
    const { data: accountsData } = await db
      .from("accounts")
      .select("id, code")
      .eq("organisation_id", run.organisation_id)
      .in("code", ["5100", "5101", "5102", "5103"])

    const codeToId = new Map<string, string>()
    for (const acc of (accountsData ?? []) as Array<{ id: string; code: string }>) {
      codeToId.set(acc.code, acc.id)
    }

    // Get first bank account for this org
    const { data: bankAccounts } = await db
      .from("bank_accounts")
      .select("id")
      .eq("organisation_id", run.organisation_id)
      .order("created_at")
      .limit(1)

    const bankAccountId = (bankAccounts ?? [])[0]?.id
    if (!bankAccountId) {
      return NextResponse.json({ error: "No bank account found for this organisation" }, { status: 400 })
    }

    const pad = (n: number) => String(n).padStart(2, "0")
    const lastDay = new Date(run.period_year, run.period_month, 0).getDate()
    const dateStr = `${run.period_year}-${pad(run.period_month)}-${pad(lastDay)}`
    const periodLabel = `${run.period_year}-${pad(run.period_month)}`

    const transactions: Record<string, unknown>[] = []

    for (const entry of entries as Array<{
      employee_id: string
      gross_salary: string; paye: string
      uif_employee: string; uif_employer: string; sdl: string; net_pay: string
      employees: { first_name: string; last_name: string } | null
    }>) {
      const name = entry.employees
        ? `${entry.employees.first_name} ${entry.employees.last_name}`
        : "Unknown"
      const base = {
        organisation_id: run.organisation_id,
        bank_account_id: bankAccountId,
        date: dateStr,
        status: "committed",
        is_split: false,
        vat_type: "none",
        vat_amount: "0.00",
        notes: `Payroll ${periodLabel}`,
      }

      // Gross salary → Salaries expense
      if (codeToId.has("5100")) {
        transactions.push({
          ...base,
          description: `Salary — ${name}`,
          debit_amount: parseFloat(entry.gross_salary).toFixed(2),
          credit_amount: "0.00",
          account_id: codeToId.get("5100"),
        })
      }

      // PAYE → PAYE expense
      if (parseFloat(entry.paye) > 0 && codeToId.has("5101")) {
        transactions.push({
          ...base,
          description: `PAYE — ${name}`,
          debit_amount: parseFloat(entry.paye).toFixed(2),
          credit_amount: "0.00",
          account_id: codeToId.get("5101"),
        })
      }

      // UIF employer contribution → UIF expense
      if (parseFloat(entry.uif_employer) > 0 && codeToId.has("5102")) {
        transactions.push({
          ...base,
          description: `UIF (employer) — ${name}`,
          debit_amount: parseFloat(entry.uif_employer).toFixed(2),
          credit_amount: "0.00",
          account_id: codeToId.get("5102"),
        })
      }

      // SDL → SDL expense
      if (parseFloat(entry.sdl) > 0 && codeToId.has("5103")) {
        transactions.push({
          ...base,
          description: `SDL — ${name}`,
          debit_amount: parseFloat(entry.sdl).toFixed(2),
          credit_amount: "0.00",
          account_id: codeToId.get("5103"),
        })
      }
    }

    // Insert transactions
    const { error: txErr } = await db.from("transactions").insert(transactions)
    if (txErr) throw txErr

    // Mark run as finalised
    const { error: updateErr } = await db
      .from("payroll_runs")
      .update({ status: "finalised" })
      .eq("id", runId)
    if (updateErr) throw updateErr

    return NextResponse.json({
      success: true,
      data: { journal_entries: transactions.length },
    })
  } catch (err) {
    console.error("[POST /api/payroll/runs/[id]/finalise]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
