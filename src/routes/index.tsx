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
import { Heart, Star, TrendingDown, Building2, Sparkles, MapPin } from "lucide-react";

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
      return { count: 0, median: null as number | null, favorites: 0, newest: 0 };
    const ppsm = listings
      .map((l) => (l.price_per_sqm != null ? Number(l.price_per_sqm) : null))
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    const median = ppsm.length ? ppsm[Math.floor(ppsm.length / 2)] : null;
    const favorites = listings.filter((l) => l.is_favorite).length;
    const cutoff = Date.now() - 1000 * 60 * 60 * 24 * 7;
    const newest = listings.filter((l) => new Date(l.created_at).getTime() > cutoff).length;
    return { count: listings.length, median, favorites, newest };
  }, [listings]);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl glass shadow-elegant">
        <div className="absolute -top-32 left-1/2 h-64 w-[120%] -translate-x-1/2 rounded-full bg-gradient-primary opacity-20 blur-3xl" />
        <div className="relative grid gap-8 p-8 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:gap-12">
          <div className="space-y-4">
            <Badge className="border-border/40 bg-card/50 text-xs font-medium tracking-wide text-muted-foreground">
              <Sparkles className="mr-1 h-3 w-3 text-primary" /> Live-Aggregation
            </Badge>
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Dein Schweizer{" "}
              <span className="text-gradient">Immobilien-Radar</span>
            </h1>
            <p className="max-w-xl text-sm text-muted-foreground sm:text-base">
              Alle Suchabos aus ImmoScout24, Homegate, Flatfox & Co. — automatisch entstaubt,
              dedupliziert und nach CHF/m² sortiert.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 self-end">
            <StatTile
              icon={<Building2 className="h-4 w-4" />}
              label="Inserate"
              value={stats.count.toString()}
            />
            <StatTile
              icon={<TrendingDown className="h-4 w-4" />}
              label="Median CHF/m²"
              value={stats.median ? Math.round(stats.median).toString() : "—"}
            />
            <StatTile
              icon={<Star className="h-4 w-4" />}
              label="Favoriten"
              value={stats.favorites.toString()}
            />
          </div>
        </div>
      </section>

      {/* Filters */}
      <Card className="glass border-border/40 shadow-elegant">
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
          <Select value={status} onValueChange={(v) => setStatus(v as ListingStatus | "all")}>
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
            className={
              favoritesOnly
                ? "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                : "border-border/60 bg-card/40"
            }
          >
            <Heart className="mr-1 h-4 w-4" /> Favoriten
          </Button>
        </CardContent>
      </Card>

      {/* Listings grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-2xl border border-border/40 bg-card/30"
            />
          ))}
        </div>
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

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="glass border-border/40 shadow-elegant">
      <CardContent className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
          <Sparkles className="h-6 w-6 text-primary-foreground" />
        </div>
        <h3 className="text-lg font-semibold">Noch keine Inserate</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Verbinde dein Gmail, damit Immo Radar deine Suchabo-Mails automatisch verarbeitet.
        </p>
        <Link
          to="/onboarding"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-gradient-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-105"
        >
          Setup starten
        </Link>
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
    !!alertThreshold && ppsm != null && ppsm <= Number(alertThreshold) * 0.85;

  return (
    <Link to="/listings/$id" params={{ id: listing.id }} className="group block">
      <Card
        className={`relative overflow-hidden border-border/40 bg-card/50 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-glow ${
          isAlert ? "ring-1 ring-primary/60" : ""
        }`}
      >
        <div className="relative h-44 overflow-hidden">
          {listing.image_url ? (
            <img
              src={listing.image_url}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-card text-xs text-muted-foreground">
              Kein Bild
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            <Badge className="border-0 bg-background/70 text-[10px] uppercase tracking-wider text-foreground backdrop-blur-md">
              {PORTAL_LABELS[listing.primary_portal] ?? listing.primary_portal}
            </Badge>
            {isAlert && (
              <Badge className="border-0 bg-gradient-primary text-[10px] uppercase tracking-wider text-primary-foreground shadow-glow">
                Deal
              </Badge>
            )}
          </div>
          {listing.is_favorite && (
            <div className="absolute right-3 top-3 rounded-full bg-background/70 p-1.5 backdrop-blur-md">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
            </div>
          )}
        </div>
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1">
            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{listing.title}</h3>
            {listing.city && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {listing.postal_code} {listing.city}
              </div>
            )}
          </div>
          <div className="flex items-end justify-between border-t border-border/40 pt-3">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Preis · Fläche
              </div>
              <div className="text-sm font-medium">
                {formatCHF(listing.price_chf ? Number(listing.price_chf) : null)} ·{" "}
                {formatSqm(listing.area_sqm ? Number(listing.area_sqm) : null)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                CHF/m²
              </div>
              <div
                className={`text-xl font-semibold tracking-tight ${
                  isAlert ? "text-gradient" : ""
                }`}
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
