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
      _debug_routes_api: {
        Row: {
          body: Json | null
          created_at: string
          field_mask: string | null
          id: number
          message: string | null
          status: string | null
        }
        Insert: {
          body?: Json | null
          created_at?: string
          field_mask?: string | null
          id?: number
          message?: string | null
          status?: string | null
        }
        Update: {
          body?: Json | null
          created_at?: string
          field_mask?: string | null
          id?: number
          message?: string | null
          status?: string | null
        }
        Relationships: []
      }
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
          itinerary_id: string | null
          outbound_summary: string | null
          paired_booking_id: string | null
          partner_deep_link: string | null
          provider: string | null
          return_summary: string | null
          status: Database["public"]["Enums"]["booking_intent_status"]
          stop_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          estimated_price?: number | null
          id?: string
          idempotency_key?: string | null
          itinerary_id?: string | null
          outbound_summary?: string | null
          paired_booking_id?: string | null
          partner_deep_link?: string | null
          provider?: string | null
          return_summary?: string | null
          status?: Database["public"]["Enums"]["booking_intent_status"]
          stop_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          estimated_price?: number | null
          id?: string
          idempotency_key?: string | null
          itinerary_id?: string | null
          outbound_summary?: string | null
          paired_booking_id?: string | null
          partner_deep_link?: string | null
          provider?: string | null
          return_summary?: string | null
          status?: Database["public"]["Enums"]["booking_intent_status"]
          stop_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_intents_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_intents_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
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
          itinerary_id: string
          provider: Database["public"]["Enums"]["calendar_provider"]
          start_time: string | null
          stop_id: string | null
          transition_id: string | null
          updated_at: string
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
          itinerary_id: string
          provider: Database["public"]["Enums"]["calendar_provider"]
          start_time?: string | null
          stop_id?: string | null
          transition_id?: string | null
          updated_at?: string
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
          itinerary_id?: string
          provider?: Database["public"]["Enums"]["calendar_provider"]
          start_time?: string | null
          stop_id?: string | null
          transition_id?: string | null
          updated_at?: string
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
            foreignKeyName: "calendar_event_links_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_links_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_event_links_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "transitions"
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
      captured_inputs: {
        Row: {
          created_at: string
          created_booking_ids: string[]
          created_itinerary_id: string | null
          created_stop_ids: string[]
          created_transition_ids: string[]
          expires_at: string | null
          id: string
          input_source: string
          original_text: string
          parsed_payload: Json
          parser_version: string
          reviewed_at: string | null
          status: Database["public"]["Enums"]["captured_input_status"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_booking_ids?: string[]
          created_itinerary_id?: string | null
          created_stop_ids?: string[]
          created_transition_ids?: string[]
          expires_at?: string | null
          id?: string
          input_source?: string
          original_text: string
          parsed_payload?: Json
          parser_version: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["captured_input_status"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_booking_ids?: string[]
          created_itinerary_id?: string | null
          created_stop_ids?: string[]
          created_transition_ids?: string[]
          expires_at?: string | null
          id?: string
          input_source?: string
          original_text?: string
          parsed_payload?: Json
          parser_version?: string
          reviewed_at?: string | null
          status?: Database["public"]["Enums"]["captured_input_status"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "captured_inputs_created_itinerary_id_fkey"
            columns: ["created_itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captured_inputs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captured_inputs_workspace_id_fkey"
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
          default_visit_minutes: number | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string | null
          nearest_station_notes: string | null
          parking_notes: string | null
          postcode: string | null
          updated_at: string
          visit_kind: string | null
          workspace_id: string
        }
        Insert: {
          access_notes?: string | null
          address?: string | null
          created_at?: string
          customer_id: string
          default_visit_minutes?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          nearest_station_notes?: string | null
          parking_notes?: string | null
          postcode?: string | null
          updated_at?: string
          visit_kind?: string | null
          workspace_id: string
        }
        Update: {
          access_notes?: string | null
          address?: string | null
          created_at?: string
          customer_id?: string
          default_visit_minutes?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string | null
          nearest_station_notes?: string | null
          parking_notes?: string | null
          postcode?: string | null
          updated_at?: string
          visit_kind?: string | null
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
          itinerary_id: string | null
          notes: string | null
          receipt_file_path: string | null
          reimbursement_status: Database["public"]["Enums"]["reimbursement_status"]
          stop_id: string | null
          type: Database["public"]["Enums"]["expense_type"]
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          itinerary_id?: string | null
          notes?: string | null
          receipt_file_path?: string | null
          reimbursement_status?: Database["public"]["Enums"]["reimbursement_status"]
          stop_id?: string | null
          type: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          currency?: string
          id?: string
          itinerary_id?: string | null
          notes?: string | null
          receipt_file_path?: string | null
          reimbursement_status?: Database["public"]["Enums"]["reimbursement_status"]
          stop_id?: string | null
          type?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_records_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_records_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_records_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      gmail_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          last_scan_at: string | null
          provider_account_email: string | null
          refresh_token: string | null
          status: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_scan_at?: string | null
          provider_account_email?: string | null
          refresh_token?: string | null
          status?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          last_scan_at?: string | null
          provider_account_email?: string | null
          refresh_token?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_connections_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_imported_messages: {
        Row: {
          booking_type: string
          gmail_message_id: string
          id: string
          imported_at: string
          travel_booking_id: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          booking_type: string
          gmail_message_id: string
          id?: string
          imported_at?: string
          travel_booking_id?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          booking_type?: string
          gmail_message_id?: string
          id?: string
          imported_at?: string
          travel_booking_id?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_imported_messages_travel_booking_id_fkey"
            columns: ["travel_booking_id"]
            isOneToOne: false
            referencedRelation: "travel_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_imported_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_imported_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      gmail_scanned_emails: {
        Row: {
          gmail_message_id: string
          id: string
          imported: boolean
          parse_failed: boolean
          parsed_data: Json | null
          parsed_type: string | null
          scanned_at: string
          sender: string | null
          subject: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          gmail_message_id: string
          id?: string
          imported?: boolean
          parse_failed?: boolean
          parsed_data?: Json | null
          parsed_type?: string | null
          scanned_at?: string
          sender?: string | null
          subject?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          gmail_message_id?: string
          id?: string
          imported?: boolean
          parse_failed?: boolean
          parsed_data?: Json | null
          parsed_type?: string | null
          scanned_at?: string
          sender?: string | null
          subject?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gmail_scanned_emails_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gmail_scanned_emails_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      intents: {
        Row: {
          captured_input_id: string | null
          created_at: string
          details: Json
          id: string
          label: string
          last_surfaced_at: string | null
          status: Database["public"]["Enums"]["intent_status"]
          surface_after: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          captured_input_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          label: string
          last_surfaced_at?: string | null
          status?: Database["public"]["Enums"]["intent_status"]
          surface_after?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          captured_input_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          label?: string
          last_surfaced_at?: string | null
          status?: Database["public"]["Enums"]["intent_status"]
          surface_after?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intents_captured_input_id_fkey"
            columns: ["captured_input_id"]
            isOneToOne: false
            referencedRelation: "captured_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "intents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      itineraries: {
        Row: {
          created_at: string
          date_end: string
          date_start: string
          excluded_modes: string[]
          id: string
          luggage_for_trip: string | null
          notes: string | null
          status: Database["public"]["Enums"]["itinerary_status"]
          title: string | null
          travel_strategy: string | null
          trip_purpose: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          date_end: string
          date_start: string
          excluded_modes?: string[]
          id?: string
          luggage_for_trip?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["itinerary_status"]
          title?: string | null
          travel_strategy?: string | null
          trip_purpose?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          date_end?: string
          date_start?: string
          excluded_modes?: string[]
          id?: string
          luggage_for_trip?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["itinerary_status"]
          title?: string | null
          travel_strategy?: string | null
          trip_purpose?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itineraries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itineraries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_status_edges: {
        Row: {
          from_status: Database["public"]["Enums"]["itinerary_status"]
          to_status: Database["public"]["Enums"]["itinerary_status"]
        }
        Insert: {
          from_status: Database["public"]["Enums"]["itinerary_status"]
          to_status: Database["public"]["Enums"]["itinerary_status"]
        }
        Update: {
          from_status?: Database["public"]["Enums"]["itinerary_status"]
          to_status?: Database["public"]["Enums"]["itinerary_status"]
        }
        Relationships: []
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
          transition_id: string | null
          travel_option_id: string | null
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
          transition_id?: string | null
          travel_option_id?: string | null
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
          transition_id?: string | null
          travel_option_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_legs_transition_id_fkey"
            columns: ["transition_id"]
            isOneToOne: false
            referencedRelation: "transitions"
            referencedColumns: ["id"]
          },
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
          external_url: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          type: Database["public"]["Enums"]["location_type"]
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          type?: Database["public"]["Enums"]["location_type"]
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          external_url?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
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
          itinerary_id: string
          payload: Json | null
          status: Database["public"]["Enums"]["notification_status"]
          trigger_time: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          itinerary_id: string
          payload?: Json | null
          status?: Database["public"]["Enums"]["notification_status"]
          trigger_time: string
          type: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          itinerary_id?: string
          payload?: Json | null
          status?: Database["public"]["Enums"]["notification_status"]
          trigger_time?: string
          type?: Database["public"]["Enums"]["notification_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
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
          itinerary_id: string | null
          requested_end_time: string | null
          requested_start_time: string | null
          status: Database["public"]["Enums"]["planning_run_status"]
          summary: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          generated_at?: string
          id?: string
          idempotency_key?: string | null
          itinerary_id?: string | null
          requested_end_time?: string | null
          requested_start_time?: string | null
          status?: Database["public"]["Enums"]["planning_run_status"]
          summary?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          generated_at?: string
          id?: string
          idempotency_key?: string | null
          itinerary_id?: string | null
          requested_end_time?: string | null
          requested_start_time?: string | null
          status?: Database["public"]["Enums"]["planning_run_status"]
          summary?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planning_runs_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
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
          is_admin: boolean
          is_staff: boolean
          is_super_user: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          email: string
          full_name?: string | null
          id: string
          is_admin?: boolean
          is_staff?: boolean
          is_super_user?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_workspace_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean
          is_staff?: boolean
          is_super_user?: boolean
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
      rail_named_route_segments: {
        Row: {
          created_at: string | null
          encoded_polyline: string
          from_station_code: string | null
          from_station_name: string
          id: string
          operator: string | null
          osm_relation_id: number
          point_count: number | null
          route_name: string | null
          to_station_code: string | null
          to_station_name: string
        }
        Insert: {
          created_at?: string | null
          encoded_polyline: string
          from_station_code?: string | null
          from_station_name: string
          id?: string
          operator?: string | null
          osm_relation_id: number
          point_count?: number | null
          route_name?: string | null
          to_station_code?: string | null
          to_station_name: string
        }
        Update: {
          created_at?: string | null
          encoded_polyline?: string
          from_station_code?: string | null
          from_station_name?: string
          id?: string
          operator?: string | null
          osm_relation_id?: number
          point_count?: number | null
          route_name?: string | null
          to_station_code?: string | null
          to_station_name?: string
        }
        Relationships: []
      }
      rail_network_edges: {
        Row: {
          from_lat: number
          from_lng: number
          id: number
          to_lat: number
          to_lng: number
        }
        Insert: {
          from_lat: number
          from_lng: number
          id?: number
          to_lat: number
          to_lng: number
        }
        Update: {
          from_lat?: number
          from_lng?: number
          id?: number
          to_lat?: number
          to_lng?: number
        }
        Relationships: []
      }
      rail_route_cache: {
        Row: {
          encoded_polyline: string
          fetched_at: string
          from_station_code: string
          point_count: number
          to_station_code: string
        }
        Insert: {
          encoded_polyline: string
          fetched_at?: string
          from_station_code: string
          point_count?: number
          to_station_code: string
        }
        Update: {
          encoded_polyline?: string
          fetched_at?: string
          from_station_code?: string
          point_count?: number
          to_station_code?: string
        }
        Relationships: []
      }
      route_preview_cache: {
        Row: {
          computed_at: string
          distance_miles: number | null
          duration_minutes: number | null
          from_stop_id: string
          mode: string
          to_stop_id: string
        }
        Insert: {
          computed_at?: string
          distance_miles?: number | null
          duration_minutes?: number | null
          from_stop_id: string
          mode: string
          to_stop_id: string
        }
        Update: {
          computed_at?: string
          distance_miles?: number | null
          duration_minutes?: number | null
          from_stop_id?: string
          mode?: string
          to_stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_preview_cache_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_preview_cache_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
        ]
      }
      standing_facts: {
        Row: {
          active: boolean
          created_at: string
          details: Json
          fact_kind: string
          id: string
          label: string
          updated_at: string
          user_id: string
          valid_from: string | null
          valid_to: string | null
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          details?: Json
          fact_kind: string
          id?: string
          label: string
          updated_at?: string
          user_id: string
          valid_from?: string | null
          valid_to?: string | null
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          details?: Json
          fact_kind?: string
          id?: string
          label?: string
          updated_at?: string
          user_id?: string
          valid_from?: string | null
          valid_to?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "standing_facts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standing_facts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stopovers: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_site_id: string | null
          duration_minutes: number
          from_stop_id: string
          id: string
          itinerary_id: string
          location_id: string | null
          metadata: Json
          title: string | null
          to_stop_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_site_id?: string | null
          duration_minutes?: number
          from_stop_id: string
          id?: string
          itinerary_id: string
          location_id?: string | null
          metadata?: Json
          title?: string | null
          to_stop_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_site_id?: string | null
          duration_minutes?: number
          from_stop_id?: string
          id?: string
          itinerary_id?: string
          location_id?: string | null
          metadata?: Json
          title?: string | null
          to_stop_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stopovers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stopovers_customer_site_id_fkey"
            columns: ["customer_site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stopovers_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stopovers_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stopovers_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stopovers_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stopovers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      stops: {
        Row: {
          arrival_buffer_minutes: number | null
          captured_input_id: string | null
          commitment: string
          commitment_state: Database["public"]["Enums"]["fact_commitment_state"]
          confidence: Database["public"]["Enums"]["fact_confidence"]
          contact_id: string | null
          created_at: string
          customer_id: string | null
          customer_site_id: string | null
          duration_minutes: number | null
          end_time: string | null
          external_reference: string | null
          external_url: string | null
          id: string
          is_time_fixed: boolean
          itinerary_id: string
          location_id: string | null
          max_duration_minutes: number | null
          metadata: Json | null
          min_duration_minutes: number | null
          notes: string | null
          purpose: string | null
          receipt_file_path: string | null
          sequence: number
          source: Database["public"]["Enums"]["fact_source"]
          start_time: string | null
          title: string | null
          transport_hub_id: string | null
          type: Database["public"]["Enums"]["stop_type"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          arrival_buffer_minutes?: number | null
          captured_input_id?: string | null
          commitment?: string
          commitment_state?: Database["public"]["Enums"]["fact_commitment_state"]
          confidence?: Database["public"]["Enums"]["fact_confidence"]
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_site_id?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          external_reference?: string | null
          external_url?: string | null
          id?: string
          is_time_fixed?: boolean
          itinerary_id: string
          location_id?: string | null
          max_duration_minutes?: number | null
          metadata?: Json | null
          min_duration_minutes?: number | null
          notes?: string | null
          purpose?: string | null
          receipt_file_path?: string | null
          sequence: number
          source?: Database["public"]["Enums"]["fact_source"]
          start_time?: string | null
          title?: string | null
          transport_hub_id?: string | null
          type: Database["public"]["Enums"]["stop_type"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          arrival_buffer_minutes?: number | null
          captured_input_id?: string | null
          commitment?: string
          commitment_state?: Database["public"]["Enums"]["fact_commitment_state"]
          confidence?: Database["public"]["Enums"]["fact_confidence"]
          contact_id?: string | null
          created_at?: string
          customer_id?: string | null
          customer_site_id?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          external_reference?: string | null
          external_url?: string | null
          id?: string
          is_time_fixed?: boolean
          itinerary_id?: string
          location_id?: string | null
          max_duration_minutes?: number | null
          metadata?: Json | null
          min_duration_minutes?: number | null
          notes?: string | null
          purpose?: string | null
          receipt_file_path?: string | null
          sequence?: number
          source?: Database["public"]["Enums"]["fact_source"]
          start_time?: string | null
          title?: string | null
          transport_hub_id?: string | null
          type?: Database["public"]["Enums"]["stop_type"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stops_captured_input_id_fkey"
            columns: ["captured_input_id"]
            isOneToOne: false
            referencedRelation: "captured_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_customer_site_id_fkey"
            columns: ["customer_site_id"]
            isOneToOne: false
            referencedRelation: "customer_sites"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_transport_hub_id_fkey"
            columns: ["transport_hub_id"]
            isOneToOne: false
            referencedRelation: "transport_hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stops_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transitions: {
        Row: {
          captured_input_id: string | null
          commitment_state: Database["public"]["Enums"]["fact_commitment_state"]
          computed_duration_minutes: number | null
          confidence: Database["public"]["Enums"]["fact_confidence"]
          created_at: string
          distance_miles: number | null
          end_time: string | null
          from_stop_id: string
          id: string
          is_locked: boolean
          itinerary_id: string
          mode: Database["public"]["Enums"]["transition_mode"]
          notes: string | null
          override_locked: boolean
          overview_polyline: string | null
          source: Database["public"]["Enums"]["fact_source"]
          start_time: string | null
          to_stop_id: string
          updated_at: string
          user_mode_override:
            | Database["public"]["Enums"]["transition_mode"]
            | null
          workspace_id: string
        }
        Insert: {
          captured_input_id?: string | null
          commitment_state?: Database["public"]["Enums"]["fact_commitment_state"]
          computed_duration_minutes?: number | null
          confidence?: Database["public"]["Enums"]["fact_confidence"]
          created_at?: string
          distance_miles?: number | null
          end_time?: string | null
          from_stop_id: string
          id?: string
          is_locked?: boolean
          itinerary_id: string
          mode: Database["public"]["Enums"]["transition_mode"]
          notes?: string | null
          override_locked?: boolean
          overview_polyline?: string | null
          source?: Database["public"]["Enums"]["fact_source"]
          start_time?: string | null
          to_stop_id: string
          updated_at?: string
          user_mode_override?:
            | Database["public"]["Enums"]["transition_mode"]
            | null
          workspace_id: string
        }
        Update: {
          captured_input_id?: string | null
          commitment_state?: Database["public"]["Enums"]["fact_commitment_state"]
          computed_duration_minutes?: number | null
          confidence?: Database["public"]["Enums"]["fact_confidence"]
          created_at?: string
          distance_miles?: number | null
          end_time?: string | null
          from_stop_id?: string
          id?: string
          is_locked?: boolean
          itinerary_id?: string
          mode?: Database["public"]["Enums"]["transition_mode"]
          notes?: string | null
          override_locked?: boolean
          overview_polyline?: string | null
          source?: Database["public"]["Enums"]["fact_source"]
          start_time?: string | null
          to_stop_id?: string
          updated_at?: string
          user_mode_override?:
            | Database["public"]["Enums"]["transition_mode"]
            | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transitions_captured_input_id_fkey"
            columns: ["captured_input_id"]
            isOneToOne: false
            referencedRelation: "captured_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transitions_from_stop_id_fkey"
            columns: ["from_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transitions_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transitions_to_stop_id_fkey"
            columns: ["to_stop_id"]
            isOneToOne: false
            referencedRelation: "stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transitions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_hubs: {
        Row: {
          city: string | null
          code: string
          country: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["transport_hub_kind"]
          latitude: number
          longitude: number
          name: string
          subdivision: string | null
          timezone: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          code: string
          country: string
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["transport_hub_kind"]
          latitude: number
          longitude: number
          name: string
          subdivision?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          code?: string
          country?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["transport_hub_kind"]
          latitude?: number
          longitude?: number
          name?: string
          subdivision?: string | null
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      travel_booking_segment_stops: {
        Row: {
          actual_arrival_at: string | null
          actual_departure_at: string | null
          created_at: string
          hub_id: string | null
          hub_name_snapshot: string
          id: string
          notes: string | null
          platform: string | null
          scheduled_arrival_at: string | null
          scheduled_departure_at: string | null
          segment_id: string
          sequence: number
          source: string
          source_ref: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actual_arrival_at?: string | null
          actual_departure_at?: string | null
          created_at?: string
          hub_id?: string | null
          hub_name_snapshot: string
          id?: string
          notes?: string | null
          platform?: string | null
          scheduled_arrival_at?: string | null
          scheduled_departure_at?: string | null
          segment_id: string
          sequence: number
          source?: string
          source_ref?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actual_arrival_at?: string | null
          actual_departure_at?: string | null
          created_at?: string
          hub_id?: string | null
          hub_name_snapshot?: string
          id?: string
          notes?: string | null
          platform?: string | null
          scheduled_arrival_at?: string | null
          scheduled_departure_at?: string | null
          segment_id?: string
          sequence?: number
          source?: string
          source_ref?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_booking_segment_stops_hub_id_fkey"
            columns: ["hub_id"]
            isOneToOne: false
            referencedRelation: "transport_hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_booking_segment_stops_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "travel_booking_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_booking_segment_stops_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_booking_segments: {
        Row: {
          actual_arrival_at: string | null
          actual_departure_at: string | null
          arrival_at: string
          barcode_data: string | null
          barcode_ref: string | null
          calling_points: Json | null
          coach: string | null
          created_at: string
          departure_at: string
          from_hub_id: string | null
          from_location_name: string
          from_station_code: string | null
          id: string
          notes: string | null
          operator: string | null
          platform_arr: string | null
          platform_dep: string | null
          route_restriction: string | null
          seat: string | null
          sequence: number
          service_uid: string | null
          source: string
          source_ref: string | null
          ticket_type: string | null
          to_hub_id: string | null
          to_location_name: string
          to_station_code: string | null
          train_number: string | null
          travel_booking_id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actual_arrival_at?: string | null
          actual_departure_at?: string | null
          arrival_at: string
          barcode_data?: string | null
          barcode_ref?: string | null
          calling_points?: Json | null
          coach?: string | null
          created_at?: string
          departure_at: string
          from_hub_id?: string | null
          from_location_name: string
          from_station_code?: string | null
          id?: string
          notes?: string | null
          operator?: string | null
          platform_arr?: string | null
          platform_dep?: string | null
          route_restriction?: string | null
          seat?: string | null
          sequence: number
          service_uid?: string | null
          source?: string
          source_ref?: string | null
          ticket_type?: string | null
          to_hub_id?: string | null
          to_location_name: string
          to_station_code?: string | null
          train_number?: string | null
          travel_booking_id: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actual_arrival_at?: string | null
          actual_departure_at?: string | null
          arrival_at?: string
          barcode_data?: string | null
          barcode_ref?: string | null
          calling_points?: Json | null
          coach?: string | null
          created_at?: string
          departure_at?: string
          from_hub_id?: string | null
          from_location_name?: string
          from_station_code?: string | null
          id?: string
          notes?: string | null
          operator?: string | null
          platform_arr?: string | null
          platform_dep?: string | null
          route_restriction?: string | null
          seat?: string | null
          sequence?: number
          service_uid?: string | null
          source?: string
          source_ref?: string | null
          ticket_type?: string | null
          to_hub_id?: string | null
          to_location_name?: string
          to_station_code?: string | null
          train_number?: string | null
          travel_booking_id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_booking_segments_from_hub_id_fkey"
            columns: ["from_hub_id"]
            isOneToOne: false
            referencedRelation: "transport_hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_booking_segments_to_hub_id_fkey"
            columns: ["to_hub_id"]
            isOneToOne: false
            referencedRelation: "transport_hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_booking_segments_travel_booking_id_fkey"
            columns: ["travel_booking_id"]
            isOneToOne: false
            referencedRelation: "travel_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_booking_segments_workspace_id_fkey"
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
          arrival_at: string | null
          arrival_location_id: string | null
          booked_at: string | null
          booking_intent_id: string
          booking_reference: string | null
          captured_input_id: string | null
          commitment_state: Database["public"]["Enums"]["fact_commitment_state"]
          confidence: Database["public"]["Enums"]["fact_confidence"]
          created_at: string
          currency: string
          departure_at: string | null
          departure_location_id: string | null
          id: string
          idempotency_key: string | null
          provider: string | null
          receipt_file_path: string | null
          seat_reservation: string | null
          source: Database["public"]["Enums"]["fact_source"]
          station_buffer_minutes: number
          ticket_status: Database["public"]["Enums"]["ticket_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          actual_price?: number | null
          arrival_at?: string | null
          arrival_location_id?: string | null
          booked_at?: string | null
          booking_intent_id: string
          booking_reference?: string | null
          captured_input_id?: string | null
          commitment_state?: Database["public"]["Enums"]["fact_commitment_state"]
          confidence?: Database["public"]["Enums"]["fact_confidence"]
          created_at?: string
          currency?: string
          departure_at?: string | null
          departure_location_id?: string | null
          id?: string
          idempotency_key?: string | null
          provider?: string | null
          receipt_file_path?: string | null
          seat_reservation?: string | null
          source?: Database["public"]["Enums"]["fact_source"]
          station_buffer_minutes?: number
          ticket_status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          actual_price?: number | null
          arrival_at?: string | null
          arrival_location_id?: string | null
          booked_at?: string | null
          booking_intent_id?: string
          booking_reference?: string | null
          captured_input_id?: string | null
          commitment_state?: Database["public"]["Enums"]["fact_commitment_state"]
          confidence?: Database["public"]["Enums"]["fact_confidence"]
          created_at?: string
          currency?: string
          departure_at?: string | null
          departure_location_id?: string | null
          id?: string
          idempotency_key?: string | null
          provider?: string | null
          receipt_file_path?: string | null
          seat_reservation?: string | null
          source?: Database["public"]["Enums"]["fact_source"]
          station_buffer_minutes?: number
          ticket_status?: Database["public"]["Enums"]["ticket_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_bookings_arrival_location_id_fkey"
            columns: ["arrival_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_bookings_booking_intent_id_fkey"
            columns: ["booking_intent_id"]
            isOneToOne: false
            referencedRelation: "booking_intents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_bookings_captured_input_id_fkey"
            columns: ["captured_input_id"]
            isOneToOne: false
            referencedRelation: "captured_inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_bookings_departure_location_id_fkey"
            columns: ["departure_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
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
          overview_polyline: string | null
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
          overview_polyline?: string | null
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
          overview_polyline?: string | null
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
          default_flight_origin_transport_hub_id: string | null
          default_office_location_id: string | null
          default_rail_origin_location_id: string | null
          default_rail_origin_transport_hub_id: string | null
          default_return_buffer_minutes: number
          default_return_location_id: string | null
          id: string
          luggage_default: string
          max_taxi_fare_pence: number
          mileage_rate: number
          minimum_buffer_minutes: number
          preferred_mode: Database["public"]["Enums"]["travel_mode_preference"]
          updated_at: string
          user_id: string
          walking_threshold_minutes: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_arrival_buffer_minutes?: number
          default_drive_origin_location_id?: string | null
          default_flight_origin_transport_hub_id?: string | null
          default_office_location_id?: string | null
          default_rail_origin_location_id?: string | null
          default_rail_origin_transport_hub_id?: string | null
          default_return_buffer_minutes?: number
          default_return_location_id?: string | null
          id?: string
          luggage_default?: string
          max_taxi_fare_pence?: number
          mileage_rate?: number
          minimum_buffer_minutes?: number
          preferred_mode?: Database["public"]["Enums"]["travel_mode_preference"]
          updated_at?: string
          user_id: string
          walking_threshold_minutes?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_arrival_buffer_minutes?: number
          default_drive_origin_location_id?: string | null
          default_flight_origin_transport_hub_id?: string | null
          default_office_location_id?: string | null
          default_rail_origin_location_id?: string | null
          default_rail_origin_transport_hub_id?: string | null
          default_return_buffer_minutes?: number
          default_return_location_id?: string | null
          id?: string
          luggage_default?: string
          max_taxi_fare_pence?: number
          mileage_rate?: number
          minimum_buffer_minutes?: number
          preferred_mode?: Database["public"]["Enums"]["travel_mode_preference"]
          updated_at?: string
          user_id?: string
          walking_threshold_minutes?: number
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
            foreignKeyName: "travel_profiles_default_flight_origin_transport_hub_id_fkey"
            columns: ["default_flight_origin_transport_hub_id"]
            isOneToOne: false
            referencedRelation: "transport_hubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_profiles_default_office_location_id_fkey"
            columns: ["default_office_location_id"]
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
            foreignKeyName: "travel_profiles_default_rail_origin_transport_hub_id_fkey"
            columns: ["default_rail_origin_transport_hub_id"]
            isOneToOne: false
            referencedRelation: "transport_hubs"
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
      bump_stop_sequences: {
        Args: {
          p_from_sequence: number
          p_itinerary_id: string
          p_workspace_id: string
        }
        Returns: undefined
      }
      bytea_to_text: { Args: { data: string }; Returns: string }
      customer_sites_within_km: {
        Args: {
          excluded_site_ids?: string[]
          origin_lat: number
          origin_lng: number
          radius_km: number
          ws_id: string
        }
        Returns: {
          address: string
          customer_id: string
          distance_km: number
          id: string
          latitude: number
          longitude: number
          name: string
        }[]
      }
      earth: { Args: never; Returns: number }
      http: {
        Args: { request: Database["public"]["CompositeTypes"]["http_request"] }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "http_request"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_delete:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_get:
        | {
            Args: { uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_head: {
        Args: { uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_header: {
        Args: { field: string; value: string }
        Returns: Database["public"]["CompositeTypes"]["http_header"]
        SetofOptions: {
          from: "*"
          to: "http_header"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_list_curlopt: {
        Args: never
        Returns: {
          curlopt: string
          value: string
        }[]
      }
      http_patch: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_post:
        | {
            Args: { content: string; content_type: string; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: { data: Json; uri: string }
            Returns: Database["public"]["CompositeTypes"]["http_response"]
            SetofOptions: {
              from: "*"
              to: "http_response"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      http_put: {
        Args: { content: string; content_type: string; uri: string }
        Returns: Database["public"]["CompositeTypes"]["http_response"]
        SetofOptions: {
          from: "*"
          to: "http_response"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      http_reset_curlopt: { Args: never; Returns: boolean }
      http_set_curlopt: {
        Args: { curlopt: string; value: string }
        Returns: boolean
      }
      is_workspace_member: { Args: { ws: string }; Returns: boolean }
      itinerary_transition: {
        Args: {
          p_actor_id: string
          p_itinerary_id: string
          p_metadata?: Json
          p_to_status: Database["public"]["Enums"]["itinerary_status"]
        }
        Returns: {
          created_at: string
          date_end: string
          date_start: string
          id: string
          luggage_for_trip: string | null
          notes: string | null
          status: Database["public"]["Enums"]["itinerary_status"]
          title: string | null
          trip_purpose: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "itineraries"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      seed_demo_workspace: { Args: { p_user_id: string }; Returns: string }
      seed_route_segments: { Args: { payload: Json }; Returns: number }
      text_to_bytea: { Args: { data: string }; Returns: string }
      urlencode:
        | { Args: { data: Json }; Returns: string }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { string: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.urlencode(string => bytea), public.urlencode(string => varchar). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
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
      captured_input_status:
        | "pending_review"
        | "confirmed"
        | "corrected"
        | "rejected"
        | "expired"
      checklist_status: "incomplete" | "complete"
      expense_type:
        | "rail_ticket"
        | "mileage"
        | "parking"
        | "taxi"
        | "hotel"
        | "food"
        | "other"
      fact_commitment_state:
        | "raw"
        | "sorted"
        | "planned"
        | "booked"
        | "live"
        | "done"
        | "cancelled"
      fact_confidence: "high" | "medium" | "low"
      fact_source:
        | "manual"
        | "captured"
        | "parsed_email"
        | "calendar"
        | "partner_api"
        | "inferred"
        | "system"
      feasibility_status:
        | "recommended"
        | "tight"
        | "not_recommended"
        | "not_possible"
      intent_status:
        | "open"
        | "in_progress"
        | "fulfilled"
        | "abandoned"
        | "snoozed"
      itinerary_status:
        | "draft"
        | "planning"
        | "planned"
        | "in_progress"
        | "completed"
        | "cancelled"
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
      stop_type:
        | "start"
        | "end"
        | "appointment"
        | "accommodation"
        | "event"
        | "meal"
        | "transport_booked"
        | "transit_arrival"
        | "other"
        | "transit_departure"
        | "stopover"
        | "transit_changeover"
      ticket_status: "booked" | "changed" | "cancelled" | "refunded" | "unknown"
      transition_mode:
        | "walk"
        | "drive"
        | "taxi"
        | "bus"
        | "tube"
        | "train"
        | "flight"
        | "mixed"
      transport_hub_kind: "rail_station" | "airport"
      travel_mode_preference:
        | "rail"
        | "drive"
        | "compare"
        | "mixed"
        | "walk"
        | "taxi"
        | "no_preference"
      travel_option_mode: "rail" | "drive" | "mixed"
      workspace_type: "personal" | "organisation"
    }
    CompositeTypes: {
      http_header: {
        field: string | null
        value: string | null
      }
      http_request: {
        method: unknown
        uri: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content_type: string | null
        content: string | null
      }
      http_response: {
        status: number | null
        content_type: string | null
        headers: Database["public"]["CompositeTypes"]["http_header"][] | null
        content: string | null
      }
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
      captured_input_status: [
        "pending_review",
        "confirmed",
        "corrected",
        "rejected",
        "expired",
      ],
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
      fact_commitment_state: [
        "raw",
        "sorted",
        "planned",
        "booked",
        "live",
        "done",
        "cancelled",
      ],
      fact_confidence: ["high", "medium", "low"],
      fact_source: [
        "manual",
        "captured",
        "parsed_email",
        "calendar",
        "partner_api",
        "inferred",
        "system",
      ],
      feasibility_status: [
        "recommended",
        "tight",
        "not_recommended",
        "not_possible",
      ],
      intent_status: [
        "open",
        "in_progress",
        "fulfilled",
        "abandoned",
        "snoozed",
      ],
      itinerary_status: [
        "draft",
        "planning",
        "planned",
        "in_progress",
        "completed",
        "cancelled",
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
      stop_type: [
        "start",
        "end",
        "appointment",
        "accommodation",
        "event",
        "meal",
        "transport_booked",
        "transit_arrival",
        "other",
        "transit_departure",
        "stopover",
        "transit_changeover",
      ],
      ticket_status: ["booked", "changed", "cancelled", "refunded", "unknown"],
      transition_mode: [
        "walk",
        "drive",
        "taxi",
        "bus",
        "tube",
        "train",
        "flight",
        "mixed",
      ],
      transport_hub_kind: ["rail_station", "airport"],
      travel_mode_preference: [
        "rail",
        "drive",
        "compare",
        "mixed",
        "walk",
        "taxi",
        "no_preference",
      ],
      travel_option_mode: ["rail", "drive", "mixed"],
      workspace_type: ["personal", "organisation"],
    },
  },
} as const
