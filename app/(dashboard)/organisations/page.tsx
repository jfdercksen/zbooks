import type { Metadata } from "next"
import Link from "next/link"
import { createServerClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { Building2, Plus } from "lucide-react"

export const metadata: Metadata = {
  title: "Organisations",
}

export default async function OrganisationsPage() {
  const supabase = await createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgsData } = await (supabase as any)
    .from("organisations")
    .select("id, name, registration_number, vat_number")
    .order("name")
  const orgs = orgsData as Array<{
    id: string
    name: string
    registration_number: string | null
    vat_number: string | null
  }> | null

  return (
    <div>
      <PageHeader
        title="Organisations"
        description="Manage your client organisations"
        action={
          <Link
            href="/organisations/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground h-9 px-3 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New organisation
          </Link>
        }
      />

      {!orgs?.length ? (
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Building2 className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-medium mb-1">No organisations yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first organisation to start managing accounts.
          </p>
          <Link
            href="/organisations/new"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-8 px-3 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Create organisation
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <Link
              key={org.id}
              href={`/organisations/${org.id}`}
              className="group rounded-lg border bg-card p-5 hover:border-primary/50 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {org.name}
                  </h3>
                  {org.registration_number && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Reg: {org.registration_number}
                    </p>
                  )}
                  {org.vat_number && (
                    <p className="text-xs text-muted-foreground">
                      VAT: {org.vat_number}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
