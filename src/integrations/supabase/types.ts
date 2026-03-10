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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      availability: {
        Row: {
          availability_type: string | null
          available: boolean
          created_at: string
          day_of_week: number
          end_time: string | null
          id: string
          location_id: string | null
          preset: string | null
          start_time: string | null
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          availability_type?: string | null
          available?: boolean
          created_at?: string
          day_of_week: number
          end_time?: string | null
          id?: string
          location_id?: string | null
          preset?: string | null
          start_time?: string | null
          updated_at?: string
          user_id: string
          week_start?: string
        }
        Update: {
          availability_type?: string | null
          available?: boolean
          created_at?: string
          day_of_week?: number
          end_time?: string | null
          id?: string
          location_id?: string | null
          preset?: string | null
          start_time?: string | null
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_exceptions: {
        Row: {
          availability_type: string | null
          available: boolean
          created_at: string
          date: string
          end_time: string | null
          id: string
          location_id: string | null
          preset: string | null
          reason: string | null
          start_time: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          availability_type?: string | null
          available?: boolean
          created_at?: string
          date: string
          end_time?: string | null
          id?: string
          location_id?: string | null
          preset?: string | null
          reason?: string | null
          start_time?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          availability_type?: string | null
          available?: boolean
          created_at?: string
          date?: string
          end_time?: string | null
          id?: string
          location_id?: string | null
          preset?: string | null
          reason?: string | null
          start_time?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_exceptions_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_templates: {
        Row: {
          created_at: string
          entries: Json
          id: string
          location_id: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entries?: Json
          id?: string
          location_id?: string | null
          name?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entries?: Json
          id?: string
          location_id?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_templates_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      fulltimer_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          location_id: string
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time?: string
          id?: string
          location_id: string
          start_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          location_id?: string
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fulltimer_schedules_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      kiosk_accounts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          location_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          location_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kiosk_accounts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      location_settings: {
        Row: {
          availability_deadline_day: number
          availability_deadline_time: string
          availability_earliest_time: string
          availability_from_end: string
          availability_from_start: string
          availability_latest_time: string
          availability_to_end: string
          availability_to_start: string
          breaks_enabled: boolean
          created_at: string
          earliest_shift_start: string
          id: string
          latest_shift_end: string
          location_id: string
          time_entry_increment_mins: number
          time_entry_mode: string
          updated_at: string
        }
        Insert: {
          availability_deadline_day?: number
          availability_deadline_time?: string
          availability_earliest_time?: string
          availability_from_end?: string
          availability_from_start?: string
          availability_latest_time?: string
          availability_to_end?: string
          availability_to_start?: string
          breaks_enabled?: boolean
          created_at?: string
          earliest_shift_start?: string
          id?: string
          latest_shift_end?: string
          location_id: string
          time_entry_increment_mins?: number
          time_entry_mode?: string
          updated_at?: string
        }
        Update: {
          availability_deadline_day?: number
          availability_deadline_time?: string
          availability_earliest_time?: string
          availability_from_end?: string
          availability_from_start?: string
          availability_latest_time?: string
          availability_to_end?: string
          availability_to_start?: string
          breaks_enabled?: boolean
          created_at?: string
          earliest_shift_start?: string
          id?: string
          latest_shift_end?: string
          location_id?: string
          time_entry_increment_mins?: number
          time_entry_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_settings_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: true
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
          timezone: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
          timezone?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean
          availability_locked: boolean
          created_at: string
          full_name: string
          id: string
          organization_id: string | null
          phone: string | null
          profile_picture: string | null
          staff_type: string
          unique_key: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          active?: boolean
          availability_locked?: boolean
          created_at?: string
          full_name: string
          id?: string
          organization_id?: string | null
          phone?: string | null
          profile_picture?: string | null
          staff_type?: string
          unique_key?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          active?: boolean
          availability_locked?: boolean
          created_at?: string
          full_name?: string
          id?: string
          organization_id?: string | null
          phone?: string | null
          profile_picture?: string | null
          staff_type?: string
          unique_key?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          created_at: string
          date: string
          end_time: string
          id: string
          location_id: string
          published: boolean
          standby: boolean
          start_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          end_time: string
          id?: string
          location_id: string
          published?: boolean
          standby?: boolean
          start_time: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          end_time?: string
          id?: string
          location_id?: string
          published?: boolean
          standby?: boolean
          start_time?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      time_punches: {
        Row: {
          approved: boolean | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          date: string
          id: string
          location_id: string
          notes: string | null
          punch_in: string
          punch_out: string | null
          recorded_in_by_id: string | null
          recorded_out_by_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date: string
          id?: string
          location_id: string
          notes?: string | null
          punch_in: string
          punch_out?: string | null
          recorded_in_by_id?: string | null
          recorded_out_by_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved?: boolean | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          date?: string
          id?: string
          location_id?: string
          notes?: string | null
          punch_in?: string
          punch_out?: string | null
          recorded_in_by_id?: string | null
          recorded_out_by_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_punches_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_locations: {
        Row: {
          created_at: string
          id: string
          location_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_locations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_unique_key: { Args: never; Returns: string }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      get_user_org: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "shiftleader"
        | "worker"
        | "kiosk"
        | "fulltimer"
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
      app_role: [
        "admin",
        "manager",
        "shiftleader",
        "worker",
        "kiosk",
        "fulltimer",
      ],
    },
  },
} as const
