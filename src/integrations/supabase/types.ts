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
  public: {
    Tables: {
      call_activities: {
        Row: {
          call_type: string | null
          campaign_id: string | null
          created_at: string
          deposit_amount: number | null
          duration_seconds: number | null
          end_time: string | null
          id: string
          lead_name: string | null
          notes: string | null
          phone_number: string | null
          recording_url: string | null
          start_time: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          call_type?: string | null
          campaign_id?: string | null
          created_at?: string
          deposit_amount?: number | null
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          lead_name?: string | null
          notes?: string | null
          phone_number?: string | null
          recording_url?: string | null
          start_time?: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          call_type?: string | null
          campaign_id?: string | null
          created_at?: string
          deposit_amount?: number | null
          duration_seconds?: number | null
          end_time?: string | null
          id?: string
          lead_name?: string | null
          notes?: string | null
          phone_number?: string | null
          recording_url?: string | null
          start_time?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "call_activities_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      callbacks: {
        Row: {
          created_at: string
          id: string
          lead_name: string
          notes: string | null
          phone_number: string | null
          scheduled_for: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_name: string
          notes?: string | null
          phone_number?: string | null
          scheduled_for: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_name?: string
          notes?: string | null
          phone_number?: string | null
          scheduled_for?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          ai_script: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          start_date: string | null
          status: string
          suggestions: Json | null
          target_calls: number | null
          target_conversions: number | null
          target_segment: string | null
          total_calls: number | null
          total_conversions: number | null
          total_deposits: number | null
          total_leads: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_script?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          start_date?: string | null
          status?: string
          suggestions?: Json | null
          target_calls?: number | null
          target_conversions?: number | null
          target_segment?: string | null
          total_calls?: number | null
          total_conversions?: number | null
          total_deposits?: number | null
          total_leads?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_script?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          start_date?: string | null
          status?: string
          suggestions?: Json | null
          target_calls?: number | null
          target_conversions?: number | null
          target_segment?: string | null
          total_calls?: number | null
          total_conversions?: number | null
          total_deposits?: number | null
          total_leads?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_metrics: {
        Row: {
          callbacks_due: number | null
          calls_made: number | null
          connects: number | null
          conversions: number | null
          created_at: string
          date: string
          id: string
          total_deposit_value: number | null
          total_handle_time_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          callbacks_due?: number | null
          calls_made?: number | null
          connects?: number | null
          conversions?: number | null
          created_at?: string
          date: string
          id?: string
          total_deposit_value?: number | null
          total_handle_time_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          callbacks_due?: number | null
          calls_made?: number | null
          connects?: number | null
          conversions?: number | null
          created_at?: string
          date?: string
          id?: string
          total_deposit_value?: number | null
          total_handle_time_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          campaign: string | null
          campaign_id: string | null
          created_at: string
          id: string
          intent: string | null
          last_activity: string | null
          last_bet_date: string | null
          last_contact_at: string | null
          last_deposit_ugx: number | null
          name: string
          next_action: string | null
          next_action_due: string | null
          phone: string
          priority: string
          score: number | null
          segment: string
          sla_minutes: number | null
          tags: string[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          campaign?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          last_activity?: string | null
          last_bet_date?: string | null
          last_contact_at?: string | null
          last_deposit_ugx?: number | null
          name: string
          next_action?: string | null
          next_action_due?: string | null
          phone: string
          priority: string
          score?: number | null
          segment: string
          sla_minutes?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          campaign?: string | null
          campaign_id?: string | null
          created_at?: string
          id?: string
          intent?: string | null
          last_activity?: string | null
          last_bet_date?: string | null
          last_contact_at?: string | null
          last_deposit_ugx?: number | null
          name?: string
          next_action?: string | null
          next_action_due?: string | null
          phone?: string
          priority?: string
          score?: number | null
          segment?: string
          sla_minutes?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          avatar_url: string | null
          created_at: string
          current_call_start: string | null
          email: string | null
          full_name: string | null
          id: string
          last_status_change: string | null
          manager_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          approved?: boolean
          avatar_url?: string | null
          created_at?: string
          current_call_start?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          last_status_change?: string | null
          manager_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          approved?: boolean
          avatar_url?: string | null
          created_at?: string
          current_call_start?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          last_status_change?: string | null
          manager_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      webrtc_tokens: {
        Row: {
          client_name: string
          created_at: string
          expires_at: string
          id: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name: string
          created_at?: string
          expires_at: string
          id?: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_webrtc_tokens: { Args: never; Returns: undefined }
      get_agent_monitor_data:
        | {
            Args: never
            Returns: {
              assigned_leads: number
              calls_today: number
              current_call_start: string
              email: string
              full_name: string
              id: string
              last_campaign_name: string
              last_status_change: string
              status: string
            }[]
          }
        | {
            Args: { manager_filter?: string }
            Returns: {
              assigned_leads: number
              calls_today: number
              current_call_start: string
              email: string
              full_name: string
              id: string
              last_campaign_name: string
              last_status_change: string
              manager_id: string
              status: string
            }[]
          }
      get_agent_uncalled_leads: {
        Args: { agent_id: string }
        Returns: {
          assigned_at: string
          assigned_by: string
          campaign: string
          campaign_id: string
          created_at: string
          id: string
          intent: string
          last_activity: string
          last_bet_date: string
          last_contact_at: string
          last_deposit_ugx: number
          name: string
          next_action: string
          next_action_due: string
          phone: string
          priority: string
          score: number
          segment: string
          sla_minutes: number
          tags: string[]
          updated_at: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      verify_leads_rls: {
        Args: never
        Returns: {
          policy_count: number
          rls_enabled: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user" | "management" | "agent"
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
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user", "management", "agent"],
    },
  },
} as const
