import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ExternalLink, Info, MapPin } from "lucide-react";
import type { Listing } from "@/lib/db-types";

interface Props {
  listing: Listing;
}

type ZoneTone = "residential" | "commercial" | "sensitive" | "neutral";

function classifyZone(code: string | null | undefined): ZoneTone {
  if (!code) return "neutral";
  const c = code.trim().toUpperCase();
  if (/^W/.test(c)) return "residential";
  if (/^(G|I|A|Z|K)/.test(c)) return "commercial";
  if (/^S/.test(c)) return "sensitive";
  return "neutral";
}

function zoneBadgeClass(tone: ZoneTone): string {
  switch (tone) {
    case "residential":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "commercial":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "sensitive":
      return "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function dash(v: unknown): string {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  return s.length === 0 ? "—" : s;
}

export function BuildingDataPanel({ listing }: Props) {
  // geo_researched ist neu — bei alten Datensätzen (Spalte fehlt im generierten Type
  // bis types.ts neu generiert) greifen wir defensiv darauf zu.
  const researched =
    (listing as unknown as { geo_researched?: boolean }).geo_researched ??
    listing.gwr_enriched_at != null;

  const heatingType = (listing as unknown as { heating_type?: string | null }).heating_type ?? null;
  const energySource = (listing as unknown as { energy_source?: string | null }).energy_source ?? null;
  const usageZone =
    (listing as unknown as { usage_zone?: string | null }).usage_zone ?? listing.zone_code ?? null;

  const egid = listing.egid != null ? String(listing.egid) : null;
  const egrid = listing.egrid ?? null;
  const parcel = listing.parcel_number ?? null;

  const buildingYear = listing.building_year ?? null;
  const buildingType = listing.building_category ?? null;
  const buildingArea = listing.building_area_sqm != null ? Math.round(Number(listing.building_area_sqm)) : null;
  const floors = listing.floors ?? null;
  const dwellings = listing.dwellings ?? null;

  const age = buildingYear ? new Date().getFullYear() - buildingYear : null;
  const zoneTone = classifyZone(usageZone);

  return (
    <Card className="border-border/60 bg-card/60 backdrop-blur-sm">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Gebäudedaten
            </h2>
          </div>
          {researched && (
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
              Register
            </Badge>
          )}
        </div>

        {!researched ? (
          <div className="flex items-start gap-3 rounded-lg border border-dashed border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium text-foreground/80">Keine Geodaten verfügbar</div>
              <div className="text-xs">
                Für dieses Inserat wurden noch keine Register- oder Gebäudedaten recherchiert.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Linke Spalte: Registerinfos */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Registerinfos
                </h3>
                <dl className="space-y-2.5 text-sm">
                  <Row label="EGID">
                    {egid ? (
                      <a
                        href={`https://www.housing-stat.ch/de/madd/egid.html?egid=${encodeURIComponent(egid)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        {egid}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Row>
                  <Row label="EGRID">
                    <span className="font-medium">{dash(egrid)}</span>
                  </Row>
                  <Row label="Parzelle Nr.">
                    <span className="font-medium">{dash(parcel)}</span>
                  </Row>
                  <Row label="Nutzungszone">
                    {usageZone ? (
                      <Badge variant="outline" className={`${zoneBadgeClass(zoneTone)} text-[11px]`}>
                        {usageZone}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Row>
                </dl>
              </div>

              {/* Rechte Spalte: Gebäude */}
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Gebäude
                </h3>
                <dl className="space-y-2.5 text-sm">
                  <Row label="Baujahr">
                    {buildingYear ? (
                      <span className="font-medium">
                        {buildingYear}{" "}
                        <span className="text-muted-foreground">
                          ({age} {age === 1 ? "Jahr" : "Jahre"})
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Row>
                  <Row label="Typ">
                    <span className="font-medium">{dash(buildingType)}</span>
                  </Row>
                  <Row label="Grundfläche">
                    <span className="font-medium">
                      {buildingArea != null ? `${buildingArea} m²` : "—"}
                    </span>
                  </Row>
                  <Row label="Geschosse">
                    <span className="font-medium">{dash(floors)}</span>
                  </Row>
                  <Row label="Wohnungen im Gebäude">
                    <span className="font-medium">{dash(dwellings)}</span>
                  </Row>
                  <Row label="Heizung">
                    <span className="font-medium">{dash(heatingType)}</span>
                  </Row>
                  <Row label="Energieträger">
                    <span className="font-medium">{dash(energySource)}</span>
                  </Row>
                </dl>
              </div>
            </div>

            {egid && (
              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`https://www.housing-stat.ch/de/madd/egid.html?egid=${encodeURIComponent(egid)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    GWR ansehen
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`https://maps.zh.ch/?topic=LiegenschschaftenZH&scale=2000&egid=${encodeURIComponent(egid)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <MapPin className="mr-1.5 h-3.5 w-3.5" />
                    Karte ZH
                  </a>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-1.5 last:border-b-0 last:pb-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
