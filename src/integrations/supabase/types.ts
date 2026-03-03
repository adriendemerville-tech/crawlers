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
      action_plans: {
        Row: {
          audit_type: string
          created_at: string
          id: string
          tasks: Json
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          audit_type: string
          created_at?: string
          id?: string
          tasks?: Json
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          audit_type?: string
          created_at?: string
          id?: string
          tasks?: Json
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_dashboard_config: {
        Row: {
          card_order: Json
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_order?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_order?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agency_client_sites: {
        Row: {
          client_id: string
          created_at: string
          id: string
          tracked_site_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          tracked_site_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          tracked_site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_client_sites_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_client_sites_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_clients: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          first_name: string
          id: string
          last_name: string
          owner_user_id: string
          role: string | null
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          owner_user_id: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          owner_user_id?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_invitations: {
        Row: {
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string
          id: string
          owner_user_id: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          owner_user_id: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string
          id?: string
          owner_user_id?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: []
      }
      agency_team_members: {
        Row: {
          created_at: string
          id: string
          member_user_id: string
          owner_user_id: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_user_id: string
          owner_user_id: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_user_id?: string
          owner_user_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          session_id: string | null
          target_url: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          session_id?: string | null
          target_url?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          session_id?: string | null
          target_url?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analyzed_urls: {
        Row: {
          analysis_count: number
          domain: string
          first_analyzed_at: string
          id: string
          last_analyzed_at: string
          url: string
        }
        Insert: {
          analysis_count?: number
          domain: string
          first_analyzed_at?: string
          id?: string
          last_analyzed_at?: string
          url: string
        }
        Update: {
          analysis_count?: number
          domain?: string
          first_analyzed_at?: string
          id?: string
          last_analyzed_at?: string
          url?: string
        }
        Relationships: []
      }
      audit_recommendations_registry: {
        Row: {
          audit_type: string
          category: string
          created_at: string
          description: string
          domain: string
          fix_data: Json | null
          fix_type: string | null
          id: string
          is_resolved: boolean | null
          priority: string
          prompt_summary: string
          recommendation_id: string
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          audit_type: string
          category: string
          created_at?: string
          description: string
          domain: string
          fix_data?: Json | null
          fix_type?: string | null
          id?: string
          is_resolved?: boolean | null
          priority: string
          prompt_summary: string
          recommendation_id: string
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          audit_type?: string
          category?: string
          created_at?: string
          description?: string
          domain?: string
          fix_data?: Json | null
          fix_type?: string | null
          id?: string
          is_resolved?: boolean | null
          priority?: string
          prompt_summary?: string
          recommendation_id?: string
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      audits: {
        Row: {
          audit_data: Json | null
          created_at: string
          domain: string
          dynamic_price: number
          fixes_count: number
          fixes_metadata: Json
          generated_code: string | null
          id: string
          payment_status: string
          sector: string | null
          stripe_payment_intent_id: string | null
          stripe_session_id: string | null
          updated_at: string
          url: string
          user_id: string | null
        }
        Insert: {
          audit_data?: Json | null
          created_at?: string
          domain: string
          dynamic_price?: number
          fixes_count?: number
          fixes_metadata?: Json
          generated_code?: string | null
          id?: string
          payment_status?: string
          sector?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          url: string
          user_id?: string | null
        }
        Update: {
          audit_data?: Json | null
          created_at?: string
          domain?: string
          dynamic_price?: number
          fixes_count?: number
          fixes_metadata?: Json
          generated_code?: string | null
          id?: string
          payment_status?: string
          sector?: string | null
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          url?: string
          user_id?: string | null
        }
        Relationships: []
      }
      billing_info: {
        Row: {
          billing_address: string | null
          billing_city: string | null
          billing_country: string | null
          billing_postal_code: string | null
          company_name: string | null
          created_at: string
          id: string
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          billing_address?: string | null
          billing_city?: string | null
          billing_country?: string | null
          billing_postal_code?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      blog_articles: {
        Row: {
          author_id: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["article_status"]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["article_status"]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["article_status"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          id: string
          stripe_session_id: string | null
          transaction_type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          id?: string
          stripe_session_id?: string | null
          transaction_type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          id?: string
          stripe_session_id?: string | null
          transaction_type?: string
          user_id?: string
        }
        Relationships: []
      }
      hallucination_corrections: {
        Row: {
          analysis_narrative: string | null
          confusion_sources: Json | null
          corrected_values: Json
          created_at: string
          discrepancies: Json
          domain: string
          id: string
          original_values: Json
          recommendations: Json
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          analysis_narrative?: string | null
          confusion_sources?: Json | null
          corrected_values?: Json
          created_at?: string
          discrepancies?: Json
          domain: string
          id?: string
          original_values?: Json
          recommendations?: Json
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          analysis_narrative?: string | null
          confusion_sources?: Json | null
          corrected_values?: Json
          created_at?: string
          discrepancies?: Json
          domain?: string
          id?: string
          original_values?: Json
          recommendations?: Json
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      magic_links: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token: string
          used: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          agency_brand_name: string | null
          agency_contact_email: string | null
          agency_contact_first_name: string | null
          agency_contact_last_name: string | null
          agency_contact_phone: string | null
          agency_logo_url: string | null
          agency_primary_color: string | null
          agency_report_footer_text: string | null
          agency_report_header_text: string | null
          api_key: string
          avatar_url: string | null
          created_at: string
          credits_balance: number
          email: string
          first_name: string
          id: string
          last_name: string
          plan_type: string
          referral_code: string | null
          referred_by: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          agency_brand_name?: string | null
          agency_contact_email?: string | null
          agency_contact_first_name?: string | null
          agency_contact_last_name?: string | null
          agency_contact_phone?: string | null
          agency_logo_url?: string | null
          agency_primary_color?: string | null
          agency_report_footer_text?: string | null
          agency_report_header_text?: string | null
          api_key?: string
          avatar_url?: string | null
          created_at?: string
          credits_balance?: number
          email: string
          first_name: string
          id?: string
          last_name: string
          plan_type?: string
          referral_code?: string | null
          referred_by?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          agency_brand_name?: string | null
          agency_contact_email?: string | null
          agency_contact_first_name?: string | null
          agency_contact_last_name?: string | null
          agency_contact_phone?: string | null
          agency_logo_url?: string | null
          agency_primary_color?: string | null
          agency_report_footer_text?: string | null
          agency_report_header_text?: string | null
          api_key?: string
          avatar_url?: string | null
          created_at?: string
          credits_balance?: number
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          plan_type?: string
          referral_code?: string | null
          referred_by?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_rewards: {
        Row: {
          created_at: string
          id: string
          referee_id: string
          referrer_id: string
          reward_amount: number
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          referee_id: string
          referrer_id: string
          reward_amount?: number
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          referee_id?: string
          referrer_id?: string
          reward_amount?: number
          status?: string
        }
        Relationships: []
      }
      report_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "report_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_corrective_codes: {
        Row: {
          code: string
          created_at: string
          fixes_applied: Json
          id: string
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          fixes_applied?: Json
          id?: string
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          fixes_applied?: Json
          id?: string
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_reports: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          pdf_url: string | null
          position: number
          report_data: Json
          report_type: Database["public"]["Enums"]["report_type"]
          title: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          pdf_url?: string | null
          position?: number
          report_data: Json
          report_type: Database["public"]["Enums"]["report_type"]
          title: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          pdf_url?: string | null
          position?: number
          report_data?: Json
          report_type?: Database["public"]["Enums"]["report_type"]
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_reports_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "report_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_link_clicks: {
        Row: {
          created_at: string
          id: string
          referrer_id: string
          report_id: string
          visitor_ip: string
        }
        Insert: {
          created_at?: string
          id?: string
          referrer_id: string
          report_id: string
          visitor_ip: string
        }
        Update: {
          created_at?: string
          id?: string
          referrer_id?: string
          report_id?: string
          visitor_ip?: string
        }
        Relationships: []
      }
      solution_library: {
        Row: {
          category: string | null
          code_snippet: string
          created_at: string
          description: string | null
          error_type: string
          id: string
          is_generic: boolean | null
          label: string | null
          priority: string | null
          success_rate: number | null
          target_selector_context: string | null
          technology_context: string | null
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          code_snippet: string
          created_at?: string
          description?: string | null
          error_type: string
          id?: string
          is_generic?: boolean | null
          label?: string | null
          priority?: string | null
          success_rate?: number | null
          target_selector_context?: string | null
          technology_context?: string | null
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          code_snippet?: string
          created_at?: string
          description?: string | null
          error_type?: string
          id?: string
          is_generic?: boolean | null
          label?: string | null
          priority?: string | null
          success_rate?: number | null
          target_selector_context?: string | null
          technology_context?: string | null
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      stripe_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          email: string | null
          fixes_count: number | null
          generated_code: string | null
          id: string
          site_url: string
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          email?: string | null
          fixes_count?: number | null
          generated_code?: string | null
          id?: string
          site_url: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          email?: string | null
          fixes_count?: number | null
          generated_code?: string | null
          id?: string
          site_url?: string
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          status: string
          subject: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_admin: boolean
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_admin?: boolean
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      tracked_sites: {
        Row: {
          api_key: string
          created_at: string
          current_config: Json
          domain: string
          id: string
          last_audit_at: string | null
          site_name: string
          user_id: string
        }
        Insert: {
          api_key?: string
          created_at?: string
          current_config?: Json
          domain: string
          id?: string
          last_audit_at?: string | null
          site_name?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          current_config?: Json
          domain?: string
          id?: string
          last_audit_at?: string | null
          site_name?: string
          user_id?: string
        }
        Relationships: []
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
      user_stats_history: {
        Row: {
          ads_budget_saved: number | null
          ai_sentiment: string | null
          domain: string
          geo_score: number | null
          id: string
          llm_citation_rate: number | null
          raw_data: Json | null
          recorded_at: string
          semantic_authority: number | null
          seo_score: number | null
          technical_errors_fixed: number | null
          tracked_site_id: string
          user_id: string
          voice_share: number | null
        }
        Insert: {
          ads_budget_saved?: number | null
          ai_sentiment?: string | null
          domain: string
          geo_score?: number | null
          id?: string
          llm_citation_rate?: number | null
          raw_data?: Json | null
          recorded_at?: string
          semantic_authority?: number | null
          seo_score?: number | null
          technical_errors_fixed?: number | null
          tracked_site_id: string
          user_id: string
          voice_share?: number | null
        }
        Update: {
          ads_budget_saved?: number | null
          ai_sentiment?: string | null
          domain?: string
          geo_score?: number | null
          id?: string
          llm_citation_rate?: number | null
          raw_data?: Json | null
          recorded_at?: string
          semantic_authority?: number | null
          seo_score?: number | null
          technical_errors_fixed?: number | null
          tracked_site_id?: string
          user_id?: string
          voice_share?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_stats_history_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      use_credit:
        | { Args: { p_description?: string; p_user_id: string }; Returns: Json }
        | {
            Args: {
              p_amount?: number
              p_description?: string
              p_user_id: string
            }
            Returns: Json
          }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      article_status:
        | "draft"
        | "published"
        | "unpublished"
        | "archived"
        | "deleted"
      report_type:
        | "seo_technical"
        | "seo_strategic"
        | "llm"
        | "geo"
        | "pagespeed"
        | "crawlers"
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
      app_role: ["admin", "moderator", "user"],
      article_status: [
        "draft",
        "published",
        "unpublished",
        "archived",
        "deleted",
      ],
      report_type: [
        "seo_technical",
        "seo_strategic",
        "llm",
        "geo",
        "pagespeed",
        "crawlers",
      ],
    },
  },
} as const
