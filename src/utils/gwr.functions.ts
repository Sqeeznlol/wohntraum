import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Vollständige Zürcher GIS-Anreicherungspipeline
 *  - GWR via api3.geo.admin.ch (EGID → Adresse, Baujahr, Parzelle, BFS, Gemeinde)
 *  - AV WFS via maps.zh.ch (BFS + Katasternr → EGRID, Parzellenfläche, Mittelpunkt LV95)
 *  - ÖREB via maps.zh.ch (EGRID → Bauzone)
 *  - Denkmalschutz WFS (Gemeinde → Set Katasternummern)
 *  - ISOS WMS (LV95-Koordinaten → Ortsbildschutz Ja/Nein)
 *
 * Alle APIs öffentlich, kein Key.
 */

// ============================================================================
// Mapping-Tabellen
// ============================================================================

const GKAT_MAP: Record<number, string> = {
  1020: "Einfamilienhaus",
  1030: "Mehrfamilienhaus",
  1040: "Wohngebäude mit Nebennutzung",
  1060: "Gebäude mit teilweiser Wohnnutzung",
  1080: "Gebäude ohne Wohnnutzung",
};
const GSTAT_MAP: Record<number, string> = {
  1001: "Projektiert",
  1002: "Bewilligt",
  1003: "Im Bau",
  1004: "Bestehend",
  1005: "Nicht nutzbar",
  1007: "Abgebrochen",
  1008: "Nicht realisiert",
};

// ============================================================================
// Types
// ============================================================================

interface GwrAttributes {
  egid?: number;
  egrid?: string;
  strname?: string[];
  deinr?: string;
  dplz4?: number;
  dplzname?: string;
  ggdename?: string;
  ggdenr?: number;
  gbauj?: number;
  garea?: number;
  gastw?: number;
  ganzwhg?: number;
  gkat?: number;
  gstat?: number;
  lparz?: string;
}

interface ParcelData {
  egrid: string | null;
  area_sqm: number | null;
  east: number | null;
  north: number | null;
}

interface ZoneData {
  code: string | null;
  legal_status: string | null;
  area_sqm: number | null;
  part_percent: number | null;
}

// ============================================================================
// 1. GWR via geo.admin.ch
// ============================================================================

async function fetchGwrByEgid(egid: string): Promise<GwrAttributes | null> {
  const cleaned = egid.replace(/[^\d]/g, "");
  if (!cleaned) return null;
  const url = `https://api3.geo.admin.ch/rest/services/ech/MapServer/find?layer=ch.bfs.gebaeude_wohnungs_register&searchText=${cleaned}&searchField=egid&returnGeometry=false&contains=false`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = (await res.json()) as { results?: Array<{ attributes?: GwrAttributes }> };
  return json.results?.[0]?.attributes ?? null;
}

async function fetchGwrByAddress(
  address: string,
  postalCode: string,
  city: string,
): Promise<GwrAttributes | null> {
  // Erst über Search API einen Treffer finden, dann featureId → find
  const searchTerm = `${address}, ${postalCode} ${city}`;
  const searchUrl = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(searchTerm)}&type=locations&origins=address&limit=1`;
  const searchRes = await fetch(searchUrl, { headers: { Accept: "application/json" } });
  if (!searchRes.ok) return null;
  const searchData = (await searchRes.json()) as {
    results?: Array<{ attrs?: { featureId?: string } }>;
  };
  const featureId = searchData.results?.[0]?.attrs?.featureId;
  if (!featureId) return null;

  // featureId direkt im GWR-Layer finden
  const findUrl = `https://api3.geo.admin.ch/rest/services/ech/MapServer/find?layer=ch.bfs.gebaeude_wohnungs_register&searchText=${encodeURIComponent(searchTerm)}&searchField=ggdename&returnGeometry=false&contains=true`;
  const findRes = await fetch(findUrl, { headers: { Accept: "application/json" } });
  if (!findRes.ok) return null;
  const findJson = (await findRes.json()) as { results?: Array<{ attributes?: GwrAttributes }> };
  // Bestes Match: PLZ stimmt
  const plz = parseInt(postalCode, 10);
  const match =
    findJson.results?.find((r) => r.attributes?.dplz4 === plz)?.attributes ??
    findJson.results?.[0]?.attributes ??
    null;
  return match;
}

// ============================================================================
// 2. Parzellen-Daten (AV WFS)
// ============================================================================

function polygonCenter(geom: GeoJSON.Geometry): { east: number; north: number } | null {
  let coords: number[][] = [];
  if (geom.type === "Polygon") {
    coords = geom.coordinates[0];
  } else if (geom.type === "MultiPolygon") {
    coords = geom.coordinates[0]?.[0] ?? [];
  }
  if (!coords.length) return null;
  let minE = Infinity,
    maxE = -Infinity,
    minN = Infinity,
    maxN = -Infinity;
  for (const [e, n] of coords) {
    if (e < minE) minE = e;
    if (e > maxE) maxE = e;
    if (n < minN) minN = n;
    if (n > maxN) maxN = n;
  }
  return { east: (minE + maxE) / 2, north: (minN + maxN) / 2 };
}

async function fetchParcel(bfs: number, parcelNumber: string): Promise<ParcelData | null> {
  const filter = `<Filter><And><PropertyIsEqualTo><PropertyName>bfsnr</PropertyName><Literal>${bfs}</Literal></PropertyIsEqualTo><PropertyIsEqualTo><PropertyName>nummer</PropertyName><Literal>${parcelNumber}</Literal></PropertyIsEqualTo></And></Filter>`;
  const url = `https://maps.zh.ch/wfs/AVZHWFS?service=WFS&version=2.0.0&request=GetFeature&typeNames=ms:liegenschaften_f&outputFormat=${encodeURIComponent("application/json; subtype=geojson")}&count=1&Filter=${encodeURIComponent(filter)}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const json = (await res.json()) as GeoJSON.FeatureCollection;
  const feat = json.features?.[0];
  if (!feat) return null;
  const props = (feat.properties ?? {}) as { egris_egrid?: string; flaechenmass?: number };
  const center = feat.geometry ? polygonCenter(feat.geometry) : null;
  return {
    egrid: props.egris_egrid ?? null,
    area_sqm: props.flaechenmass ?? null,
    east: center?.east ?? null,
    north: center?.north ?? null,
  };
}

// ============================================================================
// 3. ÖREB-Kataster (Zonenplan)
// ============================================================================

async function fetchZone(egrid: string): Promise<ZoneData | null> {
  const url = `https://maps.zh.ch/oereb/v2/extract/json?EGRID=${encodeURIComponent(egrid)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    GetExtractByIdResponse?: {
      Extract?: {
        RealEstate?: {
          RestrictionOnLandownership?: Array<{
            Theme?: { Code?: string; SubCode?: string };
            LegendText?: Array<{ Text?: string }>;
            Lawstatus?: { Code?: string };
            AreaShare?: number;
            PartInPercent?: number;
          }>;
        };
      };
    };
  };
  const restrictions =
    json.GetExtractByIdResponse?.Extract?.RealEstate?.RestrictionOnLandownership ?? [];
  const grundnutzung = restrictions.find(
    (r) =>
      r.Theme?.Code === "ch.Nutzungsplanung" &&
      (!r.Theme?.SubCode || r.Theme.SubCode === "ch.ZH.NutzungsplanungGrundnutzung"),
  );
  if (!grundnutzung) return null;
  return {
    code: grundnutzung.LegendText?.[0]?.Text ?? null,
    legal_status: grundnutzung.Lawstatus?.Code === "inForce" ? "rechtskräftig" : null,
    area_sqm: grundnutzung.AreaShare ?? null,
    part_percent: grundnutzung.PartInPercent ?? null,
  };
}

// ============================================================================
// 4. Denkmalschutz WFS
// ============================================================================

async function fetchHeritageSet(municipality: string): Promise<Set<string>> {
  const filter = `<Filter><PropertyIsEqualTo><PropertyName>gemeinde</PropertyName><Literal>${municipality}</Literal></PropertyIsEqualTo></Filter>`;
  const url = `https://maps.zh.ch/wfs/DenkmalschutzWFS?SERVICE=WFS&VERSION=2.0.0&Request=GetFeature&TYPENAME=ms:denkmalschutzobjekte&outputFormat=${encodeURIComponent("application/json; subtype=geojson")}&count=5000&Filter=${encodeURIComponent(filter)}`;
  const res = await fetch(url);
  if (!res.ok) return new Set();
  const json = (await res.json()) as GeoJSON.FeatureCollection;
  const set = new Set<string>();
  for (const f of json.features ?? []) {
    const k = (f.properties as { katasternummer?: string } | null)?.katasternummer;
    if (k) {
      set.add(k);
      // Auch ohne Buchstaben-Präfix mappen (z.B. HI4889 → 4889)
      const noPrefix = k.replace(/^[A-Za-z]+/, "");
      if (noPrefix && noPrefix !== k) set.add(noPrefix);
    }
  }
  return set;
}

// ============================================================================
// 5. ISOS WMS
// ============================================================================

async function fetchIsos(east: number, north: number): Promise<boolean> {
  const bbox = `${east - 5},${north - 5},${east + 5},${north + 5}`;
  const url = `https://wms.zh.ch/ARERPOrtsbilderISOSZHWMS?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetFeatureInfo&LAYERS=isos-perimeter-f&QUERY_LAYERS=isos-perimeter-f&CRS=EPSG:2056&BBOX=${bbox}&WIDTH=10&HEIGHT=10&I=5&J=5&INFO_FORMAT=text/plain`;
  const res = await fetch(url);
  if (!res.ok) return false;
  const txt = await res.text();
  return txt.includes("Feature") && txt.includes("isos_name");
}

// ============================================================================
// Server Function
// ============================================================================

export const enrichListingGwr = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      listingId: string;
      manualEgid?: string | null;
      manualBfs?: number | null;
      manualParcel?: string | null;
      manualMunicipality?: string | null;
    }) => data,
  )
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { ok: false, error: "Backend nicht konfiguriert", missing: [] };
    }
    const supabase = createClient<Database>(supabaseUrl, serviceKey);

    const { data: listing, error } = await supabase
      .from("listings")
      .select("id, address, postal_code, city, egid, bfs_number, parcel_number, municipality")
      .eq("id", data.listingId)
      .maybeSingle();

    if (error || !listing)
      return { ok: false, error: "Inserat nicht gefunden", missing: [] };

    const effectiveEgid = data.manualEgid?.trim() || (listing.egid ? String(listing.egid) : null);
    const effectiveBfs = data.manualBfs ?? listing.bfs_number ?? null;
    const effectiveParcel = data.manualParcel?.trim() || listing.parcel_number || null;
    const effectiveMunicipality =
      data.manualMunicipality?.trim() || listing.municipality || null;

    const hasAddress = !!(listing.address && listing.postal_code && listing.city);
    const hasManualParcel = effectiveBfs && effectiveParcel;

    if (!effectiveEgid && !hasAddress && !hasManualParcel) {
      return {
        ok: false,
        error: "Zu wenig Daten für die Anreicherung",
        missing: ["EGID oder Adresse oder BFS-Nr. + Parzellennummer"],
      };
    }

    try {
      // 1. GWR — EGID > Adresse > Parzelle (kein direkter GWR-Lookup, später nur Parzelle)
      let gwr: GwrAttributes | null = null;
      if (effectiveEgid) {
        gwr = await fetchGwrByEgid(effectiveEgid);
      } else if (hasAddress) {
        gwr = await fetchGwrByAddress(listing.address!, listing.postal_code!, listing.city!);
      }

      // Falls GWR nichts liefert, aber Parzelle/BFS manuell da sind → nur Parzellen-Pipeline laufen lassen
      if (!gwr && !hasManualParcel) {
        const missing: string[] = [];
        if (!effectiveEgid) missing.push("EGID (Bundesgebäude-Nr.)");
        if (!hasManualParcel) missing.push("BFS-Nr. + Katasternummer");
        return {
          ok: false,
          error: "Keine GWR-Daten für diese Adresse gefunden",
          missing,
        };
      }

      const bfs = gwr?.ggdenr ?? effectiveBfs ?? null;
      const parcelNr = gwr?.lparz ?? effectiveParcel ?? null;
      const municipality = gwr?.ggdename ?? effectiveMunicipality ?? null;

      // 2. Parallel: Parzelle (AV WFS) + Denkmalschutz-Set
      const [parcel, heritageSet] = await Promise.all([
        bfs && parcelNr ? fetchParcel(bfs, parcelNr) : Promise.resolve<ParcelData | null>(null),
        municipality ? fetchHeritageSet(municipality) : Promise.resolve(new Set<string>()),
      ]);

      // 3. Parallel: Zone (ÖREB) + ISOS
      const [zone, isos] = await Promise.all([
        parcel?.egrid ? fetchZone(parcel.egrid) : Promise.resolve<ZoneData | null>(null),
        parcel?.east != null && parcel?.north != null
          ? fetchIsos(parcel.east, parcel.north)
          : Promise.resolve(false),
      ]);

      // 4. Denkmalschutz-Match
      let heritage = false;
      if (parcelNr && heritageSet.size > 0) {
        const noPrefix = parcelNr.replace(/^[A-Za-z]+/, "");
        heritage = heritageSet.has(parcelNr) || (noPrefix !== parcelNr && heritageSet.has(noPrefix));
      }

      const update: Database["public"]["Tables"]["listings"]["Update"] = {
        egid: gwr?.egid ?? (effectiveEgid ? Number(effectiveEgid.replace(/[^\d]/g, "")) : null),
        egrid: parcel?.egrid ?? gwr?.egrid ?? null,
        building_year: gwr?.gbauj ?? null,
        floors: gwr?.gastw ?? null,
        dwellings: gwr?.ganzwhg ?? null,
        building_area_sqm: gwr?.garea ?? null,
        building_category: gwr?.gkat ? (GKAT_MAP[gwr.gkat] ?? `Code ${gwr.gkat}`) : null,
        building_status: gwr?.gstat ? (GSTAT_MAP[gwr.gstat] ?? `Code ${gwr.gstat}`) : null,
        parcel_number: parcelNr,
        parcel_area_sqm: parcel?.area_sqm ?? null,
        bfs_number: bfs,
        municipality,
        zone_code: zone?.code ?? null,
        zone_legal_status: zone?.legal_status ?? null,
        zone_area_sqm: zone?.area_sqm ?? null,
        zone_part_percent: zone?.part_percent ?? null,
        heritage_protected: heritage,
        isos_protected: isos,
        lv95_east: parcel?.east ?? null,
        lv95_north: parcel?.north ?? null,
        gwr_enriched_at: new Date().toISOString(),
      };

      await supabase.from("listings").update(update).eq("id", listing.id);

      // Was fehlt nach der Anreicherung?
      const missing: string[] = [];
      if (!update.egid) missing.push("EGID");
      if (!update.building_year) missing.push("Baujahr");
      if (!update.zone_code) missing.push("Bauzone");
      if (!update.parcel_number) missing.push("Katasternummer");
      if (!update.bfs_number) missing.push("BFS-Nr.");

      return {
        ok: true,
        egid: update.egid,
        egrid: update.egrid,
        building_year: update.building_year,
        zone: update.zone_code,
        heritage_protected: heritage,
        isos_protected: isos,
        municipality,
        bfs,
        parcel_number: parcelNr,
        missing,
      };
    } catch (e) {
      console.error("GIS enrichment failed:", e);
      return { ok: false, error: "GIS-Abruf fehlgeschlagen", missing: [] };
    }
  });
