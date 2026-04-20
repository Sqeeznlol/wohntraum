// Backfill geocoding for listings missing lat/lng
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function geocode(
  address: string | null,
  postal: string | null,
  city: string | null,
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
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { data: rows, error } = await supabase
    .from("listings")
    .select("id, address, postal_code, city")
    .is("latitude", null)
    .or("address.not.is.null,city.not.is.null")
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let updated = 0;
  for (const r of rows ?? []) {
    const geo = await geocode(r.address, r.postal_code, r.city);
    if (geo) {
      await supabase
        .from("listings")
        .update({ latitude: geo.lat, longitude: geo.lon })
        .eq("id", r.id);
      updated++;
    }
    // be polite to Nominatim — 1 req/sec
    await new Promise((r) => setTimeout(r, 1100));
  }

  return new Response(
    JSON.stringify({ ok: true, processed: rows?.length ?? 0, updated }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
