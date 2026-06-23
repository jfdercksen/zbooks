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
      function tryParse(s: string) {
        try {
          const p = JSON.parse(s)
          if (typeof p.message === "string") return p
        } catch { /* not JSON */ }
        return null
      }
      let r = tryParse(raw.trim())
      if (!r) {
        const m = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
        if (m) r = tryParse(m[1].trim())
      }
      if (!r) {
        const s = raw.indexOf("{"), e = raw.lastIndexOf("}")
        if (s !== -1 && e > s) r = tryParse(raw.slice(s, e + 1))
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
