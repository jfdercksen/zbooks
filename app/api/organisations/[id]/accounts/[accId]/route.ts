import { NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { z } from "zod"

const UpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  vat_type: z.enum(["standard", "zero_rated", "exempt", "none"]).optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; accId: string }> }
) {
  try {
    const { id: orgId, accId } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", orgId)
      .eq("user_id", user.id)
      .single()
    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const updates: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name.trim()
    if (parsed.data.vat_type !== undefined) updates.vat_type = parsed.data.vat_type
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active

    const { data: updated, error: updateErr } = await db
      .from("accounts")
      .update(updates)
      .eq("id", accId)
      .eq("organisation_id", orgId)
      .select("id, code, name, type, vat_type, is_active")
      .single()

    if (updateErr) {
      console.error("[PATCH /api/organisations/[id]/accounts/[accId]]:", updateErr)
      return NextResponse.json({ error: "Failed to update account" }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: updated }, { status: 200 })
  } catch (err) {
    console.error("[PATCH /api/organisations/[id]/accounts/[accId]]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
