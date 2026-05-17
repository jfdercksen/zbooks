"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Upload, AlertCircle, CheckCircle2 } from "lucide-react"

interface Org { id: string; name: string }
interface BankAccount { id: string; name: string; bank_name: string; organisation_id: string }

interface Props {
  orgs: Org[]
  bankAccounts: BankAccount[]
}

type Stage = "uploading" | "extracting" | "saving" | "done" | "error" | null

interface ProgressState {
  stage: Stage
  progress: number
  message: string
  statementId?: string
  transactionsExtracted?: number
  warnings?: string[]
}

const STAGE_LABELS: Record<Exclude<Stage, null | "error" | "done">, string> = {
  uploading: "Uploading",
  extracting: "Reading",
  saving: "Saving",
}

export function BankStatementUpload({ orgs, bankAccounts }: Props) {
  const router = useRouter()
  const [orgId, setOrgId] = useState("")
  const [bankAccountId, setBankAccountId] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [ps, setPs] = useState<ProgressState>({ stage: null, progress: 0, message: "" })
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const filteredAccounts = bankAccounts.filter((b) => !orgId || b.organisation_id === orgId)

  // Slowly animate the bar during extraction so it doesn't appear frozen
  useEffect(() => {
    if (ps.stage === "extracting") {
      animRef.current = setInterval(() => {
        setPs((prev) => {
          if (prev.stage !== "extracting" || prev.progress >= 78) return prev
          return { ...prev, progress: +(prev.progress + 0.4).toFixed(1) }
        })
      }, 1200)
    } else {
      if (animRef.current) { clearInterval(animRef.current); animRef.current = null }
    }
    return () => { if (animRef.current) clearInterval(animRef.current) }
  }, [ps.stage])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !orgId || !bankAccountId) return

    setPs({ stage: "uploading", progress: 5, message: "Preparing upload…" })

    const fd = new FormData()
    fd.append("file", file)
    fd.append("organisation_id", orgId)
    fd.append("bank_account_id", bankAccountId)

    try {
      const res = await fetch("/api/bank-statements/process", { method: "POST", body: fd })

      if (!res.body) throw new Error("No response stream")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? ""

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith("data: ")) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.stage === "done") {
              setPs({
                stage: "done",
                progress: 100,
                message: event.message,
                statementId: event.data.statement_id,
                transactionsExtracted: event.data.transactions_extracted,
                warnings: event.data.warnings ?? [],
              })
              setTimeout(() => {
                router.push(`/bank-statements/${event.data.statement_id}/review`)
                router.refresh()
              }, 1500)
            } else if (event.stage === "error") {
              setPs({ stage: "error", progress: 0, message: event.message })
            } else {
              setPs((prev) => ({
                ...prev,
                stage: event.stage,
                progress: Math.max(prev.progress, event.progress),
                message: event.message,
              }))
            }
          } catch {}
        }
      }
    } catch {
      setPs({ stage: "error", progress: 0, message: "Network error — please try again" })
    }
  }

  const isProcessing = ps.stage && ps.stage !== "done" && ps.stage !== "error"

  if (ps.stage === "done") {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 font-medium py-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        {ps.message} — redirecting to review…
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

      {isProcessing && (
        <div className="space-y-1.5 py-1">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">{ps.message}</span>
            <span className="tabular-nums text-muted-foreground">{Math.round(ps.progress)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
              style={{ width: `${ps.progress}%` }}
            />
          </div>
          <div className="flex gap-1 pt-0.5">
            {(["uploading", "extracting", "saving"] as const).map((s) => (
              <div
                key={s}
                className={`flex-1 text-center text-[10px] py-0.5 rounded-sm transition-colors ${
                  ps.stage === s
                    ? "bg-primary/10 text-primary font-medium"
                    : ps.stage === "saving" && s === "uploading"
                    ? "bg-muted text-muted-foreground"
                    : ps.stage === "saving" && s === "extracting"
                    ? "bg-muted text-muted-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {STAGE_LABELS[s]}
              </div>
            ))}
          </div>
        </div>
      )}

      {ps.stage === "error" && (
        <div className="flex items-start gap-2 text-sm text-destructive rounded-md border border-destructive/20 bg-destructive/5 p-3">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{ps.message}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={!file || !orgId || !bankAccountId || !!isProcessing}
        className="w-full"
      >
        <Upload className="h-4 w-4" />
        {isProcessing ? "Processing…" : "Upload & extract transactions"}
      </Button>
    </form>
  )
}
