"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Upload, AlertCircle } from "lucide-react"

interface Org { id: string; name: string }
interface BankAccount { id: string; name: string; bank_name: string; organisation_id: string }

interface Props {
  orgs: Org[]
  bankAccounts: BankAccount[]
}

export function BankStatementUpload({ orgs, bankAccounts }: Props) {
  const router = useRouter()
  const [orgId, setOrgId] = useState("")
  const [bankAccountId, setBankAccountId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<"idle" | "uploading" | "done" | "error">("idle")
  const [message, setMessage] = useState("")

  const filteredAccounts = bankAccounts.filter((b) => !orgId || b.organisation_id === orgId)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !orgId || !bankAccountId) return

    setStatus("uploading")
    setMessage("")

    const fd = new FormData()
    fd.append("file", file)
    fd.append("organisation_id", orgId)
    fd.append("bank_account_id", bankAccountId)

    try {
      const res = await fetch("/api/bank-statements/process", { method: "POST", body: fd })
      const json = await res.json()

      if (!res.ok) {
        setStatus("error")
        setMessage(json.error ?? "Upload failed")
        return
      }

      setStatus("done")
      setMessage(`Extracted ${json.data.transactions_extracted} transactions`)

      // Navigate to review page
      setTimeout(() => {
        router.push(`/bank-statements/${json.data.statement_id}/review`)
        router.refresh()
      }, 1200)
    } catch {
      setStatus("error")
      setMessage("Network error — please try again")
    }
  }

  if (status === "done") {
    return (
      <div className="text-sm text-green-700 font-medium py-2">
        ✓ {message} — redirecting to review…
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Organisation</Label>
        <Select value={orgId} onValueChange={(v) => { setOrgId(v); setBankAccountId("") }}>
          <SelectTrigger>
            <SelectValue placeholder="Select organisation" />
          </SelectTrigger>
          <SelectContent>
            {orgs.map((o) => (
              <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>Bank account</Label>
        <Select value={bankAccountId} onValueChange={setBankAccountId} disabled={!orgId}>
          <SelectTrigger>
            <SelectValue placeholder={orgId ? "Select bank account" : "Select organisation first"} />
          </SelectTrigger>
          <SelectContent>
            {filteredAccounts.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name} — {b.bank_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>PDF statement</Label>
        <label className="flex items-center gap-3 rounded-lg border-2 border-dashed p-4 cursor-pointer hover:border-primary/50 transition-colors">
          <Upload className="h-5 w-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm">{file ? file.name : "Click to select PDF"}</p>
            <p className="text-xs text-muted-foreground">Max 10MB · PDF only</p>
          </div>
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {status === "error" && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {message}
        </div>
      )}

      <Button
        type="submit"
        disabled={!file || !orgId || !bankAccountId || status === "uploading"}
        className="w-full"
      >
        <Upload className="h-4 w-4" />
        {status === "uploading" ? "Processing with AI…" : "Upload & extract transactions"}
      </Button>
    </form>
  )
}
