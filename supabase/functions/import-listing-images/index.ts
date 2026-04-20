// Imports all images for a listing.
// Strategy: 1) free direct fetch first (works for Homegate/Flatfox/Comparis/Newhome)
//           2) fallback to Firecrawl ONLY for ImmoScout24 or when direct fetch yields too few images.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Browser-like UA so portals don't immediately serve a bot page.
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "de-CH,de;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
};

// Heuristics
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

function extractFromHtml(html: string, baseUrl: string): string[] {
  const urls = new Set<string>();

  // og:image / twitter:image
  const metaRegex = /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["'][^>]+content=["']([^"']+)["']/gi;
  for (const m of html.matchAll(metaRegex)) {
    const u = normalizeUrl(m[1], baseUrl);
    if (u) urls.add(u);
  }

  // <img src="..."> and lazy-load variants
  const imgRegex = /<img[^>]+(?:src|data-src|data-original|data-lazy|data-lazy-src)=["']([^"']+)["']/gi;
  for (const m of html.matchAll(imgRegex)) {
    const u = normalizeUrl(m[1], baseUrl);
    if (u) urls.add(u);
  }

  // srcset
  const srcsetRegex = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  for (const m of html.matchAll(srcsetRegex)) {
    const candidates = m[1].split(",").map((p) => p.trim().split(/\s+/)[0]);
    for (const c of candidates) {
      const u = normalizeUrl(c, baseUrl);
      if (u) urls.add(u);
    }
  }

  // JSON-LD
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
      // ignore
    }
  }

  // __NEXT_DATA__ / inline JSON: greedy URL match for image CDNs
  const nextDataRegex = /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i;
  const nextMatch = html.match(nextDataRegex);
  if (nextMatch) {
    const urlRegex = /https?:\/\/[^\s"'<>\\]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>\\]*)?/gi;
    for (const m of nextMatch[1].matchAll(urlRegex)) {
      urls.add(m[0]);
    }
  }

  return Array.from(urls);
}

// FREE: direct fetch without any browser/proxy
async function directFetch(url: string): Promise<{ html: string; ok: boolean; status: number }> {
  try {
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
    });
    const html = await res.text();
    return { html, ok: res.ok, status: res.status };
  } catch (e) {
    console.error("directFetch error:", e);
    return { html: "", ok: false, status: 0 };
  }
}

// PAID fallback: Firecrawl
async function scrapeWithFirecrawl(url: string): Promise<{ html: string; links: string[] }> {
  if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");
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
  const payload = data.data ?? data;
  return {
    html: payload.html ?? payload.rawHtml ?? "",
    links: Array.isArray(payload.links) ? payload.links : [],
  };
}

// Detect if a portal needs JS rendering / has anti-bot
function needsFirecrawl(url: string): boolean {
  return /immoscout24\.ch/i.test(url);
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

    const { data: listing, error: lErr } = await supabase
      .from("listings")
      .select("id, primary_url")
      .eq("id", listing_id)
      .maybeSingle();

    if (lErr) throw lErr;
    if (!listing) throw new Error("Listing not found");
    if (!listing.primary_url) throw new Error("Listing has no primary_url");

    const { data: existing } = await supabase
      .from("listing_images")
      .select("url, sort_order")
      .eq("listing_id", listing_id);

    const existingUrls = new Set((existing ?? []).map((e: any) => e.url));
    const startSort = (existing ?? []).reduce((m: number, e: any) => Math.max(m, e.sort_order ?? 0), -1) + 1;

    const url = listing.primary_url;
    let html = "";
    let links: string[] = [];
    let method: "direct" | "firecrawl" = "direct";
    let creditsUsed = 0;

    // Step 1: try free direct fetch first (skip if we know it'll fail)
    if (!needsFirecrawl(url)) {
      const direct = await directFetch(url);
      if (direct.ok && direct.html.length > 500) {
        html = direct.html;
      } else {
        console.log(`Direct fetch failed (${direct.status}), falling back to Firecrawl`);
      }
    }

    // Step 2: extract from direct fetch
    let candidates = html ? extractFromHtml(html, url) : [];
    let filtered = candidates.filter((u) => isLikelyListingImage(u) && isHighRes(u));
    let usable = filtered.filter((u) => !existingUrls.has(u));

    // Step 3: fallback to Firecrawl if direct fetch yielded too few results
    const MIN_IMAGES = 3;
    if (usable.length < MIN_IMAGES) {
      if (!FIRECRAWL_API_KEY) {
        if (usable.length === 0) {
          throw new Error("Direct fetch fand keine Bilder und Firecrawl ist nicht konfiguriert");
        }
        // proceed with what we have
      } else {
        console.log(`Only ${usable.length} images via direct fetch, using Firecrawl fallback`);
        try {
          const fc = await scrapeWithFirecrawl(url);
          html = fc.html;
          links = fc.links;
          method = "firecrawl";
          creditsUsed = 1;

          const fromHtml = extractFromHtml(html, url);
          const fromLinks = links.filter((l) => /\.(jpe?g|png|webp|avif)(\?|$)/i.test(l));
          candidates = Array.from(new Set([...fromHtml, ...fromLinks]));
          filtered = candidates.filter((u) => isLikelyListingImage(u) && isHighRes(u));
          usable = filtered.filter((u) => !existingUrls.has(u));
        } catch (fcErr) {
          console.error("Firecrawl fallback failed:", fcErr);
          if (usable.length === 0) throw fcErr;
        }
      }
    }

    // Insert (cap at 30)
    const capped = usable.slice(0, 30);
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
        total_found: candidates.length,
        method,
        credits_used: creditsUsed,
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
