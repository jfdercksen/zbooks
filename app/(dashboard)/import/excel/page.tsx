import type { Metadata } from "next"
import { createServerClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/shared/page-header"
import { ExcelMultiImportForm } from "@/components/import/excel-multi-import-form"

export const metadata: Metadata = { title: "Import Historical Data" }

export default async function ImportExcelPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createServerClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: memberships } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)

  const orgIds = (memberships ?? []).map((m: { organisation_id: string }) => m.organisation_id)

  const { data: orgsData } = orgIds.length
    ? await supabase.from("organisations").select("id, name").in("id", orgIds).order("name")
    : { data: [] }

  const orgs = (orgsData ?? []) as Array<{ id: string; name: string }>

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Import historical data"
        description="Upload your Accounts Excel file — all company sheets imported in one pass"
      />
      <ExcelMultiImportForm orgs={orgs} />
    </div>
  )
}
