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
          is_archived: boolean | null
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
          is_archived?: boolean | null
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
          is_archived?: boolean | null
          tasks?: Json
          title?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      actual_results: {
        Row: {
          accuracy_gap: number | null
          context_data: Json | null
          id: string
          prediction_id: string
          real_traffic_after_90_days: number
          recorded_at: string
        }
        Insert: {
          accuracy_gap?: number | null
          context_data?: Json | null
          id?: string
          prediction_id: string
          real_traffic_after_90_days: number
          recorded_at?: string
        }
        Update: {
          accuracy_gap?: number | null
          context_data?: Json | null
          id?: string
          prediction_id?: string
          real_traffic_after_90_days?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actual_results_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
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
      affiliate_codes: {
        Row: {
          assigned_to_user_id: string | null
          code: string
          created_at: string
          created_by: string
          current_activations: number
          discount_percent: number
          duration_months: number
          id: string
          is_active: boolean
          max_activations: number
          updated_at: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          code: string
          created_at?: string
          created_by: string
          current_activations?: number
          discount_percent?: number
          duration_months?: number
          id?: string
          is_active?: boolean
          max_activations?: number
          updated_at?: string
        }
        Update: {
          assigned_to_user_id?: string | null
          code?: string
          created_at?: string
          created_by?: string
          current_activations?: number
          discount_percent?: number
          duration_months?: number
          id?: string
          is_active?: boolean
          max_activations?: number
          updated_at?: string
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
      async_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          input_payload: Json
          progress: number | null
          result_data: Json | null
          started_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          input_payload?: Json
          progress?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          input_payload?: Json
          progress?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          function_name: string
          id: string
          result_data: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          function_name: string
          id?: string
          result_data?: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          function_name?: string
          id?: string
          result_data?: Json
        }
        Relationships: []
      }
      audit_impact_snapshots: {
        Row: {
          action_plan_progress: number | null
          audit_report_id: string | null
          audit_scores: Json
          audit_type: string
          corrective_code_deployed: boolean | null
          correlation_data: Json | null
          created_at: string
          dataforseo_baseline: Json | null
          dataforseo_t90: Json | null
          domain: string
          ga4_baseline: Json | null
          ga4_t30: Json | null
          ga4_t60: Json | null
          ga4_t90: Json | null
          gsc_baseline: Json | null
          gsc_t30: Json | null
          gsc_t30_measured_at: string | null
          gsc_t60: Json | null
          gsc_t60_measured_at: string | null
          gsc_t90: Json | null
          gsc_t90_measured_at: string | null
          id: string
          impact_score: number | null
          measurement_phase: string | null
          next_measurement_at: string | null
          pagespeed_baseline: Json | null
          pagespeed_t90: Json | null
          recommendations_count: number | null
          recommendations_data: Json | null
          recos_applied_count: number | null
          recos_applied_data: Json | null
          reliability_grade: string | null
          tracked_site_id: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          action_plan_progress?: number | null
          audit_report_id?: string | null
          audit_scores?: Json
          audit_type: string
          corrective_code_deployed?: boolean | null
          correlation_data?: Json | null
          created_at?: string
          dataforseo_baseline?: Json | null
          dataforseo_t90?: Json | null
          domain: string
          ga4_baseline?: Json | null
          ga4_t30?: Json | null
          ga4_t60?: Json | null
          ga4_t90?: Json | null
          gsc_baseline?: Json | null
          gsc_t30?: Json | null
          gsc_t30_measured_at?: string | null
          gsc_t60?: Json | null
          gsc_t60_measured_at?: string | null
          gsc_t90?: Json | null
          gsc_t90_measured_at?: string | null
          id?: string
          impact_score?: number | null
          measurement_phase?: string | null
          next_measurement_at?: string | null
          pagespeed_baseline?: Json | null
          pagespeed_t90?: Json | null
          recommendations_count?: number | null
          recommendations_data?: Json | null
          recos_applied_count?: number | null
          recos_applied_data?: Json | null
          reliability_grade?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          action_plan_progress?: number | null
          audit_report_id?: string | null
          audit_scores?: Json
          audit_type?: string
          corrective_code_deployed?: boolean | null
          correlation_data?: Json | null
          created_at?: string
          dataforseo_baseline?: Json | null
          dataforseo_t90?: Json | null
          domain?: string
          ga4_baseline?: Json | null
          ga4_t30?: Json | null
          ga4_t60?: Json | null
          ga4_t90?: Json | null
          gsc_baseline?: Json | null
          gsc_t30?: Json | null
          gsc_t30_measured_at?: string | null
          gsc_t60?: Json | null
          gsc_t60_measured_at?: string | null
          gsc_t90?: Json | null
          gsc_t90_measured_at?: string | null
          id?: string
          impact_score?: number | null
          measurement_phase?: string | null
          next_measurement_at?: string | null
          pagespeed_baseline?: Json | null
          pagespeed_t90?: Json | null
          recommendations_count?: number | null
          recommendations_data?: Json | null
          recos_applied_count?: number | null
          recos_applied_data?: Json | null
          reliability_grade?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_impact_snapshots_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_raw_data: {
        Row: {
          audit_type: string
          created_at: string
          domain: string
          id: string
          raw_payload: Json
          source_functions: string[]
          url: string
          user_id: string
        }
        Insert: {
          audit_type: string
          created_at?: string
          domain: string
          id?: string
          raw_payload?: Json
          source_functions?: string[]
          url: string
          user_id: string
        }
        Update: {
          audit_type?: string
          created_at?: string
          domain?: string
          id?: string
          raw_payload?: Json
          source_functions?: string[]
          url?: string
          user_id?: string
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
      backlink_snapshots: {
        Row: {
          anchor_distribution: Json | null
          backlinks_total: number | null
          created_at: string
          domain: string
          domain_rank: number | null
          id: string
          measured_at: string
          referring_domains: number | null
          referring_domains_lost: number | null
          referring_domains_new: number | null
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          anchor_distribution?: Json | null
          backlinks_total?: number | null
          created_at?: string
          domain: string
          domain_rank?: number | null
          id?: string
          measured_at?: string
          referring_domains?: number | null
          referring_domains_lost?: number | null
          referring_domains_new?: number | null
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Update: {
          anchor_distribution?: Json | null
          backlinks_total?: number | null
          created_at?: string
          domain?: string
          domain_rank?: number | null
          id?: string
          measured_at?: string
          referring_domains?: number | null
          referring_domains_lost?: number | null
          referring_domains_new?: number | null
          tracked_site_id?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "backlink_snapshots_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
          content_en: string | null
          content_es: string | null
          created_at: string
          excerpt: string | null
          excerpt_en: string | null
          excerpt_es: string | null
          id: string
          image_url: string | null
          published_at: string | null
          slug: string
          status: Database["public"]["Enums"]["article_status"]
          title: string
          title_en: string | null
          title_es: string | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string | null
          content_en?: string | null
          content_es?: string | null
          created_at?: string
          excerpt?: string | null
          excerpt_en?: string | null
          excerpt_es?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug: string
          status?: Database["public"]["Enums"]["article_status"]
          title: string
          title_en?: string | null
          title_es?: string | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string | null
          content_en?: string | null
          content_es?: string | null
          created_at?: string
          excerpt?: string | null
          excerpt_en?: string | null
          excerpt_es?: string | null
          id?: string
          image_url?: string | null
          published_at?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["article_status"]
          title?: string
          title_en?: string | null
          title_es?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cms_connections: {
        Row: {
          api_key: string | null
          auth_method: string
          basic_auth_pass: string | null
          basic_auth_user: string | null
          capabilities: Json | null
          created_at: string
          id: string
          oauth_access_token: string | null
          oauth_refresh_token: string | null
          platform: Database["public"]["Enums"]["cms_platform"]
          platform_site_id: string | null
          scopes: string[] | null
          site_url: string
          status: string
          token_expiry: string | null
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          auth_method?: string
          basic_auth_pass?: string | null
          basic_auth_user?: string | null
          capabilities?: Json | null
          created_at?: string
          id?: string
          oauth_access_token?: string | null
          oauth_refresh_token?: string | null
          platform: Database["public"]["Enums"]["cms_platform"]
          platform_site_id?: string | null
          scopes?: string[] | null
          site_url: string
          status?: string
          token_expiry?: string | null
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          auth_method?: string
          basic_auth_pass?: string | null
          basic_auth_user?: string | null
          capabilities?: Json | null
          created_at?: string
          id?: string
          oauth_access_token?: string | null
          oauth_refresh_token?: string | null
          platform?: Database["public"]["Enums"]["cms_platform"]
          platform_site_id?: string | null
          scopes?: string[] | null
          site_url?: string
          status?: string
          token_expiry?: string | null
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cms_connections_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      cocoon_chat_histories: {
        Row: {
          created_at: string
          domain: string
          id: string
          message_count: number
          messages: Json
          session_hash: string
          tracked_site_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          message_count?: number
          messages?: Json
          session_hash: string
          tracked_site_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          message_count?: number
          messages?: Json
          session_hash?: string
          tracked_site_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      cocoon_errors: {
        Row: {
          ai_response: string | null
          created_at: string
          domain: string
          id: string
          is_crawled: boolean | null
          problem_description: string
          resolved_at: string | null
          screenshot_url: string | null
          status: string
          tracked_site_id: string | null
          url_crawled: string | null
          user_id: string
          user_question: string | null
        }
        Insert: {
          ai_response?: string | null
          created_at?: string
          domain: string
          id?: string
          is_crawled?: boolean | null
          problem_description: string
          resolved_at?: string | null
          screenshot_url?: string | null
          status?: string
          tracked_site_id?: string | null
          url_crawled?: string | null
          user_id: string
          user_question?: string | null
        }
        Update: {
          ai_response?: string | null
          created_at?: string
          domain?: string
          id?: string
          is_crawled?: boolean | null
          problem_description?: string
          resolved_at?: string | null
          screenshot_url?: string | null
          status?: string
          tracked_site_id?: string | null
          url_crawled?: string | null
          user_id?: string
          user_question?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cocoon_errors_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      cocoon_recommendations: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_applied: boolean
          recommendation_text: string
          source_context: Json | null
          summary: string
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_applied?: boolean
          recommendation_text: string
          source_context?: Json | null
          summary: string
          tracked_site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_applied?: boolean
          recommendation_text?: string
          source_context?: Json | null
          summary?: string
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocoon_recommendations_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      cocoon_sessions: {
        Row: {
          avg_cannibalization_risk: number | null
          avg_citability_score: number | null
          avg_content_gap: number | null
          avg_eeat_score: number | null
          avg_geo_score: number | null
          avg_roi_predictive: number | null
          chat_messages: Json
          chat_turns: number
          cluster_summary: Json
          clusters_count: number
          created_at: string
          domain: string
          edges_snapshot: Json
          generation_duration_ms: number | null
          id: string
          intent_distribution: Json
          internal_links_density: number | null
          model_version: string | null
          nodes_count: number
          nodes_snapshot: Json
          outcome_measured_at: string | null
          outcome_position_delta: number | null
          outcome_traffic_delta: number | null
          total_traffic_estimate: number | null
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cannibalization_risk?: number | null
          avg_citability_score?: number | null
          avg_content_gap?: number | null
          avg_eeat_score?: number | null
          avg_geo_score?: number | null
          avg_roi_predictive?: number | null
          chat_messages?: Json
          chat_turns?: number
          cluster_summary?: Json
          clusters_count?: number
          created_at?: string
          domain: string
          edges_snapshot?: Json
          generation_duration_ms?: number | null
          id?: string
          intent_distribution?: Json
          internal_links_density?: number | null
          model_version?: string | null
          nodes_count?: number
          nodes_snapshot?: Json
          outcome_measured_at?: string | null
          outcome_position_delta?: number | null
          outcome_traffic_delta?: number | null
          total_traffic_estimate?: number | null
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cannibalization_risk?: number | null
          avg_citability_score?: number | null
          avg_content_gap?: number | null
          avg_eeat_score?: number | null
          avg_geo_score?: number | null
          avg_roi_predictive?: number | null
          chat_messages?: Json
          chat_turns?: number
          cluster_summary?: Json
          clusters_count?: number
          created_at?: string
          domain?: string
          edges_snapshot?: Json
          generation_duration_ms?: number | null
          id?: string
          intent_distribution?: Json
          internal_links_density?: number | null
          model_version?: string | null
          nodes_count?: number
          nodes_snapshot?: Json
          outcome_measured_at?: string | null
          outcome_position_delta?: number | null
          outcome_traffic_delta?: number | null
          total_traffic_estimate?: number | null
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cocoon_tasks: {
        Row: {
          created_at: string
          description: string | null
          id: string
          priority: string
          source_recommendation_id: string | null
          status: string
          title: string
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          source_recommendation_id?: string | null
          status?: string
          title: string
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          priority?: string
          source_recommendation_id?: string | null
          status?: string
          title?: string
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocoon_tasks_source_recommendation_id_fkey"
            columns: ["source_recommendation_id"]
            isOneToOne: false
            referencedRelation: "cocoon_recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cocoon_tasks_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      cocoon_theme_settings: {
        Row: {
          created_at: string
          id: string
          node_colors: Json
          owner_user_id: string
          particle_colors: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          node_colors?: Json
          owner_user_id: string
          particle_colors?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          node_colors?: Json
          owner_user_id?: string
          particle_colors?: Json
          updated_at?: string
        }
        Relationships: []
      }
      crawl_index_history: {
        Row: {
          crawl_id: string | null
          created_at: string
          dataforseo_indexed_count: number | null
          domain: string
          gsc_indexed_count: number | null
          id: string
          indexed_count: number
          noindex_count: number
          sitemap_count: number | null
          total_pages: number
          tracked_site_id: string | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          crawl_id?: string | null
          created_at?: string
          dataforseo_indexed_count?: number | null
          domain: string
          gsc_indexed_count?: number | null
          id?: string
          indexed_count?: number
          noindex_count?: number
          sitemap_count?: number | null
          total_pages?: number
          tracked_site_id?: string | null
          user_id: string
          week_start_date: string
        }
        Update: {
          crawl_id?: string | null
          created_at?: string
          dataforseo_indexed_count?: number | null
          domain?: string
          gsc_indexed_count?: number | null
          id?: string
          indexed_count?: number
          noindex_count?: number
          sitemap_count?: number | null
          total_pages?: number
          tracked_site_id?: string | null
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_index_history_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "site_crawls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_index_history_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_jobs: {
        Row: {
          completed_at: string | null
          crawl_id: string
          created_at: string
          custom_selectors: Json | null
          domain: string
          error_message: string | null
          id: string
          max_concurrent: number
          max_depth: number | null
          priority: number
          processed_count: number
          started_at: string | null
          status: string
          total_count: number
          url: string
          url_filter: string | null
          urls_to_process: Json
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          crawl_id: string
          created_at?: string
          custom_selectors?: Json | null
          domain: string
          error_message?: string | null
          id?: string
          max_concurrent?: number
          max_depth?: number | null
          priority?: number
          processed_count?: number
          started_at?: string | null
          status?: string
          total_count?: number
          url: string
          url_filter?: string | null
          urls_to_process?: Json
          user_id: string
        }
        Update: {
          completed_at?: string | null
          crawl_id?: string
          created_at?: string
          custom_selectors?: Json | null
          domain?: string
          error_message?: string | null
          id?: string
          max_concurrent?: number
          max_depth?: number | null
          priority?: number
          processed_count?: number
          started_at?: string | null
          status?: string
          total_count?: number
          url?: string
          url_filter?: string | null
          urls_to_process?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_jobs_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "site_crawls"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_pages: {
        Row: {
          anchor_texts: Json | null
          broken_links: Json | null
          canonical_url: string | null
          content_hash: string | null
          crawl_depth: number | null
          crawl_id: string
          created_at: string
          custom_extraction: Json | null
          external_links: number | null
          h1: string | null
          h2_count: number | null
          h3_count: number | null
          h4_h6_count: number | null
          has_canonical: boolean | null
          has_hreflang: boolean | null
          has_nofollow: boolean | null
          has_noindex: boolean | null
          has_og: boolean | null
          has_schema_org: boolean | null
          html_size_bytes: number | null
          http_status: number | null
          id: string
          images_total: number | null
          images_without_alt: number | null
          index_source: string | null
          internal_links: number | null
          is_indexable: boolean | null
          issues: Json | null
          meta_description: string | null
          page_type_override: string | null
          path: string
          redirect_url: string | null
          response_time_ms: number | null
          schema_org_errors: Json | null
          schema_org_types: Json | null
          seo_score: number | null
          title: string | null
          url: string
          word_count: number | null
        }
        Insert: {
          anchor_texts?: Json | null
          broken_links?: Json | null
          canonical_url?: string | null
          content_hash?: string | null
          crawl_depth?: number | null
          crawl_id: string
          created_at?: string
          custom_extraction?: Json | null
          external_links?: number | null
          h1?: string | null
          h2_count?: number | null
          h3_count?: number | null
          h4_h6_count?: number | null
          has_canonical?: boolean | null
          has_hreflang?: boolean | null
          has_nofollow?: boolean | null
          has_noindex?: boolean | null
          has_og?: boolean | null
          has_schema_org?: boolean | null
          html_size_bytes?: number | null
          http_status?: number | null
          id?: string
          images_total?: number | null
          images_without_alt?: number | null
          index_source?: string | null
          internal_links?: number | null
          is_indexable?: boolean | null
          issues?: Json | null
          meta_description?: string | null
          page_type_override?: string | null
          path?: string
          redirect_url?: string | null
          response_time_ms?: number | null
          schema_org_errors?: Json | null
          schema_org_types?: Json | null
          seo_score?: number | null
          title?: string | null
          url: string
          word_count?: number | null
        }
        Update: {
          anchor_texts?: Json | null
          broken_links?: Json | null
          canonical_url?: string | null
          content_hash?: string | null
          crawl_depth?: number | null
          crawl_id?: string
          created_at?: string
          custom_extraction?: Json | null
          external_links?: number | null
          h1?: string | null
          h2_count?: number | null
          h3_count?: number | null
          h4_h6_count?: number | null
          has_canonical?: boolean | null
          has_hreflang?: boolean | null
          has_nofollow?: boolean | null
          has_noindex?: boolean | null
          has_og?: boolean | null
          has_schema_org?: boolean | null
          html_size_bytes?: number | null
          http_status?: number | null
          id?: string
          images_total?: number | null
          images_without_alt?: number | null
          index_source?: string | null
          internal_links?: number | null
          is_indexable?: boolean | null
          issues?: Json | null
          meta_description?: string | null
          page_type_override?: string | null
          path?: string
          redirect_url?: string | null
          response_time_ms?: number | null
          schema_org_errors?: Json | null
          schema_org_types?: Json | null
          seo_score?: number | null
          title?: string | null
          url?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crawl_pages_crawl_id_fkey"
            columns: ["crawl_id"]
            isOneToOne: false
            referencedRelation: "site_crawls"
            referencedColumns: ["id"]
          },
        ]
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
      cto_agent_logs: {
        Row: {
          analysis_summary: string
          audit_id: string | null
          change_diff_pct: number | null
          confidence_score: number
          created_at: string
          decision: string
          function_analyzed: string
          id: string
          metadata: Json | null
          prompt_version_after: number | null
          prompt_version_before: number | null
          proposed_change: string | null
          self_critique: string
        }
        Insert: {
          analysis_summary: string
          audit_id?: string | null
          change_diff_pct?: number | null
          confidence_score?: number
          created_at?: string
          decision?: string
          function_analyzed: string
          id?: string
          metadata?: Json | null
          prompt_version_after?: number | null
          prompt_version_before?: number | null
          proposed_change?: string | null
          self_critique: string
        }
        Update: {
          analysis_summary?: string
          audit_id?: string | null
          change_diff_pct?: number | null
          confidence_score?: number
          created_at?: string
          decision?: string
          function_analyzed?: string
          id?: string
          metadata?: Json | null
          prompt_version_after?: number | null
          prompt_version_before?: number | null
          proposed_change?: string | null
          self_critique?: string
        }
        Relationships: []
      }
      domain_data_cache: {
        Row: {
          created_at: string
          data_type: string
          domain: string
          expires_at: string
          id: string
          result_data: Json
          week_start_date: string | null
        }
        Insert: {
          created_at?: string
          data_type: string
          domain: string
          expires_at?: string
          id?: string
          result_data?: Json
          week_start_date?: string | null
        }
        Update: {
          created_at?: string
          data_type?: string
          domain?: string
          expires_at?: string
          id?: string
          result_data?: Json
          week_start_date?: string | null
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      function_access_requests: {
        Row: {
          created_at: string
          function_name: string
          id: string
          requester_email: string
          requester_user_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          requester_email: string
          requester_user_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          requester_email?: string
          requester_user_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      function_consultation_log: {
        Row: {
          consulted_at: string
          function_name: string
          id: string
          user_email: string
          user_id: string
        }
        Insert: {
          consulted_at?: string
          function_name: string
          id?: string
          user_email: string
          user_id: string
        }
        Update: {
          consulted_at?: string
          function_name?: string
          id?: string
          user_email?: string
          user_id?: string
        }
        Relationships: []
      }
      ga4_history_log: {
        Row: {
          avg_session_duration: number
          bounce_rate: number
          created_at: string
          domain: string
          engagement_rate: number
          id: string
          measured_at: string
          pageviews: number
          sessions: number
          total_users: number
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          avg_session_duration?: number
          bounce_rate?: number
          created_at?: string
          domain: string
          engagement_rate?: number
          id?: string
          measured_at?: string
          pageviews?: number
          sessions?: number
          total_users?: number
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Update: {
          avg_session_duration?: number
          bounce_rate?: number
          created_at?: string
          domain?: string
          engagement_rate?: number
          id?: string
          measured_at?: string
          pageviews?: number
          sessions?: number
          total_users?: number
          tracked_site_id?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ga4_history_log_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      gmb_locations: {
        Row: {
          address: string | null
          attributes: Json | null
          category: string | null
          created_at: string
          hours: Json | null
          id: string
          location_name: string
          phone: string | null
          place_id: string | null
          tracked_site_id: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          attributes?: Json | null
          category?: string | null
          created_at?: string
          hours?: Json | null
          id?: string
          location_name: string
          phone?: string | null
          place_id?: string | null
          tracked_site_id: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          attributes?: Json | null
          category?: string | null
          created_at?: string
          hours?: Json | null
          id?: string
          location_name?: string
          phone?: string | null
          place_id?: string | null
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gmb_locations_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: true
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      gmb_performance: {
        Row: {
          avg_rating: number | null
          created_at: string
          direction_requests: number | null
          gmb_location_id: string
          id: string
          maps_views: number | null
          measured_at: string
          phone_calls: number | null
          photo_views: number | null
          search_views: number | null
          total_reviews: number | null
          user_id: string
          website_clicks: number | null
          week_start_date: string
        }
        Insert: {
          avg_rating?: number | null
          created_at?: string
          direction_requests?: number | null
          gmb_location_id: string
          id?: string
          maps_views?: number | null
          measured_at?: string
          phone_calls?: number | null
          photo_views?: number | null
          search_views?: number | null
          total_reviews?: number | null
          user_id: string
          website_clicks?: number | null
          week_start_date: string
        }
        Update: {
          avg_rating?: number | null
          created_at?: string
          direction_requests?: number | null
          gmb_location_id?: string
          id?: string
          maps_views?: number | null
          measured_at?: string
          phone_calls?: number | null
          photo_views?: number | null
          search_views?: number | null
          total_reviews?: number | null
          user_id?: string
          website_clicks?: number | null
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmb_performance_gmb_location_id_fkey"
            columns: ["gmb_location_id"]
            isOneToOne: false
            referencedRelation: "gmb_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      gmb_posts: {
        Row: {
          call_to_action: Json | null
          created_at: string
          gmb_location_id: string
          id: string
          media_url: string | null
          post_type: string
          published_at: string | null
          status: string | null
          summary: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          call_to_action?: Json | null
          created_at?: string
          gmb_location_id: string
          id?: string
          media_url?: string | null
          post_type?: string
          published_at?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          call_to_action?: Json | null
          created_at?: string
          gmb_location_id?: string
          id?: string
          media_url?: string | null
          post_type?: string
          published_at?: string | null
          status?: string | null
          summary?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmb_posts_gmb_location_id_fkey"
            columns: ["gmb_location_id"]
            isOneToOne: false
            referencedRelation: "gmb_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      gmb_reviews: {
        Row: {
          comment: string | null
          created_at: string
          gmb_location_id: string
          google_review_id: string | null
          id: string
          is_flagged: boolean | null
          reply_comment: string | null
          reply_updated_at: string | null
          review_created_at: string | null
          reviewer_name: string | null
          reviewer_photo_url: string | null
          star_rating: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          gmb_location_id: string
          google_review_id?: string | null
          id?: string
          is_flagged?: boolean | null
          reply_comment?: string | null
          reply_updated_at?: string | null
          review_created_at?: string | null
          reviewer_name?: string | null
          reviewer_photo_url?: string | null
          star_rating?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          gmb_location_id?: string
          google_review_id?: string | null
          id?: string
          is_flagged?: boolean | null
          reply_comment?: string | null
          reply_updated_at?: string | null
          review_created_at?: string | null
          reviewer_name?: string | null
          reviewer_photo_url?: string | null
          star_rating?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmb_reviews_gmb_location_id_fkey"
            columns: ["gmb_location_id"]
            isOneToOne: false
            referencedRelation: "gmb_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections: {
        Row: {
          access_token: string
          created_at: string | null
          ga4_property_id: string | null
          google_email: string
          gsc_site_urls: Json | null
          id: string
          refresh_token: string | null
          token_expiry: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string | null
          ga4_property_id?: string | null
          google_email: string
          gsc_site_urls?: Json | null
          id?: string
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string | null
          ga4_property_id?: string | null
          google_email?: string
          gsc_site_urls?: Json | null
          id?: string
          refresh_token?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gsc_history_log: {
        Row: {
          avg_position: number | null
          clicks: number
          created_at: string
          ctr: number
          domain: string
          id: string
          impressions: number
          measured_at: string
          top_queries: Json | null
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          avg_position?: number | null
          clicks?: number
          created_at?: string
          ctr?: number
          domain: string
          id?: string
          impressions?: number
          measured_at?: string
          top_queries?: Json | null
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Update: {
          avg_position?: number | null
          clicks?: number
          created_at?: string
          ctr?: number
          domain?: string
          id?: string
          impressions?: number
          measured_at?: string
          top_queries?: Json | null
          tracked_site_id?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_history_log_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      ias_history: {
        Row: {
          actual_ratio: number
          brand_clicks: number
          brand_penetration_rate: number | null
          business_type: string
          created_at: string
          domain: string
          generic_clicks: number
          ias_score: number | null
          id: string
          risk_score: number
          target_ratio: number
          total_clicks: number
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          actual_ratio: number
          brand_clicks?: number
          brand_penetration_rate?: number | null
          business_type: string
          created_at?: string
          domain: string
          generic_clicks?: number
          ias_score?: number | null
          id?: string
          risk_score: number
          target_ratio: number
          total_clicks?: number
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Update: {
          actual_ratio?: number
          brand_clicks?: number
          brand_penetration_rate?: number | null
          business_type?: string
          created_at?: string
          domain?: string
          generic_clicks?: number
          ias_score?: number | null
          id?: string
          risk_score?: number
          target_ratio?: number
          total_clicks?: number
          tracked_site_id?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "ias_history_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ias_settings: {
        Row: {
          brand_name: string
          category_id: number
          created_at: string
          id: string
          is_manual: boolean
          site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_name?: string
          category_id?: number
          created_at?: string
          id?: string
          is_manual?: boolean
          site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_name?: string
          category_id?: number
          created_at?: string
          id?: string
          is_manual?: boolean
          site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ias_settings_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      injection_error_logs: {
        Row: {
          created_at: string
          domain: string
          domain_id: string
          error_details: Json | null
          error_type: string
          id: string
          payload_type: string
          resolved_at: string | null
          rule_id: string
          url_pattern: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          domain_id: string
          error_details?: Json | null
          error_type: string
          id?: string
          payload_type: string
          resolved_at?: string | null
          rule_id: string
          url_pattern: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          domain_id?: string
          error_details?: Json | null
          error_type?: string
          id?: string
          payload_type?: string
          resolved_at?: string | null
          rule_id?: string
          url_pattern?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "injection_error_logs_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "injection_error_logs_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "site_script_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_depth_conversations: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          iteration: number
          llm_name: string
          prompt_text: string
          response_summary: string
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          iteration: number
          llm_name: string
          prompt_text: string
          response_summary: string
          tracked_site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          iteration?: number
          llm_name?: string
          prompt_text?: string
          response_summary?: string
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_depth_conversations_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_test_executions: {
        Row: {
          brand_found: boolean
          created_at: string
          id: string
          iteration_found: number | null
          llm_name: string
          prompt_tested: string
          response_text: string | null
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          brand_found?: boolean
          created_at?: string
          id?: string
          iteration_found?: number | null
          llm_name: string
          prompt_tested: string
          response_text?: string | null
          tracked_site_id: string
          user_id: string
        }
        Update: {
          brand_found?: boolean
          created_at?: string
          id?: string
          iteration_found?: number | null
          llm_name?: string
          prompt_tested?: string
          response_text?: string | null
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_test_executions_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_visibility_scores: {
        Row: {
          created_at: string
          id: string
          llm_name: string
          score_percentage: number
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          id?: string
          llm_name: string
          score_percentage?: number
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          id?: string
          llm_name?: string
          score_percentage?: number
          tracked_site_id?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_visibility_scores_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      market_trends: {
        Row: {
          id: string
          intent_rates: Json
          llm_shares: Json
          market_region: string
          updated_at: string
        }
        Insert: {
          id?: string
          intent_rates?: Json
          llm_shares?: Json
          market_region: string
          updated_at?: string
        }
        Update: {
          id?: string
          intent_rates?: Json
          llm_shares?: Json
          market_region?: string
          updated_at?: string
        }
        Relationships: []
      }
      matrix_audit_results: {
        Row: {
          axe: string
          crawlers_score: number | null
          created_at: string
          csv_weighted_score: number | null
          id: string
          llm_name: string | null
          poids: number
          prompt: string
          prompt_item_id: string | null
          raw_data: Json | null
          session_id: string
          seuil_bon: number
          seuil_mauvais: number
          seuil_moyen: number
          user_id: string
          verdict: string | null
        }
        Insert: {
          axe: string
          crawlers_score?: number | null
          created_at?: string
          csv_weighted_score?: number | null
          id?: string
          llm_name?: string | null
          poids: number
          prompt: string
          prompt_item_id?: string | null
          raw_data?: Json | null
          session_id: string
          seuil_bon?: number
          seuil_mauvais?: number
          seuil_moyen?: number
          user_id: string
          verdict?: string | null
        }
        Update: {
          axe?: string
          crawlers_score?: number | null
          created_at?: string
          csv_weighted_score?: number | null
          id?: string
          llm_name?: string | null
          poids?: number
          prompt?: string
          prompt_item_id?: string | null
          raw_data?: Json | null
          session_id?: string
          seuil_bon?: number
          seuil_mauvais?: number
          seuil_moyen?: number
          user_id?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matrix_audit_results_prompt_item_id_fkey"
            columns: ["prompt_item_id"]
            isOneToOne: false
            referencedRelation: "prompt_matrix_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matrix_audit_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "matrix_audit_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      matrix_audit_sessions: {
        Row: {
          crawlers_global_score: number | null
          created_at: string
          csv_weighted_score: number | null
          domain: string
          id: string
          selected_prompts: number
          total_prompts: number
          tracked_site_id: string | null
          url: string
          user_id: string
        }
        Insert: {
          crawlers_global_score?: number | null
          created_at?: string
          csv_weighted_score?: number | null
          domain: string
          id?: string
          selected_prompts?: number
          total_prompts?: number
          tracked_site_id?: string | null
          url: string
          user_id: string
        }
        Update: {
          crawlers_global_score?: number | null
          created_at?: string
          csv_weighted_score?: number | null
          domain?: string
          id?: string
          selected_prompts?: number
          total_prompts?: number
          tracked_site_id?: string | null
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matrix_audit_sessions_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      matrix_errors: {
        Row: {
          admin_notes: string | null
          batch_id: string | null
          context_data: Json | null
          created_at: string
          description: string | null
          error_type: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          session_id: string | null
          status: string
          title: string
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          batch_id?: string | null
          context_data?: Json | null
          created_at?: string
          description?: string | null
          error_type?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          status?: string
          title: string
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          batch_id?: string | null
          context_data?: Json | null
          created_at?: string
          description?: string | null
          error_type?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          session_id?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matrix_errors_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "matrix_audit_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      observatory_sectors: {
        Row: {
          avg_brand_authority: number | null
          avg_broken_links: number | null
          avg_cls: number | null
          avg_content_gap_count: number | null
          avg_eeat_score: number | null
          avg_fcp_ms: number | null
          avg_images_without_alt: number | null
          avg_lcp_ms: number | null
          avg_load_time_ms: number | null
          avg_seo_score: number | null
          avg_ttfb_ms: number | null
          avg_word_count: number | null
          canonical_rate: number | null
          created_at: string
          hreflang_rate: number | null
          https_rate: number | null
          id: string
          json_ld_rate: number | null
          meta_description_rate: number | null
          mobile_friendly_rate: number | null
          open_graph_rate: number | null
          period: string
          raw_data: Json | null
          robots_txt_rate: number | null
          schema_org_rate: number | null
          sector: string
          sitemap_rate: number | null
          source: string
          total_scans: number
          updated_at: string
        }
        Insert: {
          avg_brand_authority?: number | null
          avg_broken_links?: number | null
          avg_cls?: number | null
          avg_content_gap_count?: number | null
          avg_eeat_score?: number | null
          avg_fcp_ms?: number | null
          avg_images_without_alt?: number | null
          avg_lcp_ms?: number | null
          avg_load_time_ms?: number | null
          avg_seo_score?: number | null
          avg_ttfb_ms?: number | null
          avg_word_count?: number | null
          canonical_rate?: number | null
          created_at?: string
          hreflang_rate?: number | null
          https_rate?: number | null
          id?: string
          json_ld_rate?: number | null
          meta_description_rate?: number | null
          mobile_friendly_rate?: number | null
          open_graph_rate?: number | null
          period: string
          raw_data?: Json | null
          robots_txt_rate?: number | null
          schema_org_rate?: number | null
          sector: string
          sitemap_rate?: number | null
          source?: string
          total_scans?: number
          updated_at?: string
        }
        Update: {
          avg_brand_authority?: number | null
          avg_broken_links?: number | null
          avg_cls?: number | null
          avg_content_gap_count?: number | null
          avg_eeat_score?: number | null
          avg_fcp_ms?: number | null
          avg_images_without_alt?: number | null
          avg_lcp_ms?: number | null
          avg_load_time_ms?: number | null
          avg_seo_score?: number | null
          avg_ttfb_ms?: number | null
          avg_word_count?: number | null
          canonical_rate?: number | null
          created_at?: string
          hreflang_rate?: number | null
          https_rate?: number | null
          id?: string
          json_ld_rate?: number | null
          meta_description_rate?: number | null
          mobile_friendly_rate?: number | null
          open_graph_rate?: number | null
          period?: string
          raw_data?: Json | null
          robots_txt_rate?: number | null
          schema_org_rate?: number | null
          sector?: string
          sitemap_rate?: number | null
          source?: string
          total_scans?: number
          updated_at?: string
        }
        Relationships: []
      }
      patience_cards: {
        Row: {
          card_type: string
          category: string
          content: string
          created_at: string
          expires_at: string
          freshness_score: number
          id: string
          is_active: boolean
          language: string
          relevance_score: number
        }
        Insert: {
          card_type: string
          category?: string
          content: string
          created_at?: string
          expires_at?: string
          freshness_score?: number
          id?: string
          is_active?: boolean
          language?: string
          relevance_score?: number
        }
        Update: {
          card_type?: string
          category?: string
          content?: string
          created_at?: string
          expires_at?: string
          freshness_score?: number
          id?: string
          is_active?: boolean
          language?: string
          relevance_score?: number
        }
        Relationships: []
      }
      pdf_audits: {
        Row: {
          client_id: string
          created_at: string
          error_message: string | null
          extracted_data: Json | null
          file_path: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          error_message?: string | null
          extracted_data?: Json | null
          file_path: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          error_message?: string | null
          extracted_data?: Json | null
          file_path?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          audit_id: string
          baseline_data: Json | null
          baseline_traffic: number
          client_id: string
          created_at: string
          domain: string | null
          id: string
          predicted_increase_pct: number
          predicted_traffic: number
          prediction_details: Json | null
          tracked_site_id: string | null
        }
        Insert: {
          audit_id: string
          baseline_data?: Json | null
          baseline_traffic?: number
          client_id: string
          created_at?: string
          domain?: string | null
          id?: string
          predicted_increase_pct?: number
          predicted_traffic?: number
          prediction_details?: Json | null
          tracked_site_id?: string | null
        }
        Update: {
          audit_id?: string
          baseline_data?: Json | null
          baseline_traffic?: number
          client_id?: string
          created_at?: string
          domain?: string | null
          id?: string
          predicted_increase_pct?: number
          predicted_traffic?: number
          prediction_details?: Json | null
          tracked_site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "pdf_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          affiliate_code_used: string | null
          agency_brand_bold: boolean | null
          agency_brand_font: string | null
          agency_brand_font_size: number | null
          agency_brand_italic: boolean | null
          agency_brand_name: string | null
          agency_brand_underline: boolean | null
          agency_contact_email: string | null
          agency_contact_first_name: string | null
          agency_contact_last_name: string | null
          agency_contact_phone: string | null
          agency_logo_url: string | null
          agency_primary_color: string | null
          agency_report_font: string | null
          agency_report_footer_text: string | null
          agency_report_header_text: string | null
          api_key: string
          avatar_url: string | null
          crawl_month_reset: string
          crawl_pages_this_month: number
          created_at: string
          credits_balance: number
          email: string
          first_name: string
          ga4_property_id: string | null
          gsc_access_token: string | null
          gsc_refresh_token: string | null
          gsc_site_url: string | null
          gsc_token_expiry: string | null
          id: string
          last_name: string
          persona_type: string | null
          plan_type: string
          referral_code: string | null
          referred_by: string | null
          stripe_subscription_id: string | null
          subscription_expires_at: string | null
          subscription_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_code_used?: string | null
          agency_brand_bold?: boolean | null
          agency_brand_font?: string | null
          agency_brand_font_size?: number | null
          agency_brand_italic?: boolean | null
          agency_brand_name?: string | null
          agency_brand_underline?: boolean | null
          agency_contact_email?: string | null
          agency_contact_first_name?: string | null
          agency_contact_last_name?: string | null
          agency_contact_phone?: string | null
          agency_logo_url?: string | null
          agency_primary_color?: string | null
          agency_report_font?: string | null
          agency_report_footer_text?: string | null
          agency_report_header_text?: string | null
          api_key?: string
          avatar_url?: string | null
          crawl_month_reset?: string
          crawl_pages_this_month?: number
          created_at?: string
          credits_balance?: number
          email: string
          first_name: string
          ga4_property_id?: string | null
          gsc_access_token?: string | null
          gsc_refresh_token?: string | null
          gsc_site_url?: string | null
          gsc_token_expiry?: string | null
          id?: string
          last_name: string
          persona_type?: string | null
          plan_type?: string
          referral_code?: string | null
          referred_by?: string | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_code_used?: string | null
          agency_brand_bold?: boolean | null
          agency_brand_font?: string | null
          agency_brand_font_size?: number | null
          agency_brand_italic?: boolean | null
          agency_brand_name?: string | null
          agency_brand_underline?: boolean | null
          agency_contact_email?: string | null
          agency_contact_first_name?: string | null
          agency_contact_last_name?: string | null
          agency_contact_phone?: string | null
          agency_logo_url?: string | null
          agency_primary_color?: string | null
          agency_report_font?: string | null
          agency_report_footer_text?: string | null
          agency_report_header_text?: string | null
          api_key?: string
          avatar_url?: string | null
          crawl_month_reset?: string
          crawl_pages_this_month?: number
          created_at?: string
          credits_balance?: number
          email?: string
          first_name?: string
          ga4_property_id?: string | null
          gsc_access_token?: string | null
          gsc_refresh_token?: string | null
          gsc_site_url?: string | null
          gsc_token_expiry?: string | null
          id?: string
          last_name?: string
          persona_type?: string | null
          plan_type?: string
          referral_code?: string | null
          referred_by?: string | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      prompt_deployments: {
        Row: {
          api_used: string | null
          category: string | null
          client_id: string | null
          created_at: string
          deployed_at: string | null
          estimated_cost_eur: number | null
          id: string
          is_deployed: boolean | null
          llm_model: string | null
          prompt_label: string | null
          prompt_text: string
          roi_context: Json | null
          roi_measured_at: string | null
          roi_pertinence_score: number | null
          source_csv_filename: string | null
          target_type: string
          tokens_input: number | null
          tokens_output: number | null
          tokens_total: number | null
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_used?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          deployed_at?: string | null
          estimated_cost_eur?: number | null
          id?: string
          is_deployed?: boolean | null
          llm_model?: string | null
          prompt_label?: string | null
          prompt_text: string
          roi_context?: Json | null
          roi_measured_at?: string | null
          roi_pertinence_score?: number | null
          source_csv_filename?: string | null
          target_type?: string
          tokens_input?: number | null
          tokens_output?: number | null
          tokens_total?: number | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_used?: string | null
          category?: string | null
          client_id?: string | null
          created_at?: string
          deployed_at?: string | null
          estimated_cost_eur?: number | null
          id?: string
          is_deployed?: boolean | null
          llm_model?: string | null
          prompt_label?: string | null
          prompt_text?: string
          roi_context?: Json | null
          roi_measured_at?: string | null
          roi_pertinence_score?: number | null
          source_csv_filename?: string | null
          target_type?: string
          tokens_input?: number | null
          tokens_output?: number | null
          tokens_total?: number | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_deployments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agency_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_deployments_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_matrix_imports: {
        Row: {
          column_mapping: Json
          created_at: string
          domain: string
          file_name: string
          id: string
          raw_data: Json
          row_count: number
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          column_mapping?: Json
          created_at?: string
          domain: string
          file_name: string
          id?: string
          raw_data?: Json
          row_count?: number
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          column_mapping?: Json
          created_at?: string
          domain?: string
          file_name?: string
          id?: string
          raw_data?: Json
          row_count?: number
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_matrix_imports_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_matrix_items: {
        Row: {
          axe: string
          batch_id: string
          batch_label: string
          created_at: string
          id: string
          is_default_flags: Json | null
          llm_name: string
          poids: number
          prompt: string
          seuil_bon: number
          seuil_mauvais: number
          seuil_moyen: number
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          axe?: string
          batch_id?: string
          batch_label?: string
          created_at?: string
          id?: string
          is_default_flags?: Json | null
          llm_name?: string
          poids?: number
          prompt: string
          seuil_bon?: number
          seuil_mauvais?: number
          seuil_moyen?: number
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          axe?: string
          batch_id?: string
          batch_label?: string
          created_at?: string
          id?: string
          is_default_flags?: Json | null
          llm_name?: string
          poids?: number
          prompt?: string
          seuil_bon?: number
          seuil_mauvais?: number
          seuil_moyen?: number
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_matrix_items_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_registry: {
        Row: {
          created_at: string
          created_by: string
          function_name: string
          id: string
          is_champion: boolean
          metadata: Json | null
          prompt_key: string
          prompt_text: string
          version: number
        }
        Insert: {
          created_at?: string
          created_by?: string
          function_name: string
          id?: string
          is_champion?: boolean
          metadata?: Json | null
          prompt_key?: string
          prompt_text: string
          version?: number
        }
        Update: {
          created_at?: string
          created_by?: string
          function_name?: string
          id?: string
          is_champion?: boolean
          metadata?: Json | null
          prompt_key?: string
          prompt_text?: string
          version?: number
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
      revenue_events: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          order_external_id: string | null
          raw_payload: Json | null
          source: Database["public"]["Enums"]["revenue_source"]
          tracked_site_id: string
          transaction_date: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          id?: string
          order_external_id?: string | null
          raw_payload?: Json | null
          source: Database["public"]["Enums"]["revenue_source"]
          tracked_site_id: string
          transaction_date: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          order_external_id?: string | null
          raw_payload?: Json | null
          source?: Database["public"]["Enums"]["revenue_source"]
          tracked_site_id?: string
          transaction_date?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_events_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
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
          validated_at: string | null
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
          validated_at?: string | null
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
          validated_at?: string | null
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
      scan_results: {
        Row: {
          cls_score: number
          created_at: string
          css_files_count: number
          dom_size_kb: number
          error_404_count: number
          fcp_ms: number
          has_canonical: boolean
          has_hreflang: boolean
          has_https: boolean
          has_json_ld: boolean
          has_meta_description: boolean
          has_open_graph: boolean
          has_robots_txt: boolean
          has_sitemap: boolean
          has_twitter_cards: boolean
          has_viewport_meta: boolean
          id: string
          image_count: number
          images_without_alt: number
          is_mobile_friendly: boolean
          js_files_count: number
          lcp_ms: number
          load_time_ms: number
          scan_type: string
          total_requests: number
          ttfb_ms: number
        }
        Insert: {
          cls_score?: number
          created_at?: string
          css_files_count?: number
          dom_size_kb?: number
          error_404_count?: number
          fcp_ms?: number
          has_canonical?: boolean
          has_hreflang?: boolean
          has_https?: boolean
          has_json_ld?: boolean
          has_meta_description?: boolean
          has_open_graph?: boolean
          has_robots_txt?: boolean
          has_sitemap?: boolean
          has_twitter_cards?: boolean
          has_viewport_meta?: boolean
          id?: string
          image_count?: number
          images_without_alt?: number
          is_mobile_friendly?: boolean
          js_files_count?: number
          lcp_ms?: number
          load_time_ms?: number
          scan_type?: string
          total_requests?: number
          ttfb_ms?: number
        }
        Update: {
          cls_score?: number
          created_at?: string
          css_files_count?: number
          dom_size_kb?: number
          error_404_count?: number
          fcp_ms?: number
          has_canonical?: boolean
          has_hreflang?: boolean
          has_https?: boolean
          has_json_ld?: boolean
          has_meta_description?: boolean
          has_open_graph?: boolean
          has_robots_txt?: boolean
          has_sitemap?: boolean
          has_twitter_cards?: boolean
          has_viewport_meta?: boolean
          id?: string
          image_count?: number
          images_without_alt?: number
          is_mobile_friendly?: boolean
          js_files_count?: number
          lcp_ms?: number
          load_time_ms?: number
          scan_type?: string
          total_requests?: number
          ttfb_ms?: number
        }
        Relationships: []
      }
      semantic_nodes: {
        Row: {
          audit_report_id: string | null
          cannibalization_risk: number
          citability_score: number
          cluster_id: string | null
          content_gap_score: number
          conversion_potential: number
          cpc_value: number
          crawl_depth: number | null
          crawl_page_id: string | null
          created_at: string
          depth: number
          eeat_score: number
          embedding: Json | null
          error_message: string | null
          freshness_score: number
          geo_score: number
          h1: string | null
          iab_score: number
          id: string
          intent: string
          internal_links_in: number
          internal_links_out: number
          keyword_difficulty: number
          keywords: Json
          page_authority: number
          page_type: string | null
          page_updated_at: string | null
          parent_node_id: string | null
          roi_predictive: number
          search_volume: number
          serp_competitors: Json
          serp_position: number | null
          similarity_edges: Json
          status: string
          title: string
          tracked_site_id: string
          traffic_estimate: number
          updated_at: string
          url: string
          user_id: string
          word_count: number
        }
        Insert: {
          audit_report_id?: string | null
          cannibalization_risk?: number
          citability_score?: number
          cluster_id?: string | null
          content_gap_score?: number
          conversion_potential?: number
          cpc_value?: number
          crawl_depth?: number | null
          crawl_page_id?: string | null
          created_at?: string
          depth?: number
          eeat_score?: number
          embedding?: Json | null
          error_message?: string | null
          freshness_score?: number
          geo_score?: number
          h1?: string | null
          iab_score?: number
          id?: string
          intent?: string
          internal_links_in?: number
          internal_links_out?: number
          keyword_difficulty?: number
          keywords?: Json
          page_authority?: number
          page_type?: string | null
          page_updated_at?: string | null
          parent_node_id?: string | null
          roi_predictive?: number
          search_volume?: number
          serp_competitors?: Json
          serp_position?: number | null
          similarity_edges?: Json
          status?: string
          title?: string
          tracked_site_id: string
          traffic_estimate?: number
          updated_at?: string
          url: string
          user_id: string
          word_count?: number
        }
        Update: {
          audit_report_id?: string | null
          cannibalization_risk?: number
          citability_score?: number
          cluster_id?: string | null
          content_gap_score?: number
          conversion_potential?: number
          cpc_value?: number
          crawl_depth?: number | null
          crawl_page_id?: string | null
          created_at?: string
          depth?: number
          eeat_score?: number
          embedding?: Json | null
          error_message?: string | null
          freshness_score?: number
          geo_score?: number
          h1?: string | null
          iab_score?: number
          id?: string
          intent?: string
          internal_links_in?: number
          internal_links_out?: number
          keyword_difficulty?: number
          keywords?: Json
          page_authority?: number
          page_type?: string | null
          page_updated_at?: string | null
          parent_node_id?: string | null
          roi_predictive?: number
          search_volume?: number
          serp_competitors?: Json
          serp_position?: number | null
          similarity_edges?: Json
          status?: string
          title?: string
          tracked_site_id?: string
          traffic_estimate?: number
          updated_at?: string
          url?: string
          user_id?: string
          word_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "semantic_nodes_crawl_page_id_fkey"
            columns: ["crawl_page_id"]
            isOneToOne: false
            referencedRelation: "crawl_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semantic_nodes_parent_node_id_fkey"
            columns: ["parent_node_id"]
            isOneToOne: false
            referencedRelation: "semantic_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semantic_nodes_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_agent_logs: {
        Row: {
          action_type: string
          changes_detail: Json
          changes_summary: string
          confidence_score: number
          created_at: string
          id: string
          model_used: string
          page_slug: string
          page_type: string
          page_url: string
          seo_score_after: number | null
          seo_score_before: number | null
          status: string
          tokens_used: Json | null
        }
        Insert: {
          action_type?: string
          changes_detail?: Json
          changes_summary: string
          confidence_score?: number
          created_at?: string
          id?: string
          model_used?: string
          page_slug: string
          page_type?: string
          page_url: string
          seo_score_after?: number | null
          seo_score_before?: number | null
          status?: string
          tokens_used?: Json | null
        }
        Update: {
          action_type?: string
          changes_detail?: Json
          changes_summary?: string
          confidence_score?: number
          created_at?: string
          id?: string
          model_used?: string
          page_slug?: string
          page_type?: string
          page_url?: string
          seo_score_after?: number | null
          seo_score_before?: number | null
          status?: string
          tokens_used?: Json | null
        }
        Relationships: []
      }
      serp_geo_correlations: {
        Row: {
          best_lag_engagement: number | null
          best_lag_etv: number | null
          best_lag_position: number | null
          best_lag_top10: number | null
          calculated_at: string
          convergence_index: number | null
          created_at: string
          domain: string
          ga4_engagement: Json | null
          id: string
          llm_breakdown: Json | null
          llm_data_points: Json | null
          p_value_engagement: number | null
          p_value_etv: number | null
          p_value_position: number | null
          p_value_top10: number | null
          pearson_engagement_vs_llm: number | null
          pearson_etv_vs_llm: number | null
          pearson_position_vs_llm: number | null
          pearson_top10_vs_llm: number | null
          serp_data_points: Json | null
          spearman_engagement_vs_llm: number | null
          spearman_etv_vs_llm: number | null
          spearman_position_vs_llm: number | null
          spearman_top10_vs_llm: number | null
          tracked_site_id: string
          trend_label: string | null
          user_id: string
          weeks_analyzed: number
        }
        Insert: {
          best_lag_engagement?: number | null
          best_lag_etv?: number | null
          best_lag_position?: number | null
          best_lag_top10?: number | null
          calculated_at?: string
          convergence_index?: number | null
          created_at?: string
          domain: string
          ga4_engagement?: Json | null
          id?: string
          llm_breakdown?: Json | null
          llm_data_points?: Json | null
          p_value_engagement?: number | null
          p_value_etv?: number | null
          p_value_position?: number | null
          p_value_top10?: number | null
          pearson_engagement_vs_llm?: number | null
          pearson_etv_vs_llm?: number | null
          pearson_position_vs_llm?: number | null
          pearson_top10_vs_llm?: number | null
          serp_data_points?: Json | null
          spearman_engagement_vs_llm?: number | null
          spearman_etv_vs_llm?: number | null
          spearman_position_vs_llm?: number | null
          spearman_top10_vs_llm?: number | null
          tracked_site_id: string
          trend_label?: string | null
          user_id: string
          weeks_analyzed?: number
        }
        Update: {
          best_lag_engagement?: number | null
          best_lag_etv?: number | null
          best_lag_position?: number | null
          best_lag_top10?: number | null
          calculated_at?: string
          convergence_index?: number | null
          created_at?: string
          domain?: string
          ga4_engagement?: Json | null
          id?: string
          llm_breakdown?: Json | null
          llm_data_points?: Json | null
          p_value_engagement?: number | null
          p_value_etv?: number | null
          p_value_position?: number | null
          p_value_top10?: number | null
          pearson_engagement_vs_llm?: number | null
          pearson_etv_vs_llm?: number | null
          pearson_position_vs_llm?: number | null
          pearson_top10_vs_llm?: number | null
          serp_data_points?: Json | null
          spearman_engagement_vs_llm?: number | null
          spearman_etv_vs_llm?: number | null
          spearman_position_vs_llm?: number | null
          spearman_top10_vs_llm?: number | null
          tracked_site_id?: string
          trend_label?: string | null
          user_id?: string
          weeks_analyzed?: number
        }
        Relationships: [
          {
            foreignKeyName: "serp_geo_correlations_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      serp_snapshots: {
        Row: {
          avg_position: number | null
          created_at: string
          domain: string
          etv: number
          homepage_position: number | null
          id: string
          indexed_pages: number | null
          measured_at: string
          sample_keywords: Json
          top_10: number
          top_3: number
          top_50: number
          total_keywords: number
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          avg_position?: number | null
          created_at?: string
          domain: string
          etv?: number
          homepage_position?: number | null
          id?: string
          indexed_pages?: number | null
          measured_at?: string
          sample_keywords?: Json
          top_10?: number
          top_3?: number
          top_50?: number
          total_keywords?: number
          tracked_site_id: string
          user_id: string
        }
        Update: {
          avg_position?: number | null
          created_at?: string
          domain?: string
          etv?: number
          homepage_position?: number | null
          id?: string
          indexed_pages?: number | null
          measured_at?: string
          sample_keywords?: Json
          top_10?: number
          top_3?: number
          top_50?: number
          total_keywords?: number
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "serp_snapshots_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
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
      site_crawls: {
        Row: {
          ai_recommendations: Json | null
          ai_summary: string | null
          avg_score: number | null
          completed_at: string | null
          crawled_pages: number
          created_at: string
          credits_used: number
          domain: string
          error_message: string | null
          id: string
          max_depth: number | null
          status: string
          total_pages: number
          url: string
          url_filter: string | null
          user_id: string
        }
        Insert: {
          ai_recommendations?: Json | null
          ai_summary?: string | null
          avg_score?: number | null
          completed_at?: string | null
          crawled_pages?: number
          created_at?: string
          credits_used?: number
          domain: string
          error_message?: string | null
          id?: string
          max_depth?: number | null
          status?: string
          total_pages?: number
          url: string
          url_filter?: string | null
          user_id: string
        }
        Update: {
          ai_recommendations?: Json | null
          ai_summary?: string | null
          avg_score?: number | null
          completed_at?: string | null
          crawled_pages?: number
          created_at?: string
          credits_used?: number
          domain?: string
          error_message?: string | null
          id?: string
          max_depth?: number | null
          status?: string
          total_pages?: number
          url?: string
          url_filter?: string | null
          user_id?: string
        }
        Relationships: []
      }
      site_script_rules: {
        Row: {
          created_at: string
          domain_id: string
          generated_at: string | null
          generation_error: string | null
          generation_status: string
          id: string
          is_active: boolean
          payload_data: Json
          payload_type: string
          previous_payload_data: Json | null
          queued_at: string | null
          script_source: string
          status: string
          telemetry_last_ping: string | null
          updated_at: string
          url_pattern: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          domain_id: string
          generated_at?: string | null
          generation_error?: string | null
          generation_status?: string
          id?: string
          is_active?: boolean
          payload_data?: Json
          payload_type?: string
          previous_payload_data?: Json | null
          queued_at?: string | null
          script_source?: string
          status?: string
          telemetry_last_ping?: string | null
          updated_at?: string
          url_pattern?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          domain_id?: string
          generated_at?: string | null
          generation_error?: string | null
          generation_status?: string
          id?: string
          is_active?: boolean
          payload_data?: Json
          payload_type?: string
          previous_payload_data?: Json | null
          queued_at?: string | null
          script_source?: string
          status?: string
          telemetry_last_ping?: string | null
          updated_at?: string
          url_pattern?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_script_rules_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      site_script_rules_history: {
        Row: {
          created_at: string
          domain_id: string
          id: string
          payload_data: Json
          payload_type: string
          rule_id: string
          url_pattern: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          domain_id: string
          id?: string
          payload_data?: Json
          payload_type: string
          rule_id: string
          url_pattern: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          domain_id?: string
          id?: string
          payload_data?: Json
          payload_type?: string
          rule_id?: string
          url_pattern?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_script_rules_history_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "site_script_rules"
            referencedColumns: ["id"]
          },
        ]
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
          device_info: Json | null
          id: string
          is_admin: boolean
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          device_info?: Json | null
          id?: string
          is_admin?: boolean
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          device_info?: Json | null
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      survey_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          response_data: Json | null
          survey_id: string
          user_id: string
          variant: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          response_data?: Json | null
          survey_id: string
          user_id: string
          variant?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          response_data?: Json | null
          survey_id?: string
          user_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "survey_events_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          ab_enabled: boolean | null
          ab_ratio: number | null
          content_blocks: Json | null
          created_at: string | null
          created_by: string
          delay_between_impressions_hours: number | null
          description: string | null
          duration_days: number | null
          id: string
          max_impressions_per_user: number | null
          schedule_at: string | null
          status: string
          target_pages: Json | null
          target_persona: Json | null
          target_user_count: number | null
          title: string
          updated_at: string | null
          variant_b_content_blocks: Json | null
          variant_b_duration_days: number | null
          variant_b_target_persona: Json | null
        }
        Insert: {
          ab_enabled?: boolean | null
          ab_ratio?: number | null
          content_blocks?: Json | null
          created_at?: string | null
          created_by: string
          delay_between_impressions_hours?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          max_impressions_per_user?: number | null
          schedule_at?: string | null
          status?: string
          target_pages?: Json | null
          target_persona?: Json | null
          target_user_count?: number | null
          title: string
          updated_at?: string | null
          variant_b_content_blocks?: Json | null
          variant_b_duration_days?: number | null
          variant_b_target_persona?: Json | null
        }
        Update: {
          ab_enabled?: boolean | null
          ab_ratio?: number | null
          content_blocks?: Json | null
          created_at?: string | null
          created_by?: string
          delay_between_impressions_hours?: number | null
          description?: string | null
          duration_days?: number | null
          id?: string
          max_impressions_per_user?: number | null
          schedule_at?: string | null
          status?: string
          target_pages?: Json | null
          target_persona?: Json | null
          target_user_count?: number | null
          title?: string
          updated_at?: string | null
          variant_b_content_blocks?: Json | null
          variant_b_duration_days?: number | null
          variant_b_target_persona?: Json | null
        }
        Relationships: []
      }
      system_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      system_metrics: {
        Row: {
          current_reliability_score: number
          id: string
          total_audits_processed: number
          total_predictions_made: number
          updated_at: string
        }
        Insert: {
          current_reliability_score?: number
          id?: string
          total_audits_processed?: number
          total_predictions_made?: number
          updated_at?: string
        }
        Update: {
          current_reliability_score?: number
          id?: string
          total_audits_processed?: number
          total_predictions_made?: number
          updated_at?: string
        }
        Relationships: []
      }
      tracked_sites: {
        Row: {
          address: string | null
          api_key: string
          brand_name: string | null
          business_type: string | null
          cms_platform: string | null
          commercial_area: string | null
          company_size: string | null
          competitors: Json | null
          created_at: string
          current_config: Json
          domain: string
          entity_type: string | null
          founding_year: number | null
          gmb_city: string | null
          gmb_presence: boolean | null
          google_connection_id: string | null
          id: string
          identity_confidence: number | null
          identity_enriched_at: string | null
          identity_source: string | null
          last_audit_at: string | null
          last_sov_update: string | null
          last_widget_ping: string | null
          legal_structure: string | null
          market_sector: string | null
          media_specialties: string[] | null
          previous_config: Json
          primary_language: string | null
          products_services: string | null
          siren_siret: string | null
          site_name: string
          social_profiles: Json | null
          target_audience: string | null
          user_id: string
        }
        Insert: {
          address?: string | null
          api_key?: string
          brand_name?: string | null
          business_type?: string | null
          cms_platform?: string | null
          commercial_area?: string | null
          company_size?: string | null
          competitors?: Json | null
          created_at?: string
          current_config?: Json
          domain: string
          entity_type?: string | null
          founding_year?: number | null
          gmb_city?: string | null
          gmb_presence?: boolean | null
          google_connection_id?: string | null
          id?: string
          identity_confidence?: number | null
          identity_enriched_at?: string | null
          identity_source?: string | null
          last_audit_at?: string | null
          last_sov_update?: string | null
          last_widget_ping?: string | null
          legal_structure?: string | null
          market_sector?: string | null
          media_specialties?: string[] | null
          previous_config?: Json
          primary_language?: string | null
          products_services?: string | null
          siren_siret?: string | null
          site_name?: string
          social_profiles?: Json | null
          target_audience?: string | null
          user_id: string
        }
        Update: {
          address?: string | null
          api_key?: string
          brand_name?: string | null
          business_type?: string | null
          cms_platform?: string | null
          commercial_area?: string | null
          company_size?: string | null
          competitors?: Json | null
          created_at?: string
          current_config?: Json
          domain?: string
          entity_type?: string | null
          founding_year?: number | null
          gmb_city?: string | null
          gmb_presence?: boolean | null
          google_connection_id?: string | null
          id?: string
          identity_confidence?: number | null
          identity_enriched_at?: string | null
          identity_source?: string | null
          last_audit_at?: string | null
          last_sov_update?: string | null
          last_widget_ping?: string | null
          legal_structure?: string | null
          market_sector?: string | null
          media_specialties?: string[] | null
          previous_config?: Json
          primary_language?: string | null
          products_services?: string | null
          siren_siret?: string | null
          site_name?: string
          social_profiles?: Json | null
          target_audience?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_sites_google_connection_id_fkey"
            columns: ["google_connection_id"]
            isOneToOne: false
            referencedRelation: "google_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_sites_google_connection_id_fkey"
            columns: ["google_connection_id"]
            isOneToOne: false
            referencedRelation: "google_connections_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      url_correction_decisions: {
        Row: {
          corrected_url: string | null
          created_at: string
          decision: string
          id: string
          original_url: string
          user_id: string
        }
        Insert: {
          corrected_url?: string | null
          created_at?: string
          decision: string
          id?: string
          original_url: string
          user_id: string
        }
        Update: {
          corrected_url?: string | null
          created_at?: string
          decision?: string
          id?: string
          original_url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_activity_log: {
        Row: {
          created_at: string
          id: string
          last_gmb_action_at: string | null
          last_gmb_location_name: string | null
          last_llm_depth_test_at: string | null
          last_llm_depth_test_url: string | null
          last_multi_crawl_at: string | null
          last_multi_crawl_url: string | null
          last_strategic_audit_at: string | null
          last_strategic_audit_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_gmb_action_at?: string | null
          last_gmb_location_name?: string | null
          last_llm_depth_test_at?: string | null
          last_llm_depth_test_url?: string | null
          last_multi_crawl_at?: string | null
          last_multi_crawl_url?: string | null
          last_strategic_audit_at?: string | null
          last_strategic_audit_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_gmb_action_at?: string | null
          last_gmb_location_name?: string | null
          last_llm_depth_test_at?: string | null
          last_llm_depth_test_url?: string | null
          last_multi_crawl_at?: string | null
          last_multi_crawl_url?: string | null
          last_strategic_audit_at?: string | null
          last_strategic_audit_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
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
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      cms_connections_safe: {
        Row: {
          auth_method: string | null
          capabilities: Json | null
          created_at: string | null
          has_api_key: boolean | null
          has_oauth_token: boolean | null
          id: string | null
          platform: Database["public"]["Enums"]["cms_platform"] | null
          platform_site_id: string | null
          scopes: string[] | null
          site_url: string | null
          status: string | null
          tracked_site_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          auth_method?: string | null
          capabilities?: Json | null
          created_at?: string | null
          has_api_key?: never
          has_oauth_token?: never
          id?: string | null
          platform?: Database["public"]["Enums"]["cms_platform"] | null
          platform_site_id?: string | null
          scopes?: string[] | null
          site_url?: string | null
          status?: string | null
          tracked_site_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          auth_method?: string | null
          capabilities?: Json | null
          created_at?: string | null
          has_api_key?: never
          has_oauth_token?: never
          id?: string | null
          platform?: Database["public"]["Enums"]["cms_platform"] | null
          platform_site_id?: string | null
          scopes?: string[] | null
          site_url?: string | null
          status?: string | null
          tracked_site_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cms_connections_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      google_connections_safe: {
        Row: {
          created_at: string | null
          ga4_property_id: string | null
          google_email: string | null
          gsc_site_urls: Json | null
          has_refresh_token: boolean | null
          has_token: boolean | null
          id: string | null
          token_expiry: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          ga4_property_id?: string | null
          google_email?: string | null
          gsc_site_urls?: Json | null
          has_refresh_token?: never
          has_token?: never
          id?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          ga4_property_id?: string | null
          google_email?: string | null
          gsc_site_urls?: Json | null
          has_refresh_token?: never
          has_token?: never
          id?: string | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      revenue_weekly_summary: {
        Row: {
          avg_order_value: number | null
          currency: string | null
          source: Database["public"]["Enums"]["revenue_source"] | null
          total_revenue: number | null
          tracked_site_id: string | null
          transaction_count: number | null
          user_id: string | null
          week_start_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revenue_events_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      atomic_credit_update: {
        Args: { p_amount: number; p_user_id: string }
        Returns: Json
      }
      check_fair_use_v2: {
        Args: {
          p_action: string
          p_daily_limit: number
          p_hourly_limit: number
          p_user_id: string
        }
        Returns: Json
      }
      check_rate_limit: {
        Args: {
          p_action: string
          p_max_count?: number
          p_user_id: string
          p_window_minutes?: number
        }
        Returns: Json
      }
      cleanup_audit_cache_ttl: { Args: never; Returns: number }
      cleanup_expired_depth_conversations: { Args: never; Returns: undefined }
      cleanup_expired_roles: { Args: never; Returns: undefined }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      downgrade_expired_subscriptions: { Args: never; Returns: number }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_database_size: { Args: never; Returns: Json }
      get_site_revenue: {
        Args: {
          p_end_date: string
          p_start_date: string
          p_tracked_site_id: string
        }
        Returns: {
          avg_order_value: number
          currency: string
          total_revenue: number
          transaction_count: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      recalculate_reliability: { Args: never; Returns: undefined }
      upsert_analyzed_url: {
        Args: { p_domain: string; p_url: string }
        Returns: undefined
      }
      upsert_user_activity: {
        Args: {
          p_field: string
          p_label?: string
          p_timestamp?: string
          p_user_id: string
        }
        Returns: undefined
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
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "viewer"
        | "viewer_level2"
        | "auditor"
      article_status:
        | "draft"
        | "published"
        | "unpublished"
        | "archived"
        | "deleted"
      cms_platform: "wordpress" | "shopify" | "webflow" | "wix" | "drupal"
      report_type:
        | "seo_technical"
        | "seo_strategic"
        | "llm"
        | "geo"
        | "pagespeed"
        | "crawlers"
        | "cocoon"
      revenue_source:
        | "ga4"
        | "shopify"
        | "woocommerce"
        | "webflow"
        | "wix"
        | "drupal"
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
        "moderator",
        "user",
        "viewer",
        "viewer_level2",
        "auditor",
      ],
      article_status: [
        "draft",
        "published",
        "unpublished",
        "archived",
        "deleted",
      ],
      cms_platform: ["wordpress", "shopify", "webflow", "wix", "drupal"],
      report_type: [
        "seo_technical",
        "seo_strategic",
        "llm",
        "geo",
        "pagespeed",
        "crawlers",
        "cocoon",
      ],
      revenue_source: [
        "ga4",
        "shopify",
        "woocommerce",
        "webflow",
        "wix",
        "drupal",
      ],
    },
  },
} as const
