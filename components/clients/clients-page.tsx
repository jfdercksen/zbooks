"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Pencil, Trash2, Briefcase, X, AlertCircle } from "lucide-react"

interface Org { id: string; name: string }
interface Client {
  id: string
  organisation_id: string
  name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  notes: string | null
  is_active: boolean
}
interface Props {
  orgs: Org[]
  initialClients: Client[]
  membershipMap: Record<string, string>
}

interface ClientForm {
  organisation_id: string
  name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  notes: string
}

const emptyForm: ClientForm = {
  organisation_id: "",
  name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  notes: "",
}

export function ClientsPage({ orgs, initialClients, membershipMap }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<ClientForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [deleting, setDeleting] = useState<string | null>(null)

  const canEdit = (orgId: string) => ["admin", "editor"].includes(membershipMap[orgId] ?? "")
  const canDelete = (orgId: string) => membershipMap[orgId] === "admin"

  function startCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setError("")
    setShowForm(true)
  }

  function startEdit(client: Client) {
    setEditingId(client.id)
    setForm({
      organisation_id: client.organisation_id,
      name: client.name,
      contact_name: client.contact_name ?? "",
      contact_email: client.contact_email ?? "",
      contact_phone: client.contact_phone ?? "",
      notes: client.notes ?? "",
    })
    setError("")
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
    setForm(emptyForm)
    setError("")
  }

  async function saveClient() {
    if (!form.organisation_id || !form.name.trim()) {
      setError("Organisation and client name are required")
      return
    }
    setSaving(true)
    setError("")
    try {
      const url = editingId ? `/api/clients/${editingId}` : "/api/clients"
      const method = editingId ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisation_id: form.organisation_id,
          name: form.name.trim(),
          contact_name: form.contact_name.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Save failed"); return }
      cancelForm()
      router.refresh()
    } catch {
      setError("Network error — please try again")
    } finally {
      setSaving(false)
    }
  }

  async function deleteClient(id: string, orgId: string) {
    if (!canDelete(orgId)) return
    if (!confirm("Delete this client? This cannot be undone.")) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        alert(d.error ?? "Delete failed")
        return
      }
      router.refresh()
    } finally {
      setDeleting(null)
    }
  }

  const byOrg = orgs.reduce<Record<string, Client[]>>((acc, org) => {
    acc[org.id] = initialClients.filter((c) => c.organisation_id === org.id)
    return acc
  }, {})

  const totalClients = initialClients.length
  const editableOrgs = orgs.filter((o) => canEdit(o.id))

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {totalClients === 0
            ? "No clients yet"
            : `${totalClients} client${totalClients !== 1 ? "s" : ""} across ${orgs.length} organisation${orgs.length !== 1 ? "s" : ""}`}
        </p>
        {editableOrgs.length > 0 && (
          <Button size="sm" onClick={startCreate}>
            <PlusCircle className="h-4 w-4" />
            Add client
          </Button>
        )}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="rounded-xl border bg-card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editingId ? "Edit client" : "New client"}</h3>
            <button onClick={cancelForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Organisation <span className="text-destructive">*</span></Label>
              <Select
                value={form.organisation_id}
                onValueChange={(v) => setForm((f) => ({ ...f, organisation_id: v }))}
                disabled={!!editingId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organisation" />
                </SelectTrigger>
                <SelectContent>
                  {editableOrgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Client name <span className="text-destructive">*</span></Label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Fire Risk"
                className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Contact name</Label>
              <input
                value={form.contact_name}
                onChange={(e) => setForm((f) => ({ ...f, contact_name: e.target.value }))}
                placeholder="e.g. John Smith"
                className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Contact email</Label>
              <input
                type="email"
                value={form.contact_email}
                onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                placeholder="e.g. john@firerisk.co.za"
                className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Contact phone</Label>
              <input
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                placeholder="e.g. 011 123 4567"
                className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes about this client"
                className="w-full text-sm border rounded-md px-3 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={saveClient} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update client" : "Add client"}
            </Button>
            <Button size="sm" variant="outline" onClick={cancelForm} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Clients grouped by org */}
      {orgs.map((org) => {
        const clients = byOrg[org.id] ?? []
        if (clients.length === 0) return null
        return (
          <div key={org.id} className="space-y-2">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">{org.name}</h2>
              <Badge variant="outline" className="text-xs">
                {clients.length} client{clients.length !== 1 ? "s" : ""}
              </Badge>
            </div>

            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Client</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Contact</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground w-32">Phone</th>
                    <th className="text-left px-3 py-2.5 text-xs font-medium text-muted-foreground">Notes</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 font-medium">{client.name}</td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">
                        {client.contact_name && <div>{client.contact_name}</div>}
                        {client.contact_email && <div>{client.contact_email}</div>}
                        {!client.contact_name && !client.contact_email && "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs">
                        {client.contact_phone ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground text-xs max-w-xs truncate">
                        {client.notes ?? "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          {canEdit(client.organisation_id) && (
                            <button
                              onClick={() => startEdit(client)}
                              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                              title="Edit"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {canDelete(client.organisation_id) && (
                            <button
                              onClick={() => deleteClient(client.id, client.organisation_id)}
                              disabled={deleting === client.id}
                              className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
                              title="Delete"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* Empty state */}
      {totalClients === 0 && !showForm && (
        <div className="text-center py-16 text-muted-foreground">
          <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium text-sm">No clients yet</p>
          <p className="text-xs mt-1 mb-4 max-w-xs mx-auto">
            Add external clients to track costs incurred on their behalf — these show as Cost of Sales in your P&amp;L
          </p>
          {editableOrgs.length > 0 && (
            <Button size="sm" onClick={startCreate}>
              <PlusCircle className="h-4 w-4" />
              Add first client
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
