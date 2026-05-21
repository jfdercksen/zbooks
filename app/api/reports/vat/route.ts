import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const QuerySchema = z.object({
  organisation_id: z.string().uuid(),
  from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  consolidated: z.enum(["true", "false"]).default("false"),
})

interface VatBucket {
  gross: number
  vat: number
  nett: number
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

    const { data: statements } = await db
      .from("bank_statements")
      .select("id")
      .in("organisation_id", orgIds)

    const statementIds: string[] = (statements ?? []).map((s: { id: string }) => s.id)

    const orgName = isConsolidated ? `${org?.name} (Consolidated)` : org?.name

    function emptyBucket(): VatBucket { return { gross: 0, vat: 0, nett: 0 } }

    if (!statementIds.length) {
      return NextResponse.json({
        data: {
          organisation_name: orgName,
          from_date, to_date, is_consolidated: isConsolidated,
          output: { standard: emptyBucket(), zero_rated: emptyBucket(), exempt: emptyBucket() },
          input: { standard: emptyBucket() },
          total_output_vat: 0, total_input_vat: 0, net_vat_payable: 0,
        }
      }, { status: 200 })
    }

    // Load committed transactions with account type and VAT fields
    const { data: txData } = await db
      .from("transactions")
      .select("debit_amount, credit_amount, vat_type, vat_amount, accounts(type)")
      .in("bank_statement_id", statementIds)
      .eq("status", "committed")
      .eq("is_split", false)
      .not("account_id", "is", null)
      .gte("date", from_date)
      .lte("date", to_date)

    const output = {
      standard: emptyBucket(),
      zero_rated: emptyBucket(),
      exempt: emptyBucket(),
    }
    const input = { standard: emptyBucket() }

    for (const tx of (txData ?? []) as Array<{
      debit_amount: string; credit_amount: string
      vat_type: string; vat_amount: string
      accounts: { type: string } | null
    }>) {
      if (!tx.accounts) continue
      const { type } = tx.accounts
      const isIncome = type === "income"
      const isExpense = type === "expense"
      if (!isIncome && !isExpense) continue

      const gross = isIncome ? parseFloat(tx.credit_amount) : parseFloat(tx.debit_amount)
      const vatAmt = parseFloat(tx.vat_amount ?? "0")
      const nett = gross - vatAmt

      if (isIncome) {
        if (tx.vat_type === "standard") {
          output.standard.gross += gross
          output.standard.vat += vatAmt
          output.standard.nett += nett
        } else if (tx.vat_type === "zero_rated") {
          output.zero_rated.gross += gross
        } else if (tx.vat_type === "exempt") {
          output.exempt.gross += gross
        }
      } else {
        if (tx.vat_type === "standard") {
          input.standard.gross += gross
          input.standard.vat += vatAmt
          input.standard.nett += nett
        }
      }
    }

    const totalOutputVat = output.standard.vat
    const totalInputVat = input.standard.vat

    return NextResponse.json({
      data: {
        organisation_name: orgName,
        from_date, to_date, is_consolidated: isConsolidated,
        output,
        input,
        total_output_vat: totalOutputVat,
        total_input_vat: totalInputVat,
        net_vat_payable: totalOutputVat - totalInputVat,
      }
    }, { status: 200 })
  } catch (err) {
    console.error("[GET /api/reports/vat]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
