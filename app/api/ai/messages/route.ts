import { NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statementId = searchParams.get("statement_id")
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "100"), 200)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    let query = db
      .from("user_ai_messages")
      .select("id, role, content, context_organisation_id, context_statement_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(limit)

    if (statementId) {
      query = query.eq("context_statement_id", statementId)
    }

    const { data, error } = await query
    if (error) {
      console.error("[GET /api/ai/messages]:", error)
      return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
    }

    // Backward compat: old messages may have stored the raw Claude response (text + JSON code block)
    // instead of just the extracted message field. Re-parse here so history renders correctly.
    function tryExtractJson(raw: string): { message: string; actions: unknown[] } | null {
      function tryParse(s: string): { message: string; actions: unknown[] } | null {
        try {
          const p = JSON.parse(s)
          if (typeof p.message === "string") return p
          if (!Array.isArray(p) && Array.isArray(p.actions) && p.actions.length > 0) {
            const n = p.actions.length
            return { message: `I've identified ${n} transaction${n > 1 ? "s" : ""} to categorise.`, actions: p.actions }
          }
          if (Array.isArray(p)) {
            const acts = p.filter((item) => typeof item?.type === "string")
            if (acts.length > 0) {
              return { message: `I've identified ${acts.length} transaction${acts.length > 1 ? "s" : ""} to categorise.`, actions: acts }
            }
          }
        } catch { /* not JSON */ }
        return null
      }

      function extractPartial(text: string): unknown[] {
        const actions: unknown[] = []
        const pat = /"type"\s*:\s*"(?:assign_transaction|split_transaction|save_rule|update_rule|delete_rule)"/g
        let m: RegExpExecArray | null
        while ((m = pat.exec(text)) !== null) {
          let start = m.index
          while (start > 0 && text[start] !== "{") start--
          if (text[start] !== "{") continue
          let depth = 0, end = -1
          for (let i = start; i < text.length; i++) {
            if (text[i] === "{") depth++
            else if (text[i] === "}") { depth--; if (depth === 0) { end = i; break } }
          }
          if (end === -1) break
          try { const obj = JSON.parse(text.slice(start, end + 1)); if ((obj as {type?:string}).type) actions.push(obj) } catch { /* skip */ }
          pat.lastIndex = end + 1
        }
        return actions
      }

      let r = tryParse(raw.trim())
      if (!r) {
        // Handle unclosed code fences (truncated responses) with (?:```|$)
        const m = raw.match(/```(?:json)?\s*\n?([\s\S]*?)(?:```|$)/)
        if (m) {
          r = tryParse(m[1].trim())
          if (!r) {
            const rescued = extractPartial(m[1])
            if (rescued.length > 0) r = { message: `I've identified ${rescued.length} transaction${rescued.length > 1 ? "s" : ""} to categorise.`, actions: rescued }
          }
        }
      }
      if (!r) {
        const s = raw.indexOf("{"), e = raw.lastIndexOf("}")
        if (s !== -1 && e > s) r = tryParse(raw.slice(s, e + 1))
      }
      if (!r) {
        const rescued = extractPartial(raw)
        if (rescued.length > 0) r = { message: `I've identified ${rescued.length} transaction${rescued.length > 1 ? "s" : ""} to categorise.`, actions: rescued }
      }
      return r
    }

    const messages = (data ?? []).map((msg: {
      id: string; role: string; content: string
      context_organisation_id: string | null
      context_statement_id: string | null
      created_at: string
    }) => {
      if (msg.role !== "assistant") return msg
      const extracted = tryExtractJson(msg.content)
      if (extracted) {
        return {
          ...msg,
          content: extracted.message,
          actions: Array.isArray(extracted.actions) ? extracted.actions : [],
        }
      }
      return msg
    })

    return NextResponse.json({ messages }, { status: 200 })
  } catch (err) {
    console.error("[GET /api/ai/messages]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const statementId = searchParams.get("statement_id")

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    let query = db.from("user_ai_messages").delete().eq("user_id", user.id)
    if (statementId) query = query.eq("context_statement_id", statementId)

    const { error } = await query
    if (error) {
      console.error("[DELETE /api/ai/messages]:", error)
      return NextResponse.json({ error: "Failed to clear messages" }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("[DELETE /api/ai/messages]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
