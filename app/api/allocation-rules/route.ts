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

const CreateRuleSchema = z.object({
  description_pattern: z.string().min(1).max(200),
  match_type: z.enum(["contains", "exact", "starts_with"]).default("contains"),
  transaction_type: z.enum(["debit", "credit", "both"]).default("both"),
  splits: z.array(SplitLegSchema).min(1),
  is_intercompany: z.boolean().default(false),
})

export async function GET(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any
    const { data, error } = await db
      .from("allocation_rules")
      .select("*")
      .eq("user_id", user.id)
      .order("times_applied", { ascending: false })
      .limit(limit)

    if (error) {
      console.error("[GET /api/allocation-rules]:", error)
      return NextResponse.json({ error: "Failed to load rules" }, { status: 500 })
    }

    return NextResponse.json({ rules: data ?? [] }, { status: 200 })
  } catch (err) {
    console.error("[GET /api/allocation-rules]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateRuleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    const totalPct = parsed.data.splits.reduce((s, l) => s + l.percentage, 0)
    if (Math.abs(totalPct - 100) > 0.01) {
      return NextResponse.json({ error: "Split percentages must sum to 100" }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any
    const { data, error } = await db
      .from("allocation_rules")
      .insert({
        user_id: user.id,
        description_pattern: parsed.data.description_pattern,
        match_type: parsed.data.match_type,
        transaction_type: parsed.data.transaction_type,
        splits: parsed.data.splits,
        is_intercompany: parsed.data.is_intercompany,
      })
      .select("id")
      .single()

    if (error) {
      console.error("[POST /api/allocation-rules]:", error)
      return NextResponse.json({ error: "Failed to save rule" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { id: data.id } }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/allocation-rules]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
