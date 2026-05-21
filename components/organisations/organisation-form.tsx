"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, GitBranch } from "lucide-react"

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

type CompanyType = "single" | "multi"

export function OrganisationForm() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [financialYearStart, setFinancialYearStart] = useState("3")
  const [companyType, setCompanyType] = useState<CompanyType>("single")

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
      company_type: companyType,
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
      {/* Company type selector */}
      <div className="space-y-2">
        <Label>Company structure</Label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setCompanyType("single")}
            className={`flex flex-col items-start gap-1.5 rounded-lg border-2 p-4 text-left transition-colors ${
              companyType === "single"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <Building2 className={`h-4 w-4 ${companyType === "single" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${companyType === "single" ? "text-primary" : ""}`}>
                Single company
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              One entity — all transactions belong to this company.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setCompanyType("multi")}
            className={`flex flex-col items-start gap-1.5 rounded-lg border-2 p-4 text-left transition-colors ${
              companyType === "multi"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-muted-foreground/40"
            }`}
          >
            <div className="flex items-center gap-2">
              <GitBranch className={`h-4 w-4 ${companyType === "multi" ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${companyType === "multi" ? "text-primary" : ""}`}>
                Group / multi-company
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-snug">
              Holding company — bank statement transactions can be allocated to subsidiaries.
            </p>
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="name">Organisation name *</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder={companyType === "multi" ? "e.g. Z-Group Holdings (Pty) Ltd" : "e.g. Z-Tech Computers (Pty) Ltd"}
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
