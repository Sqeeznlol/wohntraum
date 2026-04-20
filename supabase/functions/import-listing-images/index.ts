// Imports all images for a listing by scraping its primary_url via Firecrawl.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Heuristics to filter out logos / icons / tracking pixels and prefer large gallery images.
function isLikelyListingImage(url: string): boolean {
  const u = url.toLowerCase();
  if (!u.startsWith("http")) return false;
  if (u.endsWith(".svg")) return false;
  if (/(logo|icon|favicon|sprite|avatar|placeholder|pixel|tracking|analytics|badge|loading|spinner|blank)/.test(u))
    return false;
  if (/\b(1x1|16x16|24x24|32x32|48x48|64x64|96x96)\b/.test(u)) return false;
  // Common image extensions
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
  // Common ImmoScout/Homegate CDN size markers
  if (/\/(large|xl|big|original|hd|1280|1600|1920|2048)\b/i.test(url)) return true;
  if (/\/(thumb|small|tiny|mini|icon|sm|xs|150|200|240)\b/i.test(url)) return false;
  // Default: keep if no size marker
  return true;
}

function normalizeUrl(url: string, base?: string): string | null {
  try {
    const u = new URL(url, base);
    // Strip query params that change per request (cachebust)
    return u.href.split("#")[0];
  } catch {
    return null;
  }
}

function extractFromHtml(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();

  // og:image / twitter:image
  const metaRegex = /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["'][^>]+content=["']([^"']+)["']/gi;
  for (const m of html.matchAll(metaRegex)) {
    const u = normalizeUrl(m[1], baseUrl);
    if (u) urls.add(u);
  }

  // <img src="..."> and data-src / data-original / data-lazy
  const imgRegex = /<img[^>]+(?:src|data-src|data-original|data-lazy|data-lazy-src)=["']([^"']+)["']/gi;
  for (const m of html.matchAll(imgRegex)) {
    const u = normalizeUrl(m[1], baseUrl);
    if (u) urls.add(u);
  }

  // srcset (take the largest URL — usually last)
  const srcsetRegex = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  for (const m of html.matchAll(srcsetRegex)) {
    const candidates = m[1].split(",").map((p) => p.trim().split(/\s+/)[0]);
    for (const c of candidates) {
      const u = normalizeUrl(c, baseUrl);
      if (u) urls.add(u);
    }
  }

  // JSON-LD: extract any "image" / "contentUrl" string fields
  const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(jsonLdRegex)) {
    try {
      const data = JSON.parse(m[1].trim());
      const collect = (val: any) => {
        if (!val) return;
        if (typeof val === "string") {
          const u = normalizeUrl(val, baseUrl);
          if (u) urls.add(u);
        } else if (Array.isArray(val)) {
          val.forEach(collect);
        } else if (typeof val === "object") {
          if (val.image) collect(val.image);
          if (val.contentUrl) collect(val.contentUrl);
          if (val.url && typeof val.url === "string" && /\.(jpe?g|png|webp|avif)/i.test(val.url)) collect(val.url);
        }
      };
      collect(data);
    } catch {
      // ignore malformed JSON-LD
    }
  }

  return Array.from(urls);
}

async function scrapeWithFirecrawl(url: string): Promise<{ html: string; links: string[] }> {
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      formats: ["html", "links"],
      onlyMainContent: false,
      waitFor: 2000,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firecrawl ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  // SDK v2 shape: { success, data: { html, links, metadata } } OR top-level { html, links }
  const payload = data.data ?? data;
  return {
    html: payload.html ?? payload.rawHtml ?? "",
    links: Array.isArray(payload.links) ? payload.links : [],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { listing_id } = await req.json();
    if (!listing_id) {
      return new Response(JSON.stringify({ error: "listing_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch listing
    const { data: listing, error: lErr } = await supabase
      .from("listings")
      .select("id, primary_url")
      .eq("id", listing_id)
      .maybeSingle();

    if (lErr) throw lErr;
    if (!listing) throw new Error("Listing not found");
    if (!listing.primary_url) throw new Error("Listing has no primary_url");

    // Existing images to dedupe against
    const { data: existing } = await supabase
      .from("listing_images")
      .select("url, sort_order")
      .eq("listing_id", listing_id);

    const existingUrls = new Set((existing ?? []).map((e: any) => e.url));
    const startSort = (existing ?? []).reduce((m: number, e: any) => Math.max(m, e.sort_order ?? 0), -1) + 1;

    // Scrape via Firecrawl
    const { html, links } = await scrapeWithFirecrawl(listing.primary_url);

    // Extract candidate URLs
    const fromHtml = extractFromHtml(html, listing.primary_url);
    const fromLinks = links.filter((l) => /\.(jpe?g|png|webp|avif)(\?|$)/i.test(l));
    const all = Array.from(new Set([...fromHtml, ...fromLinks]));

    // Filter
    const filtered = all.filter((u) => isLikelyListingImage(u) && isHighRes(u));

    // Dedupe vs existing
    const toInsert = filtered.filter((u) => !existingUrls.has(u));

    // Insert (cap at 30 to be safe)
    const capped = toInsert.slice(0, 30);
    let imported = 0;
    if (capped.length > 0) {
      const rows = capped.map((url, i) => ({
        listing_id,
        url,
        sort_order: startSort + i,
      }));
      const { error: insErr } = await supabase.from("listing_images").insert(rows);
      if (insErr) throw insErr;
      imported = capped.length;
    }

    return new Response(
      JSON.stringify({
        imported,
        skipped: filtered.length - imported,
        total_found: all.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("import-listing-images error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
