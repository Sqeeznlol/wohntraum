// WhatsApp Webhook — meinwohntraum.ai Immobilien-Bot
// GET  → Meta Webhook-Verifizierung
// POST → eingehende Nachrichten verarbeiten, sofort 200 antworten
//
// Tabellen (bereits vorhanden):
//   whatsapp_suchabo   (id int, telefon, filter_json jsonb, aktiv, erstellt_am, geaendert_am)
//   whatsapp_lead      (id int, inserat_id text, telefon, suchabo_id int, status, erstellt_am)
//   whatsapp_nachricht (id uuid, telefon, richtung 'ein'|'aus', inhalt, erstellt_am)
// Inserate liegen in der bestehenden `listings`-Tabelle.

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
const CLAUDE_MODEL = "claude-sonnet-4-5";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// -------------------------------------------------------------- Medians CHF/m²
const MEDIANS: Record<string, { miete: number; kauf: number }> = {
  zürich: { miete: 32, kauf: 14500 },
  zurich: { miete: 32, kauf: 14500 },
  basel: { miete: 24, kauf: 9200 },
  bern: { miete: 25, kauf: 8800 },
  genf: { miete: 34, kauf: 15200 },
  geneve: { miete: 34, kauf: 15200 },
  lausanne: { miete: 30, kauf: 12800 },
  luzern: { miete: 27, kauf: 11200 },
  winterthur: { miete: 24, kauf: 9800 },
  zug: { miete: 33, kauf: 15800 },
  "st. gallen": { miete: 21, kauf: 7900 },
  "st gallen": { miete: 21, kauf: 7900 },
};

function ampel(preis: number | null, area: number | null, stadt: string | null, typ: "miete" | "kauf"): { emoji: string; label: string } {
  if (!preis || !area || !stadt) return { emoji: "🟡", label: "keine Einschätzung" };
  const m = MEDIANS[stadt.toLowerCase()];
  if (!m) return { emoji: "🟡", label: "keine Einschätzung" };
  const ratio = preis / area / m[typ];
  if (ratio < 0.93) return { emoji: "🟢", label: "fair" };
  if (ratio > 1.12) return { emoji: "🔴", label: "teuer" };
  return { emoji: "🟡", label: "verhandelbar" };
}

// -------------------------------------------------------------- WhatsApp send
async function sendWhatsApp(to: string, text: string): Promise<void> {
  if (!WA_TOKEN || !WA_PHONE_ID) {
    console.error("WhatsApp credentials missing — nicht gesendet:", text.slice(0, 80));
    return;
  }
  const body = text.slice(0, 4000);
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
        text: { body },
      }),
    });
    if (!res.ok) {
      console.error("WA send fail", res.status, await res.text());
      return;
    }
    await supabase.from("whatsapp_nachricht").insert({ telefon: to, richtung: "aus", inhalt: body });
  } catch (e) {
    console.error("WA send error", e);
  }
}

// -------------------------------------------------------------- Anthropic
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
        model: CLAUDE_MODEL,
        max_tokens: 600,
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

type Filter = {
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

const PARSE_SYSTEM = `Du bist ein Parser für eine Schweizer Immobiliensuche auf WhatsApp. Extrahiere Filter aus der Anfrage. Antworte NUR mit JSON:
{"typ":"miete"|"kauf"|null,"stadt":string|null,"kanton":string|null,"objektart":"wohnung"|"haus"|null,"min_zimmer":number|null,"max_preis":number|null,"hat_garten":true|false|null,"seesicht":true|false|null,"zusammenfassung":"kurzer Satz auf Deutsch"}
Verstehe Schweizerdeutsch: Wohnig=Wohnung, Huus=Haus, chaufe=kaufen, tüür=teuer, Garte=Garten.`;

const REFINE_SYSTEM = `Du bist ein Assistent für eine WhatsApp-Immobiliensuche. Der Nutzer hat ein aktives Suchabo mit gespeicherten Filtern und antwortet nun auf gezeigte Inserate. Interpretiere die Nachricht.
Antworte NUR mit JSON:
{"aktion":"verfeinern"|"interesse"|"stopp"|"unklar","aktualisierte_filter":{"typ":...,"stadt":...,"kanton":...,"objektart":...,"min_zimmer":...,"max_preis":...,"hat_garten":...,"seesicht":...},"antwort":"kurze deutsche Antwort"}
"Ja","interessiert","erstes bitte","das da" → aktion="interesse". "zu teuer","grösser","günstiger","Seesicht","mit Garten" → aktion="verfeinern". Schweizerdeutsch verstehen.`;

// Fallback-Parser
function fallbackParse(text: string): Filter {
  const t = text.toLowerCase();
  const staedte = ["zürich", "zurich", "basel", "bern", "genf", "lausanne", "luzern", "winterthur", "zug", "st. gallen", "st gallen"];
  const stadtRaw = staedte.find((s) => t.includes(s)) ?? null;
  const typ: Filter["typ"] = /kauf|chaufe|kaufen|eigentum/.test(t)
    ? "kauf"
    : /miet|zur miete|zumieten/.test(t)
      ? "miete"
      : null;
  const objektart: Filter["objektart"] = /haus|huus|einfamilien|villa/.test(t)
    ? "haus"
    : /wohnung|wohnig|appartement|studio/.test(t)
      ? "wohnung"
      : null;
  const zi = t.match(/(\d(?:[.,]5)?)\s*(?:zi|zimmer)/);
  const min_zimmer = zi ? parseFloat(zi[1].replace(",", ".")) : null;
  const preis = t.match(/(\d[\d'']?\d{2,})/);
  const max_preis = preis ? parseInt(preis[1].replace(/['']/g, ""), 10) : null;
  return {
    typ,
    stadt: stadtRaw ? stadtRaw.charAt(0).toUpperCase() + stadtRaw.slice(1) : null,
    kanton: null,
    objektart,
    min_zimmer,
    max_preis,
    hat_garten: /garte|garten/.test(t) ? true : null,
    seesicht: /seesicht/.test(t) ? true : null,
    zusammenfassung: "Suche gespeichert",
  };
}

async function parseNeueSuche(text: string): Promise<Filter> {
  const raw = await claude(PARSE_SYSTEM, text);
  if (raw) {
    const j = extractJson(raw);
    if (j) return { ...fallbackParse(text), ...j };
  }
  return fallbackParse(text);
}

// -------------------------------------------------------------- Listings
async function findListings(f: Filter, limit = 3): Promise<any[]> {
  let q = supabase
    .from("listings")
    .select("id, title, address, city, canton, postal_code, rooms, area_sqm, price_chf, description, primary_url, building_category")
    .is("archived_at", null)
    .not("price_chf", "is", null)
    .not("area_sqm", "is", null)
    .order("first_seen_at", { ascending: false })
    .limit(limit);
  if (f.stadt) q = q.ilike("city", `%${f.stadt}%`);
  if (f.kanton) q = q.ilike("canton", `%${f.kanton}%`);
  if (f.min_zimmer) q = q.gte("rooms", f.min_zimmer);
  if (f.max_preis) q = q.lte("price_chf", f.max_preis);
  if (f.objektart === "haus") q = q.ilike("building_category", "%haus%");
  if (f.objektart === "wohnung") q = q.ilike("building_category", "%wohn%");
  const { data, error } = await q;
  if (error) {
    console.error("findListings error", error);
    return [];
  }
  return data ?? [];
}

function formatListing(l: any, typ: "miete" | "kauf"): string {
  const preisNum = l.price_chf ? Number(l.price_chf) : null;
  const preis = preisNum
    ? `CHF ${preisNum.toLocaleString("de-CH")}.${typ === "miete" ? "–/Mt." : "–"}`
    : "Preis auf Anfrage";
  const meta = [
    l.rooms ? `${l.rooms} Zi` : null,
    l.area_sqm ? `${l.area_sqm} m²` : null,
    typ === "miete" ? "Miete" : "Kauf",
  ]
    .filter(Boolean)
    .join(" · ");
  const a = ampel(preisNum, l.area_sqm, l.city, typ);
  const desc = (l.description ?? "").slice(0, 110).replace(/\s+/g, " ").trim();
  return [
    `${a.emoji} *${l.title ?? l.address ?? "Inserat"}*`,
    `📍 ${[l.city, l.canton].filter(Boolean).join(", ") || "—"}`,
    meta ? `🏠 ${meta}` : "",
    `💰 ${preis}  _(${a.label})_`,
    desc ? `_${desc}_` : "",
    l.primary_url ? l.primary_url : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// -------------------------------------------------------------- Handler
async function handleTextMessage(from: string, text: string): Promise<void> {
  await supabase.from("whatsapp_nachricht").insert({ telefon: from, richtung: "ein", inhalt: text });

  const clean = text.trim().toLowerCase();

  // STOP
  if (/^(stop|stopp|abmelden|lösch|loesch)/i.test(clean)) {
    await supabase.from("whatsapp_suchabo").update({ aktiv: false, geaendert_am: new Date().toISOString() }).eq("telefon", from);
    await supabase.from("whatsapp_nachricht").delete().eq("telefon", from);
    await sendWhatsApp(from, "Dein Suchabo wurde gelöscht und alle Daten entfernt. 👋 Schreib jederzeit wieder, um eine neue Suche zu starten.");
    return;
  }

  // Aktives Suchabo?
  const { data: aboRows } = await supabase
    .from("whatsapp_suchabo")
    .select("*")
    .eq("telefon", from)
    .eq("aktiv", true)
    .order("erstellt_am", { ascending: false })
    .limit(1);
  const abo = aboRows?.[0];

  if (!abo) {
    // Neue Suche
    const parsed = await parseNeueSuche(text);
    const { data: neu, error: aboErr } = await supabase
      .from("whatsapp_suchabo")
      .insert({ telefon: from, filter_json: parsed, aktiv: true })
      .select()
      .single();
    if (aboErr) console.error("insert whatsapp_suchabo", aboErr);

    const treffer = await findListings(parsed, 3);
    if (treffer.length === 0) {
      await sendWhatsApp(from, `Ich habe deine Suche gespeichert:\n_${parsed.zusammenfassung}_\n\nAktuell keine passenden Inserate — ich melde mich, sobald etwas Neues reinkommt. 🔔\n\n_Schreib 'STOP' zum Abmelden._`);
      return;
    }
    await sendWhatsApp(from, `Gefunden — ${treffer.length} passende Inserate für _${parsed.zusammenfassung}_:`);
    for (const l of treffer) {
      await sendWhatsApp(from, formatListing(l, parsed.typ ?? "miete"));
    }
    await sendWhatsApp(from, "Antworte mit *'Ja, interessiert'* oder sag was dir nicht passt (z.B. 'lieber grösser' oder 'nur mit Garten').\n_Schreib 'STOP' zum Abmelden._");
    void neu;
    return;
  }

  // Verfeinerung / Interesse
  const raw = await claude(
    REFINE_SYSTEM,
    `Aktuelle Filter: ${JSON.stringify(abo.filter_json)}\nNeue Nachricht des Nutzers: ${text}`,
  );
  const parsed = raw ? extractJson(raw) : null;
  const aktion = parsed?.aktion ?? (/(^|\s)(ja|interessiert|will|nehm)/i.test(clean) ? "interesse" : "unklar");

  if (aktion === "stopp") {
    await supabase.from("whatsapp_suchabo").update({ aktiv: false, geaendert_am: new Date().toISOString() }).eq("id", abo.id);
    await supabase.from("whatsapp_nachricht").delete().eq("telefon", from);
    await sendWhatsApp(from, "Dein Suchabo wurde gelöscht und alle Daten entfernt. 👋");
    return;
  }

  if (aktion === "interesse") {
    const treffer = await findListings(abo.filter_json as Filter, 1);
    const inserat_id = treffer[0]?.id ? String(treffer[0].id) : null;
    await supabase.from("whatsapp_lead").insert({
      inserat_id,
      telefon: from,
      suchabo_id: abo.id,
      status: "neu",
    });
    await sendWhatsApp(from, parsed?.antwort ?? "Perfekt — ich habe dein Interesse notiert. Ein Mitarbeiter meldet sich in Kürze bei dir. 🙌");
    return;
  }

  if (aktion === "verfeinern") {
    const merged: Filter = {
      ...(abo.filter_json as Filter),
      ...(parsed?.aktualisierte_filter ?? {}),
    };
    await supabase
      .from("whatsapp_suchabo")
      .update({ filter_json: merged, geaendert_am: new Date().toISOString() })
      .eq("id", abo.id);
    const treffer = await findListings(merged, 3);
    if (treffer.length === 0) {
      await sendWhatsApp(from, (parsed?.antwort ?? "Filter angepasst") + " — aktuell keine passenden Treffer. Ich melde mich, sobald etwas reinkommt. 🔔");
      return;
    }
    await sendWhatsApp(from, parsed?.antwort ?? "Filter angepasst — hier neue Treffer:");
    for (const l of treffer) {
      await sendWhatsApp(from, formatListing(l, merged.typ ?? "miete"));
    }
    return;
  }

  await sendWhatsApp(
    from,
    parsed?.antwort ??
      "Ich habe das nicht ganz verstanden. Sag mir z.B. *'Ja, interessiert'*, *'lieber günstiger'* oder *'nur mit Garten'*.\n_Schreib 'STOP' zum Abmelden._",
  );
}

// -------------------------------------------------------------- HTTP entry
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  // GET — Meta Webhook-Verifizierung
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && token === WA_VERIFY && challenge) {
      return new Response(challenge, { status: 200, headers: { ...CORS, "Content-Type": "text/plain" } });
    }
    return new Response("Forbidden", { status: 403, headers: CORS });
  }

  // POST — WhatsApp-Nachrichten
  if (req.method === "POST") {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Fire-and-forget: Meta erwartet 200 in <5s
    (async () => {
      try {
        for (const entry of body?.entry ?? []) {
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
