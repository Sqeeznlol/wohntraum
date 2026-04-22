import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Map,
  ExternalLink,
  Building2,
  Sparkles,
  Loader2,
  Landmark,
  ShieldAlert,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { enrichListingGwr } from "@/utils/gwr.functions";
import {
  gisAddressSearchUrl,
  gisZonenplanUrl,
  gisEigentumUrl,
  geoadminGwrUrl,
  gisOerebUrl,
  isZhPostalCode,
} from "@/lib/zh-gis";
import type { Listing } from "@/lib/db-types";

interface Props {
  listing: Listing;
}

export function KatasterPanel({ listing }: Props) {
  const qc = useQueryClient();
  const [isEnriching, setIsEnriching] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [manualEgid, setManualEgid] = useState("");
  const [manualBfs, setManualBfs] = useState("");
  const [manualParcel, setManualParcel] = useState("");
  const [manualMunicipality, setManualMunicipality] = useState("");
  const [showManual, setShowManual] = useState(false);

  if (!isZhPostalCode(listing.postal_code) || !listing.address || !listing.city) {
    return null;
  }

  const addr = listing.address;
  const plz = listing.postal_code!;
  const city = listing.city;

  const enrich = useMutation({
    mutationFn: async (overrides?: {
      egid?: string;
      bfs?: number;
      parcel?: string;
      municipality?: string;
    }) => {
      setIsEnriching(true);
      return enrichListingGwr({
        data: {
          listingId: listing.id,
          manualEgid: overrides?.egid ?? null,
          manualBfs: overrides?.bfs ?? null,
          manualParcel: overrides?.parcel ?? null,
          manualMunicipality: overrides?.municipality ?? null,
        },
      });
    },
    onSuccess: (res) => {
      setIsEnriching(false);
      setMissing(res.missing ?? []);
      if (res.ok) {
        toast.success("GIS-Daten geladen");
        if ((res.missing ?? []).length > 0) setShowManual(true);
        qc.invalidateQueries({ queryKey: ["listing", listing.id] });
        qc.invalidateQueries({ queryKey: ["listings"] });
      } else {
        toast.error(res.error ?? "Anreicherung fehlgeschlagen");
        setShowManual(true);
      }
    },
    onError: () => {
      setIsEnriching(false);
      toast.error("Anreicherung fehlgeschlagen");
      setShowManual(true);
    },
  });

  const runManual = () => {
    enrich.mutate({
      egid: manualEgid.trim() || undefined,
      bfs: manualBfs.trim() ? Number(manualBfs.trim()) : undefined,
      parcel: manualParcel.trim() || undefined,
      municipality: manualMunicipality.trim() || undefined,
    });
  };

  const hasGwr = listing.egid != null || listing.building_year != null;
  const hasZone = listing.zone_code != null;

  return (
    <Card className="border-accent/30 bg-gradient-to-br from-card to-accent/5 shadow-soft">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Map className="h-4 w-4 text-accent" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                Kanton Zürich · GIS · GWR · ÖREB
              </span>
            </div>
            <h3 className="mt-1 font-serif-display text-lg leading-tight">
              Kataster-Anreicherung
            </h3>
            {listing.municipality && (
              <p className="text-xs text-muted-foreground">
                {listing.municipality}
                {listing.bfs_number ? ` · BFS ${listing.bfs_number}` : ""}
                {listing.parcel_number ? ` · Parz. ${listing.parcel_number}` : ""}
              </p>
            )}
          </div>
          <Badge variant="outline" className="border-accent/40 text-[10px] uppercase">
            ZH
          </Badge>
        </div>

        {/* Re-Enrich Button (auch wenn Daten da sind) */}
        <Button
          size="sm"
          variant={hasGwr ? "ghost" : "outline"}
          className={hasGwr ? "h-7 w-full text-xs" : "w-full border-accent/40"}
          onClick={() => enrich.mutate(undefined)}
          disabled={isEnriching}
        >
          {isEnriching ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Lade GIS-Daten…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              {hasGwr ? "Neu anreichern" : "EGID, Zone & Schutz automatisch laden"}
            </>
          )}
        </Button>

        {/* Was fehlt + manuelle Eingabe */}
        {(missing.length > 0 || showManual) && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div className="flex-1">
                <div className="text-xs font-semibold text-destructive">
                  {missing.length > 0 ? "Diese Daten fehlen noch" : "Manuelle Eingabe"}
                </div>
                {missing.length > 0 && (
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    Konnten nicht automatisch ermittelt werden:{" "}
                    <span className="font-medium text-foreground">{missing.join(", ")}</span>
                  </div>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Trage die fehlenden Werte aus dem{" "}
                  <a
                    href={gisAddressSearchUrl(addr, plz, city)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline"
                  >
                    GIS-Browser
                  </a>{" "}
                  ein und starte erneut.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <ManualInput
                label="EGID"
                placeholder="z.B. 150404"
                value={manualEgid}
                onChange={setManualEgid}
              />
              <ManualInput
                label="BFS-Nr."
                placeholder="z.B. 261"
                value={manualBfs}
                onChange={setManualBfs}
              />
              <ManualInput
                label="Katasternummer"
                placeholder="z.B. 4889"
                value={manualParcel}
                onChange={setManualParcel}
              />
              <ManualInput
                label="Gemeinde"
                placeholder="z.B. Zürich"
                value={manualMunicipality}
                onChange={setManualMunicipality}
              />
            </div>
            <Button
              size="sm"
              className="w-full"
              onClick={runManual}
              disabled={
                isEnriching ||
                (!manualEgid.trim() &&
                  !manualBfs.trim() &&
                  !manualParcel.trim() &&
                  !manualMunicipality.trim())
              }
            >
              {isEnriching ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Lade…
                </>
              ) : (
                <>
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  Mit manuellen Werten erneut starten
                </>
              )}
            </Button>
          </div>
        )}

        {/* Schutz-Flags prominent */}
        {(listing.heritage_protected || listing.isos_protected) && (
          <div className="flex flex-wrap gap-1.5">
            {listing.heritage_protected && (
              <Badge variant="secondary" className="gap-1">
                <Landmark className="h-3 w-3" />
                Denkmalschutz
              </Badge>
            )}
            {listing.isos_protected && (
              <Badge variant="secondary" className="gap-1">
                <ShieldAlert className="h-3 w-3" />
                ISOS Ortsbild
              </Badge>
            )}
          </div>
        )}

        {/* Zone */}
        {hasZone && (
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-accent" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Bauzone
              </span>
            </div>
            <div className="mt-1 flex items-baseline justify-between gap-2">
              <span className="font-serif-display text-xl">{listing.zone_code}</span>
              {listing.zone_legal_status && (
                <Badge variant="outline" className="text-[9px]">
                  {listing.zone_legal_status}
                </Badge>
              )}
            </div>
            {listing.zone_part_percent != null && (
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                {Number(listing.zone_part_percent).toFixed(1)}% der Parzelle
                {listing.zone_area_sqm != null
                  ? ` · ${Math.round(Number(listing.zone_area_sqm))} m²`
                  : ""}
              </div>
            )}
          </div>
        )}

        {/* GWR-Daten */}
        {hasGwr && (
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
            {listing.building_category && (
              <GwrStat label="Kategorie" value={listing.building_category} wide />
            )}
            {listing.building_status && (
              <GwrStat label="Status" value={listing.building_status} wide />
            )}
            {listing.parcel_area_sqm != null && (
              <GwrStat
                label="Parzelle"
                value={`${Math.round(Number(listing.parcel_area_sqm))} m²`}
              />
            )}
            {listing.building_area_sqm != null && (
              <GwrStat
                label="Gebäudefläche"
                value={`${Math.round(Number(listing.building_area_sqm))} m²`}
              />
            )}
          </div>
        )}

        {/* GIS-Links */}
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Direkt im Kataster prüfen
          </div>
          <div className="grid gap-1.5">
            {listing.bfs_number && listing.parcel_number && (
              <KatasterLink
                href={gisOerebUrl(listing.bfs_number, listing.parcel_number)}
                label="ÖREB-Kataster (Parzelle)"
                icon={<Layers className="h-3.5 w-3.5" />}
              />
            )}
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
          Quellen: GWR (geo.admin.ch) · AV WFS, ÖREB, Denkmalschutz, ISOS (maps.zh.ch /
          wms.zh.ch). Alle Daten kostenlos & ohne Registrierung.
        </p>
      </CardContent>
    </Card>
  );
}

function GwrStat({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-serif-display text-base leading-tight">{value}</div>
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

function ManualInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 h-8 text-xs"
      />
    </div>
  );
}
