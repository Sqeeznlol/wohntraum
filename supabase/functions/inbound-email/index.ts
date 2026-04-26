// Inbound Email Webhook
// Receives forwarded real-estate alert emails, extracts listings via a
// portal-aware regex parser (NO AI), computes CHF/m², deduplicates, and
// stores them. AI extraction was removed on user request.
//
// POST body (flexible — supports Resend Inbound, generic forwarders):
// {
//   "from": "alerts@homegate.ch",
//   "to": "user@inbound.lovable.app",
//   "subject": "Neue Treffer für dein Suchabo",
//   "html": "<html>...</html>",
//   "text": "..."
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Portal =
  | "immoscout24"
  | "homegate"
  | "flatfox"
  | "casasoft"
  | "immostreet"
  | "home_ch"
  | "newhome"
  | "other";

interface ExtractedListing {
  title: string;
  description?: string | null;
  price_chf?: number | null;
  area_sqm?: number | null;
  rooms?: number | null;
  city?: string | null;
  postal_code?: string | null;
  address?: string | null;
  portal: Portal;
  url?: string | null;
  image_url?: string | null;
}

async function geocodeAddress(
  address: string | null | undefined,
  postal: string | null | undefined,
  city: string | null | undefined,
): Promise<{ lat: number; lon: number } | null> {
  const parts = [address, postal && city ? `${postal} ${city}` : city ?? postal, "Schweiz"]
    .filter(Boolean)
    .join(", ");
  if (!parts || parts === "Schweiz") return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ch&q=${encodeURIComponent(parts)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "ImmoRadar/1.0 (lovable.app)" },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!arr || arr.length === 0) return null;
    return { lat: Number(arr[0].lat), lon: Number(arr[0].lon) };
  } catch (e) {
    console.warn("geocode failed:", e);
    return null;
  }
}

// Portal-URL-Muster, die wir aus Tracking-Wrappern extrahieren wollen
const PORTAL_URL_RE =
  /https?:\/\/(?:www\.)?(immoscout24\.ch|homegate\.ch|flatfox\.ch|casasoft\.com|immostreet\.ch|home\.ch|newhome\.ch)\/[^\s"'<>)]+/i;

const TRACKING_RE = /sendgrid\.net|mailchimp|hubspot|\/ls\/click|click\.[a-z0-9]+\.|u\d+\.ct\.sendgrid/i;

function findPortalUrlIn(s: string): string | null {
  if (!s) return null;
  // direkter Match
  const m = s.match(PORTAL_URL_RE);
  if (m) return m[0];
  // URL-decoded versuchen
  try {
    const dec = decodeURIComponent(s);
    const m2 = dec.match(PORTAL_URL_RE);
    if (m2) return m2[0];
  } catch { /* ignore */ }
  // Doppel-decoded (Sendgrid encodet teilweise zweimal)
  try {
    const dec2 = decodeURIComponent(decodeURIComponent(s));
    const m3 = dec2.match(PORTAL_URL_RE);
    if (m3) return m3[0];
  } catch { /* ignore */ }
  return null;
}

async function unwrapTrackingUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;

  // Schon eine echte Portal-URL?
  if (PORTAL_URL_RE.test(url) && !TRACKING_RE.test(url)) {
    return stripTracking(url);
  }

  // 1) Versuch: Portal-URL direkt aus dem Tracking-Wrapper extrahieren (oft als query param eingebettet)
  const embedded = findPortalUrlIn(url);
  if (embedded) return stripTracking(embedded);

  // 2) Versuch: Redirects folgen, finalen res.url prüfen
  let current = url;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(current, {
      method: "GET",
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
    });
    const finalUrl = res.url || current;
    if (PORTAL_URL_RE.test(finalUrl) && !TRACKING_RE.test(finalUrl)) {
      clearTimeout(t);
      return stripTracking(finalUrl);
    }
    // 3) Im HTML-Body nach Portal-URL suchen (Meta-Refresh / JS-Redirect)
    try {
      const body = await res.text();
      clearTimeout(t);
      const found = findPortalUrlIn(body);
      if (found) return stripTracking(found);
    } catch {
      clearTimeout(t);
    }
    current = finalUrl;
  } catch (e) {
    console.warn("unwrap fetch failed:", e);
  }

  // Wenn am Ende immer noch Tracking-Wrapper -> null zurück (lieber gar keine URL als Müll)
  if (TRACKING_RE.test(current) || !PORTAL_URL_RE.test(current)) {
    return null;
  }
  return stripTracking(current);
}

function stripTracking(url: string): string {
  try {
    const u = new URL(url);
    const drop = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "subscriptionId", "gclid", "fbclid", "mc_cid", "mc_eid",
    ];
    drop.forEach((k) => u.searchParams.delete(k));
    return u.toString().replace(/\?$/, "");
  } catch {
    return url;
  }
}

function detectPortal(from: string, html: string): Portal {
  const s = `${from} ${html}`.toLowerCase();
  if (s.includes("immoscout24")) return "immoscout24";
  if (s.includes("homegate")) return "homegate";
  if (s.includes("flatfox")) return "flatfox";
  if (s.includes("casasoft")) return "casasoft";
  if (s.includes("immostreet")) return "immostreet";
  if (s.includes("home.ch") || s.includes("home ch")) return "home_ch";
  if (s.includes("newhome")) return "newhome";
  return "other";
}

function normalize(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function fingerprintOf(l: ExtractedListing): string {
  const addr = normalize(l.address || `${l.postal_code ?? ""} ${l.city ?? ""}`);
  const area = l.area_sqm ? Math.round(l.area_sqm) : 0;
  const price = l.price_chf ? Math.round(l.price_chf / 100) * 100 : 0;
  return `${addr}|${area}|${price}`;
}

// ============================================================================
// Regex-based extraction (replaces the previous AI extractor).
// ============================================================================

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(s: string): number | null {
  const cleaned = s.replace(/['’\s\u00A0]/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

// Extrahiert ein einzelnes Inserat aus einem Text-Block (eines <a>-Wrappers).
function parseListingFromBlock(
  blockHtml: string,
  defaultPortal: Portal,
): ExtractedListing | null {
  const linkMatch = blockHtml.match(/href=["']([^"']+)["']/i);
  if (!linkMatch) return null;
  const url = linkMatch[1];

  // Bild
  const imgMatch = blockHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  const image_url = imgMatch ? imgMatch[1] : null;

  // Plain Text aus dem Block
  const text = stripHtml(blockHtml);
  if (text.length < 10) return null;

  // Titel: erste Zeile mit ≥ 8 Zeichen, vor dem ersten "CHF"
  const beforePrice = text.split(/CHF/i)[0] ?? text;
  const title = beforePrice.slice(0, 200).trim() || "Inserat";

  // Preis: "CHF 1'250'000" / "1.250.000 CHF" / "CHF 1.25 Mio"
  let price_chf: number | null = null;
  const mioMatch = text.match(/CHF\s*([\d',\.\s]+)\s*(Mio\.?|Millionen?)/i);
  if (mioMatch) {
    const n = parseNumber(mioMatch[1]);
    if (n != null) price_chf = Math.round(n * 1_000_000);
  }
  if (price_chf == null) {
    const priceMatch = text.match(/CHF\s*([\d'’\.\s]{4,15})(?!\s*Mio)/i);
    if (priceMatch) {
      const n = parseNumber(priceMatch[1]);
      if (n != null && n >= 1000) price_chf = Math.round(n);
    }
  }

  // Fläche: "120 m²" / "120 qm"
  let area_sqm: number | null = null;
  const areaMatch = text.match(/(\d{2,5}(?:[.,]\d+)?)\s*m(?:²|2|\^2)/i);
  if (areaMatch) area_sqm = parseNumber(areaMatch[1]);

  // Zimmer: "4.5 Zimmer", "4½ Zi."
  let rooms: number | null = null;
  const roomsMatch = text.match(/(\d(?:[.,]\d+)?|\d½)\s*(?:Zi\.?|Zimmer|pieces?|pi[èe]ces?)/i);
  if (roomsMatch) {
    const r = roomsMatch[1].replace("½", ".5");
    rooms = parseNumber(r);
  }

  // PLZ + Ort: "8003 Zürich"
  let postal_code: string | null = null;
  let city: string | null = null;
  const plzMatch = text.match(/\b(\d{4})\s+([A-ZÄÖÜ][\wÄÖÜäöüéèêàâç\-\s]{2,40})/);
  if (plzMatch) {
    postal_code = plzMatch[1];
    city = plzMatch[2].trim().split(/\s{2,}|,/)[0];
  }

  return {
    title,
    description: null,
    price_chf,
    area_sqm,
    rooms,
    city,
    postal_code,
    address: null,
    portal: defaultPortal,
    url,
    image_url,
  };
}

// Findet alle <a href="…portal…"> Blocks in der Mail und parst sie.
function extractListings(html: string, defaultPortal: Portal): ExtractedListing[] {
  if (!html) return [];

  const anchorRe = /<a\b[^>]*href=["'][^"']+["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seenUrls = new Set<string>();
  const out: ExtractedListing[] = [];

  // Wir nehmen ganze <a>-Blöcke samt äußerem <a>-Tag.
  const anchorWithTagRe =
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;

  let match: RegExpExecArray | null;
  while ((match = anchorWithTagRe.exec(html)) !== null) {
    const fullBlock = match[0];
    const href = match[1];

    // Nur Anker, die plausibel zu einem Inserat führen
    if (!/(immoscout24|homegate|flatfox|home\.ch|newhome|casasoft|immostreet|sendgrid|mailchimp|hubspot|click\.)/i.test(href)) {
      continue;
    }
    if (seenUrls.has(href)) continue;
    seenUrls.add(href);

    const parsed = parseListingFromBlock(fullBlock, defaultPortal);
    if (!parsed) continue;
    // Mindestens Titel ODER Bild ODER Preis – sonst zu schwach
    if (!parsed.image_url && parsed.price_chf == null && parsed.area_sqm == null) {
      continue;
    }
    out.push(parsed);
  }

  // Dedup nach Bild-URL (gleiches Inserat erscheint oft mehrfach)
  const dedup = new Map<string, ExtractedListing>();
  for (const l of out) {
    const key = l.image_url ?? l.url ?? l.title;
    if (!dedup.has(key)) dedup.set(key, l);
  }
  // Anker, die offensichtlich Footer/Logo-Links sind, ignorieren
  void anchorRe;
  return Array.from(dedup.values()).slice(0, 50);
}

// ============================================================================
// FREE image scraping — direct fetch of the portal page (no Firecrawl, 0 credits).
// Works well for Homegate, Flatfox, Comparis, Newhome. ImmoScout24 often blocks
// bots, so we skip it here.
// ============================================================================

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept":
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "de-CH,de;q=0.9,en;q=0.8",
};

function isLikelyImg(u: string): boolean {
  const s = u.toLowerCase();
  if (!s.startsWith("http")) return false;
  if (s.endsWith(".svg")) return false;
  if (/(logo|icon|favicon|sprite|avatar|placeholder|pixel|tracking|analytics|badge|loading|spinner|blank|sponsor|ad[-_/])/.test(s))
    return false;
  if (/\b(1x1|16x16|24x24|32x32|48x48|64x64|96x96)\b/.test(s)) return false;
  if (!/\.(jpe?g|png|webp|avif)(\?|$)/.test(s)) return false;
  return true;
}

function isHighResImg(u: string): boolean {
  const m = u.match(/(\d{3,4})x(\d{3,4})/);
  if (m) {
    const w = parseInt(m[1]);
    const h = parseInt(m[2]);
    return w >= 600 || h >= 400;
  }
  if (/\/(large|xl|big|original|hd|1280|1600|1920|2048)\b/i.test(u)) return true;
  if (/\/(thumb|small|tiny|mini|icon|sm|xs|150|200|240)\b/i.test(u)) return false;
  return true;
}

function normImgUrl(u: string, base: string): string | null {
  try {
    return new URL(u, base).href.split("#")[0];
  } catch {
    return null;
  }
}

function extractImagesFromHtml(html: string, base: string): string[] {
  const urls = new Set<string>();
  const meta = /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["'][^>]+content=["']([^"']+)["']/gi;
  for (const m of html.matchAll(meta)) {
    const u = normImgUrl(m[1], base);
    if (u) urls.add(u);
  }
  const img = /<img[^>]+(?:src|data-src|data-original|data-lazy|data-lazy-src)=["']([^"']+)["']/gi;
  for (const m of html.matchAll(img)) {
    const u = normImgUrl(m[1], base);
    if (u) urls.add(u);
  }
  const srcset = /(?:srcset|data-srcset)=["']([^"']+)["']/gi;
  for (const m of html.matchAll(srcset)) {
    for (const c of m[1].split(",").map((p) => p.trim().split(/\s+/)[0])) {
      const u = normImgUrl(c, base);
      if (u) urls.add(u);
    }
  }
  const inline = /https?:\/\/[^\s"'<>\\]+\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>\\]*)?/gi;
  for (const m of html.matchAll(inline)) urls.add(m[0]);
  return Array.from(urls);
}

async function scrapeImagesFree(url: string): Promise<string[]> {
  // ImmoScout24 blockt Bots -> skip um Edge-Function-Time zu sparen
  if (/immoscout24\.ch/i.test(url)) return [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return [];
    const html = await res.text();
    if (html.length < 500) return [];
    const all = extractImagesFromHtml(html, url);
    return all.filter((u) => isLikelyImg(u) && isHighResImg(u)).slice(0, 20);
  } catch (e) {
    console.warn("scrapeImagesFree failed for", url, e);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  let payload: Record<string, unknown> = {};
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("application/json")) {
      payload = await req.json();
    } else {
      const fd = await req.formData();
      fd.forEach((v, k) => (payload[k] = typeof v === "string" ? v : ""));
    }
  } catch (_e) {
    return new Response(JSON.stringify({ error: "invalid body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const data =
    (payload.data as Record<string, unknown> | undefined) ?? payload;

  const asString = (v: unknown): string => {
    if (typeof v === "string") return v;
    if (Array.isArray(v)) {
      return v
        .map((x) =>
          typeof x === "string" ? x : ((x as { email?: string; address?: string })?.email ?? (x as { address?: string })?.address ?? ""),
        )
        .filter(Boolean)
        .join(", ");
    }
    if (v && typeof v === "object") {
      const o = v as { email?: string; address?: string; from?: string; to?: string };
      return o.email ?? o.address ?? o.from ?? o.to ?? "";
    }
    return "";
  };

  const envelope = (data as Record<string, unknown>).envelope as
    | Record<string, unknown>
    | undefined;
  const headers = (data as Record<string, unknown>).headers as
    | Record<string, unknown>
    | undefined;

  const from =
    asString(data.from) ||
    asString(data.sender) ||
    asString((data as Record<string, unknown>).From) ||
    asString(envelope?.from) ||
    asString(headers?.from) ||
    asString((payload as Record<string, unknown>).from);

  const to =
    asString(data.to) ||
    asString(data.recipient) ||
    asString((data as Record<string, unknown>).To) ||
    asString(envelope?.to) ||
    asString(headers?.to) ||
    asString((payload as Record<string, unknown>).to);

  const subject =
    (data.subject as string) ??
    ((data as Record<string, unknown>).Subject as string) ??
    (headers?.subject as string) ??
    "(no subject)";

  const html =
    (data.html as string) ??
    ((data as Record<string, unknown>).HtmlBody as string) ??
    ((data as Record<string, unknown>)["html-body"] as string) ??
    ((data as Record<string, unknown>)["body-html"] as string) ??
    ((data as Record<string, unknown>).body_html as string) ??
    "";

  const text =
    (data.plain as string) ??
    (data.text as string) ??
    ((data as Record<string, unknown>).TextBody as string) ??
    ((data as Record<string, unknown>)["text-body"] as string) ??
    ((data as Record<string, unknown>)["body-plain"] as string) ??
    ((data as Record<string, unknown>).body_plain as string) ??
    "";

  // Insert raw email row
  const { data: rawEmail, error: rawErr } = await supabase
    .from("raw_emails")
    .insert({
      from_address: from,
      to_address: to,
      subject,
      html_body: html,
      text_body: text,
      status: "processing",
      raw_payload: payload,
    })
    .select()
    .single();

  if (rawErr || !rawEmail) {
    console.error("raw_emails insert failed", rawErr);
    return new Response(JSON.stringify({ error: rawErr?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const defaultPortal = detectPortal(from, html);

  let listings: ExtractedListing[] = [];
  try {
    listings = extractListings(html, defaultPortal);
    if (listings.length === 0 && text) {
      // Fallback: Plain-Text scannen wenn kein HTML lieferbar war
      const textAsHtml = text.replace(
        /(https?:\/\/\S+)/g,
        '<a href="$1">$1</a>',
      );
      listings = extractListings(textAsHtml, defaultPortal);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("extraction failed:", msg);
    await supabase
      .from("raw_emails")
      .update({ status: "failed", error_message: msg })
      .eq("id", rawEmail.id);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let createdOrMerged = 0;
  for (const l of listings) {
    const fp = fingerprintOf(l);

    // Tracking-/Click-Wrapper auflösen, bevor wir speichern
    const cleanUrl = await unwrapTrackingUrl(l.url);

    // Nur echte Portal-URLs als primary_url akzeptieren
    const safePrimaryUrl =
      cleanUrl && PORTAL_URL_RE.test(cleanUrl) && !TRACKING_RE.test(cleanUrl)
        ? cleanUrl
        : null;

    // Bilder mit Tracking-Wrapper verwerfen (wären keine echten Bilder)
    const cleanImage =
      l.image_url && TRACKING_RE.test(l.image_url) ? null : l.image_url ?? null;

    const { data: existing } = await supabase
      .from("listings")
      .select("id, primary_url, image_url")
      .eq("fingerprint", fp)
      .maybeSingle();

    let listingId: string;

    if (existing) {
      listingId = existing.id;
      const existingIsTracking =
        existing.primary_url && TRACKING_RE.test(existing.primary_url);
      // Tracking-URL durch saubere ersetzen, sonst alte behalten, sonst neue setzen
      const newPrimary = existingIsTracking
        ? (safePrimaryUrl ?? null)
        : (existing.primary_url ?? safePrimaryUrl ?? null);

      await supabase
        .from("listings")
        .update({
          last_seen_at: new Date().toISOString(),
          primary_url: newPrimary,
          image_url: existing.image_url ?? cleanImage,
        })
        .eq("id", listingId);
    } else {
      const geo = await geocodeAddress(l.address, l.postal_code, l.city);
      const { data: created, error: createErr } = await supabase
        .from("listings")
        .insert({
          title: l.title,
          description: l.description ?? null,
          price_chf: l.price_chf ?? null,
          area_sqm: l.area_sqm ?? null,
          rooms: l.rooms ?? null,
          city: l.city ?? null,
          postal_code: l.postal_code ?? null,
          address: l.address ?? null,
          latitude: geo?.lat ?? null,
          longitude: geo?.lon ?? null,
          primary_portal: l.portal,
          primary_url: safePrimaryUrl,
          image_url: cleanImage,
          fingerprint: fp,
        })
        .select("id")
        .single();
      if (createErr || !created) {
        console.error("listing insert failed", createErr);
        continue;
      }
      listingId = created.id;
    }

    // listing_sources nur mit sauberer URL speichern (sonst sehen wir wieder Sendgrid-Links im UI)
    if (safePrimaryUrl) {
      const { data: srcExists } = await supabase
        .from("listing_sources")
        .select("id")
        .eq("listing_id", listingId)
        .eq("portal", l.portal)
        .eq("url", safePrimaryUrl)
        .maybeSingle();

      if (!srcExists) {
        await supabase.from("listing_sources").insert({
          listing_id: listingId,
          raw_email_id: rawEmail.id,
          portal: l.portal,
          url: safePrimaryUrl,
        });
      }
    }

    // FREE: Bilder direkt vom Portal scrapen (0 Credits) und in listing_images ablegen.
    // Das ersetzt den manuellen "Bilder importieren"-Klick für Homegate/Flatfox/etc.
    if (safePrimaryUrl) {
      try {
        const scraped = await scrapeImagesFree(safePrimaryUrl);
        if (scraped.length > 0) {
          // bestehende Bilder dieser Listing-ID laden, um Duplikate zu vermeiden
          const { data: existingImgs } = await supabase
            .from("listing_images")
            .select("url, sort_order")
            .eq("listing_id", listingId);
          const existingSet = new Set(
            (existingImgs ?? []).map((r: { url: string }) => r.url),
          );
          const startSort =
            (existingImgs ?? []).reduce(
              (m: number, r: { sort_order: number | null }) =>
                Math.max(m, r.sort_order ?? 0),
              -1,
            ) + 1;
          const fresh = scraped.filter((u) => !existingSet.has(u));
          if (fresh.length > 0) {
            const rows = fresh.map((u, i) => ({
              listing_id: listingId,
              url: u,
              sort_order: startSort + i,
            }));
            await supabase.from("listing_images").insert(rows);
          }
          // image_url setzen, falls noch leer
          if (!cleanImage && fresh[0]) {
            await supabase
              .from("listings")
              .update({ image_url: fresh[0] })
              .eq("id", listingId);
          }
        }
      } catch (e) {
        console.warn("free image scrape failed:", e);
      }
    }

    createdOrMerged++;
  }

  await supabase
    .from("raw_emails")
    .update({ status: "processed", listings_extracted: createdOrMerged })
    .eq("id", rawEmail.id);

  return new Response(
    JSON.stringify({ ok: true, listings: createdOrMerged, raw_email_id: rawEmail.id }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
