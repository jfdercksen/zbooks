import { NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
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
    const action = formData.get("action") as string | null  // "list" | "preview" | "import"

    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()

    // ── List sheets — no org required, auth only ──────────────────────────────
    if (action === "list") {
      const sheets = getSheetNames(buffer)
      return NextResponse.json({ success: true, data: { sheets } })
    }

    // All other actions require organisation_id + membership
    if (!organisationId) {
      return NextResponse.json({ error: "organisation_id is required" }, { status: 400 })
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

    if (!sheetName) {
      return NextResponse.json({ error: "sheet_name is required" }, { status: 400 })
    }

    const parsed = parseExcelSheet(buffer, sheetName)

    // ── Preview ───────────────────────────────────────────────────────────────
    if (action === "preview") {
      const namedSupplierCount = parsed.rows.filter((r) => r.needsNewAccount).length
      return NextResponse.json({
        success: true,
        data: {
          parsed,
          namedSupplierCount,
          allocationRuleCount: parsed.allocationRules.length,
        },
      })
    }

    // ── Import ────────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    // Load this org's chart of accounts
    const { data: accountsData } = await db
      .from("accounts")
      .select("id, code, name, type, vat_type")
      .eq("organisation_id", organisationId)
      .eq("is_active", true)

    if (!accountsData?.length) {
      return NextResponse.json(
        { error: "No accounts found. Create the organisation first." },
        { status: 400 }
      )
    }

    const accounts = accountsData as Array<{ id: string; code: string; name: string; type: string; vat_type: string }>
    const accountsByCode = new Map<string, string>()     // code → id
    const accountsByName = new Map<string, string>()     // lower-name → id

    for (const acc of accounts) {
      accountsByCode.set(acc.code, acc.id)
      accountsByName.set(acc.name.toLowerCase().trim(), acc.id)
    }

    // ── Create named supplier accounts (COS rows that need new account codes) ─
    const labelToAccountId = new Map<string, string>()   // row label → resolved account id

    const namedSupplierRows = parsed.rows.filter((r) => r.needsNewAccount)
    for (const row of namedSupplierRows) {
      const nameKey = row.label.trim().toLowerCase()

      // Already exists by name?
      if (accountsByName.has(nameKey)) {
        labelToAccountId.set(row.label, accountsByName.get(nameKey)!)
        continue
      }

      // Find next available code in 5001–5099 range
      let nextCode = 5001
      while (accountsByCode.has(String(nextCode)) && nextCode < 5099) nextCode++

      const codeStr = String(nextCode)
      const { data: newAcc, error: accErr } = await db
        .from("accounts")
        .insert({
          organisation_id: organisationId,
          code: codeStr,
          name: row.label.trim(),
          type: "expense",
          vat_type: "standard",
          is_active: true,
        })
        .select("id")
        .single()

      if (accErr) {
        console.error("[POST /api/import/excel] create account:", accErr)
      } else if (newAcc) {
        accountsByCode.set(codeStr, newAcc.id)
        accountsByName.set(nameKey, newAcc.id)
        labelToAccountId.set(row.label, newAcc.id)
      }
    }

    // ── Ensure a bank account exists for historical transactions ─────────────
    const { data: bankAccountsData } = await db
      .from("bank_accounts")
      .select("id, name")
      .eq("organisation_id", organisationId)
      .order("created_at")

    const bankAccounts = (bankAccountsData ?? []) as Array<{ id: string; name: string }>
    let bankAccountId: string

    const historical = bankAccounts.find((b) => b.name.toLowerCase().includes("historical"))
    if (historical) {
      bankAccountId = historical.id
    } else if (bankAccounts.length) {
      bankAccountId = bankAccounts[0].id
    } else {
      const { data: newBank } = await db
        .from("bank_accounts")
        .insert({
          organisation_id: organisationId,
          name: "Historical Import",
          bank_name: "Historical Data",
          account_type: "cheque",
        })
        .select("id")
        .single()
      bankAccountId = newBank.id
    }

    // ── Build transaction records ─────────────────────────────────────────────
    const transactions: Record<string, unknown>[] = []

    for (const row of parsed.rows) {
      // Resolve account id: named supplier → labelToAccountId, otherwise → code map
      let accountId: string | null = null
      if (row.needsNewAccount) {
        accountId = labelToAccountId.get(row.label) ?? accountsByCode.get("5000") ?? null
      } else {
        accountId =
          accountsByCode.get(row.suggestedAccountCode) ??
          accountsByCode.get("5999") ??
          null
      }

      for (const [monthStr, amount] of Object.entries(row.amounts)) {
        const month = parseInt(monthStr)
        if (!amount || amount === 0) continue

        const lastDay = new Date(parsed.year, month, 0).getDate()
        const dateStr = `${parsed.year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`

        const isIncome = row.accountType === "income"

        const credit = isIncome ? amount : 0
        const debit  = isIncome ? 0 : amount

        const vatType = row.vatType
        const vatAmount = vatType === "standard" ? +(amount * 15 / 115).toFixed(2) : 0

        transactions.push({
          organisation_id: organisationId,
          bank_account_id: bankAccountId,
          date: dateStr,
          description: row.label.trim(),
          debit_amount: debit.toFixed(2),
          credit_amount: credit.toFixed(2),
          account_id: accountId,
          vat_type: vatType,
          vat_amount: vatAmount.toFixed(2),
          status: "committed",
          notes: `Imported from Excel — ${sheetName} (${parsed.year})`,
          is_split: false,
        })
      }
    }

    // ── Insert transactions in batches of 100 ────────────────────────────────
    let imported = 0
    for (let i = 0; i < transactions.length; i += 100) {
      const batch = transactions.slice(i, i + 100)
      const { error: batchErr } = await db.from("transactions").insert(batch)
      if (batchErr) {
        console.error("[POST /api/import/excel] batch insert:", batchErr)
        return NextResponse.json({ error: "Import failed: " + batchErr.message }, { status: 500 })
      }
      imported += batch.length
    }

    // ── Seed allocation rules (half/full expense split patterns) ─────────────
    // Rules are scoped to the user across all their orgs. Splits contain no org IDs
    // yet — the user will configure those after linking subsidiaries. We save the
    // pattern so the AI can surface them for manual completion.
    let rulesCreated = 0
    for (const rule of parsed.allocationRules) {
      const { data: existing } = await supabase
        .from("allocation_rules")
        .select("id")
        .eq("user_id", user.id)
        .ilike("description_pattern", rule.descriptionPattern)
        .maybeSingle()

      if (!existing) {
        const { error: ruleErr } = await supabase.from("allocation_rules").insert({
          user_id: user.id,
          description_pattern: rule.descriptionPattern,
          match_type: "contains",
          transaction_type: "debit",
          splits: [],          // org assignments configured separately in the UI
          is_intercompany: rule.note === "half",
          times_applied: 0,
        })
        if (!ruleErr) rulesCreated++
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        company: parsed.companyName,
        rows: parsed.rows.length,
        newAccountsCreated: namedSupplierRows.length,
        rulesCreated,
        year: parsed.year,
      },
    })
  } catch (error) {
    console.error("[POST /api/import/excel]:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
