export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string
          created_at: string
          details: Json
          entity_id: string
          entity_type: string
          id: number
          organization_id: string
        }
        Insert: {
          action: string
          actor_id: string
          created_at?: string
          details?: Json
          entity_id: string
          entity_type: string
          id?: never
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          created_at?: string
          details?: Json
          entity_id?: string
          entity_type?: string
          id?: never
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      capital_payment_details: {
        Row: {
          balance_source: string
          capital_payment_cents: number
          current_capital_cents: number
          last_payment_date: string | null
          new_capital_cents: number
          new_future_interest_cents: number
          new_scheduled_balance_cents: number
          next_payment_date: string
          notes: string
          organization_id: string
          original_future_interest_cents: number
          payment_method: string
          payment_number: number
          payment_reference: string
          received_by: string
          regular_payment_cents: number
          transaction_id: string
          transaction_mode: string
        }
        Insert: {
          balance_source: string
          capital_payment_cents: number
          current_capital_cents: number
          last_payment_date?: string | null
          new_capital_cents: number
          new_future_interest_cents: number
          new_scheduled_balance_cents: number
          next_payment_date: string
          notes?: string
          organization_id: string
          original_future_interest_cents: number
          payment_method?: string
          payment_number: number
          payment_reference?: string
          received_by?: string
          regular_payment_cents: number
          transaction_id: string
          transaction_mode: string
        }
        Update: {
          balance_source?: string
          capital_payment_cents?: number
          current_capital_cents?: number
          last_payment_date?: string | null
          new_capital_cents?: number
          new_future_interest_cents?: number
          new_scheduled_balance_cents?: number
          next_payment_date?: string
          notes?: string
          organization_id?: string
          original_future_interest_cents?: number
          payment_method?: string
          payment_number?: number
          payment_reference?: string
          received_by?: string
          regular_payment_cents?: number
          transaction_id?: string
          transaction_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "capital_details_transaction_organization_fk"
            columns: ["transaction_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "capital_payment_details_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "capital_payment_details_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string
          email: string
          id: string
          name: string
          organization_id: string
          phone: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by: string
          email?: string
          id?: string
          name: string
          organization_id: string
          phone?: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string
          email?: string
          id?: string
          name?: string
          organization_id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_counters: {
        Row: {
          kind: string
          next_value: number
          organization_id: string
          prefix: string
          updated_at: string
        }
        Insert: {
          kind: string
          next_value?: number
          organization_id: string
          prefix: string
          updated_at?: string
        }
        Update: {
          kind?: string
          next_value?: number
          organization_id?: string
          prefix?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          calculation_version: string
          created_at: string
          id: string
          issued_on: string
          kind: string
          organization_id: string
          snapshot: Json
          snapshot_version: number
          transaction_id: string
        }
        Insert: {
          calculation_version: string
          created_at?: string
          id?: string
          issued_on: string
          kind: string
          organization_id: string
          snapshot: Json
          snapshot_version: number
          transaction_id: string
        }
        Update: {
          calculation_version?: string
          created_at?: string
          id?: string
          issued_on?: string
          kind?: string
          organization_id?: string
          snapshot?: Json
          snapshot_version?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_transaction_organization_fk"
            columns: ["transaction_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id", "organization_id"]
          },
        ]
      }
      installments: {
        Row: {
          due_date: string
          id: string
          interest_cents: number
          organization_id: string
          payment_cents: number
          payment_number: number
          principal_cents: number
          remaining_principal_cents: number
          schedule_version_id: string
        }
        Insert: {
          due_date: string
          id?: string
          interest_cents: number
          organization_id: string
          payment_cents: number
          payment_number: number
          principal_cents: number
          remaining_principal_cents: number
          schedule_version_id: string
        }
        Update: {
          due_date?: string
          id?: string
          interest_cents?: number
          organization_id?: string
          payment_cents?: number
          payment_number?: number
          principal_cents?: number
          remaining_principal_cents?: number
          schedule_version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_schedule_organization_fk"
            columns: ["schedule_version_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "installments_schedule_version_id_fkey"
            columns: ["schedule_version_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          account_reference: string
          annual_rate: number
          created_at: string
          created_by: string
          current_schedule_version_id: string | null
          customer_id: string
          down_payment_cents: number
          first_due_date: string
          id: string
          organization_id: string
          original_principal_cents: number
          price_cents: number
          status: string
          term_months: number
          updated_at: string
          version: number
          voided_at: string | null
        }
        Insert: {
          account_reference: string
          annual_rate: number
          created_at?: string
          created_by: string
          current_schedule_version_id?: string | null
          customer_id: string
          down_payment_cents: number
          first_due_date: string
          id?: string
          organization_id: string
          original_principal_cents: number
          price_cents: number
          status?: string
          term_months: number
          updated_at?: string
          version?: number
          voided_at?: string | null
        }
        Update: {
          account_reference?: string
          annual_rate?: number
          created_at?: string
          created_by?: string
          current_schedule_version_id?: string | null
          customer_id?: string
          down_payment_cents?: number
          first_due_date?: string
          id?: string
          organization_id?: string
          original_principal_cents?: number
          price_cents?: number
          status?: string
          term_months?: number
          updated_at?: string
          version?: number
          voided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "loans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_current_schedule_fk"
            columns: ["current_schedule_version_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_customer_organization_fk"
            columns: ["customer_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "loans_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          active: boolean
          created_at: string
          organization_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          organization_id: string
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          organization_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          default_recipient: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_recipient?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_recipient?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_adjustment_details: {
        Row: {
          adjusted_by: string
          adjusted_next_payment_cents: number
          credit_balance_cents: number
          next_payment_date: string
          notes: string
          organization_id: string
          payment_date: string
          payment_number: number
          payment_reference: string
          received_payment_cents: number
          scheduled_payment_cents: number
          transaction_id: string
        }
        Insert: {
          adjusted_by?: string
          adjusted_next_payment_cents: number
          credit_balance_cents: number
          next_payment_date: string
          notes?: string
          organization_id: string
          payment_date: string
          payment_number: number
          payment_reference?: string
          received_payment_cents: number
          scheduled_payment_cents: number
          transaction_id: string
        }
        Update: {
          adjusted_by?: string
          adjusted_next_payment_cents?: number
          credit_balance_cents?: number
          next_payment_date?: string
          notes?: string
          organization_id?: string
          payment_date?: string
          payment_number?: number
          payment_reference?: string
          received_payment_cents?: number
          scheduled_payment_cents?: number
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adjustment_details_transaction_organization_fk"
            columns: ["transaction_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "payment_adjustment_details_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_adjustment_details_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      schedule_versions: {
        Row: {
          calculation_version: string
          created_at: string
          effective_after_payment: number
          final_payment_cents: number
          first_due_date: string
          first_payment_number: number
          future_interest_cents: number
          id: string
          loan_id: string
          organization_id: string
          previous_version_id: string | null
          principal_cents: number
          reason: string
          regular_payment_cents: number
          remaining_months: number
          source_transaction_id: string
          status: string
          version_number: number
        }
        Insert: {
          calculation_version: string
          created_at?: string
          effective_after_payment: number
          final_payment_cents: number
          first_due_date: string
          first_payment_number: number
          future_interest_cents: number
          id?: string
          loan_id: string
          organization_id: string
          previous_version_id?: string | null
          principal_cents: number
          reason: string
          regular_payment_cents: number
          remaining_months: number
          source_transaction_id: string
          status?: string
          version_number: number
        }
        Update: {
          calculation_version?: string
          created_at?: string
          effective_after_payment?: number
          final_payment_cents?: number
          first_due_date?: string
          first_payment_number?: number
          future_interest_cents?: number
          id?: string
          loan_id?: string
          organization_id?: string
          previous_version_id?: string | null
          principal_cents?: number
          reason?: string
          regular_payment_cents?: number
          remaining_months?: number
          source_transaction_id?: string
          status?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "schedule_versions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_versions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_versions_previous_version_id_fkey"
            columns: ["previous_version_id"]
            isOneToOne: false
            referencedRelation: "schedule_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_versions_source_transaction_id_fkey"
            columns: ["source_transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_loan_organization_fk"
            columns: ["loan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "schedules_source_loan_organization_fk"
            columns: ["source_transaction_id", "loan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id", "loan_id", "organization_id"]
          },
        ]
      }
      transactions: {
        Row: {
          created_at: string
          created_by: string
          depends_on_transaction_id: string | null
          document_number: string
          effective_date: string
          id: string
          idempotency_key: string
          ledger_sequence: number
          loan_id: string
          organization_id: string
          replaces_transaction_id: string | null
          status: string
          type: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          depends_on_transaction_id?: string | null
          document_number: string
          effective_date: string
          id?: string
          idempotency_key: string
          ledger_sequence?: number
          loan_id: string
          organization_id: string
          replaces_transaction_id?: string | null
          status?: string
          type: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          depends_on_transaction_id?: string | null
          document_number?: string
          effective_date?: string
          id?: string
          idempotency_key?: string
          ledger_sequence?: number
          loan_id?: string
          organization_id?: string
          replaces_transaction_id?: string | null
          status?: string
          type?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_dependency_loan_organization_fk"
            columns: ["depends_on_transaction_id", "loan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id", "loan_id", "organization_id"]
          },
          {
            foreignKeyName: "transactions_depends_on_transaction_id_fkey"
            columns: ["depends_on_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_loan_organization_fk"
            columns: ["loan_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_replacement_organization_fk"
            columns: ["replaces_transaction_id", "organization_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id", "organization_id"]
          },
          {
            foreignKeyName: "transactions_replaces_transaction_id_fkey"
            columns: ["replaces_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_voided_by_fkey"
            columns: ["voided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      edit_transaction: { Args: { command: Json }; Returns: Json }
      post_capital_payment: { Args: { command: Json }; Returns: Json }
      post_loan: { Args: { command: Json }; Returns: Json }
      post_payment_adjustment: { Args: { command: Json }; Returns: Json }
      record_audit_event: {
        Args: {
          target_action: string
          target_details?: Json
          target_entity_id: string
          target_entity_type: string
          target_organization_id: string
        }
        Returns: undefined
      }
      server_create_customer: {
        Args: {
          actor_id: string
          target_email: string
          target_name: string
          target_organization_id: string
          target_phone: string
        }
        Returns: Json
      }
      server_edit_transaction: {
        Args: { actor_id: string; command: Json }
        Returns: Json
      }
      server_post_capital_payment: {
        Args: { actor_id: string; command: Json }
        Returns: Json
      }
      server_post_loan: {
        Args: { actor_id: string; command: Json }
        Returns: Json
      }
      server_post_payment_adjustment: {
        Args: { actor_id: string; command: Json }
        Returns: Json
      }
      server_record_audit_event: {
        Args: {
          actor_id: string
          target_action: string
          target_details?: Json
          target_entity_id: string
          target_entity_type: string
          target_organization_id: string
        }
        Returns: undefined
      }
      server_update_customer: {
        Args: {
          actor_id: string
          target_archive: boolean
          target_customer_id: string
          target_email?: string
          target_name?: string
          target_organization_id: string
          target_phone?: string
        }
        Returns: Json
      }
      server_update_organization_settings: {
        Args: {
          actor_id: string
          target_default_recipient: string
          target_name: string
          target_organization_id: string
          target_prefixes: Json
        }
        Returns: Json
      }
      server_void_transaction: {
        Args: {
          actor_id: string
          reason: string
          target_transaction_id: string
        }
        Returns: Json
      }
      update_my_profile: {
        Args: { target_display_name: string; target_organization_name?: string }
        Returns: Json
      }
      void_transaction: {
        Args: { reason: string; target_transaction_id: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
