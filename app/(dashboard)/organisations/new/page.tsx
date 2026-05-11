import type { Metadata } from "next"
import { PageHeader } from "@/components/shared/page-header"
import { OrganisationForm } from "@/components/organisations/organisation-form"

export const metadata: Metadata = {
  title: "New Organisation",
}

export default function NewOrganisationPage() {
  return (
    <div>
      <PageHeader
        title="New organisation"
        description="Set up a new client organisation. A standard chart of accounts will be created automatically."
      />
      <div className="mt-6">
        <OrganisationForm />
      </div>
    </div>
  )
}
