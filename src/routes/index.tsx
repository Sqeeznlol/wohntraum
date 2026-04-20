import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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
import { Heart, Star, MapPin, Archive, ArchiveRestore } from "lucide-react";

type SortKey = "price_per_sqm" | "price_chf" | "area_sqm" | "created_at";

export const Route = createFileRoute("/")({
  component: ListingsPage,
});

function ListingsPage() {
  const [search, setSearch] = useState("");
  const [portal, setPortal] = useState<Portal | "all">("all");
  const [status, setStatus] = useState<ListingStatus | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [maxPricePerSqm, setMaxPricePerSqm] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const qc = useQueryClient();

  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings", showArchived],
    queryFn: async () => {
      const query = supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      const { data, error } = showArchived
        ? await query.not("archived_at", "is", null)
        : await query.is("archived_at", null);
      if (error) throw error;
      return data as Listing[];
    },
  });

  const archive = useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const { error } = await supabase
        .from("listings")
        .update({ archived_at: archive ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success(vars.archive ? "Inserat archiviert" : "Inserat wiederhergestellt");
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
      return { count: 0, median: null as number | null, favorites: 0 };
    const ppsm = listings
      .map((l) => (l.price_per_sqm != null ? Number(l.price_per_sqm) : null))
      .filter((v): v is number => v != null)
      .sort((a, b) => a - b);
    const median = ppsm.length ? ppsm[Math.floor(ppsm.length / 2)] : null;
    const favorites = listings.filter((l) => l.is_favorite).length;
    return { count: listings.length, median, favorites };
  }, [listings]);

  return (
    <div className="space-y-10">
      {/* Editorial hero */}
      <section className="border-b border-border/70 pb-10">
        <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr] lg:items-end">
          <div className="space-y-4">
            <span className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Übersicht · Schweiz
            </span>
            <h1 className="font-serif-display text-4xl leading-[1.05] sm:text-6xl">
              Inserate, sortiert nach dem,
              <br />
              <span className="italic text-muted-foreground">was wirklich zählt.</span>
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Aggregiert Suchabo-Mails aus ImmoScout24, Homegate, Flatfox & Co. — automatisch
              dedupliziert, mit transparentem CHF/m².
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-6 border-l border-border/70 pl-8 lg:gap-8">
            <Stat label="Inserate" value={stats.count.toString()} />
            <Stat
              label="Median CHF/m²"
              value={stats.median ? Math.round(stats.median).toString() : "—"}
            />
            <Stat label="Favoriten" value={stats.favorites.toString()} />
          </dl>
        </div>
      </section>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="inline-flex rounded-full border border-border/70 bg-card p-1 shadow-soft">
          <button
            onClick={() => setShowArchived(false)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
              !showArchived ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Aktiv
          </button>
          <button
            onClick={() => setShowArchived(true)}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors ${
              showArchived ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Archive className="h-3 w-3" /> Archiv
          </button>
        </div>
      </div>

      <Card className="border-border/70 bg-card shadow-soft">
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
          >
            <Heart className="mr-1 h-4 w-4" /> Favoriten
          </Button>
        </CardContent>
      </Card>

      {/* Listings grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-80 animate-pulse rounded-xl border border-border/70 bg-muted/40"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              alertThreshold={maxPricePerSqm}
              isArchived={showArchived}
              onArchiveToggle={(archive) => archive.mutate ? null : null}
              onArchive={(id, doArchive) => archive.mutate({ id, archive: doArchive })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-serif-display text-3xl">{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-border/70 bg-card shadow-soft">
      <CardContent className="flex flex-col items-center py-20 text-center">
        <h3 className="font-serif-display text-2xl">Noch keine Inserate</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Verbinde dein Gmail, damit Immo Radar deine Suchabo-Mails automatisch verarbeitet.
        </p>
        <Link
          to="/onboarding"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
      <Card className="overflow-hidden border-border/70 bg-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-card">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {listing.image_url ? (
            <img
              src={listing.image_url}
              alt={listing.title}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
              Kein Bild
            </div>
          )}
          <div className="absolute left-3 top-3 flex gap-1.5">
            <Badge
              variant="secondary"
              className="border-0 bg-background/85 text-[10px] font-medium uppercase tracking-wider text-foreground backdrop-blur-sm"
            >
              {PORTAL_LABELS[listing.primary_portal] ?? listing.primary_portal}
            </Badge>
            {isAlert && (
              <Badge className="border-0 bg-accent text-[10px] font-medium uppercase tracking-wider text-accent-foreground">
                Empfehlung
              </Badge>
            )}
          </div>
          {listing.is_favorite && (
            <div className="absolute right-3 top-3 rounded-full bg-background/85 p-1.5 backdrop-blur-sm">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
            </div>
          )}
        </div>
        <CardContent className="space-y-3 p-5">
          <div className="space-y-1">
            <h3 className="line-clamp-2 font-serif-display text-lg leading-tight">
              {listing.title}
            </h3>
            {listing.city && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" />
                {listing.postal_code} {listing.city}
              </div>
            )}
          </div>
          <div className="flex items-end justify-between border-t border-border/70 pt-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Preis · Fläche
              </div>
              <div className="text-sm font-medium">
                {formatCHF(listing.price_chf ? Number(listing.price_chf) : null)} ·{" "}
                {formatSqm(listing.area_sqm ? Number(listing.area_sqm) : null)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                CHF/m²
              </div>
              <div
                className={`font-serif-display text-2xl ${isAlert ? "text-accent" : ""}`}
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
