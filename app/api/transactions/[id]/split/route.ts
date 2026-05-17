import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const SplitLegSchema = z.object({
  organisation_id: z.string().uuid(),
  organisation_name: z.string(),
  account_id: z.string().uuid().nullable(),
  account_name: z.string().nullable(),
  percentage: z.number().min(0.01).max(100),
  is_intercompany: z.boolean().default(false),
})

const SplitSchema = z.object({
  splits: z.array(SplitLegSchema).min(2),
})

// Apply a % split to a transaction — creates transaction_splits rows
// and sets is_split = true on the parent transaction.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = SplitSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    const totalPct = parsed.data.splits.reduce((s, l) => s + l.percentage, 0)
    if (Math.abs(totalPct - 100) > 0.01) {
      return NextResponse.json({ error: "Split percentages must sum to 100" }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    // Load the transaction to calculate amounts
    const { data: tx, error: txErr } = await db
      .from("transactions")
      .select("id, debit_amount, credit_amount, vat_type, bank_statement_id, bank_statements(organisation_id)")
      .eq("id", transactionId)
      .single()

    if (txErr || !tx) {
      return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    }

    // Verify the user has access to the transaction's organisation
    const orgId = (tx.bank_statements as { organisation_id: string } | null)?.organisation_id
    if (!orgId) {
      return NextResponse.json({ error: "Transaction has no associated organisation" }, { status: 400 })
    }

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Delete existing splits for this transaction before re-applying
    await db.from("transaction_splits").delete().eq("transaction_id", transactionId)

    const totalAmount = parseFloat(tx.debit_amount) > 0
      ? parseFloat(tx.debit_amount)
      : parseFloat(tx.credit_amount)

    const splitRows = parsed.data.splits.map((leg) => ({
      transaction_id: transactionId,
      organisation_id: leg.organisation_id,
      account_id: leg.account_id,
      percentage: leg.percentage,
      amount: parseFloat((totalAmount * leg.percentage / 100).toFixed(2)),
      vat_type: tx.vat_type ?? "standard",
      vat_amount: 0,
      is_intercompany: leg.is_intercompany,
    }))

    const { error: insertErr } = await db.from("transaction_splits").insert(splitRows)
    if (insertErr) {
      console.error("[POST /api/transactions/[id]/split] insert:", insertErr)
      return NextResponse.json({ error: "Failed to save splits" }, { status: 500 })
    }

    const { error: updateErr } = await db
      .from("transactions")
      .update({ is_split: true, allocated_organisation_id: null })
      .eq("id", transactionId)

    if (updateErr) {
      console.error("[POST /api/transactions/[id]/split] update:", updateErr)
      return NextResponse.json({ error: "Failed to mark transaction as split" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: { splits: splitRows } }, { status: 200 })
  } catch (err) {
    console.error("[POST /api/transactions/[id]/split]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Remove a split — sets is_split = false, deletes all split legs
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: transactionId } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: tx } = await db
      .from("transactions")
      .select("id, bank_statements(organisation_id)")
      .eq("id", transactionId)
      .single()

    if (!tx) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

    const orgId = (tx.bank_statements as { organisation_id: string } | null)?.organisation_id
    if (orgId) {
      const { data: membership } = await db
        .from("organisation_members")
        .select("role")
        .eq("organisation_id", orgId)
        .eq("user_id", user.id)
        .single()

      if (!membership || !["admin", "editor"].includes(membership.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    await db.from("transaction_splits").delete().eq("transaction_id", transactionId)
    await db.from("transactions").update({ is_split: false }).eq("id", transactionId)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("[DELETE /api/transactions/[id]/split]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
