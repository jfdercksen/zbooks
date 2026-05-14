import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

export async function GET() {
  // GET still shows env vars + anon auth
  const results: Record<string, unknown> = {}
  results.url = process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING"
  results.anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING"
  results.service = process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING"
  return NextResponse.json(results, { status: 200 })
}

export async function POST(request: NextRequest) {
  const results: Record<string, unknown> = {}

  try {
    results.step = 1
    results.serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ? "SET" : "MISSING"
    results.url = process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING"

    results.step = 2
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any
    results.clientCreated = true

    results.step = 3
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertResult = (await db.from("organisations").insert({
      name: "Diagnostic Test",
      registration_number: null,
      vat_number: null,
      financial_year_start: 3,
      financial_year_end: 2,
    }).select("id").single()) as any

    results.org = insertResult.data
    results.orgError = insertResult.error

    // Clean up if successful
    if (insertResult.data) {
      results.cleanup = (await (db as any).from("organisations").delete()
        .eq("id", insertResult.data.id)) as any
    }

    return NextResponse.json({ results }, { status: 200 })
  } catch (e) {
    return NextResponse.json({ results, crash: String(e).slice(0, 300) }, { status: 500 })
  }
}
