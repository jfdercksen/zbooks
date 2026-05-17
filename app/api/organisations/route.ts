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
    // Auth check uses user-scoped client (anon key + cookies)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = CreateOrgSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.issues },
        { status: 400 }
      )
    }

    // Service role client bypasses RLS for org creation — the user can't be a
    // member of an org that doesn't exist yet, so the anon client always fails.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const start = parsed.data.financial_year_start ?? 3
    const end = start > 1 ? start - 1 : 12

    const orgResult = await db
      .from("organisations")
      .insert({
        name: parsed.data.name,
        registration_number: parsed.data.registration_number ?? null,
        vat_number: parsed.data.vat_number ?? null,
        financial_year_start: start,
        financial_year_end: end,
      })
      .select("id")
      .single()

    if (orgResult.error) {
      console.error("[POST /api/organisations] org insert:", orgResult.error)
      return NextResponse.json({ error: "Failed to create organisation" }, { status: 500 })
    }

    const memberResult = await db.from("organisation_members").insert({
      organisation_id: orgResult.data.id,
      user_id: user.id,
      role: "admin",
    })

    if (memberResult.error) {
      console.error("[POST /api/organisations] member insert:", memberResult.error)
      return NextResponse.json({ error: "Failed to create organisation" }, { status: 500 })
    }

    await db.rpc("seed_default_accounts", {
      p_organisation_id: orgResult.data.id,
    })

    return NextResponse.json(
      { success: true, data: { id: orgResult.data.id } },
      { status: 201 }
    )
  } catch (error) {
    console.error("[POST /api/organisations]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
