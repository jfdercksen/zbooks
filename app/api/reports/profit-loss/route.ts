import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const QuerySchema = z.object({
  organisation_id: z.string().uuid(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consolidated: z.enum(["true", "false"]).default("false"),
})

interface PLRow {
  account_id: string
  account_code: string
  account_name: string
  account_type: string
  total: number
}

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

    // Verify user has access to this org
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

    // Build the list of org IDs to include
    let orgIds: string[] = [organisation_id]

    if (isConsolidated) {
      const { data: subs } = await db
        .from("organisations")
        .select("id, name")
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

    // Get bank statement IDs for these orgs
    const { data: statements } = await db
      .from("bank_statements")
      .select("id")
      .in("organisation_id", orgIds)

    const statementIds: string[] = (statements ?? []).map((s: { id: string }) => s.id)

    if (!statementIds.length) {
      return NextResponse.json({
        data: {
          organisation_name: isConsolidated ? `${org?.name} (Consolidated)` : org?.name,
          from_date, to_date, is_consolidated: isConsolidated,
          subsidiary_count: orgIds.length - 1,
          revenue: [], expenses: [],
          total_revenue: 0, total_expenses: 0, net_profit: 0,
        }
      }, { status: 200 })
    }

    // Load non-split committed transactions with account join
    const { data: txData } = await db
      .from("transactions")
      .select("id, debit_amount, credit_amount, account_id, accounts(id, code, name, type)")
      .in("bank_statement_id", statementIds)
      .eq("status", "committed")
      .eq("is_split", false)
      .not("account_id", "is", null)
      .gte("date", from_date)
      .lte("date", to_date)

    // Load committed split parent transactions (to get debit/credit direction)
    const { data: splitParents } = await db
      .from("transactions")
      .select("id, debit_amount, credit_amount")
      .in("bank_statement_id", statementIds)
      .eq("status", "committed")
      .eq("is_split", true)
      .gte("date", from_date)
      .lte("date", to_date)

    const splitParentMap: Record<string, { debit_amount: string; credit_amount: string }> = {}
    for (const t of (splitParents ?? [])) {
      splitParentMap[t.id] = { debit_amount: t.debit_amount, credit_amount: t.credit_amount }
    }

    const splitParentIds = Object.keys(splitParentMap)

    // Load split legs for those transactions, filtered to our orgs
    const splitLegs = splitParentIds.length
      ? (await db
          .from("transaction_splits")
          .select("transaction_id, organisation_id, account_id, amount, is_intercompany, accounts(id, code, name, type)")
          .in("transaction_id", splitParentIds)
          .in("organisation_id", orgIds)
          .not("account_id", "is", null)
        ).data ?? []
      : []

    // Aggregate amounts per account
    const accountTotals = new Map<string, PLRow>()

    function addToAccount(accId: string, accCode: string, accName: string, accType: string, amount: number) {
      if (!accountTotals.has(accId)) {
        accountTotals.set(accId, { account_id: accId, account_code: accCode, account_name: accName, account_type: accType, total: 0 })
      }
      accountTotals.get(accId)!.total += amount
    }

    for (const tx of (txData ?? []) as Array<{
      debit_amount: string; credit_amount: string
      accounts: { id: string; code: string; name: string; type: string } | null
    }>) {
      if (!tx.accounts) continue
      const { id, code, name, type } = tx.accounts
      const debit = parseFloat(tx.debit_amount)
      const credit = parseFloat(tx.credit_amount)

      if (type === "income") addToAccount(id, code, name, type, credit - debit)
      else if (type === "expense") addToAccount(id, code, name, type, debit - credit)
    }

    for (const leg of splitLegs as Array<{
      transaction_id: string; organisation_id: string
      amount: string; is_intercompany: boolean
      accounts: { id: string; code: string; name: string; type: string } | null
    }>) {
      if (isConsolidated && leg.is_intercompany) continue
      if (!leg.accounts) continue
      const parent = splitParentMap[leg.transaction_id]
      if (!parent) continue

      const { id, code, name, type } = leg.accounts
      const amount = parseFloat(leg.amount)
      const isDebit = parseFloat(parent.debit_amount) > 0

      if (type === "income") addToAccount(id, code, name, type, isDebit ? -amount : amount)
      else if (type === "expense") addToAccount(id, code, name, type, isDebit ? amount : -amount)
    }

    const rows = [...accountTotals.values()].sort((a, b) => a.account_code.localeCompare(b.account_code))
    const revenue = rows.filter((r) => r.account_type === "income")
    const expenses = rows.filter((r) => r.account_type === "expense")
    const totalRevenue = revenue.reduce((s, r) => s + r.total, 0)
    const totalExpenses = expenses.reduce((s, r) => s + r.total, 0)

    return NextResponse.json({
      data: {
        organisation_name: isConsolidated ? `${org?.name} (Consolidated)` : org?.name,
        from_date, to_date,
        is_consolidated: isConsolidated,
        subsidiary_count: orgIds.length - 1,
        revenue,
        expenses,
        total_revenue: totalRevenue,
        total_expenses: totalExpenses,
        net_profit: totalRevenue - totalExpenses,
      }
    }, { status: 200 })
  } catch (err) {
    console.error("[GET /api/reports/profit-loss]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
