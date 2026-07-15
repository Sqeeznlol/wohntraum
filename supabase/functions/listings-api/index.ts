// Public REST API for external bot platforms (e.g. Botpress)
// GET /listings-api?city=...&max_price=...&min_rooms=...&canton=...
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function bewerten(pricePerSqm: number | null, median: number | null): { bewertung: string; emoji: string } {
  if (!pricePerSqm || !median) return { bewertung: "unbekannt", emoji: "⚪" };
  const ratio = pricePerSqm / median;
  if (ratio <= 0.9) return { bewertung: "fair", emoji: "🟢" };
  if (ratio <= 1.15) return { bewertung: "verhandelbar", emoji: "🟡" };
  return { bewertung: "teuer", emoji: "🔴" };
}

function median(nums: number[]): number | null {
  const arr = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (arr.length === 0) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  try {
    const url = new URL(req.url);
    const city = url.searchParams.get("city");
    const canton = url.searchParams.get("canton");
    const maxPrice = url.searchParams.get("max_price");
    const minRooms = url.searchParams.get("min_rooms");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let q = supabase
      .from("listings")
      .select("id, title, city, canton, rooms, area_sqm, price_chf, description, primary_url, image_url, price_per_sqm")
      .neq("status", "rejected")
      .not("price_chf", "is", null)
      .order("first_seen_at", { ascending: false })
      .limit(5);

    if (city) q = q.ilike("city", `%${city}%`);
    if (canton) q = q.ilike("canton", `%${canton}%`);
    if (maxPrice) q = q.lte("price_chf", Number(maxPrice));
    if (minRooms) q = q.gte("rooms", Number(minRooms));

    const { data: listings, error } = await q;
    if (error) return json({ error: error.message }, 500);

    // Median-Preis/m² für Vergleich (aus gleicher Stadt oder gesamt)
    let refQ = supabase
      .from("listings")
      .select("price_per_sqm")
      .not("price_per_sqm", "is", null)
      .neq("status", "rejected")
      .limit(200);
    if (city) refQ = refQ.ilike("city", `%${city}%`);
    const { data: refData } = await refQ;
    const med = median((refData ?? []).map((r: { price_per_sqm: number }) => Number(r.price_per_sqm)));

    const enriched = (listings ?? []).map((l) => {
      const { bewertung, emoji } = bewerten(l.price_per_sqm ? Number(l.price_per_sqm) : null, med);
      return {
        id: l.id,
        title: l.title,
        city: l.city,
        canton: l.canton,
        rooms: l.rooms,
        area_sqm: l.area_sqm,
        price_chf: l.price_chf,
        description: l.description,
        primary_url: l.primary_url,
        image_url: l.image_url,
        bewertung,
        bewertung_emoji: emoji,
      };
    });

    return json({
      count: enriched.length,
      query: {
        ...(city && { city }),
        ...(canton && { canton }),
        ...(maxPrice && { max_price: Number(maxPrice) }),
        ...(minRooms && { min_rooms: Number(minRooms) }),
      },
      median_price_per_sqm: med,
      listings: enriched,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
