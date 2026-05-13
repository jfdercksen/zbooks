import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

export async function GET() {
  const results: Record<string, unknown> = {}

  try {
    results.url = process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING"
    results.anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING"

    try {
      const supabase = await createServerClient()
      results.client = "OK"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = (await (supabase as any).auth.getUser()) as any
      results.auth_data = data
      results.auth_error = error
    } catch (e) {
      results.client_error = String(e)
    }
  } catch (e) {
    results.top_error = String(e)
  }

  return NextResponse.json(results, { status: 200 })
}

export async function POST(request: NextRequest) {
  const results: Record<string, unknown> = {}

  try {
    results.phase1 = "env"
    results.url = !!process.env.NEXT_PUBLIC_SUPABASE_URL
    results.anon = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    results.phase2 = "cookie"
    const supabase = await createServerClient()

    results.phase3 = "auth"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: { user }, error: authError } = (await (supabase as any).auth.getUser()) as any
    results.user = user?.id ?? "NONE"
    results.authError = authError

    results.phase4 = "body"
    const body = await request.json()
    results.body = body

    results.phase5 = "insert"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: org, error: orgError } = (await (supabase as any)
      .from("organisations")
      .insert({
        name: body.name || "Diag Test",
        registration_number: null,
        vat_number: null,
        financial_year_start: 3,
        financial_year_end: 2,
      })
      .select("id")
      .single()) as any
    results.org = org
    results.orgError = orgError

    if (org && !orgError) {
      results.phase6 = "member"
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: memberError } = (await (supabase as any)
        .from("organisation_members")
        .insert({ organisation_id: org.id, user_id: user?.id, role: "admin" })) as any
      results.memberError = memberError
    }

    return NextResponse.json({ results }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ results, crash: String(e).slice(0, 300), phase: results.phase1 ?? "?" }, { status: 500 })
  }
}
