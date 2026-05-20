import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerClient, createServiceRoleClient } from "@/lib/supabase/server"

const InvoiceRowSchema = z.object({
  invoice_number: z.string().optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  billing_period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  client_name_raw: z.string().optional(),
  description: z.string().optional(),
  subtotal: z.number().min(0),
  tax_amount: z.number().min(0),
  total_amount: z.number().min(0),
  status: z.enum(["draft", "sent", "paid", "partial", "cancelled"]),
})

const ImportSchema = z.object({
  organisation_id: z.string().uuid(),
  account_id: z.string().uuid(),
  filename: z.string().optional(),
  invoices: z.array(InvoiceRowSchema).min(1).max(5000),
})

export async function POST(request: NextRequest) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const authClient = (await createServerClient()) as any
    const { data: { user }, error: authError } = await authClient.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    const body = await request.json()
    const parsed = ImportSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid request", details: parsed.error.issues }, { status: 400 })

    const { organisation_id, account_id, filename, invoices } = parsed.data

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = (await createServiceRoleClient()) as any

    const { data: membership } = await db
      .from("organisation_members")
      .select("role")
      .eq("organisation_id", organisation_id)
      .eq("user_id", user.id)
      .single()
    if (!membership || !["admin", "editor"].includes(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Load clients for this org to attempt name matching
    const { data: clients } = await db
      .from("clients")
      .select("id, name")
      .eq("organisation_id", organisation_id)
      .eq("is_active", true)

    const clientMap = new Map<string, string>()
    for (const c of (clients ?? [])) {
      clientMap.set(c.name.toLowerCase().trim(), c.id)
    }

    const rows = invoices.map((inv) => {
      const clientKey = inv.client_name_raw?.toLowerCase().trim() ?? ""
      const client_id = clientMap.get(clientKey) ?? null
      return {
        organisation_id,
        account_id,
        client_id,
        client_name_raw: inv.client_name_raw ?? null,
        invoice_number: inv.invoice_number ?? null,
        invoice_date: inv.invoice_date,
        due_date: inv.due_date ?? null,
        billing_period: inv.billing_period ?? null,
        description: inv.description ?? null,
        subtotal: inv.subtotal.toFixed(2),
        tax_amount: inv.tax_amount.toFixed(2),
        total_amount: inv.total_amount.toFixed(2),
        status: inv.status,
        source: "csv_import",
        imported_filename: filename ?? null,
      }
    })

    let imported = 0
    let unmatchedClients = new Set<string>()

    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200)
      const { error } = await db.from("invoices").insert(batch)
      if (error) {
        console.error("[POST /api/invoices/import] batch insert:", error)
        return NextResponse.json({ error: "Import failed: " + error.message }, { status: 500 })
      }
      imported += batch.length
    }

    for (const inv of invoices) {
      if (inv.client_name_raw) {
        const key = inv.client_name_raw.toLowerCase().trim()
        if (!clientMap.has(key)) unmatchedClients.add(inv.client_name_raw)
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        imported,
        unmatched_clients: [...unmatchedClients],
      },
    }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/invoices/import]:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
