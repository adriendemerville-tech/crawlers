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
          team_role: Database["public"]["Enums"]["team_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_user_id: string
          owner_user_id: string
          role?: string
          team_role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          member_user_id?: string
          owner_user_id?: string
          role?: string
          team_role?: Database["public"]["Enums"]["team_role"]
          updated_at?: string
        }
        Relationships: []
      }
      agent_cto_directives: {
        Row: {
          consumed_at: string | null
          created_at: string
          directive_text: string
          id: string
          status: string
          target_function: string | null
          target_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          directive_text: string
          id?: string
          status?: string
          target_function?: string | null
          target_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          directive_text?: string
          id?: string
          status?: string
          target_function?: string | null
          target_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_seo_directives: {
        Row: {
          consumed_at: string | null
          created_at: string
          directive_text: string
          id: string
          status: string
          target_slug: string | null
          target_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          directive_text: string
          id?: string
          status?: string
          target_slug?: string | null
          target_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          directive_text?: string
          id?: string
          status?: string
          target_slug?: string | null
          target_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_supervisor_directives: {
        Row: {
          consumed_at: string | null
          created_at: string
          directive_text: string
          id: string
          status: string
          target_function: string | null
          target_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          directive_text: string
          id?: string
          status?: string
          target_function?: string | null
          target_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          directive_text?: string
          id?: string
          status?: string
          target_function?: string | null
          target_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_ux_directives: {
        Row: {
          consumed_at: string | null
          created_at: string
          directive_text: string
          id: string
          status: string
          target_component: string | null
          target_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          directive_text: string
          id?: string
          status?: string
          target_component?: string | null
          target_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          directive_text?: string
          id?: string
          status?: string
          target_component?: string | null
          target_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_ux_logs: {
        Row: {
          analysis_type: string
          confidence_score: number | null
          created_at: string
          findings: Json | null
          id: string
          model_used: string | null
          page_analyzed: string
          proposals_generated: number | null
        }
        Insert: {
          analysis_type?: string
          confidence_score?: number | null
          created_at?: string
          findings?: Json | null
          id?: string
          model_used?: string | null
          page_analyzed: string
          proposals_generated?: number | null
        }
        Update: {
          analysis_type?: string
          confidence_score?: number | null
          created_at?: string
          findings?: Json | null
          id?: string
          model_used?: string | null
          page_analyzed?: string
          proposals_generated?: number | null
        }
        Relationships: []
      }
      ai_attribution_events: {
        Row: {
          ai_source: string
          attributed_bot_hits: Json
          attributed_count: number | null
          attribution_model: string
          attribution_window_days: number
          country: string | null
          created_at: string
          domain: string
          id: number
          path: string
          referer_full: string | null
          session_fingerprint: string | null
          source_bot_hit_id: number | null
          top_attributed_bot: string | null
          total_weight: number | null
          tracked_site_id: string
          url: string
          user_id: string
          visited_at: string
        }
        Insert: {
          ai_source: string
          attributed_bot_hits?: Json
          attributed_count?: number | null
          attribution_model?: string
          attribution_window_days?: number
          country?: string | null
          created_at?: string
          domain: string
          id?: number
          path: string
          referer_full?: string | null
          session_fingerprint?: string | null
          source_bot_hit_id?: number | null
          top_attributed_bot?: string | null
          total_weight?: number | null
          tracked_site_id: string
          url: string
          user_id: string
          visited_at: string
        }
        Update: {
          ai_source?: string
          attributed_bot_hits?: Json
          attributed_count?: number | null
          attribution_model?: string
          attribution_window_days?: number
          country?: string | null
          created_at?: string
          domain?: string
          id?: number
          path?: string
          referer_full?: string | null
          session_fingerprint?: string | null
          source_bot_hit_id?: number | null
          top_attributed_bot?: string | null
          total_weight?: number | null
          tracked_site_id?: string
          url?: string
          user_id?: string
          visited_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_attribution_events_source_bot_hit_id_fkey"
            columns: ["source_bot_hit_id"]
            isOneToOne: false
            referencedRelation: "bot_hits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_attribution_events_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_gateway_usage: {
        Row: {
          completion_tokens: number | null
          created_at: string
          edge_function: string | null
          estimated_cost_usd: number | null
          gateway: string
          id: string
          is_fallback: boolean | null
          model: string
          prompt_tokens: number | null
          total_tokens: number | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string
          edge_function?: string | null
          estimated_cost_usd?: number | null
          gateway?: string
          id?: string
          is_fallback?: boolean | null
          model: string
          prompt_tokens?: number | null
          total_tokens?: number | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string
          edge_function?: string | null
          estimated_cost_usd?: number | null
          gateway?: string
          id?: string
          is_fallback?: boolean | null
          model?: string
          prompt_tokens?: number | null
          total_tokens?: number | null
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
          email_alert_sent: boolean | null
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
          email_alert_sent?: boolean | null
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
          email_alert_sent?: boolean | null
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
          cluster_id: string | null
          cluster_maturity_pct: number | null
          competitor_momentum_score: number | null
          consumed_at: string | null
          consumed_by_code: boolean
          consumed_by_content: boolean
          conversion_weight: number | null
          cooldown_until: string | null
          created_at: string
          deployed_at: string | null
          description: string | null
          domain: string
          finding_category: string
          gmb_urgency_score: number | null
          id: string
          manual_priority: number | null
          payload: Json | null
          priority_tag: string | null
          severity: string
          source_function: string | null
          source_record_id: string | null
          source_type: Database["public"]["Enums"]["diagnostic_source_type"]
          spiral_score: number | null
          status: Database["public"]["Enums"]["workbench_item_status"]
          suggested_injection_type: string | null
          target_operation: string | null
          target_selector: string | null
          target_url: string | null
          title: string
          tracked_site_id: string | null
          updated_at: string
          user_id: string
          validate_attempts: number
          velocity_decay_score: number | null
        }
        Insert: {
          action_type?:
            | Database["public"]["Enums"]["architect_action_type"]
            | null
          assigned_to?: string | null
          cluster_id?: string | null
          cluster_maturity_pct?: number | null
          competitor_momentum_score?: number | null
          consumed_at?: string | null
          consumed_by_code?: boolean
          consumed_by_content?: boolean
          conversion_weight?: number | null
          cooldown_until?: string | null
          created_at?: string
          deployed_at?: string | null
          description?: string | null
          domain: string
          finding_category: string
          gmb_urgency_score?: number | null
          id?: string
          manual_priority?: number | null
          payload?: Json | null
          priority_tag?: string | null
          severity?: string
          source_function?: string | null
          source_record_id?: string | null
          source_type: Database["public"]["Enums"]["diagnostic_source_type"]
          spiral_score?: number | null
          status?: Database["public"]["Enums"]["workbench_item_status"]
          suggested_injection_type?: string | null
          target_operation?: string | null
          target_selector?: string | null
          target_url?: string | null
          title: string
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
          validate_attempts?: number
          velocity_decay_score?: number | null
        }
        Update: {
          action_type?:
            | Database["public"]["Enums"]["architect_action_type"]
            | null
          assigned_to?: string | null
          cluster_id?: string | null
          cluster_maturity_pct?: number | null
          competitor_momentum_score?: number | null
          consumed_at?: string | null
          consumed_by_code?: boolean
          consumed_by_content?: boolean
          conversion_weight?: number | null
          cooldown_until?: string | null
          created_at?: string
          deployed_at?: string | null
          description?: string | null
          domain?: string
          finding_category?: string
          gmb_urgency_score?: number | null
          id?: string
          manual_priority?: number | null
          payload?: Json | null
          priority_tag?: string | null
          severity?: string
          source_function?: string | null
          source_record_id?: string | null
          source_type?: Database["public"]["Enums"]["diagnostic_source_type"]
          spiral_score?: number | null
          status?: Database["public"]["Enums"]["workbench_item_status"]
          suggested_injection_type?: string | null
          target_operation?: string | null
          target_selector?: string | null
          target_url?: string | null
          title?: string
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
          validate_attempts?: number
          velocity_decay_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "architect_workbench_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "cluster_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "architect_workbench_suggested_injection_type_fkey"
            columns: ["suggested_injection_type"]
            isOneToOne: false
            referencedRelation: "injection_catalog"
            referencedColumns: ["slug"]
          },
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
          scoring_method: string | null
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
          scoring_method?: string | null
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
          scoring_method?: string | null
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
          content_budget_pct: number | null
          cooldown_hours: number | null
          created_at: string | null
          diag_audit_complet: boolean | null
          diag_crawl: boolean | null
          diag_stratege_cocoon: boolean | null
          excluded_page_types: string[] | null
          excluded_subdomains: string[] | null
          force_content_cycle: boolean | null
          force_iktracker_article: boolean | null
          gate_threshold_high: number | null
          gate_threshold_low: number | null
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
          use_editorial_pipeline: boolean
          user_id: string
        }
        Insert: {
          auto_pause_threshold?: number | null
          content_budget_pct?: number | null
          cooldown_hours?: number | null
          created_at?: string | null
          diag_audit_complet?: boolean | null
          diag_crawl?: boolean | null
          diag_stratege_cocoon?: boolean | null
          excluded_page_types?: string[] | null
          excluded_subdomains?: string[] | null
          force_content_cycle?: boolean | null
          force_iktracker_article?: boolean | null
          gate_threshold_high?: number | null
          gate_threshold_low?: number | null
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
          use_editorial_pipeline?: boolean
          user_id: string
        }
        Update: {
          auto_pause_threshold?: number | null
          content_budget_pct?: number | null
          cooldown_hours?: number | null
          created_at?: string | null
          diag_audit_complet?: boolean | null
          diag_crawl?: boolean | null
          diag_stratege_cocoon?: boolean | null
          excluded_page_types?: string[] | null
          excluded_subdomains?: string[] | null
          force_content_cycle?: boolean | null
          force_iktracker_article?: boolean | null
          gate_threshold_high?: number | null
          gate_threshold_low?: number | null
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
          use_editorial_pipeline?: boolean
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
      bot_hits: {
        Row: {
          bot_family: string | null
          bot_name: string | null
          cf_ray: string | null
          confidence_score: number | null
          country: string | null
          domain: string
          hit_at: string
          id: number
          ip_hash: string | null
          is_ai_bot: boolean
          is_human_sample: boolean
          path: string | null
          raw_meta: Json | null
          referer: string | null
          status_code: number | null
          tracked_site_id: string
          url: string
          user_agent: string | null
          user_id: string
          verification_method: string | null
          verification_status: string | null
        }
        Insert: {
          bot_family?: string | null
          bot_name?: string | null
          cf_ray?: string | null
          confidence_score?: number | null
          country?: string | null
          domain: string
          hit_at?: string
          id?: number
          ip_hash?: string | null
          is_ai_bot?: boolean
          is_human_sample?: boolean
          path?: string | null
          raw_meta?: Json | null
          referer?: string | null
          status_code?: number | null
          tracked_site_id: string
          url: string
          user_agent?: string | null
          user_id: string
          verification_method?: string | null
          verification_status?: string | null
        }
        Update: {
          bot_family?: string | null
          bot_name?: string | null
          cf_ray?: string | null
          confidence_score?: number | null
          country?: string | null
          domain?: string
          hit_at?: string
          id?: number
          ip_hash?: string | null
          is_ai_bot?: boolean
          is_human_sample?: boolean
          path?: string | null
          raw_meta?: Json | null
          referer?: string | null
          status_code?: number | null
          tracked_site_id?: string
          url?: string
          user_agent?: string | null
          user_id?: string
          verification_method?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_hits_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      canva_connections: {
        Row: {
          access_token: string | null
          canva_team_id: string | null
          canva_user_id: string | null
          created_at: string
          display_name: string | null
          id: string
          refresh_token: string | null
          scopes: string[] | null
          status: string
          token_expires_at: string | null
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          canva_team_id?: string | null
          canva_user_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          canva_team_id?: string | null
          canva_user_id?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "canva_connections_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      cf_shield_configs: {
        Row: {
          cf_account_id: string | null
          cf_route_pattern: string | null
          cf_token_encrypted: string | null
          cf_worker_name: string | null
          cf_zone_id: string | null
          created_at: string
          deployed_at: string | null
          deployment_mode: string
          domain: string
          hits_last_24h: number | null
          hits_total: number | null
          human_sample_rate: number
          id: string
          ingestion_secret: string
          last_error: string | null
          last_hit_at: string | null
          last_verified_at: string | null
          status: string
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cf_account_id?: string | null
          cf_route_pattern?: string | null
          cf_token_encrypted?: string | null
          cf_worker_name?: string | null
          cf_zone_id?: string | null
          created_at?: string
          deployed_at?: string | null
          deployment_mode?: string
          domain: string
          hits_last_24h?: number | null
          hits_total?: number | null
          human_sample_rate?: number
          id?: string
          ingestion_secret?: string
          last_error?: string | null
          last_hit_at?: string | null
          last_verified_at?: string | null
          status?: string
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cf_account_id?: string | null
          cf_route_pattern?: string | null
          cf_token_encrypted?: string | null
          cf_worker_name?: string | null
          cf_zone_id?: string | null
          created_at?: string
          deployed_at?: string | null
          deployment_mode?: string
          domain?: string
          hits_last_24h?: number | null
          hits_total?: number | null
          human_sample_rate?: number
          id?: string
          ingestion_secret?: string
          last_error?: string | null
          last_hit_at?: string | null
          last_verified_at?: string | null
          status?: string
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cf_shield_configs_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: true
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      churn_feedback: {
        Row: {
          billing_period: string | null
          created_at: string
          id: string
          message: string
          plan_type: string | null
          user_id: string
        }
        Insert: {
          billing_period?: string | null
          created_at?: string
          id?: string
          message: string
          plan_type?: string | null
          user_id: string
        }
        Update: {
          billing_period?: string | null
          created_at?: string
          id?: string
          message?: string
          plan_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cluster_definitions: {
        Row: {
          cluster_name: string
          created_at: string | null
          deployed_items: number | null
          fanout_computed_at: string | null
          fanout_coverage_pct: number | null
          id: string
          keywords: string[] | null
          maturity_pct: number | null
          ring: number
          total_items: number | null
          tracked_site_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cluster_name: string
          created_at?: string | null
          deployed_items?: number | null
          fanout_computed_at?: string | null
          fanout_coverage_pct?: number | null
          id?: string
          keywords?: string[] | null
          maturity_pct?: number | null
          ring?: number
          total_items?: number | null
          tracked_site_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cluster_name?: string
          created_at?: string | null
          deployed_items?: number | null
          fanout_computed_at?: string | null
          fanout_coverage_pct?: number | null
          id?: string
          keywords?: string[] | null
          maturity_pct?: number | null
          ring?: number
          total_items?: number | null
          tracked_site_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cluster_definitions_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
          managed_by: string | null
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
          managed_by?: string | null
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
          managed_by?: string | null
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
      cms_page_content: {
        Row: {
          content: Json
          created_at: string
          id: string
          locale: string
          page_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          locale?: string
          page_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          locale?: string
          page_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
          source_function: string
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
          source_function?: string
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
          source_function?: string
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
          action_payload: Json | null
          action_type: string | null
          created_at: string
          description: string | null
          executed_at: string | null
          execution_result: Json | null
          execution_status: string | null
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
          action_payload?: Json | null
          action_type?: string | null
          created_at?: string
          description?: string | null
          executed_at?: string | null
          execution_result?: Json | null
          execution_status?: string | null
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
          action_payload?: Json | null
          action_type?: string | null
          created_at?: string
          description?: string | null
          executed_at?: string | null
          execution_result?: Json | null
          execution_status?: string | null
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
      code_deployment_history: {
        Row: {
          agent_source: string
          commit_sha: string | null
          created_at: string
          deployed_at: string
          deployed_content: string
          file_path: string
          id: string
          is_rolled_back: boolean
          previous_content: string | null
          proposal_id: string
          rollback_commit_sha: string | null
          rolled_back_at: string | null
          rolled_back_by: string | null
        }
        Insert: {
          agent_source?: string
          commit_sha?: string | null
          created_at?: string
          deployed_at?: string
          deployed_content: string
          file_path: string
          id?: string
          is_rolled_back?: boolean
          previous_content?: string | null
          proposal_id: string
          rollback_commit_sha?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
        }
        Update: {
          agent_source?: string
          commit_sha?: string | null
          created_at?: string
          deployed_at?: string
          deployed_content?: string
          file_path?: string
          id?: string
          is_rolled_back?: boolean
          previous_content?: string | null
          proposal_id?: string
          rollback_commit_sha?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
        }
        Relationships: []
      }
      competitor_tracked_urls: {
        Row: {
          audit_data: Json | null
          competitor_domain: string
          competitor_url: string
          crawl_data: Json | null
          crawl_status: string
          created_at: string
          geo_score: number | null
          id: string
          label: string | null
          last_crawl_at: string | null
          semantic_relevance: Json | null
          seo_score: number | null
          serp_positions: Json | null
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_data?: Json | null
          competitor_domain: string
          competitor_url: string
          crawl_data?: Json | null
          crawl_status?: string
          created_at?: string
          geo_score?: number | null
          id?: string
          label?: string | null
          last_crawl_at?: string | null
          semantic_relevance?: Json | null
          seo_score?: number | null
          serp_positions?: Json | null
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audit_data?: Json | null
          competitor_domain?: string
          competitor_url?: string
          crawl_data?: Json | null
          crawl_status?: string
          created_at?: string
          geo_score?: number | null
          id?: string
          label?: string | null
          last_crawl_at?: string | null
          semantic_relevance?: Json | null
          seo_score?: number | null
          serp_positions?: Json | null
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_tracked_urls_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_architect_cache: {
        Row: {
          cache_key: string
          created_at: string
          domain: string | null
          expires_at: string
          hit_count: number
          id: string
          is_shareable: boolean
          keyword: string
          lang: string | null
          last_used_at: string
          length: string | null
          markdown: string
          page_type: string | null
          payload: Json | null
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          domain?: string | null
          expires_at?: string
          hit_count?: number
          id?: string
          is_shareable?: boolean
          keyword: string
          lang?: string | null
          last_used_at?: string
          length?: string | null
          markdown: string
          page_type?: string | null
          payload?: Json | null
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          domain?: string | null
          expires_at?: string
          hit_count?: number
          id?: string
          is_shareable?: boolean
          keyword?: string
          lang?: string | null
          last_used_at?: string
          length?: string | null
          markdown?: string
          page_type?: string | null
          payload?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      content_deploy_snapshots: {
        Row: {
          consecutive_failures: number | null
          created_at: string
          deployed_content_hash: string | null
          deployed_h1: string | null
          deployed_meta_desc: string | null
          deployed_schema_types: string[] | null
          deployed_title: string | null
          domain: string
          id: string
          is_active: boolean | null
          last_verification_status: string | null
          last_verified_at: string | null
          page_url: string
          source_record_id: string | null
          source_type: string
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          consecutive_failures?: number | null
          created_at?: string
          deployed_content_hash?: string | null
          deployed_h1?: string | null
          deployed_meta_desc?: string | null
          deployed_schema_types?: string[] | null
          deployed_title?: string | null
          domain: string
          id?: string
          is_active?: boolean | null
          last_verification_status?: string | null
          last_verified_at?: string | null
          page_url: string
          source_record_id?: string | null
          source_type: string
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          consecutive_failures?: number | null
          created_at?: string
          deployed_content_hash?: string | null
          deployed_h1?: string | null
          deployed_meta_desc?: string | null
          deployed_schema_types?: string[] | null
          deployed_title?: string | null
          domain?: string
          id?: string
          is_active?: boolean | null
          last_verification_status?: string | null
          last_verified_at?: string | null
          page_url?: string
          source_record_id?: string | null
          source_type?: string
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_deploy_snapshots_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_gap_results: {
        Row: {
          competitor_domain: string
          competitor_position: number | null
          created_at: string
          difficulty: number | null
          domain: string
          gap_type: string
          id: string
          intent: string | null
          keyword: string
          opportunity_score: number | null
          our_position: number | null
          search_volume: number | null
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          competitor_domain: string
          competitor_position?: number | null
          created_at?: string
          difficulty?: number | null
          domain: string
          gap_type?: string
          id?: string
          intent?: string | null
          keyword: string
          opportunity_score?: number | null
          our_position?: number | null
          search_volume?: number | null
          tracked_site_id: string
          user_id: string
        }
        Update: {
          competitor_domain?: string
          competitor_position?: number | null
          created_at?: string
          difficulty?: number | null
          domain?: string
          gap_type?: string
          id?: string
          intent?: string | null
          keyword?: string
          opportunity_score?: number | null
          our_position?: number | null
          search_volume?: number | null
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_gap_results_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_generation_logs: {
        Row: {
          brief_angle: string | null
          brief_cta_count: number | null
          brief_eeat_signals: string[] | null
          brief_geo_passages: number | null
          brief_h2_count: number | null
          brief_h3_count: number | null
          brief_internal_links_count: number | null
          brief_length_target: number | null
          brief_schema_types: string[] | null
          brief_tone: string | null
          created_at: string
          domain: string
          ga4_conversions_baseline: number | null
          ga4_conversions_t90: number | null
          ga4_sessions_baseline: number | null
          ga4_sessions_t90: number | null
          geo_score_baseline: number | null
          geo_score_t90: number | null
          gsc_clicks_baseline: number | null
          gsc_clicks_t30: number | null
          gsc_clicks_t90: number | null
          gsc_ctr_baseline: number | null
          gsc_ctr_t90: number | null
          id: string
          keyword: string | null
          llm_visibility_baseline: number | null
          llm_visibility_t90: number | null
          market_sector: string | null
          measured_at: string | null
          measurement_phase: string | null
          page_type: string
          preset_id: string | null
          preset_page_type: string | null
          source: string
          target_url: string | null
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          brief_angle?: string | null
          brief_cta_count?: number | null
          brief_eeat_signals?: string[] | null
          brief_geo_passages?: number | null
          brief_h2_count?: number | null
          brief_h3_count?: number | null
          brief_internal_links_count?: number | null
          brief_length_target?: number | null
          brief_schema_types?: string[] | null
          brief_tone?: string | null
          created_at?: string
          domain: string
          ga4_conversions_baseline?: number | null
          ga4_conversions_t90?: number | null
          ga4_sessions_baseline?: number | null
          ga4_sessions_t90?: number | null
          geo_score_baseline?: number | null
          geo_score_t90?: number | null
          gsc_clicks_baseline?: number | null
          gsc_clicks_t30?: number | null
          gsc_clicks_t90?: number | null
          gsc_ctr_baseline?: number | null
          gsc_ctr_t90?: number | null
          id?: string
          keyword?: string | null
          llm_visibility_baseline?: number | null
          llm_visibility_t90?: number | null
          market_sector?: string | null
          measured_at?: string | null
          measurement_phase?: string | null
          page_type: string
          preset_id?: string | null
          preset_page_type?: string | null
          source?: string
          target_url?: string | null
          tracked_site_id: string
          user_id: string
        }
        Update: {
          brief_angle?: string | null
          brief_cta_count?: number | null
          brief_eeat_signals?: string[] | null
          brief_geo_passages?: number | null
          brief_h2_count?: number | null
          brief_h3_count?: number | null
          brief_internal_links_count?: number | null
          brief_length_target?: number | null
          brief_schema_types?: string[] | null
          brief_tone?: string | null
          created_at?: string
          domain?: string
          ga4_conversions_baseline?: number | null
          ga4_conversions_t90?: number | null
          ga4_sessions_baseline?: number | null
          ga4_sessions_t90?: number | null
          geo_score_baseline?: number | null
          geo_score_t90?: number | null
          gsc_clicks_baseline?: number | null
          gsc_clicks_t30?: number | null
          gsc_clicks_t90?: number | null
          gsc_ctr_baseline?: number | null
          gsc_ctr_t90?: number | null
          id?: string
          keyword?: string | null
          llm_visibility_baseline?: number | null
          llm_visibility_t90?: number | null
          market_sector?: string | null
          measured_at?: string | null
          measurement_phase?: string | null
          page_type?: string
          preset_id?: string | null
          preset_page_type?: string | null
          source?: string
          target_url?: string | null
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_generation_logs_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "content_prompt_presets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_generation_logs_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_monitor_log: {
        Row: {
          changed_elements: string[] | null
          created_at: string
          details: Json | null
          detected_content_hash: string | null
          detected_h1: string | null
          detected_meta_desc: string | null
          detected_schema_types: string[] | null
          detected_title: string | null
          domain: string
          expected_content_hash: string | null
          expected_h1: string | null
          expected_meta_desc: string | null
          expected_schema_types: string[] | null
          expected_title: string | null
          id: string
          source_record_id: string | null
          source_type: string
          status: string
          tracked_site_id: string
          url_checked: string
          user_id: string
        }
        Insert: {
          changed_elements?: string[] | null
          created_at?: string
          details?: Json | null
          detected_content_hash?: string | null
          detected_h1?: string | null
          detected_meta_desc?: string | null
          detected_schema_types?: string[] | null
          detected_title?: string | null
          domain: string
          expected_content_hash?: string | null
          expected_h1?: string | null
          expected_meta_desc?: string | null
          expected_schema_types?: string[] | null
          expected_title?: string | null
          id?: string
          source_record_id?: string | null
          source_type: string
          status?: string
          tracked_site_id: string
          url_checked: string
          user_id: string
        }
        Update: {
          changed_elements?: string[] | null
          created_at?: string
          details?: Json | null
          detected_content_hash?: string | null
          detected_h1?: string | null
          detected_meta_desc?: string | null
          detected_schema_types?: string[] | null
          detected_title?: string | null
          domain?: string
          expected_content_hash?: string | null
          expected_h1?: string | null
          expected_meta_desc?: string | null
          expected_schema_types?: string[] | null
          expected_title?: string | null
          id?: string
          source_record_id?: string | null
          source_type?: string
          status?: string
          tracked_site_id?: string
          url_checked?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_monitor_log_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      content_performance_correlations: {
        Row: {
          angle: string | null
          avg_cta_count: number | null
          avg_ga4_conversions_delta: number | null
          avg_ga4_sessions_delta: number | null
          avg_geo_passages: number | null
          avg_geo_score_delta: number | null
          avg_gsc_clicks_delta: number | null
          avg_gsc_ctr_delta: number | null
          avg_h2_count: number | null
          avg_internal_links: number | null
          avg_length_target: number | null
          avg_llm_visibility_delta: number | null
          confidence_grade: string | null
          created_at: string
          id: string
          market_sector: string
          page_type: string
          sample_count: number
          tone: string | null
          week_start: string
        }
        Insert: {
          angle?: string | null
          avg_cta_count?: number | null
          avg_ga4_conversions_delta?: number | null
          avg_ga4_sessions_delta?: number | null
          avg_geo_passages?: number | null
          avg_geo_score_delta?: number | null
          avg_gsc_clicks_delta?: number | null
          avg_gsc_ctr_delta?: number | null
          avg_h2_count?: number | null
          avg_internal_links?: number | null
          avg_length_target?: number | null
          avg_llm_visibility_delta?: number | null
          confidence_grade?: string | null
          created_at?: string
          id?: string
          market_sector: string
          page_type: string
          sample_count?: number
          tone?: string | null
          week_start: string
        }
        Update: {
          angle?: string | null
          avg_cta_count?: number | null
          avg_ga4_conversions_delta?: number | null
          avg_ga4_sessions_delta?: number | null
          avg_geo_passages?: number | null
          avg_geo_score_delta?: number | null
          avg_gsc_clicks_delta?: number | null
          avg_gsc_ctr_delta?: number | null
          avg_h2_count?: number | null
          avg_internal_links?: number | null
          avg_length_target?: number | null
          avg_llm_visibility_delta?: number | null
          confidence_grade?: string | null
          created_at?: string
          id?: string
          market_sector?: string
          page_type?: string
          sample_count?: number
          tone?: string | null
          week_start?: string
        }
        Relationships: []
      }
      content_prompt_blocks: {
        Row: {
          block_type: string
          content: string
          created_at: string
          id: string
          name: string
          score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          block_type?: string
          content?: string
          created_at?: string
          id?: string
          name: string
          score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          block_type?: string
          content?: string
          created_at?: string
          id?: string
          name?: string
          score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      content_prompt_presets: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_default: boolean
          name: string
          page_type: string
          prompt_text: string
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_default?: boolean
          name: string
          page_type: string
          prompt_text?: string
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_default?: boolean
          name?: string
          page_type?: string
          prompt_text?: string
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_prompt_presets_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      content_requirements_matrix: {
        Row: {
          consumer: string
          created_at: string
          id: string
          is_required: boolean
          page_type: string
          search_intent: string
          source: string
          updated_at: string
          variable_description: string | null
          variable_key: string
          variable_label: string
          weight: number
        }
        Insert: {
          consumer?: string
          created_at?: string
          id?: string
          is_required?: boolean
          page_type: string
          search_intent?: string
          source?: string
          updated_at?: string
          variable_description?: string | null
          variable_key: string
          variable_label: string
          weight?: number
        }
        Update: {
          consumer?: string
          created_at?: string
          id?: string
          is_required?: boolean
          page_type?: string
          search_intent?: string
          source?: string
          updated_at?: string
          variable_description?: string | null
          variable_key?: string
          variable_label?: string
          weight?: number
        }
        Relationships: []
      }
      copilot_actions: {
        Row: {
          action_category: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          input: Json
          llm_cost_usd: number | null
          output: Json | null
          persona: string
          session_id: string
          skill: string
          status: string
          user_id: string
        }
        Insert: {
          action_category?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json
          llm_cost_usd?: number | null
          output?: Json | null
          persona: string
          session_id: string
          skill: string
          status?: string
          user_id: string
        }
        Update: {
          action_category?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          input?: Json
          llm_cost_usd?: number | null
          output?: Json | null
          persona?: string
          session_id?: string
          skill?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "copilot_actions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "copilot_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      copilot_sessions: {
        Row: {
          context: Json
          created_at: string
          id: string
          last_message_at: string
          persona: string
          processing_started_at: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          last_message_at?: string
          persona: string
          processing_started_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          last_message_at?: string
          persona?: string
          processing_started_at?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
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
          tone_analysis: Json | null
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
          tone_analysis?: Json | null
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
          tone_analysis?: Json | null
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
      cross_agent_insights: {
        Row: {
          created_at: string
          id: string
          insight_data: Json
          insight_type: string
          is_resolved: boolean
          resolved_at: string | null
          source_agent: string
          target_agent: string
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          insight_data?: Json
          insight_type?: string
          is_resolved?: boolean
          resolved_at?: string | null
          source_agent?: string
          target_agent?: string
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          insight_data?: Json
          insight_type?: string
          is_resolved?: boolean
          resolved_at?: string | null
          source_agent?: string
          target_agent?: string
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_agent_insights_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      cto_code_proposals: {
        Row: {
          agent_source: string
          confidence_score: number | null
          created_at: string
          deployed_at: string | null
          description: string | null
          diff_preview: string | null
          domain: string
          id: string
          original_code: string | null
          proposal_type: string
          proposed_code: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_diagnostic_id: string | null
          status: string
          target_function: string
          target_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          agent_source?: string
          confidence_score?: number | null
          created_at?: string
          deployed_at?: string | null
          description?: string | null
          diff_preview?: string | null
          domain: string
          id?: string
          original_code?: string | null
          proposal_type?: string
          proposed_code?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_diagnostic_id?: string | null
          status?: string
          target_function: string
          target_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          agent_source?: string
          confidence_score?: number | null
          created_at?: string
          deployed_at?: string | null
          description?: string | null
          diff_preview?: string | null
          domain?: string
          id?: string
          original_code?: string | null
          proposal_type?: string
          proposed_code?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_diagnostic_id?: string | null
          status?: string
          target_function?: string
          target_url?: string | null
          title?: string
          updated_at?: string
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
      editorial_briefing_packets: {
        Row: {
          briefing_data: Json
          consumed_at: string | null
          consumed_by_pipeline_id: string | null
          content_type: string
          created_at: string
          domain: string
          id: string
          source_signals: Json
          spiral_phase: string | null
          target_url: string | null
          tracked_site_id: string | null
          user_id: string
          workbench_item_ids: string[] | null
        }
        Insert: {
          briefing_data?: Json
          consumed_at?: string | null
          consumed_by_pipeline_id?: string | null
          content_type: string
          created_at?: string
          domain: string
          id?: string
          source_signals?: Json
          spiral_phase?: string | null
          target_url?: string | null
          tracked_site_id?: string | null
          user_id: string
          workbench_item_ids?: string[] | null
        }
        Update: {
          briefing_data?: Json
          consumed_at?: string | null
          consumed_by_pipeline_id?: string | null
          content_type?: string
          created_at?: string
          domain?: string
          id?: string
          source_signals?: Json
          spiral_phase?: string | null
          target_url?: string | null
          tracked_site_id?: string | null
          user_id?: string
          workbench_item_ids?: string[] | null
        }
        Relationships: []
      }
      editorial_llm_routing: {
        Row: {
          content_type: string
          created_at: string
          domain: string
          id: string
          is_default: boolean
          notes: string | null
          strategist_model: string | null
          tonalizer_model: string | null
          updated_at: string
          user_id: string
          writer_model: string | null
        }
        Insert: {
          content_type: string
          created_at?: string
          domain: string
          id?: string
          is_default?: boolean
          notes?: string | null
          strategist_model?: string | null
          tonalizer_model?: string | null
          updated_at?: string
          user_id: string
          writer_model?: string | null
        }
        Update: {
          content_type?: string
          created_at?: string
          domain?: string
          id?: string
          is_default?: boolean
          notes?: string | null
          strategist_model?: string | null
          tonalizer_model?: string | null
          updated_at?: string
          user_id?: string
          writer_model?: string | null
        }
        Relationships: []
      }
      editorial_pipeline_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_type: string
          created_at: string
          domain: string
          id: string
          is_acknowledged: boolean
          message: string
          observed_value: number | null
          pipeline_run_id: string | null
          severity: string
          threshold_value: number | null
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_type: string
          created_at?: string
          domain: string
          id?: string
          is_acknowledged?: boolean
          message: string
          observed_value?: number | null
          pipeline_run_id?: string | null
          severity?: string
          threshold_value?: number | null
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_type?: string
          created_at?: string
          domain?: string
          id?: string
          is_acknowledged?: boolean
          message?: string
          observed_value?: number | null
          pipeline_run_id?: string | null
          severity?: string
          threshold_value?: number | null
          user_id?: string
        }
        Relationships: []
      }
      editorial_pipeline_logs: {
        Row: {
          content_type: string
          cost_usd: number | null
          created_at: string
          domain: string
          error_message: string | null
          id: string
          latency_ms: number | null
          metadata: Json | null
          model_used: string | null
          pipeline_run_id: string
          stage: string
          status: string
          tokens_in: number | null
          tokens_out: number | null
          user_id: string
        }
        Insert: {
          content_type: string
          cost_usd?: number | null
          created_at?: string
          domain: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model_used?: string | null
          pipeline_run_id: string
          stage: string
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_id: string
        }
        Update: {
          content_type?: string
          cost_usd?: number | null
          created_at?: string
          domain?: string
          error_message?: string | null
          id?: string
          latency_ms?: number | null
          metadata?: Json | null
          model_used?: string | null
          pipeline_run_id?: string
          stage?: string
          status?: string
          tokens_in?: number | null
          tokens_out?: number | null
          user_id?: string
        }
        Relationships: []
      }
      eeat_scoring_criteria: {
        Row: {
          category: string
          created_at: string
          criterion_key: string
          description: string | null
          detection_config: Json
          display_order: number
          id: string
          is_active: boolean
          label: string
          max_score: number
          scoring_method: string
          updated_at: string
          weight: number
        }
        Insert: {
          category: string
          created_at?: string
          criterion_key: string
          description?: string | null
          detection_config?: Json
          display_order?: number
          id?: string
          is_active?: boolean
          label: string
          max_score?: number
          scoring_method?: string
          updated_at?: string
          weight?: number
        }
        Update: {
          category?: string
          created_at?: string
          criterion_key?: string
          description?: string | null
          detection_config?: Json
          display_order?: number
          id?: string
          is_active?: boolean
          label?: string
          max_score?: number
          scoring_method?: string
          updated_at?: string
          weight?: number
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
      felix_config: {
        Row: {
          config_key: string
          config_value: string
          created_at: string
          description: string | null
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value: string
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: string
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
          updated_by?: string | null
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
      ga4_behavioral_metrics: {
        Row: {
          avg_engagement_time: number | null
          click_events: number | null
          conversion_rate: number | null
          conversions: number | null
          created_at: string
          engaged_sessions: number | null
          engagement_rate: number | null
          entries: number | null
          exit_rate: number | null
          form_submissions: number | null
          id: string
          measured_at: string
          outbound_clicks: number | null
          page_path: string
          period_end: string
          period_start: string
          scroll_events: number | null
          scroll_rate: number | null
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          avg_engagement_time?: number | null
          click_events?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string
          engaged_sessions?: number | null
          engagement_rate?: number | null
          entries?: number | null
          exit_rate?: number | null
          form_submissions?: number | null
          id?: string
          measured_at?: string
          outbound_clicks?: number | null
          page_path: string
          period_end: string
          period_start: string
          scroll_events?: number | null
          scroll_rate?: number | null
          tracked_site_id: string
          user_id: string
        }
        Update: {
          avg_engagement_time?: number | null
          click_events?: number | null
          conversion_rate?: number | null
          conversions?: number | null
          created_at?: string
          engaged_sessions?: number | null
          engagement_rate?: number | null
          entries?: number | null
          exit_rate?: number | null
          form_submissions?: number | null
          id?: string
          measured_at?: string
          outbound_clicks?: number | null
          page_path?: string
          period_end?: string
          period_start?: string
          scroll_events?: number | null
          scroll_rate?: number | null
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ga4_behavioral_metrics_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_daily_metrics: {
        Row: {
          created_at: string
          id: string
          metric_date: string
          pageviews: number | null
          revenue: number | null
          sessions: number | null
          total_users: number | null
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metric_date: string
          pageviews?: number | null
          revenue?: number | null
          sessions?: number | null
          total_users?: number | null
          tracked_site_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metric_date?: string
          pageviews?: number | null
          revenue?: number | null
          sessions?: number | null
          total_users?: number | null
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ga4_daily_metrics_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      ga4_page_groups: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          page_paths: string[]
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          page_paths?: string[]
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          page_paths?: string[]
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ga4_page_groups_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_top_pages: {
        Row: {
          avg_duration: number | null
          bounce_rate: number | null
          created_at: string
          id: string
          page_path: string
          pageviews: number | null
          period_end: string
          period_start: string
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          avg_duration?: number | null
          bounce_rate?: number | null
          created_at?: string
          id?: string
          page_path: string
          pageviews?: number | null
          period_end: string
          period_start: string
          tracked_site_id: string
          user_id: string
        }
        Update: {
          avg_duration?: number | null
          bounce_rate?: number | null
          created_at?: string
          id?: string
          page_path?: string
          pageviews?: number | null
          period_end?: string
          period_start?: string
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ga4_top_pages_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      ga4_traffic_sources_cache: {
        Row: {
          created_at: string
          expires_at: string
          fetched_at: string
          id: string
          page_paths: string[]
          page_paths_hash: string
          period_end: string
          period_start: string
          sources_data: Json
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          page_paths?: string[]
          page_paths_hash?: string
          period_end: string
          period_start: string
          sources_data?: Json
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          page_paths?: string[]
          page_paths_hash?: string
          period_end?: string
          period_start?: string
          sources_data?: Json
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ga4_traffic_sources_cache_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_kpi_snapshots: {
        Row: {
          aeo_avg: number | null
          ai_referral_ctr: number | null
          ai_requests_per_100_visits: number | null
          avg_sentiment: number | null
          bot_traffic_mix: Json | null
          chunkability_avg: number | null
          citation_rate: number | null
          citation_rate_delta: number | null
          cluster_coverage: Json | null
          computed_at: string
          created_at: string
          domain: string
          fanout_coverage_avg: number | null
          geo_overall_delta: number | null
          geo_overall_score: number | null
          id: string
          position_zero_eligible_pages: number | null
          quotability_avg: number | null
          raw_data: Json | null
          recommendation_rate: number | null
          sampled_pages: Json | null
          share_of_voice: number | null
          tracked_site_id: string
          url_hallucination_rate: number | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          aeo_avg?: number | null
          ai_referral_ctr?: number | null
          ai_requests_per_100_visits?: number | null
          avg_sentiment?: number | null
          bot_traffic_mix?: Json | null
          chunkability_avg?: number | null
          citation_rate?: number | null
          citation_rate_delta?: number | null
          cluster_coverage?: Json | null
          computed_at?: string
          created_at?: string
          domain: string
          fanout_coverage_avg?: number | null
          geo_overall_delta?: number | null
          geo_overall_score?: number | null
          id?: string
          position_zero_eligible_pages?: number | null
          quotability_avg?: number | null
          raw_data?: Json | null
          recommendation_rate?: number | null
          sampled_pages?: Json | null
          share_of_voice?: number | null
          tracked_site_id: string
          url_hallucination_rate?: number | null
          user_id: string
          week_start_date: string
        }
        Update: {
          aeo_avg?: number | null
          ai_referral_ctr?: number | null
          ai_requests_per_100_visits?: number | null
          avg_sentiment?: number | null
          bot_traffic_mix?: Json | null
          chunkability_avg?: number | null
          citation_rate?: number | null
          citation_rate_delta?: number | null
          cluster_coverage?: Json | null
          computed_at?: string
          created_at?: string
          domain?: string
          fanout_coverage_avg?: number | null
          geo_overall_delta?: number | null
          geo_overall_score?: number | null
          id?: string
          position_zero_eligible_pages?: number | null
          quotability_avg?: number | null
          raw_data?: Json | null
          recommendation_rate?: number | null
          sampled_pages?: Json | null
          share_of_voice?: number | null
          tracked_site_id?: string
          url_hallucination_rate?: number | null
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_kpi_snapshots_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_visibility_snapshots: {
        Row: {
          audit_impact_snapshot_id: string | null
          avg_sentiment_score: number | null
          brand_mention_count: number | null
          citation_rate: number | null
          cited_count: number | null
          created_at: string
          delta_citation_rate: number | null
          delta_overall_score: number | null
          delta_sentiment: number | null
          domain: string
          id: string
          market_sector: string | null
          measured_at: string
          measurement_phase: string
          overall_score: number | null
          prompts_used: Json | null
          provider_scores: Json | null
          recommendation_rate: number | null
          total_models: number | null
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          audit_impact_snapshot_id?: string | null
          avg_sentiment_score?: number | null
          brand_mention_count?: number | null
          citation_rate?: number | null
          cited_count?: number | null
          created_at?: string
          delta_citation_rate?: number | null
          delta_overall_score?: number | null
          delta_sentiment?: number | null
          domain: string
          id?: string
          market_sector?: string | null
          measured_at?: string
          measurement_phase?: string
          overall_score?: number | null
          prompts_used?: Json | null
          provider_scores?: Json | null
          recommendation_rate?: number | null
          total_models?: number | null
          tracked_site_id: string
          user_id: string
        }
        Update: {
          audit_impact_snapshot_id?: string | null
          avg_sentiment_score?: number | null
          brand_mention_count?: number | null
          citation_rate?: number | null
          cited_count?: number | null
          created_at?: string
          delta_citation_rate?: number | null
          delta_overall_score?: number | null
          delta_sentiment?: number | null
          domain?: string
          id?: string
          market_sector?: string | null
          measured_at?: string
          measurement_phase?: string
          overall_score?: number | null
          prompts_used?: Json | null
          provider_scores?: Json | null
          recommendation_rate?: number | null
          total_models?: number | null
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "geo_visibility_snapshots_audit_impact_snapshot_id_fkey"
            columns: ["audit_impact_snapshot_id"]
            isOneToOne: false
            referencedRelation: "audit_impact_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "geo_visibility_snapshots_tracked_site_id_fkey"
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
      gmb_power_snapshots: {
        Row: {
          activity_score: number | null
          completeness_score: number | null
          created_at: string
          domain: string
          grade: string
          id: string
          local_serp_score: number | null
          measured_at: string
          media_score: number | null
          nap_consistency_score: number | null
          raw_data: Json | null
          reputation_score: number | null
          total_score: number
          tracked_site_id: string
          trust_score: number | null
          user_id: string
          week_start_date: string
        }
        Insert: {
          activity_score?: number | null
          completeness_score?: number | null
          created_at?: string
          domain: string
          grade?: string
          id?: string
          local_serp_score?: number | null
          measured_at?: string
          media_score?: number | null
          nap_consistency_score?: number | null
          raw_data?: Json | null
          reputation_score?: number | null
          total_score?: number
          tracked_site_id: string
          trust_score?: number | null
          user_id: string
          week_start_date: string
        }
        Update: {
          activity_score?: number | null
          completeness_score?: number | null
          created_at?: string
          domain?: string
          grade?: string
          id?: string
          local_serp_score?: number | null
          measured_at?: string
          media_score?: number | null
          nap_consistency_score?: number | null
          raw_data?: Json | null
          reputation_score?: number | null
          total_score?: number
          tracked_site_id?: string
          trust_score?: number | null
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmb_power_snapshots_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
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
      google_ads_connections_deprecated_20260427: {
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
          ads_account_name: string | null
          ads_customer_id: string | null
          ads_status: string | null
          created_at: string | null
          ga4_property_id: string | null
          gmb_account_id: string | null
          gmb_location_id: string | null
          google_email: string
          gsc_site_urls: Json | null
          id: string
          refresh_token: string | null
          scopes: string[] | null
          token_expiry: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          ads_account_name?: string | null
          ads_customer_id?: string | null
          ads_status?: string | null
          created_at?: string | null
          ga4_property_id?: string | null
          gmb_account_id?: string | null
          gmb_location_id?: string | null
          google_email: string
          gsc_site_urls?: Json | null
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          ads_account_name?: string | null
          ads_customer_id?: string | null
          ads_status?: string | null
          created_at?: string | null
          ga4_property_id?: string | null
          gmb_account_id?: string | null
          gmb_location_id?: string | null
          google_email?: string
          gsc_site_urls?: Json | null
          id?: string
          refresh_token?: string | null
          scopes?: string[] | null
          token_expiry?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      gsc_bigquery_cache: {
        Row: {
          bytes_processed: number | null
          created_at: string
          expires_at: string
          id: string
          query_hash: string
          query_kind: string
          result_payload: Json
          rows_returned: number | null
          site_id: string
        }
        Insert: {
          bytes_processed?: number | null
          created_at?: string
          expires_at: string
          id?: string
          query_hash: string
          query_kind: string
          result_payload: Json
          rows_returned?: number | null
          site_id: string
        }
        Update: {
          bytes_processed?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          query_hash?: string
          query_kind?: string
          result_payload?: Json
          rows_returned?: number | null
          site_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_bigquery_cache_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_bigquery_config: {
        Row: {
          created_at: string
          dataset_id: string
          enabled: boolean
          gcp_project_id: string
          id: string
          last_verification_error: string | null
          last_verification_status: string | null
          last_verified_at: string | null
          site_id: string
          table_prefix: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dataset_id: string
          enabled?: boolean
          gcp_project_id: string
          id?: string
          last_verification_error?: string | null
          last_verification_status?: string | null
          last_verified_at?: string | null
          site_id: string
          table_prefix?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dataset_id?: string
          enabled?: boolean
          gcp_project_id?: string
          id?: string
          last_verification_error?: string | null
          last_verification_status?: string | null
          last_verified_at?: string | null
          site_id?: string
          table_prefix?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_bigquery_config_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: true
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      gsc_daily_positions: {
        Row: {
          clicks: number | null
          country: string
          created_at: string
          ctr: number | null
          date_val: string
          domain: string
          id: string
          impressions: number | null
          position: number
          query: string
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          clicks?: number | null
          country?: string
          created_at?: string
          ctr?: number | null
          date_val: string
          domain: string
          id?: string
          impressions?: number | null
          position: number
          query: string
          tracked_site_id: string
          user_id: string
        }
        Update: {
          clicks?: number | null
          country?: string
          created_at?: string
          ctr?: number | null
          date_val?: string
          domain?: string
          id?: string
          impressions?: number | null
          position?: number
          query?: string
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gsc_daily_positions_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
          brand_maturity_score: number | null
          brand_penetration_rate: number | null
          brand_penetration_score: number | null
          business_type: string
          composite_ias_score: number | null
          created_at: string
          diagnostic_text: string | null
          domain: string
          founding_year: number | null
          generic_clicks: number
          ias_score: number | null
          id: string
          is_seasonal: boolean | null
          momentum_score: number | null
          organic_traction_score: number | null
          risk_score: number
          seasonality_factor: number | null
          sub_scores_detail: Json | null
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
          brand_maturity_score?: number | null
          brand_penetration_rate?: number | null
          brand_penetration_score?: number | null
          business_type: string
          composite_ias_score?: number | null
          created_at?: string
          diagnostic_text?: string | null
          domain: string
          founding_year?: number | null
          generic_clicks?: number
          ias_score?: number | null
          id?: string
          is_seasonal?: boolean | null
          momentum_score?: number | null
          organic_traction_score?: number | null
          risk_score: number
          seasonality_factor?: number | null
          sub_scores_detail?: Json | null
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
          brand_maturity_score?: number | null
          brand_penetration_rate?: number | null
          brand_penetration_score?: number | null
          business_type?: string
          composite_ias_score?: number | null
          created_at?: string
          diagnostic_text?: string | null
          domain?: string
          founding_year?: number | null
          generic_clicks?: number
          ias_score?: number | null
          id?: string
          is_seasonal?: boolean | null
          momentum_score?: number | null
          organic_traction_score?: number | null
          risk_score?: number
          seasonality_factor?: number | null
          sub_scores_detail?: Json | null
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
      iktracker_slug_memory: {
        Row: {
          attempts_count: number
          blocked_until: string | null
          domain: string
          first_seen_at: string
          hash_content: string | null
          iktracker_post_id: string | null
          last_response: Json | null
          last_seen_at: string
          reason: string | null
          slug: string
          status: string
          tracked_site_id: string | null
        }
        Insert: {
          attempts_count?: number
          blocked_until?: string | null
          domain?: string
          first_seen_at?: string
          hash_content?: string | null
          iktracker_post_id?: string | null
          last_response?: Json | null
          last_seen_at?: string
          reason?: string | null
          slug: string
          status: string
          tracked_site_id?: string | null
        }
        Update: {
          attempts_count?: number
          blocked_until?: string | null
          domain?: string
          first_seen_at?: string
          hash_content?: string | null
          iktracker_post_id?: string | null
          last_response?: Json | null
          last_seen_at?: string
          reason?: string | null
          slug?: string
          status?: string
          tracked_site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "iktracker_slug_memory_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      image_style_preferences: {
        Row: {
          created_at: string
          id: string
          last_used_at: string
          style_key: string
          target_url: string | null
          tracked_site_id: string | null
          usage_count: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string
          style_key: string
          target_url?: string | null
          tracked_site_id?: string | null
          usage_count?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string
          style_key?: string
          target_url?: string | null
          tracked_site_id?: string | null
          usage_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "image_style_preferences_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      indexation_checks: {
        Row: {
          checked_at: string
          coverage_state: string | null
          crawled_as: string | null
          created_at: string
          id: string
          indexing_state: string | null
          last_crawl_time: string | null
          page_fetch_state: string | null
          page_url: string
          raw_response: Json | null
          referring_urls: string[] | null
          rich_results_errors: Json | null
          robots_txt_state: string | null
          tracked_site_id: string
          updated_at: string
          user_id: string
          verdict: string
        }
        Insert: {
          checked_at?: string
          coverage_state?: string | null
          crawled_as?: string | null
          created_at?: string
          id?: string
          indexing_state?: string | null
          last_crawl_time?: string | null
          page_fetch_state?: string | null
          page_url: string
          raw_response?: Json | null
          referring_urls?: string[] | null
          rich_results_errors?: Json | null
          robots_txt_state?: string | null
          tracked_site_id: string
          updated_at?: string
          user_id: string
          verdict?: string
        }
        Update: {
          checked_at?: string
          coverage_state?: string | null
          crawled_as?: string | null
          created_at?: string
          id?: string
          indexing_state?: string | null
          last_crawl_time?: string | null
          page_fetch_state?: string | null
          page_url?: string
          raw_response?: Json | null
          referring_urls?: string[] | null
          rich_results_errors?: Json | null
          robots_txt_state?: string | null
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "indexation_checks_tracked_site_id_fkey"
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
      injection_catalog: {
        Row: {
          category: Database["public"]["Enums"]["injection_category"]
          created_at: string
          description: string
          display_order: number
          id: string
          is_premium: boolean
          label: string
          required_data: Json
          seo_impact: string
          slug: string
          template_code: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["injection_category"]
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_premium?: boolean
          label: string
          required_data?: Json
          seo_impact?: string
          slug: string
          template_code?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["injection_category"]
          created_at?: string
          description?: string
          display_order?: number
          id?: string
          is_premium?: boolean
          label?: string
          required_data?: Json
          seo_impact?: string
          slug?: string
          template_code?: string | null
          updated_at?: string
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
      injection_monitor_log: {
        Row: {
          created_at: string
          details: Json | null
          detected_hash: string | null
          domain: string
          expected_hash: string | null
          id: string
          rule_id: string
          status: string
          tracked_site_id: string
          url_checked: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          detected_hash?: string | null
          domain: string
          expected_hash?: string | null
          id?: string
          rule_id: string
          status?: string
          tracked_site_id: string
          url_checked: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          detected_hash?: string | null
          domain?: string
          expected_hash?: string | null
          id?: string
          rule_id?: string
          status?: string
          tracked_site_id?: string
          url_checked?: string
        }
        Relationships: [
          {
            foreignKeyName: "injection_monitor_log_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      job_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          input_payload: Json
          locked_by: string | null
          locked_until: string | null
          max_attempts: number
          plan_type: string | null
          priority: number
          result_data: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          function_name: string
          id?: string
          input_payload?: Json
          locked_by?: string | null
          locked_until?: string | null
          max_attempts?: number
          plan_type?: string | null
          priority?: number
          result_data?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          function_name?: string
          id?: string
          input_payload?: Json
          locked_by?: string | null
          locked_until?: string | null
          max_attempts?: number
          plan_type?: string | null
          priority?: number
          result_data?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      keyword_universe: {
        Row: {
          best_position: number | null
          cluster_id: string | null
          current_position: number | null
          difficulty: number | null
          domain: string
          first_seen_at: string
          id: string
          intent: string | null
          is_quick_win: boolean | null
          keyword: string
          opportunity_score: number | null
          parent_query_id: string | null
          quick_win_action: string | null
          quick_win_type: string | null
          search_volume: number | null
          semantic_ring: number | null
          source_details: Json | null
          sources: string[]
          target_url: string | null
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          best_position?: number | null
          cluster_id?: string | null
          current_position?: number | null
          difficulty?: number | null
          domain: string
          first_seen_at?: string
          id?: string
          intent?: string | null
          is_quick_win?: boolean | null
          keyword: string
          opportunity_score?: number | null
          parent_query_id?: string | null
          quick_win_action?: string | null
          quick_win_type?: string | null
          search_volume?: number | null
          semantic_ring?: number | null
          source_details?: Json | null
          sources?: string[]
          target_url?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          best_position?: number | null
          cluster_id?: string | null
          current_position?: number | null
          difficulty?: number | null
          domain?: string
          first_seen_at?: string
          id?: string
          intent?: string | null
          is_quick_win?: boolean | null
          keyword?: string
          opportunity_score?: number | null
          parent_query_id?: string | null
          quick_win_action?: string | null
          quick_win_type?: string | null
          search_volume?: number | null
          semantic_ring?: number | null
          source_details?: Json | null
          sources?: string[]
          target_url?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "keyword_universe_cluster_id_fkey"
            columns: ["cluster_id"]
            isOneToOne: false
            referencedRelation: "cluster_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_universe_parent_query_id_fkey"
            columns: ["parent_query_id"]
            isOneToOne: false
            referencedRelation: "keyword_universe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "keyword_universe_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
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
      log_connector_errors: {
        Row: {
          connector_id: string
          created_at: string
          error: string
          id: string
          raw_payload: Json | null
        }
        Insert: {
          connector_id: string
          created_at?: string
          error: string
          id?: string
          raw_payload?: Json | null
        }
        Update: {
          connector_id?: string
          created_at?: string
          error?: string
          id?: string
          raw_payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "log_connector_errors_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "log_connectors"
            referencedColumns: ["id"]
          },
        ]
      }
      log_connectors: {
        Row: {
          api_key_hash: string | null
          config: Json | null
          created_at: string
          error_count: number
          id: string
          last_sync_at: string | null
          status: string
          tracked_site_id: string
          type: Database["public"]["Enums"]["log_connector_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_hash?: string | null
          config?: Json | null
          created_at?: string
          error_count?: number
          id?: string
          last_sync_at?: string | null
          status?: string
          tracked_site_id: string
          type: Database["public"]["Enums"]["log_connector_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_hash?: string | null
          config?: Json | null
          created_at?: string
          error_count?: number
          id?: string
          last_sync_at?: string | null
          status?: string
          tracked_site_id?: string
          type?: Database["public"]["Enums"]["log_connector_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "log_connectors_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      log_entries: {
        Row: {
          bot_category: Database["public"]["Enums"]["bot_category"] | null
          bot_name: string | null
          bytes_sent: number | null
          confidence_score: number | null
          connector_id: string
          country_code: string | null
          created_at: string
          id: string
          ip: unknown
          is_bot: boolean
          method: string | null
          path: string | null
          raw: Json | null
          referer: string | null
          source: string
          status_code: number | null
          tracked_site_id: string
          ts: string
          user_agent: string | null
          verification_method: string | null
          verification_status: string | null
        }
        Insert: {
          bot_category?: Database["public"]["Enums"]["bot_category"] | null
          bot_name?: string | null
          bytes_sent?: number | null
          confidence_score?: number | null
          connector_id: string
          country_code?: string | null
          created_at?: string
          id?: string
          ip?: unknown
          is_bot?: boolean
          method?: string | null
          path?: string | null
          raw?: Json | null
          referer?: string | null
          source: string
          status_code?: number | null
          tracked_site_id: string
          ts: string
          user_agent?: string | null
          verification_method?: string | null
          verification_status?: string | null
        }
        Update: {
          bot_category?: Database["public"]["Enums"]["bot_category"] | null
          bot_name?: string | null
          bytes_sent?: number | null
          confidence_score?: number | null
          connector_id?: string
          country_code?: string | null
          created_at?: string
          id?: string
          ip?: unknown
          is_bot?: boolean
          method?: string | null
          path?: string | null
          raw?: Json | null
          referer?: string | null
          source?: string
          status_code?: number | null
          tracked_site_id?: string
          ts?: string
          user_agent?: string | null
          verification_method?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "log_entries_connector_id_fkey"
            columns: ["connector_id"]
            isOneToOne: false
            referencedRelation: "log_connectors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "log_entries_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_layer_scans: {
        Row: {
          created_at: string
          detected_signals: Json
          domain: string
          error_message: string | null
          fetch_duration_ms: number | null
          http_status: number | null
          id: string
          ip_hash: string | null
          recommendations: Json
          rendered_via: string
          score_global: number
          scores_by_family: Json
          updated_at: string
          url: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detected_signals?: Json
          domain: string
          error_message?: string | null
          fetch_duration_ms?: number | null
          http_status?: number | null
          id?: string
          ip_hash?: string | null
          recommendations?: Json
          rendered_via?: string
          score_global?: number
          scores_by_family?: Json
          updated_at?: string
          url: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detected_signals?: Json
          domain?: string
          error_message?: string | null
          fetch_duration_ms?: number | null
          http_status?: number | null
          id?: string
          ip_hash?: string | null
          recommendations?: Json
          rendered_via?: string
          score_global?: number
          scores_by_family?: Json
          updated_at?: string
          url?: string
          user_id?: string | null
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
      marina_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          requests_count: number
          selected_services: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          requests_count?: number
          selected_services?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          requests_count?: number
          selected_services?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marina_prospects: {
        Row: {
          company: string | null
          created_at: string
          first_name: string
          id: string
          industry: string | null
          job_title: string | null
          language: string
          last_interaction_date: string | null
          last_name: string
          last_post_date: string | null
          linkedin_url: string | null
          marina_audit_id: string | null
          marina_report_url: string | null
          notes: string | null
          raw_data: Json | null
          score: number | null
          score_details: Json | null
          source: string | null
          status: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          first_name: string
          id?: string
          industry?: string | null
          job_title?: string | null
          language?: string
          last_interaction_date?: string | null
          last_name: string
          last_post_date?: string | null
          linkedin_url?: string | null
          marina_audit_id?: string | null
          marina_report_url?: string | null
          notes?: string | null
          raw_data?: Json | null
          score?: number | null
          score_details?: Json | null
          source?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          first_name?: string
          id?: string
          industry?: string | null
          job_title?: string | null
          language?: string
          last_interaction_date?: string | null
          last_name?: string
          last_post_date?: string | null
          linkedin_url?: string | null
          marina_audit_id?: string | null
          marina_report_url?: string | null
          notes?: string | null
          raw_data?: Json | null
          score?: number | null
          score_details?: Json | null
          source?: string | null
          status?: string
          updated_at?: string
          website_url?: string | null
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
      matrix_audits: {
        Row: {
          audit_type: string
          created_at: string
          duration_ms: number | null
          global_score: number | null
          id: string
          items_count: number
          label: string
          pivot_snapshot: Json | null
          results: Json
          site_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audit_type?: string
          created_at?: string
          duration_ms?: number | null
          global_score?: number | null
          id?: string
          items_count?: number
          label?: string
          pivot_snapshot?: Json | null
          results?: Json
          site_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audit_type?: string
          created_at?: string
          duration_ms?: number | null
          global_score?: number | null
          id?: string
          items_count?: number
          label?: string
          pivot_snapshot?: Json | null
          results?: Json
          site_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      matrix_display_schemas: {
        Row: {
          columns_config: Json
          created_at: string
          id: string
          schema_hash: string
          schema_name: string
          scoring_config: Json
          source_file_signature: string | null
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          columns_config?: Json
          created_at?: string
          id?: string
          schema_hash: string
          schema_name?: string
          scoring_config?: Json
          source_file_signature?: string | null
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          columns_config?: Json
          created_at?: string
          id?: string
          schema_hash?: string
          schema_name?: string
          scoring_config?: Json
          source_file_signature?: string | null
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: []
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
      outreach_daily_quotas: {
        Row: {
          created_at: string
          id: string
          invitations_sent: number
          max_invitations: number
          max_messages: number
          messages_sent: number
          quota_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitations_sent?: number
          max_invitations?: number
          max_messages?: number
          messages_sent?: number
          quota_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invitations_sent?: number
          max_invitations?: number
          max_messages?: number
          messages_sent?: number
          quota_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      outreach_events: {
        Row: {
          channel: string
          created_at: string
          event_type: string
          id: string
          metadata: Json | null
          prospect_id: string
          queue_item_id: string | null
          user_id: string
        }
        Insert: {
          channel?: string
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json | null
          prospect_id: string
          queue_item_id?: string | null
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json | null
          prospect_id?: string
          queue_item_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_events_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "marina_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_events_queue_item_id_fkey"
            columns: ["queue_item_id"]
            isOneToOne: false
            referencedRelation: "prospect_outreach_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequences: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          steps: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          steps?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          steps?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      page_priority_scores: {
        Row: {
          breakdown: Json
          created_at: string
          domain: string
          id: string
          page_url: string
          priority_score: number
          signals: Json
          top_opportunities: Json
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          domain: string
          id?: string
          page_url: string
          priority_score?: number
          signals?: Json
          top_opportunities?: Json
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          domain?: string
          id?: string
          page_url?: string
          priority_score?: number
          signals?: Json
          top_opportunities?: Json
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_priority_scores_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
          reward_signal: number | null
          risk_calibrated: number | null
          risk_iterations: number
          risk_predicted: number
          scope_reductions: number
          spiral_score_at_decision: number | null
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
          reward_signal?: number | null
          risk_calibrated?: number | null
          risk_iterations?: number
          risk_predicted?: number
          scope_reductions?: number
          spiral_score_at_decision?: number | null
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
          reward_signal?: number | null
          risk_calibrated?: number | null
          risk_iterations?: number
          risk_predicted?: number
          scope_reductions?: number
          spiral_score_at_decision?: number | null
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
      parmenion_targets: {
        Row: {
          api_key_name: string | null
          autopilot_enabled: boolean
          created_at: string
          created_by_user_id: string | null
          domain: string
          event_type: string
          id: string
          is_active: boolean
          label: string
          platform: string
          updated_at: string
        }
        Insert: {
          api_key_name?: string | null
          autopilot_enabled?: boolean
          created_at?: string
          created_by_user_id?: string | null
          domain: string
          event_type?: string
          id?: string
          is_active?: boolean
          label: string
          platform?: string
          updated_at?: string
        }
        Update: {
          api_key_name?: string | null
          autopilot_enabled?: boolean
          created_at?: string
          created_by_user_id?: string | null
          domain?: string
          event_type?: string
          id?: string
          is_active?: boolean
          label?: string
          platform?: string
          updated_at?: string
        }
        Relationships: []
      }
      patch_effectiveness: {
        Row: {
          agent_source: string
          created_at: string
          deployment_date: string
          domain: string
          error_reduction_pct: number | null
          errors_after: number
          errors_before: number
          id: string
          is_effective: boolean | null
          measured_at: string
          measurement_notes: string | null
          proposal_id: string
          sav_complaints_after: number | null
          sav_complaints_before: number | null
          target_function: string
        }
        Insert: {
          agent_source?: string
          created_at?: string
          deployment_date: string
          domain: string
          error_reduction_pct?: number | null
          errors_after?: number
          errors_before?: number
          id?: string
          is_effective?: boolean | null
          measured_at?: string
          measurement_notes?: string | null
          proposal_id: string
          sav_complaints_after?: number | null
          sav_complaints_before?: number | null
          target_function: string
        }
        Update: {
          agent_source?: string
          created_at?: string
          deployment_date?: string
          domain?: string
          error_reduction_pct?: number | null
          errors_after?: number
          errors_before?: number
          id?: string
          is_effective?: boolean | null
          measured_at?: string
          measurement_notes?: string | null
          proposal_id?: string
          sav_complaints_after?: number | null
          sav_complaints_before?: number | null
          target_function?: string
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
      persona_rotation_log: {
        Row: {
          articles_count: number | null
          created_at: string
          cycle_number: number | null
          id: string
          last_served_at: string | null
          pain_points: string[] | null
          persona_key: string
          persona_label: string
          topics: string[] | null
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          articles_count?: number | null
          created_at?: string
          cycle_number?: number | null
          id?: string
          last_served_at?: string | null
          pain_points?: string[] | null
          persona_key: string
          persona_label: string
          topics?: string[] | null
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          articles_count?: number | null
          created_at?: string
          cycle_number?: number | null
          id?: string
          last_served_at?: string | null
          pain_points?: string[] | null
          persona_key?: string
          persona_label?: string
          topics?: string[] | null
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "persona_rotation_log_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      prerender_cache: {
        Row: {
          content_hash: string | null
          created_at: string
          expires_at: string
          html_content: string
          id: string
          meta_description: string | null
          meta_title: string | null
          rendered_at: string
          route: string
          updated_at: string
        }
        Insert: {
          content_hash?: string | null
          created_at?: string
          expires_at?: string
          html_content: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          rendered_at?: string
          route: string
          updated_at?: string
        }
        Update: {
          content_hash?: string | null
          created_at?: string
          expires_at?: string
          html_content?: string
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          rendered_at?: string
          route?: string
          updated_at?: string
        }
        Relationships: []
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
          billing_period: string | null
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
          marina_brand_enabled: boolean | null
          marina_custom_cta_text: string | null
          marina_custom_cta_url: string | null
          marina_custom_intro: string | null
          marina_full_whitelabel: boolean | null
          marina_hide_crawlers_badge: boolean | null
          persona_type: string | null
          plan_type: string
          referral_code: string | null
          referred_by: string | null
          social_posts_this_month: number | null
          stripe_subscription_id: string | null
          subscription_expires_at: string | null
          subscription_period_end: string | null
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
          billing_period?: string | null
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
          marina_brand_enabled?: boolean | null
          marina_custom_cta_text?: string | null
          marina_custom_cta_url?: string | null
          marina_custom_intro?: string | null
          marina_full_whitelabel?: boolean | null
          marina_hide_crawlers_badge?: boolean | null
          persona_type?: string | null
          plan_type?: string
          referral_code?: string | null
          referred_by?: string | null
          social_posts_this_month?: number | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_period_end?: string | null
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
          billing_period?: string | null
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
          marina_brand_enabled?: boolean | null
          marina_custom_cta_text?: string | null
          marina_custom_cta_url?: string | null
          marina_custom_intro?: string | null
          marina_full_whitelabel?: boolean | null
          marina_hide_crawlers_badge?: boolean | null
          persona_type?: string | null
          plan_type?: string
          referral_code?: string | null
          referred_by?: string | null
          social_posts_this_month?: number | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_period_end?: string | null
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
      prospect_outreach_queue: {
        Row: {
          channel: string
          created_at: string
          email_address: string | null
          id: string
          message_content: string | null
          message_language: string
          message_type: string
          next_action_at: string | null
          prospect_id: string
          replied_at: string | null
          report_share_url: string | null
          sent_at: string | null
          sequence_id: string | null
          status: string
          step_number: number
          updated_at: string
        }
        Insert: {
          channel?: string
          created_at?: string
          email_address?: string | null
          id?: string
          message_content?: string | null
          message_language?: string
          message_type?: string
          next_action_at?: string | null
          prospect_id: string
          replied_at?: string | null
          report_share_url?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          status?: string
          step_number?: number
          updated_at?: string
        }
        Update: {
          channel?: string
          created_at?: string
          email_address?: string | null
          id?: string
          message_content?: string | null
          message_language?: string
          message_type?: string
          next_action_at?: string | null
          prospect_id?: string
          replied_at?: string | null
          report_share_url?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          status?: string
          step_number?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospect_outreach_queue_prospect_id_fkey"
            columns: ["prospect_id"]
            isOneToOne: false
            referencedRelation: "marina_prospects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospect_outreach_queue_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequences"
            referencedColumns: ["id"]
          },
        ]
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
      rate_limit_tokens: {
        Row: {
          id: string
          last_refill_at: string
          max_tokens: number
          refill_rate_per_sec: number
          tokens: number
        }
        Insert: {
          id?: string
          last_refill_at?: string
          max_tokens?: number
          refill_rate_per_sec?: number
          tokens?: number
        }
        Update: {
          id?: string
          last_refill_at?: string
          max_tokens?: number
          refill_rate_per_sec?: number
          tokens?: number
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
      role_permissions: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          permission_key: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission_key: string
          role: Database["public"]["Enums"]["team_role"]
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          permission_key?: string
          role?: Database["public"]["Enums"]["team_role"]
        }
        Relationships: []
      }
      saturation_snapshots: {
        Row: {
          created_at: string
          error_message: string | null
          estimated_cost_usd: number | null
          id: string
          llm_models_used: Json
          priority_clusters: Json
          ring_distribution: Json
          semantic_analysis: Json
          snapshot_date: string
          status: string
          topic_n_grams: Json
          total_articles_analyzed: number | null
          total_clusters_analyzed: number | null
          tracked_site_id: string
          type_distribution: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          llm_models_used?: Json
          priority_clusters?: Json
          ring_distribution?: Json
          semantic_analysis?: Json
          snapshot_date?: string
          status?: string
          topic_n_grams?: Json
          total_articles_analyzed?: number | null
          total_clusters_analyzed?: number | null
          tracked_site_id: string
          type_distribution?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          estimated_cost_usd?: number | null
          id?: string
          llm_models_used?: Json
          priority_clusters?: Json
          ring_distribution?: Json
          semantic_analysis?: Json
          snapshot_date?: string
          status?: string
          topic_n_grams?: Json
          total_articles_analyzed?: number | null
          total_clusters_analyzed?: number | null
          tracked_site_id?: string
          type_distribution?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saturation_snapshots_tracked_site_id_fkey"
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
      seasonal_context: {
        Row: {
          created_at: string
          description: string | null
          end_day: number | null
          end_month: number | null
          event_name: string
          event_type: string
          geo_zones: string[] | null
          id: string
          impact_level: string | null
          is_recurring: boolean | null
          metadata: Json | null
          peak_keywords: string[] | null
          prep_weeks_before: number | null
          sectors: string[] | null
          source: string | null
          start_day: number | null
          start_month: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          end_day?: number | null
          end_month?: number | null
          event_name: string
          event_type?: string
          geo_zones?: string[] | null
          id?: string
          impact_level?: string | null
          is_recurring?: boolean | null
          metadata?: Json | null
          peak_keywords?: string[] | null
          prep_weeks_before?: number | null
          sectors?: string[] | null
          source?: string | null
          start_day?: number | null
          start_month?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          end_day?: number | null
          end_month?: number | null
          event_name?: string
          event_type?: string
          geo_zones?: string[] | null
          id?: string
          impact_level?: string | null
          is_recurring?: boolean | null
          metadata?: Json | null
          peak_keywords?: string[] | null
          prep_weeks_before?: number | null
          sectors?: string[] | null
          source?: string | null
          start_day?: number | null
          start_month?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      seasonal_news_cache: {
        Row: {
          created_at: string
          expires_at: string
          geo_zone: string
          headline: string
          id: string
          keywords: string[] | null
          news_type: string
          related_event_id: string | null
          relevance_score: number | null
          sector: string
          source_name: string | null
          source_url: string | null
          summary: string | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          geo_zone?: string
          headline: string
          id?: string
          keywords?: string[] | null
          news_type?: string
          related_event_id?: string | null
          relevance_score?: number | null
          sector: string
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          geo_zone?: string
          headline?: string
          id?: string
          keywords?: string[] | null
          news_type?: string
          related_event_id?: string | null
          relevance_score?: number | null
          sector?: string
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seasonal_news_cache_related_event_id_fkey"
            columns: ["related_event_id"]
            isOneToOne: false
            referencedRelation: "seasonal_context"
            referencedColumns: ["id"]
          },
        ]
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
      seo_page_drafts: {
        Row: {
          content: string
          created_at: string
          domain: string | null
          generation_context: Json | null
          guide_category: string | null
          guide_target: string | null
          guide_tools: Json | null
          id: string
          lateral_links: Json | null
          meta_description: string | null
          meta_title: string | null
          page_type: string
          published_at: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          slug: string
          status: string
          target_keyword: string | null
          template_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          domain?: string | null
          generation_context?: Json | null
          guide_category?: string | null
          guide_target?: string | null
          guide_tools?: Json | null
          id?: string
          lateral_links?: Json | null
          meta_description?: string | null
          meta_title?: string | null
          page_type?: string
          published_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug: string
          status?: string
          target_keyword?: string | null
          template_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          domain?: string | null
          generation_context?: Json | null
          guide_category?: string | null
          guide_target?: string | null
          guide_tools?: Json | null
          id?: string
          lateral_links?: Json | null
          meta_description?: string | null
          meta_title?: string | null
          page_type?: string
          published_at?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          slug?: string
          status?: string
          target_keyword?: string | null
          template_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_page_drafts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "content_prompt_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      serp_benchmark_results: {
        Row: {
          averaged_results: Json
          country: string | null
          created_at: string
          id: string
          language: string | null
          location: string | null
          providers_data: Json
          providers_used: string[]
          query_text: string
          single_hit_penalty: number
          target_domain: string | null
          total_sites_found: number | null
          tracked_site_id: string | null
          user_id: string
        }
        Insert: {
          averaged_results?: Json
          country?: string | null
          created_at?: string
          id?: string
          language?: string | null
          location?: string | null
          providers_data?: Json
          providers_used?: string[]
          query_text: string
          single_hit_penalty?: number
          target_domain?: string | null
          total_sites_found?: number | null
          tracked_site_id?: string | null
          user_id: string
        }
        Update: {
          averaged_results?: Json
          country?: string | null
          created_at?: string
          id?: string
          language?: string | null
          location?: string | null
          providers_data?: Json
          providers_used?: string[]
          query_text?: string
          single_hit_penalty?: number
          target_domain?: string | null
          total_sites_found?: number | null
          tracked_site_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "serp_benchmark_results_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
      serp_intent_analyses: {
        Row: {
          analyzed_at: string
          cost_usd: number | null
          coverage_matrix: Json
          created_at: string
          detected_intents: Json
          domain: string
          expires_at: string
          id: string
          keyword: string
          our_position: number | null
          page_url: string | null
          position_source: string | null
          recommendations: Json
          serp_features: Json
          serp_provider: string
          top_competitors: Json
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          analyzed_at?: string
          cost_usd?: number | null
          coverage_matrix?: Json
          created_at?: string
          detected_intents?: Json
          domain: string
          expires_at?: string
          id?: string
          keyword: string
          our_position?: number | null
          page_url?: string | null
          position_source?: string | null
          recommendations?: Json
          serp_features?: Json
          serp_provider?: string
          top_competitors?: Json
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          analyzed_at?: string
          cost_usd?: number | null
          coverage_matrix?: Json
          created_at?: string
          detected_intents?: Json
          domain?: string
          expires_at?: string
          id?: string
          keyword?: string
          our_position?: number | null
          page_url?: string | null
          position_source?: string | null
          recommendations?: Json
          serp_features?: Json
          serp_provider?: string
          top_competitors?: Json
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "serp_intent_analyses_tracked_site_id_fkey"
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
      short_links: {
        Row: {
          click_count: number
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          target_url: string
        }
        Insert: {
          click_count?: number
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          target_url: string
        }
        Update: {
          click_count?: number
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          target_url?: string
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
          tone_consistency_score: number | null
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
          tone_consistency_score?: number | null
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
          tone_consistency_score?: number | null
          total_pages?: number
          url?: string
          url_filter?: string | null
          user_id?: string
        }
        Relationships: []
      }
      site_identity_sources: {
        Row: {
          created_at: string
          fetched_at: string
          id: string
          mapped_fields: Json
          priority: number
          raw_data: Json
          source_type: string
          tracked_site_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fetched_at?: string
          id?: string
          mapped_fields?: Json
          priority?: number
          raw_data?: Json
          source_type: string
          tracked_site_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          fetched_at?: string
          id?: string
          mapped_fields?: Json
          priority?: number
          raw_data?: Json
          source_type?: string
          tracked_site_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_identity_sources_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
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
          expected_script_hash: string | null
          generated_at: string | null
          generation_error: string | null
          generation_status: string
          id: string
          is_active: boolean
          is_manually_edited: boolean | null
          last_verification_status: string | null
          last_verified_at: string | null
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
          verification_failures_count: number | null
          version: number
        }
        Insert: {
          created_at?: string
          domain_id: string
          expected_script_hash?: string | null
          generated_at?: string | null
          generation_error?: string | null
          generation_status?: string
          id?: string
          is_active?: boolean
          is_manually_edited?: boolean | null
          last_verification_status?: string | null
          last_verified_at?: string | null
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
          verification_failures_count?: number | null
          version?: number
        }
        Update: {
          created_at?: string
          domain_id?: string
          expected_script_hash?: string | null
          generated_at?: string | null
          generation_error?: string | null
          generation_status?: string
          id?: string
          is_active?: boolean
          is_manually_edited?: boolean | null
          last_verification_status?: string | null
          last_verified_at?: string | null
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
          verification_failures_count?: number | null
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
      sitemap_entries: {
        Row: {
          changefreq: string | null
          created_at: string
          domain: string
          id: string
          is_active: boolean | null
          lastmod: string
          loc: string
          page_type: string | null
          priority: number | null
          updated_at: string
        }
        Insert: {
          changefreq?: string | null
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean | null
          lastmod?: string
          loc: string
          page_type?: string | null
          priority?: number | null
          updated_at?: string
        }
        Update: {
          changefreq?: string | null
          created_at?: string
          domain?: string
          id?: string
          is_active?: boolean | null
          lastmod?: string
          loc?: string
          page_type?: string | null
          priority?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      smart_recommendations: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          is_unlocked: boolean
          last_evaluated_at: string | null
          maturity_level: string
          priority: number
          recommendation_data: Json | null
          recommendation_key: string
          status: string
          title: string
          tracked_site_id: string
          unlock_criteria_met: Json | null
          unlock_criteria_required: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_unlocked?: boolean
          last_evaluated_at?: string | null
          maturity_level?: string
          priority?: number
          recommendation_data?: Json | null
          recommendation_key: string
          status?: string
          title?: string
          tracked_site_id: string
          unlock_criteria_met?: Json | null
          unlock_criteria_required?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          is_unlocked?: boolean
          last_evaluated_at?: string | null
          maturity_level?: string
          priority?: number
          recommendation_data?: Json | null
          recommendation_key?: string
          status?: string
          title?: string
          tracked_site_id?: string
          unlock_criteria_met?: Json | null
          unlock_criteria_required?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_recommendations_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          access_token: string | null
          account_id: string | null
          account_name: string | null
          created_at: string
          id: string
          metadata: Json | null
          page_id: string | null
          platform: string
          refresh_token: string | null
          scopes: string[] | null
          status: string
          token_expires_at: string | null
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          page_id?: string | null
          platform: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          account_id?: string | null
          account_name?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          page_id?: string | null
          platform?: string
          refresh_token?: string | null
          scopes?: string[] | null
          status?: string
          token_expires_at?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      social_calendars: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          event_date: string
          event_time: string | null
          id: string
          is_auto_generated: boolean | null
          metadata: Json | null
          platforms: string[] | null
          post_id: string | null
          recurrence: string | null
          recurrence_end: string | null
          seasonal_context_id: string | null
          title: string
          tracked_site_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          event_date: string
          event_time?: string | null
          id?: string
          is_auto_generated?: boolean | null
          metadata?: Json | null
          platforms?: string[] | null
          post_id?: string | null
          recurrence?: string | null
          recurrence_end?: string | null
          seasonal_context_id?: string | null
          title: string
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          event_date?: string
          event_time?: string | null
          id?: string
          is_auto_generated?: boolean | null
          metadata?: Json | null
          platforms?: string[] | null
          post_id?: string | null
          recurrence?: string | null
          recurrence_end?: string | null
          seasonal_context_id?: string | null
          title?: string
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_calendars_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_calendars_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      social_image_assets: {
        Row: {
          canvas_snapshot: Json | null
          created_at: string
          file_name: string
          file_size: number | null
          generation_prompt: string | null
          height: number | null
          id: string
          metadata: Json | null
          mime_type: string | null
          post_id: string | null
          storage_path: string
          user_id: string
          width: number | null
        }
        Insert: {
          canvas_snapshot?: Json | null
          created_at?: string
          file_name: string
          file_size?: number | null
          generation_prompt?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          post_id?: string | null
          storage_path: string
          user_id: string
          width?: number | null
        }
        Update: {
          canvas_snapshot?: Json | null
          created_at?: string
          file_name?: string
          file_size?: number | null
          generation_prompt?: string | null
          height?: number | null
          id?: string
          metadata?: Json | null
          mime_type?: string | null
          post_id?: string | null
          storage_path?: string
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_image_assets_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          platform: string
          state: string
          tracked_site_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          platform: string
          state: string
          tracked_site_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          platform?: string
          state?: string
          tracked_site_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      social_post_metrics: {
        Row: {
          clicks: number | null
          comments: number | null
          created_at: string
          engagement_rate: number | null
          id: string
          impressions: number | null
          likes: number | null
          measured_at: string
          platform: string
          post_id: string
          raw_data: Json | null
          reach: number | null
          saves: number | null
          shares: number | null
        }
        Insert: {
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          measured_at?: string
          platform: string
          post_id: string
          raw_data?: Json | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
        }
        Update: {
          clicks?: number | null
          comments?: number | null
          created_at?: string
          engagement_rate?: number | null
          id?: string
          impressions?: number | null
          likes?: number | null
          measured_at?: string
          platform?: string
          post_id?: string
          raw_data?: Json | null
          reach?: number | null
          saves?: number | null
          shares?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "social_post_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "social_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_posts: {
        Row: {
          canvas_data: Json | null
          content_facebook: string | null
          content_instagram: string | null
          content_linkedin: string | null
          created_at: string
          error_message: string | null
          external_ids: Json | null
          hashtags: string[] | null
          id: string
          image_urls: string[] | null
          mentions: Json | null
          metadata: Json | null
          publish_platforms: string[] | null
          published_at: string | null
          scheduled_at: string | null
          seasonal_context_id: string | null
          smart_link_short: string | null
          smart_link_url: string | null
          source_keyword: string | null
          status: string
          template_id: string | null
          title: string | null
          tracked_site_id: string | null
          updated_at: string
          user_id: string
          utm_params: Json | null
          workbench_item_id: string | null
        }
        Insert: {
          canvas_data?: Json | null
          content_facebook?: string | null
          content_instagram?: string | null
          content_linkedin?: string | null
          created_at?: string
          error_message?: string | null
          external_ids?: Json | null
          hashtags?: string[] | null
          id?: string
          image_urls?: string[] | null
          mentions?: Json | null
          metadata?: Json | null
          publish_platforms?: string[] | null
          published_at?: string | null
          scheduled_at?: string | null
          seasonal_context_id?: string | null
          smart_link_short?: string | null
          smart_link_url?: string | null
          source_keyword?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
          utm_params?: Json | null
          workbench_item_id?: string | null
        }
        Update: {
          canvas_data?: Json | null
          content_facebook?: string | null
          content_instagram?: string | null
          content_linkedin?: string | null
          created_at?: string
          error_message?: string | null
          external_ids?: Json | null
          hashtags?: string[] | null
          id?: string
          image_urls?: string[] | null
          mentions?: Json | null
          metadata?: Json | null
          publish_platforms?: string[] | null
          published_at?: string | null
          scheduled_at?: string | null
          seasonal_context_id?: string | null
          smart_link_short?: string | null
          smart_link_url?: string | null
          source_keyword?: string | null
          status?: string
          template_id?: string | null
          title?: string | null
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
          utm_params?: Json | null
          workbench_item_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_posts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "social_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_posts_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      social_templates: {
        Row: {
          canvas_data: Json
          category: string | null
          created_at: string
          id: string
          is_system: boolean | null
          name: string
          platform: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
          variables: Json | null
        }
        Insert: {
          canvas_data?: Json
          category?: string | null
          created_at?: string
          id?: string
          is_system?: boolean | null
          name: string
          platform?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
          variables?: Json | null
        }
        Update: {
          canvas_data?: Json
          category?: string | null
          created_at?: string
          id?: string
          is_system?: boolean | null
          name?: string
          platform?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
          variables?: Json | null
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
          brand_site_url: string | null
          business_model:
            | Database["public"]["Enums"]["site_business_model"]
            | null
          business_model_confidence: number | null
          business_model_detected_at: string | null
          business_model_source: string | null
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
          eeat_details: Json | null
          eeat_last_audit_at: string | null
          eeat_score: number | null
          entity_type: string | null
          founding_year: number | null
          gmb_city: string | null
          gmb_presence: boolean | null
          google_connection_id: string | null
          id: string
          identity_confidence: number | null
          identity_enriched_at: string | null
          identity_source: string | null
          is_local_business: boolean | null
          is_seasonal: boolean | null
          jargon_distance: Json | null
          last_audit_at: string | null
          last_audit_invalidated_at: string | null
          last_cms_refresh_at: string | null
          last_cocoon_invalidated_at: string | null
          last_cocoon_refresh_at: string | null
          last_saturation_at: string | null
          last_sov_update: string | null
          last_widget_ping: string | null
          legal_structure: string | null
          local_schema_audit: Json | null
          local_schema_status: string | null
          location_detail: string | null
          main_serp_competitor: string | null
          market_sector: string | null
          media_specialties: string[] | null
          mid_term_goal: string | null
          nonprofit_type: string | null
          previous_config: Json
          primary_language: string | null
          primary_use_case: string | null
          products_services: string | null
          seasonality_detected_at: string | null
          seasonality_profile: Json | null
          shared_with_team: boolean
          short_term_goal: string | null
          siren_siret: string | null
          site_name: string
          social_profiles: Json | null
          target_audience: string | null
          target_countries: string[]
          target_segment: string | null
          user_id: string
          voice_dna: Json | null
          weekly_refresh_enabled: boolean
        }
        Insert: {
          address?: string | null
          api_key?: string
          brand_name?: string | null
          brand_site_url?: string | null
          business_model?:
            | Database["public"]["Enums"]["site_business_model"]
            | null
          business_model_confidence?: number | null
          business_model_detected_at?: string | null
          business_model_source?: string | null
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
          eeat_details?: Json | null
          eeat_last_audit_at?: string | null
          eeat_score?: number | null
          entity_type?: string | null
          founding_year?: number | null
          gmb_city?: string | null
          gmb_presence?: boolean | null
          google_connection_id?: string | null
          id?: string
          identity_confidence?: number | null
          identity_enriched_at?: string | null
          identity_source?: string | null
          is_local_business?: boolean | null
          is_seasonal?: boolean | null
          jargon_distance?: Json | null
          last_audit_at?: string | null
          last_audit_invalidated_at?: string | null
          last_cms_refresh_at?: string | null
          last_cocoon_invalidated_at?: string | null
          last_cocoon_refresh_at?: string | null
          last_saturation_at?: string | null
          last_sov_update?: string | null
          last_widget_ping?: string | null
          legal_structure?: string | null
          local_schema_audit?: Json | null
          local_schema_status?: string | null
          location_detail?: string | null
          main_serp_competitor?: string | null
          market_sector?: string | null
          media_specialties?: string[] | null
          mid_term_goal?: string | null
          nonprofit_type?: string | null
          previous_config?: Json
          primary_language?: string | null
          primary_use_case?: string | null
          products_services?: string | null
          seasonality_detected_at?: string | null
          seasonality_profile?: Json | null
          shared_with_team?: boolean
          short_term_goal?: string | null
          siren_siret?: string | null
          site_name?: string
          social_profiles?: Json | null
          target_audience?: string | null
          target_countries?: string[]
          target_segment?: string | null
          user_id: string
          voice_dna?: Json | null
          weekly_refresh_enabled?: boolean
        }
        Update: {
          address?: string | null
          api_key?: string
          brand_name?: string | null
          brand_site_url?: string | null
          business_model?:
            | Database["public"]["Enums"]["site_business_model"]
            | null
          business_model_confidence?: number | null
          business_model_detected_at?: string | null
          business_model_source?: string | null
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
          eeat_details?: Json | null
          eeat_last_audit_at?: string | null
          eeat_score?: number | null
          entity_type?: string | null
          founding_year?: number | null
          gmb_city?: string | null
          gmb_presence?: boolean | null
          google_connection_id?: string | null
          id?: string
          identity_confidence?: number | null
          identity_enriched_at?: string | null
          identity_source?: string | null
          is_local_business?: boolean | null
          is_seasonal?: boolean | null
          jargon_distance?: Json | null
          last_audit_at?: string | null
          last_audit_invalidated_at?: string | null
          last_cms_refresh_at?: string | null
          last_cocoon_invalidated_at?: string | null
          last_cocoon_refresh_at?: string | null
          last_saturation_at?: string | null
          last_sov_update?: string | null
          last_widget_ping?: string | null
          legal_structure?: string | null
          local_schema_audit?: Json | null
          local_schema_status?: string | null
          location_detail?: string | null
          main_serp_competitor?: string | null
          market_sector?: string | null
          media_specialties?: string[] | null
          mid_term_goal?: string | null
          nonprofit_type?: string | null
          previous_config?: Json
          primary_language?: string | null
          primary_use_case?: string | null
          products_services?: string | null
          seasonality_detected_at?: string | null
          seasonality_profile?: Json | null
          shared_with_team?: boolean
          short_term_goal?: string | null
          siren_siret?: string | null
          site_name?: string
          social_profiles?: Json | null
          target_audience?: string | null
          target_countries?: string[]
          target_segment?: string | null
          user_id?: string
          voice_dna?: Json | null
          weekly_refresh_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tracked_sites_google_connection_id_fkey"
            columns: ["google_connection_id"]
            isOneToOne: false
            referencedRelation: "google_ads_connections_public"
            referencedColumns: ["id"]
          },
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
      user_sessions: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          is_active: boolean
          kicked_reason: string | null
          last_heartbeat_at: string
          session_token: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          is_active?: boolean
          kicked_reason?: string | null
          last_heartbeat_at?: string
          session_token: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          is_active?: boolean
          kicked_reason?: string | null
          last_heartbeat_at?: string
          session_token?: string
          user_agent?: string | null
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
      ux_context_analyses: {
        Row: {
          annotations: Json | null
          axis_scores: Json | null
          business_context: Json | null
          created_at: string
          global_score: number | null
          id: string
          model_used: string | null
          page_intent: string | null
          page_url: string
          screenshot_height: number | null
          screenshot_url: string | null
          suggestions: Json | null
          tracked_site_id: string
          user_id: string
        }
        Insert: {
          annotations?: Json | null
          axis_scores?: Json | null
          business_context?: Json | null
          created_at?: string
          global_score?: number | null
          id?: string
          model_used?: string | null
          page_intent?: string | null
          page_url: string
          screenshot_height?: number | null
          screenshot_url?: string | null
          suggestions?: Json | null
          tracked_site_id: string
          user_id: string
        }
        Update: {
          annotations?: Json | null
          axis_scores?: Json | null
          business_context?: Json | null
          created_at?: string
          global_score?: number | null
          id?: string
          model_used?: string | null
          page_intent?: string | null
          page_url?: string
          screenshot_height?: number | null
          screenshot_url?: string | null
          suggestions?: Json | null
          tracked_site_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ux_context_analyses_tracked_site_id_fkey"
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
      workspace_autosaves: {
        Row: {
          created_at: string
          id: string
          state_data: Json
          tracked_site_id: string | null
          updated_at: string
          user_id: string
          workspace_key: string
          workspace_type: string
        }
        Insert: {
          created_at?: string
          id?: string
          state_data?: Json
          tracked_site_id?: string | null
          updated_at?: string
          user_id: string
          workspace_key: string
          workspace_type: string
        }
        Update: {
          created_at?: string
          id?: string
          state_data?: Json
          tracked_site_id?: string | null
          updated_at?: string
          user_id?: string
          workspace_key?: string
          workspace_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_autosaves_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cf_shield_configs_safe: {
        Row: {
          cf_account_id: string | null
          cf_route_pattern: string | null
          cf_worker_name: string | null
          cf_zone_id: string | null
          created_at: string | null
          deployed_at: string | null
          deployment_mode: string | null
          domain: string | null
          has_token: boolean | null
          hits_last_24h: number | null
          hits_total: number | null
          human_sample_rate: number | null
          id: string | null
          last_error: string | null
          last_hit_at: string | null
          last_verified_at: string | null
          status: string | null
          tracked_site_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cf_account_id?: string | null
          cf_route_pattern?: string | null
          cf_worker_name?: string | null
          cf_zone_id?: string | null
          created_at?: string | null
          deployed_at?: string | null
          deployment_mode?: string | null
          domain?: string | null
          has_token?: never
          hits_last_24h?: number | null
          hits_total?: number | null
          human_sample_rate?: number | null
          id?: string | null
          last_error?: string | null
          last_hit_at?: string | null
          last_verified_at?: string | null
          status?: string | null
          tracked_site_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cf_account_id?: string | null
          cf_route_pattern?: string | null
          cf_worker_name?: string | null
          cf_zone_id?: string | null
          created_at?: string | null
          deployed_at?: string | null
          deployment_mode?: string | null
          domain?: string | null
          has_token?: never
          hits_last_24h?: number | null
          hits_total?: number | null
          human_sample_rate?: number | null
          id?: string | null
          last_error?: string | null
          last_hit_at?: string | null
          last_verified_at?: string | null
          status?: string | null
          tracked_site_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cf_shield_configs_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: true
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
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
      editorial_pipeline_status: {
        Row: {
          avg_latency_ms_7d: number | null
          domain: string | null
          runs_last_7d: number | null
          total_cost_usd_7d: number | null
          tracked_site_id: string | null
          use_editorial_pipeline: boolean | null
          user_id: string | null
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
      google_ads_connections_public: {
        Row: {
          account_name: string | null
          created_at: string | null
          customer_id: string | null
          id: string | null
          is_active: boolean | null
          scopes: string[] | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_name?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          is_active?: never
          scopes?: string[] | null
          status?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_name?: string | null
          created_at?: string | null
          customer_id?: string | null
          id?: string | null
          is_active?: never
          scopes?: string[] | null
          status?: never
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
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
      profiles_safe: {
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
          api_key: string | null
          autonomy_level: string | null
          autonomy_raw: Json | null
          autonomy_score: number | null
          avatar_url: string | null
          crawl_month_reset: string | null
          crawl_pages_this_month: number | null
          created_at: string | null
          credits_balance: number | null
          email: string | null
          first_name: string | null
          ga4_property_id: string | null
          gsc_site_url: string | null
          id: string | null
          last_name: string | null
          marina_brand_enabled: boolean | null
          marina_custom_cta_text: string | null
          marina_custom_cta_url: string | null
          marina_custom_intro: string | null
          marina_full_whitelabel: boolean | null
          marina_hide_crawlers_badge: boolean | null
          persona_type: string | null
          plan_type: string | null
          referral_code: string | null
          referred_by: string | null
          social_posts_this_month: number | null
          stripe_subscription_id: string | null
          subscription_expires_at: string | null
          subscription_status: string | null
          updated_at: string | null
          user_id: string | null
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
          api_key?: string | null
          autonomy_level?: string | null
          autonomy_raw?: Json | null
          autonomy_score?: number | null
          avatar_url?: string | null
          crawl_month_reset?: string | null
          crawl_pages_this_month?: number | null
          created_at?: string | null
          credits_balance?: number | null
          email?: string | null
          first_name?: string | null
          ga4_property_id?: string | null
          gsc_site_url?: string | null
          id?: string | null
          last_name?: string | null
          marina_brand_enabled?: boolean | null
          marina_custom_cta_text?: string | null
          marina_custom_cta_url?: string | null
          marina_custom_intro?: string | null
          marina_full_whitelabel?: boolean | null
          marina_hide_crawlers_badge?: boolean | null
          persona_type?: string | null
          plan_type?: string | null
          referral_code?: string | null
          referred_by?: string | null
          social_posts_this_month?: number | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
          updated_at?: string | null
          user_id?: string | null
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
          api_key?: string | null
          autonomy_level?: string | null
          autonomy_raw?: Json | null
          autonomy_score?: number | null
          avatar_url?: string | null
          crawl_month_reset?: string | null
          crawl_pages_this_month?: number | null
          created_at?: string | null
          credits_balance?: number | null
          email?: string | null
          first_name?: string | null
          ga4_property_id?: string | null
          gsc_site_url?: string | null
          id?: string | null
          last_name?: string | null
          marina_brand_enabled?: boolean | null
          marina_custom_cta_text?: string | null
          marina_custom_cta_url?: string | null
          marina_custom_intro?: string | null
          marina_full_whitelabel?: boolean | null
          marina_hide_crawlers_badge?: boolean | null
          persona_type?: string | null
          plan_type?: string | null
          referral_code?: string | null
          referred_by?: string | null
          social_posts_this_month?: number | null
          stripe_subscription_id?: string | null
          subscription_expires_at?: string | null
          subscription_status?: string | null
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
      v_ai_attribution_by_source: {
        Row: {
          ai_source: string | null
          attributed_crawls: number | null
          avg_attribution_weight: number | null
          distinct_pages: number | null
          domain: string | null
          last_visit_at: string | null
          tracked_site_id: string | null
          user_id: string | null
          visits_30d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_attribution_events_tracked_site_id_fkey"
            columns: ["tracked_site_id"]
            isOneToOne: false
            referencedRelation: "tracked_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      v_ai_attribution_by_url: {
        Row: {
          attributed_crawls: number | null
          distinct_sources: number | null
          domain: string | null
          last_visit_at: string | null
          path: string | null
          top_bot: string | null
          top_source: string | null
          tracked_site_id: string | null
          user_id: string | null
          visits_30d: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_attribution_events_tracked_site_id_fkey"
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
      backfill_workbench_spiral_data: {
        Args: { p_domain?: string }
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
      claim_jobs: {
        Args: { batch_size?: number; worker_id?: string }
        Returns: {
          attempts: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          function_name: string
          id: string
          input_payload: Json
          locked_by: string | null
          locked_until: string | null
          max_attempts: number
          plan_type: string | null
          priority: number
          result_data: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "job_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_audit_cache_ttl: { Args: never; Returns: number }
      cleanup_expired_depth_conversations: { Args: never; Returns: undefined }
      cleanup_expired_oauth_states: { Args: never; Returns: undefined }
      cleanup_expired_phone_callbacks: { Args: never; Returns: undefined }
      cleanup_expired_roles: { Args: never; Returns: undefined }
      cleanup_stale_sessions: { Args: never; Returns: number }
      compute_ai_traffic_ratio: {
        Args: { p_tracked_site_id: string; p_window_days?: number }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      downgrade_expired_subscriptions: { Args: never; Returns: number }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_active_seasonal_context: {
        Args: { p_geo?: string; p_sector?: string }
        Returns: {
          days_until_start: number
          description: string
          event_name: string
          event_type: string
          impact_level: string
          is_in_peak: boolean
          is_in_prep: boolean
          peak_keywords: string[]
          prep_weeks_before: number
        }[]
      }
      get_bot_log_summary: {
        Args: { p_tracked_site_id: string }
        Returns: Json
      }
      get_database_size: { Args: never; Returns: Json }
      get_max_sessions: { Args: { p_user_id: string }; Returns: number }
      get_parmenion_target_api_key: {
        Args: { p_domain: string }
        Returns: string
      }
      get_seasonal_news: {
        Args: { p_geo?: string; p_limit?: number; p_sector?: string }
        Returns: {
          created_at: string
          headline: string
          keywords: string[]
          news_type: string
          relevance_score: number
          source_name: string
          source_url: string
          summary: string
        }[]
      }
      get_shared_architect_recommendation: {
        Args: { _cache_key: string }
        Returns: {
          created_at: string
          hit_count: number
          markdown: string
          payload: Json
        }[]
      }
      get_short_link_by_code: {
        Args: { p_code: string }
        Returns: {
          code: string
          expires_at: string
          id: string
          target_url: string
        }[]
      }
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
      get_team_accessible_sites: {
        Args: { p_user_id: string }
        Returns: string[]
      }
      get_team_role: {
        Args: { _member_id: string; _owner_id: string }
        Returns: Database["public"]["Enums"]["team_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_team_permission: {
        Args: { _member_id: string; _owner_id: string; _permission: string }
        Returns: boolean
      }
      increment_short_link_clicks: {
        Args: { link_code: string }
        Returns: undefined
      }
      jsonb_object_keys_count: { Args: { j: Json }; Returns: number }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      owns_tracked_site: { Args: { p_site_id: string }; Returns: boolean }
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
      parmenion_should_skip_phase: {
        Args: { p_domain: string; p_phase: string }
        Returns: Json
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
      resolve_human_sample_rate: {
        Args: { p_user_id: string }
        Returns: number
      }
      resolve_identity_priority: {
        Args: { p_tracked_site_id: string }
        Returns: Json
      }
      resolve_job_priority: { Args: { p_user_id: string }; Returns: number }
      score_spiral_priority: {
        Args: {
          p_domain: string
          p_exclude_assigned?: boolean
          p_lane?: string
          p_limit?: number
          p_user_id: string
        }
        Returns: {
          action_type: string
          cluster_maturity: number
          cluster_name: string
          description: string
          finding_category: string
          item_id: string
          lane: string
          payload: Json
          priority_tag: string
          ring: number
          severity: string
          source_type: string
          spiral_score: number
          target_operation: string
          target_selector: string
          target_url: string
          tier: number
          title: string
        }[]
      }
      score_workbench_priority: {
        Args: {
          p_domain: string
          p_force_content?: boolean
          p_lane?: string
          p_limit?: number
          p_user_id: string
        }
        Returns: {
          action_type: string
          aging_bonus: number
          base_score: number
          created_at: string
          description: string
          finding_category: string
          gate_malus: number
          id: string
          lane: string
          payload: Json
          priority_tag: string
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
      title_similarity: { Args: { a: string; b: string }; Returns: number }
      upsert_analyzed_url: {
        Args: { p_domain: string; p_url: string }
        Returns: undefined
      }
      upsert_keyword_universe: {
        Args: {
          p_domain: string
          p_keywords: Json
          p_source: string
          p_tracked_site_id?: string
          p_user_id: string
        }
        Returns: Json
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
      use_credit: {
        Args: { p_amount?: number; p_description?: string; p_user_id: string }
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
      bot_category:
        | "search_engine"
        | "ai_crawler"
        | "seo_tool"
        | "social"
        | "unknown"
      cms_platform:
        | "wordpress"
        | "shopify"
        | "webflow"
        | "wix"
        | "drupal"
        | "odoo"
        | "prestashop"
        | "crawlers_internal"
        | "dictadevi"
        | "iktracker"
        | "custom_rest"
      content_page_type: "landing" | "product" | "article"
      diagnostic_source_type:
        | "crawl"
        | "audit_tech"
        | "audit_strategic"
        | "cocoon"
        | "proactive_scan"
        | "felix"
        | "ux_context"
        | "serp_benchmark"
      injection_category:
        | "schema_jsonld"
        | "meta_html"
        | "root_files"
        | "html_css_inline"
        | "technical_attributes"
      job_status: "queued" | "processing" | "done" | "failed" | "cancelled"
      log_connector_type:
        | "cloudflare"
        | "agent"
        | "upload"
        | "wpengine"
        | "kinsta"
        | "sftp"
        | "aws"
        | "vercel"
        | "wordpress_plugin"
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
      site_business_model:
        | "saas_b2b"
        | "saas_b2c"
        | "marketplace_b2b"
        | "marketplace_b2c"
        | "marketplace_b2b2c"
        | "ecommerce_b2c"
        | "ecommerce_b2b"
        | "media_publisher"
        | "service_local"
        | "service_agency"
        | "leadgen"
        | "nonprofit"
      team_role: "owner" | "editor" | "auditor"
      workbench_item_status:
        | "pending"
        | "assigned"
        | "in_progress"
        | "deployed"
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
      bot_category: [
        "search_engine",
        "ai_crawler",
        "seo_tool",
        "social",
        "unknown",
      ],
      cms_platform: [
        "wordpress",
        "shopify",
        "webflow",
        "wix",
        "drupal",
        "odoo",
        "prestashop",
        "crawlers_internal",
        "dictadevi",
        "iktracker",
        "custom_rest",
      ],
      content_page_type: ["landing", "product", "article"],
      diagnostic_source_type: [
        "crawl",
        "audit_tech",
        "audit_strategic",
        "cocoon",
        "proactive_scan",
        "felix",
        "ux_context",
        "serp_benchmark",
      ],
      injection_category: [
        "schema_jsonld",
        "meta_html",
        "root_files",
        "html_css_inline",
        "technical_attributes",
      ],
      job_status: ["queued", "processing", "done", "failed", "cancelled"],
      log_connector_type: [
        "cloudflare",
        "agent",
        "upload",
        "wpengine",
        "kinsta",
        "sftp",
        "aws",
        "vercel",
        "wordpress_plugin",
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
      site_business_model: [
        "saas_b2b",
        "saas_b2c",
        "marketplace_b2b",
        "marketplace_b2c",
        "marketplace_b2b2c",
        "ecommerce_b2c",
        "ecommerce_b2b",
        "media_publisher",
        "service_local",
        "service_agency",
        "leadgen",
        "nonprofit",
      ],
      team_role: ["owner", "editor", "auditor"],
      workbench_item_status: [
        "pending",
        "assigned",
        "in_progress",
        "deployed",
        "done",
        "skipped",
      ],
    },
  },
} as const
