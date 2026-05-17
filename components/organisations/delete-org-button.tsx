"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export function DeleteOrgButton({ orgId, orgName }: { orgId: string; orgName: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleDelete() {
    if (
      !window.confirm(
        `Delete "${orgName}"?\n\nThis will permanently delete the organisation and all its data — bank accounts, transactions, statements, and accounts. This cannot be undone.`
      )
    ) {
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/organisations/${orgId}`, { method: "DELETE" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        alert(body.error ?? "Failed to delete organisation. Please try again.")
        return
      }
      router.push("/organisations")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="destructive" onClick={handleDelete} disabled={loading}>
      {loading ? "Deleting…" : "Delete organisation"}
    </Button>
  )
}
