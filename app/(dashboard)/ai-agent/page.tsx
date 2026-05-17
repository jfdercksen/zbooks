import type { Metadata } from "next"
import { ChatPanel } from "@/components/ai/chat-panel"

export const metadata: Metadata = { title: "AI Bookkeeping Agent" }

export default function AIAgentPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4 shrink-0">
        <h1 className="text-xl font-semibold">AI Bookkeeping Agent</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Your personal agent — allocates transactions, learns your rules, and answers questions across all your businesses.
        </p>
      </div>
      <div className="flex-1 min-h-0 rounded-xl border bg-card overflow-hidden">
        <ChatPanel />
      </div>
    </div>
  )
}
