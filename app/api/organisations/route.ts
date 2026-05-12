import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const CreateOrgSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  registration_number: z.string().max(20).optional().nullable(),
  vat_number: z.string().max(20).optional().nullable(),
  financial_year_start: z.number().int().min(1).max(12).optional(),
})

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
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

    const { data: org, error: orgError } = await supabase
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

    if (orgError || !org) {
      console.error("[POST /api/organisations] org insert:", orgError)
      return NextResponse.json({ error: "Internal server error", detail: orgError?.message, code: orgError?.code }, { status: 500 })
    }

    const { error: memberError } = await supabase
      .from("organisation_members")
      .insert({ organisation_id: org.id, user_id: user.id, role: "admin" })

    if (memberError) {
      console.error("[POST /api/organisations] member insert:", memberError)
      return NextResponse.json({ error: "Internal server error", detail: memberError?.message, code: memberError?.code }, { status: 500 })
    }

    const { error: seedError } = await supabase.rpc("seed_default_accounts", {
      p_organisation_id: org.id,
    })
    if (seedError) {
      console.error("[POST /api/organisations] seed_default_accounts:", seedError)
    }

    return NextResponse.json({ success: true, data: { id: org.id } }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/organisations]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
