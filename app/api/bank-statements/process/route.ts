import { NextRequest } from "next/server"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import { extractTransactionsFromPDF } from "@/lib/claude/pdf-extractor"
import type { SplitLeg } from "@/lib/ai/types"

export const maxDuration = 300 // 5 minutes — Claude extraction can be slow on large statements

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

type ProgressEvent =
  | { stage: "uploading"; progress: number; message: string }
  | { stage: "extracting"; progress: number; message: string }
  | { stage: "saving"; progress: number; message: string }
  | { stage: "done"; progress: 100; message: string; data: { statement_id: string; transactions_extracted: number; rules_applied: number; warnings: string[] } }
  | { stage: "error"; progress: 0; message: string }

interface AllocationRule {
  id: string
  description_pattern: string
  match_type: "contains" | "exact" | "starts_with"
  transaction_type: "debit" | "credit" | "both"
  splits: SplitLeg[]
}

function matchesRule(description: string, rule: AllocationRule, txType: "debit" | "credit"): boolean {
  if (rule.transaction_type !== "both" && rule.transaction_type !== txType) return false
  const desc = description.toLowerCase()
  const pattern = rule.description_pattern.toLowerCase()
  switch (rule.match_type) {
    case "exact": return desc === pattern
    case "starts_with": return desc.startsWith(pattern)
    case "contains":
    default: return desc.includes(pattern)
  }
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
        console.error("[process] ANTHROPIC_API_KEY is not set")
        send({ stage: "error", progress: 0, message: "AI extraction is not configured on this server" })
        return
      }

      if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
        console.error("[process] SUPABASE_SERVICE_ROLE_KEY is not set")
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
      const file = formData.get("file") as File | null
      const organisationId = formData.get("organisation_id") as string | null
      const bankAccountId = formData.get("bank_account_id") as string | null

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

      send({ stage: "uploading", progress: 15, message: "Uploading PDF to secure storage…" })

      const filePath = `${organisationId}/${bankAccountId}/${Date.now()}_${file.name}`
      const buffer = await file.arrayBuffer()
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
          file_name: file.name,
          file_path: filePath,
          status: "processing",
          uploaded_by: user.id,
        })
        .select("id")
        .single()

      if (stmtError || !statement) {
        console.error("[process] statement insert:", stmtError)
        send({ stage: "error", progress: 0, message: "Internal server error" })
        return
      }

      send({ stage: "extracting", progress: 25, message: "AI is reading your statement…" })

      const extraction = await extractTransactionsFromPDF(buffer)

      if (extraction.transactions.length === 0) {
        await db.from("bank_statements").update({ status: "failed" }).eq("id", statement.id)
        send({ stage: "error", progress: 0, message: extraction.errors[0] ?? "Could not extract transactions from this PDF" })
        return
      }

      send({ stage: "saving", progress: 82, message: `Applying rules and saving ${extraction.transactions.length} transactions…` })

      await db
        .from("bank_statements")
        .update({
          status: "review",
          statement_date_from: extraction.statement_date_from,
          statement_date_to: extraction.statement_date_to,
        })
        .eq("id", statement.id)

      // Load accounts for keyword matching
      const { data: accounts } = await db
        .from("accounts")
        .select("id, code, name, type")
        .eq("organisation_id", organisationId)
        .eq("is_active", true)
        .order("code")

      // Load historical transaction assignments for fallback matching
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

      // Load user's allocation rules — these take priority over history/keyword matching
      const { data: rulesData } = await db
        .from("allocation_rules")
        .select("id, description_pattern, match_type, transaction_type, splits")
        .eq("user_id", user.id)
        .order("times_applied", { ascending: false })

      const rules = (rulesData ?? []) as AllocationRule[]

      // Track which rule IDs were applied so we can increment times_applied
      const appliedRuleIds = new Set<string>()

      // For split transactions: queue {txIdx, splits} to insert after main tx insert
      const splitQueue: Array<{ txIdx: number; splits: SplitLeg[] }> = []

      const txRecords = extraction.transactions.map((tx, idx) => {
        const txType: "debit" | "credit" = tx.debit_amount > 0 ? "debit" : "credit"
        const totalAmount = txType === "debit" ? tx.debit_amount : tx.credit_amount

        // 1. Check allocation rules first (user-defined, highest priority)
        const matchedRule = rules.find((r) => matchesRule(tx.description, r, txType))
        if (matchedRule) {
          appliedRuleIds.add(matchedRule.id)

          if (matchedRule.splits.length === 1) {
            // Simple single-org assignment
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
              account_id: matchedRule.splits[0].account_id,
              allocated_organisation_id: matchedRule.splits[0].organisation_id,
              is_split: false,
              vat_type: "standard" as const,
              vat_amount: "0.00",
              status: "pending" as const,
            }
          } else {
            // Multi-leg split — queue the split rows, calculate amounts per leg
            const legsWithAmounts = matchedRule.splits.map((leg) => ({
              ...leg,
              amount: parseFloat((totalAmount * leg.percentage / 100).toFixed(2)),
            }))
            splitQueue.push({ txIdx: idx, splits: legsWithAmounts })
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
              account_id: null,
              allocated_organisation_id: null,
              is_split: true,
              vat_type: "standard" as const,
              vat_amount: "0.00",
              status: "pending" as const,
            }
          }
        }

        // 2. Fall back to history / keyword matching (no rule matched)
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
          allocated_organisation_id: null,
          is_split: false,
          vat_type: "standard" as const,
          vat_amount: "0.00",
          status: "pending" as const,
        }
      })

      // Insert transactions in batches of 100
      const insertedIds: string[] = []
      for (let i = 0; i < txRecords.length; i += 100) {
        const { data: inserted, error } = await db
          .from("transactions")
          .insert(txRecords.slice(i, i + 100))
          .select("id")
        if (error) console.error("[process] tx insert batch:", error)
        if (inserted) insertedIds.push(...inserted.map((r: { id: string }) => r.id))
      }

      // Insert split rows for multi-leg transactions
      if (splitQueue.length > 0 && insertedIds.length === txRecords.length) {
        const splitRows = splitQueue.flatMap(({ txIdx, splits }) =>
          splits.map((leg) => ({
            transaction_id: insertedIds[txIdx],
            organisation_id: leg.organisation_id,
            account_id: leg.account_id,
            percentage: leg.percentage,
            amount: leg.amount ?? 0,
            vat_type: "standard",
            vat_amount: 0,
            is_intercompany: leg.is_intercompany ?? false,
          }))
        )
        const { error: splitErr } = await db.from("transaction_splits").insert(splitRows)
        if (splitErr) console.error("[process] split insert:", splitErr)
      }

      // Increment times_applied on matched rules (read-then-write is fine for a usage counter)
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

      send({
        stage: "done",
        progress: 100,
        message: `${extraction.transactions.length} transactions extracted`,
        data: {
          statement_id: statement.id,
          transactions_extracted: extraction.transactions.length,
          rules_applied: appliedRuleIds.size,
          warnings: extraction.errors,
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
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  })
}
