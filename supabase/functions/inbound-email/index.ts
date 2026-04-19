// Inbound Email Webhook
// Receives forwarded real-estate alert emails, extracts listings via Lovable AI,
// computes CHF/m², deduplicates, and stores them.
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
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

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

async function extractListingsWithAI(
  subject: string,
  html: string,
  text: string,
  defaultPortal: Portal,
): Promise<ExtractedListing[]> {
  const content = `Subject: ${subject}\n\nHTML:\n${html.slice(0, 60000)}\n\nText:\n${text.slice(0, 10000)}`;

  const tools = [
    {
      type: "function",
      function: {
        name: "save_listings",
        description:
          "Extract every individual real-estate listing from the email. Return one item per property.",
        parameters: {
          type: "object",
          properties: {
            listings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  price_chf: {
                    type: "number",
                    description: "Price in CHF as a number, no currency symbol",
                  },
                  area_sqm: { type: "number", description: "Area in square meters" },
                  rooms: { type: "number" },
                  city: { type: "string" },
                  postal_code: { type: "string" },
                  address: { type: "string" },
                  portal: {
                    type: "string",
                    enum: [
                      "immoscout24",
                      "homegate",
                      "flatfox",
                      "casasoft",
                      "immostreet",
                      "home_ch",
                      "newhome",
                      "other",
                    ],
                  },
                  url: { type: "string" },
                  image_url: { type: "string" },
                },
                required: ["title", "portal"],
              },
            },
          },
          required: ["listings"],
          additionalProperties: false,
        },
      },
    },
  ];

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You extract Swiss real-estate listings from search-alert emails. Always return ALL listings in the email. Prices are in CHF. Sizes in m². Use null for missing values. Default portal if unsure: " +
            defaultPortal,
        },
        { role: "user", content },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "save_listings" } },
    }),
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${t}`);
  }

  const data = await resp.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0];
  if (!call) return [];
  const args = JSON.parse(call.function.arguments);
  return (args.listings ?? []) as ExtractedListing[];
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

  const from =
    (payload.from as string) ??
    (payload.sender as string) ??
    (payload.From as string) ??
    "";
  const to =
    (payload.to as string) ??
    (payload.recipient as string) ??
    (payload.To as string) ??
    "";
  const subject =
    (payload.subject as string) ?? (payload.Subject as string) ?? "(no subject)";
  const html =
    (payload.html as string) ??
    (payload["html-body"] as string) ??
    (payload.body_html as string) ??
    "";
  const text =
    (payload.text as string) ??
    (payload["text-body"] as string) ??
    (payload.body_plain as string) ??
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
    listings = await extractListingsWithAI(subject, html, text, defaultPortal);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("AI extraction failed:", msg);
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

    // Try to find existing by fingerprint
    const { data: existing } = await supabase
      .from("listings")
      .select("id, primary_url, image_url")
      .eq("fingerprint", fp)
      .maybeSingle();

    let listingId: string;

    if (existing) {
      listingId = existing.id;
      await supabase
        .from("listings")
        .update({
          last_seen_at: new Date().toISOString(),
          // backfill missing fields
          primary_url: existing.primary_url ?? l.url ?? null,
          image_url: existing.image_url ?? l.image_url ?? null,
        })
        .eq("id", listingId);
    } else {
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
          primary_portal: l.portal,
          primary_url: l.url ?? null,
          image_url: l.image_url ?? null,
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

    // Add source row if not already linked
    const { data: srcExists } = await supabase
      .from("listing_sources")
      .select("id")
      .eq("listing_id", listingId)
      .eq("portal", l.portal)
      .eq("url", l.url ?? "")
      .maybeSingle();

    if (!srcExists) {
      await supabase.from("listing_sources").insert({
        listing_id: listingId,
        raw_email_id: rawEmail.id,
        portal: l.portal,
        url: l.url ?? null,
      });
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
