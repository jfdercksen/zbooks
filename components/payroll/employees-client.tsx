"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Plus, User } from "lucide-react"
import { formatZAR } from "@/lib/utils"

interface Org { id: string; name: string }

interface Employee {
  id: string
  first_name: string
  last_name: string
  id_number: string | null
  email: string | null
  start_date: string
  employment_type: string
  gross_salary: string
  is_active: boolean
}

interface Props { orgs: Org[] }

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

export function EmployeesClient({ orgs }: Props) {
  const [orgId, setOrgId] = useState(orgs[0]?.id ?? "")
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const [form, setForm] = useState({
    first_name: "", last_name: "", id_number: "", email: "",
    start_date: "", employment_type: "permanent", gross_salary: "",
  })

  const loadEmployees = useCallback(async () => {
    if (!orgId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/payroll/employees?organisation_id=${orgId}`)
      const data = await res.json()
      if (res.ok) setEmployees(data.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => { loadEmployees() }, [loadEmployees])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!orgId) return
    setSaving(true)
    setFormError("")
    try {
      const res = await fetch("/api/payroll/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organisation_id: orgId,
          ...form,
          gross_salary: parseFloat(form.gross_salary),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setFormError(data.error ?? "Failed to save"); return }
      setShowForm(false)
      setForm({ first_name: "", last_name: "", id_number: "", email: "", start_date: "", employment_type: "permanent", gross_salary: "" })
      await loadEmployees()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Org selector + add button */}
      <div className="flex items-center gap-3">
        <Select value={orgId} onValueChange={(v) => { setOrgId(v); setEmployees([]) }}>
          <SelectTrigger className="h-8 text-sm w-56">
            <SelectValue placeholder="Select organisation" />
          </SelectTrigger>
          <SelectContent>
            {orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> Add employee
        </Button>
      </div>

      {/* Add employee form */}
      {showForm && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <p className="text-sm font-semibold">New employee</p>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">First name *</label>
                <input required value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  className="w-full h-8 text-sm border rounded-md px-2.5 bg-background" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Last name *</label>
                <input required value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  className="w-full h-8 text-sm border rounded-md px-2.5 bg-background" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">SA ID number</label>
                <input value={form.id_number} onChange={(e) => setForm((f) => ({ ...f, id_number: e.target.value }))}
                  className="w-full h-8 text-sm border rounded-md px-2.5 bg-background" placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full h-8 text-sm border rounded-md px-2.5 bg-background" placeholder="Optional" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Start date *</label>
                <input required type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full h-8 text-sm border rounded-md px-2.5 bg-background" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Employment type *</label>
                <select value={form.employment_type} onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}
                  className="w-full h-8 text-sm border rounded-md px-2.5 bg-background">
                  <option value="permanent">Permanent</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs text-muted-foreground">Gross monthly salary (ZAR) *</label>
                <input required type="number" min="0" step="0.01" value={form.gross_salary}
                  onChange={(e) => setForm((f) => ({ ...f, gross_salary: e.target.value }))}
                  className="w-full h-8 text-sm border rounded-md px-2.5 bg-background" placeholder="e.g. 25000" />
              </div>
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save employee
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      {/* Employee list */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No employees yet</p>
          <p className="text-xs mt-1">Add employees before running payroll</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Start date</th>
                <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Gross salary</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {employees.map((emp) => {
                const [y, m, d] = emp.start_date.split("-")
                const startLabel = `${d} ${MONTH_NAMES[parseInt(m) - 1]} ${y}`
                return (
                  <tr key={emp.id} className="hover:bg-muted/10">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{emp.first_name} {emp.last_name}</p>
                      {emp.email && <p className="text-xs text-muted-foreground">{emp.email}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant="outline" className="capitalize text-xs">{emp.employment_type}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{startLabel}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                      {formatZAR(parseFloat(emp.gross_salary))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
