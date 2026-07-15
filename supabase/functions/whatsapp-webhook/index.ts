// WhatsApp Webhook — meinwohntraum.ai Immobilien-Bot
// GET  -> Meta Webhook Verification
// POST -> Nachrichten empfangen und beantworten
//
// Exportiert außerdem `notifyMatchingSubscriptions(inserat)` für andere
// Edge Functions (z.B. enrich-listing) um passende Suchabos zu benachrichtigen.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WA_TOKEN = Deno.env.get("WHATSAPP_TOKEN") ?? "";
const WA_PHONE_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") ?? "";
const WA_VERIFY = Deno.env.get("WHATSAPP_VERIFY_TOKEN") ?? "";
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// --- City medians (CHF/m²) ---------------------------------------------------
const MEDIANS: Record<string, { miete: number; kauf: number }> = {
  zürich: { miete: 32, kauf: 14500 },
  zurich: { miete: 32, kauf: 14500 },
  basel: { miete: 24, kauf: 9200 },
  bern: { miete: 25, kauf: 8800 },
  genf: { miete: 34, kauf: 15200 },
  lausanne: { miete: 30, kauf: 12800 },
  luzern: { miete: 27, kauf: 11200 },
  winterthur: { miete: 24, kauf: 9800 },
  zug: { miete: 33, kauf: 15800 },
  st_gallen: { miete: 21, kauf: 7900 },
};

function einschaetzung(preis: number | null, area: number | null, stadt: string | null, typ: "miete" | "kauf"): string {
  if (!preis || !area || !stadt) return "keine Einschätzung";
  const m = MEDIANS[stadt.toLowerCase().replace(/\s+/g, "_")] ?? MEDIANS[stadt.toLowerCase()];
  if (!m) return "keine Einschätzung";
  const perSqm = preis / area;
  const ratio = perSqm / m[typ];
  if (ratio < 0.93) return "fair 🟢";
  if (ratio > 1.12) return "teuer 🔴";
  return "verhandelbar 🟡";
}

// --- WhatsApp send -----------------------------------------------------------
async function sendWhatsApp(to: string, text: string): Promise<void> {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.error("WhatsApp credentials missing");
    return;
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WA_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text.slice(0, 4000) },
      }),
    });
    if (!res.ok) {
      console.error("WA send fail", res.status, await res.text());
    } else {
      await supabase.from("whatsapp_nachricht").insert({
        telefon: to,
        richtung: "aus",
        inhalt: text,
      });
    }
  } catch (e) {
    console.error("WA send error", e);
  }
}

// --- Anthropic ---------------------------------------------------------------
type ParseResult = {
  typ: "miete" | "kauf" | null;
  stadt: string | null;
  kanton: string | null;
  objektart: "wohnung" | "haus" | null;
  min_zimmer: number | null;
  max_preis: number | null;
  hat_garten: boolean | null;
  seesicht: boolean | null;
  zusammenfassung: string;
};

const PARSE_SYSTEM = `Du bist ein Parser für eine Schweizer Immobiliensuche auf WhatsApp. Extrahiere strukturierte Filter aus der Nutzeranfrage. Antworte NUR mit JSON:
{"typ": "miete"|"kauf"|null, "stadt": string|null, "kanton": string|null, "objektart": "wohnung"|"haus"|null, "min_zimmer": number|null, "max_preis": number|null, "hat_garten": true|false|null, "seesicht": true|false|null, "zusammenfassung": "kurzer Satz auf Deutsch"}
Schweizerdeutsch verstehen: "Wohnig"=Wohnung, "chaufe"=kaufen, "Garte"=Garten`;

async function claude(system: string, user: string): Promise<string | null> {
  if (!ANTHROPIC_KEY) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 512,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) {
      console.error("Claude fail", res.status, await res.text());
      return null;
    }
    const j = await res.json();
    return j?.content?.[0]?.text ?? null;
  } catch (e) {
    console.error("Claude error", e);
    return null;
  }
}

function extractJson(s: string): any | null {
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function fallbackParse(text: string): ParseResult {
  const t = text.toLowerCase();
  const staedte = ["zürich", "zurich", "basel", "bern", "genf", "lausanne", "luzern", "winterthur", "zug", "st. gallen", "st gallen"];
  const stadt = staedte.find((s) => t.includes(s)) ?? null;
  const typ: "miete" | "kauf" | null = /kauf|chaufe|kaufen|eigentum/.test(t)
    ? "kauf"
    : /miet|mieten|zur miete/.test(t)
      ? "miete"
      : null;
  const objektart: "wohnung" | "haus" | null = /haus|einfamilien|villa/.test(t)
    ? "haus"
    : /wohnung|wohnig|appartement/.test(t)
      ? "wohnung"
      : null;
  const zimMatch = t.match(/(\d(?:[.,]5)?)\s*(?:zi|zimmer)/);
  const min_zimmer = zimMatch ? parseFloat(zimMatch[1].replace(",", ".")) : null;
  const preisMatch = t.match(/(\d[\d'']?\d{2,})\s*(?:chf|fr|franken|.-)?/);
  const max_preis = preisMatch ? parseInt(preisMatch[1].replace(/['']/g, "")) : null;
  return {
    typ,
    stadt: stadt ? stadt.charAt(0).toUpperCase() + stadt.slice(1) : null,
    kanton: null,
    objektart,
    min_zimmer,
    max_preis,
    hat_garten: /garte|garten/.test(t) ? true : null,
    seesicht: /seesicht|see/.test(t) ? true : null,
    zusammenfassung: "Suche gespeichert",
  };
}

async function parseNeueSuche(text: string): Promise<ParseResult> {
  const raw = await claude(PARSE_SYSTEM, text);
  if (raw) {
    const j = extractJson(raw);
    if (j) return { ...fallbackParse(text), ...j };
  }
  return fallbackParse(text);
}

// --- Listings suchen ---------------------------------------------------------
async function findListings(filter: ParseResult, limit = 3) {
  let q = supabase
    .from("listings")
    .select("id, title, address, city, canton, postal_code, rooms, area_sqm, price_chf, description, primary_url")
    .is("archived_at", null)
    .not("price_chf", "is", null)
    .not("area_sqm", "is", null)
    .order("first_seen_at", { ascending: false })
    .limit(limit);

  if (filter.stadt) q = q.ilike("city", `%${filter.stadt}%`);
  if (filter.kanton) q = q.ilike("canton", `%${filter.kanton}%`);
  if (filter.min_zimmer) q = q.gte("rooms", filter.min_zimmer);
  if (filter.max_preis) q = q.lte("price_chf", filter.max_preis);
  if (filter.objektart === "haus") q = q.ilike("building_category", "%haus%");

  const { data, error } = await q;
  if (error) {
    console.error("findListings error", error);
    return [];
  }
  return data ?? [];
}

function formatListing(l: any, typ: "miete" | "kauf"): string {
  const preis = l.price_chf ? `CHF ${Number(l.price_chf).toLocaleString("de-CH")}.${typ === "miete" ? "–/Mt." : "–"}` : "Preis auf Anfrage";
  const flaeche = l.area_sqm ? `${l.area_sqm} m²` : "";
  const zi = l.rooms ? `${l.rooms} Zi` : "";
  const meta = [zi, flaeche, typ === "miete" ? "Miete" : "Kauf"].filter(Boolean).join(" · ");
  const einsch = einschaetzung(l.price_chf, l.area_sqm, l.city, typ);
  const desc = (l.description ?? "").slice(0, 100).replace(/\s+/g, " ").trim();
  return [
    `🟢 *${l.title ?? l.address ?? "Inserat"}*`,
    ``,
    `📍 ${[l.city, l.canton].filter(Boolean).join(", ") || "—"}`,
    meta ? `🏠 ${meta}` : "",
    `💰 ${preis}`,
    desc ? `\n_${desc}_` : "",
    ``,
    `Einschätzung: ${einsch}`,
    l.primary_url ? `\n${l.primary_url}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// --- Message handler ---------------------------------------------------------
const REFINE_SYSTEM = `Du bist ein Assistent für eine Schweizer Immobiliensuche auf WhatsApp. Der Nutzer hat bereits ein aktives Suchabo mit gespeicherten Filtern. Interpretiere die neue Nachricht.
Antworte NUR mit JSON:
{"aktion": "verfeinern"|"interesse"|"stopp"|"unklar", "aktualisierte_filter": {typ, stadt, kanton, objektart, min_zimmer, max_preis, hat_garten, seesicht}, "antwort": "kurze deutsche Antwort"}
Schweizerdeutsch verstehen. Bei "Ja, interessiert" oder ähnlich → aktion="interesse".`;

async function handleTextMessage(from: string, text: string): Promise<void> {
  await supabase.from("whatsapp_nachricht").insert({
    telefon: from,
    richtung: "ein",
    inhalt: text,
  });

  const clean = text.trim().toLowerCase();
  if (/^(stop|stopp|abmelden|lösch|loesch)/i.test(clean)) {
    await supabase.from("suchabo").update({ aktiv: false }).eq("kontakt", from);
    await supabase.from("whatsapp_nachricht").delete().eq("telefon", from);
    await sendWhatsApp(from, "Du bist abgemeldet. Alle deine Daten wurden gelöscht. Schreib jederzeit wieder, um eine neue Suche zu starten. 👋");
    return;
  }

  const { data: aboRows } = await supabase
    .from("suchabo")
    .select("*")
    .eq("kontakt", from)
    .eq("aktiv", true)
    .order("erstellt_am", { ascending: false })
    .limit(1);
  const abo = aboRows?.[0];

  if (!abo) {
    // Neue Suche
    const parsed = await parseNeueSuche(text);
    const { data: neu } = await supabase
      .from("suchabo")
      .insert({
        kontakt: from,
        kanal: "whatsapp",
        filter_json: parsed,
        aktiv: true,
      })
      .select()
      .single();

    const treffer = await findListings(parsed, 3);
    if (treffer.length === 0) {
      await sendWhatsApp(from, `Ich habe deine Suche gespeichert: _${parsed.zusammenfassung}_\n\nAktuell keine passenden Inserate — ich melde mich, sobald etwas Neues reinkommt. 🔔\n\nSchreib 'STOP' zum Abmelden.`);
      return;
    }
    await sendWhatsApp(from, `Gefunden — ${treffer.length} passende Inserate für _${parsed.zusammenfassung}_:`);
    for (const l of treffer) {
      await sendWhatsApp(from, formatListing(l, parsed.typ ?? "miete"));
    }
    await sendWhatsApp(from, "Antworte mit 'Ja, interessiert' oder sag was dir nicht passt (z.B. 'lieber grösser' oder 'nur mit Garten'). Schreib 'STOP' zum Abmelden.");
    void neu;
    return;
  }

  // Verfeinerung
  const raw = await claude(REFINE_SYSTEM, `Aktuelle Filter: ${JSON.stringify(abo.filter_json)}\nNeue Nachricht: ${text}`);
  const parsed = raw ? extractJson(raw) : null;
  const aktion = parsed?.aktion ?? "unklar";

  if (aktion === "stopp") {
    await supabase.from("suchabo").update({ aktiv: false }).eq("id", abo.id);
    await supabase.from("whatsapp_nachricht").delete().eq("telefon", from);
    await sendWhatsApp(from, "Du bist abgemeldet. Alle deine Daten wurden gelöscht. 👋");
    return;
  }

  if (aktion === "interesse") {
    // letzte gesendete Inserate → nimm neusten Treffer
    const treffer = await findListings(abo.filter_json as ParseResult, 1);
    const inserat_id = treffer[0]?.id ?? null;
    await supabase.from("lead").insert({
      inserat_id,
      suchabo_id: abo.id,
      kanal: "whatsapp",
      status: "neu",
    });
    await sendWhatsApp(from, parsed?.antwort ?? "Perfekt — ich habe dein Interesse notiert. Ein Mitarbeiter meldet sich in Kürze bei dir. 🙌");
    return;
  }

  if (aktion === "verfeinern") {
    const merged = { ...(abo.filter_json as object), ...(parsed.aktualisierte_filter ?? {}) } as ParseResult;
    await supabase
      .from("suchabo")
      .update({ filter_json: merged, zuletzt_geaendert: new Date().toISOString() })
      .eq("id", abo.id);
    const treffer = await findListings(merged, 3);
    if (treffer.length === 0) {
      await sendWhatsApp(from, "Filter angepasst — aktuell keine Treffer. Ich melde mich bei neuen Inseraten. 🔔");
      return;
    }
    await sendWhatsApp(from, parsed?.antwort ?? "Filter angepasst — hier neue Treffer:");
    for (const l of treffer) {
      await sendWhatsApp(from, formatListing(l, merged.typ ?? "miete"));
    }
    return;
  }

  await sendWhatsApp(from, parsed?.antwort ?? "Sorry, das habe ich nicht verstanden. Sag mir z.B. 'lieber günstiger' oder 'Ja, interessiert am ersten'. Schreib 'STOP' zum Abmelden.");
}

// --- Public helper: notify matching subscriptions ---------------------------
export async function notifyMatchingSubscriptions(inserat: any): Promise<void> {
  try {
    const { data: abos } = await supabase.from("suchabo").select("*").eq("aktiv", true).eq("kanal", "whatsapp");
    for (const abo of abos ?? []) {
      const f = (abo.filter_json ?? {}) as ParseResult;
      if (f.stadt && !(inserat.city ?? "").toLowerCase().includes(f.stadt.toLowerCase())) continue;
      if (f.min_zimmer && (!inserat.rooms || inserat.rooms < f.min_zimmer)) continue;
      if (f.max_preis && (!inserat.price_chf || inserat.price_chf > f.max_preis)) continue;
      if (f.objektart === "haus" && !/haus/i.test(inserat.building_category ?? "")) continue;
      await sendWhatsApp(
        abo.kontakt,
        `🔔 Neues passendes Inserat:\n\n${formatListing(inserat, f.typ ?? "miete")}\n\nAntworte 'Ja, interessiert' wenn du mehr wissen willst.`,
      );
    }
  } catch (e) {
    console.error("notifyMatchingSubscriptions error", e);
  }
}

// --- HTTP entrypoint ---------------------------------------------------------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  const url = new URL(req.url);

  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === WA_VERIFY && challenge) {
      return new Response(challenge, { status: 200, headers: { ...CORS, "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403, headers: CORS });
  }

  if (req.method === "POST") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Fire-and-forget verarbeiten
    (async () => {
      try {
        const entries = body?.entry ?? [];
        for (const entry of entries) {
          for (const change of entry?.changes ?? []) {
            const messages = change?.value?.messages ?? [];
            for (const msg of messages) {
              const from = msg?.from;
              if (!from) continue;
              let text: string | null = null;
              if (msg.type === "text") text = msg.text?.body ?? null;
              else if (msg.type === "button") text = msg.button?.text ?? msg.button?.payload ?? null;
              else if (msg.type === "interactive") {
                text =
                  msg.interactive?.button_reply?.title ??
                  msg.interactive?.list_reply?.title ??
                  null;
              }
              if (!text) continue;
              await handleTextMessage(from, text);
            }
          }
        }
      } catch (e) {
        console.error("POST handler error", e);
      }
    })();

    return new Response("EVENT_RECEIVED", { status: 200, headers: CORS });
  }

  return new Response("Method not allowed", { status: 405, headers: CORS });
});
