import { useEffect, useMemo, useState } from "react";
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
import { PdfPreview } from "@/components/PdfPreview";
import { toast } from "sonner";
import { Save, FileCheck2 } from "lucide-react";
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
  });

  const [form, setForm] = useState<PrecheckData>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once after fetch: existing data > prefill from listing
  useEffect(() => {
    if (isLoading || hydrated) return;
    const prefill = prefillFromListing(listing);
    if (row?.data) {
      setForm({ ...EMPTY, ...prefill, ...(row.data as Partial<PrecheckData>) });
    } else {
      setForm({ ...EMPTY, ...prefill });
    }
    setHydrated(true);
  }, [isLoading, row, listing, hydrated]);

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

  const pdfUrl = useMemo(() => "/vorpruefung-vorlage.pdf", []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileCheck2 className="h-5 w-5" />
          Vorprüfung – Bauprojekt / Grundstück
        </CardTitle>
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          size="sm"
        >
          <Save className="mr-2 h-4 w-4" />
          {save.isPending ? "Speichert…" : "Speichern"}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* LINKS: Formular */}
          <div className="space-y-8">
            {/* 1. Steckbrief */}
            <Section title="1. Projekt-Steckbrief">
              <Field label="Projektname" value={form.projektname} onChange={(v) => set("projektname", v)} />
              <Field label="Adresse" value={form.adresse} onChange={(v) => set("adresse", v)} />
              <Field label="PLZ, Ortschaft" value={form.plz_ort} onChange={(v) => set("plz_ort", v)} />
              <Field label="Kanton" value={form.kanton} onChange={(v) => set("kanton", v)} />
              <Field label="Parzellen-Nr." value={form.parzellen_nr} onChange={(v) => set("parzellen_nr", v)} />
              <Field label="Verkäufer" value={form.verkaeufer} onChange={(v) => set("verkaeufer", v)} />
              <Field label="Kaufpreis / Richtpreis" value={form.kaufpreis} onChange={(v) => set("kaufpreis", v)} />
              <Field label="Grundstücksfläche" value={form.grundstuecksflaeche} onChange={(v) => set("grundstuecksflaeche", v)} />
              <Field label="Geplante Nutzung" value={form.geplante_nutzung} onChange={(v) => set("geplante_nutzung", v)} />
              <Field label="Projektverantwortlicher" value={form.projektverantwortlicher} onChange={(v) => set("projektverantwortlicher", v)} />
              <Field label="Datum" value={form.datum} onChange={(v) => set("datum", v)} />
            </Section>

            {/* 2. Strategie */}
            <Section title="2. Strategische Passung">
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
            </Section>

            {/* 3. Baurecht */}
            <Section title="3. Baurechtliche Grobprüfung">
              <CheckRow label="Bauzone bestätigt" checked={form.b_bauzone} onChange={(v) => set("b_bauzone", v)} />
              <CheckRow label="Erschliessung grundsätzlich vorhanden" checked={form.b_erschliessung} onChange={(v) => set("b_erschliessung", v)} />
              <CheckRow label="Keine offensichtlichen Nutzungseinschränkungen" checked={form.b_keine_einschr} onChange={(v) => set("b_keine_einschr", v)} />
              <CheckRow label="Keine offensichtlichen Schutzauflagen" checked={form.b_keine_schutz} onChange={(v) => set("b_keine_schutz", v)} />
              <CheckRow label="Grobe Ausnützung plausibel" checked={form.b_ausnuetzung} onChange={(v) => set("b_ausnuetzung", v)} />
              <TextField label="Erwartete realisierbare NF / BGF" value={form.erwartete_nf} onChange={(v) => set("erwartete_nf", v)} rows={2} />
              <RiskRow label="Baurechtliches Risiko" value={form.baurecht_risiko} onChange={(v) => set("baurecht_risiko", v)} />
            </Section>

            {/* 4. Technik */}
            <Section title="4. Technische Grobprüfung">
              <CheckRow label="Hanglage / komplexe Topografie?" checked={form.t_hanglage} onChange={(v) => set("t_hanglage", v)} />
              <CheckRow label="Hinweise auf schlechte Bodenverhältnisse?" checked={form.t_boden} onChange={(v) => set("t_boden", v)} />
              <CheckRow label="Altlastenverdacht?" checked={form.t_altlasten} onChange={(v) => set("t_altlasten", v)} />
              <CheckRow label="Abbruchkosten relevant?" checked={form.t_abbruch} onChange={(v) => set("t_abbruch", v)} />
              <RiskRow label="Technisches Risiko" value={form.technik_risiko} onChange={(v) => set("technik_risiko", v)} />
            </Section>

            {/* 5. Wirtschaft */}
            <Section title="5. Wirtschaftliche Plausibilisierung (Quick-Check)">
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
            </Section>

            {/* 6. Markt */}
            <Section title="6. Markt-Schnellanalyse">
              <CheckRow label="Mikrostandort positiv" checked={form.m_mikrostandort} onChange={(v) => set("m_mikrostandort", v)} />
              <CheckRow label="Nachfrage nach Nutzung vorhanden" checked={form.m_nachfrage} onChange={(v) => set("m_nachfrage", v)} />
              <CheckRow label="Vergleichsprojekte erfolgreich" checked={form.m_vergleich} onChange={(v) => set("m_vergleich", v)} />
              <CheckRow label="Keine Überangebot-Situation" checked={form.m_kein_ueberangebot} onChange={(v) => set("m_kein_ueberangebot", v)} />
              <RiskRow label="Markt-Risiko" value={form.markt_risiko} onChange={(v) => set("markt_risiko", v)} />
            </Section>

            {/* 7. Interne */}
            <Section title="7. Interne Realisierbarkeit">
              <CheckRow label="Projektteam verfügbar" checked={form.i_team} onChange={(v) => set("i_team", v)} />
              <CheckRow label="Know-how vorhanden" checked={form.i_knowhow} onChange={(v) => set("i_knowhow", v)} />
              <CheckRow label="Keine Überlastung" checked={form.i_keine_ueberlast} onChange={(v) => set("i_keine_ueberlast", v)} />
              <CheckRow label="Finanzierung grundsätzlich möglich" checked={form.i_finanzierung} onChange={(v) => set("i_finanzierung", v)} />
            </Section>

            {/* 8. Gesamteinschätzung */}
            <Section title="8. Gesamteinschätzung">
              <Field label="Strategie" value={form.g_strategie} onChange={(v) => set("g_strategie", v)} />
              <Field label="Baurecht" value={form.g_baurecht} onChange={(v) => set("g_baurecht", v)} />
              <Field label="Technik" value={form.g_technik} onChange={(v) => set("g_technik", v)} />
              <Field label="Wirtschaft" value={form.g_wirtschaft} onChange={(v) => set("g_wirtschaft", v)} />
              <Field label="Markt" value={form.g_markt} onChange={(v) => set("g_markt", v)} />
            </Section>

            {/* 9. Empfehlung */}
            <Section title="9. Empfehlung an VR">
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
            </Section>

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

          {/* RECHTS: PDF-Vorlage */}
          <div className="lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)]">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium text-muted-foreground">
                Original-Vorlage
              </div>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
              >
                In neuem Tab öffnen
              </a>
            </div>
            <div className="h-[calc(100%-2rem)] min-h-[600px] overflow-hidden rounded-lg border bg-muted">
              <PdfPreview src={pdfUrl} className="h-full w-full" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Subcomponents
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
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-background text-base font-medium"
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
