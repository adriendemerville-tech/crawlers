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
      anomaly_alerts: {
        Row: {
          affected_pages: number | null
          baseline_mean: number
          baseline_stddev: number
          change_pct: number | null
          created_at: string | null
          current_value: number
          description: string
          detected_at: string | null
          direction: string
          domain: string
          id: string
          is_dismissed: boolean | null
          is_read: boolean | null
          metric_name: string
          metric_source: string
          severity: string
          tracked_site_id: string
          user_id: string
          z_score: number
        }
        Insert: {
          affected_pages?: number | null
          baseline_mean?: number
          baseline_stddev?: number
          change_pct?: number | null
          created_at?: string | null
          current_value?: number
          description: string
          detected_at?: string | null
          direction?: string
          domain: string
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          metric_name: string
          metric_source: string
          severity?: string
          tracked_site_id: string
          user_id: string
          z_score?: number
        }
        Update: {
          affected_pages?: number | null
          baseline_mean?: number
          baseline_stddev?: number
          change_pct?: number | null
          created_at?: string | null
          current_value?: number
          description?: string
          detected_at?: string | null
          direction?: string
          domain?: string
          id?: string
          is_dismissed?: boolean | null
          is_read?: boolean | null
          metric_name?: string
          metric_source?: string
          severity?: string
          tracked_site_id?: string
          user_id?: string
          z_score?: number
        }
        Relationships: [
          {
            foreignKeyName: "anomaly_alerts_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      architect_workbench: {
        Row: {
          action_type:
            | Database["public"]["Enums"]["architect_action_type"]
            | null
          assigned_to: string | null
          consumed_at: string | null
          consumed_by_code: boolean
          consumed_by_content: boolean
          created_at: string
          description: string | null
          domain: string
          finding_category: string
          id: string
          payload: Json | null
          severity: string
          source_function: string | null
          source_record_id: string | null
          source_type: Database["public"]["Enums"]["diagnostic_source_type"]
          status: Database["public"]["Enums"]["workbench_item_status"]
          target_operation: string | null
          target_selector: string | null
          target_url: string | null
          title: string
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type?:
            | Database["public"]["Enums"]["architect_action_type"]
            | null
          assigned_to?: string | null
          consumed_at?: string | null
          consumed_by_code?: boolean
          consumed_by_content?: boolean
          created_at?: string
          description?: string | null
          domain: string
          finding_category: string
          id?: string
          payload?: Json | null
          severity?: string
          source_function?: string | null
          source_record_id?: string | null
          source_type: Database["public"]["Enums"]["diagnostic_source_type"]
          status?: Database["public"]["Enums"]["workbench_item_status"]
          target_operation?: string | null
          target_selector?: string | null
          target_url?: string | null
          title: string
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?:
            | Database["public"]["Enums"]["architect_action_type"]
            | null
          assigned_to?: string | null
          consumed_at?: string | null
          consumed_by_code?: boolean
          consumed_by_content?: boolean
          created_at?: string
          description?: string | null
          domain?: string
          finding_category?: string
          id?: string
          payload?: Json | null
          severity?: string
          source_function?: string | null
          source_record_id?: string | null
          source_type?: Database["public"]["Enums"]["diagnostic_source_type"]
          status?: Database["public"]["Enums"]["workbench_item_status"]
          target_operation?: string | null
          target_selector?: string | null
          target_url?: string | null
          title?: string
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "architect_workbench_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_users: {
        Row: {
          affiliate_code_used: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          credits_balance: number | null
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          original_created_at: string | null
          original_user_id: string
          persona_type: string | null
          plan_type: string | null
          profile_snapshot: Json | null
          referral_code: string | null
          subscription_status: string | null
        }
        Insert: {
          affiliate_code_used?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          credits_balance?: number | null
          email: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          original_created_at?: string | null
          original_user_id: string
          persona_type?: string | null
          plan_type?: string | null
          profile_snapshot?: Json | null
          referral_code?: string | null
          subscription_status?: string | null
        }
        Update: {
          affiliate_code_used?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          credits_balance?: number | null
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          original_created_at?: string | null
          original_user_id?: string
          persona_type?: string | null
          plan_type?: string | null
          profile_snapshot?: Json | null
          referral_code?: string | null
          subscription_status?: string | null
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
      audit_matrix_results: {
        Row: {
          confidence_level: number | null
          crawlers_data: Json | null
          crawlers_score: number | null
          created_at: string
          criterion_category: string | null
          criterion_id: string
          criterion_title: string
          custom_prompt: string | null
          id: string
          match_type: string
          parsed_response: string | null
          parsed_score: number | null
          session_id: string
          source_function: string | null
          target_provider: string | null
        }
        Insert: {
          confidence_level?: number | null
          crawlers_data?: Json | null
          crawlers_score?: number | null
          created_at?: string
          criterion_category?: string | null
          criterion_id: string
          criterion_title: string
          custom_prompt?: string | null
          id?: string
          match_type?: string
          parsed_response?: string | null
          parsed_score?: number | null
          session_id: string
          source_function?: string | null
          target_provider?: string | null
        }
        Update: {
          confidence_level?: number | null
          crawlers_data?: Json | null
          crawlers_score?: number | null
          created_at?: string
          criterion_category?: string | null
          criterion_id?: string
          criterion_title?: string
          custom_prompt?: string | null
          id?: string
          match_type?: string
          parsed_response?: string | null
          parsed_score?: number | null
          session_id?: string
          source_function?: string | null
          target_provider?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_matrix_results_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "audit_matrix_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_matrix_sessions: {
        Row: {
          audit_plan: Json | null
          completed_criteria: number | null
          created_at: string
          detection_method: string | null
          domain: string
          error_message: string | null
          id: string
          parsed_criteria: Json | null
          source_file_name: string
          source_file_type: string
          status: string
          total_criteria: number | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          audit_plan?: Json | null
          completed_criteria?: number | null
          created_at?: string
          detection_method?: string | null
          domain: string
          error_message?: string | null
          id?: string
          parsed_criteria?: Json | null
          source_file_name: string
          source_file_type: string
          status?: string
          total_criteria?: number | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          audit_plan?: Json | null
          completed_criteria?: number | null
          created_at?: string
          detection_method?: string | null
          domain?: string
          error_message?: string | null
          id?: string
          parsed_criteria?: Json | null
          source_file_name?: string
          source_file_type?: string
          status?: string
          total_criteria?: number | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
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
          user_id: string | null
        }
        Insert: {
          audit_type: string
          created_at?: string
          domain: string
          id?: string
          raw_payload?: Json
          source_functions?: string[]
          url: string
          user_id?: string | null
        }
        Update: {
          audit_type?: string
          created_at?: string
          domain?: string
          id?: string
          raw_payload?: Json
          source_functions?: string[]
          url?: string
          user_id?: string | null
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
      autopilot_configs: {
        Row: {
          auto_pause_threshold: number | null
          cooldown_hours: number | null
          created_at: string | null
          diag_audit_complet: boolean | null
          diag_crawl: boolean | null
          diag_stratege_cocoon: boolean | null
          excluded_page_types: string[] | null
          excluded_subdomains: string[] | null
          id: string
          implementation_mode: string | null
          is_active: boolean | null
          last_cycle_at: string | null
          max_pages_per_cycle: number | null
          presc_architect: boolean | null
          presc_content_architect: boolean | null
          presc_stratege_cocoon: boolean | null
          status: string | null
          total_cycles_run: number | null
          tracked_site_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auto_pause_threshold?: number | null
          cooldown_hours?: number | null
          created_at?: string | null
          diag_audit_complet?: boolean | null
          diag_crawl?: boolean | null
          diag_stratege_cocoon?: boolean | null
          excluded_page_types?: string[] | null
          excluded_subdomains?: string[] | null
          id?: string
          implementation_mode?: string | null
          is_active?: boolean | null
          last_cycle_at?: string | null
          max_pages_per_cycle?: number | null
          presc_architect?: boolean | null
          presc_content_architect?: boolean | null
          presc_stratege_cocoon?: boolean | null
          status?: string | null
          total_cycles_run?: number | null
          tracked_site_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auto_pause_threshold?: number | null
          cooldown_hours?: number | null
          created_at?: string | null
          diag_audit_complet?: boolean | null
          diag_crawl?: boolean | null
          diag_stratege_cocoon?: boolean | null
          excluded_page_types?: string[] | null
          excluded_subdomains?: string[] | null
          id?: string
          implementation_mode?: string | null
          is_active?: boolean | null
          last_cycle_at?: string | null
          max_pages_per_cycle?: number | null
          presc_architect?: boolean | null
          presc_content_architect?: boolean | null
          presc_stratege_cocoon?: boolean | null
          status?: string | null
          total_cycles_run?: number | null
          tracked_site_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_configs_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      autopilot_modification_log: {
        Row: {
          action_type: string
          config_id: string | null
          created_at: string | null
          cycle_number: number | null
          description: string | null
          diff_after: Json | null
          diff_before: Json | null
          id: string
          page_url: string | null
          phase: string
          status: string | null
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          action_type: string
          config_id?: string | null
          created_at?: string | null
          cycle_number?: number | null
          description?: string | null
          diff_after?: Json | null
          diff_before?: Json | null
          id?: string
          page_url?: string | null
          phase: string
          status?: string | null
          tracked_site_id: string
          user_id: string
        }
        Update: {
          action_type?: string
          config_id?: string | null
          created_at?: string | null
          cycle_number?: number | null
          description?: string | null
          diff_after?: Json | null
          diff_before?: Json | null
          id?: string
          page_url?: string | null
          phase?: string
          status?: string | null
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "autopilot_modification_log_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "autopilot_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "autopilot_modification_log_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      bundle_api_catalog: {
        Row: {
          api_name: string
          api_url: string
          crawlers_feature: string
          created_at: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          seo_segment: string
        }
        Insert: {
          api_name: string
          api_url: string
          crawlers_feature: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          seo_segment: string
        }
        Update: {
          api_name?: string
          api_url?: string
          crawlers_feature?: string
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          seo_segment?: string
        }
        Relationships: []
      }
      bundle_subscriptions: {
        Row: {
          api_count: number
          created_at: string | null
          display_order: Json | null
          id: string
          monthly_price_cents: number
          selected_apis: string[]
          status: string
          stripe_subscription_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          api_count?: number
          created_at?: string | null
          display_order?: Json | null
          id?: string
          monthly_price_cents?: number
          selected_apis?: string[]
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          api_count?: number
          created_at?: string | null
          display_order?: Json | null
          id?: string
          monthly_price_cents?: number
          selected_apis?: string[]
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string | null
          user_id?: string
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
      cocoon_architect_drafts: {
        Row: {
          created_at: string
          domain: string
          draft_data: Json
          id: string
          source_message: string | null
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          draft_data?: Json
          id?: string
          source_message?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          draft_data?: Json
          id?: string
          source_message?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocoon_architect_drafts_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      cocoon_auto_links: {
        Row: {
          anchor_text: string
          confidence: number | null
          context_sentence: string | null
          created_at: string | null
          deployment_method: string | null
          id: string
          is_active: boolean | null
          is_deployed: boolean | null
          source_url: string
          target_url: string
          tracked_site_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          anchor_text: string
          confidence?: number | null
          context_sentence?: string | null
          created_at?: string | null
          deployment_method?: string | null
          id?: string
          is_active?: boolean | null
          is_deployed?: boolean | null
          source_url: string
          target_url: string
          tracked_site_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          anchor_text?: string
          confidence?: number | null
          context_sentence?: string | null
          created_at?: string | null
          deployment_method?: string | null
          id?: string
          is_active?: boolean | null
          is_deployed?: boolean | null
          source_url?: string
          target_url?: string
          tracked_site_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocoon_auto_links_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      cocoon_batch_operations: {
        Row: {
          cluster_id: string | null
          completed_at: string | null
          created_at: string
          deploy_results: Json | null
          domain: string
          error_message: string | null
          failed_pages: number
          id: string
          mode: string
          operation_type: string
          pages_backup: Json | null
          processed_pages: number
          recommendations: Json
          rolled_back_at: string | null
          started_at: string | null
          status: string
          total_pages: number
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cluster_id?: string | null
          completed_at?: string | null
          created_at?: string
          deploy_results?: Json | null
          domain: string
          error_message?: string | null
          failed_pages?: number
          id?: string
          mode?: string
          operation_type?: string
          pages_backup?: Json | null
          processed_pages?: number
          recommendations?: Json
          rolled_back_at?: string | null
          started_at?: string | null
          status?: string
          total_pages?: number
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cluster_id?: string | null
          completed_at?: string | null
          created_at?: string
          deploy_results?: Json | null
          domain?: string
          error_message?: string | null
          failed_pages?: number
          id?: string
          mode?: string
          operation_type?: string
          pages_backup?: Json | null
          processed_pages?: number
          recommendations?: Json
          rolled_back_at?: string | null
          started_at?: string | null
          status?: string
          total_pages?: number
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocoon_batch_operations_tracked_site_id_fkey"
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
          last_strategy_id: string | null
          message_count: number
          messages: Json
          resumed_at: string | null
          session_hash: string
          summary: string | null
          tracked_site_id: string
          updated_at: string
          user_id: string | null
          workflow_state: Json | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          last_strategy_id?: string | null
          message_count?: number
          messages?: Json
          resumed_at?: string | null
          session_hash: string
          summary?: string | null
          tracked_site_id: string
          updated_at?: string
          user_id?: string | null
          workflow_state?: Json | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          last_strategy_id?: string | null
          message_count?: number
          messages?: Json
          resumed_at?: string | null
          session_hash?: string
          summary?: string | null
          tracked_site_id?: string
          updated_at?: string
          user_id?: string | null
          workflow_state?: Json | null
        }
        Relationships: []
      }
      cocoon_diagnostic_results: {
        Row: {
          created_at: string
          diagnostic_type: string
          domain: string
          findings: Json
          id: string
          metadata: Json | null
          scores: Json
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          diagnostic_type: string
          domain: string
          findings?: Json
          id?: string
          metadata?: Json | null
          scores?: Json
          tracked_site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          diagnostic_type?: string
          domain?: string
          findings?: Json
          id?: string
          metadata?: Json | null
          scores?: Json
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocoon_diagnostic_results_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      cocoon_linking_exclusions: {
        Row: {
          created_at: string | null
          exclude_all: boolean | null
          exclude_as_source: boolean | null
          exclude_as_target: boolean | null
          id: string
          page_url: string
          tracked_site_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          exclude_all?: boolean | null
          exclude_as_source?: boolean | null
          exclude_as_target?: boolean | null
          id?: string
          page_url: string
          tracked_site_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          exclude_all?: boolean | null
          exclude_as_source?: boolean | null
          exclude_as_target?: boolean | null
          id?: string
          page_url?: string
          tracked_site_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocoon_linking_exclusions_tracked_site_id_fkey"
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
      cocoon_strategy_plans: {
        Row: {
          created_at: string
          diagnostic_ids: string[]
          domain: string
          id: string
          status: string
          strategy: Json
          task_budget: number
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          diagnostic_ids?: string[]
          domain: string
          id?: string
          status?: string
          strategy?: Json
          task_budget?: number
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          diagnostic_ids?: string[]
          domain?: string
          id?: string
          status?: string
          strategy?: Json
          task_budget?: number
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cocoon_strategy_plans_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      content_prompt_templates: {
        Row: {
          created_at: string
          detection_patterns: Json
          examples: Json
          geo_rules: string
          id: string
          is_active: boolean
          label: string
          page_type: Database["public"]["Enums"]["content_page_type"]
          seo_rules: string
          structure_template: string
          system_prompt: string
          tone_guidelines: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          detection_patterns?: Json
          examples?: Json
          geo_rules: string
          id?: string
          is_active?: boolean
          label: string
          page_type: Database["public"]["Enums"]["content_page_type"]
          seo_rules: string
          structure_template: string
          system_prompt: string
          tone_guidelines: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          detection_patterns?: Json
          examples?: Json
          geo_rules?: string
          id?: string
          is_active?: boolean
          label?: string
          page_type?: Database["public"]["Enums"]["content_page_type"]
          seo_rules?: string
          structure_template?: string
          system_prompt?: string
          tone_guidelines?: string
          updated_at?: string
          version?: number
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
      crawl_page_backlinks: {
        Row: {
          backlinks_total: number | null
          crawl_id: string
          created_at: string | null
          domain_rank_avg: number | null
          id: string
          page_authority_internal: number | null
          path: string
          referring_domains: number | null
          top_anchors: Json | null
          top_sources: Json | null
          url: string
        }
        Insert: {
          backlinks_total?: number | null
          crawl_id: string
          created_at?: string | null
          domain_rank_avg?: number | null
          id?: string
          page_authority_internal?: number | null
          path?: string
          referring_domains?: number | null
          top_anchors?: Json | null
          top_sources?: Json | null
          url: string
        }
        Update: {
          backlinks_total?: number | null
          crawl_id?: string
          created_at?: string | null
          domain_rank_avg?: number | null
          id?: string
          page_authority_internal?: number | null
          path?: string
          referring_domains?: number | null
          top_anchors?: Json | null
          top_sources?: Json | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "crawl_page_backlinks_crawl_id_fkey"
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
          body_text_truncated: string | null
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
          body_text_truncated?: string | null
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
          body_text_truncated?: string | null
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
      drop_detector_config: {
        Row: {
          cost_credits: number
          drop_threshold: number
          id: number
          is_enabled: boolean
          last_run_alerts_count: number | null
          last_run_at: string | null
          last_run_sites_count: number | null
          min_data_weeks: number
          prediction_threshold: number
          run_frequency: string
          updated_at: string
        }
        Insert: {
          cost_credits?: number
          drop_threshold?: number
          id?: number
          is_enabled?: boolean
          last_run_alerts_count?: number | null
          last_run_at?: string | null
          last_run_sites_count?: number | null
          min_data_weeks?: number
          prediction_threshold?: number
          run_frequency?: string
          updated_at?: string
        }
        Update: {
          cost_credits?: number
          drop_threshold?: number
          id?: number
          is_enabled?: boolean
          last_run_alerts_count?: number | null
          last_run_at?: string | null
          last_run_sites_count?: number | null
          min_data_weeks?: number
          prediction_threshold?: number
          run_frequency?: string
          updated_at?: string
        }
        Relationships: []
      }
      drop_detector_logs: {
        Row: {
          alerts_generated: number
          created_at: string
          diagnostics_created: number
          duration_ms: number | null
          errors: Json | null
          id: string
          run_type: string
          sites_scanned: number
        }
        Insert: {
          alerts_generated?: number
          created_at?: string
          diagnostics_created?: number
          duration_ms?: number | null
          errors?: Json | null
          id?: string
          run_type?: string
          sites_scanned?: number
        }
        Update: {
          alerts_generated?: number
          created_at?: string
          diagnostics_created?: number
          duration_ms?: number | null
          errors?: Json | null
          id?: string
          run_type?: string
          sites_scanned?: number
        }
        Relationships: []
      }
      drop_diagnostics: {
        Row: {
          affected_pages: Json | null
          backlink_data: Json | null
          crawl_data: Json | null
          created_at: string
          diagnosis_type: string
          domain: string
          drop_probability: number | null
          drop_score: number
          eeat_geo_data: Json | null
          ga4_data: Json | null
          gsc_data: Json | null
          id: string
          notified_user: boolean
          period_end: string
          period_start: string
          recommendations: Json | null
          technical_data: Json | null
          tracked_site_id: string
          updated_at: string
          user_id: string
          verdict: string
          verdict_details: Json
        }
        Insert: {
          affected_pages?: Json | null
          backlink_data?: Json | null
          crawl_data?: Json | null
          created_at?: string
          diagnosis_type?: string
          domain: string
          drop_probability?: number | null
          drop_score?: number
          eeat_geo_data?: Json | null
          ga4_data?: Json | null
          gsc_data?: Json | null
          id?: string
          notified_user?: boolean
          period_end: string
          period_start: string
          recommendations?: Json | null
          technical_data?: Json | null
          tracked_site_id: string
          updated_at?: string
          user_id: string
          verdict?: string
          verdict_details?: Json
        }
        Update: {
          affected_pages?: Json | null
          backlink_data?: Json | null
          crawl_data?: Json | null
          created_at?: string
          diagnosis_type?: string
          domain?: string
          drop_probability?: number | null
          drop_score?: number
          eeat_geo_data?: Json | null
          ga4_data?: Json | null
          gsc_data?: Json | null
          id?: string
          notified_user?: boolean
          period_end?: string
          period_start?: string
          recommendations?: Json | null
          technical_data?: Json | null
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
          verdict?: string
          verdict_details?: Json
        }
        Relationships: [
          {
            foreignKeyName: "drop_diagnostics_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      false_positive_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          source?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      firehose_events: {
        Row: {
          created_at: string
          diff_chunks: Json | null
          document_language: string | null
          document_title: string | null
          document_url: string
          id: string
          kafka_offset: number | null
          markdown_excerpt: string | null
          matched_at: string
          page_categories: string[] | null
          page_types: string[] | null
          rule_id: string | null
          tap_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          diff_chunks?: Json | null
          document_language?: string | null
          document_title?: string | null
          document_url: string
          id?: string
          kafka_offset?: number | null
          markdown_excerpt?: string | null
          matched_at: string
          page_categories?: string[] | null
          page_types?: string[] | null
          rule_id?: string | null
          tap_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          diff_chunks?: Json | null
          document_language?: string | null
          document_title?: string | null
          document_url?: string
          id?: string
          kafka_offset?: number | null
          markdown_excerpt?: string | null
          matched_at?: string
          page_categories?: string[] | null
          page_types?: string[] | null
          rule_id?: string | null
          tap_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firehose_events_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "firehose_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "firehose_events_tap_id_fkey"
            columns: ["tap_id"]
            isOneToOne: false
            referencedRelation: "firehose_taps"
            referencedColumns: ["id"]
          },
        ]
      }
      firehose_rules: {
        Row: {
          created_at: string
          id: string
          nsfw: boolean | null
          quality: boolean | null
          rule_id: string
          rule_value: string
          tag: string | null
          tap_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          nsfw?: boolean | null
          quality?: boolean | null
          rule_id: string
          rule_value: string
          tag?: string | null
          tap_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          nsfw?: boolean | null
          quality?: boolean | null
          rule_id?: string
          rule_value?: string
          tag?: string | null
          tap_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firehose_rules_tap_id_fkey"
            columns: ["tap_id"]
            isOneToOne: false
            referencedRelation: "firehose_taps"
            referencedColumns: ["id"]
          },
        ]
      }
      firehose_taps: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          rules_count: number | null
          tap_id: string
          tap_name: string
          tap_token_encrypted: string | null
          token_prefix: string | null
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          rules_count?: number | null
          tap_id: string
          tap_name: string
          tap_token_encrypted?: string | null
          token_prefix?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          rules_count?: number | null
          tap_id?: string
          tap_name?: string
          tap_token_encrypted?: string | null
          token_prefix?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "firehose_taps_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      gmb_local_competitors: {
        Row: {
          avg_rating: number | null
          competitor_address: string | null
          competitor_category: string | null
          competitor_name: string
          competitor_phone: string | null
          competitor_place_id: string | null
          competitor_website: string | null
          created_at: string
          distance_km: number | null
          gmb_location_id: string
          id: string
          maps_position: number | null
          position_change: number | null
          previous_position: number | null
          search_query: string | null
          snapshot_week: string
          total_reviews: number | null
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_rating?: number | null
          competitor_address?: string | null
          competitor_category?: string | null
          competitor_name: string
          competitor_phone?: string | null
          competitor_place_id?: string | null
          competitor_website?: string | null
          created_at?: string
          distance_km?: number | null
          gmb_location_id: string
          id?: string
          maps_position?: number | null
          position_change?: number | null
          previous_position?: number | null
          search_query?: string | null
          snapshot_week?: string
          total_reviews?: number | null
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_rating?: number | null
          competitor_address?: string | null
          competitor_category?: string | null
          competitor_name?: string
          competitor_phone?: string | null
          competitor_place_id?: string | null
          competitor_website?: string | null
          created_at?: string
          distance_km?: number | null
          gmb_location_id?: string
          id?: string
          maps_position?: number | null
          position_change?: number | null
          previous_position?: number | null
          search_query?: string | null
          snapshot_week?: string
          total_reviews?: number | null
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmb_local_competitors_gmb_location_id_fkey"
            columns: ["gmb_location_id"]
            isOneToOne: false
            referencedRelation: "gmb_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmb_local_competitors_tracked_site_id_fkey"
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
      gmb_tracked_keywords: {
        Row: {
          created_at: string | null
          current_position: number | null
          id: string
          keyword: string
          last_checked_at: string | null
          position_change: number | null
          previous_position: number | null
          search_volume: number | null
          source: string | null
          tracked_site_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_position?: number | null
          id?: string
          keyword: string
          last_checked_at?: string | null
          position_change?: number | null
          previous_position?: number | null
          search_volume?: number | null
          source?: string | null
          tracked_site_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_position?: number | null
          id?: string
          keyword?: string
          last_checked_at?: string | null
          position_change?: number | null
          previous_position?: number | null
          search_volume?: number | null
          source?: string | null
          tracked_site_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmb_tracked_keywords_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_connections: {
        Row: {
          access_token: string | null
          account_name: string | null
          created_at: string
          customer_id: string
          id: string
          refresh_token: string | null
          scopes: string[] | null
          status: string
          token_expiry: string | null
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_name?: string | null
          created_at?: string
          customer_id: string
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expiry?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_name?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expiry?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_connections_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      google_ads_history_log: {
        Row: {
          avg_cpc_micros: number | null
          campaign_data: Json | null
          clicks: number | null
          conversion_rate: number | null
          conversions: number | null
          cost_micros: number | null
          created_at: string | null
          ctr: number | null
          domain: string
          id: string
          impressions: number | null
          measured_at: string | null
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          avg_cpc_micros?: number | null
          campaign_data?: Json | null
          clicks?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          cost_micros?: number | null
          created_at?: string | null
          ctr?: number | null
          domain: string
          id?: string
          impressions?: number | null
          measured_at?: string | null
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Update: {
          avg_cpc_micros?: number | null
          campaign_data?: Json | null
          clicks?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          cost_micros?: number | null
          created_at?: string | null
          ctr?: number | null
          domain?: string
          id?: string
          impressions?: number | null
          measured_at?: string | null
          tracked_site_id?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_ads_history_log_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
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
          age_factor: number | null
          brand_clicks: number
          brand_penetration_rate: number | null
          business_type: string
          composite_ias_score: number | null
          created_at: string
          domain: string
          founding_year: number | null
          generic_clicks: number
          ias_score: number | null
          id: string
          is_seasonal: boolean | null
          risk_score: number
          seasonality_factor: number | null
          target_ratio: number
          total_clicks: number
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          actual_ratio: number
          age_factor?: number | null
          brand_clicks?: number
          brand_penetration_rate?: number | null
          business_type: string
          composite_ias_score?: number | null
          created_at?: string
          domain: string
          founding_year?: number | null
          generic_clicks?: number
          ias_score?: number | null
          id?: string
          is_seasonal?: boolean | null
          risk_score: number
          seasonality_factor?: number | null
          target_ratio: number
          total_clicks?: number
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Update: {
          actual_ratio?: number
          age_factor?: number | null
          brand_clicks?: number
          brand_penetration_rate?: number | null
          business_type?: string
          composite_ias_score?: number | null
          created_at?: string
          domain?: string
          founding_year?: number | null
          generic_clicks?: number
          ias_score?: number | null
          id?: string
          is_seasonal?: boolean | null
          risk_score?: number
          seasonality_factor?: number | null
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
          age_adjustment_enabled: boolean | null
          brand_name: string
          category_id: number
          created_at: string
          id: string
          is_manual: boolean
          seasonality_enabled: boolean | null
          site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age_adjustment_enabled?: boolean | null
          brand_name?: string
          category_id?: number
          created_at?: string
          id?: string
          is_manual?: boolean
          seasonality_enabled?: boolean | null
          site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age_adjustment_enabled?: boolean | null
          brand_name?: string
          category_id?: number
          created_at?: string
          id?: string
          is_manual?: boolean
          seasonality_enabled?: boolean | null
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
      identity_card_suggestions: {
        Row: {
          created_at: string
          current_value: string | null
          field_name: string
          id: string
          reason: string | null
          reviewed_at: string | null
          source: string
          status: string
          suggested_value: string
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value?: string | null
          field_name: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          source?: string
          status?: string
          suggested_value: string
          tracked_site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: string | null
          field_name?: string
          id?: string
          reason?: string | null
          reviewed_at?: string | null
          source?: string
          status?: string
          suggested_value?: string
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_card_suggestions_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      injection_abuse_logs: {
        Row: {
          abuse_type: string
          admin_notes: string | null
          created_at: string
          id: string
          ip_address: string | null
          is_reviewed: boolean | null
          owner_user_id: string | null
          request_metadata: Json | null
          script_payload_preview: string | null
          script_type: string | null
          target_domain: string
          target_site_id: string | null
          user_id: string
        }
        Insert: {
          abuse_type?: string
          admin_notes?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          is_reviewed?: boolean | null
          owner_user_id?: string | null
          request_metadata?: Json | null
          script_payload_preview?: string | null
          script_type?: string | null
          target_domain: string
          target_site_id?: string | null
          user_id: string
        }
        Update: {
          abuse_type?: string
          admin_notes?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          is_reviewed?: boolean | null
          owner_user_id?: string | null
          request_metadata?: Json | null
          script_payload_preview?: string | null
          script_type?: string | null
          target_domain?: string
          target_site_id?: string | null
          user_id?: string
        }
        Relationships: []
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
          source_function: string | null
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
          source_function?: string | null
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
          source_function?: string | null
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
      marina_training_data: {
        Row: {
          broken_links_count: number | null
          cls: number | null
          cms_detected: string | null
          cocoon_clusters_count: number | null
          cocoon_nodes_count: number | null
          created_at: string
          domain: string
          geo_overall_score: number | null
          geo_scores: Json | null
          has_robots_txt: boolean | null
          has_schema_org: boolean | null
          id: string
          is_https: boolean | null
          is_spa: boolean | null
          job_id: string
          language: string | null
          lcp_ms: number | null
          psi_performance: number | null
          psi_seo: number | null
          raw_cocoon_data: Json | null
          raw_geo_data: Json | null
          raw_seo_data: Json | null
          report_url: string | null
          seo_ai_ready_score: number | null
          seo_max_score: number | null
          seo_performance_score: number | null
          seo_security_score: number | null
          seo_semantic_score: number | null
          seo_technical_score: number | null
          seo_total_score: number | null
          site_type: string | null
          tbt_ms: number | null
          url: string
          word_count: number | null
        }
        Insert: {
          broken_links_count?: number | null
          cls?: number | null
          cms_detected?: string | null
          cocoon_clusters_count?: number | null
          cocoon_nodes_count?: number | null
          created_at?: string
          domain: string
          geo_overall_score?: number | null
          geo_scores?: Json | null
          has_robots_txt?: boolean | null
          has_schema_org?: boolean | null
          id?: string
          is_https?: boolean | null
          is_spa?: boolean | null
          job_id: string
          language?: string | null
          lcp_ms?: number | null
          psi_performance?: number | null
          psi_seo?: number | null
          raw_cocoon_data?: Json | null
          raw_geo_data?: Json | null
          raw_seo_data?: Json | null
          report_url?: string | null
          seo_ai_ready_score?: number | null
          seo_max_score?: number | null
          seo_performance_score?: number | null
          seo_security_score?: number | null
          seo_semantic_score?: number | null
          seo_technical_score?: number | null
          seo_total_score?: number | null
          site_type?: string | null
          tbt_ms?: number | null
          url: string
          word_count?: number | null
        }
        Update: {
          broken_links_count?: number | null
          cls?: number | null
          cms_detected?: string | null
          cocoon_clusters_count?: number | null
          cocoon_nodes_count?: number | null
          created_at?: string
          domain?: string
          geo_overall_score?: number | null
          geo_scores?: Json | null
          has_robots_txt?: boolean | null
          has_schema_org?: boolean | null
          id?: string
          is_https?: boolean | null
          is_spa?: boolean | null
          job_id?: string
          language?: string | null
          lcp_ms?: number | null
          psi_performance?: number | null
          psi_seo?: number | null
          raw_cocoon_data?: Json | null
          raw_geo_data?: Json | null
          raw_seo_data?: Json | null
          report_url?: string | null
          seo_ai_ready_score?: number | null
          seo_max_score?: number | null
          seo_performance_score?: number | null
          seo_security_score?: number | null
          seo_semantic_score?: number | null
          seo_technical_score?: number | null
          seo_total_score?: number | null
          site_type?: string | null
          tbt_ms?: number | null
          url?: string
          word_count?: number | null
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
      matomo_connections: {
        Row: {
          auth_token: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_sync_at: string | null
          matomo_url: string
          site_id: number
          sync_error: string | null
          tracked_site_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_token?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          matomo_url: string
          site_id: number
          sync_error?: string | null
          tracked_site_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_token?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_sync_at?: string | null
          matomo_url?: string
          site_id?: number
          sync_error?: string | null
          tracked_site_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matomo_connections_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: true
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      matomo_history_log: {
        Row: {
          actions_per_visit: number | null
          avg_session_duration: number | null
          bounce_rate: number | null
          created_at: string | null
          id: string
          measured_at: string | null
          pageviews: number | null
          sessions: number | null
          total_users: number | null
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          actions_per_visit?: number | null
          avg_session_duration?: number | null
          bounce_rate?: number | null
          created_at?: string | null
          id?: string
          measured_at?: string | null
          pageviews?: number | null
          sessions?: number | null
          total_users?: number | null
          tracked_site_id: string
          user_id: string
          week_start_date: string
        }
        Update: {
          actions_per_visit?: number | null
          avg_session_duration?: number | null
          bounce_rate?: number | null
          created_at?: string | null
          id?: string
          measured_at?: string | null
          pageviews?: number | null
          sessions?: number | null
          total_users?: number | null
          tracked_site_id?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "matomo_history_log_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      mcp_usage_logs: {
        Row: {
          created_at: string
          error_message: string | null
          execution_time_ms: number | null
          id: string
          input_params: Json | null
          status: string
          tool_name: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_params?: Json | null
          status?: string
          tool_name: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          execution_time_ms?: number | null
          id?: string
          input_params?: Json | null
          status?: string
          tool_name?: string
          user_id?: string | null
        }
        Relationships: []
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
      parmenion_decision_log: {
        Row: {
          action_payload: Json
          action_type: string
          baseline_clicks: number | null
          baseline_ctr: number | null
          baseline_impressions: number | null
          baseline_position: number | null
          calibration_note: string | null
          created_at: string
          cycle_number: number
          domain: string
          error_category: string | null
          estimated_tokens: number | null
          execution_completed_at: string | null
          execution_error: string | null
          execution_results: Json | null
          execution_started_at: string | null
          final_scope: Json
          functions_called: string[]
          goal_changed: boolean
          goal_cluster_id: string | null
          goal_description: string
          goal_type: string
          id: string
          impact_actual: string | null
          impact_level: string
          impact_predicted: string | null
          initial_scope: Json
          is_error: boolean
          measured_at: string | null
          pipeline_phase: string | null
          risk_calibrated: number | null
          risk_iterations: number
          risk_predicted: number
          scope_reductions: number
          status: string
          t30_clicks: number | null
          t30_ctr: number | null
          t30_impressions: number | null
          t30_position: number | null
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_payload?: Json
          action_type: string
          baseline_clicks?: number | null
          baseline_ctr?: number | null
          baseline_impressions?: number | null
          baseline_position?: number | null
          calibration_note?: string | null
          created_at?: string
          cycle_number?: number
          domain: string
          error_category?: string | null
          estimated_tokens?: number | null
          execution_completed_at?: string | null
          execution_error?: string | null
          execution_results?: Json | null
          execution_started_at?: string | null
          final_scope?: Json
          functions_called?: string[]
          goal_changed?: boolean
          goal_cluster_id?: string | null
          goal_description: string
          goal_type: string
          id?: string
          impact_actual?: string | null
          impact_level?: string
          impact_predicted?: string | null
          initial_scope?: Json
          is_error?: boolean
          measured_at?: string | null
          pipeline_phase?: string | null
          risk_calibrated?: number | null
          risk_iterations?: number
          risk_predicted?: number
          scope_reductions?: number
          status?: string
          t30_clicks?: number | null
          t30_ctr?: number | null
          t30_impressions?: number | null
          t30_position?: number | null
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_payload?: Json
          action_type?: string
          baseline_clicks?: number | null
          baseline_ctr?: number | null
          baseline_impressions?: number | null
          baseline_position?: number | null
          calibration_note?: string | null
          created_at?: string
          cycle_number?: number
          domain?: string
          error_category?: string | null
          estimated_tokens?: number | null
          execution_completed_at?: string | null
          execution_error?: string | null
          execution_results?: Json | null
          execution_started_at?: string | null
          final_scope?: Json
          functions_called?: string[]
          goal_changed?: boolean
          goal_cluster_id?: string | null
          goal_description?: string
          goal_type?: string
          id?: string
          impact_actual?: string | null
          impact_level?: string
          impact_predicted?: string | null
          initial_scope?: Json
          is_error?: boolean
          measured_at?: string | null
          pipeline_phase?: string | null
          risk_calibrated?: number | null
          risk_iterations?: number
          risk_predicted?: number
          scope_reductions?: number
          status?: string
          t30_clicks?: number | null
          t30_ctr?: number | null
          t30_impressions?: number | null
          t30_position?: number | null
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parmenion_decision_log_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
          autonomy_level: string | null
          autonomy_raw: Json | null
          autonomy_score: number | null
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
          autonomy_level?: string | null
          autonomy_raw?: Json | null
          autonomy_score?: number | null
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
          autonomy_level?: string | null
          autonomy_raw?: Json | null
          autonomy_score?: number | null
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
      quiz_questions: {
        Row: {
          auto_generated: boolean
          category: string
          correct_index: number
          created_at: string
          difficulty: number
          explanation: string
          explanation_en: string | null
          explanation_es: string | null
          feature_link: string | null
          id: string
          is_active: boolean
          options: Json
          options_en: Json | null
          options_es: Json | null
          question: string
          question_en: string | null
          question_es: string | null
          quiz_type: string
          updated_at: string
        }
        Insert: {
          auto_generated?: boolean
          category: string
          correct_index: number
          created_at?: string
          difficulty: number
          explanation: string
          explanation_en?: string | null
          explanation_es?: string | null
          feature_link?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          options_en?: Json | null
          options_es?: Json | null
          question: string
          question_en?: string | null
          question_es?: string | null
          quiz_type: string
          updated_at?: string
        }
        Update: {
          auto_generated?: boolean
          category?: string
          correct_index?: number
          created_at?: string
          difficulty?: number
          explanation?: string
          explanation_en?: string | null
          explanation_es?: string | null
          feature_link?: string | null
          id?: string
          is_active?: boolean
          options?: Json
          options_en?: Json | null
          options_es?: Json | null
          question?: string
          question_en?: string | null
          question_es?: string | null
          quiz_type?: string
          updated_at?: string
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
          is_archived: boolean
          name: string
          parent_id: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
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
      sav_conversations: {
        Row: {
          assistant_type: string
          created_at: string
          escalated: boolean
          id: string
          message_count: number
          messages: Json
          metadata: Json | null
          phone_callback: string | null
          phone_callback_expires_at: string | null
          satisfaction_resolved: boolean | null
          source_domain: string | null
          tracked_site_id: string | null
          updated_at: string
          user_email: string | null
          user_id: string
        }
        Insert: {
          assistant_type?: string
          created_at?: string
          escalated?: boolean
          id?: string
          message_count?: number
          messages?: Json
          metadata?: Json | null
          phone_callback?: string | null
          phone_callback_expires_at?: string | null
          satisfaction_resolved?: boolean | null
          source_domain?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_email?: string | null
          user_id: string
        }
        Update: {
          assistant_type?: string
          created_at?: string
          escalated?: boolean
          id?: string
          message_count?: number
          messages?: Json
          metadata?: Json | null
          phone_callback?: string | null
          phone_callback_expires_at?: string | null
          satisfaction_resolved?: boolean | null
          source_domain?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_email?: string | null
          user_id?: string
        }
        Relationships: []
      }
      sav_quality_scores: {
        Row: {
          conversation_id: string | null
          created_at: string
          detected_intent: string | null
          escalated_to_phone: boolean
          id: string
          intent_keywords: string[] | null
          message_count: number
          post_chat_delay_seconds: number | null
          post_chat_route: string | null
          precision_score: number
          repeated_intent_count: number
          route_match: boolean | null
          suggested_route: string | null
          user_id: string
          user_thumbs_up: boolean | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          detected_intent?: string | null
          escalated_to_phone?: boolean
          id?: string
          intent_keywords?: string[] | null
          message_count?: number
          post_chat_delay_seconds?: number | null
          post_chat_route?: string | null
          precision_score?: number
          repeated_intent_count?: number
          route_match?: boolean | null
          suggested_route?: string | null
          user_id: string
          user_thumbs_up?: boolean | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          detected_intent?: string | null
          escalated_to_phone?: boolean
          id?: string
          intent_keywords?: string[] | null
          message_count?: number
          post_chat_delay_seconds?: number | null
          post_chat_route?: string | null
          precision_score?: number
          repeated_intent_count?: number
          route_match?: boolean | null
          suggested_route?: string | null
          user_id?: string
          user_thumbs_up?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sav_quality_scores_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "sav_conversations"
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
          is_archived: boolean
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
          is_archived?: boolean
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
          is_archived?: boolean
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
      sdk_toggle_confirmations: {
        Row: {
          confirmed: boolean | null
          confirmed_at: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          requested_by: string
          requested_value: boolean
          token: string
        }
        Insert: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          requested_by: string
          requested_value: boolean
          token: string
        }
        Update: {
          confirmed?: boolean | null
          confirmed_at?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          requested_by?: string
          requested_value?: boolean
          token?: string
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
          external_backlinks: Json | null
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
          external_backlinks?: Json | null
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
          external_backlinks?: Json | null
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
      serpapi_cache: {
        Row: {
          ads_results: Json | null
          country: string | null
          created_at: string
          expires_at: string
          id: string
          knowledge_graph: Json | null
          language: string | null
          location: string | null
          organic_results: Json | null
          query_text: string
          related_searches: Json | null
          result_data: Json
          search_engine: string
          search_metadata: Json | null
          tracked_site_id: string | null
          user_id: string
        }
        Insert: {
          ads_results?: Json | null
          country?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          knowledge_graph?: Json | null
          language?: string | null
          location?: string | null
          organic_results?: Json | null
          query_text: string
          related_searches?: Json | null
          result_data?: Json
          search_engine?: string
          search_metadata?: Json | null
          tracked_site_id?: string | null
          user_id: string
        }
        Update: {
          ads_results?: Json | null
          country?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          knowledge_graph?: Json | null
          language?: string | null
          location?: string | null
          organic_results?: Json | null
          query_text?: string
          related_searches?: Json | null
          result_data?: Json
          search_engine?: string
          search_metadata?: Json | null
          tracked_site_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "serpapi_cache_tracked_site_id_fkey"
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
      site_memory: {
        Row: {
          category: string
          confidence: number | null
          created_at: string
          id: string
          memory_key: string
          memory_value: string
          source: string
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          confidence?: number | null
          created_at?: string
          id?: string
          memory_key: string
          memory_value: string
          source?: string
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          confidence?: number | null
          created_at?: string
          id?: string
          memory_key?: string
          memory_value?: string
          source?: string
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_memory_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
          is_manually_edited: boolean | null
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
          is_manually_edited?: boolean | null
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
          is_manually_edited?: boolean | null
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
      site_taxonomy: {
        Row: {
          avg_depth: number | null
          category: string | null
          confidence: number | null
          detected_at: string | null
          domain: string
          id: string
          label: string
          page_count: number | null
          path_pattern: string
          sample_urls: string[] | null
          source: string | null
          tracked_site_id: string
          updated_at: string | null
        }
        Insert: {
          avg_depth?: number | null
          category?: string | null
          confidence?: number | null
          detected_at?: string | null
          domain: string
          id?: string
          label: string
          page_count?: number | null
          path_pattern: string
          sample_urls?: string[] | null
          source?: string | null
          tracked_site_id: string
          updated_at?: string | null
        }
        Update: {
          avg_depth?: number | null
          category?: string | null
          confidence?: number | null
          detected_at?: string | null
          domain?: string
          id?: string
          label?: string
          page_count?: number | null
          path_pattern?: string
          sample_urls?: string[] | null
          source?: string | null
          tracked_site_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_taxonomy_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
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
      strategist_recommendations: {
        Row: {
          action_type: string
          created_at: string
          description: string | null
          domain: string
          execution_mode: string | null
          ga4_baseline: Json | null
          ga4_measured: Json | null
          gsc_baseline: Json | null
          gsc_measured: Json | null
          id: string
          impact_score: number | null
          measured_at: string | null
          metadata: Json | null
          outcome_assessment: string | null
          priority: number | null
          status: string
          strategy_plan_id: string | null
          title: string
          tracked_site_id: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          action_type: string
          created_at?: string
          description?: string | null
          domain: string
          execution_mode?: string | null
          ga4_baseline?: Json | null
          ga4_measured?: Json | null
          gsc_baseline?: Json | null
          gsc_measured?: Json | null
          id?: string
          impact_score?: number | null
          measured_at?: string | null
          metadata?: Json | null
          outcome_assessment?: string | null
          priority?: number | null
          status?: string
          strategy_plan_id?: string | null
          title: string
          tracked_site_id: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string | null
          domain?: string
          execution_mode?: string | null
          ga4_baseline?: Json | null
          ga4_measured?: Json | null
          gsc_baseline?: Json | null
          gsc_measured?: Json | null
          id?: string
          impact_score?: number | null
          measured_at?: string | null
          metadata?: Json | null
          outcome_assessment?: string | null
          priority?: number | null
          status?: string
          strategy_plan_id?: string | null
          title?: string
          tracked_site_id?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "strategist_recommendations_strategy_plan_id_fkey"
            columns: ["strategy_plan_id"]
            isOneToOne: false
            referencedRelation: "cocoon_strategy_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "strategist_recommendations_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      supervisor_logs: {
        Row: {
          analysis_summary: string
          audit_id: string | null
          confidence_score: number | null
          correction_count: number | null
          created_at: string
          cto_score: number | null
          decision: string | null
          functions_audited: string[] | null
          id: string
          metadata: Json | null
          post_deploy_errors: number | null
          resolved_at: string | null
          self_critique: string
          status: string | null
        }
        Insert: {
          analysis_summary?: string
          audit_id?: string | null
          confidence_score?: number | null
          correction_count?: number | null
          created_at?: string
          cto_score?: number | null
          decision?: string | null
          functions_audited?: string[] | null
          id?: string
          metadata?: Json | null
          post_deploy_errors?: number | null
          resolved_at?: string | null
          self_critique?: string
          status?: string | null
        }
        Update: {
          analysis_summary?: string
          audit_id?: string | null
          confidence_score?: number | null
          correction_count?: number | null
          created_at?: string
          cto_score?: number | null
          decision?: string | null
          functions_audited?: string[] | null
          id?: string
          metadata?: Json | null
          post_deploy_errors?: number | null
          resolved_at?: string | null
          self_critique?: string
          status?: string | null
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
      taxonomy_patterns: {
        Row: {
          confidence: number | null
          created_at: string | null
          id: string
          inferred_category: string
          occurrence_count: number | null
          path_segment: string
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          inferred_category: string
          occurrence_count?: number | null
          path_segment: string
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string | null
          id?: string
          inferred_category?: string
          occurrence_count?: number | null
          path_segment?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tool_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          tool_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          tool_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          tool_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tracked_sites: {
        Row: {
          address: string | null
          api_key: string
          brand_name: string | null
          business_type: string | null
          client_targets: Json | null
          cms_platform: string | null
          commercial_area: string | null
          commercial_model: string | null
          company_size: string | null
          competitors: Json | null
          confusion_risk: string | null
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
          is_seasonal: boolean | null
          jargon_distance: Json | null
          last_audit_at: string | null
          last_sov_update: string | null
          last_widget_ping: string | null
          legal_structure: string | null
          main_serp_competitor: string | null
          market_sector: string | null
          media_specialties: string[] | null
          mid_term_goal: string | null
          nonprofit_type: string | null
          previous_config: Json
          primary_language: string | null
          products_services: string | null
          seasonality_detected_at: string | null
          seasonality_profile: Json | null
          short_term_goal: string | null
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
          client_targets?: Json | null
          cms_platform?: string | null
          commercial_area?: string | null
          commercial_model?: string | null
          company_size?: string | null
          competitors?: Json | null
          confusion_risk?: string | null
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
          is_seasonal?: boolean | null
          jargon_distance?: Json | null
          last_audit_at?: string | null
          last_sov_update?: string | null
          last_widget_ping?: string | null
          legal_structure?: string | null
          main_serp_competitor?: string | null
          market_sector?: string | null
          media_specialties?: string[] | null
          mid_term_goal?: string | null
          nonprofit_type?: string | null
          previous_config?: Json
          primary_language?: string | null
          products_services?: string | null
          seasonality_detected_at?: string | null
          seasonality_profile?: Json | null
          short_term_goal?: string | null
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
          client_targets?: Json | null
          cms_platform?: string | null
          commercial_area?: string | null
          commercial_model?: string | null
          company_size?: string | null
          competitors?: Json | null
          confusion_risk?: string | null
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
          is_seasonal?: boolean | null
          jargon_distance?: Json | null
          last_audit_at?: string | null
          last_sov_update?: string | null
          last_widget_ping?: string | null
          legal_structure?: string | null
          main_serp_competitor?: string | null
          market_sector?: string | null
          media_specialties?: string[] | null
          mid_term_goal?: string | null
          nonprofit_type?: string | null
          previous_config?: Json
          primary_language?: string | null
          products_services?: string | null
          seasonality_detected_at?: string | null
          seasonality_profile?: Json | null
          short_term_goal?: string | null
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
      user_bug_reports: {
        Row: {
          category: string | null
          context_data: Json | null
          created_at: string
          cto_response: string | null
          id: string
          notified_user: boolean
          raw_message: string
          resolved_at: string | null
          route: string | null
          screenshot_url: string | null
          source_assistant: string
          status: string
          translated_message: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          context_data?: Json | null
          created_at?: string
          cto_response?: string | null
          id?: string
          notified_user?: boolean
          raw_message: string
          resolved_at?: string | null
          route?: string | null
          screenshot_url?: string | null
          source_assistant?: string
          status?: string
          translated_message?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          context_data?: Json | null
          created_at?: string
          cto_response?: string | null
          id?: string
          notified_user?: boolean
          raw_message?: string
          resolved_at?: string | null
          route?: string | null
          screenshot_url?: string | null
          source_assistant?: string
          status?: string
          translated_message?: string | null
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
      check_monthly_fair_use: {
        Args: { p_action: string; p_monthly_limit: number; p_user_id: string }
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
      cleanup_expired_phone_callbacks: { Args: never; Returns: undefined }
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
      parmenion_error_rate: {
        Args: { p_domain: string; p_last_n?: number }
        Returns: Json
      }
      parmenion_recent_errors: {
        Args: { p_domain: string; p_limit?: number }
        Returns: {
          action_type: string
          calibration_note: string
          cycle_number: number
          error_category: string
          goal_description: string
          impact_actual: string
          impact_predicted: string
          risk_calibrated: number
          risk_predicted: number
        }[]
      }
      populate_architect_workbench: {
        Args: {
          p_domain: string
          p_tracked_site_id?: string
          p_user_id: string
        }
        Returns: Json
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
      score_workbench_priority: {
        Args: { p_domain: string; p_limit?: number; p_user_id: string }
        Returns: {
          action_type: string
          aging_bonus: number
          base_score: number
          created_at: string
          description: string
          finding_category: string
          gate_malus: number
          id: string
          payload: Json
          severity: string
          severity_bonus: number
          source_type: string
          target_operation: string
          target_selector: string
          target_url: string
          tier: number
          title: string
          total_score: number
        }[]
      }
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
      architect_action_type: "content" | "code" | "both"
      article_status:
        | "draft"
        | "published"
        | "unpublished"
        | "archived"
        | "deleted"
      cms_platform:
        | "wordpress"
        | "shopify"
        | "webflow"
        | "wix"
        | "drupal"
        | "odoo"
        | "prestashop"
      content_page_type: "landing" | "product" | "article"
      diagnostic_source_type:
        | "crawl"
        | "audit_tech"
        | "audit_strategic"
        | "cocoon"
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
      workbench_item_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "done"
        | "skipped"
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
      architect_action_type: ["content", "code", "both"],
      article_status: [
        "draft",
        "published",
        "unpublished",
        "archived",
        "deleted",
      ],
      cms_platform: [
        "wordpress",
        "shopify",
        "webflow",
        "wix",
        "drupal",
        "odoo",
        "prestashop",
      ],
      content_page_type: ["landing", "product", "article"],
      diagnostic_source_type: [
        "crawl",
        "audit_tech",
        "audit_strategic",
        "cocoon",
      ],
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
      workbench_item_status: [
        "pending",
        "assigned",
        "in_progress",
        "done",
        "skipped",
      ],
    },
  },
} as const
