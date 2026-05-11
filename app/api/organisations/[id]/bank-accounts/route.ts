import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { z } from "zod"

const CreateBankAccountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(100),
  bank_name: z.string().min(1, "Bank name is required").max(100),
  account_number: z.string().max(30).optional().nullable(),
  account_type: z.enum(["cheque", "savings", "credit", "investment"]).optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organisationId } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", organisationId)
      .eq("user_id", user.id)
      .single()
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data: accounts, error } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("organisation_id", organisationId)
      .order("name")

    if (error) {
      console.error("[GET /api/organisations/[id]/bank-accounts]:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: accounts ?? [] })
  } catch (error) {
    console.error("[GET /api/organisations/[id]/bank-accounts]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organisationId } = await params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", organisationId)
      .eq("user_id", user.id)
      .single()
    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = CreateBankAccountSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    const { data: account, error } = await supabase
      .from("bank_accounts")
      .insert({
        organisation_id: organisationId,
        name: parsed.data.name,
        bank_name: parsed.data.bank_name,
        account_number: parsed.data.account_number ?? null,
        account_type: parsed.data.account_type ?? "cheque",
      })
      .select("*")
      .single()

    if (error || !account) {
      console.error("[POST /api/organisations/[id]/bank-accounts]:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: account }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/organisations/[id]/bank-accounts]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
