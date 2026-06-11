import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatPricePerSqm } from "@/lib/format";
import type { Listing } from "@/lib/db-types";

export function PurchaseAnalysis({ listing }: { listing: Listing }) {
  const ppsm = listing.price_per_sqm != null ? Number(listing.price_per_sqm) : null;
  const ppsmLand =
    listing.price_per_sqm_land != null ? Number(listing.price_per_sqm_land) : null;

  const { data: benchmark } = useQuery({
    queryKey: ["benchmark", listing.postal_code, listing.id],
    queryFn: async () => {
      // Versuch 1: gleiche PLZ
      if (listing.postal_code) {
        const { data } = await supabase
          .from("listings")
          .select("price_per_sqm")
          .eq("postal_code", listing.postal_code)
          .neq("id", listing.id)
          .not("price_per_sqm", "is", null)
          .is("archived_at", null);
        const vals = (data ?? []).map((r) => Number(r.price_per_sqm)).filter(Boolean);
        if (vals.length >= 3) {
          return {
            scope: `PLZ ${listing.postal_code}`,
            avg: vals.reduce((a, b) => a + b, 0) / vals.length,
            n: vals.length,
          };
        }
      }
      // Fallback: alle
      const { data } = await supabase
        .from("listings")
        .select("price_per_sqm")
        .neq("id", listing.id)
        .not("price_per_sqm", "is", null)
        .is("archived_at", null);
      const vals = (data ?? []).map((r) => Number(r.price_per_sqm)).filter(Boolean);
      if (!vals.length) return null;
      return {
        scope: "alle Inserate",
        avg: vals.reduce((a, b) => a + b, 0) / vals.length,
        n: vals.length,
      };
    },
  });

  const diff =
    ppsm != null && benchmark?.avg ? ((ppsm - benchmark.avg) / benchmark.avg) * 100 : null;

  let badge: { label: string; tone: string } | null = null;
  if (diff != null) {
    if (diff <= -10) badge = { label: "Interessant", tone: "bg-emerald-600 text-white" };
    else if (diff >= 10) badge = { label: "Teuer", tone: "bg-rose-600 text-white" };
    else badge = { label: "Neutral", tone: "bg-amber-500 text-white" };
  }

  const diffColor =
    diff == null
      ? "text-muted-foreground"
      : diff <= -10
        ? "text-emerald-600"
        : diff >= 10
          ? "text-rose-600"
          : "text-amber-600";

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Kauf-Analyse
          </h2>
          {badge && <Badge className={badge.tone}>{badge.label}</Badge>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs text-muted-foreground">Preis / m² Wohnfläche</div>
            <div className="text-2xl font-bold">{formatPricePerSqm(ppsm)}</div>
          </div>
          {ppsmLand != null && (
            <div>
              <div className="text-xs text-muted-foreground">Preis / m² Land</div>
              <div className="text-2xl font-bold">{formatPricePerSqm(ppsmLand)}</div>
            </div>
          )}
        </div>

        {benchmark && diff != null && (
          <div className="rounded border bg-muted/30 p-3 text-sm">
            <div className="text-xs text-muted-foreground">
              Vergleich {benchmark.scope} (n={benchmark.n})
            </div>
            <div>
              Ø {formatPricePerSqm(benchmark.avg)} ·{" "}
              <span className={`font-semibold ${diffColor}`}>
                {diff > 0 ? "+" : ""}
                {diff.toFixed(1)}%
              </span>
            </div>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <Row label="Wohnzone" value={listing.zone_code ?? listing.zone_name ?? "—"} />
          <Row
            label="Baujahr"
            value={
              listing.building_year
                ? String(listing.building_year)
                : (listing.construction_period ?? "—")
            }
          />
          <Row
            label="Heizung"
            value={
              [listing.heating_generator, listing.heating_energy_source]
                .filter(Boolean)
                .join(" · ") || "—"
            }
          />
          <Row label="Stand Heizung" value={listing.heating_updated_at ?? "—"} />
          <Row label="Parzelle" value={listing.parcel_number ?? "—"} />
          <Row label="EGID" value={listing.egid ? String(listing.egid) : "—"} />
          <Row label="EGRID" value={listing.egrid ?? "—"} />
          <Row label="Stockwerke" value={listing.floors ? String(listing.floors) : "—"} />
        </dl>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </>
  );
}
