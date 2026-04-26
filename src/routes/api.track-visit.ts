import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

// Lightweight UA parser (no external deps)
function parseUA(ua: string) {
  const u = (ua || "").toLowerCase();
  let os = "Unbekannt";
  let device = "Desktop";
  let browser = "Unbekannt";

  if (/iphone/.test(u)) { os = "iOS"; device = "iPhone"; }
  else if (/ipad/.test(u)) { os = "iPadOS"; device = "iPad"; }
  else if (/android/.test(u)) {
    os = "Android";
    device = /mobile/.test(u) ? "Android Phone" : "Android Tablet";
  }
  else if (/mac os x|macintosh/.test(u)) { os = "macOS"; device = "Mac"; }
  else if (/windows nt 10/.test(u)) { os = "Windows 10/11"; device = "PC"; }
  else if (/windows/.test(u)) { os = "Windows"; device = "PC"; }
  else if (/linux/.test(u)) { os = "Linux"; device = "PC"; }
  else if (/cros/.test(u)) { os = "ChromeOS"; device = "Chromebook"; }

  if (/edg\//.test(u)) browser = "Edge";
  else if (/opr\/|opera/.test(u)) browser = "Opera";
  else if (/chrome\//.test(u) && !/edg\/|opr\//.test(u)) browser = "Chrome";
  else if (/firefox\//.test(u)) browser = "Firefox";
  else if (/safari\//.test(u) && !/chrome\//.test(u)) browser = "Safari";

  // Device model hint for iPhone/Android
  const modelMatch = ua.match(/\(([^)]+)\)/);
  let model = "";
  if (modelMatch) {
    const inner = modelMatch[1];
    const parts = inner.split(";").map((p) => p.trim());
    // Android: usually "Build/" appears with model
    const build = parts.find((p) => /build\//i.test(p));
    if (build) model = build.split(" build/")[0]?.split("/")[0] ?? "";
  }

  return { os, device, browser, model };
}

async function reverseDns(ip: string): Promise<string | null> {
  // Cloudflare 1.1.1.1 DNS-over-HTTPS PTR lookup (free, no key)
  try {
    if (!ip || ip === "127.0.0.1" || ip === "::1") return "localhost";
    let arpa = "";
    if (ip.includes(":")) {
      // IPv6 — skip PTR, too complex
      return null;
    }
    arpa = ip.split(".").reverse().join(".") + ".in-addr.arpa";
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

async function geoLookup(ip: string): Promise<{ country: string | null; city: string | null }> {
  try {
    if (!ip || ip === "127.0.0.1" || ip === "::1") return { country: null, city: null };
    const r = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!r.ok) return { country: null, city: null };
    const j = (await r.json()) as { country_name?: string; city?: string };
    return { country: j.country_name ?? null, city: j.city ?? null };
  } catch {
    return { country: null, city: null };
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

          // Extract real IP from CF / proxy headers
          const headers = request.headers;
          const ip =
            headers.get("cf-connecting-ip") ||
            headers.get("x-real-ip") ||
            headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "unknown";

          const ua = headers.get("user-agent") || "";
          const cfCountry = headers.get("cf-ipcountry") || null;
          const parsed = parseUA(ua);

          const supabaseUrl =
            process.env.SUPABASE_URL ||
            process.env.VITE_SUPABASE_URL ||
            "";
          const serviceKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_PUBLISHABLE_KEY ||
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            "";
          const supabase = createClient(supabaseUrl, serviceKey);

          // Check if visitor exists
          const { data: existing } = await supabase
            .from("visitor_log")
            .select("id, visit_count, is_blocked, hostname, country, city")
            .eq("ip_address", ip)
            .maybeSingle();

          if (existing?.is_blocked) {
            return new Response(JSON.stringify({ blocked: true }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          let hostname = existing?.hostname ?? null;
          let country = existing?.country ?? cfCountry;
          let city = existing?.city ?? null;

          if (!existing) {
            // Only do expensive lookups for new visitors
            hostname = await reverseDns(ip);
            const geo = await geoLookup(ip);
            country = country || geo.country;
            city = city || geo.city;
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
                device_type: parsed.model || parsed.device,
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
              device_type: parsed.model || parsed.device,
              hostname,
              country,
              city,
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
