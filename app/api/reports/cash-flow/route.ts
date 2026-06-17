import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const QuerySchema = z.object({
  organisation_id: z.string().uuid(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consolidated: z.enum(["true", "false"]).default("false"),
})

export async function GET(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const parsed = QuerySchema.safeParse({
      organisation_id: searchParams.get("organisation_id"),
      from_date: searchParams.get("from_date"),
      to_date: searchParams.get("to_date"),
      consolidated: searchParams.get("consolidated") ?? "false",
    })
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid params", details: parsed.error.issues }, { status: 400 })
    }

    const { organisation_id, from_date, to_date, consolidated } = parsed.data
    const isConsolidated = consolidated === "true"

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", organisation_id)
      .eq("user_id", user.id)
      .single()
    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { data: org } = await db
      .from("organisations")
      .select("id, name")
      .eq("id", organisation_id)
      .single()

    let orgIds: string[] = [organisation_id]

    if (isConsolidated) {
      const { data: subs } = await db
        .from("organisations")
        .select("id")
        .eq("parent_organisation_id", organisation_id)
      for (const sub of (subs ?? [])) {
        const { data: subMembership } = await db
          .from("organisation_members")
          .select("role")
          .eq("organisation_id", sub.id)
          .eq("user_id", user.id)
          .single()
        if (subMembership) orgIds.push(sub.id)
      }
    }

    // Load ALL committed transactions — cash flow reflects actual bank movements
    // For consolidated: exclude intercompany split legs from the count to avoid double-counting
    const { data: txData } = await db
      .from("transactions")
      .select("id, date, debit_amount, credit_amount, is_split")
      .in("organisation_id", orgIds)
      .eq("status", "committed")
      .gte("date", from_date)
      .lte("date", to_date)
      .order("date")

    // For consolidated view, we need to exclude intercompany transactions to avoid double-counting.
    // An intercompany transaction appears as both a debit in one org and a credit in another.
    // We exclude transactions whose ALL split legs are intercompany.
    let excludedTxIds = new Set<string>()
    if (isConsolidated) {
      const splitTxIds = (txData ?? [])
        .filter((t: { is_split: boolean }) => t.is_split)
        .map((t: { id: string }) => t.id)

      if (splitTxIds.length) {
        const { data: allLegs } = await db
          .from("transaction_splits")
          .select("transaction_id, is_intercompany")
          .in("transaction_id", splitTxIds)

        // Group legs by transaction
        const legsByTx: Record<string, boolean[]> = {}
        for (const leg of (allLegs ?? []) as Array<{ transaction_id: string; is_intercompany: boolean }>) {
          if (!legsByTx[leg.transaction_id]) legsByTx[leg.transaction_id] = []
          legsByTx[leg.transaction_id].push(leg.is_intercompany)
        }
        // Exclude if all legs are intercompany
        for (const [txId, flags] of Object.entries(legsByTx)) {
          if (flags.length > 0 && flags.every(Boolean)) excludedTxIds.add(txId)
        }
      }
    }

    // Aggregate by month
    const monthlyMap = new Map<string, { cash_in: number; cash_out: number }>()

    for (const tx of (txData ?? []) as Array<{
      id: string; date: string; debit_amount: string; credit_amount: string
    }>) {
      if (excludedTxIds.has(tx.id)) continue
      const month = tx.date.substring(0, 7)
      if (!monthlyMap.has(month)) monthlyMap.set(month, { cash_in: 0, cash_out: 0 })
      const m = monthlyMap.get(month)!
      m.cash_in += parseFloat(tx.credit_amount)
      m.cash_out += parseFloat(tx.debit_amount)
    }

    const monthly = [...monthlyMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        cash_in: data.cash_in,
        cash_out: data.cash_out,
        net: data.cash_in - data.cash_out,
      }))

    const totalCashIn = monthly.reduce((s, m) => s + m.cash_in, 0)
    const totalCashOut = monthly.reduce((s, m) => s + m.cash_out, 0)

    return NextResponse.json({
      data: {
        organisation_name: isConsolidated ? `${org?.name} (Consolidated)` : org?.name,
        from_date, to_date, is_consolidated: isConsolidated,
        monthly,
        total_cash_in: totalCashIn,
        total_cash_out: totalCashOut,
        net_cash_flow: totalCashIn - totalCashOut,
      }
    }, { status: 200 })
  } catch (err) {
    console.error("[GET /api/reports/cash-flow]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
