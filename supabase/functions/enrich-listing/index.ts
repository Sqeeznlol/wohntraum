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

async function directFetch(url: string): Promise<{ html: string; ok: boolean }> {
  try {
    const res = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
    const html = await res.text();
    return { html, ok: res.ok };
  } catch {
    return { html: "", ok: false };
  }
}

async function firecrawlScrape(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) return "";
  try {
    const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["html"], onlyMainContent: false, waitFor: 800, timeout: 20000 }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const payload = data.data ?? data;
    return payload.html ?? payload.rawHtml ?? "";
  } catch {
    return "";
  }
}

function needsFirecrawl(url: string): boolean {
  return /immoscout24\.ch/i.test(url);
}

async function enrichOne(supabase: any, listing: any): Promise<{ id: string; ok: boolean; reason?: string; updated?: any; imagesAdded?: number }> {
  if (!listing.primary_url) return { id: listing.id, ok: false, reason: "no url" };
  const url = listing.primary_url;

  let html = "";
  if (!needsFirecrawl(url)) {
    const direct = await directFetch(url);
    if (direct.ok && direct.html.length > 500) html = direct.html;
  }
  if (!html || html.length < 500) {
    html = await firecrawlScrape(url);
  }
  if (!html) return { id: listing.id, ok: false, reason: "fetch failed" };

  const meta = extractMetadata(html);
  const images = extractImages(html, url);

  // Build update payload only with missing fields
  const update: any = { updated_at: new Date().toISOString() };
  if (!listing.price_chf && meta.price) {
    update.price_chf = meta.price;
    if (meta.area || listing.area_sqm) {
      const area = meta.area ?? Number(listing.area_sqm);
      if (area > 0) update.price_per_sqm = Math.round(meta.price / area);
    }
  }
  if (!listing.area_sqm && meta.area) {
    update.area_sqm = meta.area;
    const price = listing.price_chf ?? meta.price;
    if (price) update.price_per_sqm = Math.round(Number(price) / meta.area);
  }
  if (!listing.rooms && meta.rooms) update.rooms = meta.rooms;
  if (!listing.postal_code && meta.postal_code) update.postal_code = meta.postal_code;
  if (!listing.city && meta.city) update.city = meta.city;
  if (!listing.address && meta.address) update.address = meta.address;
  if (!listing.image_url && images.length > 0) update.image_url = images[0];

  if (Object.keys(update).length > 1) {
    const { error } = await supabase.from("listings").update(update).eq("id", listing.id);
    if (error) return { id: listing.id, ok: false, reason: error.message };
  }

  // Insert images
  let imagesAdded = 0;
  if (images.length > 0) {
    const { data: existing } = await supabase
      .from("listing_images")
      .select("url, sort_order")
      .eq("listing_id", listing.id);
    const existingUrls = new Set((existing ?? []).map((e: any) => e.url));
    const startSort = (existing ?? []).reduce((m: number, e: any) => Math.max(m, e.sort_order ?? 0), -1) + 1;
    const fresh = images.filter((u) => !existingUrls.has(u)).slice(0, 30);
    if (fresh.length > 0) {
      const rows = fresh.map((url, i) => ({ listing_id: listing.id, url, sort_order: startSort + i }));
      const { error } = await supabase.from("listing_images").insert(rows);
      if (!error) imagesAdded = fresh.length;
    }
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
        .or("price_chf.is.null,image_url.is.null,rooms.is.null,area_sqm.is.null")
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
