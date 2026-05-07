import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PORTAL_LABELS, formatCHF, formatSqm } from "@/lib/format";

export const Route = createFileRoute("/insights")({
  head: () => ({ meta: [{ title: "Tims Geschmack" }] }),
  component: InsightsPage,
});

type Pref = {
  decision: "yes" | "no";
  price_chf: number | null;
  price_per_sqm: number | null;
  area_sqm: number | null;
  rooms: number | null;
  building_year: number | null;
  parcel_area_sqm: number | null;
  municipality: string | null;
  canton: string | null;
  usage_zone: string | null;
  portal: string | null;
  floor_count: number | null;
};

function avg(nums: Array<number | null | undefined>): number | null {
  const v = nums.filter((n): n is number => typeof n === "number" && isFinite(n));
  if (v.length === 0) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function topN(values: Array<string | null | undefined>, n = 3) {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function InsightsPage() {
  const [prefs, setPrefs] = useState<Pref[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("tim_preferences").select("*");
      setPrefs((data ?? []) as Pref[]);
    };
    load();
    const ch = supabase
      .channel("tim_prefs")
      .on("postgres_changes", { event: "*", schema: "public", table: "tim_preferences" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  const yes = prefs.filter((p) => p.decision === "yes");
  const no = prefs.filter((p) => p.decision === "no");

  const renderSection = (title: string, items: Pref[]) => (
    <div className="rounded-2xl border border-hairline bg-white p-6">
      <h2 className="mb-4 font-serif-display text-xl">{title}</h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <Row label="Ø Preis" value={formatCHF(avg(items.map((i) => i.price_chf)))} />
        <Row label="Ø Preis pro m²" value={formatCHF(avg(items.map((i) => i.price_per_sqm)))} />
        <Row label="Ø Fläche" value={formatSqm(avg(items.map((i) => i.area_sqm)))} />
        <Row label="Ø Zimmer" value={fmtNum(avg(items.map((i) => i.rooms)), 1)} />
        <Row label="Ø Baujahr" value={fmtNum(avg(items.map((i) => i.building_year)), 0)} />
        <Row label="Ø Parzelle" value={formatSqm(avg(items.map((i) => i.parcel_area_sqm)))} />
        <Row
          label="Top Gemeinden"
          value={topN(items.map((i) => i.municipality)).map(([k, c]) => `${k} (${c})`).join(", ") || "—"}
        />
        <Row
          label="Top Nutzungszonen"
          value={topN(items.map((i) => i.usage_zone)).map(([k, c]) => `${k} (${c})`).join(", ") || "—"}
        />
        <Row
          label="Portale"
          value={
            topN(items.map((i) => i.portal), 5)
              .map(([k, c]) => `${PORTAL_LABELS[k] ?? k} ${Math.round((c / items.length) * 100)}%`)
              .join(", ") || "—"
          }
        />
      </dl>
    </div>
  );

  const compare = (label: string, fy: number | null, fn: number | null, fmt: (v: number | null) => string) => (
    <div className="flex justify-between border-b border-hairline py-2 text-sm">
      <span className="text-steel">{label}</span>
      <span>
        Ja: <b>{fmt(fy)}</b> · Nein: <b>{fmt(fn)}</b>
      </span>
    </div>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="font-serif-display text-4xl">Tims Geschmack</h1>
        <p className="mt-1 text-sm text-steel">Basierend auf {prefs.length} Entscheiden</p>
      </div>

      {renderSection("Was Tim mag", yes)}
      {renderSection("Was Tim ablehnt", no)}

      <div className="rounded-2xl border border-hairline bg-white p-6">
        <h2 className="mb-4 font-serif-display text-xl">Muster</h2>
        {compare("Preis", avg(yes.map((i) => i.price_chf)), avg(no.map((i) => i.price_chf)), formatCHF)}
        {compare("Fläche", avg(yes.map((i) => i.area_sqm)), avg(no.map((i) => i.area_sqm)), formatSqm)}
        {compare("Preis/m²", avg(yes.map((i) => i.price_per_sqm)), avg(no.map((i) => i.price_per_sqm)), formatCHF)}
        {compare("Baujahr", avg(yes.map((i) => i.building_year)), avg(no.map((i) => i.building_year)), (v) => fmtNum(v, 0))}
        {compare("Parzelle", avg(yes.map((i) => i.parcel_area_sqm)), avg(no.map((i) => i.parcel_area_sqm)), formatSqm)}
      </div>

      <div className="rounded-2xl border border-hairline bg-white p-6">
        <h2 className="mb-4 font-serif-display text-xl">Rohzahlen</h2>
        <Row label="Total Swipes" value={String(prefs.length)} />
        <Row label="Ja" value={`${yes.length} (${prefs.length ? Math.round((yes.length / prefs.length) * 100) : 0}%)`} />
        <Row label="Nein" value={`${no.length} (${prefs.length ? Math.round((no.length / prefs.length) * 100) : 0}%)`} />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-hairline py-2">
      <dt className="text-steel">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function fmtNum(n: number | null, digits = 0): string {
  if (n == null) return "—";
  return n.toFixed(digits);
}
