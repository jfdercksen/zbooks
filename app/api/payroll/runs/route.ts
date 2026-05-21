import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { calculatePayslip } from "@/lib/financial/paye"

const CreateSchema = z.object({
  organisation_id: z.string().uuid(),
  period_month:    z.number().int().min(1).max(12),
  period_year:     z.number().int().min(2020).max(2100),
})

export async function GET(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const orgId = request.nextUrl.searchParams.get("organisation_id")
    if (!orgId) return NextResponse.json({ error: "organisation_id required" }, { status: 400 })

    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", orgId)
      .eq("user_id", user.id)
      .single()
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data, error } = await supabase
      .from("payroll_runs")
      .select("id, period_month, period_year, total_gross, total_paye, total_net, status, created_at")
      .eq("organisation_id", orgId)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false })

    if (error) throw error
    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error("[GET /api/payroll/runs]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    const { organisation_id, period_month, period_year } = parsed.data

    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", organisation_id)
      .eq("user_id", user.id)
      .single()
    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    // Prevent duplicate run for same period
    const { data: existing } = await db
      .from("payroll_runs")
      .select("id")
      .eq("organisation_id", organisation_id)
      .eq("period_month", period_month)
      .eq("period_year", period_year)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: "A payroll run already exists for this period" }, { status: 409 })
    }

    // Load active employees
    const { data: employees } = await db
      .from("employees")
      .select("id, first_name, last_name, gross_salary")
      .eq("organisation_id", organisation_id)
      .eq("is_active", true)

    if (!employees?.length) {
      return NextResponse.json({ error: "No active employees found" }, { status: 400 })
    }

    // Calculate payslips
    const entries = (employees as Array<{ id: string; first_name: string; last_name: string; gross_salary: string }>)
      .map((emp) => {
        const gross = parseFloat(emp.gross_salary)
        const result = calculatePayslip(gross)
        return {
          organisation_id,
          employee_id: emp.id,
          gross_salary:   +result.gross.toFixed(2),
          paye:           +result.paye.toFixed(2),
          uif_employee:   +result.uif_employee.toFixed(2),
          uif_employer:   +result.uif_employer.toFixed(2),
          sdl:            +result.sdl.toFixed(2),
          net_pay:        +result.net_pay.toFixed(2),
        }
      })

    const totals = entries.reduce(
      (acc, e) => ({
        total_gross:        acc.total_gross        + e.gross_salary,
        total_paye:         acc.total_paye         + e.paye,
        total_uif_employee: acc.total_uif_employee + e.uif_employee,
        total_uif_employer: acc.total_uif_employer + e.uif_employer,
        total_sdl:          acc.total_sdl          + e.sdl,
        total_net:          acc.total_net          + e.net_pay,
      }),
      { total_gross: 0, total_paye: 0, total_uif_employee: 0, total_uif_employer: 0, total_sdl: 0, total_net: 0 }
    )

    // Insert payroll run
    const { data: run, error: runErr } = await db
      .from("payroll_runs")
      .insert({
        organisation_id,
        period_month,
        period_year,
        total_gross:        +totals.total_gross.toFixed(2),
        total_paye:         +totals.total_paye.toFixed(2),
        total_uif_employee: +totals.total_uif_employee.toFixed(2),
        total_uif_employer: +totals.total_uif_employer.toFixed(2),
        total_sdl:          +totals.total_sdl.toFixed(2),
        total_net:          +totals.total_net.toFixed(2),
        status: "draft",
        created_by: user.id,
      })
      .select("id")
      .single()
    if (runErr) throw runErr

    // Insert payroll entries (link entries to run)
    const entriesWithRun = entries.map((e) => ({ ...e, payroll_run_id: run.id }))
    const { error: entriesErr } = await db.from("payroll_entries").insert(entriesWithRun)
    if (entriesErr) throw entriesErr

    return NextResponse.json({
      success: true,
      data: { run_id: run.id, employee_count: entries.length, ...totals },
    }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/payroll/runs]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
