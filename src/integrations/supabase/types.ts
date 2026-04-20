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
      listings: {
        Row: {
          address: string | null
          archived_at: string | null
          area_sqm: number | null
          city: string | null
          created_at: string
          description: string | null
          fingerprint: string | null
          first_seen_at: string
          id: string
          image_url: string | null
          is_favorite: boolean
          last_seen_at: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          postal_code: string | null
          price_chf: number | null
          price_per_sqm: number | null
          primary_portal: Database["public"]["Enums"]["portal"]
          primary_url: string | null
          rooms: number | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          archived_at?: string | null
          area_sqm?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          fingerprint?: string | null
          first_seen_at?: string
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          last_seen_at?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          postal_code?: string | null
          price_chf?: number | null
          price_per_sqm?: number | null
          primary_portal?: Database["public"]["Enums"]["portal"]
          primary_url?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          archived_at?: string | null
          area_sqm?: number | null
          city?: string | null
          created_at?: string
          description?: string | null
          fingerprint?: string | null
          first_seen_at?: string
          id?: string
          image_url?: string | null
          is_favorite?: boolean
          last_seen_at?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          postal_code?: string | null
          price_chf?: number | null
          price_per_sqm?: number | null
          primary_portal?: Database["public"]["Enums"]["portal"]
          primary_url?: string | null
          rooms?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          updated_at?: string
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
