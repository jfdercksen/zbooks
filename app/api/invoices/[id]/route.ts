import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const UpdateSchema = z.object({
  client_id: z.string().uuid().nullable().optional(),
  client_name_raw: z.string().optional(),
  invoice_number: z.string().optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  description: z.string().nullable().optional(),
  subtotal: z.number().min(0).optional(),
  tax_amount: z.number().min(0).optional(),
  total_amount: z.number().min(0).optional(),
  status: z.enum(["draft", "sent", "paid", "partial", "cancelled"]).optional(),
  account_id: z.string().uuid().nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: invoice } = await db.from("invoices").select("organisation_id").eq("id", id).single()
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", invoice.organisation_id)
      .eq("user_id", user.id)
      .single()
    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })

    const { data, error } = await db.from("invoices").update(parsed.data).eq("id", id).select().single()
    if (error) throw error

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error("[PATCH /api/invoices/[id]]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: invoice } = await db.from("invoices").select("organisation_id").eq("id", id).single()
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", invoice.organisation_id)
      .eq("user_id", user.id)
      .single()
    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.from("invoices").delete().eq("id", id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/invoices/[id]]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
