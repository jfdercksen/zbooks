import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

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
