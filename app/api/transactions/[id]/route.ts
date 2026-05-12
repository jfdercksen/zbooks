import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const PatchSchema = z.object({
  account_id: z.string().uuid().nullable().optional(),
  vat_type: z.enum(["standard", "zero_rated", "exempt", "none"]).optional(),
  status: z.enum(["pending", "categorised", "committed"]).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      )
    }

    // Fetch the transaction to verify org membership
    const { data: tx } = await supabase
      .from("transactions")
      .select("id, organisation_id, bank_statement_id")
      .eq("id", id)
      .single()

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Verify user belongs to this org
    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", tx.organisation_id)
      .eq("user_id", user.id)
      .single()

    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Build update payload
    const updates: Record<string, unknown> = {}
    if ("account_id" in parsed.data) updates.account_id = parsed.data.account_id
    if (parsed.data.vat_type !== undefined) updates.vat_type = parsed.data.vat_type
    if (parsed.data.status !== undefined) updates.status = parsed.data.status

    const { error: updateError } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", id)

    if (updateError) {
      console.error("[PATCH /api/transactions/[id]]:", updateError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[PATCH /api/transactions/[id]]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
