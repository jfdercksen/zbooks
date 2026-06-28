"use client"

import { useState, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Pencil, Plus, Check, X, Loader2 } from "lucide-react"

type AccountType = "income" | "expense" | "asset" | "liability" | "equity"
type VatType = "standard" | "zero_rated" | "exempt" | "none"

interface Account {
  id: string
  code: string
  name: string
  type: AccountType
  vat_type: VatType
  is_active: boolean
}

interface Props {
  orgId: string
  initialAccounts: Account[]
}

const TYPE_ORDER: AccountType[] = ["income", "expense", "asset", "liability", "equity"]
const TYPE_LABELS: Record<AccountType, string> = {
  income: "Income",
  expense: "Expenses",
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
}
const VAT_LABELS: Record<VatType, string> = {
  standard: "Standard 15%",
  zero_rated: "Zero Rated",
  exempt: "Exempt",
  none: "N/A",
}

export function AccountsTable({ orgId, initialAccounts }: Props) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editVat, setEditVat] = useState<VatType>("standard")
  const [savingId, setSavingId] = useState<string | null>(null)
  const [addingType, setAddingType] = useState<AccountType | null>(null)
  const [newName, setNewName] = useState("")
  const [newVat, setNewVat] = useState<VatType>("standard")
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const editRef = useRef<HTMLInputElement>(null)
  const addRef = useRef<HTMLInputElement>(null)

  function startEdit(account: Account) {
    setEditingId(account.id)
    setEditName(account.name)
    setEditVat(account.vat_type)
    setError(null)
    setTimeout(() => editRef.current?.select(), 0)
  }

  function cancelEdit() {
    setEditingId(null)
    setError(null)
  }

  async function saveEdit(account: Account) {
    if (!editName.trim() || editName.trim() === account.name && editVat === account.vat_type) {
      cancelEdit()
      return
    }
    setSavingId(account.id)
    setError(null)
    try {
      const res = await fetch(`/api/organisations/${orgId}/accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), vat_type: editVat }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Save failed"); return }
      setAccounts((prev) => prev.map((a) => a.id === account.id ? json.data : a))
      setEditingId(null)
    } catch {
      setError("Network error")
    } finally {
      setSavingId(null)
    }
  }

  function startAdd(type: AccountType) {
    setAddingType(type)
    setNewName("")
    setNewVat("standard")
    setError(null)
    setTimeout(() => addRef.current?.focus(), 0)
  }

  function cancelAdd() {
    setAddingType(null)
    setError(null)
  }

  async function saveAdd() {
    if (!newName.trim() || !addingType) return
    setAdding(true)
    setError(null)
    try {
      const res = await fetch(`/api/organisations/${orgId}/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), type: addingType, vat_type: newVat }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? "Create failed"); return }
      setAccounts((prev) => [...prev, json.data as Account])
      setAddingType(null)
    } catch {
      setError("Network error")
    } finally {
      setAdding(false)
    }
  }

  const grouped = TYPE_ORDER.reduce<Record<AccountType, Account[]>>((acc, type) => {
    acc[type] = accounts.filter((a) => a.type === type && a.is_active)
    return acc
  }, {} as Record<AccountType, Account[]>)

  return (
    <div className="mt-6 space-y-6">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded px-3 py-2">{error}</p>
      )}
      {TYPE_ORDER.map((type) => {
        const rows = grouped[type]
        if (!rows?.length && addingType !== type) return null
        return (
          <div key={type}>
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Badge variant={type as AccountType} className="capitalize">
                {TYPE_LABELS[type]}
              </Badge>
              <span className="text-muted-foreground font-normal">{rows.length} accounts</span>
            </h2>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground w-20">Code</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Account name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground hidden sm:table-cell w-32">VAT</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((account) => (
                    <tr key={account.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{account.code}</td>
                      <td className="px-4 py-2.5">
                        {editingId === account.id ? (
                          <input
                            ref={editRef}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(account)
                              if (e.key === "Escape") cancelEdit()
                            }}
                            className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        ) : (
                          <span className="font-medium">{account.name}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        {editingId === account.id ? (
                          <select
                            value={editVat}
                            onChange={(e) => setEditVat(e.target.value as VatType)}
                            className="border rounded px-1.5 py-1 text-xs"
                          >
                            <option value="standard">Standard 15%</option>
                            <option value="zero_rated">Zero Rated</option>
                            <option value="exempt">Exempt</option>
                            <option value="none">N/A</option>
                          </select>
                        ) : (
                          <span className="text-xs text-muted-foreground">{VAT_LABELS[account.vat_type]}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {editingId === account.id ? (
                          <span className="flex items-center justify-end gap-1">
                            {savingId === account.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                            ) : (
                              <>
                                <button
                                  onClick={() => saveEdit(account)}
                                  className="p-1 rounded hover:bg-green-100 text-green-600"
                                  title="Save"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                                  title="Cancel"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </span>
                        ) : (
                          <button
                            onClick={() => startEdit(account)}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground transition-opacity"
                            title="Rename"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}

                  {/* Add row */}
                  {addingType === type ? (
                    <tr className="bg-muted/20">
                      <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">auto</td>
                      <td className="px-4 py-2.5">
                        <input
                          ref={addRef}
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveAdd()
                            if (e.key === "Escape") cancelAdd()
                          }}
                          placeholder="Account name…"
                          className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <select
                          value={newVat}
                          onChange={(e) => setNewVat(e.target.value as VatType)}
                          className="border rounded px-1.5 py-1 text-xs"
                        >
                          <option value="standard">Standard 15%</option>
                          <option value="zero_rated">Zero Rated</option>
                          <option value="exempt">Exempt</option>
                          <option value="none">N/A</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="flex items-center justify-end gap-1">
                          {adding ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <button
                                onClick={saveAdd}
                                className="p-1 rounded hover:bg-green-100 text-green-600"
                                title="Add"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={cancelAdd}
                                className="p-1 rounded hover:bg-muted text-muted-foreground"
                                title="Cancel"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-1.5">
                        <button
                          onClick={() => startAdd(type)}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Add {TYPE_LABELS[type].toLowerCase().replace(/s$/, "")} account
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {!accounts.length && (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No accounts found. The default chart of accounts should have been created automatically.
        </div>
      )}
    </div>
  )
}
