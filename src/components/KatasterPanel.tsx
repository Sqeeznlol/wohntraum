import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Map, ExternalLink, Building2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { enrichListingGwr } from "@/utils/gwr.functions";
import {
  gisAddressSearchUrl,
  gisZonenplanUrl,
  gisEigentumUrl,
  geoadminGwrUrl,
  isZhPostalCode,
} from "@/lib/zh-gis";
import type { Listing } from "@/lib/db-types";

interface Props {
  listing: Listing;
}

export function KatasterPanel({ listing }: Props) {
  const qc = useQueryClient();
  const [isEnriching, setIsEnriching] = useState(false);

  if (!isZhPostalCode(listing.postal_code) || !listing.address || !listing.city) {
    return null;
  }

  const addr = listing.address;
  const plz = listing.postal_code!;
  const city = listing.city;

  const enrich = useMutation({
    mutationFn: async () => {
      setIsEnriching(true);
      return enrichListingGwr({ data: { listingId: listing.id } });
    },
    onSuccess: (res) => {
      setIsEnriching(false);
      if (res.ok) {
        toast.success("GWR-Daten geladen");
        qc.invalidateQueries({ queryKey: ["listing", listing.id] });
        qc.invalidateQueries({ queryKey: ["listings"] });
      } else {
        toast.error(res.error ?? "Anreicherung fehlgeschlagen");
      }
    },
    onError: () => {
      setIsEnriching(false);
      toast.error("Anreicherung fehlgeschlagen");
    },
  });

  const hasGwr = listing.egid != null || listing.building_year != null;

  return (
    <Card className="border-accent/30 bg-gradient-to-br from-card to-accent/5 shadow-soft">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Map className="h-4 w-4 text-accent" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                Kanton Zürich · GIS & GWR
              </span>
            </div>
            <h3 className="mt-1 font-serif-display text-lg leading-tight">
              Kataster-Anreicherung
            </h3>
          </div>
          <Badge variant="outline" className="border-accent/40 text-[10px] uppercase">
            ZH
          </Badge>
        </div>

        {/* GWR-Daten */}
        {hasGwr ? (
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-background/60 p-3">
            <GwrStat label="EGID" value={listing.egid ? String(listing.egid) : "—"} />
            <GwrStat
              label="Baujahr"
              value={listing.building_year ? String(listing.building_year) : "—"}
            />
            <GwrStat
              label="Stockwerke"
              value={listing.floors ? String(listing.floors) : "—"}
            />
            <GwrStat
              label="Wohnungen"
              value={listing.dwellings ? String(listing.dwellings) : "—"}
            />
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="w-full border-accent/40"
            onClick={() => enrich.mutate()}
            disabled={isEnriching}
          >
            {isEnriching ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Lade GWR-Daten…
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                EGID & Baujahr automatisch laden
              </>
            )}
          </Button>
        )}

        {/* GIS-Links */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Direkt im Kataster prüfen
          </div>
          <div className="grid gap-1.5">
            <KatasterLink
              href={gisZonenplanUrl(addr, plz, city)}
              label="Zonenplan (W1 / W2 / W3)"
              icon={<Building2 className="h-3.5 w-3.5" />}
            />
            <KatasterLink
              href={gisEigentumUrl(addr, plz, city)}
              label="Eigentumsauskunft / Parzelle"
              icon={<Map className="h-3.5 w-3.5" />}
            />
            <KatasterLink
              href={gisAddressSearchUrl(addr, plz, city)}
              label="GIS-Browser maps.zh.ch"
              icon={<Map className="h-3.5 w-3.5" />}
            />
            <KatasterLink
              href={geoadminGwrUrl(addr, plz, city)}
              label="GWR Bundes-Karte"
              icon={<Building2 className="h-3.5 w-3.5" />}
            />
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Quelle: GIS-ZH (maps.zh.ch) & Bundesamt für Statistik (housing-stat.ch).
          Bauzonen-Klassifikation direkt im Zonenplan einsehbar.
        </p>
      </CardContent>
    </Card>
  );
}

function GwrStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-serif-display text-base">{value}</div>
    </div>
  );
}

function KatasterLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-xs transition-colors hover:border-accent/50 hover:bg-accent/5"
    >
      <span className="flex items-center gap-1.5 text-foreground">
        {icon}
        {label}
      </span>
      <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-accent" />
    </a>
  );
}
