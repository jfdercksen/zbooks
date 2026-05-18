"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

interface Org { id: string; name: string }

interface Props {
  orgId: string
  currentParentId: string | null
  availableParents: Org[]  // all other orgs the user belongs to (not this one, not its children)
}

const NONE = "__none__"

export function ParentOrgSelector({ orgId, currentParentId, availableParents }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState(currentParentId ?? NONE)
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  const isDirty = selected !== (currentParentId ?? NONE)

  async function save() {
    setStatus("saving")
    setErrorMsg("")
    try {
      const res = await fetch(`/api/organisations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_organisation_id: selected === NONE ? null : selected,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? "Failed to update")
        setStatus("error")
        return
      }
      setStatus("saved")
      router.refresh()
      setTimeout(() => setStatus("idle"), 2500)
    } catch {
      setErrorMsg("Network error — please try again")
      setStatus("error")
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Parent / Holding company</label>
          <Select value={selected} onValueChange={setSelected} disabled={status === "saving"}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Independent (no parent)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>
                <span className="text-muted-foreground">Independent — no holding company</span>
              </SelectItem>
              {availableParents.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={save}
          disabled={!isDirty || status === "saving"}
          size="sm"
          className="h-9 shrink-0"
        >
          {status === "saving" ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving</>
          ) : "Save"}
        </Button>
      </div>

      {status === "saved" && (
        <p className="flex items-center gap-1.5 text-xs text-green-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Group structure updated
        </p>
      )}
      {status === "error" && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {errorMsg}
        </p>
      )}

      {selected !== NONE && (
        <p className="text-xs text-muted-foreground">
          This organisation will appear as a subsidiary in group reports and the AI agent will treat it as part of the group.
        </p>
      )}
    </div>
  )
}
