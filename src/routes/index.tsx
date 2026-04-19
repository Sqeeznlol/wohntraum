import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  formatCHF,
  formatPricePerSqm,
  formatSqm,
  PORTAL_LABELS,
  STATUS_LABELS,
} from "@/lib/format";
import type { Listing, Portal, ListingStatus } from "@/lib/db-types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Star } from "lucide-react";

type SortKey = "price_per_sqm" | "price_chf" | "area_sqm" | "created_at";

export const Route = createFileRoute("/")({
  component: ListingsPage,
});

function ListingsPage() {
  const [search, setSearch] = useState("");
  const [portal, setPortal] = useState<Portal | "all">("all");
  const [status, setStatus] = useState<ListingStatus | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [maxPricePerSqm, setMaxPricePerSqm] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");

  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Listing[];
    },
  });

  const filtered = useMemo(() => {
    if (!listings) return [];
    let out = listings.filter((l) => {
      if (portal !== "all" && l.primary_portal !== portal) return false;
      if (status !== "all" && l.status !== status) return false;
      if (favoritesOnly && !l.is_favorite) return false;
      if (
        maxPricePerSqm &&
        l.price_per_sqm != null &&
        Number(l.price_per_sqm) > Number(maxPricePerSqm)
      )
        return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${l.title} ${l.city ?? ""} ${l.postal_code ?? ""} ${l.address ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      const av = (a[sortKey] as number | null) ?? Number.POSITIVE_INFINITY;
      const bv = (b[sortKey] as number | null) ?? Number.POSITIVE_INFINITY;
      if (sortKey === "created_at") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return Number(av) - Number(bv);
    });
    return out;
  }, [listings, portal, status, favoritesOnly, maxPricePerSqm, search, sortKey]);

  const stats = useMemo(() => {
    if (!listings || listings.length === 0)
      return { count: 0, median: null as number | null };
    const ppsm = listings
      .map((l) => (l.price_per_sqm != null ? Number(l.price_per_sqm) : null))
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    const median = ppsm.length ? ppsm[Math.floor(ppsm.length / 2)] : null;
    return { count: listings.length, median };
  }, [listings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Inserate</h1>
          <p className="text-sm text-muted-foreground">
            {stats.count} Objekte • Median CHF/m²:{" "}
            <span className="font-medium text-foreground">
              {formatPricePerSqm(stats.median)}
            </span>
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-6">
          <Input
            placeholder="Suche Ort, PLZ, Titel…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:col-span-2"
          />
          <Select value={portal} onValueChange={(v) => setPortal(v as Portal | "all")}>
            <SelectTrigger>
              <SelectValue placeholder="Portal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Portale</SelectItem>
              {Object.entries(PORTAL_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => setStatus(v as ListingStatus | "all")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            placeholder="Max CHF/m²"
            value={maxPricePerSqm}
            onChange={(e) => setMaxPricePerSqm(e.target.value)}
          />
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">Neueste zuerst</SelectItem>
              <SelectItem value="price_per_sqm">CHF/m² aufsteigend</SelectItem>
              <SelectItem value="price_chf">Preis aufsteigend</SelectItem>
              <SelectItem value="area_sqm">Fläche aufsteigend</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={favoritesOnly ? "default" : "outline"}
            onClick={() => setFavoritesOnly((v) => !v)}
            className="md:col-span-1"
          >
            <Heart className="mr-1 h-4 w-4" /> Favoriten
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lade…</p>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <ListingCard key={l.id} listing={l} alertThreshold={maxPricePerSqm} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <h3 className="text-lg font-medium">Noch keine Inserate</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Richte zuerst die E-Mail-Weiterleitung ein.
        </p>
        <div className="mt-4">
          <Link
            to="/onboarding"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Setup starten
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function ListingCard({
  listing,
  alertThreshold,
}: {
  listing: Listing;
  alertThreshold: string;
}) {
  const ppsm = listing.price_per_sqm != null ? Number(listing.price_per_sqm) : null;
  const isAlert =
    alertThreshold && ppsm != null && ppsm <= Number(alertThreshold) * 0.85;

  return (
    <Link
      to="/listings/$id"
      params={{ id: listing.id }}
      className="group block"
    >
      <Card
        className={`overflow-hidden transition-shadow hover:shadow-md ${isAlert ? "ring-2 ring-primary" : ""}`}
      >
        {listing.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.image_url}
            alt={listing.title}
            className="h-40 w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-muted text-muted-foreground">
            Kein Bild
          </div>
        )}
        <CardContent className="space-y-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-medium">{listing.title}</h3>
            {listing.is_favorite && (
              <Star className="h-4 w-4 shrink-0 fill-yellow-400 text-yellow-400" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="secondary">
              {PORTAL_LABELS[listing.primary_portal] ?? listing.primary_portal}
            </Badge>
            <Badge variant="outline">{STATUS_LABELS[listing.status]}</Badge>
            {listing.city && (
              <span className="text-muted-foreground">
                {listing.postal_code} {listing.city}
              </span>
            )}
          </div>
          <div className="flex items-baseline justify-between border-t pt-2">
            <div>
              <div className="text-xs text-muted-foreground">Preis · Fläche</div>
              <div className="text-sm font-medium">
                {formatCHF(listing.price_chf ? Number(listing.price_chf) : null)} ·{" "}
                {formatSqm(listing.area_sqm ? Number(listing.area_sqm) : null)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">CHF/m²</div>
              <div
                className={`text-lg font-semibold ${isAlert ? "text-primary" : ""}`}
              >
                {formatPricePerSqm(ppsm)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
