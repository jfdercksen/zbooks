import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const QuerySchema = z.object({
  organisation_id: z.string().uuid(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  status: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      organisation_id: searchParams.get("organisation_id"),
      from_date: searchParams.get("from_date") ?? undefined,
      to_date: searchParams.get("to_date") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    })
    if (!parsed.success) return NextResponse.json({ error: "Invalid params" }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", parsed.data.organisation_id)
      .eq("user_id", user.id)
      .single()
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let query = db
      .from("invoices")
      .select("id, invoice_number, invoice_date, due_date, client_id, client_name_raw, description, subtotal, tax_amount, total_amount, status, account_id, source, accounts(id, code, name), clients(id, name)")
      .eq("organisation_id", parsed.data.organisation_id)
      .order("invoice_date", { ascending: false })

    if (parsed.data.from_date) query = query.gte("invoice_date", parsed.data.from_date)
    if (parsed.data.to_date) query = query.lte("invoice_date", parsed.data.to_date)
    if (parsed.data.status && parsed.data.status !== "all") {
      query = query.eq("status", parsed.data.status)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ success: true, data: data ?? [] })
  } catch (err) {
    console.error("[GET /api/invoices]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

const CreateSchema = z.object({
  organisation_id: z.string().uuid(),
  client_id: z.string().uuid().nullable().optional(),
  client_name_raw: z.string().optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().optional(),
  subtotal: z.number().min(0),
  tax_amount: z.number().min(0).default(0),
  total_amount: z.number().min(0),
  status: z.enum(["draft", "sent", "paid", "partial", "cancelled"]).default("sent"),
  account_id: z.string().uuid().nullable().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", parsed.data.organisation_id)
      .eq("user_id", user.id)
      .single()
    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await db.from("invoices").insert(parsed.data).select().single()
    if (error) throw error

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/invoices]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
