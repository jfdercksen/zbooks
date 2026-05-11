"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

export function OrganisationForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [financialYearStart, setFinancialYearStart] = useState("3")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const body = {
      name: formData.get("name") as string,
      registration_number: (formData.get("registration_number") as string) || null,
      vat_number: (formData.get("vat_number") as string) || null,
      financial_year_start: parseInt(financialYearStart),
    }

    try {
      const res = await fetch("/api/organisations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Something went wrong")
        return
      }

      router.push(`/organisations/${json.data.id}`)
      router.refresh()
    } catch {
      setError("Network error — please try again")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg">
      <div className="space-y-1.5">
        <Label htmlFor="name">Organisation name *</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="e.g. Z-Tech Computers (Pty) Ltd"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="registration_number">Registration number</Label>
        <Input
          id="registration_number"
          name="registration_number"
          placeholder="e.g. 2024/123456/07"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="vat_number">VAT number</Label>
        <Input
          id="vat_number"
          name="vat_number"
          placeholder="e.g. 4123456789"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Financial year starts</Label>
        <Select value={financialYearStart} onValueChange={setFinancialYearStart}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Most SA companies start in March (tax year). Check with your accountant if unsure.
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create organisation"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
