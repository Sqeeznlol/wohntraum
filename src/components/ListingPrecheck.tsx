import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, FileCheck2, ChevronDown, ChevronUp, ChevronRight } from "lucide-react";
import type { Listing } from "@/lib/db-types";

type RiskLevel = "niedrig" | "mittel" | "hoch";
type Rating = "sehr_gut" | "mittel" | "schwach";
type EconRating = "attraktiv" | "grenzwertig" | "nicht_attraktiv";
type Recommendation = "freigabe" | "ablehnung" | "freigabe_bedingt";

interface PrecheckData {
  // 1. Steckbrief
  projektname: string;
  adresse: string;
  plz_ort: string;
  kanton: string;
  parzellen_nr: string;
  verkaeufer: string;
  kaufpreis: string;
  grundstuecksflaeche: string;
  geplante_nutzung: string;
  projektverantwortlicher: string;
  datum: string;
  // 2. Strategische Passung
  s_standort: boolean;
  s_nutzung: boolean;
  s_groesse: boolean;
  s_klumpen: boolean;
  s_marktgebiet: boolean;
  strategie_bewertung: Rating | "";
  strategie_begruendung: string;
  // 3. Baurechtliche Grobprüfung
  b_bauzone: boolean;
  b_erschliessung: boolean;
  b_keine_einschr: boolean;
  b_keine_schutz: boolean;
  b_ausnuetzung: boolean;
  erwartete_nf: string;
  baurecht_risiko: RiskLevel | "";
  // 4. Technische Grobprüfung
  t_hanglage: boolean;
  t_boden: boolean;
  t_altlasten: boolean;
  t_abbruch: boolean;
  technik_risiko: RiskLevel | "";
  // 5. Wirtschaftliche Plausibilisierung
  w_erwartete_nf: string;
  w_landpreis: string;
  w_baukosten: string;
  w_totalinvest: string;
  w_mietertrag: string;
  w_zielrendite: string;
  w_verkaufspreis: string;
  w_mietzins: string;
  w_verkaufserloes: string;
  w_gewinn: string;
  w_baukosten_plus10: boolean;
  w_verkauf_minus5: boolean;
  wirtschaft_bewertung: EconRating | "";
  // 6. Markt
  m_mikrostandort: boolean;
  m_nachfrage: boolean;
  m_vergleich: boolean;
  m_kein_ueberangebot: boolean;
  markt_risiko: RiskLevel | "";
  // 7. Interne Realisierbarkeit
  i_team: boolean;
  i_knowhow: boolean;
  i_keine_ueberlast: boolean;
  i_finanzierung: boolean;
  // 8. Gesamteinschätzung
  g_strategie: string;
  g_baurecht: string;
  g_technik: string;
  g_wirtschaft: string;
  g_markt: string;
  // 9. Empfehlung
  empfehlung: Recommendation | "";
  bedingungen: string;
  ort_datum: string;
  durchgefuehrt_von: string;
}

const EMPTY: PrecheckData = {
  projektname: "", adresse: "", plz_ort: "", kanton: "", parzellen_nr: "",
  verkaeufer: "", kaufpreis: "", grundstuecksflaeche: "", geplante_nutzung: "",
  projektverantwortlicher: "", datum: "",
  s_standort: false, s_nutzung: false, s_groesse: false, s_klumpen: false, s_marktgebiet: false,
  strategie_bewertung: "", strategie_begruendung: "",
  b_bauzone: false, b_erschliessung: false, b_keine_einschr: false, b_keine_schutz: false, b_ausnuetzung: false,
  erwartete_nf: "", baurecht_risiko: "",
  t_hanglage: false, t_boden: false, t_altlasten: false, t_abbruch: false, technik_risiko: "",
  w_erwartete_nf: "", w_landpreis: "", w_baukosten: "", w_totalinvest: "",
  w_mietertrag: "", w_zielrendite: "", w_verkaufspreis: "", w_mietzins: "",
  w_verkaufserloes: "", w_gewinn: "", w_baukosten_plus10: false, w_verkauf_minus5: false,
  wirtschaft_bewertung: "",
  m_mikrostandort: false, m_nachfrage: false, m_vergleich: false, m_kein_ueberangebot: false, markt_risiko: "",
  i_team: false, i_knowhow: false, i_keine_ueberlast: false, i_finanzierung: false,
  g_strategie: "", g_baurecht: "", g_technik: "", g_wirtschaft: "", g_markt: "",
  empfehlung: "", bedingungen: "", ort_datum: "", durchgefuehrt_von: "",
};


function prefillFromListing(l: Listing): Partial<PrecheckData> {
  const today = new Date().toLocaleDateString("de-CH");
  return {
    projektname: l.title ?? "",
    adresse: l.address ?? "",
    plz_ort: [l.postal_code, l.city].filter(Boolean).join(" "),
    kanton: "Zürich",
    parzellen_nr: l.parcel_number ?? "",
    kaufpreis: l.price_chf ? `CHF ${Math.round(Number(l.price_chf)).toLocaleString("de-CH")}` : "",
    grundstuecksflaeche: l.parcel_area_sqm
      ? `${Math.round(Number(l.parcel_area_sqm)).toLocaleString("de-CH")} m²`
      : (l.area_sqm ? `${Math.round(Number(l.area_sqm)).toLocaleString("de-CH")} m²` : ""),
    geplante_nutzung: "Wohnen",
    datum: today,
    ort_datum: `Kloten, ${today}`,
  };
}

export function ListingPrecheck({
  listingId,
  listing,
}: {
  listingId: string;
  listing: Listing;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: row, isLoading } = useQuery({
    queryKey: ["listing-precheck", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_prechecks")
        .select("*")
        .eq("listing_id", listingId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const [form, setForm] = useState<PrecheckData>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once after fetch: existing data > prefill from listing
  useEffect(() => {
    if (!open || isLoading || hydrated) return;
    const prefill = prefillFromListing(listing);
    if (row?.data) {
      setForm({ ...EMPTY, ...prefill, ...(row.data as Partial<PrecheckData>) });
    } else {
      setForm({ ...EMPTY, ...prefill });
    }
    setHydrated(true);
  }, [open, isLoading, row, listing, hydrated]);

  const set = <K extends keyof PrecheckData>(k: K, v: PrecheckData[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        listing_id: listingId,
        data: form,
      };
      if (row?.id) {
        const { error } = await supabase
          .from("listing_prechecks")
          .update(payload)
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("listing_prechecks")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Vorprüfung gespeichert");
      qc.invalidateQueries({ queryKey: ["listing-precheck", listingId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Fehler beim Speichern"),
  });

  // Compact summary for the collapsed state
  const filledCount = useMemo(() => {
    if (!hydrated) return 0;
    return Object.values(form).filter((v) =>
      typeof v === "boolean" ? v : typeof v === "string" ? v.trim().length > 0 : false
    ).length;
  }, [form, hydrated]);

  return (
    <Card>
      <CardHeader
        className="flex cursor-pointer flex-row items-center justify-between gap-3 space-y-0 hover:bg-muted/40"
        onClick={() => setOpen((o) => !o)}
      >
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileCheck2 className="h-5 w-5" />
          Vorprüfung – Bauprojekt / Grundstück
          {row?.id && !open && (
            <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-normal text-primary">
              gespeichert
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          {open && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                save.mutate();
              }}
              disabled={save.isPending}
              size="sm"
            >
              <Save className="mr-2 h-4 w-4" />
              {save.isPending ? "Speichert…" : "Speichern"}
            </Button>
          )}
          {open ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
      </CardHeader>

      {!open && (
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground">
            {row?.id
              ? `${filledCount > 0 ? filledCount : "Mehrere"} Felder ausgefüllt. Klicken zum Bearbeiten.`
              : "Klicken, um die Vorprüfung auszufüllen. Inserat-Daten werden automatisch übernommen."}
          </p>
        </CardContent>
      )}

      {open && (
        <CardContent className="px-3 sm:px-6">
          <div className="precheck-bleed">
            <style>{`
              .precheck-bleed { width: 100%; }
              @media (min-width: 1280px) {
                .precheck-bleed {
                  width: 100vw;
                  margin-left: calc(50% - 50vw);
                  margin-right: calc(50% - 50vw);
                  padding-left: 1.5rem;
                  padding-right: 1.5rem;
                }
              }
              @media (min-width: 1536px) {
                .precheck-bleed { padding-left: 3rem; padding-right: 3rem; }
              }
            `}</style>
            <PrecheckBody
              form={form}
              set={set}
              save={save}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ============================================================================
// Body with collapsible sections + synced preview
// ============================================================================

const SECTION_IDS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
type SectionId = (typeof SECTION_IDS)[number];

const SECTION_TITLES: Record<SectionId, string> = {
  "1": "Projekt-Steckbrief",
  "2": "Strategische Passung",
  "3": "Baurechtliche Grobprüfung",
  "4": "Technische Grobprüfung",
  "5": "Wirtschaftliche Plausibilisierung",
  "6": "Markt-Schnellanalyse",
  "7": "Interne Realisierbarkeit",
  "8": "Gesamteinschätzung",
  "9": "Empfehlung an VR",
};

function PrecheckBody({
  form,
  set,
  save,
}: {
  form: PrecheckData;
  set: <K extends keyof PrecheckData>(k: K, v: PrecheckData[K]) => void;
  save: ReturnType<typeof useMutation<void, Error, void, unknown>>;
}) {
  // Accordion state — only one open at a time keeps the page short
  const [activeSection, setActiveSection] = useState<SectionId>("1");
  const previewScrollRef = useRef<HTMLDivElement>(null);

  // When active section changes, scroll preview to matching anchor
  useEffect(() => {
    const container = previewScrollRef.current;
    if (!container) return;
    const target = container.querySelector<HTMLElement>(
      `[data-prev-section="${activeSection}"]`,
    );
    if (target) {
      const offset = target.offsetTop - 12;
      container.scrollTo({ top: offset, behavior: "smooth" });
    }
  }, [activeSection]);

  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:mx-auto xl:max-w-[1800px]">
      {/* LEFT: form (accordion) */}
      <div className="space-y-2 min-w-0">
        <Accordion
          id="1"
          activeId={activeSection}
          onToggle={setActiveSection}
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="Projektname" value={form.projektname} onChange={(v) => set("projektname", v)} />
            <Field label="Adresse" value={form.adresse} onChange={(v) => set("adresse", v)} />
            <Field label="PLZ, Ortschaft" value={form.plz_ort} onChange={(v) => set("plz_ort", v)} />
            <Field label="Kanton" value={form.kanton} onChange={(v) => set("kanton", v)} />
            <Field label="Parzellen-Nr." value={form.parzellen_nr} onChange={(v) => set("parzellen_nr", v)} />
            <Field label="Verkäufer" value={form.verkaeufer} onChange={(v) => set("verkaeufer", v)} />
            <Field label="Kaufpreis / Richtpreis" value={form.kaufpreis} onChange={(v) => set("kaufpreis", v)} />
            <Field label="Grundstücksfläche" value={form.grundstuecksflaeche} onChange={(v) => set("grundstuecksflaeche", v)} />
            <div className="sm:col-span-2">
              <Field label="Geplante Nutzung" value={form.geplante_nutzung} onChange={(v) => set("geplante_nutzung", v)} />
            </div>
            <Field label="Projektverantwortlicher" value={form.projektverantwortlicher} onChange={(v) => set("projektverantwortlicher", v)} />
            <Field label="Datum" value={form.datum} onChange={(v) => set("datum", v)} />
          </div>
        </Accordion>

        <Accordion id="2" activeId={activeSection} onToggle={setActiveSection}>
          <CheckRow label="Standort passt zur Unternehmensstrategie" checked={form.s_standort} onChange={(v) => set("s_standort", v)} />
          <CheckRow label="Nutzung passt zu Kernkompetenz" checked={form.s_nutzung} onChange={(v) => set("s_nutzung", v)} />
          <CheckRow label="Projektgrösse passend zur Unternehmensgrösse" checked={form.s_groesse} onChange={(v) => set("s_groesse", v)} />
          <CheckRow label="Kein Klumpenrisiko im Portfolio / Auftragsbuch" checked={form.s_klumpen} onChange={(v) => set("s_klumpen", v)} />
          <CheckRow label="Region im definierten Marktgebiet" checked={form.s_marktgebiet} onChange={(v) => set("s_marktgebiet", v)} />
          <RadioRow
            label="Strategische Bewertung"
            value={form.strategie_bewertung}
            onChange={(v) => set("strategie_bewertung", v as Rating)}
            options={[
              { value: "sehr_gut", label: "Sehr gut" },
              { value: "mittel", label: "Mittel" },
              { value: "schwach", label: "Schwach" },
            ]}
          />
          <TextField label="Begründung" value={form.strategie_begruendung} onChange={(v) => set("strategie_begruendung", v)} rows={3} />
        </Accordion>

        <Accordion id="3" activeId={activeSection} onToggle={setActiveSection}>
          <CheckRow label="Bauzone bestätigt" checked={form.b_bauzone} onChange={(v) => set("b_bauzone", v)} />
          <CheckRow label="Erschliessung grundsätzlich vorhanden" checked={form.b_erschliessung} onChange={(v) => set("b_erschliessung", v)} />
          <CheckRow label="Keine offensichtlichen Nutzungseinschränkungen" checked={form.b_keine_einschr} onChange={(v) => set("b_keine_einschr", v)} />
          <CheckRow label="Keine offensichtlichen Schutzauflagen" checked={form.b_keine_schutz} onChange={(v) => set("b_keine_schutz", v)} />
          <CheckRow label="Grobe Ausnützung plausibel" checked={form.b_ausnuetzung} onChange={(v) => set("b_ausnuetzung", v)} />
          <TextField label="Erwartete realisierbare NF / BGF" value={form.erwartete_nf} onChange={(v) => set("erwartete_nf", v)} rows={2} />
          <RiskRow label="Baurechtliches Risiko" value={form.baurecht_risiko} onChange={(v) => set("baurecht_risiko", v)} />
        </Accordion>

        <Accordion id="4" activeId={activeSection} onToggle={setActiveSection}>
          <CheckRow label="Hanglage / komplexe Topografie?" checked={form.t_hanglage} onChange={(v) => set("t_hanglage", v)} />
          <CheckRow label="Hinweise auf schlechte Bodenverhältnisse?" checked={form.t_boden} onChange={(v) => set("t_boden", v)} />
          <CheckRow label="Altlastenverdacht?" checked={form.t_altlasten} onChange={(v) => set("t_altlasten", v)} />
          <CheckRow label="Abbruchkosten relevant?" checked={form.t_abbruch} onChange={(v) => set("t_abbruch", v)} />
          <RiskRow label="Technisches Risiko" value={form.technik_risiko} onChange={(v) => set("technik_risiko", v)} />
        </Accordion>

        <Accordion id="5" activeId={activeSection} onToggle={setActiveSection}>
          <Field label="Erwartete NF" value={form.w_erwartete_nf} onChange={(v) => set("w_erwartete_nf", v)} />
          <Field label="Landpreis pro m² NF" value={form.w_landpreis} onChange={(v) => set("w_landpreis", v)} />
          <Field label="Gesch. Baukosten pro m² NF" value={form.w_baukosten} onChange={(v) => set("w_baukosten", v)} />
          <Field label="Totalinvestition (Schätzung)" value={form.w_totalinvest} onChange={(v) => set("w_totalinvest", v)} />
          <Field label="Erwarteter Mietertrag" value={form.w_mietertrag} onChange={(v) => set("w_mietertrag", v)} />
          <Field label="Erwartete Zielrendite" value={form.w_zielrendite} onChange={(v) => set("w_zielrendite", v)} />
          <Field label="Erwarteter Verkaufspreis (m²)" value={form.w_verkaufspreis} onChange={(v) => set("w_verkaufspreis", v)} />
          <Field label="Erwarteter Mietzins (m²)" value={form.w_mietzins} onChange={(v) => set("w_mietzins", v)} />
          <Field label="Erwarteter Verkaufserlös" value={form.w_verkaufserloes} onChange={(v) => set("w_verkaufserloes", v)} />
          <Field label="Erwarteter Gewinn" value={form.w_gewinn} onChange={(v) => set("w_gewinn", v)} />
          <CheckRow label="Baukosten +10% noch tragbar" checked={form.w_baukosten_plus10} onChange={(v) => set("w_baukosten_plus10", v)} />
          <CheckRow label="Verkaufspreise -5% noch tragbar" checked={form.w_verkauf_minus5} onChange={(v) => set("w_verkauf_minus5", v)} />
          <RadioRow
            label="Wirtschaftliche Bewertung"
            value={form.wirtschaft_bewertung}
            onChange={(v) => set("wirtschaft_bewertung", v as EconRating)}
            options={[
              { value: "attraktiv", label: "Attraktiv" },
              { value: "grenzwertig", label: "Grenzwertig" },
              { value: "nicht_attraktiv", label: "Nicht attraktiv" },
            ]}
          />
        </Accordion>

        <Accordion id="6" activeId={activeSection} onToggle={setActiveSection}>
          <CheckRow label="Mikrostandort positiv" checked={form.m_mikrostandort} onChange={(v) => set("m_mikrostandort", v)} />
          <CheckRow label="Nachfrage nach Nutzung vorhanden" checked={form.m_nachfrage} onChange={(v) => set("m_nachfrage", v)} />
          <CheckRow label="Vergleichsprojekte erfolgreich" checked={form.m_vergleich} onChange={(v) => set("m_vergleich", v)} />
          <CheckRow label="Keine Überangebot-Situation" checked={form.m_kein_ueberangebot} onChange={(v) => set("m_kein_ueberangebot", v)} />
          <RiskRow label="Markt-Risiko" value={form.markt_risiko} onChange={(v) => set("markt_risiko", v)} />
        </Accordion>

        <Accordion id="7" activeId={activeSection} onToggle={setActiveSection}>
          <CheckRow label="Projektteam verfügbar" checked={form.i_team} onChange={(v) => set("i_team", v)} />
          <CheckRow label="Know-how vorhanden" checked={form.i_knowhow} onChange={(v) => set("i_knowhow", v)} />
          <CheckRow label="Keine Überlastung" checked={form.i_keine_ueberlast} onChange={(v) => set("i_keine_ueberlast", v)} />
          <CheckRow label="Finanzierung grundsätzlich möglich" checked={form.i_finanzierung} onChange={(v) => set("i_finanzierung", v)} />
        </Accordion>

        <Accordion id="8" activeId={activeSection} onToggle={setActiveSection}>
          <Field label="Strategie" value={form.g_strategie} onChange={(v) => set("g_strategie", v)} />
          <Field label="Baurecht" value={form.g_baurecht} onChange={(v) => set("g_baurecht", v)} />
          <Field label="Technik" value={form.g_technik} onChange={(v) => set("g_technik", v)} />
          <Field label="Wirtschaft" value={form.g_wirtschaft} onChange={(v) => set("g_wirtschaft", v)} />
          <Field label="Markt" value={form.g_markt} onChange={(v) => set("g_markt", v)} />
        </Accordion>

        <Accordion id="9" activeId={activeSection} onToggle={setActiveSection}>
          <RadioRow
            label="Empfehlung"
            value={form.empfehlung}
            onChange={(v) => set("empfehlung", v as Recommendation)}
            options={[
              { value: "freigabe", label: "Freigabe für vertiefte Due Diligence" },
              { value: "ablehnung", label: "Ablehnung" },
              { value: "freigabe_bedingt", label: "Freigabe unter Bedingungen" },
            ]}
          />
          <TextField label="Bedingungen" value={form.bedingungen} onChange={(v) => set("bedingungen", v)} rows={4} />
          <Separator />
          <Field label="Ort, Datum" value={form.ort_datum} onChange={(v) => set("ort_datum", v)} />
          <Field label="Durchgeführt von" value={form.durchgefuehrt_von} onChange={(v) => set("durchgefuehrt_von", v)} />
        </Accordion>

        {/* Section nav prev/next */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            disabled={SECTION_IDS.indexOf(activeSection) === 0}
            onClick={() => {
              const idx = SECTION_IDS.indexOf(activeSection);
              if (idx > 0) setActiveSection(SECTION_IDS[idx - 1]);
            }}
          >
            ← Zurück
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            {SECTION_IDS.indexOf(activeSection) + 1} / {SECTION_IDS.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={SECTION_IDS.indexOf(activeSection) === SECTION_IDS.length - 1}
            onClick={() => {
              const idx = SECTION_IDS.indexOf(activeSection);
              if (idx < SECTION_IDS.length - 1) setActiveSection(SECTION_IDS[idx + 1]);
            }}
          >
            Weiter →
          </Button>
        </div>

        <div className="sticky bottom-0 -mx-1 border-t bg-background/95 px-1 py-3 backdrop-blur">
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full"
            size="lg"
          >
            <Save className="mr-2 h-4 w-4" />
            {save.isPending ? "Speichert…" : "Vorprüfung speichern"}
          </Button>
        </div>
      </div>

      {/* RIGHT: Live preview, scrolls in sync with active section */}
      <div
        className="min-w-0 lg:sticky lg:top-4"
        style={{ height: "calc(100dvh - 2rem)" }}
      >
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">
            Live-Vorschau
            <span className="ml-2 text-xs text-foreground">
              · {activeSection}. {SECTION_TITLES[activeSection]}
            </span>
          </div>
          <a
            href="/vorpruefung-vorlage.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary hover:underline"
          >
            Original-PDF
          </a>
        </div>
        <div
          ref={previewScrollRef}
          className="min-h-[600px] overflow-y-auto rounded-lg border bg-white"
          style={{
            height: "calc(100% - 2rem)",
            WebkitOverflowScrolling: "touch",
            scrollBehavior: "smooth",
          }}
        >
          <LivePreview data={form} />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Accordion section wrapper
// ============================================================================

function Accordion({
  id,
  activeId,
  onToggle,
  children,
}: {
  id: SectionId;
  activeId: SectionId;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  const isOpen = id === activeId;
  return (
    <div className="overflow-hidden rounded-lg border bg-card transition-colors">
      <button
        type="button"
        onClick={() => onToggle(isOpen ? id : id)}
        className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors ${
          isOpen ? "bg-muted/40" : "hover:bg-muted/20"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
              isOpen
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {id}
          </span>
          <span className="text-sm font-semibold tracking-tight">
            {SECTION_TITLES[id]}
          </span>
        </div>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {isOpen && (
        <div className="space-y-3 border-t bg-background p-4">{children}</div>
      )}
    </div>
  );
}

// ============================================================================
// Live Preview – mimics PDF look
// ============================================================================

// PDF brand colors
const NAVY = "#1F2A6B";

function LivePreview({ data: d }: { data: PrecheckData }) {
  return (
    <div
      className="mx-auto max-w-[800px] bg-white p-10 text-[13px] leading-[1.55] text-black"
      style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif" }}
    >
      {/* Header band */}
      <div
        className="-mx-10 -mt-10 mb-8 h-3"
        style={{ backgroundColor: NAVY }}
      />

      {/* Title */}
      <div className="mb-6">
        <h1
          className="text-[26px] font-extrabold tracking-wide"
          style={{ color: NAVY }}
        >
          VORPRÜFUNG
        </h1>
        <div className="text-[16px] font-bold text-black">
          Bauprojekt / Grundstück
        </div>
      </div>

      <div className="mb-8 text-[13px]">
        <span className="italic underline">Ziel:</span>{" "}
        <span className="italic">
          Entscheidungsgrundlage für VR – Freigabe für die Due Diligence
        </span>
      </div>

      <PrevSection num="1." title="PROJEKT-STECKBRIEF">
        <PrevRow label="Projektname" value={d.projektname} />
        <PrevRow label="Adresse" value={d.adresse} />
        <PrevRow label="PLZ, Ortschaft" value={d.plz_ort} />
        <PrevRow label="Kanton" value={d.kanton} />
        <PrevRow label="Parzellen-Nr." value={d.parzellen_nr} />
        <PrevRow label="Verkäufer" value={d.verkaeufer} />
        <PrevRow label="Kaufpreis / Richtpreis" value={d.kaufpreis} />
        <PrevRow label="Grundstücksfläche" value={d.grundstuecksflaeche} />
        <PrevRow label="Geplante Nutzung" value={d.geplante_nutzung} />
        <PrevRow label="Projektverantwortlicher" value={d.projektverantwortlicher} />
        <PrevRow label="Datum" value={d.datum} />
      </PrevSection>

      <PrevSection num="2." title="STRATEGISCHE PASSUNG">
        <PrevCheck label="Standort passt zur Unternehmensstrategie" checked={d.s_standort} />
        <PrevCheck label="Nutzung passt zu Kernkompetenz" checked={d.s_nutzung} />
        <PrevCheck label="Projektgrösse passend zur Unternehmensgrösse" checked={d.s_groesse} />
        <PrevCheck label="Kein Klumpenrisiko im Portfolio / Auftragsbuch" checked={d.s_klumpen} />
        <PrevCheck label="Region im definierten Marktgebiet" checked={d.s_marktgebiet} />

        <PrevSubLabel>Strategische Bewertung:</PrevSubLabel>
        <PrevCheck label="Sehr gut" checked={d.strategie_bewertung === "sehr_gut"} />
        <PrevCheck label="Mittel" checked={d.strategie_bewertung === "mittel"} />
        <PrevCheck label="Schwach" checked={d.strategie_bewertung === "schwach"} />

        <PrevSubLabel>Begründung:</PrevSubLabel>
        <PrevFreeText value={d.strategie_begruendung} />
      </PrevSection>

      <PrevSection num="3." title="BAURECHTLICHE GROBPRÜFUNG">
        <PrevCheck label="Bauzone bestätigt" checked={d.b_bauzone} />
        <PrevCheck label="Erschliessung grundsätzlich vorhanden" checked={d.b_erschliessung} />
        <PrevCheck label="Keine offensichtlichen Nutzungseinschränkungen" checked={d.b_keine_einschr} />
        <PrevCheck label="Keine offensichtlichen Schutzauflagen" checked={d.b_keine_schutz} />
        <PrevCheck label="Grobe Ausnützung plausibel" checked={d.b_ausnuetzung} />

        <PrevSubLabel>Erwartete realisierbare NF / BGF:</PrevSubLabel>
        <PrevFreeText value={d.erwartete_nf} />

        <PrevSubLabel>Baurechtliches Risiko:</PrevSubLabel>
        <PrevCheck label="Niedrig" checked={d.baurecht_risiko === "niedrig"} />
        <PrevCheck label="Mittel" checked={d.baurecht_risiko === "mittel"} />
        <PrevCheck label="Hoch" checked={d.baurecht_risiko === "hoch"} />
      </PrevSection>

      <PrevSection num="4." title="TECHNISCHE GROBPRÜFUNG">
        <PrevCheck label="Hanglage / komplexe Topografie?" checked={d.t_hanglage} />
        <PrevCheck label="Hinweise auf schlechte Bodenverhältnisse?" checked={d.t_boden} />
        <PrevCheck label="Altlastenverdacht?" checked={d.t_altlasten} />
        <PrevCheck label="Abbruchkosten relevant?" checked={d.t_abbruch} />

        <PrevSubLabel>Technisches Risiko:</PrevSubLabel>
        <PrevCheck label="Niedrig" checked={d.technik_risiko === "niedrig"} />
        <PrevCheck label="Mittel" checked={d.technik_risiko === "mittel"} />
        <PrevCheck label="Hoch" checked={d.technik_risiko === "hoch"} />
      </PrevSection>

      <PrevSection num="5." title="WIRTSCHAFTLICHE PLAUSIBILISIERUNG (QUICK-CHECK)">
        <PrevRow label="Erwartete NF" value={d.w_erwartete_nf} />
        <PrevRow label="Landpreis pro m² NF" value={d.w_landpreis} />
        <PrevRow label="Gesch. Baukosten pro m² NF" value={d.w_baukosten} />
        <PrevRow label="Totalinvestition (Schätzung)" value={d.w_totalinvest} />
        <PrevRow label="Erwarteter Mietertrag" value={d.w_mietertrag} />
        <PrevRow label="Erwartete Zielrendite" value={d.w_zielrendite} />
        <PrevRow label="Erwarteter Verkaufspreis (m²)" value={d.w_verkaufspreis} />
        <PrevRow label="Erwarteter Mietzins (m²)" value={d.w_mietzins} />
        <PrevRow label="Erwarteter Verkaufserlös" value={d.w_verkaufserloes} />
        <PrevRow label="Erwarteter Gewinn" value={d.w_gewinn} />

        <PrevSubLabel>Szenario-Abwägung:</PrevSubLabel>
        <PrevCheck label="Baukosten +10% noch tragbar" checked={d.w_baukosten_plus10} />
        <PrevCheck label="Verkaufspreise -5% noch tragbar" checked={d.w_verkauf_minus5} />

        <PrevSubLabel>Wirtschaftliche Bewertung:</PrevSubLabel>
        <PrevCheck label="Attraktiv" checked={d.wirtschaft_bewertung === "attraktiv"} />
        <PrevCheck label="Grenzwertig" checked={d.wirtschaft_bewertung === "grenzwertig"} />
        <PrevCheck label="Nicht attraktiv" checked={d.wirtschaft_bewertung === "nicht_attraktiv"} />
      </PrevSection>

      <PrevSection num="6." title="MARKT-SCHNELLANALYSE">
        <PrevCheck label="Mikrostandort positiv" checked={d.m_mikrostandort} />
        <PrevCheck label="Nachfrage nach Nutzung vorhanden" checked={d.m_nachfrage} />
        <PrevCheck label="Vergleichsprojekte erfolgreich" checked={d.m_vergleich} />
        <PrevCheck label="Keine Überangebot-Situation" checked={d.m_kein_ueberangebot} />

        <PrevSubLabel>Markt-Risiko:</PrevSubLabel>
        <PrevCheck label="Niedrig" checked={d.markt_risiko === "niedrig"} />
        <PrevCheck label="Mittel" checked={d.markt_risiko === "mittel"} />
        <PrevCheck label="Hoch" checked={d.markt_risiko === "hoch"} />
      </PrevSection>

      <PrevSection num="7." title="INTERNE REALISIERBARKEIT">
        <PrevCheck label="Projektteam verfügbar" checked={d.i_team} />
        <PrevCheck label="Know-how vorhanden" checked={d.i_knowhow} />
        <PrevCheck label="Keine Überlastung" checked={d.i_keine_ueberlast} />
        <PrevCheck label="Finanzierung grundsätzlich möglich" checked={d.i_finanzierung} />
      </PrevSection>

      <PrevSection num="8." title="GESAMTEINSCHÄTZUNG">
        <PrevRow label="Strategie" value={d.g_strategie} />
        <PrevRow label="Baurecht" value={d.g_baurecht} />
        <PrevRow label="Technik" value={d.g_technik} />
        <PrevRow label="Wirtschaft" value={d.g_wirtschaft} />
        <PrevRow label="Markt" value={d.g_markt} />
      </PrevSection>

      <PrevSection num="9." title="EMPFEHLUNG AN VR">
        <PrevCheck label="Freigabe für vertiefte Due Diligence" checked={d.empfehlung === "freigabe"} />
        <PrevCheck label="Ablehnung" checked={d.empfehlung === "ablehnung"} />
        <PrevCheck label="Freigabe unter Bedingungen" checked={d.empfehlung === "freigabe_bedingt"} />

        <PrevSubLabel>Bedingungen:</PrevSubLabel>
        <PrevFreeText value={d.bedingungen} />

        <div className="mt-6 space-y-1">
          <div className="text-[12px]">
            Diese Vorprüfung wurde durchgeführt und geleitet von:
          </div>
          <div className="pt-3">
            <PrevRow label="Ort, Datum" value={d.ort_datum} />
            <PrevRow label="Durchgeführt von" value={d.durchgefuehrt_von} />
          </div>
        </div>
      </PrevSection>
    </div>
  );
}

function PrevSection({
  num,
  title,
  children,
}: {
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  const sectionId = num.replace(".", "");
  return (
    <section className="mb-7" data-prev-section={sectionId}>
      <div className="mb-2 flex items-baseline gap-3">
        <span className="font-bold" style={{ color: NAVY }}>
          {num}
        </span>
        <h2
          className="text-[15px] font-bold tracking-wide"
          style={{ color: NAVY }}
        >
          {title}
        </h2>
      </div>
      <div className="space-y-0">{children}</div>
    </section>
  );
}

function PrevSubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 mb-1 text-[12px] underline">{children}</div>
  );
}

function PrevRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-end gap-3 py-[3px]"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.35) 33%, rgba(255,255,255,0) 0%)",
        backgroundPosition: "bottom",
        backgroundSize: "4px 1px",
        backgroundRepeat: "repeat-x",
      }}
    >
      <div className="min-w-[200px] text-[12.5px] text-black">{label}:</div>
      <div
        className={`flex-1 text-[12.5px] font-bold ${value ? "" : "opacity-30"}`}
        style={{ color: value ? NAVY : "#000" }}
      >
        {value || "\u00A0"}
      </div>
    </div>
  );
}

function PrevFreeText({ value }: { value: string }) {
  return (
    <div
      className={`min-h-[22px] whitespace-pre-wrap py-[3px] text-[12.5px] font-bold ${
        value ? "" : "opacity-30"
      }`}
      style={{
        color: value ? NAVY : "#000",
        backgroundImage:
          "linear-gradient(to right, rgba(0,0,0,0.35) 33%, rgba(255,255,255,0) 0%)",
        backgroundPosition: "bottom",
        backgroundSize: "4px 1px",
        backgroundRepeat: "repeat-x",
      }}
    >
      {value || "\u00A0"}
    </div>
  );
}

function PrevCheck({ label, checked }: { label: string; checked: boolean }) {
  return (
    <div className="flex items-center gap-3 py-[2px] pl-2">
      <span
        className="inline-flex h-[14px] w-[14px] flex-none items-center justify-center border border-black text-[12px] font-bold leading-none"
        style={{ color: "#000" }}
      >
        {checked ? "✕" : ""}
      </span>
      <span className="text-[12.5px]">{label}</span>
    </div>
  );
}

// ============================================================================
// Form subcomponents
// ============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      <div className="space-y-3 rounded-lg border bg-card/50 p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 bg-background text-sm font-medium"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="bg-background text-base"
      />
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 rounded-md py-1 cursor-pointer hover:bg-muted/40 px-1">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span className="text-sm leading-relaxed">{label}</span>
    </label>
  );
}

function RadioRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-4">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer">
            <RadioGroupItem value={o.value} />
            <span className="text-sm">{o.label}</span>
          </label>
        ))}
      </RadioGroup>
    </div>
  );
}

function RiskRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: RiskLevel) => void;
}) {
  return (
    <RadioRow
      label={label}
      value={value}
      onChange={(v) => onChange(v as RiskLevel)}
      options={[
        { value: "niedrig", label: "Niedrig" },
        { value: "mittel", label: "Mittel" },
        { value: "hoch", label: "Hoch" },
      ]}
    />
  );
}
