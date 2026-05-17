import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

const TransactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  description: z.string().min(1),
  debit_amount: z.number().min(0).default(0),
  credit_amount: z.number().min(0).default(0),
  balance: z.number().nullable().default(null),
  reference: z.string().nullable().default(null),
})

export type ExtractedTransaction = z.infer<typeof TransactionSchema>

export interface ExtractionResult {
  transactions: ExtractedTransaction[]
  statement_date_from: string | null
  statement_date_to: string | null
  account_number: string | null
  bank_name: string | null
  errors: string[]
}

const SYSTEM_PROMPT = `You are a South African bank statement parser. Extract all transactions from the provided bank statement PDF.

Return ONLY valid JSON with this exact structure:
{
  "bank_name": "string or null",
  "account_number": "string or null",
  "statement_date_from": "YYYY-MM-DD or null",
  "statement_date_to": "YYYY-MM-DD or null",
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "transaction description exactly as shown",
      "debit_amount": 0.00,
      "credit_amount": 0.00,
      "balance": 0.00 or null,
      "reference": "reference number or null"
    }
  ]
}

Rules:
- Dates must be YYYY-MM-DD format. SA banks often use DD/MM/YYYY — convert them.
- debit_amount is money going OUT (payments, fees, purchases). Use 0 if not a debit.
- credit_amount is money coming IN (deposits, receipts). Use 0 if not a credit.
- Never put the same amount in both debit and credit.
- Include every single transaction row — do not skip any.
- Keep descriptions exactly as they appear on the statement.
- Return only the JSON object, no markdown, no explanation.`

export async function extractTransactionsFromPDF(
  pdfBuffer: ArrayBuffer
): Promise<ExtractionResult> {
  const errors: string[] = []

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    errors.push("ANTHROPIC_API_KEY is not configured on this server")
    return {
      transactions: [],
      statement_date_from: null,
      statement_date_to: null,
      account_number: null,
      bank_name: null,
      errors,
    }
  }

  try {
    const client = new Anthropic({ apiKey })
    const base64 = Buffer.from(pdfBuffer).toString("base64")

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: "Extract all transactions from this bank statement. Return only the JSON.",
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === "text" ? response.content[0].text : ""
    const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/\s*```$/i, "")

    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      errors.push("Claude returned invalid JSON — retrying is recommended")
      return {
        transactions: [],
        statement_date_from: null,
        statement_date_to: null,
        account_number: null,
        bank_name: null,
        errors,
      }
    }

    const rawTransactions = Array.isArray(parsed.transactions) ? parsed.transactions : []
    const validTransactions: ExtractedTransaction[] = []

    for (const tx of rawTransactions) {
      const result = TransactionSchema.safeParse(tx)
      if (result.success) {
        validTransactions.push(result.data)
      } else {
        errors.push(`Skipped transaction "${tx?.description ?? "?"}" — ${result.error.issues[0]?.message}`)
      }
    }

    return {
      transactions: validTransactions,
      statement_date_from: (parsed.statement_date_from as string) ?? null,
      statement_date_to: (parsed.statement_date_to as string) ?? null,
      account_number: (parsed.account_number as string) ?? null,
      bank_name: (parsed.bank_name as string) ?? null,
      errors,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    errors.push(`Extraction failed: ${message}`)
    return {
      transactions: [],
      statement_date_from: null,
      statement_date_to: null,
      account_number: null,
      bank_name: null,
      errors,
    }
  }
}
