"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Send, Loader2, Bot, User, CheckCircle2, ChevronDown, ChevronUp, Trash2 } from "lucide-react"
import type { AIAction, ChatMessage } from "@/lib/ai/types"

interface Props {
  statementId?: string
  organisationId?: string
  onTransactionUpdated?: () => void
}

function ActionCard({
  action,
  onApply,
}: {
  action: AIAction
  onApply: (action: AIAction) => Promise<void>
}) {
  const [status, setStatus] = useState<"idle" | "applying" | "done" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function apply() {
    setStatus("applying")
    try {
      await onApply(action)
      setStatus("done")
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed")
      setStatus("error")
    }
  }

  if (action.type === "delete_rule" || action.type === "update_rule" || action.type === "save_rule") {
    // Rules are auto-applied server-side — just show a note
    return null
  }

  return (
    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs">
      <p className="font-medium text-foreground mb-1.5">{action.description}</p>

      {action.type === "split_transaction" && (
        <div className="space-y-0.5 mb-2">
          {action.splits.map((leg, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>{leg.organisation_name}</span>
              <span>{leg.percentage}% — R{leg.amount.toFixed(2)}{leg.account_name ? ` / ${leg.account_name}` : ""}</span>
            </div>
          ))}
        </div>
      )}

      {action.type === "assign_transaction" && (
        <p className="text-muted-foreground mb-2">
          → {action.organisation_name}{action.account_name ? ` / ${action.account_name}` : ""}
        </p>
      )}

      {action.type === "rename_account" && (
        <p className="text-muted-foreground mb-2">
          Rename to &ldquo;{action.new_name}&rdquo;
        </p>
      )}

      {action.type === "create_account" && (
        <p className="text-muted-foreground mb-2">
          New {action.account_type} account &ldquo;{action.name}&rdquo;
        </p>
      )}

      {status === "idle" && (
        <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={apply}>
          Apply
        </Button>
      )}
      {status === "applying" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
      {status === "done" && (
        <span className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-3.5 w-3.5" /> Applied
        </span>
      )}
      {status === "error" && <span className="text-destructive">{errorMsg}</span>}
    </div>
  )
}

function MessageBubble({
  msg,
  onApplyAction,
  onApplySilent,
  onRefresh,
}: {
  msg: ChatMessage
  onApplyAction: (action: AIAction) => Promise<void>   // saves + refreshes (individual Apply button)
  onApplySilent: (action: AIAction) => Promise<void>   // saves only, no refresh (used during batch)
  onRefresh: () => void                                 // triggers a single page refresh
}) {
  const isUser = msg.role === "user"
  const [showActions, setShowActions] = useState(true)
  const [applyAllStatus, setApplyAllStatus] = useState<"idle" | "applying" | "done">("idle")
  const [applyAllProgress, setApplyAllProgress] = useState(0)

  const applyableActions = (msg.actions ?? []).filter(
    (a) => a.type === "split_transaction" || a.type === "assign_transaction"
      || a.type === "rename_account" || a.type === "create_account"
  )
  const actionCount = applyableActions.length

  async function handleApplyAll() {
    setApplyAllStatus("applying")
    setApplyAllProgress(0)
    try {
      for (let i = 0; i < applyableActions.length; i++) {
        await onApplySilent(applyableActions[i])
        setApplyAllProgress(i + 1)
      }
      setApplyAllStatus("done")
      onRefresh()
    } catch {
      setApplyAllStatus("idle")
    }
  }

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isUser ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>

      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`rounded-xl px-3 py-2 text-sm ${isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>

        {actionCount > 0 && (
          <div className="w-full">
            <div className="flex items-center gap-2 mb-1">
              <button
                onClick={() => setShowActions((v) => !v)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                {showActions ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {actionCount} suggested action{actionCount > 1 ? "s" : ""}
              </button>

              {actionCount > 1 && applyAllStatus === "idle" && (
                <Button size="sm" variant="default" className="h-5 text-[10px] px-2 py-0" onClick={handleApplyAll}>
                  Apply all {actionCount}
                </Button>
              )}
              {applyAllStatus === "applying" && (
                <span className="flex items-center gap-1 text-[11px] text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {applyAllProgress}/{actionCount}
                </span>
              )}
              {applyAllStatus === "done" && (
                <span className="flex items-center gap-1 text-[11px] text-green-600">
                  <CheckCircle2 className="h-3 w-3" /> All applied
                </span>
              )}
            </div>

            {showActions && (
              <div className="space-y-1.5">
                {(msg.actions ?? []).map((action, i) => (
                  <ActionCard key={i} action={action} onApply={onApplyAction} />
                ))}
              </div>
            )}
          </div>
        )}

        <span className="text-[10px] text-muted-foreground">
          {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  )
}

export function ChatPanel({ statementId, organisationId, onTransactionUpdated }: Props) {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [initialising, setInitialising] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load history
  useEffect(() => {
    const params = new URLSearchParams()
    if (statementId) params.set("statement_id", statementId)

    fetch(`/api/ai/messages?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages) setMessages(d.messages)
      })
      .finally(() => setInitialising(false))
  }, [statementId])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // applyAction saves to DB but does NOT refresh — caller decides when to refresh
  const applyAction = useCallback(async (action: AIAction) => {
    if (action.type === "split_transaction") {
      const res = await fetch(`/api/transactions/${action.transaction_id}/split`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ splits: action.splits }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to apply split")
      }
    } else if (action.type === "assign_transaction") {
      // Clear any existing splits first (ignore 404 — transaction may have no splits)
      await fetch(`/api/transactions/${action.transaction_id}/split`, { method: "DELETE" })
      // Save the account and company allocation
      const res = await fetch(`/api/transactions/${action.transaction_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: action.account_id,
          allocated_organisation_id: action.organisation_id,
          status: action.account_id ? "categorised" : "pending",
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to assign transaction")
      }
    } else if (action.type === "rename_account") {
      const res = await fetch(`/api/organisations/${action.organisation_id}/accounts/${action.account_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: action.new_name }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to rename account")
      }
    } else if (action.type === "create_account") {
      const res = await fetch(`/api/organisations/${action.organisation_id}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: action.name, type: action.account_type, vat_type: action.vat_type }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? "Failed to create account")
      }
    }
  }, [])

  // Called after individual Apply button — refresh immediately
  const applyActionAndRefresh = useCallback(async (action: AIAction) => {
    await applyAction(action)
    onTransactionUpdated?.()
    router.refresh()
  }, [applyAction, onTransactionUpdated, router])


  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          context_statement_id: statementId ?? null,
          context_organisation_id: organisationId ?? null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: data.error ?? "Something went wrong.",
            created_at: new Date().toISOString(),
          },
        ])
        return
      }

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        actions: data.actions ?? [],
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Network error — please try again.",
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
      textareaRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  async function clearHistory() {
    const params = new URLSearchParams()
    if (statementId) params.set("statement_id", statementId)
    await fetch(`/api/ai/messages?${params}`, { method: "DELETE" })
    setMessages([])
  }

  if (initialising) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Bot className="h-4 w-4 text-primary" />
          AI Bookkeeping Agent
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Clear conversation"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8 space-y-2">
            <Bot className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="font-medium">Your AI bookkeeping agent</p>
            <p className="max-w-48 mx-auto leading-relaxed">
              Tell me how to allocate transactions. I&apos;ll learn your rules and apply them automatically next time.
            </p>
            <div className="text-left bg-muted rounded-lg p-2.5 mt-3 space-y-1.5">
              <p className="font-medium text-foreground text-[11px] mb-1">Try saying:</p>
              {[
                "Split the SANLAM debit equally across Z-Tech, Branding Zone, G-Xpress and Ai Dynamic",
                "All MTN airtime is Z-Tech's expense under Telephone",
                "The Nedbank transfer is income for G-Xpress",
                "What did Branding Zone spend last month?",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="block w-full text-left text-[11px] text-muted-foreground hover:text-foreground transition-colors py-0.5"
                >
                  → {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onApplyAction={applyActionAndRefresh}
            onApplySilent={applyAction}
            onRefresh={() => { onTransactionUpdated?.(); router.refresh() }}
          />
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="bg-muted rounded-xl px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about transactions or give allocation instructions…"
            rows={2}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary min-h-[60px] max-h-32"
            disabled={loading}
          />
          <Button
            size="sm"
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="shrink-0 h-9 w-9 p-0"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Enter to send · Shift+Enter for new line · Rules are saved automatically
        </p>
      </div>
    </div>
  )
}
