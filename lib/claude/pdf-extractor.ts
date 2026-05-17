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

Return ONLY valid compact JSON — single line, no whitespace between tokens, no newlines, no indentation, no markdown fences. Exact format:
{"bank_name":"FNB","account_number":"62564366287","statement_date_from":"2026-03-01","statement_date_to":"2026-03-31","transactions":[{"date":"2026-03-02","description":"Payment Debit Order","debit_amount":500.00,"credit_amount":0,"balance":12345.67,"reference":null}]}

Rules:
- Dates must be YYYY-MM-DD. SA banks often use DD/MM/YYYY — convert them.
- debit_amount: money OUT (payments, fees, purchases). Use 0 if not a debit.
- credit_amount: money IN (deposits, receipts). Use 0 if not a credit.
- Never put the same amount in both debit and credit.
- Include every single transaction row — do not skip any.
- Keep descriptions exactly as they appear on the statement.
- Return ONLY the JSON object on one line. No markdown, no explanation, no code fences.`

function parseJSONFromResponse(text: string): Record<string, unknown> | null {
  // 1. Try direct parse (ideal case — pure JSON)
  try { return JSON.parse(text.trim()) } catch {}

  // 2. Strip markdown code fences then retry
  const stripped = text.trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
  try { return JSON.parse(stripped) } catch {}

  // 3. Scan for the outermost { } block — handles prose before/after JSON
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch {}
  }

  // 4. Partial recovery for truncated responses (stop_reason: max_tokens)
  // Walk the transactions array character-by-character to salvage every
  // complete transaction object that was written before the cutoff.
  if (start !== -1) {
    const partial = text.slice(start)
    const txMarker = '"transactions":['
    const txIdx = partial.indexOf(txMarker)
    if (txIdx !== -1) {
      const header = partial.slice(0, txIdx)           // includes leading "{"
      const txContent = partial.slice(txIdx + txMarker.length)
      const completeTxs: string[] = []
      let depth = 0
      let objStart = -1
      for (let i = 0; i < txContent.length; i++) {
        if (txContent[i] === "{") {
          if (depth === 0) objStart = i
          depth++
        } else if (txContent[i] === "}") {
          depth--
          if (depth === 0 && objStart !== -1) {
            completeTxs.push(txContent.slice(objStart, i + 1))
            objStart = -1
          }
        }
      }
      if (completeTxs.length > 0) {
        try {
          return JSON.parse(header + txMarker + completeTxs.join(",") + "]}")
        } catch {}
      }
    }
  }

  return null
}

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

    // 16K tokens ≈ 480 transactions in compact JSON — fits within Vercel's 300s timeout.
    // For larger statements the partial-recovery parser salvages what was generated.
    const msgStream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 16384,
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

    const response = await msgStream.finalMessage()

    if (response.stop_reason === "max_tokens") {
      errors.push("Statement has too many transactions to extract in one pass — transactions after the cutoff were not imported. Split the PDF into smaller date ranges (e.g. 3-month chunks) and upload each separately.")
    }

    const text = response.content[0].type === "text" ? response.content[0].text : ""

    const parsed = parseJSONFromResponse(text)
    if (!parsed) {
      console.error("[pdf-extractor] unparseable response (first 300 chars):", text.slice(0, 300))
      errors.push("Claude returned unparseable content — check server logs")
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
