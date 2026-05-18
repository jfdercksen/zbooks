import type { Metadata } from "next"
import Link from "next/link"
import { createServerClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { Building2, Plus, Crown, GitBranch } from "lucide-react"

export const metadata: Metadata = {
  title: "Organisations",
}

interface OrgRow {
  id: string
  name: string
  registration_number: string | null
  vat_number: string | null
  parent_organisation_id: string | null
}

export default async function OrganisationsPage() {
  const supabase = await createServerClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: orgsData } = await (supabase as any)
    .from("organisations")
    .select("id, name, registration_number, vat_number, parent_organisation_id")
    .order("name")

  const orgs = (orgsData ?? []) as OrgRow[]

  // Split into top-level (holding companies + independents) and subsidiaries
  const childIds = new Set(orgs.filter((o) => o.parent_organisation_id).map((o) => o.id))
  const topLevel = orgs.filter((o) => !o.parent_organisation_id)
  const childrenByParent = orgs.reduce<Record<string, OrgRow[]>>((acc, o) => {
    if (o.parent_organisation_id) {
      if (!acc[o.parent_organisation_id]) acc[o.parent_organisation_id] = []
      acc[o.parent_organisation_id].push(o)
    }
    return acc
  }, {})

  // Any org that has children is a holding company
  const isHolding = (id: string) => !!childrenByParent[id]?.length

  function OrgCard({ org, variant }: { org: OrgRow; variant: "holding" | "subsidiary" | "standalone" }) {
    const children = childrenByParent[org.id] ?? []
    return (
      <div>
        <Link
          href={`/organisations/${org.id}`}
          className={`group flex items-start gap-3 rounded-lg border bg-card p-4 hover:border-primary/50 hover:shadow-sm transition-all ${
            variant === "holding" ? "border-primary/30 bg-primary/[0.02]" : ""
          }`}
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            variant === "holding" ? "bg-primary/15" : "bg-muted"
          }`}>
            {variant === "holding" ? (
              <Crown className="w-4 h-4 text-primary" />
            ) : variant === "subsidiary" ? (
              <GitBranch className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Building2 className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                {org.name}
              </h3>
              {variant === "holding" && (
                <span className="shrink-0 text-[10px] font-medium bg-primary/10 text-primary rounded px-1.5 py-0.5">
                  Holding
                </span>
              )}
            </div>
            {org.registration_number && (
              <p className="text-xs text-muted-foreground mt-0.5">Reg: {org.registration_number}</p>
            )}
            {org.vat_number && (
              <p className="text-xs text-muted-foreground">VAT: {org.vat_number}</p>
            )}
            {variant === "holding" && children.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {children.length} subsidiar{children.length === 1 ? "y" : "ies"}
              </p>
            )}
          </div>
        </Link>

        {/* Subsidiaries nested under holding company */}
        {children.length > 0 && (
          <div className="mt-1.5 ml-5 pl-4 border-l-2 border-primary/20 space-y-1.5">
            {children.map((child) => (
              <Link
                key={child.id}
                href={`/organisations/${child.id}`}
                className="group flex items-center gap-3 rounded-lg border bg-card px-4 py-3 hover:border-primary/50 hover:shadow-sm transition-all"
              >
                <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {child.name}
                  </h3>
                  {child.registration_number && (
                    <p className="text-xs text-muted-foreground">Reg: {child.registration_number}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Organisations"
        description="Manage your client organisations and group structure"
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

      {!orgs.length ? (
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
        <div className="mt-6 space-y-4">
          {topLevel.map((org) => (
            <OrgCard
              key={org.id}
              org={org}
              variant={isHolding(org.id) ? "holding" : "standalone"}
            />
          ))}
          {/* Orphaned subsidiaries (parent not in user's visible orgs) */}
          {orgs
            .filter((o) => o.parent_organisation_id && !topLevel.find((t) => t.id === o.parent_organisation_id))
            .filter((o) => !childIds.has(o.id) || true)
            .map((org) => (
              <OrgCard key={org.id} org={org} variant="standalone" />
            ))}
        </div>
      )}
    </div>
  )
}
