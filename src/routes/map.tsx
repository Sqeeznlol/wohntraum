import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Listing } from "@/lib/db-types";
import { formatCHF, formatPricePerSqm, formatSqm, PORTAL_LABELS } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Map as MapIcon, List, MapPin, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

const CH_CENTER: [number, number] = [46.8, 8.3];

const PLZ_FALLBACK: Record<string, [number, number]> = {
  "10": [46.52, 6.63],
  "12": [46.2, 6.14],
  "30": [46.95, 7.45],
  "40": [47.56, 7.59],
  "60": [47.05, 8.31],
  "70": [46.81, 9.84],
  "80": [47.37, 8.54],
  "90": [47.42, 9.37],
};

function geocode(l: Listing): { coords: [number, number]; precise: boolean } | null {
  if (l.latitude != null && l.longitude != null) {
    return { coords: [Number(l.latitude), Number(l.longitude)], precise: true };
  }
  if (l.postal_code) {
    const prefix = l.postal_code.toString().slice(0, 2);
    if (PLZ_FALLBACK[prefix]) return { coords: PLZ_FALLBACK[prefix], precise: false };
  }
  return null;
}

function MapPage() {
  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"map" | "list">("map");
  const [geocoding, setGeocoding] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: listings, refetch } = useQuery({
    queryKey: ["listings", false],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .is("archived_at", null)
        .limit(500);
      if (error) throw error;
      return data as Listing[];
    },
  });

  const points = useMemo(() => {
    return (listings ?? [])
      .map((l) => {
        const g = geocode(l);
        return g ? { listing: l, coords: g.coords, precise: g.precise } : null;
      })
      .filter((p): p is { listing: Listing; coords: [number, number]; precise: boolean } =>
        p != null,
      );
  }, [listings]);

  const preciseCount = points.filter((p) => p.precise).length;

  const runGeocode = async () => {
    setGeocoding(true);
    try {
      const { data, error } = await supabase.functions.invoke("geocode-listings");
      if (error) throw error;
      toast.success(
        `${data?.updated ?? 0} von ${data?.processed ?? 0} Inseraten erfolgreich verortet`,
      );
      await refetch();
    } catch (e) {
      toast.error("Geocoding fehlgeschlagen");
      console.error(e);
    } finally {
      setGeocoding(false);
    }
  };

  if (!mounted) return <div className="h-[600px] animate-pulse rounded-lg bg-muted" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
            Standorte
          </span>
          <h1 className="font-serif-display text-3xl sm:text-4xl">Karte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {preciseCount} exakt · {points.length - preciseCount} grob (PLZ) · {(listings?.length ?? 0) - points.length} ohne Adresse
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={runGeocode} disabled={geocoding}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${geocoding ? "animate-spin" : ""}`} />
            Adressen verorten
          </Button>
          <div className="inline-flex rounded-full border border-border/70 bg-card p-1 shadow-soft">
            <button
              onClick={() => setView("map")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                view === "map"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <MapIcon className="h-3 w-3" /> Karte
            </button>
            <button
              onClick={() => setView("list")}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
                view === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3 w-3" /> Liste
            </button>
          </div>
        </div>
      </div>

      {view === "map" ? (
        <Card className="border-border/70 bg-card shadow-soft">
          <CardContent className="p-0">
            <MapView points={points} />
          </CardContent>
        </Card>
      ) : (
        <ListView points={points} />
      )}
    </div>
  );
}

function ListView({
  points,
}: {
  points: { listing: Listing; coords: [number, number]; precise: boolean }[];
}) {
  if (points.length === 0) {
    return (
      <Card className="border-border/70 bg-card shadow-soft">
        <CardContent className="py-16 text-center text-sm text-muted-foreground">
          Noch keine verorteten Inserate.
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-2">
      {points.map((p) => (
        <Link
          key={p.listing.id}
          to="/listings/$id"
          params={{ id: p.listing.id }}
          className="block"
        >
          <Card className="border-border/70 bg-card transition-all hover:border-foreground/30 hover:shadow-card">
            <CardContent className="flex items-center gap-4 p-4">
              {p.listing.image_url ? (
                <img
                  src={p.listing.image_url}
                  alt={p.listing.title}
                  className="h-16 w-24 flex-shrink-0 rounded-md object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                  Kein Bild
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-serif-display text-base">
                    {p.listing.title}
                  </h3>
                  <Badge
                    variant="secondary"
                    className="border-0 bg-muted text-[9px] uppercase tracking-wider"
                  >
                    {PORTAL_LABELS[p.listing.primary_portal]}
                  </Badge>
                  {!p.precise && (
                    <Badge
                      variant="outline"
                      className="border-border/70 text-[9px] uppercase tracking-wider"
                    >
                      ungefähr
                    </Badge>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {p.listing.address ? `${p.listing.address}, ` : ""}
                  {p.listing.postal_code} {p.listing.city}
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <div className="font-serif-display text-lg">
                  {formatPricePerSqm(
                    p.listing.price_per_sqm ? Number(p.listing.price_per_sqm) : null,
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCHF(p.listing.price_chf ? Number(p.listing.price_chf) : null)} ·{" "}
                  {formatSqm(p.listing.area_sqm ? Number(p.listing.area_sqm) : null)}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function MapView({
  points,
}: {
  points: { listing: Listing; coords: [number, number]; precise: boolean }[];
}) {
  const [Comp, setComp] = useState<null | {
    MapContainer: typeof import("react-leaflet").MapContainer;
    TileLayer: typeof import("react-leaflet").TileLayer;
    Marker: typeof import("react-leaflet").Marker;
    Popup: typeof import("react-leaflet").Popup;
    icon: import("leaflet").Icon;
  }>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const RL = await import("react-leaflet");
      const L = await import("leaflet");
      const icon = L.icon({
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      if (!cancelled) setComp({ ...RL, icon });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!Comp) return <div className="h-[600px] animate-pulse bg-muted" />;
  const { MapContainer, TileLayer, Marker, Popup, icon } = Comp;

  return (
    <MapContainer center={CH_CENTER} zoom={8} style={{ height: 600, width: "100%" }}>
      <TileLayer
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <Marker key={p.listing.id} position={p.coords} icon={icon}>
          <Popup>
            <div className="space-y-1 text-sm">
              <div className="font-medium">{p.listing.title}</div>
              <div className="text-xs">
                {PORTAL_LABELS[p.listing.primary_portal]} · {p.listing.postal_code}{" "}
                {p.listing.city}
              </div>
              {p.listing.address && (
                <div className="text-xs text-muted-foreground">{p.listing.address}</div>
              )}
              <div className="text-xs">
                {formatCHF(p.listing.price_chf ? Number(p.listing.price_chf) : null)} ·{" "}
                {formatSqm(p.listing.area_sqm ? Number(p.listing.area_sqm) : null)}
              </div>
              <div className="font-semibold">
                {formatPricePerSqm(
                  p.listing.price_per_sqm ? Number(p.listing.price_per_sqm) : null,
                )}
              </div>
              <Link
                to="/listings/$id"
                params={{ id: p.listing.id }}
                className="text-primary underline"
              >
                Details
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
