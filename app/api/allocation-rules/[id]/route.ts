import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const SplitLegSchema = z.object({
  organisation_id: z.string().uuid(),
  organisation_name: z.string(),
  account_id: z.string().uuid().nullable(),
  account_name: z.string().nullable(),
  percentage: z.number().min(0.01).max(100),
  amount: z.number().optional(),
  is_intercompany: z.boolean().optional().default(false),
})

const UpdateRuleSchema = z.object({
  description_pattern: z.string().min(1).max(200).optional(),
  match_type: z.enum(["contains", "exact", "starts_with"]).optional(),
  transaction_type: z.enum(["debit", "credit", "both"]).optional(),
  splits: z.array(SplitLegSchema).min(1).optional(),
  is_intercompany: z.boolean().optional(),
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
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = UpdateRuleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    if (parsed.data.splits) {
      const totalPct = parsed.data.splits.reduce((s, l) => s + l.percentage, 0)
      if (Math.abs(totalPct - 100) > 0.01) {
        return NextResponse.json({ error: "Split percentages must sum to 100" }, { status: 400 })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    // Verify ownership
    const { data: rule } = await db.from("allocation_rules").select("user_id").eq("id", id).single()
    if (!rule || rule.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { error } = await db.from("allocation_rules").update(parsed.data).eq("id", id)
    if (error) {
      console.error("[PATCH /api/allocation-rules/[id]]:", error)
      return NextResponse.json({ error: "Failed to update rule" }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("[PATCH /api/allocation-rules/[id]]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: rule } = await db.from("allocation_rules").select("user_id").eq("id", id).single()
    if (!rule || rule.user_id !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const { error } = await db.from("allocation_rules").delete().eq("id", id)
    if (error) {
      console.error("[DELETE /api/allocation-rules/[id]]:", error)
      return NextResponse.json({ error: "Failed to delete rule" }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("[DELETE /api/allocation-rules/[id]]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
