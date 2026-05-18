import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const CreateSchema = z.object({
  organisation_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  contact_name: z.string().max(200).nullable().optional(),
  contact_email: z.string().email().max(200).nullable().optional(),
  contact_phone: z.string().max(50).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any
    const { data: memberships } = await db
      .from("organisation_members")
      .select("organisation_id")
      .eq("user_id", user.id)
    const orgIds = (memberships ?? []).map((m: { organisation_id: string }) => m.organisation_id)
    if (!orgIds.length) return NextResponse.json({ data: [] }, { status: 200 })

    const { data, error } = await db
      .from("clients")
      .select("id, organisation_id, name, contact_name, contact_email, contact_phone, notes, is_active, organisations(name)")
      .in("organisation_id", orgIds)
      .order("name")

    if (error) {
      console.error("[GET /api/clients]:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ data: data ?? [] }, { status: 200 })
  } catch (err) {
    console.error("[GET /api/clients]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", parsed.data.organisation_id)
      .eq("user_id", user.id)
      .single()

    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await db
      .from("clients")
      .insert({
        organisation_id: parsed.data.organisation_id,
        name: parsed.data.name,
        contact_name: parsed.data.contact_name ?? null,
        contact_email: parsed.data.contact_email ?? null,
        contact_phone: parsed.data.contact_phone ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select("id")
      .single()

    if (error) {
      console.error("[POST /api/clients]:", error)
      return NextResponse.json({ error: "Internal server error" }, { status: 500 })
    }

    return NextResponse.json({ success: true, data }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/clients]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
