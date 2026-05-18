import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const PatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  contact_name: z.string().max(200).nullable().optional(),
  contact_email: z.string().email().max(200).nullable().optional(),
  contact_phone: z.string().max(50).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  is_active: z.boolean().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: client } = await db.from("clients").select("organisation_id").eq("id", id).single()
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", client.organisation_id)
      .eq("user_id", user.id)
      .single()

    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { error } = await db.from("clients").update(parsed.data).eq("id", id)
    if (error) {
      console.error("[PATCH /api/clients/[id]]:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("[PATCH /api/clients/[id]]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: client } = await db.from("clients").select("organisation_id").eq("id", id).single()
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", client.organisation_id)
      .eq("user_id", user.id)
      .single()

    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Forbidden — admin role required" }, { status: 403 })
    }

    const { error } = await db.from("clients").delete().eq("id", id)
    if (error) {
      console.error("[DELETE /api/clients/[id]]:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error("[DELETE /api/clients/[id]]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
