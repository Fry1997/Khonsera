// Auto-generated from the live Supabase schema via
//   mcp__Supabase__generate_typescript_types
// Do NOT edit by hand. Regenerate after every migration with:
//   npm run db:types   (or via the Supabase MCP tool)

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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor_id: string | null
          after: Json | null
          before: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          occurred_at: string
          workspace_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          workspace_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          after?: Json | null
          before?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          occurred_at?: string
          workspace_id?: string
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
            foreignKeyName: "audit_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_intents: {
        Row: {
          created_at: string
          currency: string
          estimated_price: number | null
          id: string
          idempotency_key: string | null
          outbound_summary: string | null
          partner_deep_link: string | null
          provider: string | null
          return_summary: string | null
          status: Database["public"]["Enums"]["booking_intent_status"]
          travel_option_id: string | null
          updated_at: string
          visit_plan_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          estimated_price?: number | null
          id?: string
          idempotency_key?: string | null
          outbound_summary?: string | null
          partner_deep_link?: string | null
          provider?: string | null
          return_summary?: string | null
          status?: Database["public"]["Enums"]["booking_intent_status"]
          travel_option_id?: string | null
          updated_at?: string
          visit_plan_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          estimated_price?: number | null
          id?: string
          idempotency_key?: string | null
          outbound_summary?: string | null
          partner_deep_link?: string | null
          provider?: string | null
          return_summary?: string | null
          status?: Database["public"]["Enums"]["booking_intent_status"]
          travel_option_id?: string | null
          updated_at?: string
          visit_plan_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_intents_travel_option_id_fkey"
            columns: ["travel_option_id"]
            isOneToOne: false
            referencedRelation: "travel_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intents_visit_plan_id_fkey"
            columns: ["visit_plan_id"]
            isOneToOne: false
            referencedRelation: "visit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_connections: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string | null
          id: string
          provider: Database["public"]["Enums"]["calendar_provider"]
          provider_account_email: string | null
          refresh_token: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider: Database["public"]["Enums"]["calendar_provider"]
          provider_account_email?: string | null
          refresh_token?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: Database["public"]["Enums"]["calendar_provider"]
          provider_account_email?: string | null
          refresh_token?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_event_links: {
        Row: {
          calendar_connection_id: string | null
          created_at: string
          end_time: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          external_event_id: string | null
          id: string
          idempotency_key: string | null
          provider: Database["public"]["Enums"]["calendar_provider"]
          start_time: string | null
          updated_at: string
          visit_plan_id: string
          workspace_id: string
        }
        Insert: {
          calendar_connection_id?: string | null
          created_at?: string
          end_time?: string | null
          event_type: Database["public"]["Enums"]["calendar_event_type"]
          external_event_id?: string | null
          id?: string
          idempotency_key?: string | null
          provider: Database["public"]["Enums"]["calendar_provider"]
          start_time?: string | null
          updated_at?: string
          visit_plan_id: string
          workspace_id: string
        }
        Update: {
          calendar_connection_id?: string | null
          created_at?: string
          end_time?: string | null
          event_type?: Database["public"]["Enums"]["calendar_event_type"]
          external_event_id?: string | null
          id?: string
          idempotency_key?: string | null
          provider?: Database["public"]["Enums"]["calendar_provider"]
          start_time?: string | null
          updated_at?: string
          visit_plan_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_event_links_calendar_connection_id_fkey"
            columns: ["calendar_connection_id"]
            isOneToOne: false
            referencedRelation: "calendar_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_links_visit_plan_id_fkey"
            columns: ["visit_plan_id"]
            isOneToOne: false
            referencedRelation: "visit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_sites: {
        Row: {
          access_notes: string | null
          address: string | null
          created_at: string
          customer_id: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string | null
          nearest_station_notes: string | null
          parking_notes: string | null
          postcode: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          access_notes?: string | null
          address?: string | null
          created_at?: string
          customer_id: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          nearest_station_notes?: string | null
          parking_notes?: string | null
          postcode?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          access_notes?: string | null
          address?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          nearest_station_notes?: string | null
          parking_notes?: string | null
          postcode?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_sites_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_sites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_records: {
        Row: {
          amount: number | null
          created_at: string
          currency: string
          id: string
          notes: string | null
          receipt_file_path: string | null
          reimbursement_status: Database["public"]["Enums"]["reimbursement_status"]
          type: Database["public"]["Enums"]["expense_type"]
          updated_at: string
          user_id: string
          visit_plan_id: string | null
          workspace_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          receipt_file_path?: string | null
          reimbursement_status?: Database["public"]["Enums"]["reimbursement_status"]
          type: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          user_id: string
          visit_plan_id?: string | null
          workspace_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          notes?: string | null
          receipt_file_path?: string | null
          reimbursement_status?: Database["public"]["Enums"]["reimbursement_status"]
          type?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          user_id?: string
          visit_plan_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_records_visit_plan_id_fkey"
            columns: ["visit_plan_id"]
            isOneToOne: false
            referencedRelation: "visit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_records_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          job_name: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          payload: Json
          run_at: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          job_name: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          job_name?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          payload?: Json
          run_at?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_leg_alternatives: {
        Row: {
          cost_estimate: number | null
          created_at: string
          duration_minutes: number | null
          id: string
          instructions: string | null
          journey_leg_id: string
          leg_type: Database["public"]["Enums"]["leg_type"]
          selected: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          cost_estimate?: number | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          journey_leg_id: string
          leg_type: Database["public"]["Enums"]["leg_type"]
          selected?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          cost_estimate?: number | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          journey_leg_id?: string
          leg_type?: Database["public"]["Enums"]["leg_type"]
          selected?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_leg_alternatives_journey_leg_id_fkey"
            columns: ["journey_leg_id"]
            isOneToOne: false
            referencedRelation: "journey_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_leg_alternatives_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_legs: {
        Row: {
          booking_required: boolean
          created_at: string
          distance_miles: number | null
          duration_minutes: number | null
          end_location_name: string | null
          end_time: string | null
          id: string
          instructions: string | null
          leg_type: Database["public"]["Enums"]["leg_type"]
          platform: string | null
          provider: string | null
          sequence: number
          service_number: string | null
          start_location_name: string | null
          start_time: string | null
          travel_option_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          booking_required?: boolean
          created_at?: string
          distance_miles?: number | null
          duration_minutes?: number | null
          end_location_name?: string | null
          end_time?: string | null
          id?: string
          instructions?: string | null
          leg_type: Database["public"]["Enums"]["leg_type"]
          platform?: string | null
          provider?: string | null
          sequence: number
          service_number?: string | null
          start_location_name?: string | null
          start_time?: string | null
          travel_option_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          booking_required?: boolean
          created_at?: string
          distance_miles?: number | null
          duration_minutes?: number | null
          end_location_name?: string | null
          end_time?: string | null
          id?: string
          instructions?: string | null
          leg_type?: Database["public"]["Enums"]["leg_type"]
          platform?: string | null
          provider?: string | null
          sequence?: number
          service_number?: string | null
          start_location_name?: string | null
          start_time?: string | null
          travel_option_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_legs_travel_option_id_fkey"
            columns: ["travel_option_id"]
            isOneToOne: false
            referencedRelation: "travel_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_legs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          postcode: string | null
          type: Database["public"]["Enums"]["location_type"]
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          postcode?: string | null
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          postcode?: string | null
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          invited_email: string | null
          role: Database["public"]["Enums"]["membership_role"]
          status: Database["public"]["Enums"]["membership_status"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_email?: string | null
          role?: Database["public"]["Enums"]["membership_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      mileage_expenses: {
        Row: {
          calculated_amount: number
          created_at: string
          distance_miles: number
          expense_record_id: string
          id: string
          mileage_rate: number
          updated_at: string
          workspace_id: string
        }
        Insert: {
          calculated_amount: number
          created_at?: string
          distance_miles: number
          expense_record_id: string
          id?: string
          mileage_rate: number
          updated_at?: string
          workspace_id: string
        }
        Update: {
          calculated_amount?: number
          created_at?: string
          distance_miles?: number
          expense_record_id?: string
          id?: string
          mileage_rate?: number
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mileage_expenses_expense_record_id_fkey"
            columns: ["expense_record_id"]
            isOneToOne: true
            referencedRelation: "expense_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mileage_expenses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          created_at: string
          id: string
          payload: Json | null
          status: Database["public"]["Enums"]["notification_status"]
          trigger_time: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          visit_plan_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          payload?: Json | null
          status?: Database["public"]["Enums"]["notification_status"]
          trigger_time: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          visit_plan_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          payload?: Json | null
          status?: Database["public"]["Enums"]["notification_status"]
          trigger_time?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          visit_plan_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_visit_plan_id_fkey"
            columns: ["visit_plan_id"]
            isOneToOne: false
            referencedRelation: "visit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      planning_runs: {
        Row: {
          created_at: string
          generated_at: string
          id: string
          idempotency_key: string | null
          requested_end_time: string | null
          requested_latest_return_time: string | null
          requested_start_time: string | null
          status: Database["public"]["Enums"]["planning_run_status"]
          summary: string | null
          updated_at: string
          visit_plan_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          idempotency_key?: string | null
          requested_end_time?: string | null
          requested_latest_return_time?: string | null
          requested_start_time?: string | null
          status?: Database["public"]["Enums"]["planning_run_status"]
          summary?: string | null
          updated_at?: string
          visit_plan_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          idempotency_key?: string | null
          requested_end_time?: string | null
          requested_latest_return_time?: string | null
          requested_start_time?: string | null
          status?: Database["public"]["Enums"]["planning_run_status"]
          summary?: string | null
          updated_at?: string
          visit_plan_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_runs_visit_plan_id_fkey"
            columns: ["visit_plan_id"]
            isOneToOne: false
            referencedRelation: "visit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planning_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_workspace_id: string | null
          email: string
          full_name: string | null
          id: string
          is_staff: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          email: string
          full_name?: string | null
          id: string
          is_staff?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_staff?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_workspace_fk"
            columns: ["default_workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_trip_edges: {
        Row: {
          from_status: Database["public"]["Enums"]["saved_trip_status"]
          to_status: Database["public"]["Enums"]["saved_trip_status"]
        }
        Insert: {
          from_status: Database["public"]["Enums"]["saved_trip_status"]
          to_status: Database["public"]["Enums"]["saved_trip_status"]
        }
        Update: {
          from_status?: Database["public"]["Enums"]["saved_trip_status"]
          to_status?: Database["public"]["Enums"]["saved_trip_status"]
        }
        Relationships: []
      }
      saved_trips: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          selected_travel_option_id: string | null
          status: Database["public"]["Enums"]["saved_trip_status"]
          travel_day_started_at: string | null
          updated_at: string
          visit_plan_id: string
          workspace_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          selected_travel_option_id?: string | null
          status?: Database["public"]["Enums"]["saved_trip_status"]
          travel_day_started_at?: string | null
          updated_at?: string
          visit_plan_id: string
          workspace_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          selected_travel_option_id?: string | null
          status?: Database["public"]["Enums"]["saved_trip_status"]
          travel_day_started_at?: string | null
          updated_at?: string
          visit_plan_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_trips_selected_travel_option_id_fkey"
            columns: ["selected_travel_option_id"]
            isOneToOne: false
            referencedRelation: "travel_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_trips_visit_plan_id_fkey"
            columns: ["visit_plan_id"]
            isOneToOne: true
            referencedRelation: "visit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_trips_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_bookings: {
        Row: {
          actual_price: number | null
          booked_at: string | null
          booking_intent_id: string
          booking_reference: string | null
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          provider: string | null
          receipt_file_path: string | null
          ticket_status: Database["public"]["Enums"]["ticket_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actual_price?: number | null
          booked_at?: string | null
          booking_intent_id: string
          booking_reference?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          provider?: string | null
          receipt_file_path?: string | null
          ticket_status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actual_price?: number | null
          booked_at?: string | null
          booking_intent_id?: string
          booking_reference?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          provider?: string | null
          receipt_file_path?: string | null
          ticket_status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_bookings_booking_intent_id_fkey"
            columns: ["booking_intent_id"]
            isOneToOne: false
            referencedRelation: "booking_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_bookings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_options: {
        Row: {
          arrive_return_location_at: string | null
          arrive_site_at: string | null
          buffer_minutes: number | null
          confidence_score: number | null
          created_at: string
          currency: string
          feasibility_status: Database["public"]["Enums"]["feasibility_status"]
          id: string
          leave_origin_at: string | null
          leave_site_at: string | null
          meeting_end_at: string | null
          meeting_start_at: string | null
          mode: Database["public"]["Enums"]["travel_option_mode"]
          planning_run_id: string
          recommendation_summary: string | null
          risk_summary: string | null
          total_cost_estimate: number | null
          total_duration_minutes: number | null
          travel_time_minutes: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          arrive_return_location_at?: string | null
          arrive_site_at?: string | null
          buffer_minutes?: number | null
          confidence_score?: number | null
          created_at?: string
          currency?: string
          feasibility_status: Database["public"]["Enums"]["feasibility_status"]
          id?: string
          leave_origin_at?: string | null
          leave_site_at?: string | null
          meeting_end_at?: string | null
          meeting_start_at?: string | null
          mode: Database["public"]["Enums"]["travel_option_mode"]
          planning_run_id: string
          recommendation_summary?: string | null
          risk_summary?: string | null
          total_cost_estimate?: number | null
          total_duration_minutes?: number | null
          travel_time_minutes?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          arrive_return_location_at?: string | null
          arrive_site_at?: string | null
          buffer_minutes?: number | null
          confidence_score?: number | null
          created_at?: string
          currency?: string
          feasibility_status?: Database["public"]["Enums"]["feasibility_status"]
          id?: string
          leave_origin_at?: string | null
          leave_site_at?: string | null
          meeting_end_at?: string | null
          meeting_start_at?: string | null
          mode?: Database["public"]["Enums"]["travel_option_mode"]
          planning_run_id?: string
          recommendation_summary?: string | null
          risk_summary?: string | null
          total_cost_estimate?: number | null
          total_duration_minutes?: number | null
          travel_time_minutes?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_options_planning_run_id_fkey"
            columns: ["planning_run_id"]
            isOneToOne: false
            referencedRelation: "planning_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_options_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_profiles: {
        Row: {
          created_at: string
          default_arrival_buffer_minutes: number
          default_drive_origin_location_id: string | null
          default_rail_origin_location_id: string | null
          default_return_buffer_minutes: number
          default_return_location_id: string | null
          id: string
          mileage_rate: number
          preferred_mode: Database["public"]["Enums"]["travel_mode_preference"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_arrival_buffer_minutes?: number
          default_drive_origin_location_id?: string | null
          default_rail_origin_location_id?: string | null
          default_return_buffer_minutes?: number
          default_return_location_id?: string | null
          id?: string
          mileage_rate?: number
          preferred_mode?: Database["public"]["Enums"]["travel_mode_preference"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_arrival_buffer_minutes?: number
          default_drive_origin_location_id?: string | null
          default_rail_origin_location_id?: string | null
          default_return_buffer_minutes?: number
          default_return_location_id?: string | null
          id?: string
          mileage_rate?: number
          preferred_mode?: Database["public"]["Enums"]["travel_mode_preference"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_profiles_default_drive_origin_location_id_fkey"
            columns: ["default_drive_origin_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_profiles_default_rail_origin_location_id_fkey"
            columns: ["default_rail_origin_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_profiles_default_return_location_id_fkey"
            columns: ["default_return_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_profiles_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_progress: {
        Row: {
          created_at: string
          current_leg_id: string | null
          id: string
          last_known_latitude: number | null
          last_known_longitude: number | null
          last_updated_at: string | null
          saved_trip_id: string
          status: Database["public"]["Enums"]["trip_progress_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          current_leg_id?: string | null
          id?: string
          last_known_latitude?: number | null
          last_known_longitude?: number | null
          last_updated_at?: string | null
          saved_trip_id: string
          status?: Database["public"]["Enums"]["trip_progress_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          current_leg_id?: string | null
          id?: string
          last_known_latitude?: number | null
          last_known_longitude?: number | null
          last_updated_at?: string | null
          saved_trip_id?: string
          status?: Database["public"]["Enums"]["trip_progress_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_progress_current_leg_id_fkey"
            columns: ["current_leg_id"]
            isOneToOne: false
            referencedRelation: "journey_legs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_progress_saved_trip_id_fkey"
            columns: ["saved_trip_id"]
            isOneToOne: true
            referencedRelation: "saved_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_progress_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_checklist_items: {
        Row: {
          created_at: string
          due_at: string | null
          id: string
          label: string
          sort_order: number
          status: Database["public"]["Enums"]["checklist_status"]
          updated_at: string
          visit_plan_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          due_at?: string | null
          id?: string
          label: string
          sort_order?: number
          status?: Database["public"]["Enums"]["checklist_status"]
          updated_at?: string
          visit_plan_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          due_at?: string | null
          id?: string
          label?: string
          sort_order?: number
          status?: Database["public"]["Enums"]["checklist_status"]
          updated_at?: string
          visit_plan_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_checklist_items_visit_plan_id_fkey"
            columns: ["visit_plan_id"]
            isOneToOne: false
            referencedRelation: "visit_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_checklist_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_plans: {
        Row: {
          arrival_buffer_minutes: number
          contact_id: string | null
          created_at: string
          customer_id: string | null
          customer_site_id: string | null
          desired_arrival_time: string | null
          id: string
          latest_departure_from_site_time: string | null
          latest_return_time: string | null
          meeting_duration_minutes: number | null
          notes: string | null
          proposed_end_time: string | null
          proposed_start_time: string | null
          return_buffer_minutes: number
          return_location_id: string | null
          start_location_id: string | null
          status: Database["public"]["Enums"]["visit_status"]
          title: string | null
          travel_mode_preference: Database["public"]["Enums"]["travel_mode_preference"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          arrival_buffer_minutes?: number
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_site_id?: string | null
          desired_arrival_time?: string | null
          id?: string
          latest_departure_from_site_time?: string | null
          latest_return_time?: string | null
          meeting_duration_minutes?: number | null
          notes?: string | null
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          return_buffer_minutes?: number
          return_location_id?: string | null
          start_location_id?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          title?: string | null
          travel_mode_preference?: Database["public"]["Enums"]["travel_mode_preference"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          arrival_buffer_minutes?: number
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_site_id?: string | null
          desired_arrival_time?: string | null
          id?: string
          latest_departure_from_site_time?: string | null
          latest_return_time?: string | null
          meeting_duration_minutes?: number | null
          notes?: string | null
          proposed_end_time?: string | null
          proposed_start_time?: string | null
          return_buffer_minutes?: number
          return_location_id?: string | null
          start_location_id?: string | null
          status?: Database["public"]["Enums"]["visit_status"]
          title?: string | null
          travel_mode_preference?: Database["public"]["Enums"]["travel_mode_preference"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_plans_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_plans_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_plans_customer_site_id_fkey"
            columns: ["customer_site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_plans_return_location_id_fkey"
            columns: ["return_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_plans_start_location_id_fkey"
            columns: ["start_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_plans_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_status_edges: {
        Row: {
          from_status: Database["public"]["Enums"]["visit_status"]
          to_status: Database["public"]["Enums"]["visit_status"]
        }
        Insert: {
          from_status: Database["public"]["Enums"]["visit_status"]
          to_status: Database["public"]["Enums"]["visit_status"]
        }
        Update: {
          from_status?: Database["public"]["Enums"]["visit_status"]
          to_status?: Database["public"]["Enums"]["visit_status"]
        }
        Relationships: []
      }
      workspace_settings: {
        Row: {
          created_at: string
          currency: string
          flags: Json
          timezone: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          flags?: Json
          timezone?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          flags?: Json
          timezone?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          type: Database["public"]["Enums"]["workspace_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          type?: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          type?: Database["public"]["Enums"]["workspace_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
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
      is_workspace_member: { Args: { ws: string }; Returns: boolean }
      saved_trip_transition: {
        Args: {
          p_actor_id: string
          p_metadata?: Json
          p_to_status: Database["public"]["Enums"]["saved_trip_status"]
          p_trip_id: string
        }
        Returns: {
          completed_at: string | null
          created_at: string
          id: string
          selected_travel_option_id: string | null
          status: Database["public"]["Enums"]["saved_trip_status"]
          travel_day_started_at: string | null
          updated_at: string
          visit_plan_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "saved_trips"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      visit_plan_transition: {
        Args: {
          p_actor_id: string
          p_metadata?: Json
          p_to_status: Database["public"]["Enums"]["visit_status"]
          p_visit_id: string
        }
        Returns: {
          arrival_buffer_minutes: number
          contact_id: string | null
          created_at: string
          customer_id: string | null
          customer_site_id: string | null
          desired_arrival_time: string | null
          id: string
          latest_departure_from_site_time: string | null
          latest_return_time: string | null
          meeting_duration_minutes: number | null
          notes: string | null
          proposed_end_time: string | null
          proposed_start_time: string | null
          return_buffer_minutes: number
          return_location_id: string | null
          start_location_id: string | null
          status: Database["public"]["Enums"]["visit_status"]
          title: string | null
          travel_mode_preference: Database["public"]["Enums"]["travel_mode_preference"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "visit_plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      booking_intent_status:
        | "not_started"
        | "opened_partner"
        | "booked"
        | "failed"
        | "abandoned"
      calendar_event_type:
        | "appointment"
        | "outbound_travel"
        | "return_travel"
        | "prep"
        | "buffer"
      calendar_provider: "google" | "microsoft"
      checklist_status: "incomplete" | "complete"
      expense_type:
        | "rail_ticket"
        | "mileage"
        | "parking"
        | "taxi"
        | "hotel"
        | "food"
        | "other"
      feasibility_status:
        | "recommended"
        | "tight"
        | "not_recommended"
        | "not_possible"
      job_status: "pending" | "running" | "completed" | "failed" | "cancelled"
      leg_type:
        | "walk"
        | "drive"
        | "train"
        | "bus"
        | "taxi"
        | "wait"
        | "meeting"
        | "buffer"
      location_type:
        | "home"
        | "office"
        | "station"
        | "hotel"
        | "customer_site"
        | "parking"
        | "other"
      membership_role: "owner" | "admin" | "member" | "viewer"
      membership_status: "active" | "invited" | "suspended"
      notification_status: "pending" | "sent" | "cancelled" | "failed"
      notification_type:
        | "leave_soon"
        | "leave_now"
        | "train_delay"
        | "platform_update"
        | "return_reminder"
        | "receipt_missing"
        | "booking_not_done"
      planning_run_status: "success" | "partial" | "failed"
      reimbursement_status:
        | "draft"
        | "submitted"
        | "approved"
        | "rejected"
        | "reimbursed"
      saved_trip_status:
        | "upcoming"
        | "ready"
        | "in_progress"
        | "completed"
        | "cancelled"
      ticket_status: "booked" | "changed" | "cancelled" | "refunded" | "unknown"
      travel_mode_preference: "rail" | "drive" | "compare" | "mixed"
      travel_option_mode: "rail" | "drive" | "mixed"
      trip_progress_status:
        | "not_started"
        | "on_track"
        | "tight"
        | "delayed"
        | "missed_connection"
        | "completed"
      visit_status:
        | "draft"
        | "checking"
        | "proposed"
        | "confirmed"
        | "booked"
        | "in_progress"
        | "completed"
        | "cancelled"
      workspace_type: "personal" | "organisation"
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
      booking_intent_status: [
        "not_started",
        "opened_partner",
        "booked",
        "failed",
        "abandoned",
      ],
      calendar_event_type: [
        "appointment",
        "outbound_travel",
        "return_travel",
        "prep",
        "buffer",
      ],
      calendar_provider: ["google", "microsoft"],
      checklist_status: ["incomplete", "complete"],
      expense_type: [
        "rail_ticket",
        "mileage",
        "parking",
        "taxi",
        "hotel",
        "food",
        "other",
      ],
      feasibility_status: [
        "recommended",
        "tight",
        "not_recommended",
        "not_possible",
      ],
      job_status: ["pending", "running", "completed", "failed", "cancelled"],
      leg_type: [
        "walk",
        "drive",
        "train",
        "bus",
        "taxi",
        "wait",
        "meeting",
        "buffer",
      ],
      location_type: [
        "home",
        "office",
        "station",
        "hotel",
        "customer_site",
        "parking",
        "other",
      ],
      membership_role: ["owner", "admin", "member", "viewer"],
      membership_status: ["active", "invited", "suspended"],
      notification_status: ["pending", "sent", "cancelled", "failed"],
      notification_type: [
        "leave_soon",
        "leave_now",
        "train_delay",
        "platform_update",
        "return_reminder",
        "receipt_missing",
        "booking_not_done",
      ],
      planning_run_status: ["success", "partial", "failed"],
      reimbursement_status: [
        "draft",
        "submitted",
        "approved",
        "rejected",
        "reimbursed",
      ],
      saved_trip_status: [
        "upcoming",
        "ready",
        "in_progress",
        "completed",
        "cancelled",
      ],
      ticket_status: ["booked", "changed", "cancelled", "refunded", "unknown"],
      travel_mode_preference: ["rail", "drive", "compare", "mixed"],
      travel_option_mode: ["rail", "drive", "mixed"],
      trip_progress_status: [
        "not_started",
        "on_track",
        "tight",
        "delayed",
        "missed_connection",
        "completed",
      ],
      visit_status: [
        "draft",
        "checking",
        "proposed",
        "confirmed",
        "booked",
        "in_progress",
        "completed",
        "cancelled",
      ],
      workspace_type: ["personal", "organisation"],
    },
  },
} as const
