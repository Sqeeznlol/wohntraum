// Backfill enrichment: walks the entire active+incomplete listings table once,
// processing 10 listings per invocation using a keyset cursor (created_at, id) DESC.
// Self-chains via fire-and-forget fetch to bypass the 150s function timeout.
// Each listing is processed AT MOST ONCE per run, even if scraping fails.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SELF_URL = `${SUPABASE_URL}/functions/v1/enrich-backfill`;
const ENRICH_URL = `${SUPABASE_URL}/functions/v1/enrich-listing`;
const BATCH_SIZE = 10;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const cursorCreatedAt: string | null = body.cursor_created_at ?? null;
    const cursorId: string | null = body.cursor_id ?? null;
    const runId: string = body.run_id ?? crypto.randomUUID();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Keyset pagination: created_at DESC, id DESC.
    // Fetch listings strictly "after" (i.e. older than) the cursor in DESC order.
    let q = supabase
      .from("listings")
      .select("id, created_at, primary_url")
      .is("archived_at", null)
      .eq("source_available", true)
      .or("image_url.is.null,price_chf.is.null,area_sqm.is.null,address.is.null")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(BATCH_SIZE);

    if (cursorCreatedAt && cursorId) {
      // (created_at, id) < (cursor_created_at, cursor_id) in DESC order
      q = q.or(
        `created_at.lt.${cursorCreatedAt},and(created_at.eq.${cursorCreatedAt},id.lt.${cursorId})`,
      );
    }

    const { data: batch, error } = await q;
    if (error) throw error;

    const empty = !batch || batch.length === 0;
    console.log(`[backfill ${runId}] batch size=${batch?.length ?? 0} cursor=${cursorCreatedAt ?? "∅"}/${cursorId ?? "∅"} empty=${empty}`);

    if (empty) {
      return new Response(
        JSON.stringify({ run_id: runId, done: true, processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let succeeded = 0;
    for (const l of batch!) {
      try {
        const r = await fetch(ENRICH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing_id: l.id }),
        });
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          if (j?.results?.[0]?.ok) succeeded++;
        }
      } catch (e) {
        console.warn(`[backfill ${runId}] enrich failed for ${l.id}:`, e instanceof Error ? e.message : e);
      }
    }

    const last = batch![batch!.length - 1];
    const nextCursor = { cursor_created_at: last.created_at, cursor_id: last.id, run_id: runId };

    console.log(`[backfill ${runId}] processed=${batch!.length} succeeded=${succeeded} next_cursor=${last.created_at}/${last.id}`);

    // Self-chain fire-and-forget. Don't await — let response return immediately.
    fetch(SELF_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextCursor),
    }).catch((e) => console.warn(`[backfill ${runId}] self-chain failed:`, e));

    return new Response(
      JSON.stringify({ run_id: runId, processed: batch!.length, succeeded, next_cursor: nextCursor, done: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("enrich-backfill error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
