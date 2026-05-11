import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { Building2, CreditCard, FileText, Settings, Upload, List } from "lucide-react"

export const metadata: Metadata = {
  title: "Organisation",
}

export default async function OrganisationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const [orgResult, bankResult, txResult] = await Promise.all([
    db.from("organisations")
      .select("id, name, registration_number, vat_number, financial_year_start, financial_year_end")
      .eq("id", id)
      .single(),
    db.from("bank_accounts")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", id),
    db.from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("organisation_id", id),
  ])
  const org = orgResult.data as {
    id: string
    name: string
    registration_number: string | null
    vat_number: string | null
    financial_year_start: number
    financial_year_end: number
  } | null
  const bankAccountCount = bankResult.count as number | null
  const transactionCount = txResult.count as number | null

  if (!org) notFound()

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
  const fyRange = `${MONTHS[org.financial_year_start - 1]} – ${MONTHS[org.financial_year_end - 1]}`

  const quickLinks = [
    { href: `/organisations/${id}/bank-accounts`, icon: CreditCard, label: "Bank accounts", count: bankAccountCount ?? 0 },
    { href: `/bank-statements`, icon: FileText, label: "Bank statements", count: null },
    { href: `/transactions`, icon: List, label: "Transactions", count: transactionCount ?? 0 },
    { href: `/organisations/${id}/settings`, icon: Settings, label: "Chart of accounts", count: null },
  ]

  return (
    <div>
      <PageHeader
        title={org.name}
        description="Organisation overview"
        action={
          <Link
            href={`/organisations/${id}/settings`}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background h-9 px-3 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        }
      />

      {/* Details card */}
      <div className="mt-6 rounded-lg border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div className="grid gap-1">
            <h2 className="font-semibold">{org.name}</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-0.5 text-sm text-muted-foreground">
              {org.registration_number && <span>Reg: {org.registration_number}</span>}
              {org.vat_number && <span>VAT: {org.vat_number}</span>}
              <span>Financial year: {fyRange}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {quickLinks.map(({ href, icon: Icon, label, count }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{label}</span>
            </div>
            {count !== null && (
              <p className="text-2xl font-bold tabular-nums">{count}</p>
            )}
          </Link>
        ))}
      </div>

      {/* Upload CTA if no bank accounts */}
      {(bankAccountCount ?? 0) === 0 && (
        <div className="mt-6 rounded-lg border border-dashed p-8 text-center">
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-sm font-medium mb-1">Add a bank account to get started</h3>
          <p className="text-sm text-muted-foreground mb-4">
            You need at least one bank account before uploading statements.
          </p>
          <Link
            href={`/organisations/${id}/bank-accounts`}
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-8 px-3 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Add bank account
          </Link>
        </div>
      )}
    </div>
  )
}
