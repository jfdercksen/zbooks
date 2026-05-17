import { NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

export async function DELETE(
  _request: NextRequest,
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
