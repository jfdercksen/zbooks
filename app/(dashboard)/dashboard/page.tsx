import type { Metadata } from "next"
import { createServerClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"

export const metadata: Metadata = {
  title: "Dashboard",
}

export default async function DashboardPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: orgs } = await supabase
    .from("organisations")
    .select("id, name")
    .order("name") as unknown as { data: Array<{ id: string; name: string }> | null }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Welcome to Z-Books"
      />

      {!orgs?.length ? (
        <div className="mt-8 rounded-lg border border-dashed p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-sm font-medium mb-1">No organisations yet</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Create your first organisation to start managing accounts.
          </p>
          <a
            href="/organisations/new"
            className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground h-8 px-3 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Create organisation
          </a>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {orgs.map((org) => (
            <a
              key={org.id}
              href={`/organisations/${org.id}`}
              className="rounded-lg border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <h3 className="font-medium">{org.name}</h3>
              <p className="text-sm text-muted-foreground mt-1">View organisation</p>
            </a>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Signed in as {user?.email}
      </p>
    </div>
  )
}
