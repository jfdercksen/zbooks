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

    // Backward compat: old messages stored the full JSON response as content.
    // Extract the message text and actions so the UI renders them correctly.
    const messages = (data ?? []).map((msg: {
      id: string; role: string; content: string
      context_organisation_id: string | null
      context_statement_id: string | null
      created_at: string
    }) => {
      if (msg.role !== "assistant") return msg
      try {
        const cleaned = msg.content.trim()
          .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "")
        const parsed = JSON.parse(cleaned)
        if (typeof parsed.message === "string") {
          return {
            ...msg,
            content: parsed.message,
            actions: Array.isArray(parsed.actions) ? parsed.actions : [],
          }
        }
      } catch {
        // Not JSON — content is already plain text, no change needed
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
