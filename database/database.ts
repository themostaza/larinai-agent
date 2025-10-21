export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
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
      agents: {
        Row: {
          created_at: string
          id: string
          name: string | null
          organization_id: string | null
          settings: Json | null
          system_prompt: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          organization_id?: string | null
          settings?: Json | null
          system_prompt?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          organization_id?: string | null
          settings?: Json | null
          system_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string | null
          id: string
          message_content: Json | null
          message_id: string
          metadata: Json | null
          parts: Json
          role: string
          session_id: string | null
          thumb_down: boolean | null
          thumb_up: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_content?: Json | null
          message_id: string
          metadata?: Json | null
          parts?: Json
          role: string
          session_id?: string | null
          thumb_down?: boolean | null
          thumb_up?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message_content?: Json | null
          message_id?: string
          metadata?: Json | null
          parts?: Json
          role?: string
          session_id?: string | null
          thumb_down?: boolean | null
          thumb_up?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          agent_id: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agent_id?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      invited_users: {
        Row: {
          created_at: string
          email: string | null
          id: number
          organization_id: string | null
          public_invitation_id: string | null
          role: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: number
          organization_id?: string | null
          public_invitation_id?: string | null
          role?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: number
          organization_id?: string | null
          public_invitation_id?: string | null
          role?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invited_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      link_organization_user: {
        Row: {
          created_at: string
          id: number
          organization_id: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          organization_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          organization_id?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "link_organization_user_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      organization: {
        Row: {
          created_at: string
          id: string
          name: string | null
          settings: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          name?: string | null
          settings?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string | null
          settings?: Json | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          pay_settings_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          pay_settings_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          pay_settings_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_pay_settings_id_fkey"
            columns: ["pay_settings_id"]
            isOneToOne: false
            referencedRelation: "payments_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      payments_settings: {
        Row: {
          created_at: string
          id: string
          isactive: boolean | null
          metadata: Json | null
          organization_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          isactive?: boolean | null
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          isactive?: boolean | null
          metadata?: Json | null
          organization_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organization"
            referencedColumns: ["id"]
          },
        ]
      }
      query_ececutions: {
        Row: {
          created_at: string
          id: number
          output: Json | null
          query_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          output?: Json | null
          query_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          output?: Json | null
          query_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_ececutions_query_id_fkey"
            columns: ["query_id"]
            isOneToOne: false
            referencedRelation: "query_saved"
            referencedColumns: ["id"]
          },
        ]
      }
      query_saved: {
        Row: {
          body: Json | null
          chart_kpi: Json | null
          chat_message_id: string | null
          created_at: string
          id: string
          query: string | null
          title: string | null
        }
        Insert: {
          body?: Json | null
          chart_kpi?: Json | null
          chat_message_id?: string | null
          created_at?: string
          id?: string
          query?: string | null
          title?: string | null
        }
        Update: {
          body?: Json | null
          chart_kpi?: Json | null
          chat_message_id?: string | null
          created_at?: string
          id?: string
          query?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "query_saved_chat_message_id_fkey"
            columns: ["chat_message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      tool_executions: {
        Row: {
          created_at: string | null
          error_message: string | null
          execution_time_ms: number | null
          id: string
          input_data: Json
          message_id: string | null
          output_data: Json | null
          success: boolean | null
          tool_name: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_data: Json
          message_id?: string | null
          output_data?: Json | null
          success?: boolean | null
          tool_name: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_data?: Json
          message_id?: string | null
          output_data?: Json | null
          success?: boolean | null
          tool_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tool_executions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
