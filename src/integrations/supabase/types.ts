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
      alert_rules: {
        Row: {
          city_filter: string | null
          created_at: string
          id: string
          is_active: boolean
          max_price_per_sqm: number | null
          name: string
        }
        Insert: {
          city_filter?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_price_per_sqm?: number | null
          name: string
        }
        Update: {
          city_filter?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          max_price_per_sqm?: number | null
          name?: string
        }
        Relationships: []
      }
      lead: {
        Row: {
          erstellt_am: string
          id: string
          inserat_id: string | null
          kanal: string
          status: string
          suchabo_id: string | null
        }
        Insert: {
          erstellt_am?: string
          id?: string
          inserat_id?: string | null
          kanal: string
          status?: string
          suchabo_id?: string | null
        }
        Update: {
          erstellt_am?: string
          id?: string
          inserat_id?: string | null
          kanal?: string
          status?: string
          suchabo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_inserat_id_fkey"
            columns: ["inserat_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_suchabo_id_fkey"
            columns: ["suchabo_id"]
            isOneToOne: false
            referencedRelation: "suchabo"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_contact_progress: {
        Row: {
          created_at: string
          current_step: string
          id: string
          listing_id: string
          note: string | null
          steps: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_step?: string
          id?: string
          listing_id: string
          note?: string | null
          steps?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_step?: string
          id?: string
          listing_id?: string
          note?: string | null
          steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      listing_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          listing_id: string
          mime_type: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          listing_id: string
          mime_type?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          listing_id?: string
          mime_type?: string | null
        }
        Relationships: []
      }
      listing_images: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: []
      }
      listing_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          listing_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          listing_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          listing_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      listing_prechecks: {
        Row: {
          created_at: string
          data: Json
          id: string
          listing_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          listing_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          listing_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      listing_sources: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          portal: Database["public"]["Enums"]["portal"]
          raw_email_id: string | null
          seen_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          portal: Database["public"]["Enums"]["portal"]
          raw_email_id?: string | null
          seen_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          portal?: Database["public"]["Enums"]["portal"]
          raw_email_id?: string | null
          seen_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_sources_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_sources_raw_email_id_fkey"
            columns: ["raw_email_id"]
            isOneToOne: false
            referencedRelation: "raw_emails"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_viewings: {
        Row: {
          attendees: string | null
          created_at: string
          id: string
          listing_id: string
          notes: string | null
          updated_at: string
          viewing_at: string
        }
        Insert: {
          attendees?: string | null
          created_at?: string
          id?: string
          listing_id: string
          notes?: string | null
          updated_at?: string
          viewing_at: string
        }
        Update: {
          attendees?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          notes?: string | null
          updated_at?: string
          viewing_at?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          address: string | null
          apartments_in_building: number | null
          archived_at: string | null
          area_sqm: number | null
          bewertet_von: string | null
          bfs_number: number | null
          building_area_sqm: number | null
          building_category: string | null
          building_status: string | null
          building_year: number | null
          canton: string | null
          city: string | null
          construction_period: string | null
          contact_company: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          dwellings: number | null
          egid: number | null
          egrid: string | null
          energy_source: string | null
          extra_notes: string | null
          fingerprint: string | null
          first_seen_at: string
          floors: number | null
          geo_researched: boolean
          gis_enrich_attempts: number
          gis_enrich_failed: boolean
          gis_enriched: boolean
          gis_enriched_at: string | null
          gwr_enriched_at: string | null
          heating_energy_source: string | null
          heating_generator: string | null
          heating_type: string | null
          heating_updated_at: string | null
          heritage_protected: boolean | null
          id: string
          image_url: string | null
          is_favorite: boolean
          isos_protected: boolean | null
          last_seen_at: string
          latitude: number | null
          longitude: number | null
          lv95_east: number | null
          lv95_north: number | null
          municipality: string | null
          notes: string | null
          parcel_area_sqm: number | null
          parcel_number: string | null
          postal_code: string | null
          price_chf: number | null
          price_per_sqm: number | null
          price_per_sqm_land: number | null
          primary_portal: Database["public"]["Enums"]["portal"]
          primary_url: string | null
          rooms: number | null
          source_available: boolean
          source_checked_at: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
          usage_zone: string | null
          zone_area_sqm: number | null
          zone_code: string | null
          zone_legal_status: string | null
          zone_name: string | null
          zone_part_percent: number | null
        }
        Insert: {
          address?: string | null
          apartments_in_building?: number | null
          archived_at?: string | null
          area_sqm?: number | null
          bewertet_von?: string | null
          bfs_number?: number | null
          building_area_sqm?: number | null
          building_category?: string | null
          building_status?: string | null
          building_year?: number | null
          canton?: string | null
          city?: string | null
          construction_period?: string | null
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          dwellings?: number | null
          egid?: number | null
          egrid?: string | null
          energy_source?: string | null
          extra_notes?: string | null
          fingerprint?: string | null
          first_seen_at?: string
          floors?: number | null
          geo_researched?: boolean
          gis_enrich_attempts?: number
          gis_enrich_failed?: boolean
          gis_enriched?: boolean
          gis_enriched_at?: string | null
          gwr_enriched_at?: string | null
          heating_energy_source?: string | null
          heating_generator?: string | null
          heating_type?: string | null
          heating_updated_at?: string | null
          heritage_protected?: boolean | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          isos_protected?: boolean | null
          last_seen_at?: string
          latitude?: number | null
          longitude?: number | null
          lv95_east?: number | null
          lv95_north?: number | null
          municipality?: string | null
          notes?: string | null
          parcel_area_sqm?: number | null
          parcel_number?: string | null
          postal_code?: string | null
          price_chf?: number | null
          price_per_sqm?: number | null
          price_per_sqm_land?: number | null
          primary_portal?: Database["public"]["Enums"]["portal"]
          primary_url?: string | null
          rooms?: number | null
          source_available?: boolean
          source_checked_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
          usage_zone?: string | null
          zone_area_sqm?: number | null
          zone_code?: string | null
          zone_legal_status?: string | null
          zone_name?: string | null
          zone_part_percent?: number | null
        }
        Update: {
          address?: string | null
          apartments_in_building?: number | null
          archived_at?: string | null
          area_sqm?: number | null
          bewertet_von?: string | null
          bfs_number?: number | null
          building_area_sqm?: number | null
          building_category?: string | null
          building_status?: string | null
          building_year?: number | null
          canton?: string | null
          city?: string | null
          construction_period?: string | null
          contact_company?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          dwellings?: number | null
          egid?: number | null
          egrid?: string | null
          energy_source?: string | null
          extra_notes?: string | null
          fingerprint?: string | null
          first_seen_at?: string
          floors?: number | null
          geo_researched?: boolean
          gis_enrich_attempts?: number
          gis_enrich_failed?: boolean
          gis_enriched?: boolean
          gis_enriched_at?: string | null
          gwr_enriched_at?: string | null
          heating_energy_source?: string | null
          heating_generator?: string | null
          heating_type?: string | null
          heating_updated_at?: string | null
          heritage_protected?: boolean | null
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          isos_protected?: boolean | null
          last_seen_at?: string
          latitude?: number | null
          longitude?: number | null
          lv95_east?: number | null
          lv95_north?: number | null
          municipality?: string | null
          notes?: string | null
          parcel_area_sqm?: number | null
          parcel_number?: string | null
          postal_code?: string | null
          price_chf?: number | null
          price_per_sqm?: number | null
          price_per_sqm_land?: number | null
          primary_portal?: Database["public"]["Enums"]["portal"]
          primary_url?: string | null
          rooms?: number | null
          source_available?: boolean
          source_checked_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
          usage_zone?: string | null
          zone_area_sqm?: number | null
          zone_code?: string | null
          zone_legal_status?: string | null
          zone_name?: string | null
          zone_part_percent?: number | null
        }
        Relationships: []
      }
      raw_emails: {
        Row: {
          created_at: string
          error_message: string | null
          from_address: string | null
          html_body: string | null
          id: string
          listings_extracted: number
          raw_payload: Json | null
          received_at: string
          status: Database["public"]["Enums"]["email_status"]
          subject: string | null
          text_body: string | null
          to_address: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          from_address?: string | null
          html_body?: string | null
          id?: string
          listings_extracted?: number
          raw_payload?: Json | null
          received_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          text_body?: string | null
          to_address?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          from_address?: string | null
          html_body?: string | null
          id?: string
          listings_extracted?: number
          raw_payload?: Json | null
          received_at?: string
          status?: Database["public"]["Enums"]["email_status"]
          subject?: string | null
          text_body?: string | null
          to_address?: string | null
        }
        Relationships: []
      }
      suchabo: {
        Row: {
          aktiv: boolean
          erstellt_am: string
          filter_json: Json
          id: string
          kanal: string
          kontakt: string
          zuletzt_geaendert: string
        }
        Insert: {
          aktiv?: boolean
          erstellt_am?: string
          filter_json?: Json
          id?: string
          kanal?: string
          kontakt: string
          zuletzt_geaendert?: string
        }
        Update: {
          aktiv?: boolean
          erstellt_am?: string
          filter_json?: Json
          id?: string
          kanal?: string
          kontakt?: string
          zuletzt_geaendert?: string
        }
        Relationships: []
      }
      tim_preferences: {
        Row: {
          area_sqm: number | null
          building_year: number | null
          canton: string | null
          decision: string
          floor_count: number | null
          id: string
          listing_id: string | null
          municipality: string | null
          parcel_area_sqm: number | null
          portal: string | null
          price_chf: number | null
          price_per_sqm: number | null
          rooms: number | null
          swiped_at: string
          usage_zone: string | null
        }
        Insert: {
          area_sqm?: number | null
          building_year?: number | null
          canton?: string | null
          decision: string
          floor_count?: number | null
          id?: string
          listing_id?: string | null
          municipality?: string | null
          parcel_area_sqm?: number | null
          portal?: string | null
          price_chf?: number | null
          price_per_sqm?: number | null
          rooms?: number | null
          swiped_at?: string
          usage_zone?: string | null
        }
        Update: {
          area_sqm?: number | null
          building_year?: number | null
          canton?: string | null
          decision?: string
          floor_count?: number | null
          id?: string
          listing_id?: string | null
          municipality?: string | null
          parcel_area_sqm?: number | null
          portal?: string | null
          price_chf?: number | null
          price_per_sqm?: number | null
          rooms?: number | null
          swiped_at?: string
          usage_zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tim_preferences_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_activity: {
        Row: {
          created_at: string
          duration_ms: number | null
          event_label: string | null
          event_type: string
          id: string
          ip_address: string
          listing_id: string | null
          metadata: Json | null
          path: string | null
          session_id: string | null
          target_id: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          event_label?: string | null
          event_type: string
          id?: string
          ip_address: string
          listing_id?: string | null
          metadata?: Json | null
          path?: string | null
          session_id?: string | null
          target_id?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          event_label?: string | null
          event_type?: string
          id?: string
          ip_address?: string
          listing_id?: string | null
          metadata?: Json | null
          path?: string | null
          session_id?: string | null
          target_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      visitor_log: {
        Row: {
          address: string | null
          browser: string | null
          city: string | null
          country: string | null
          created_at: string
          custom_label: string | null
          device_name: string | null
          device_type: string | null
          first_seen_at: string
          hostname: string | null
          id: string
          ip_address: string
          is_blocked: boolean
          isp: string | null
          language: string | null
          last_seen_at: string
          latitude: number | null
          longitude: number | null
          os: string | null
          path: string | null
          postal: string | null
          referrer: string | null
          region: string | null
          updated_at: string
          user_agent: string | null
          visit_count: number
        }
        Insert: {
          address?: string | null
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          custom_label?: string | null
          device_name?: string | null
          device_type?: string | null
          first_seen_at?: string
          hostname?: string | null
          id?: string
          ip_address: string
          is_blocked?: boolean
          isp?: string | null
          language?: string | null
          last_seen_at?: string
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          path?: string | null
          postal?: string | null
          referrer?: string | null
          region?: string | null
          updated_at?: string
          user_agent?: string | null
          visit_count?: number
        }
        Update: {
          address?: string | null
          browser?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          custom_label?: string | null
          device_name?: string | null
          device_type?: string | null
          first_seen_at?: string
          hostname?: string | null
          id?: string
          ip_address?: string
          is_blocked?: boolean
          isp?: string | null
          language?: string | null
          last_seen_at?: string
          latitude?: number | null
          longitude?: number | null
          os?: string | null
          path?: string | null
          postal?: string | null
          referrer?: string | null
          region?: string | null
          updated_at?: string
          user_agent?: string | null
          visit_count?: number
        }
        Relationships: []
      }
      whatsapp_nachricht: {
        Row: {
          erstellt_am: string
          id: string
          inhalt: string
          richtung: string
          telefon: string
        }
        Insert: {
          erstellt_am?: string
          id?: string
          inhalt: string
          richtung: string
          telefon: string
        }
        Update: {
          erstellt_am?: string
          id?: string
          inhalt?: string
          richtung?: string
          telefon?: string
        }
        Relationships: []
      }
      zh_postal_codes: {
        Row: {
          postal_code: string
        }
        Insert: {
          postal_code: string
        }
        Update: {
          postal_code?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      email_status: "received" | "processing" | "processed" | "failed"
      listing_status:
        | "new"
        | "interested"
        | "contacted"
        | "visited"
        | "rejected"
      portal:
        | "immoscout24"
        | "homegate"
        | "flatfox"
        | "casasoft"
        | "immostreet"
        | "home_ch"
        | "newhome"
        | "other"
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
      email_status: ["received", "processing", "processed", "failed"],
      listing_status: ["new", "interested", "contacted", "visited", "rejected"],
      portal: [
        "immoscout24",
        "homegate",
        "flatfox",
        "casasoft",
        "immostreet",
        "home_ch",
        "newhome",
        "other",
      ],
    },
  },
} as const
