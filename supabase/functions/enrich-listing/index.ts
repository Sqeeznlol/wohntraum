// Enrich a single listing: scrape its primary_url, extract images + price/rooms/area/address.
// No AI calls — pure HTML parsing. Free direct fetch first, Firecrawl only if needed.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "de-CH,de;q=0.9,en;q=0.8",
};

function isLikelyListingImage(url: string): boolean {
  const u = url.toLowerCase();
  if (!u.startsWith("http")) return false;
  if (u.endsWith(".svg")) return false;
  if (/(logo|icon|favicon|sprite|avatar|placeholder|pixel|tracking|analytics|badge|loading|spinner|blank|sponsor|ad[-_/])/.test(u))
    return false;
  if (/\b(1x1|16x16|24x24|32x32|48x48|64x64|96x96)\b/.test(u)) return false;
  if (!/\.(jpe?g|png|webp|avif)(\?|$)/.test(u)) return false;
  return true;
}

function isHighRes(url: string): boolean {
  const m = url.match(/(\d{3,4})x(\d{3,4})/);
  if (m) {
    const w = parseInt(m[1]);
    const h = parseInt(m[2]);
    return w >= 600 || h >= 400;
  }
  if (/\/(large|xl|big|original|hd|1280|1600|1920|2048)\b/i.test(url)) return true;
  if (/\/(thumb|small|tiny|mini|icon|sm|xs|150|200|240)\b/i.test(url)) return false;
  return true;
}

function normalizeUrl(url: string, base?: string): string | null {
  try {
    const u = new URL(url, base);
    return u.href.split("#")[0];
  } catch {
    return null;
  }
}

function extractImages(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();
  const metaRegex = /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["'][^>]+content=["']([^"']+)["']/gi;
  for (const m of html.matchAll(metaRegex)) {
    const u = normalizeUrl(m[1], baseUrl);
    if (u) urls.add(u);
  }
  const imgRegex = /<img[^>]+(?:src|data-src|data-original|data-lazy|data-lazy-src)=["']([^"']+)["']/gi;
  for (const m of html.matchAll(imgRegex)) {
    const u = normalizeUrl(m[1], baseUrl);
    if (u) urls.add(u);
  }
  const srcsetRegex = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  for (const m of html.matchAll(srcsetRegex)) {
    const candidates = m[1].split(",").map((p) => p.trim().split(/\s+/)[0]);
    for (const c of candidates) {
      const u = normalizeUrl(c, baseUrl);
      if (u) urls.add(u);
    }
  }
  const nextDataRegex = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
  const nextMatch = html.match(nextDataRegex);
  if (nextMatch) {
    const urlRegex = /https?:\/\/[^\s"'<>\\]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>\\]*)?/gi;
    for (const m of nextMatch[1].matchAll(urlRegex)) urls.add(m[0]);
  }
  return Array.from(urls).filter((u) => isLikelyListingImage(u) && isHighRes(u));
}

// --------- Metadata extraction (price, rooms, area, address) ---------

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&euro;/g, "€");
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

function parseSwissNumber(s: string): number | null {
  // "1'234'567.50" or "1.234.567,50" or "1234567"
  const cleaned = s.replace(/[’'`\s]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : null;
}

function extractMetadata(html: string): {
  price?: number;
  rooms?: number;
  area?: number;
  postal_code?: string;
  city?: string;
  address?: string;
  title?: string;
  description?: string;
} {
  const text = stripTags(html);
  const result: any = {};

  // Price: CHF 1'234'567 or 1'234'567 CHF or "Preis: ... CHF"
  const priceMatches = [
    /CHF\s*([\d'’.\s]{4,})/i,
    /([\d'’.\s]{4,})\s*CHF/i,
    /"price"\s*:\s*"?([\d.]+)"?/i,
    /"priceValue"\s*:\s*"?([\d.]+)"?/i,
  ];
  for (const re of priceMatches) {
    const m = text.match(re) || html.match(re);
    if (m) {
      const n = parseSwissNumber(m[1]);
      if (n && n >= 100 && n <= 50_000_000) {
        result.price = n;
        break;
      }
    }
  }

  // Rooms: "4.5 Zimmer" / "4 ½ Zimmer"
  const roomsMatch = text.match(/(\d+(?:[.,]\d)?|\d+\s*½)\s*Zimmer/i);
  if (roomsMatch) {
    const r = roomsMatch[1].replace("½", ".5").replace(",", ".");
    const n = parseFloat(r.trim());
    if (isFinite(n) && n > 0 && n < 30) result.rooms = n;
  }

  // Area: "123 m²" / "123 m2"
  const areaMatch = text.match(/(\d{2,5})\s*m[²2](?!\w)/i);
  if (areaMatch) {
    const n = parseInt(areaMatch[1]);
    if (n >= 10 && n <= 10000) result.area = n;
  }

  // Postal code + city: 4-digit Swiss PLZ + word
  const plzMatch = text.match(/\b(\d{4})\s+([A-ZÄÖÜ][A-Za-zÄÖÜäöüéèà.\- ]{2,40})/);
  if (plzMatch) {
    result.postal_code = plzMatch[1];
    result.city = plzMatch[2].trim().split(/[,;]/)[0].trim();
  }

  // og:title / og:description
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (ogTitle) result.title = decodeHtml(ogTitle[1]).trim();
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (ogDesc) result.description = decodeHtml(ogDesc[1]).trim();

  // Address: try JSON-LD streetAddress
  const streetMatch = html.match(/"streetAddress"\s*:\s*"([^"]+)"/i);
  if (streetMatch) result.address = streetMatch[1];

  return result;
}

async function directFetch(url: string): Promise<{ html: string; status: number; finalUrl: string }> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
    const html = await res.text();
    return { html, status: res.status, finalUrl: res.url };
  } catch {
    return { html: "", status: 0, finalUrl: url };
  }
}

async function firecrawlScrape(url: string): Promise<{ html: string; status: number; error?: string }> {
  if (!FIRECRAWL_API_KEY) return { html: "", status: 0, error: "no api key" };
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        formats: ["html"],
        onlyMainContent: false,
        waitFor: 2500,
        timeout: 30000,
        proxy: "stealth",
        location: { country: "CH" },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { html: "", status: res.status, error: txt.slice(0, 200) };
    }
    const data = await res.json();
    const payload = data.data ?? data;
    return { html: payload.html ?? payload.rawHtml ?? "", status: 200 };
  } catch (e) {
    return { html: "", status: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

// Detect dead/redirected pages (404/410 or redirect to home/search/not-found)
function isDeadResponse(status: number, finalUrl: string, originalUrl: string, html: string): boolean {
  if (status === 404 || status === 410) return true;
  try {
    const o = new URL(originalUrl);
    const f = new URL(finalUrl);
    if (f.host === o.host && f.pathname !== o.pathname) {
      if (/^\/?$/.test(f.pathname)) return true;
      if (/(suchen|search|not-found|nicht-gefunden|404|expired|abgelaufen)/i.test(f.pathname)) return true;
    }
  } catch { /* ignore */ }
  if (html && html.length < 8000 && /(nicht\s*mehr\s*verf|nicht\s*gefunden|inserat.*(entfernt|abgelaufen|inaktiv)|listing\s*not\s*found|no longer available)/i.test(html)) {
    return true;
  }
  return false;
}

async function uploadImageToStorage(
  supabase: any,
  listingId: string,
  imageUrl: string,
  filename: string,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, { headers: BROWSER_HEADERS, redirect: "follow" });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length < 2048) return null; // skip tiny / placeholder
    const path = `${listingId}/${filename}`;
    const { error } = await supabase.storage
      .from("listing-images")
      .upload(path, buf, { contentType, upsert: true });
    if (error) {
      console.warn("storage upload failed", path, error.message);
      return null;
    }
    const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.warn("uploadImageToStorage error", e);
    return null;
  }
}

async function fetchGwrFromGeoAdmin(address: string): Promise<{
  egid?: number | null;
  egrid?: string | null;
  building_year?: number | null;
  building_category?: string | null;
  building_area_sqm?: number | null;
  dwellings?: number | null;
  floors?: number | null;
  heating_type?: string | null;
  energy_source?: string | null;
  municipality?: string | null;
  canton?: string | null;
  parcel_number?: string | null;
  lv95_east?: number | null;
  lv95_north?: number | null;
  usage_zone?: string | null;
} | null> {
  try {
    const searchUrl = `https://api3.geo.admin.ch/rest/services/ech/SearchServer?searchText=${encodeURIComponent(
      "adresse " + address,
    )}&type=locations&origins=address&limit=1&sr=2056`;
    const sRes = await fetch(searchUrl, { headers: { Accept: "application/json" } });
    if (!sRes.ok) return null;
    const sJson = (await sRes.json()) as any;
    const hit = sJson.results?.[0]?.attrs;
    if (!hit) return null;
    const featureId: string | undefined = hit.featureId;
    const east: number | null = hit.y ?? null;
    const north: number | null = hit.x ?? null;

    let attrs: any = null;
    if (featureId) {
      const detUrl = `https://api3.geo.admin.ch/rest/services/ech/MapServer/ch.bfs.gebaeude_wohnungs_register/${featureId}?returnGeometry=false`;
      const dRes = await fetch(detUrl, { headers: { Accept: "application/json" } });
      if (dRes.ok) {
        const dJson = (await dRes.json()) as any;
        attrs = dJson.feature?.attributes ?? dJson.attributes ?? null;
      }
    }

    let usage_zone: string | null = null;
    if (east != null && north != null) {
      const zUrl = `https://api3.geo.admin.ch/rest/services/ech/MapServer/identify?geometry=${east},${north}&geometryType=esriGeometryPoint&imageDisplay=0,0,0&mapExtent=0,0,0,0&tolerance=5&layers=all:ch.are.bauzonen&returnGeometry=false&sr=2056`;
      const zRes = await fetch(zUrl, { headers: { Accept: "application/json" } });
      if (zRes.ok) {
        const zJson = (await zRes.json()) as any;
        const a = zJson.results?.[0]?.attributes ?? null;
        usage_zone = a?.ch_bezeichnung ?? a?.bezeichnung ?? a?.kategorie_de ?? null;
      }
    }

    return {
      egid: attrs?.egid ?? null,
      egrid: attrs?.egrid ?? null,
      building_year: attrs?.gbauj ?? null,
      building_category: attrs?.gkat ? String(attrs.gkat) : null,
      building_area_sqm: attrs?.garea ?? null,
      dwellings: attrs?.ganzwhg ?? null,
      floors: attrs?.gastw ?? null,
      heating_type: attrs?.genh1 ? String(attrs.genh1) : null,
      energy_source: attrs?.gwaerzh1 ? String(attrs.gwaerzh1) : null,
      municipality: attrs?.ggdename ?? null,
      canton: attrs?.gdekt ?? null,
      parcel_number: attrs?.lparz ?? null,
      lv95_east: east,
      lv95_north: north,
      usage_zone,
    };
  } catch (e) {
    console.warn("GWR fetch failed", e);
    return null;
  }
}

async function enrichOne(supabase: any, listing: any): Promise<{ id: string; ok: boolean; reason?: string; updated?: any; imagesAdded?: number; method?: string; dead?: boolean }> {
  if (!listing.primary_url) return { id: listing.id, ok: false, reason: "no url" };
  const url = listing.primary_url;
  const nowIso = new Date().toISOString();

  // Always try direct fetch first (free + fast). Used to detect 404/410 cleanly.
  const direct = await directFetch(url);
  let html = "";
  let method = "direct";
  let imagesFromDirect: string[] = [];

  if (direct.html.length > 500 && direct.status === 200) {
    imagesFromDirect = extractImages(direct.html, url);
  }

  // Use direct only if it produced images. Otherwise fall back to Firecrawl stealth.
  if (direct.status === 200 && imagesFromDirect.length > 0) {
    html = direct.html;
  } else {
    const fc = await firecrawlScrape(url);
    if (fc.html && fc.html.length > 500) {
      html = fc.html;
      method = "firecrawl";
    } else if (fc.error) {
      console.warn(`[enrich] firecrawl failed for ${listing.id}: status=${fc.status} err=${fc.error}`);
    }
  }

  // Dead-link detection: if direct says 404/410 OR redirected to home/search OR matched "not found" text, mark and stop.
  if (isDeadResponse(direct.status, direct.finalUrl, url, direct.html)) {
    await supabase
      .from("listings")
      .update({ source_available: false, source_checked_at: nowIso, updated_at: nowIso })
      .eq("id", listing.id);
    console.log(`[enrich] dead listing ${listing.id} status=${direct.status} final=${direct.finalUrl}`);
    return { id: listing.id, ok: false, reason: "dead link", dead: true, method };
  }

  if (!html) {
    await supabase
      .from("listings")
      .update({ source_checked_at: nowIso })
      .eq("id", listing.id);
    return { id: listing.id, ok: false, reason: "fetch failed", method };
  }

  const meta = extractMetadata(html);
  const images = extractImages(html, url);


  // Build update payload only with missing fields.
  // NOTE: price_per_sqm is a GENERATED column in Postgres — never write it,
  // it auto-computes from price_chf / area_sqm.
  const update: any = { updated_at: nowIso, source_checked_at: nowIso, source_available: true };
  if (!listing.price_chf && meta.price) update.price_chf = meta.price;
  if (!listing.area_sqm && meta.area) update.area_sqm = meta.area;
  if (!listing.rooms && meta.rooms) update.rooms = meta.rooms;
  if (!listing.postal_code && meta.postal_code) update.postal_code = meta.postal_code;
  if (!listing.city && meta.city) update.city = meta.city;
  if (!listing.address && meta.address) update.address = meta.address;
  if ((!listing.title || listing.title === "Inserat") && meta.title) update.title = meta.title;
  if (!listing.description && meta.description) update.description = meta.description;

  // Upload cover + gallery to Supabase Storage
  let imagesAdded = 0;
  if (images.length > 0) {
    const { data: existing } = await supabase
      .from("listing_images")
      .select("url, sort_order")
      .eq("listing_id", listing.id);
    const existingCount = (existing ?? []).length;
    const startSort = (existing ?? []).reduce((m: number, e: any) => Math.max(m, e.sort_order ?? 0), -1) + 1;

    // Cover (first image) — upload to storage if listing has no image yet
    if (!listing.image_url) {
      const coverUrl = await uploadImageToStorage(supabase, listing.id, images[0], "cover.jpg");
      if (coverUrl) update.image_url = coverUrl;
      else update.image_url = images[0];
    }

    // Gallery — upload up to 10 to storage and store rows
    if (existingCount < 10) {
      const slots = 10 - existingCount;
      const candidates = images.slice(0, slots);
      const rows: Array<{ listing_id: string; url: string; sort_order: number }> = [];
      for (let i = 0; i < candidates.length; i++) {
        const stored = await uploadImageToStorage(
          supabase,
          listing.id,
          candidates[i],
          `${startSort + i}.jpg`,
        );
        rows.push({
          listing_id: listing.id,
          url: stored ?? candidates[i],
          sort_order: startSort + i,
        });
      }
      if (rows.length > 0) {
        const { error } = await supabase.from("listing_images").insert(rows);
        if (!error) imagesAdded = rows.length;
      }
    }
  }

  // GWR enrichment via geo.admin.ch — only if address available and not yet researched
  const effectiveAddress =
    update.address ?? listing.address
      ? `${update.address ?? listing.address}, ${update.postal_code ?? listing.postal_code ?? ""} ${update.city ?? listing.city ?? ""}`.trim()
      : null;
  if (effectiveAddress && !listing.geo_researched) {
    const gwr = await fetchGwrFromGeoAdmin(effectiveAddress);
    if (gwr) {
      if (gwr.egid != null) update.egid = gwr.egid;
      if (gwr.egrid) update.egrid = gwr.egrid;
      if (gwr.building_year) update.building_year = gwr.building_year;
      if (gwr.building_category) update.building_category = gwr.building_category;
      if (gwr.building_area_sqm) update.building_area_sqm = gwr.building_area_sqm;
      if (gwr.dwellings) update.dwellings = gwr.dwellings;
      if (gwr.floors) update.floors = gwr.floors;
      if (gwr.heating_type) update.heating_type = gwr.heating_type;
      if (gwr.energy_source) update.energy_source = gwr.energy_source;
      if (gwr.municipality) update.municipality = gwr.municipality;
      if (gwr.canton) update.canton = gwr.canton;
      if (gwr.parcel_number) update.parcel_number = gwr.parcel_number;
      if (gwr.lv95_east != null) update.lv95_east = gwr.lv95_east;
      if (gwr.lv95_north != null) update.lv95_north = gwr.lv95_north;
      if (gwr.usage_zone) update.usage_zone = gwr.usage_zone;
    }
    update.geo_researched = true;
    update.gwr_enriched_at = new Date().toISOString();
  }

  if (Object.keys(update).length > 1) {
    const { error } = await supabase.from("listings").update(update).eq("id", listing.id);
    if (error) return { id: listing.id, ok: false, reason: error.message };
  }

  return { id: listing.id, ok: true, updated: update, imagesAdded };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { listing_id, all_incomplete, limit } = body;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let listings: any[] = [];
    if (listing_id) {
      const { data, error } = await supabase.from("listings").select("*").eq("id", listing_id).maybeSingle();
      if (error) throw error;
      if (data) listings = [data];
    } else if (all_incomplete) {
      // Hard cap to avoid 150s idle timeout. Each enrich can take 5-15s.
      const hardCap = Math.min(limit ?? 8, 12);
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .is("archived_at", null)
        .or("price_chf.is.null,image_url.is.null,rooms.is.null,area_sqm.is.null,address.is.null")
        .order("created_at", { ascending: false })
        .limit(hardCap);
      if (error) throw error;
      listings = data ?? [];
    } else {
      return new Response(JSON.stringify({ error: "listing_id or all_incomplete required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process in parallel with concurrency cap and per-item timeout
    const CONCURRENCY = 4;
    const PER_ITEM_TIMEOUT_MS = 25_000;
    const results: any[] = [];

    async function withTimeout<T>(p: Promise<T>, ms: number, id: string): Promise<T> {
      return await Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`timeout after ${ms}ms for ${id}`)), ms),
        ),
      ]);
    }

    let cursor = 0;
    async function worker() {
      while (cursor < listings.length) {
        const idx = cursor++;
        const l = listings[idx];
        try {
          const r = await withTimeout(enrichOne(supabase, l), PER_ITEM_TIMEOUT_MS, l.id);
          results.push(r);
        } catch (e) {
          results.push({ id: l.id, ok: false, reason: e instanceof Error ? e.message : String(e) });
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, listings.length) }, worker));

    const succeeded = results.filter((r) => r.ok).length;
    return new Response(JSON.stringify({ processed: results.length, succeeded, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("enrich-listing error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
