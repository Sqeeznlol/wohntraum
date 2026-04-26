import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// ============= Device + UA detection =============
function parseUA(ua: string) {
  const u = (ua || "").toLowerCase();
  let os = "Unbekannt";
  let device = "Desktop";
  let browser = "Unbekannt";
  let deviceName = "";

  // ---------- OS / device class ----------
  if (/iphone/.test(u)) {
    os = "iOS";
    device = "iPhone";
    deviceName = detectIphoneModel(ua) || "iPhone";
  } else if (/ipad/.test(u)) {
    os = "iPadOS";
    device = "iPad";
    deviceName = "iPad";
  } else if (/android/.test(u)) {
    os = "Android";
    device = /mobile/.test(u) ? "Android Phone" : "Android Tablet";
    deviceName = detectAndroidModel(ua) || device;
  } else if (/mac os x|macintosh/.test(u)) {
    os = "macOS";
    device = "Mac";
    deviceName = "Mac";
  } else if (/windows nt 10/.test(u)) {
    os = "Windows 10/11";
    device = "PC";
    deviceName = "Windows PC";
  } else if (/windows/.test(u)) {
    os = "Windows";
    device = "PC";
    deviceName = "Windows PC";
  } else if (/linux/.test(u)) {
    os = "Linux";
    device = "PC";
    deviceName = "Linux PC";
  } else if (/cros/.test(u)) {
    os = "ChromeOS";
    device = "Chromebook";
    deviceName = "Chromebook";
  }

  // ---------- Browser ----------
  if (/edg\//.test(u)) browser = "Edge";
  else if (/opr\/|opera/.test(u)) browser = "Opera";
  else if (/chrome\//.test(u) && !/edg\/|opr\//.test(u)) browser = "Chrome";
  else if (/firefox\//.test(u)) browser = "Firefox";
  else if (/safari\//.test(u) && !/chrome\//.test(u)) browser = "Safari";

  return { os, device, browser, deviceName };
}

// Try to figure out which Android device this is (e.g. "Pixel 8", "SM-S921B")
function detectAndroidModel(ua: string): string | null {
  // Android UA: Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/...)
  const m = ua.match(/Android\s+[\d.]+;\s*([^)]+?)(?:\s+Build\/|\)|;)/i);
  if (!m) return null;
  let model = m[1].trim();
  // Strip locale prefixes like "de-ch;" "wv;" etc.
  model = model.replace(/^[a-z]{2}-[a-z]{2};\s*/i, "");
  model = model.replace(/^wv\s*/i, ""); // WebView
  // Common Samsung mapping
  const samsung: Record<string, string> = {
    "SM-S928": "Galaxy S24 Ultra",
    "SM-S926": "Galaxy S24+",
    "SM-S921": "Galaxy S24",
    "SM-S918": "Galaxy S23 Ultra",
    "SM-S916": "Galaxy S23+",
    "SM-S911": "Galaxy S23",
    "SM-S908": "Galaxy S22 Ultra",
    "SM-S906": "Galaxy S22+",
    "SM-S901": "Galaxy S22",
    "SM-A546": "Galaxy A54",
    "SM-A536": "Galaxy A53",
  };
  for (const [code, name] of Object.entries(samsung)) {
    if (model.toUpperCase().startsWith(code)) return name;
  }
  return model || null;
}

// iPhone model from screen size hints (best-effort, UA alone doesn't give model)
function detectIphoneModel(ua: string): string | null {
  // iPhone UA doesn't contain model. Just return generic "iPhone"
  // Could be enhanced with client hints later
  return "iPhone";
}

// ============= Reverse DNS =============
async function reverseDns(ip: string): Promise<string | null> {
  try {
    if (!ip || ip === "127.0.0.1" || ip === "::1") return "localhost";
    if (ip.includes(":")) return null; // skip IPv6 PTR
    const arpa = ip.split(".").reverse().join(".") + ".in-addr.arpa";
    const r = await fetch(`https://1.1.1.1/dns-query?name=${arpa}&type=PTR`, {
      headers: { Accept: "application/dns-json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { Answer?: Array<{ data: string }> };
    const ans = j.Answer?.[0]?.data;
    return ans ? ans.replace(/\.$/, "") : null;
  } catch {
    return null;
  }
}

// ============= ISO country code -> full German name =============
const COUNTRY_DE: Record<string, string> = {
  CH: "Schweiz", DE: "Deutschland", AT: "Österreich", FR: "Frankreich",
  IT: "Italien", LI: "Liechtenstein", US: "USA", GB: "Vereinigtes Königreich",
  NL: "Niederlande", BE: "Belgien", ES: "Spanien", PT: "Portugal",
  PL: "Polen", CZ: "Tschechien", SE: "Schweden", NO: "Norwegen",
  DK: "Dänemark", FI: "Finnland", IE: "Irland", LU: "Luxemburg",
  TR: "Türkei", RU: "Russland", UA: "Ukraine", CN: "China", JP: "Japan",
  IN: "Indien", BR: "Brasilien", CA: "Kanada", AU: "Australien",
};
function expandCountry(c: string | null | undefined): string | null {
  if (!c) return null;
  const up = c.toUpperCase();
  if (up.length === 2 && COUNTRY_DE[up]) return COUNTRY_DE[up];
  return c;
}

// ============= Reverse geocode coords -> street address =============
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&accept-language=de`,
      { headers: { "User-Agent": "WohntraumVisitorTracker/1.0" } },
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      address?: {
        road?: string;
        house_number?: string;
        suburb?: string;
        neighbourhood?: string;
      };
      display_name?: string;
    };
    const a = j.address || {};
    const parts = [
      [a.road, a.house_number].filter(Boolean).join(" "),
      a.suburb || a.neighbourhood,
    ].filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  } catch {
    return null;
  }
}

// ============= Geo lookup (richer) =============
async function geoLookup(ip: string): Promise<{
  country: string | null;
  region: string | null;
  city: string | null;
  postal: string | null;
  isp: string | null;
  latitude: number | null;
  longitude: number | null;
}> {
  const empty = {
    country: null,
    region: null,
    city: null,
    postal: null,
    isp: null,
    latitude: null,
    longitude: null,
  };
  if (!ip || ip === "127.0.0.1" || ip === "::1" || ip === "unknown") return empty;

  // ip-api.com is free, no key, returns rich data including ISP and coords
  try {
    const r = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,zip,isp,org,lat,lon`,
    );
    if (r.ok) {
      const j = (await r.json()) as {
        status?: string;
        country?: string;
        regionName?: string;
        city?: string;
        zip?: string;
        isp?: string;
        org?: string;
        lat?: number;
        lon?: number;
      };
      if (j.status === "success") {
        return {
          country: j.country ?? null,
          region: j.regionName ?? null,
          city: j.city ?? null,
          postal: j.zip ?? null,
          isp: j.isp || j.org || null,
          latitude: typeof j.lat === "number" ? j.lat : null,
          longitude: typeof j.lon === "number" ? j.lon : null,
        };
      }
    }
  } catch {
    /* fall through to ipapi.co */
  }

  // Fallback: ipapi.co
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!r.ok) return empty;
    const j = (await r.json()) as {
      country_name?: string;
      region?: string;
      city?: string;
      postal?: string;
      org?: string;
      latitude?: number;
      longitude?: number;
    };
    return {
      country: j.country_name ?? null,
      region: j.region ?? null,
      city: j.city ?? null,
      postal: j.postal ?? null,
      isp: j.org ?? null,
      latitude: typeof j.latitude === "number" ? j.latitude : null,
      longitude: typeof j.longitude === "number" ? j.longitude : null,
    };
  } catch {
    return empty;
  }
}

export const Route = createFileRoute("/api/track-visit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            path?: string;
            referrer?: string;
            language?: string;
          };

          const headers = request.headers;
          const ip =
            headers.get("cf-connecting-ip") ||
            headers.get("x-real-ip") ||
            headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "unknown";

          const ua = headers.get("user-agent") || "";
          const cfCountry = headers.get("cf-ipcountry") || null;
          const cfCity = headers.get("cf-ipcity") || null;
          const cfRegion = headers.get("cf-region") || null;
          const parsed = parseUA(ua);

          const supabaseUrl =
            process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
          const serviceKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_PUBLISHABLE_KEY ||
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            "";
          const supabase = createClient(supabaseUrl, serviceKey);

          // Match by IP + user-agent (so multiple devices on same router = separate rows)
          const { data: existing } = await supabase
            .from("visitor_log")
            .select(
              "id, visit_count, is_blocked, hostname, country, region, city, postal, isp, latitude, longitude",
            )
            .eq("ip_address", ip)
            .eq("user_agent", ua)
            .maybeSingle();

          if (existing?.is_blocked) {
            return new Response(JSON.stringify({ blocked: true }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          let hostname = existing?.hostname ?? null;
          let country = existing?.country ?? cfCountry;
          let region = existing?.region ?? cfRegion;
          let city = existing?.city ?? cfCity;
          let postal = existing?.postal ?? null;
          let isp = existing?.isp ?? null;
          let latitude = existing?.latitude ?? null;
          let longitude = existing?.longitude ?? null;

          if (!existing) {
            hostname = await reverseDns(ip);
            const geo = await geoLookup(ip);
            country = country || geo.country;
            region = region || geo.region;
            city = city || geo.city;
            postal = postal || geo.postal;
            isp = isp || geo.isp;
            latitude = latitude ?? geo.latitude;
            longitude = longitude ?? geo.longitude;

            // If the reverse-DNS hostname looks like an ISP (e.g. cablecom, swisscom),
            // use that as ISP fallback.
            if (!isp && hostname) {
              const m = hostname.match(/(swisscom|sunrise|salt|cablecom|init7|upc|green)/i);
              if (m) isp = m[1];
            }
          }

          if (existing) {
            await supabase
              .from("visitor_log")
              .update({
                visit_count: (existing.visit_count ?? 0) + 1,
                last_seen_at: new Date().toISOString(),
                user_agent: ua,
                os: parsed.os,
                browser: parsed.browser,
                device_type: parsed.device,
                device_name: parsed.deviceName || parsed.device,
                language: body.language ?? null,
                referrer: body.referrer ?? null,
                path: body.path ?? null,
              })
              .eq("id", existing.id);
          } else {
            await supabase.from("visitor_log").insert({
              ip_address: ip,
              user_agent: ua,
              os: parsed.os,
              browser: parsed.browser,
              device_type: parsed.device,
              device_name: parsed.deviceName || parsed.device,
              hostname,
              country,
              region,
              city,
              postal,
              isp,
              latitude,
              longitude,
              language: body.language ?? null,
              referrer: body.referrer ?? null,
              path: body.path ?? null,
            });
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      },
    },
  },
});
