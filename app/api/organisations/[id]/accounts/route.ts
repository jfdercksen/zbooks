import { NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { z } from "zod"

const CreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["income", "expense", "asset", "liability", "equity"]),
  vat_type: z.enum(["standard", "zero_rated", "exempt", "none"]).default("standard"),
})

const TYPE_RANGES: Record<string, [number, number]> = {
  asset:     [1000, 1999],
  liability: [2000, 2999],
  equity:    [3000, 3999],
  income:    [4000, 4999],
  expense:   [5000, 5999],
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orgId } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
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

    // Auto-assign next available code in the type's range
    const [rangeStart, rangeEnd] = TYPE_RANGES[parsed.data.type] ?? [9000, 9999]
    const { data: existingAccounts } = await db
      .from("accounts")
      .select("code")
      .eq("organisation_id", orgId)
      .gte("code", String(rangeStart))
      .lte("code", String(rangeEnd))
      .order("code")

    const existingCodes = new Set((existingAccounts ?? []).map((a: { code: string }) => String(a.code)))
    let next = rangeStart + 1
    while (existingCodes.has(String(next)) && next < rangeEnd) next++

    const { data: newAcc, error: insertErr } = await db
      .from("accounts")
      .insert({
        organisation_id: orgId,
        code: String(next),
        name: parsed.data.name.trim(),
        type: parsed.data.type,
        vat_type: parsed.data.vat_type,
        is_active: true,
      })
      .select("id, code, name, type, vat_type, is_active")
      .single()

    if (insertErr) {
      console.error("[POST /api/organisations/[id]/accounts]:", insertErr)
      return NextResponse.json({ error: "Failed to create account" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: newAcc }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/organisations/[id]/accounts]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
