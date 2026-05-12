import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { createServerClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { ExcelImportForm } from "@/components/organisations/excel-import-form"

export const metadata: Metadata = {
  title: "Import Historical Data",
}

export default async function ImportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerClient()) as any
  const { data: orgData } = await supabase
    .from("organisations")
    .select("id, name")
    .eq("id", id)
    .single()
  const org = orgData as { id: string; name: string } | null

  if (!org) notFound()

  return (
    <div>
      <PageHeader
        title="Import historical data"
        description={`${org.name} — import your 2026 Excel P&L data`}
      />
      <div className="mt-6">
        <ExcelImportForm organisationId={id} organisationName={org.name} />
      </div>
    </div>
  )
}
