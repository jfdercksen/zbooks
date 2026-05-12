import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase/server"
import { parseExcelSheet, getSheetNames } from "@/lib/excel/importer"

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createServerClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const organisationId = formData.get("organisation_id") as string | null
    const sheetName = formData.get("sheet_name") as string | null
    const action = formData.get("action") as string | null // "preview" | "import"

    if (!file || !organisationId) {
      return NextResponse.json({ error: "file and organisation_id are required" }, { status: 400 })
    }

    // Verify membership
    const { data: membership } = await supabase
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", organisationId)
      .eq("user_id", user.id)
      .single()
    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const buffer = await file.arrayBuffer()

    // Just list sheets
    if (action === "list") {
      const sheets = getSheetNames(buffer)
      return NextResponse.json({ success: true, data: { sheets } })
    }

    if (!sheetName) {
      return NextResponse.json({ error: "sheet_name is required" }, { status: 400 })
    }

    const parsed = parseExcelSheet(buffer, sheetName)

    // Just preview — return rows without saving
    if (action === "preview") {
      return NextResponse.json({ success: true, data: { parsed } })
    }

    // === IMPORT ===
    // Load this org's chart of accounts
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, code, name, type, vat_type")
      .eq("organisation_id", organisationId)
      .eq("is_active", true)

    if (!accounts?.length) {
      return NextResponse.json({ error: "No accounts found. Create the organisation first." }, { status: 400 })
    }

    const accountsByCode = new Map<string, { id: string; vat_type: string }>()
    for (const acc of accounts) {
      accountsByCode.set(acc.code, { id: acc.id, vat_type: acc.vat_type })
    }

    // Find or create a "Historical Import" bank account
    let { data: bankAccounts } = await supabase
      .from("bank_accounts")
      .select("id, name")
      .eq("organisation_id", organisationId)
      .order("created_at")

    let bankAccountId: string
    const historical = bankAccounts?.find((b: { name: string }) =>
      b.name.toLowerCase().includes("historical")
    )

    if (historical) {
      bankAccountId = historical.id
    } else if (bankAccounts?.length) {
      // Use the first existing bank account
      bankAccountId = bankAccounts[0].id
    } else {
      // Create a placeholder
      const { data: newBankAccount } = await supabase
        .from("bank_accounts")
        .insert({
          organisation_id: organisationId,
          name: "Historical Import",
          bank_name: "Historical Data",
          account_type: "cheque",
        })
        .select("id")
        .single()
      bankAccountId = newBankAccount.id
    }

    // Build transaction records from parsed rows
    const transactions: Record<string, unknown>[] = []

    for (const row of parsed.rows) {
      const account = accountsByCode.get(row.suggestedAccountCode)
      const fallbackAccount = accountsByCode.get("5999")
      const resolvedAccount = account ?? fallbackAccount

      for (const [monthStr, amount] of Object.entries(row.amounts)) {
        const month = parseInt(monthStr)
        if (!amount || amount === 0) continue

        // Use last day of the month as transaction date
        const year = 2026
        const lastDay = new Date(year, month, 0).getDate()
        const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

        const isIncome = row.suggestedAccountCode === "4000" || row.suggestedAccountCode === "4001"
        const vatType = row.vatType

        transactions.push({
          organisation_id: organisationId,
          bank_account_id: bankAccountId,
          date: dateStr,
          description: row.label.trim(),
          debit_amount: isIncome ? "0.00" : amount.toFixed(2),
          credit_amount: isIncome ? amount.toFixed(2) : "0.00",
          account_id: resolvedAccount?.id ?? null,
          vat_type: vatType,
          vat_amount: vatType === "standard" ? (amount * 15 / 115).toFixed(2) : "0.00",
          status: "committed",
          notes: `Imported from Excel — ${sheetName} sheet`,
        })
      }
    }

    // Insert in batches of 100
    let imported = 0
    for (let i = 0; i < transactions.length; i += 100) {
      const batch = transactions.slice(i, i + 100)
      const { error } = await supabase.from("transactions").insert(batch)
      if (error) {
        console.error("[POST /api/import/excel] batch insert:", error)
        return NextResponse.json({ error: "Import failed: " + error.message }, { status: 500 })
      }
      imported += batch.length
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        company: parsed.companyName,
        rows: parsed.rows.length,
      },
    })
  } catch (error) {
    console.error("[POST /api/import/excel]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
