import { NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { z } from "zod"

const CreateOrgSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  registration_number: z.string().max(20).optional().nullable(),
  vat_number: z.string().max(20).optional().nullable(),
  financial_year_start: z.number().int().min(1).max(12).optional(),
})

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Anon client + cookie to read the user's session
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anon = (await createServerClient()) as any
    const { data: { user }, error: authError } = (await anon.auth.getUser()) as any
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateOrgSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    const start = parsed.data.financial_year_start ?? 3
    const end = start > 1 ? start - 1 : 12

    // Service role client — bypasses RLS for DB operations
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const orgResult = (await db.from("organisations").insert({
      name: parsed.data.name,
      registration_number: parsed.data.registration_number ?? null,
      vat_number: parsed.data.vat_number ?? null,
      financial_year_start: start,
      financial_year_end: end,
    }).select("id").single()) as any

    if (orgResult.error) {
      console.error("[POST /api/organisations] org insert:", orgResult.error)
      return NextResponse.json({ error: "Internal server error", detail: orgResult.error.message, code: orgResult.error.code }, { status: 500 })
    }

    const org = orgResult.data

    const memberResult = (await db.from("organisation_members").insert({
      organisation_id: org.id,
      user_id: user.id,
      role: "admin",
    })) as any

    if (memberResult.error) {
      console.error("[POST /api/organisations] member insert:", memberResult.error)
      return NextResponse.json({ error: "Internal server error", detail: memberResult.error.message, code: memberResult.error.code }, { status: 500 })
    }

    try {
      const seedResult = (await db.rpc("seed_default_accounts", {
        p_organisation_id: org.id,
      })) as any
      if (seedResult.error) {
        console.error("[POST /api/organisations] seed_default_accounts:", seedResult.error)
      }
    } catch {
      console.error("[POST /api/organisations] seed_default_accounts not found")
    }

    return NextResponse.json({ success: true, data: { id: org.id } }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/organisations] catch:", error)
    return NextResponse.json(
      { error: "Internal server error", detail: String(error).slice(0, 200) },
      { status: 500 }
    )
  }
}
