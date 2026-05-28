import { NextRequest } from "next/server"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { extractTransactionsFromPDF } from "@/lib/claude/pdf-extractor"
import type { BusinessContext } from "@/lib/claude/pdf-extractor"
import type { SplitLeg } from "@/lib/ai/types"

export const maxDuration = 300

const MAX_FILE_SIZE = 10 * 1024 * 1024

type ProgressEvent =
  | { stage: "uploading";  progress: number; message: string }
  | { stage: "extracting"; progress: number; message: string }
  | { stage: "saving";     progress: number; message: string }
  | { stage: "done"; progress: 100; message: string; data: { statement_id: string; transactions_extracted: number; rules_applied: number; ai_categorised: number; warnings: string[] } }
  | { stage: "error"; progress: 0; message: string }

interface AllocationRule {
  id: string
  description_pattern: string
  match_type: "contains" | "exact" | "starts_with"
  transaction_type: "debit" | "credit" | "both"
  splits: SplitLeg[]
}

interface DbAccount {
  id: string
  code: string
  name: string
  type: string
  vat_type: string
}

function matchesRule(description: string, rule: AllocationRule, txType: "debit" | "credit"): boolean {
  if (rule.transaction_type !== "both" && rule.transaction_type !== txType) return false
  const desc = description.toLowerCase()
  const pattern = rule.description_pattern.toLowerCase()
  switch (rule.match_type) {
    case "exact":       return desc === pattern
    case "starts_with": return desc.startsWith(pattern)
    case "contains":
    default:            return desc.includes(pattern)
  }
}

const VAT_LABEL: Record<string, string> = {
  standard:   "15% VAT",
  zero_rated: "0% VAT",
  exempt:     "VAT exempt",
  none:       "no VAT",
}

function buildBusinessContext(
  companyName: string,
  accounts: DbAccount[],
  historyMap: Map<string, string>,   // description (lower) → account_id
  accountById: Map<string, DbAccount>
): BusinessContext {
  // Account lines grouped by type
  const order = ["income", "expense", "asset", "liability", "equity"]
  const byType = new Map<string, DbAccount[]>()
  for (const acc of accounts) {
    const list = byType.get(acc.type) ?? []
    list.push(acc)
    byType.set(acc.type, list)
  }

  const accountLines: string[] = []
  for (const type of order) {
    const list = byType.get(type)
    if (!list?.length) continue
    accountLines.push(`${type.toUpperCase()}:`)
    for (const acc of list.sort((a, b) => a.code.localeCompare(b.code))) {
      accountLines.push(`  ${acc.code} - ${acc.name} (${VAT_LABEL[acc.vat_type] ?? acc.vat_type})`)
    }
  }

  // History lines — top 60 most recent committed descriptions
  const historyLines: string[] = []
  let count = 0
  for (const [desc, accountId] of historyMap) {
    if (count >= 60) break
    const acc = accountById.get(accountId)
    if (acc) {
      historyLines.push(`  "${desc}" → ${acc.code} (${acc.name})`)
      count++
    }
  }

  return { companyName, accountLines, historyLines }
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()
  let ctrl: ReadableStreamDefaultController<Uint8Array> | null = null

  const stream = new ReadableStream<Uint8Array>({
    start(c) { ctrl = c },
    cancel() { ctrl = null },
  })

  const send = (event: ProgressEvent) => {
    try { ctrl?.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)) } catch {}
  }

  const close = () => {
    try { ctrl?.close() } catch {}
  }

  ;(async () => {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        send({ stage: "error", progress: 0, message: "AI extraction is not configured on this server" })
        return
      }
      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        send({ stage: "error", progress: 0, message: "Server configuration error" })
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authClient = (await createServerClient()) as any
      const { data: { user }, error: authError } = await authClient.auth.getUser()
      if (authError || !user) {
        send({ stage: "error", progress: 0, message: "Unauthorised" })
        return
      }

      const formData = await request.formData()
      const file           = formData.get("file")            as File   | null
      const organisationId = formData.get("organisation_id") as string | null
      const bankAccountId  = formData.get("bank_account_id") as string | null

      if (!file || !organisationId || !bankAccountId) {
        send({ stage: "error", progress: 0, message: "file, organisation_id, and bank_account_id are required" })
        return
      }
      if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
        send({ stage: "error", progress: 0, message: "Only PDF files accepted" })
        return
      }
      if (file.size > MAX_FILE_SIZE) {
        send({ stage: "error", progress: 0, message: "File too large (max 10MB)" })
        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = (await createServiceRoleClient()) as any

      const { data: membership } = await db
        .from("organisation_members")
        .select("role")
        .eq("organisation_id", organisationId)
        .eq("user_id", user.id)
        .single()
      if (!membership || !["admin", "editor"].includes(membership.role)) {
        send({ stage: "error", progress: 0, message: "Forbidden" })
        return
      }

      const { data: bankAccount } = await db
        .from("bank_accounts")
        .select("id, name")
        .eq("id", bankAccountId)
        .eq("organisation_id", organisationId)
        .single()
      if (!bankAccount) {
        send({ stage: "error", progress: 0, message: "Bank account not found" })
        return
      }

      send({ stage: "uploading", progress: 10, message: "Loading business context…" })

      // ── Load business context BEFORE calling Claude ────────────────────────
      const [orgResult, accountsResult, historicalTxResult, rulesResult] = await Promise.all([
        db.from("organisations").select("name").eq("id", organisationId).single(),
        db.from("accounts")
          .select("id, code, name, type, vat_type")
          .eq("organisation_id", organisationId)
          .eq("is_active", true)
          .order("code"),
        db.from("transactions")
          .select("description, account_id")
          .eq("organisation_id", organisationId)
          .eq("status", "committed")
          .not("account_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(500),
        db.from("allocation_rules")
          .select("id, description_pattern, match_type, transaction_type, splits")
          .eq("user_id", user.id)
          .order("times_applied", { ascending: false }),
      ])

      const companyName = (orgResult.data?.name as string) ?? "Unknown"
      const accounts    = (accountsResult.data ?? []) as DbAccount[]
      const rules       = (rulesResult.data ?? []) as AllocationRule[]

      // Build lookup maps
      const accountsByCode = new Map<string, string>()   // code  → id
      const accountById    = new Map<string, DbAccount>() // id    → account
      for (const acc of accounts) {
        accountsByCode.set(acc.code, acc.id)
        accountById.set(acc.id, acc)
      }

      // History map: description (lower) → account_id (insertion order = recency)
      const historyMap = new Map<string, string>()
      for (const tx of (historicalTxResult.data ?? [])) {
        if (tx.description && tx.account_id) {
          const key = tx.description.trim().toLowerCase()
          if (!historyMap.has(key)) historyMap.set(key, tx.account_id)
        }
      }

      const businessContext = accounts.length
        ? buildBusinessContext(companyName, accounts, historyMap, accountById)
        : undefined

      send({ stage: "uploading", progress: 20, message: "Uploading PDF to secure storage…" })

      const filePath = `${organisationId}/${bankAccountId}/${Date.now()}_${file.name}`
      const buffer   = await file.arrayBuffer()
      const { error: uploadError } = await db.storage
        .from("bank-statements")
        .upload(filePath, buffer, { contentType: "application/pdf", upsert: false })

      if (uploadError) {
        console.error("[process] storage upload:", uploadError)
        send({ stage: "error", progress: 0, message: "Failed to store file" })
        return
      }

      const { data: statement, error: stmtError } = await db
        .from("bank_statements")
        .insert({
          organisation_id: organisationId,
          bank_account_id: bankAccountId,
          file_name:       file.name,
          file_path:       filePath,
          status:          "processing",
          uploaded_by:     user.id,
        })
        .select("id")
        .single()

      if (stmtError || !statement) {
        console.error("[process] statement insert:", stmtError)
        send({ stage: "error", progress: 0, message: "Internal server error" })
        return
      }

      const contextMsg = businessContext
        ? `Reading statement with context for ${companyName}…`
        : "AI is reading your statement…"
      send({ stage: "extracting", progress: 30, message: contextMsg })

      // ── Claude extraction — now enriched with business context ─────────────
      const extraction = await extractTransactionsFromPDF(buffer, businessContext)

      if (extraction.transactions.length === 0) {
        await db.from("bank_statements").update({ status: "failed" }).eq("id", statement.id)
        send({ stage: "error", progress: 0, message: extraction.errors[0] ?? "Could not extract transactions from this PDF" })
        return
      }

      send({ stage: "saving", progress: 82, message: `Applying rules and saving ${extraction.transactions.length} transactions…` })

      await db
        .from("bank_statements")
        .update({
          status:               "review",
          statement_date_from:  extraction.statement_date_from,
          statement_date_to:    extraction.statement_date_to,
        })
        .eq("id", statement.id)

      const appliedRuleIds  = new Set<string>()
      const splitQueue: Array<{ txIdx: number; splits: SplitLeg[] }> = []
      let aiCategorisedCount = 0

      const txRecords = extraction.transactions.map((tx, idx) => {
        const txType: "debit" | "credit" = tx.debit_amount > 0 ? "debit" : "credit"
        const totalAmount = txType === "debit" ? tx.debit_amount : tx.credit_amount

        // ── Priority 1: allocation rules (handle intercompany splits) ─────────
        // Only match rules that have splits configured — rules seeded from Excel
        // import have splits:[] (pending org assignment) and must not block categorisation.
        const matchedRule = rules.find((r) => r.splits.length > 0 && matchesRule(tx.description, r, txType))
        if (matchedRule) {
          appliedRuleIds.add(matchedRule.id)

          if (matchedRule.splits.length === 1) {
            return {
              organisation_id:          organisationId,
              bank_account_id:          bankAccountId,
              bank_statement_id:        statement.id,
              date:                     tx.date,
              description:              tx.description,
              debit_amount:             tx.debit_amount.toFixed(2),
              credit_amount:            tx.credit_amount.toFixed(2),
              balance:                  tx.balance !== null ? tx.balance.toFixed(2) : null,
              reference:                tx.reference,
              account_id:               matchedRule.splits[0].account_id,
              allocated_organisation_id: matchedRule.splits[0].organisation_id,
              is_split:                 false,
              vat_type:                 "standard" as const,
              vat_amount:               "0.00",
              status:                   "pending" as const,
            }
          } else {
            const legsWithAmounts = matchedRule.splits.map((leg) => ({
              ...leg,
              amount: parseFloat((totalAmount * leg.percentage / 100).toFixed(2)),
            }))
            splitQueue.push({ txIdx: idx, splits: legsWithAmounts })
            return {
              organisation_id:          organisationId,
              bank_account_id:          bankAccountId,
              bank_statement_id:        statement.id,
              date:                     tx.date,
              description:              tx.description,
              debit_amount:             tx.debit_amount.toFixed(2),
              credit_amount:            tx.credit_amount.toFixed(2),
              balance:                  tx.balance !== null ? tx.balance.toFixed(2) : null,
              reference:                tx.reference,
              account_id:               null,
              allocated_organisation_id: null,
              is_split:                 true,
              vat_type:                 "standard" as const,
              vat_amount:               "0.00",
              status:                   "pending" as const,
            }
          }
        }

        // ── Priority 2: Claude's suggested account code ────────────────────────
        let suggestedAccountId: string | null = null
        if (tx.suggested_account_code) {
          const claudeId = accountsByCode.get(tx.suggested_account_code)
          if (claudeId) {
            suggestedAccountId = claudeId
            aiCategorisedCount++
          }
        }

        // ── Priority 3: exact history match (same description, committed before) ─
        if (!suggestedAccountId) {
          suggestedAccountId = historyMap.get(tx.description.trim().toLowerCase()) ?? null
        }

        // ── Priority 4: keyword match on account names ─────────────────────────
        if (!suggestedAccountId) {
          const desc = tx.description.toLowerCase()
          const matched = accounts.find((acc) => {
            const name = acc.name.toLowerCase()
            return desc.includes(name) || name.split(" ").some((w) => w.length > 3 && desc.includes(w))
          })
          suggestedAccountId = matched?.id ?? null
        }

        return {
          organisation_id:          organisationId,
          bank_account_id:          bankAccountId,
          bank_statement_id:        statement.id,
          date:                     tx.date,
          description:              tx.description,
          debit_amount:             tx.debit_amount.toFixed(2),
          credit_amount:            tx.credit_amount.toFixed(2),
          balance:                  tx.balance !== null ? tx.balance.toFixed(2) : null,
          reference:                tx.reference,
          account_id:               suggestedAccountId,
          allocated_organisation_id: null,
          is_split:                 false,
          vat_type:                 "standard" as const,
          vat_amount:               "0.00",
          status:                   "pending" as const,
        }
      })

      // ── Insert transactions in batches ────────────────────────────────────
      const insertedIds: string[] = []
      for (let i = 0; i < txRecords.length; i += 100) {
        const { data: inserted, error } = await db
          .from("transactions")
          .insert(txRecords.slice(i, i + 100))
          .select("id")
        if (error) console.error("[process] tx insert batch:", error)
        if (inserted) insertedIds.push(...inserted.map((r: { id: string }) => r.id))
      }

      // ── Insert split rows ─────────────────────────────────────────────────
      if (splitQueue.length > 0 && insertedIds.length === txRecords.length) {
        const splitRows = splitQueue.flatMap(({ txIdx, splits }) =>
          splits.map((leg) => ({
            transaction_id:   insertedIds[txIdx],
            organisation_id:  leg.organisation_id,
            account_id:       leg.account_id,
            percentage:       leg.percentage,
            amount:           leg.amount ?? 0,
            vat_type:         "standard",
            vat_amount:       0,
            is_intercompany:  leg.is_intercompany ?? false,
          }))
        )
        const { error: splitErr } = await db.from("transaction_splits").insert(splitRows)
        if (splitErr) console.error("[process] split insert:", splitErr)
      }

      // ── Increment times_applied on matched rules ───────────────────────────
      if (appliedRuleIds.size > 0) {
        const { data: matchedRules } = await db
          .from("allocation_rules")
          .select("id, times_applied")
          .in("id", [...appliedRuleIds])
        for (const r of (matchedRules ?? [])) {
          await db
            .from("allocation_rules")
            .update({ times_applied: r.times_applied + 1, last_applied_at: new Date().toISOString() })
            .eq("id", r.id)
        }
      }

      const categorisedMsg = aiCategorisedCount > 0
        ? `${extraction.transactions.length} transactions extracted · ${aiCategorisedCount} categorised by AI`
        : `${extraction.transactions.length} transactions extracted`

      send({
        stage: "done",
        progress: 100,
        message: categorisedMsg,
        data: {
          statement_id:           statement.id,
          transactions_extracted: extraction.transactions.length,
          rules_applied:          appliedRuleIds.size,
          ai_categorised:         aiCategorisedCount,
          warnings:               extraction.errors,
        },
      })
    } catch (err) {
      console.error("[POST /api/bank-statements/process]:", err)
      send({ stage: "error", progress: 0, message: "Internal server error" })
    } finally {
      close()
    }
  })()

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  })
}
