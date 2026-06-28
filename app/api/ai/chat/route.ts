import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"
import type { AIAction, SplitLeg } from "@/lib/ai/types"

const RequestSchema = z.object({
  message: z.string().min(1).max(4000),
  context_statement_id: z.string().uuid().optional().nullable(),
  context_organisation_id: z.string().uuid().optional().nullable(),
})

// ─── context builder ────────────────────────────────────────────────────────

async function buildSystemPrompt(
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  statementId?: string | null,
): Promise<string> {
  // Load all orgs the user belongs to, with hierarchy
  const { data: orgs } = await db
    .from("organisations")
    .select("id, name, parent_organisation_id")
    .in(
      "id",
      (await db.from("organisation_members").select("organisation_id").eq("user_id", userId)).data?.map(
        (m: { organisation_id: string }) => m.organisation_id
      ) ?? []
    )

  const orgList = (orgs ?? []) as Array<{ id: string; name: string; parent_organisation_id: string | null }>

  // Build hierarchy display
  const topLevel = orgList.filter((o) => !o.parent_organisation_id)
  const children = orgList.filter((o) => o.parent_organisation_id)

  let orgHierarchy = ""
  for (const org of topLevel) {
    const subs = children.filter((c) => c.parent_organisation_id === org.id)
    orgHierarchy += `- ${org.name} [id: ${org.id}]${subs.length ? " (Holding Company)" : ""}\n`
    for (const sub of subs) {
      orgHierarchy += `  - ${sub.name} [id: ${sub.id}]\n`
    }
  }
  if (!orgHierarchy) orgHierarchy = "(no organisations found)"

  // Load accounts per org (abbreviated)
  const orgIds = orgList.map((o) => o.id)
  const { data: accounts } = await db
    .from("accounts")
    .select("id, code, name, type, organisation_id")
    .in("organisation_id", orgIds.length ? orgIds : ["none"])
    .eq("is_active", true)
    .order("code")

  const acctsByOrg: Record<string, string[]> = {}
  for (const acc of (accounts ?? []) as Array<{ id: string; code: string; name: string; type: string; organisation_id: string }>) {
    if (!acctsByOrg[acc.organisation_id]) acctsByOrg[acc.organisation_id] = []
    acctsByOrg[acc.organisation_id].push(`${acc.code} ${acc.name} (${acc.type}) [id:${acc.id}]`)
  }

  let accountsSection = ""
  for (const org of orgList) {
    const accts = acctsByOrg[org.id] ?? []
    accountsSection += `\n${org.name}:\n${accts.slice(0, 30).join("\n") || "  (no accounts)"}\n`
  }

  // Load clients per org
  const { data: clientsData } = await db
    .from("clients")
    .select("id, organisation_id, name")
    .in("organisation_id", orgIds.length ? orgIds : ["none"])
    .eq("is_active", true)
    .order("name")

  const clientsByOrg: Record<string, Array<{ id: string; name: string }>> = {}
  for (const c of (clientsData ?? []) as Array<{ id: string; organisation_id: string; name: string }>) {
    if (!clientsByOrg[c.organisation_id]) clientsByOrg[c.organisation_id] = []
    clientsByOrg[c.organisation_id].push({ id: c.id, name: c.name })
  }

  let clientsSection = ""
  for (const org of orgList) {
    const clients = clientsByOrg[org.id] ?? []
    if (clients.length) {
      clientsSection += `${org.name}: ${clients.map((c) => `${c.name} [id:${c.id}]`).join(", ")}\n`
    }
  }
  if (!clientsSection) clientsSection = "(none registered)"

  // Load allocation rules
  const { data: rules } = await db
    .from("allocation_rules")
    .select("id, description_pattern, match_type, transaction_type, splits, is_intercompany")
    .eq("user_id", userId)
    .order("times_applied", { ascending: false })
    .limit(50)

  let rulesSection = "(none saved yet)"
  if (rules?.length) {
    rulesSection = (rules as Array<{ id: string; description_pattern: string; match_type: string; transaction_type: string; splits: SplitLeg[]; is_intercompany: boolean }>)
      .map((r) => {
        const legsText = r.splits.map((s) => `${s.percentage}% → ${s.organisation_name} / ${s.account_name}`).join(", ")
        return `[${r.id}] "${r.description_pattern}" (${r.match_type}, ${r.transaction_type}): ${legsText}`
      })
      .join("\n")
  }

  // Load current statement transactions + identify statement org if in review context
  let txSection = ""
  let primaryOrgId: string | null = null
  let primaryOrgName: string | null = null

  if (statementId) {
    const { data: stmtRow } = await db
      .from("bank_statements")
      .select("organisation_id, organisations(name)")
      .eq("id", statementId)
      .single()

    if (stmtRow) {
      primaryOrgId = stmtRow.organisation_id
      primaryOrgName = (stmtRow.organisations as { name: string } | null)?.name ?? null
    }

    const { data: txs } = await db
      .from("transactions")
      .select("id, date, description, debit_amount, credit_amount, account_id, is_split, allocated_organisation_id, status")
      .eq("bank_statement_id", statementId)
      .order("date")

    if (txs?.length) {
      txSection = "\n\nCURRENT STATEMENT TRANSACTIONS:\n" +
        (txs as Array<{
          id: string; date: string; description: string
          debit_amount: string; credit_amount: string
          account_id: string | null; is_split: boolean
          allocated_organisation_id: string | null; status: string
        }>).map((t) => {
          const amt = parseFloat(t.debit_amount) > 0
            ? `-R${parseFloat(t.debit_amount).toFixed(2)} (debit)`
            : `+R${parseFloat(t.credit_amount).toFixed(2)} (credit)`
          const allocation = t.is_split ? "SPLIT" : t.allocated_organisation_id
            ? `→ org:${t.allocated_organisation_id}` : "unallocated"
          return `[${t.id}] ${t.date} | ${t.description} | ${amt} | ${allocation}`
        }).join("\n")
    }
  }

  // Build a primary-org-first accounts section
  let primaryAccountsNote = ""
  if (primaryOrgId && primaryOrgName) {
    const primaryAccts = acctsByOrg[primaryOrgId] ?? []
    primaryAccountsNote = `
STATEMENT ORGANISATION: ${primaryOrgName} [id: ${primaryOrgId}]
⚠️ ACCOUNT ID RULE: For ALL assign_transaction and split_transaction actions, you MUST use account_id values from ${primaryOrgName}'s chart below — never from a subsidiary's chart. The review page only loads this org's accounts; using any other org's account IDs will cause the category to appear blank.

${primaryOrgName} ACCOUNTS (use these IDs):
${primaryAccts.join("\n") || "  (no accounts — will be auto-seeded)"}
`
  }

  return `You are a bookkeeping AI agent for Z-Books. You help the user manage the finances of their group of companies.

ORGANISATION HIERARCHY:
${orgHierarchy}
${primaryAccountsNote}
FULL CHART OF ACCOUNTS (all orgs — for reference only, use statement org IDs in actions):
${accountsSection}

EXTERNAL CLIENTS (registered per organisation — costs incurred for them are Cost of Sales):
${clientsSection}

SAVED ALLOCATION RULES:
${rulesSection}
${txSection}

INSTRUCTIONS:
1. Help allocate bank transactions to the correct organisation and account.
2. Split transactions across multiple organisations by percentage when asked.
3. Learn: when the user gives an instruction, save it as a rule so future statements auto-apply it.
4. Answer questions about income, expenses, and balances across any or all businesses.
5. Flag intercompany transactions (e.g. one group entity pays another) — these are eliminated in consolidated reports.
6. For income: use credit_amount. For expenses: use debit_amount.
7. CLIENT BILLING: When a cost is incurred on behalf of an external client (e.g. Facebook ads for Fire Risk):
   - The split leg stays under the OWNING organisation (e.g. Ai Dynamic Advisory)
   - Use the owning org's Cost of Sales account (type "expense", name contains "Cost of Sales" or "5000")
   - Add "client_id": "<uuid from EXTERNAL CLIENTS>" and "client_name": "<client name>" to the split leg
   - Do NOT create a separate organisation for the client

⚠️ OUTPUT FORMAT — CRITICAL: Your ENTIRE response must be one valid JSON object. Do NOT write any text before or after it. Do NOT use markdown or code fences. Start your response with { and end with }. If you add any text outside the JSON the UI will display raw code to the user and all actions will be lost.

Required structure:
{"message":"Your conversational response to the user","actions":[]}

ACTION TYPES (include in the actions array when appropriate):

Split a transaction across organisations (percentages must sum to 100):
{"type":"split_transaction","description":"Human-readable summary","transaction_id":"uuid","splits":[{"organisation_id":"uuid","organisation_name":"name","account_id":"uuid or null","account_name":"name or null","percentage":50,"amount":500.00,"is_intercompany":false,"client_id":null,"client_name":null}]}

For a client-billing leg, set client_id and client_name and use the Cost of Sales account:
{"organisation_id":"owning-org-uuid","organisation_name":"Ai Dynamic Advisory","account_id":"cos-account-uuid","account_name":"5000 Cost of Sales","percentage":34.78,"amount":200.00,"is_intercompany":false,"client_id":"fire-risk-client-uuid","client_name":"Fire Risk"}

Assign a transaction 100% to one organisation:
{"type":"assign_transaction","description":"Human-readable summary","transaction_id":"uuid","organisation_id":"uuid","organisation_name":"name","account_id":"uuid or null","account_name":"name or null"}

Save a new allocation rule for future statements:
{"type":"save_rule","description":"Human-readable summary","rule":{"description_pattern":"SANLAM","match_type":"contains","transaction_type":"debit","splits":[...],"is_intercompany":false}}

Update an existing rule (use the rule id from SAVED ALLOCATION RULES above):
{"type":"update_rule","description":"Human-readable summary","rule_id":"uuid","splits":[...]}

Delete a rule:
{"type":"delete_rule","description":"Human-readable summary","rule_id":"uuid"}

Rename an existing account (use the account id from the chart of accounts above):
{"type":"rename_account","description":"Human-readable summary","organisation_id":"uuid","account_id":"uuid","new_name":"New Account Name"}

Create a new account (code is auto-assigned; account_type must be income/expense/asset/liability/equity):
{"type":"create_account","description":"Human-readable summary","organisation_id":"uuid","name":"Account Name","account_type":"expense","vat_type":"standard"}

IMPORTANT RULES:
- Always include a clear "message" field — this is what the user reads.
- Only include actions when you have enough information to act. If you need more details (e.g. which account to use), ask first.
- For splits: amount = transaction_amount * (percentage / 100), rounded to 2 decimal places.
- is_intercompany = true ONLY when both sides of a split are organisations within the same group.
- If the user asks a financial question, answer it using the transaction data above. Do not include actions.
- Respond in the same language the user writes in.
- CHART OF ACCOUNTS: You can rename existing accounts and create new ones when the user asks. Match the account by name from the chart above to get its id. For create_account, default to the statement organisation unless the user specifies otherwise.
- LIMIT: Include at most 50 actions per response. If more transactions remain, say so in the message and the user can ask again.`
}

// ─── route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "AI is not configured on this server" }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    const { message, context_statement_id, context_organisation_id } = parsed.data

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    // Load recent chat history for this user (last 40 messages = 20 turns)
    const { data: history } = await db
      .from("user_ai_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40)

    const priorMessages = ((history ?? []) as Array<{ role: string; content: string }>)
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

    const systemPrompt = await buildSystemPrompt(user.id, db, context_statement_id)

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        ...priorMessages,
        { role: "user", content: message },
      ],
    })

    const rawText = response.content[0].type === "text" ? response.content[0].text : "{}"

    // Parse the JSON response — try multiple strategies in order
    let assistantMessage = "I'm sorry, I couldn't process that request."
    let actions: AIAction[] = []

    function tryParseJson(str: string): { message: string; actions: AIAction[] } | null {
      try {
        const p = JSON.parse(str)
        // Expected format: {message, actions}
        if (typeof p.message === "string") {
          return { message: p.message, actions: Array.isArray(p.actions) ? p.actions : [] }
        }
        // {actions: [...]} without a message field
        if (!Array.isArray(p) && Array.isArray(p.actions) && p.actions.length > 0) {
          const n = p.actions.length
          return { message: `I've identified ${n} transaction${n > 1 ? "s" : ""} to categorise.`, actions: p.actions as AIAction[] }
        }
        // Bare array of actions: [{type:"assign_transaction",...}, ...]
        if (Array.isArray(p)) {
          const acts = p.filter((item) => typeof item?.type === "string") as AIAction[]
          if (acts.length > 0) {
            return { message: `I've identified ${acts.length} transaction${acts.length > 1 ? "s" : ""} to categorise.`, actions: acts }
          }
        }
      } catch { /* not valid JSON */ }
      return null
    }

    // Extracts complete action objects from potentially truncated text by tracking brace depth.
    // Used when JSON parsing fails (e.g. response cut off mid-array).
    function extractPartialActions(text: string): AIAction[] {
      const actions: AIAction[] = []
      const typePattern = /"type"\s*:\s*"(?:assign_transaction|split_transaction|save_rule|update_rule|delete_rule|rename_account|create_account)"/g
      let m: RegExpExecArray | null
      while ((m = typePattern.exec(text)) !== null) {
        let objStart = m.index
        while (objStart > 0 && text[objStart] !== "{") objStart--
        if (text[objStart] !== "{") continue
        let depth = 0, objEnd = -1
        for (let i = objStart; i < text.length; i++) {
          if (text[i] === "{") depth++
          else if (text[i] === "}") { depth--; if (depth === 0) { objEnd = i; break } }
        }
        if (objEnd === -1) break // truncated — no more complete objects
        try {
          const obj = JSON.parse(text.slice(objStart, objEnd + 1))
          if (obj.type) actions.push(obj as AIAction)
        } catch { /* skip malformed */ }
        typePattern.lastIndex = objEnd + 1
      }
      return actions
    }

    // Strategy 1: response is bare JSON (most common)
    let extracted = tryParseJson(rawText.trim())

    // Strategy 2: JSON in a code fence — also matches UNCLOSED fences (truncated responses)
    if (!extracted) {
      const fenceMatch = rawText.match(/```(?:json)?\s*\n?([\s\S]*?)(?:```|$)/)
      if (fenceMatch) {
        const fenceContent = fenceMatch[1].trim()
        extracted = tryParseJson(fenceContent)
        // If the fenced JSON was truncated and didn't parse, rescue any complete action objects
        if (!extracted) {
          const rescued = extractPartialActions(fenceContent)
          if (rescued.length > 0) {
            extracted = { message: `I've identified ${rescued.length} transaction${rescued.length > 1 ? "s" : ""} to categorise.`, actions: rescued }
          }
        }
      }
    }

    // Strategy 3: JSON object anywhere in the text
    if (!extracted) {
      const braceStart = rawText.indexOf("{")
      const braceEnd = rawText.lastIndexOf("}")
      if (braceStart !== -1 && braceEnd > braceStart) {
        extracted = tryParseJson(rawText.slice(braceStart, braceEnd + 1))
      }
    }

    // Strategy 4: partial extraction from the full raw text (last resort for truncated responses)
    if (!extracted) {
      const rescued = extractPartialActions(rawText)
      if (rescued.length > 0) {
        extracted = { message: `I've identified ${rescued.length} transaction${rescued.length > 1 ? "s" : ""} to categorise.`, actions: rescued }
      }
    }

    if (extracted) {
      assistantMessage = extracted.message
      actions = extracted.actions
    } else {
      // Couldn't extract structured JSON — show raw text, no actions
      assistantMessage = rawText
    }

    // Persist both messages
    await db.from("user_ai_messages").insert([
      {
        user_id: user.id,
        role: "user",
        content: message,
        context_organisation_id: context_organisation_id ?? null,
        context_statement_id: context_statement_id ?? null,
      },
      {
        user_id: user.id,
        role: "assistant",
        content: assistantMessage,
        context_organisation_id: context_organisation_id ?? null,
        context_statement_id: context_statement_id ?? null,
      },
    ])

    return NextResponse.json({ message: assistantMessage, actions }, { status: 200 })
  } catch (err) {
    console.error("[POST /api/ai/chat]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
