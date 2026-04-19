import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Listing } from "@/lib/db-types";
import { formatCHF, formatPricePerSqm, formatSqm, PORTAL_LABELS } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/map")({
  component: MapPage,
});

// Approximate center of Switzerland
const CH_CENTER: [number, number] = [46.8, 8.3];

// Lookup table for major Swiss postal-code prefixes (fallback when no lat/lng).
const PLZ_FALLBACK: Record<string, [number, number]> = {
  "10": [46.52, 6.63],  // Lausanne
  "12": [46.2, 6.14],   // Genève
  "30": [46.95, 7.45],  // Bern
  "40": [47.56, 7.59],  // Basel
  "60": [47.05, 8.31],  // Luzern
  "70": [46.81, 9.84],  // Chur
  "80": [47.37, 8.54],  // Zürich
  "90": [47.42, 9.37],  // St. Gallen
};

function geocode(l: Listing): [number, number] | null {
  if (l.latitude != null && l.longitude != null) {
    return [Number(l.latitude), Number(l.longitude)];
  }
  if (l.postal_code) {
    const prefix = l.postal_code.toString().slice(0, 2);
    if (PLZ_FALLBACK[prefix]) return PLZ_FALLBACK[prefix];
  }
  return null;
}

function MapPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: listings } = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").limit(500);
      if (error) throw error;
      return data as Listing[];
    },
  });

  const points = useMemo(() => {
    return (listings ?? [])
      .map((l) => ({ listing: l, coords: geocode(l) }))
      .filter((p): p is { listing: Listing; coords: [number, number] } =>
        p.coords != null,
      );
  }, [listings]);

  if (!mounted) {
    return <div className="h-[600px] animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Karte</h1>
        <p className="text-sm text-muted-foreground">
          {points.length} von {listings?.length ?? 0} Inseraten verortet (genaue Adresse oder PLZ-Region).
        </p>
      </div>
      <Card>
        <CardContent className="p-0">
          <MapView points={points} />
        </CardContent>
      </Card>
    </div>
  );
}

function MapView({
  points,
}: {
  points: { listing: Listing; coords: [number, number] }[];
}) {
  // Dynamic import on client only — leaflet touches window
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
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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
    <MapContainer
      center={CH_CENTER}
      zoom={8}
      style={{ height: 600, width: "100%" }}
    >
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
                {PORTAL_LABELS[p.listing.primary_portal]} ·{" "}
                {p.listing.postal_code} {p.listing.city}
              </div>
              <div className="text-xs">
                {formatCHF(p.listing.price_chf ? Number(p.listing.price_chf) : null)}{" "}
                ·{" "}
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
