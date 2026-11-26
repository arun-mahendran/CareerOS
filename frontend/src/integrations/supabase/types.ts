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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      calendar_events: {
        Row: {
          all_day: boolean
          application_id: string | null
          created_at: string
          ends_at: string | null
          id: string
          location: string | null
          notes: string | null
          starts_at: string
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          application_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          starts_at: string
          title: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          all_day?: boolean
          application_id?: string | null
          created_at?: string
          ends_at?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          starts_at?: string
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interview_sessions: {
        Row: {
          answers: Json
          company: string | null
          created_at: string
          current_index: number
          difficulty: string
          feedback: Json
          id: string
          interview_type: string
          job_id: string | null
          practice_mode: string
          questions: Json
          status: string
          target_role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          company?: string | null
          created_at?: string
          current_index?: number
          difficulty?: string
          feedback?: Json
          id?: string
          interview_type: string
          job_id?: string | null
          practice_mode?: string
          questions?: Json
          status?: string
          target_role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          company?: string | null
          created_at?: string
          current_index?: number
          difficulty?: string
          feedback?: Json
          id?: string
          interview_type?: string
          job_id?: string | null
          practice_mode?: string
          questions?: Json
          status?: string
          target_role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      learning_resource_progress: {
        Row: {
          completed_at: string | null
          resource_url: string
          saved: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          resource_url: string
          saved?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          resource_url?: string
          saved?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          target_role: string | null
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          target_role?: string | null
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          target_role?: string | null
        }
        Relationships: []
      }
      resumes: {
        Row: {
          created_at: string
          data: Json
          id: string
          target_job_id: string | null
          target_role: string | null
          template: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          target_job_id?: string | null
          target_role?: string | null
          template?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          target_job_id?: string | null
          target_role?: string | null
          template?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roadmap_preferences: {
        Row: {
          pace: string
          priority_skills: string[]
          skill_level: string
          target_date: string | null
          updated_at: string
          user_id: string
          weekly_hours: number
        }
        Insert: {
          pace?: string
          priority_skills?: string[]
          skill_level?: string
          target_date?: string | null
          updated_at?: string
          user_id: string
          weekly_hours?: number
        }
        Update: {
          pace?: string
          priority_skills?: string[]
          skill_level?: string
          target_date?: string | null
          updated_at?: string
          user_id?: string
          weekly_hours?: number
        }
        Relationships: []
      }
      roadmap_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          minutes_logged: number
          status: string
          step_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          minutes_logged?: number
          status?: string
          step_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          minutes_logged?: number
          status?: string
          step_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      roadmap_study_logs: {
        Row: {
          created_at: string
          id: string
          logged_on: string
          minutes: number
          step_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logged_on?: string
          minutes: number
          step_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logged_on?: string
          minutes?: number
          step_id?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_jobs: {
        Row: {
          applied_on: string | null
          career_url: string | null
          company: string | null
          created_at: string
          follow_up_done: boolean
          follow_up_note: string | null
          follow_up_on: string | null
          history: Json
          id: string
          interview_at: string | null
          job_id: string
          job_type: string | null
          job_url: string | null
          location: string | null
          notes: string | null
          resume_id: string | null
          salary: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          applied_on?: string | null
          career_url?: string | null
          company?: string | null
          created_at?: string
          follow_up_done?: boolean
          follow_up_note?: string | null
          follow_up_on?: string | null
          history?: Json
          id?: string
          interview_at?: string | null
          job_id: string
          job_type?: string | null
          job_url?: string | null
          location?: string | null
          notes?: string | null
          resume_id?: string | null
          salary?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          applied_on?: string | null
          career_url?: string | null
          company?: string | null
          created_at?: string
          follow_up_done?: boolean
          follow_up_note?: string | null
          follow_up_on?: string | null
          history?: Json
          id?: string
          interview_at?: string | null
          job_id?: string
          job_type?: string | null
          job_url?: string | null
          location?: string | null
          notes?: string | null
          resume_id?: string | null
          salary?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      user_skills: {
        Row: {
          level: number
          skill: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          level: number
          skill: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          level?: number
          skill?: string
          source?: string
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "candidate"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "candidate"],
    },
  },
} as const
