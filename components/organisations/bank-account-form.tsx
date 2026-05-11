"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const SA_BANKS = [
  "ABSA",
  "Capitec Bank",
  "Discovery Bank",
  "FNB",
  "Investec",
  "Nedbank",
  "Standard Bank",
  "TymeBank",
  "African Bank",
  "Other",
]

interface BankAccountFormProps {
  organisationId: string
  onSuccess?: () => void
}

export function BankAccountForm({ organisationId, onSuccess }: BankAccountFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountType, setAccountType] = useState("cheque")
  const [bankName, setBankName] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    const formData = new FormData(e.currentTarget)
    const body = {
      name: formData.get("name") as string,
      bank_name: bankName || (formData.get("bank_name") as string),
      account_number: (formData.get("account_number") as string) || null,
      account_type: accountType,
    }

    try {
      const res = await fetch(`/api/organisations/${organisationId}/bank-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Something went wrong")
        return
      }

      router.refresh()
      onSuccess?.()
    } catch {
      setError("Network error — please try again")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">Account label *</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="e.g. FNB Business Cheque"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">A friendly name to identify this account</p>
      </div>

      <div className="space-y-1.5">
        <Label>Bank *</Label>
        <Select value={bankName} onValueChange={setBankName}>
          <SelectTrigger>
            <SelectValue placeholder="Select bank" />
          </SelectTrigger>
          <SelectContent>
            {SA_BANKS.map((bank) => (
              <SelectItem key={bank} value={bank}>
                {bank}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="account_number">Account number</Label>
        <Input
          id="account_number"
          name="account_number"
          placeholder="e.g. 62123456789"
        />
      </div>

      <div className="space-y-1.5">
        <Label>Account type</Label>
        <Select value={accountType} onValueChange={setAccountType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="cheque">Cheque / Current</SelectItem>
            <SelectItem value="savings">Savings</SelectItem>
            <SelectItem value="credit">Credit Card</SelectItem>
            <SelectItem value="investment">Investment</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={isSubmitting || !bankName}>
          {isSubmitting ? "Adding…" : "Add bank account"}
        </Button>
      </div>
    </form>
  )
}
