"use client"

import { useState } from "react"
import { TableProperties, BotMessageSquare } from "lucide-react"

interface Props {
  table: React.ReactNode
  chat: React.ReactNode
}

export function ReviewLayout({ table, chat }: Props) {
  const [tab, setTab] = useState<"transactions" | "chat">("transactions")

  return (
    <>
      {/* ── Desktop: side-by-side ── */}
      <div className="hidden md:flex flex-1 min-h-0 gap-4 mt-4">
        <div className="flex-1 min-w-0 overflow-auto rounded-xl border bg-card">
          {table}
        </div>
        <div className="w-80 xl:w-96 shrink-0 rounded-xl border bg-card overflow-hidden">
          {chat}
        </div>
      </div>

      {/* ── Mobile: tab switcher ── */}
      <div className="md:hidden flex flex-col flex-1 min-h-0 mt-3">
        {/* Tab bar */}
        <div className="flex rounded-lg border bg-muted/50 p-0.5 mb-3 shrink-0">
          <button
            onClick={() => setTab("transactions")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === "transactions"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <TableProperties className="h-4 w-4" />
            Transactions
          </button>
          <button
            onClick={() => setTab("chat")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === "chat"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground"
            }`}
          >
            <BotMessageSquare className="h-4 w-4" />
            AI Agent
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-auto rounded-xl border bg-card">
          {tab === "transactions" ? table : chat}
        </div>
      </div>
    </>
  )
}
