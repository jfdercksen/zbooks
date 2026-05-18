import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const PatchSchema = z.object({
  parent_organisation_id: z.string().uuid().nullable(),
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
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", id)
      .eq("user_id", user.id)
      .single()

    if (!membership || membership.role !== "admin") {
      return NextResponse.json({ error: "Only admins can change the group structure" }, { status: 403 })
    }

    // Prevent an org from being its own parent or creating a circular chain
    if (parsed.data.parent_organisation_id === id) {
      return NextResponse.json({ error: "An organisation cannot be its own parent" }, { status: 400 })
    }

    if (parsed.data.parent_organisation_id) {
      // Ensure the proposed parent isn't itself a child of this org (circular reference)
      const { data: proposedParent } = await db
        .from("organisations")
        .select("parent_organisation_id")
        .eq("id", parsed.data.parent_organisation_id)
        .single()

      if (proposedParent?.parent_organisation_id === id) {
        return NextResponse.json({ error: "Circular group structure — the selected parent already reports to this organisation" }, { status: 400 })
      }
    }

    const { error } = await db
      .from("organisations")
      .update({ parent_organisation_id: parsed.data.parent_organisation_id })
      .eq("id", id)

    if (error) {
      console.error("[PATCH /api/organisations/[id]]", error)
      return NextResponse.json({ error: "Failed to update organisation" }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("[PATCH /api/organisations/[id]]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("[DELETE /api/organisations/[id]] SUPABASE_SERVICE_ROLE_KEY is not set")
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    // Use service role to avoid RLS issues with unapplied migrations.
    // We verify admin membership explicitly before deleting.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    if (membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can delete an organisation" },
        { status: 403 }
      )
    }

    const { error } = await db.from("organisations").delete().eq("id", id)

    if (error) {
      console.error("[DELETE /api/organisations/[id]]", error)
      return NextResponse.json({ error: "Failed to delete organisation" }, { status: 500 })
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("[DELETE /api/organisations/[id]]", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
