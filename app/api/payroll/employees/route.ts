import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const CreateSchema = z.object({
  organisation_id: z.string().uuid(),
  first_name:      z.string().min(1),
  last_name:       z.string().min(1),
  id_number:       z.string().optional(),
  email:           z.string().email().optional().or(z.literal("")),
  start_date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employment_type: z.enum(["permanent", "contract"]).default("permanent"),
  gross_salary:    z.number().positive(),
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
      .from("employees")
      .select("id, first_name, last_name, id_number, email, start_date, employment_type, gross_salary, is_active")
      .eq("organisation_id", orgId)
      .eq("is_active", true)
      .order("last_name")

    if (error) throw error
    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error("[GET /api/payroll/employees]:", err)
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

    const { organisation_id, ...fields } = parsed.data

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
    const { data, error } = await db
      .from("employees")
      .insert({ organisation_id, ...fields, email: fields.email || null })
      .select("id, first_name, last_name")
      .single()

    if (error) throw error
    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/payroll/employees]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
