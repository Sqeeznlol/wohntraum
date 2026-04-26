import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

type ActivityEvent = {
  event_type: string;
  event_label?: string | null;
  path?: string | null;
  listing_id?: string | null;
  target_id?: string | null;
  duration_ms?: number | null;
  metadata?: Record<string, unknown> | null;
  session_id?: string | null;
  ts?: number; // client timestamp
};

function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
  );
}

export const Route = createFileRoute("/api/track-activity")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = (await request.json().catch(() => ({}))) as {
            events?: ActivityEvent[];
          };
          const events = Array.isArray(body.events) ? body.events : [];
          if (events.length === 0) {
            return new Response(JSON.stringify({ ok: true, count: 0 }), {
              status: 200,
              headers: { "Content-Type": "application/json" },
            });
          }

          const headers = request.headers;
          const ip =
            headers.get("cf-connecting-ip") ||
            headers.get("x-real-ip") ||
            headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "unknown";
          const ua = headers.get("user-agent") || "";

          const supabaseUrl =
            process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
          const serviceKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY ||
            process.env.SUPABASE_PUBLISHABLE_KEY ||
            process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
            "";
          const supabase = createClient(supabaseUrl, serviceKey);

          // Skip if blocked
          const { data: blocked } = await supabase
            .from("visitor_log")
            .select("id")
            .eq("ip_address", ip)
            .eq("is_blocked", true)
            .limit(1)
            .maybeSingle();
          if (blocked) {
            return new Response(JSON.stringify({ blocked: true }), {
              status: 403,
              headers: { "Content-Type": "application/json" },
            });
          }

          const rows = events
            .filter((e) => e && typeof e.event_type === "string" && e.event_type.length <= 64)
            .slice(0, 100)
            .map((e) => ({
              ip_address: ip,
              user_agent: ua,
              session_id: e.session_id ?? null,
              event_type: e.event_type,
              event_label:
                typeof e.event_label === "string" ? e.event_label.slice(0, 500) : null,
              path: typeof e.path === "string" ? e.path.slice(0, 500) : null,
              listing_id: isUuid(e.listing_id) ? e.listing_id : null,
              target_id:
                typeof e.target_id === "string" ? e.target_id.slice(0, 200) : null,
              duration_ms:
                typeof e.duration_ms === "number" && e.duration_ms >= 0
                  ? Math.min(Math.round(e.duration_ms), 1000 * 60 * 60 * 12)
                  : null,
              metadata:
                e.metadata && typeof e.metadata === "object" ? e.metadata : {},
              created_at: e.ts ? new Date(e.ts).toISOString() : new Date().toISOString(),
            }));

          if (rows.length > 0) {
            await supabase.from("visitor_activity").insert(rows);
          }

          return new Response(JSON.stringify({ ok: true, count: rows.length }), {
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
