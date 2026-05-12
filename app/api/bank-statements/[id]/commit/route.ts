import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { id: statementId } = await params

    // Fetch statement to verify ownership and current status
    const { data: stmt } = await supabase
      .from("bank_statements")
      .select("id, organisation_id, status")
      .eq("id", statementId)
      .single()

    if (!stmt) {
      return NextResponse.json({ error: "Statement not found" }, { status: 404 })
    }

    if (stmt.status === "committed") {
      return NextResponse.json({ error: "Statement already committed" }, { status: 409 })
    }

    // Verify org membership
    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", stmt.organisation_id)
      .eq("user_id", user.id)
      .single()

    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify all transactions for this statement are categorised
    const { data: uncategorised } = await supabase
      .from("transactions")
      .select("id")
      .eq("bank_statement_id", statementId)
      .is("account_id", null)

    if (uncategorised && uncategorised.length > 0) {
      return NextResponse.json(
        { error: `${uncategorised.length} transaction(s) still need a category` },
        { status: 422 }
      )
    }

    // Commit all transactions for this statement
    const { error: txError } = await supabase
      .from("transactions")
      .update({ status: "committed" })
      .eq("bank_statement_id", statementId)

    if (txError) {
      console.error("[commit] tx update:", txError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    // Mark statement as committed
    const { error: stmtError } = await supabase
      .from("bank_statements")
      .update({ status: "committed" })
      .eq("id", statementId)

    if (stmtError) {
      console.error("[commit] statement update:", stmtError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[POST /api/bank-statements/[id]/commit]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
