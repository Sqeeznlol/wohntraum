import type { Database } from "@/integrations/supabase/types";

export type Listing = Database["public"]["Tables"]["listings"]["Row"];
export type ListingSource = Database["public"]["Tables"]["listing_sources"]["Row"];
export type RawEmail = Database["public"]["Tables"]["raw_emails"]["Row"];
export type AlertRule = Database["public"]["Tables"]["alert_rules"]["Row"];

export type Portal = Database["public"]["Enums"]["portal"];
export type ListingStatus = Database["public"]["Enums"]["listing_status"];
