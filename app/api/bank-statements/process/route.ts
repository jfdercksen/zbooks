import { NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { extractTransactionsFromPDF } from "@/lib/claude/pdf-extractor"

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("[process] ANTHROPIC_API_KEY is not set")
      return NextResponse.json(
        { error: "AI extraction is not configured on this server" },
        { status: 500 }
      )
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[process] SUPABASE_SERVICE_ROLE_KEY is not set")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // Auth via user-scoped client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const organisationId = formData.get("organisation_id") as string | null
    const bankAccountId = formData.get("bank_account_id") as string | null

    if (!file || !organisationId || !bankAccountId) {
      return NextResponse.json(
        { error: "file, organisation_id, and bank_account_id are required" },
        { status: 400 }
      )
    }

    if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files accepted" }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 })
    }

    // Service role client for all DB ops — avoids RLS recursion until migration is applied
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    // Verify org membership explicitly (replaces RLS check)
    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", organisationId)
      .eq("user_id", user.id)
      .single()
    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify bank account belongs to this org
    const { data: bankAccount } = await db
      .from("bank_accounts")
      .select("id, name")
      .eq("id", bankAccountId)
      .eq("organisation_id", organisationId)
      .single()
    if (!bankAccount) {
      return NextResponse.json({ error: "Bank account not found" }, { status: 404 })
    }

    // Upload PDF to Supabase Storage
    const filePath = `${organisationId}/${bankAccountId}/${Date.now()}_${file.name}`
    const buffer = await file.arrayBuffer()
    const { error: uploadError } = await db.storage
      .from("bank-statements")
      .upload(filePath, buffer, { contentType: "application/pdf", upsert: false })

    if (uploadError) {
      console.error("[process] storage upload:", uploadError)
      return NextResponse.json({ error: "Failed to store file" }, { status: 500 })
    }

    // Create bank_statement record with status 'processing'
    const { data: statement, error: stmtError } = await db
      .from("bank_statements")
      .insert({
        organisation_id: organisationId,
        bank_account_id: bankAccountId,
        file_name: file.name,
        file_path: filePath,
        status: "processing",
        uploaded_by: user.id,
      })
      .select("id")
      .single()

    if (stmtError || !statement) {
      console.error("[process] statement insert:", stmtError)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    // Extract transactions with Claude
    const extraction = await extractTransactionsFromPDF(buffer)

    if (extraction.transactions.length === 0) {
      await db
        .from("bank_statements")
        .update({ status: "failed" })
        .eq("id", statement.id)

      return NextResponse.json(
        {
          error: extraction.errors[0] ?? "Could not extract transactions from this PDF",
          details: extraction.errors,
        },
        { status: 422 }
      )
    }

    // Update statement with date range
    await db
      .from("bank_statements")
      .update({
        status: "review",
        statement_date_from: extraction.statement_date_from,
        statement_date_to: extraction.statement_date_to,
      })
      .eq("id", statement.id)

    // Load org's chart of accounts for AI categorisation hints
    const { data: accounts } = await db
      .from("accounts")
      .select("id, code, name, type")
      .eq("organisation_id", organisationId)
      .eq("is_active", true)
      .order("code")

    // Build description→account_id lookup from committed transaction history
    const { data: historicalTx } = await db
      .from("transactions")
      .select("description, account_id")
      .eq("organisation_id", organisationId)
      .eq("status", "committed")
      .not("account_id", "is", null)
      .limit(500)

    const historyMap = new Map<string, string>()
    for (const tx of (historicalTx ?? [])) {
      if (tx.description && tx.account_id) {
        const key = tx.description.trim().toLowerCase()
        if (!historyMap.has(key)) historyMap.set(key, tx.account_id)
      }
    }

    // Insert extracted transactions with status 'pending'
    const txRecords = extraction.transactions.map((tx) => {
      const historyMatch = historyMap.get(tx.description.trim().toLowerCase())

      let suggestedAccountId: string | null = historyMatch ?? null
      if (!suggestedAccountId && accounts?.length) {
        const desc = tx.description.toLowerCase()
        const matched = (accounts as Array<{ id: string; code: string; name: string; type: string }>).find((acc) => {
          const name = acc.name.toLowerCase()
          return desc.includes(name) || name.split(" ").some((w) => w.length > 3 && desc.includes(w))
        })
        suggestedAccountId = matched?.id ?? null
      }

      return {
        organisation_id: organisationId,
        bank_account_id: bankAccountId,
        bank_statement_id: statement.id,
        date: tx.date,
        description: tx.description,
        debit_amount: tx.debit_amount.toFixed(2),
        credit_amount: tx.credit_amount.toFixed(2),
        balance: tx.balance !== null ? tx.balance.toFixed(2) : null,
        reference: tx.reference,
        account_id: suggestedAccountId,
        vat_type: "standard" as const,
        vat_amount: "0.00",
        status: "pending" as const,
      }
    })

    for (let i = 0; i < txRecords.length; i += 100) {
      const { error } = await db
        .from("transactions")
        .insert(txRecords.slice(i, i + 100))
      if (error) {
        console.error("[process] tx insert batch:", error)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        statement_id: statement.id,
        transactions_extracted: extraction.transactions.length,
        warnings: extraction.errors,
      },
    })
  } catch (error) {
    console.error("[POST /api/bank-statements/process]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
