// Auto-generated from Supabase schema — do not edit manually
// Regenerate with: npx supabase gen types typescript --linked > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      organisations: {
        Row: {
          id: string
          name: string
          registration_number: string | null
          vat_number: string | null
          financial_year_start: number
          financial_year_end: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          registration_number?: string | null
          vat_number?: string | null
          financial_year_start?: number
          financial_year_end?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          registration_number?: string | null
          vat_number?: string | null
          financial_year_start?: number
          financial_year_end?: number
          updated_at?: string
        }
        Relationships: []
      }
      organisation_members: {
        Row: {
          id: string
          organisation_id: string
          user_id: string
          role: "admin" | "editor" | "viewer"
          created_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          user_id: string
          role?: "admin" | "editor" | "viewer"
          created_at?: string
        }
        Update: {
          role?: "admin" | "editor" | "viewer"
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          id: string
          organisation_id: string
          name: string
          bank_name: string
          account_number: string | null
          account_type: string
          currency: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          name: string
          bank_name: string
          account_number?: string | null
          account_type?: string
          currency?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string
          bank_name?: string
          account_number?: string | null
          account_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_organisation_id_fkey"
            columns: ["organisation_id"]
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      accounts: {
        Row: {
          id: string
          organisation_id: string
          code: string
          name: string
          type: "income" | "expense" | "asset" | "liability" | "equity"
          vat_type: "standard" | "zero_rated" | "exempt" | "none"
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          code: string
          name: string
          type: "income" | "expense" | "asset" | "liability" | "equity"
          vat_type?: "standard" | "zero_rated" | "exempt" | "none"
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          code?: string
          name?: string
          type?: "income" | "expense" | "asset" | "liability" | "equity"
          vat_type?: "standard" | "zero_rated" | "exempt" | "none"
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounts_organisation_id_fkey"
            columns: ["organisation_id"]
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          id: string
          organisation_id: string
          bank_account_id: string
          file_name: string
          file_path: string
          statement_date_from: string | null
          statement_date_to: string | null
          status: "pending" | "processing" | "review" | "committed" | "failed"
          uploaded_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          bank_account_id: string
          file_name: string
          file_path: string
          statement_date_from?: string | null
          statement_date_to?: string | null
          status?: "pending" | "processing" | "review" | "committed" | "failed"
          uploaded_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: "pending" | "processing" | "review" | "committed" | "failed"
          statement_date_from?: string | null
          statement_date_to?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_organisation_id_fkey"
            columns: ["organisation_id"]
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_bank_account_id_fkey"
            columns: ["bank_account_id"]
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          id: string
          organisation_id: string
          bank_account_id: string
          bank_statement_id: string | null
          date: string
          description: string
          debit_amount: string
          credit_amount: string
          balance: string | null
          account_id: string | null
          vat_type: "standard" | "zero_rated" | "exempt" | "none"
          vat_amount: string
          reference: string | null
          notes: string | null
          status: "pending" | "categorised" | "committed"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          bank_account_id: string
          bank_statement_id?: string | null
          date: string
          description: string
          debit_amount?: string
          credit_amount?: string
          balance?: string | null
          account_id?: string | null
          vat_type?: "standard" | "zero_rated" | "exempt" | "none"
          vat_amount?: string
          reference?: string | null
          notes?: string | null
          status?: "pending" | "categorised" | "committed"
          created_at?: string
          updated_at?: string
        }
        Update: {
          date?: string
          description?: string
          debit_amount?: string
          credit_amount?: string
          balance?: string | null
          account_id?: string | null
          vat_type?: "standard" | "zero_rated" | "exempt" | "none"
          vat_amount?: string
          reference?: string | null
          notes?: string | null
          status?: "pending" | "categorised" | "committed"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_organisation_id_fkey"
            columns: ["organisation_id"]
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          id: string
          organisation_id: string
          first_name: string
          last_name: string
          id_number: string | null
          email: string | null
          start_date: string
          employment_type: "permanent" | "contract"
          gross_salary: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          first_name: string
          last_name: string
          id_number?: string | null
          email?: string | null
          start_date: string
          employment_type?: "permanent" | "contract"
          gross_salary: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          first_name?: string
          last_name?: string
          id_number?: string | null
          email?: string | null
          employment_type?: "permanent" | "contract"
          gross_salary?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_organisation_id_fkey"
            columns: ["organisation_id"]
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          id: string
          organisation_id: string
          period_month: number
          period_year: number
          total_gross: string
          total_paye: string
          total_uif_employee: string
          total_uif_employer: string
          total_sdl: string
          total_net: string
          status: "draft" | "finalised"
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          period_month: number
          period_year: number
          total_gross?: string
          total_paye?: string
          total_uif_employee?: string
          total_uif_employer?: string
          total_sdl?: string
          total_net?: string
          status?: "draft" | "finalised"
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          total_gross?: string
          total_paye?: string
          total_uif_employee?: string
          total_uif_employer?: string
          total_sdl?: string
          total_net?: string
          status?: "draft" | "finalised"
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_organisation_id_fkey"
            columns: ["organisation_id"]
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entries: {
        Row: {
          id: string
          organisation_id: string
          payroll_run_id: string
          employee_id: string
          gross_salary: string
          paye: string
          uif_employee: string
          uif_employer: string
          sdl: string
          net_pay: string
          created_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          payroll_run_id: string
          employee_id: string
          gross_salary: string
          paye: string
          uif_employee: string
          uif_employer: string
          sdl: string
          net_pay: string
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: [
          {
            foreignKeyName: "payroll_entries_organisation_id_fkey"
            columns: ["organisation_id"]
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          id: string
          organisation_id: string
          user_id: string | null
          table_name: string
          record_id: string
          action: "INSERT" | "UPDATE" | "DELETE"
          old_data: Json | null
          new_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          organisation_id: string
          user_id?: string | null
          table_name: string
          record_id: string
          action: "INSERT" | "UPDATE" | "DELETE"
          old_data?: Json | null
          new_data?: Json | null
          created_at?: string
        }
        Update: Record<string, never>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      seed_default_accounts: {
        Args: { p_organisation_id: string }
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
