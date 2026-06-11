// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// -------- Mapping-Tabellen --------
const GBAUP_MAP: Record<number, string> = {
  8011: "vor 1919", 8012: "1919–1945", 8013: "1946–1960", 8014: "1961–1970",
  8015: "1971–1980", 8016: "1981–1985", 8017: "1986–1990", 8018: "1991–1995",
  8019: "1996–2000", 8020: "2001–2005", 8021: "2006–2010", 8022: "2011–2015",
  8023: "ab 2016",
};
const GENH_MAP: Record<number, string> = {
  7500: "keine", 7501: "Luft", 7510: "Erdwärme Sonde", 7511: "Erdwärme Register",
  7512: "Wasser", 7513: "Gas", 7520: "Gas", 7530: "Heizöl", 7540: "Holz (Stück)",
  7541: "Holz (Schnitzel)", 7542: "Holz (Pellets)", 7543: "Holz",
  7550: "Abwärme", 7560: "Elektrizität", 7570: "Sonne thermisch",
  7580: "Fernwärme Hochtemp.", 7581: "Fernwärme Niedertemp.",
  7598: "unbestimmt", 7599: "andere",
};
const GWAERZH_MAP: Record<number, string> = {
  7400: "kein", 7410: "Wärmepumpe", 7411: "Wärmepumpe (2 Erzeuger)",
  7420: "Solar thermisch", 7430: "Heizkessel", 7431: "Heizkessel (nicht kondensierend)",
  7432: "Heizkessel (kondensierend)", 7433: "Ofen", 7434: "WKK-Anlage",
  7435: "Elektrospeicher-Zentralheizung", 7436: "Elektro direkt",
  7440: "Wärmetauscher Fernwärme", 7441: "andere", 7499: "unbestimmt",
};

// -------- Geocoding --------
async function geocode(query: string): Promise<{ east: number; north: number } | null> {
  const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(query)}&type=locations&origins=address&sr=2056&limit=1`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const j = await r.json();
  const a = j.results?.[0]?.attrs;
  if (!a) return null;
  // bei sr=2056: attrs.y = East, attrs.x = North
  const east = Number(a.y);
  const north = Number(a.x);
  if (!isFinite(east) || !isFinite(north)) return null;
  return { east, north };
}

// -------- GWR --------
async function fetchGwr(east: number, north: number): Promise<any | null> {
  const url = `https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometry=${east},${north}&geometryType=esriGeometryPoint&layers=all:ch.bfs.gebaeude_wohnungs_register&tolerance=10&mapExtent=${east - 100},${north - 100},${east + 100},${north + 100}&imageDisplay=100,100,96&sr=2056&returnGeometry=false`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) return null;
  const j = await r.json();
  return j.results?.[0]?.attributes ?? null;
}

// -------- Bauzone --------
async function fetchZoneZh(east: number, north: number): Promise<{ code: string | null; name: string | null }> {
  // Exakter kommunaler BZO-Zonencode via Kanton-Zürich-WFS
  const bbox = `${east - 1},${north - 1},${east + 1},${north + 1},EPSG:2056`;
  const url = `https://maps.zh.ch/wfs/OGDZHWFS?service=WFS&version=2.0.0&request=GetFeature&typeNames=ms:ogd-0156_arv_basis_np_gn_zonenflaeche_f&srsName=EPSG:2056&bbox=${bbox}&count=1&outputFormat=geojson`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return { code: null, name: null };
    const txt = await r.text();
    if (!txt.startsWith("{")) return { code: null, name: null };
    const j = JSON.parse(txt);
    const p = j.features?.[0]?.properties;
    if (!p) return { code: null, name: null };
    return {
      code: p.typ_gde_abkuerzung ?? p.typ_zh_abkuerzung ?? null,
      name: p.typ_gde_bezeichnung ?? p.typ_zh_bezeichnung ?? null,
    };
  } catch {
    return { code: null, name: null };
  }
}

async function fetchZoneCh(east: number, north: number): Promise<{ code: string | null; name: string | null }> {
  // Fallback: Bundes-Layer ch.are.bauzonen (harmonisiert)
  const url = `https://api3.geo.admin.ch/rest/services/api/MapServer/identify?geometry=${east},${north}&geometryType=esriGeometryPoint&layers=all:ch.are.bauzonen&tolerance=0&mapExtent=${east - 50},${north - 50},${east + 50},${north + 50}&imageDisplay=100,100,96&sr=2056&returnGeometry=false`;
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return { code: null, name: null };
    const j = await r.json();
    const a = j.results?.[0]?.attributes;
    if (!a) return { code: null, name: null };
    return {
      code: a.ch_bezeichnung ?? a.kantonal_bezeichnung ?? null,
      name: a.typ_bezeichnung ?? a.hauptnutzung ?? null,
    };
  } catch {
    return { code: null, name: null };
  }
}

async function fetchBauzone(east: number, north: number, postalCode?: string | null, kanton?: string | null): Promise<{ code: string | null; name: string | null }> {
  // ZH bevorzugt: PLZ 8000–8999 ODER kanton == 'ZH'
  const plz = postalCode ? parseInt(postalCode, 10) : 0;
  const isZh = (kanton === "ZH") || (plz >= 8000 && plz <= 8999);
  if (isZh) {
    const zh = await fetchZoneZh(east, north);
    if (zh.code || zh.name) return zh;
  }
  return fetchZoneCh(east, north);
}

// -------- enrich single --------
async function enrichOne(supabase: any, listing: any) {
  const addrParts = [listing.address, listing.postal_code, listing.city].filter(Boolean);
  if (addrParts.length < 2) {
    await supabase.from("listings").update({
      gis_enrich_attempts: (listing.gis_enrich_attempts ?? 0) + 1,
      gis_enrich_failed: (listing.gis_enrich_attempts ?? 0) + 1 >= 3,
    }).eq("id", listing.id);
    return { id: listing.id, ok: false, reason: "address_incomplete" };
  }
  const query = addrParts.join(" ");

  try {
    const coords = await geocode(query);
    if (!coords) {
      const att = (listing.gis_enrich_attempts ?? 0) + 1;
      await supabase.from("listings").update({
        gis_enrich_attempts: att,
        gis_enrich_failed: att >= 3,
      }).eq("id", listing.id);
      return { id: listing.id, ok: false, reason: "geocode_failed" };
    }

    const [gwr, zone] = await Promise.all([
      fetchGwr(coords.east, coords.north),
      fetchBauzone(coords.east, coords.north, listing.postal_code, listing.canton),
    ]);

    // Preis pro m²
    const price = Number(listing.price_chf) || null;
    const area = Number(listing.area_sqm) || null;
    const land = Number(listing.parcel_area_sqm ?? gwr?.gareal ?? 0) || null;
    const pricePerSqmLand = price && land ? Math.round((price / land) * 100) / 100 : null;

    // Bauperiode
    let constructionPeriod: string | null = null;
    if (gwr?.gbauj == null && gwr?.gbaup != null) {
      constructionPeriod = GBAUP_MAP[Number(gwr.gbaup)] ?? null;
    }

    const update: Record<string, unknown> = {
      lv95_east: coords.east,
      lv95_north: coords.north,
      gis_enriched: true,
      gis_enriched_at: new Date().toISOString(),
      gis_enrich_failed: false,
      price_per_sqm_land: pricePerSqmLand,
      zone_code: zone.code,
      zone_name: zone.name,
    };

    if (gwr) {
      update.egid = gwr.egid ?? null;
      update.egrid = gwr.egrid ?? null;
      update.parcel_number = gwr.lparz ?? null;
      update.building_year = gwr.gbauj ?? null;
      update.construction_period = constructionPeriod;
      update.building_area_sqm = gwr.garea ?? null;
      update.floors = gwr.gastw ?? null;
      update.apartments_in_building = gwr.ganzwhg ?? null;
      update.dwellings = gwr.ganzwhg ?? null;
      update.heating_generator = gwr.gwaerzh1 ? (GWAERZH_MAP[Number(gwr.gwaerzh1)] ?? null) : null;
      update.heating_energy_source = gwr.genh1 ? (GENH_MAP[Number(gwr.genh1)] ?? null) : null;
      update.heating_updated_at = gwr.gwaerdath1 ?? null;
      update.gwr_enriched_at = new Date().toISOString();
    }

    await supabase.from("listings").update(update).eq("id", listing.id);
    return { id: listing.id, ok: true };
  } catch (e) {
    const att = (listing.gis_enrich_attempts ?? 0) + 1;
    await supabase.from("listings").update({
      gis_enrich_attempts: att,
      gis_enrich_failed: att >= 3,
    }).eq("id", listing.id);
    return { id: listing.id, ok: false, reason: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const limit = Math.min(Number(body.limit ?? 10), 50);
  const listingId = body.listingId as string | undefined;

  let listings: any[] = [];
  if (listingId) {
    const { data } = await supabase.from("listings").select("*").eq("id", listingId).limit(1);
    listings = data ?? [];
  } else {
    const { data } = await supabase
      .from("listings")
      .select("id, address, postal_code, city, price_chf, area_sqm, parcel_area_sqm, gis_enrich_attempts")
      .eq("gis_enriched", false)
      .eq("gis_enrich_failed", false)
      .not("address", "is", null)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(limit);
    listings = data ?? [];
  }

  const results = [];
  for (const l of listings) {
    results.push(await enrichOne(supabase, l));
    await new Promise((r) => setTimeout(r, 200)); // gentle rate-limit
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
