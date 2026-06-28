export interface SplitLeg {
  organisation_id: string
  organisation_name: string
  account_id: string | null
  account_name: string | null
  percentage: number
  amount: number
  is_intercompany?: boolean
  client_id?: string | null
  client_name?: string | null
}

export type AIAction =
  | {
      type: "split_transaction"
      description: string
      transaction_id: string
      splits: SplitLeg[]
    }
  | {
      type: "assign_transaction"
      description: string
      transaction_id: string
      organisation_id: string
      organisation_name: string
      account_id: string | null
      account_name: string | null
    }
  | {
      type: "save_rule"
      description: string
      rule: {
        description_pattern: string
        match_type: "contains" | "exact" | "starts_with"
        transaction_type: "debit" | "credit" | "both"
        splits: SplitLeg[]
        is_intercompany: boolean
      }
    }
  | {
      type: "update_rule"
      description: string
      rule_id: string
      splits: SplitLeg[]
    }
  | {
      type: "delete_rule"
      description: string
      rule_id: string
    }
  | {
      type: "rename_account"
      description: string
      organisation_id: string
      account_id: string
      new_name: string
    }
  | {
      type: "create_account"
      description: string
      organisation_id: string
      name: string
      account_type: "income" | "expense" | "asset" | "liability" | "equity"
      vat_type: "standard" | "zero_rated" | "exempt" | "none"
    }

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  actions?: AIAction[]
  context_statement_id?: string | null
  created_at: string
}

export interface OrgNode {
  id: string
  name: string
  parent_organisation_id: string | null
  children: OrgNode[]
}

export interface AllocationRule {
  id: string
  user_id: string
  description_pattern: string
  match_type: "contains" | "exact" | "starts_with"
  transaction_type: "debit" | "credit" | "both"
  splits: SplitLeg[]
  is_intercompany: boolean
  times_applied: number
  last_applied_at: string | null
  created_at: string
}
