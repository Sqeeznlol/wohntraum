import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * GWR (Gebäude- und Wohnungsregister) Anreicherung über die offene
 * housing-stat.ch API des Bundesamtes für Statistik (BFS).
 *
 * Die API liefert zu einer Adresse:
 * - EGID (eindeutige Gebäude-ID)
 * - Baujahr
 * - Anzahl Stockwerke
 * - Anzahl Wohnungen
 *
 * Doku: https://www.housing-stat.ch/de/madd/public.html
 */

interface GwrResult {
  egid?: number | null;
  building_year?: number | null;
  floors?: number | null;
  dwellings?: number | null;
}

async function fetchGwr(address: string, postalCode: string, city: string): Promise<GwrResult> {
  // 1. Adresse → EGID via BFS GeoAdmin Suche (öffentliche API, kein Key nötig)
  const searchTerm = `${address}, ${postalCode} ${city}`;
  const searchUrl = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(
    searchTerm,
  )}&type=locations&origins=address&limit=1`;

  const searchRes = await fetch(searchUrl, {
    headers: { Accept: "application/json" },
  });
  if (!searchRes.ok) return {};
  const searchData = (await searchRes.json()) as {
    results?: Array<{ attrs?: { featureId?: string; label?: string } }>;
  };
  const featureId = searchData.results?.[0]?.attrs?.featureId;
  if (!featureId) return {};

  // 2. featureId → EGID via Identify auf Layer ch.bfs.gebaeude_wohnungs_register
  const identifyUrl = `https://api3.geo.admin.ch/rest/services/api/MapServer/ch.bfs.gebaeude_wohnungs_register/${featureId}?geometryFormat=geojson`;
  const identifyRes = await fetch(identifyUrl, {
    headers: { Accept: "application/json" },
  });
  if (!identifyRes.ok) {
    // Fallback: nutze Adresse direkt um EGID zu raten
    return {};
  }
  const identifyData = (await identifyRes.json()) as {
    feature?: {
      attributes?: {
        egid?: number;
        gbauj?: number; // Baujahr
        gastw?: number; // Anzahl Stockwerke
        gawhn?: number; // Anzahl Wohnungen
      };
    };
  };

  const a = identifyData.feature?.attributes;
  if (!a) return {};

  return {
    egid: a.egid ?? null,
    building_year: a.gbauj ?? null,
    floors: a.gastw ?? null,
    dwellings: a.gawhn ?? null,
  };
}

export const enrichListingGwr = createServerFn({ method: "POST" })
  .inputValidator((data: { listingId: string }) => data)
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { ok: false, error: "Backend nicht konfiguriert" };
    }

    const supabase = createClient<Database>(supabaseUrl, serviceKey);

    const { data: listing, error } = await supabase
      .from("listings")
      .select("id, address, postal_code, city")
      .eq("id", data.listingId)
      .maybeSingle();

    if (error || !listing) {
      return { ok: false, error: "Inserat nicht gefunden" };
    }
    if (!listing.address || !listing.postal_code || !listing.city) {
      return { ok: false, error: "Adresse unvollständig" };
    }

    try {
      const gwr = await fetchGwr(listing.address, listing.postal_code, listing.city);

      if (!gwr.egid && !gwr.building_year && !gwr.dwellings) {
        return { ok: false, error: "Keine GWR-Daten gefunden" };
      }

      await supabase
        .from("listings")
        .update({
          egid: gwr.egid ?? null,
          building_year: gwr.building_year ?? null,
          floors: gwr.floors ?? null,
          dwellings: gwr.dwellings ?? null,
          gwr_enriched_at: new Date().toISOString(),
        })
        .eq("id", listing.id);

      return { ok: true, ...gwr };
    } catch (e) {
      console.error("GWR enrichment failed:", e);
      return { ok: false, error: "GWR-Abruf fehlgeschlagen" };
    }
  });
