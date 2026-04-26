import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import porscheImg from "@/assets/porsche-gt4rs.png";
import { ListingSlotMachine } from "@/components/ListingSlotMachine";
import { PitchHero } from "@/components/PitchHero";
import { ContactProgress } from "@/components/ContactProgress";
import {
  formatCHF,
  formatPricePerSqm,
  formatSqm,
  PORTAL_LABELS,
} from "@/lib/format";
import type { Listing, ListingStatus } from "@/lib/db-types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Heart,
  Star,
  MapPin,
  Archive,
  ArchiveRestore,
  Sparkles,
  Phone,
  Eye,
  X,
  Inbox,
  Search,
  Check,
  ChevronRight,
  Clock,
} from "lucide-react";

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
  });
  const time = d.toLocaleTimeString("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} ${time}`;
}

function formatExactTime(iso: string): string {
  return new Date(iso).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const Route = createFileRoute("/")({
  component: ListingsPage,
});

type PipelineStage = "new" | "interested" | "contacted" | "visited" | "rejected";

const STAGES: ReadonlyArray<{
  key: PipelineStage;
  label: string;
  short: string;
  icon: typeof Inbox;
  tone: string;
}> = [
  { key: "new", label: "Inbox", short: "Neu", icon: Inbox, tone: "text-foreground" },
  { key: "interested", label: "Interessant", short: "Like", icon: Sparkles, tone: "text-accent" },
  { key: "contacted", label: "Kontaktiert", short: "Mail", icon: Phone, tone: "text-foreground" },
  { key: "visited", label: "Besichtigt", short: "Visit", icon: Eye, tone: "text-foreground" },
  { key: "rejected", label: "Abgelehnt", short: "Nope", icon: X, tone: "text-muted-foreground" },
];

function ListingsPage() {
  const [stage, setStage] = useState<PipelineStage>("new");
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
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
      const rows = data as Listing[];

      // Fallback-Bilder: lade erstes listing_images-Bild je Inserat,
      // falls image_url leer ist (z. B. nach Tracking-Wrapper-Cleanup).
      const missing = rows.filter((l) => !l.image_url).map((l) => l.id);
      if (missing.length > 0) {
        const { data: imgs } = await supabase
          .from("listing_images" as never)
          .select("listing_id, url, sort_order")
          .in("listing_id", missing)
          .order("sort_order", { ascending: true });
        const firstByListing = new Map<string, string>();
        for (const img of (imgs ?? []) as Array<{ listing_id: string; url: string }>) {
          if (!firstByListing.has(img.listing_id)) {
            firstByListing.set(img.listing_id, img.url);
          }
        }
        for (const l of rows) {
          if (!l.image_url && firstByListing.has(l.id)) {
            l.image_url = firstByListing.get(l.id) ?? null;
          }
        }
      }
      return rows;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ListingStatus }) => {
      const { error } = await supabase.from("listings").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["listings"] });
      const prev = qc.getQueryData<Listing[]>(["listings", showArchived]);
      qc.setQueryData<Listing[]>(["listings", showArchived], (old) =>
        old?.map((l) => (l.id === id ? { ...l, status } : l)) ?? [],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["listings", showArchived], ctx.prev);
      toast.error("Status konnte nicht aktualisiert werden");
    },
    onSuccess: (_, vars) => {
      const stageLabel = STAGES.find((s) => s.key === vars.status)?.label ?? vars.status;
      toast.success(`Verschoben → ${stageLabel}`);
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
      toast.success(vars.archive ? "Archiviert" : "Wiederhergestellt");
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, fav }: { id: string; fav: boolean }) => {
      const { error } = await supabase
        .from("listings")
        .update({ is_favorite: fav })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, fav }) => {
      await qc.cancelQueries({ queryKey: ["listings"] });
      const prev = qc.getQueryData<Listing[]>(["listings", showArchived]);
      qc.setQueryData<Listing[]>(["listings", showArchived], (old) =>
        old?.map((l) => (l.id === id ? { ...l, is_favorite: fav } : l)) ?? [],
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["listings", showArchived], ctx.prev);
    },
  });

  const counts = useMemo(() => {
    const c: Record<PipelineStage, number> = {
      new: 0,
      interested: 0,
      contacted: 0,
      visited: 0,
      rejected: 0,
    };
    listings?.forEach((l) => {
      c[l.status as PipelineStage] = (c[l.status as PipelineStage] ?? 0) + 1;
    });
    return c;
  }, [listings]);

  const filtered = useMemo(() => {
    if (!listings) return [];
    return listings.filter((l) => {
      if (l.status !== stage) return false;
      if (favoritesOnly && !l.is_favorite) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${l.title} ${l.city ?? ""} ${l.postal_code ?? ""} ${l.address ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [listings, stage, favoritesOnly, search]);

  const totalActive = listings?.length ?? 0;
  const median = useMemo(() => {
    const v = (listings ?? [])
      .map((l) => (l.price_per_sqm != null ? Number(l.price_per_sqm) : null))
      .filter((x): x is number => x != null)
      .sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  }, [listings]);

  return (
    <div className="space-y-10 md:space-y-14">
      {/* Editorial Header — Marktintelligenz */}
      <section>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-steel">
              Marktintelligenz
            </p>
            <h1 className="mt-2 font-serif-display text-4xl leading-[1.05] sm:text-5xl md:text-6xl bg-gradient-to-b from-sapphire-light to-sapphire bg-clip-text text-transparent">
              Deal Pipeline
            </h1>
            <p className="mt-3 max-w-md text-sm font-light text-steel">
              Aggregierte Suchabos. Präzise CHF/m²-Analyse. Dein Weg zum
              <span className="italic text-sapphire"> GT4 RS.</span>
            </p>
          </div>
          <div className="flex gap-8 md:gap-12">
            <div>
              <p className="text-[9px] uppercase tracking-[0.22em] text-steel mb-1">
                Aktive Inserate
              </p>
              <p className="font-serif-display text-3xl tabular-nums text-sapphire md:text-4xl">
                {totalActive}
              </p>
            </div>
            <div className="border-l-[0.5px] border-hairline pl-8 md:pl-12">
              <p className="text-[9px] uppercase tracking-[0.22em] text-steel mb-1">
                Median CHF/m²
              </p>
              <p className="font-serif-display text-3xl tabular-nums text-sapphire md:text-4xl">
                {median ? Math.round(median).toLocaleString("de-CH") : "—"}
              </p>
            </div>
            <img
              src={porscheImg}
              alt="Porsche 911 GT4 RS"
              loading="lazy"
              className="hidden h-20 w-auto self-center drop-shadow-[0_8px_16px_rgba(8,29,66,0.18)] lg:block"
            />
          </div>
        </div>
      </section>

      {/* Filter band — hairline borders, glass chips */}
      <div className="border-y-[0.5px] border-hairline py-3">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-steel" />
            <Input
              placeholder="Adresse, PLZ, Titel suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 rounded-[3px] border-[0.5px] border-hairline bg-white/60 pl-9 text-xs font-light placeholder:text-steel focus-visible:ring-1 focus-visible:ring-sapphire/30"
            />
          </div>
          <div className="mx-2 h-4 w-px bg-hairline shrink-0" />
          <button
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`shrink-0 rounded-[3px] border-[0.5px] px-3 py-1.5 text-[11px] font-medium transition-all ${
              favoritesOnly
                ? "border-sapphire/30 bg-white text-sapphire shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                : "border-transparent text-steel hover:bg-white/40"
            }`}
          >
            <Heart className={`mr-1.5 inline h-3 w-3 ${favoritesOnly ? "fill-current" : ""}`} />
            Favoriten
          </button>
          <button
            onClick={() => setShowArchived((v) => !v)}
            className={`shrink-0 rounded-[3px] border-[0.5px] px-3 py-1.5 text-[11px] font-medium transition-all ${
              showArchived
                ? "border-sapphire/30 bg-white text-sapphire shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                : "border-transparent text-steel hover:bg-white/40"
            }`}
          >
            <Archive className="mr-1.5 inline h-3 w-3" />
            Archiv
          </button>
        </div>
      </div>

      {/* Pitch / Wert-Versprechen */}
      <PitchHero />

      {/* Slot machine — Casino-Style Inserat-Roulette */}
      {listings && listings.length >= 3 && (
        <ListingSlotMachine listings={listings} />
      )}

      {/* Pipeline column tabs — sapphire eyebrow style */}
      <div className="sticky top-12 z-30 -mx-4 border-b-[0.5px] border-hairline bg-background/80 px-4 py-3 backdrop-blur-2xl md:-mx-6 md:px-6">
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {STAGES.map((s) => {
            const active = stage === s.key;
            const count = counts[s.key] ?? 0;
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setStage(s.key)}
                className={`group relative flex shrink-0 items-center gap-2 rounded-[3px] border-[0.5px] px-3 py-1.5 text-[11px] font-medium transition-all ${
                  active
                    ? "border-sapphire/30 bg-white text-sapphire shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                    : "border-transparent text-steel hover:bg-white/40"
                }`}
              >
                <Icon className="h-3 w-3" />
                <span>{s.label}</span>
                <span className="rounded-[2px] font-serif-display text-[11px] tabular-nums text-steel">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        {/* Hairline progress strip */}
        <div className="mt-2 flex h-px overflow-hidden bg-hairline">
          {STAGES.map((s) => {
            const v = counts[s.key] ?? 0;
            const pct = totalActive > 0 ? (v / totalActive) * 100 : 0;
            const isActive = stage === s.key;
            return (
              <div
                key={s.key}
                style={{ width: `${pct}%` }}
                className={`transition-all ${isActive ? "bg-sapphire-light" : "bg-sapphire/30"}`}
                title={`${s.label}: ${v}`}
              />
            );
          })}
        </div>
      </div>

      {/* Listings */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-[6px] border-[0.5px] border-hairline bg-white/40"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState stage={stage} />
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((l) => (
              <PipelineCard
                key={l.id}
                listing={l}
                stage={stage}
                isArchived={showArchived}
                onSetStatus={(status) => updateStatus.mutate({ id: l.id, status })}
                onArchive={(doArchive) => archive.mutate({ id: l.id, archive: doArchive })}
                onToggleFav={() =>
                  toggleFavorite.mutate({ id: l.id, fav: !l.is_favorite })
                }
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function PorscheGoalAnimation() {
  return (
    <div className="relative mt-8 w-full max-w-xl overflow-hidden rounded-xl border border-border/60 bg-gradient-to-b from-background to-muted/40 px-2 py-6">
      {/* Sky / horizon */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-amber-100/30 via-transparent to-transparent dark:from-amber-300/10" />

      {/* Goal flag */}
      <div className="absolute right-4 top-4 flex flex-col items-center">
        <motion.div
          initial={{ rotate: -8 }}
          animate={{ rotate: [-8, 8, -8] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="origin-bottom-left"
        >
          <div className="grid h-6 w-10 grid-cols-4 grid-rows-3 overflow-hidden rounded-sm shadow">
            {Array.from({ length: 12 }).map((_, i) => {
              const row = Math.floor(i / 4);
              const col = i % 4;
              const black = (row + col) % 2 === 0;
              return (
                <div
                  key={i}
                  className={black ? "bg-foreground" : "bg-background"}
                />
              );
            })}
          </div>
        </motion.div>
        <div className="h-10 w-0.5 bg-foreground/70" />
        <span className="mt-1 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Ziel
        </span>
      </div>

      {/* Road */}
      <div className="relative mx-auto mt-10 h-20 w-[92%] rounded-md bg-neutral-800 shadow-inner dark:bg-neutral-900">
        {/* Lane dashes moving toward the right */}
        <motion.div
          className="absolute inset-y-1/2 left-0 right-0 -translate-y-1/2 flex gap-4"
          animate={{ x: [0, -48] }}
          transition={{ duration: 0.6, repeat: Infinity, ease: "linear" }}
        >
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="h-1 w-8 shrink-0 rounded bg-amber-300/90" />
          ))}
        </motion.div>

        {/* Porsche getting closer to the goal */}
        <motion.img
          src={porscheImg}
          alt="Roter Porsche 718 Cayman GT4 RS rast Richtung Ziel"
          className="absolute bottom-1 left-0 h-14 w-auto select-none drop-shadow-[0_8px_12px_rgba(220,38,38,0.45)]"
          style={{ filter: "hue-rotate(-10deg) saturate(1.6)" }}
          initial={{ x: "0%", scale: 0.7 }}
          animate={{ x: ["0%", "70%", "78%", "70%", "0%"], scale: [0.7, 1.05, 1.1, 1.05, 0.7] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", times: [0, 0.45, 0.55, 0.65, 1] }}
        />

        {/* Speed lines */}
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{ opacity: [0.2, 0.6, 0.2] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        >
          <div className="absolute left-2 top-3 h-0.5 w-10 rounded bg-white/40" />
          <div className="absolute left-6 top-7 h-0.5 w-14 rounded bg-white/30" />
          <div className="absolute left-3 bottom-3 h-0.5 w-8 rounded bg-white/40" />
        </motion.div>
      </div>

      <p className="mt-4 text-center text-xs uppercase tracking-[0.25em] text-muted-foreground">
        Auf dem Weg zum Porsche 718 GT4 RS
      </p>
    </div>
  );
}

function EmptyState({ stage }: { stage: PipelineStage }) {
  const messages: Record<PipelineStage, { title: string; sub: string }> = {
    new: { title: "Alles bearbeitet", sub: "" },
    interested: {
      title: "Noch nichts auf der Watchlist",
      sub: "Markiere ein Inserat als interessant, um es hier zu sehen.",
    },
    contacted: {
      title: "Keine Kontakte offen",
      sub: "Verschiebe Inserate hierher, sobald du den Anbieter angeschrieben hast.",
    },
    visited: {
      title: "Keine Besichtigungen",
      sub: "Halte hier fest, was du dir live angeschaut hast.",
    },
    rejected: {
      title: "Abgelehnt-Stapel ist leer",
      sub: "Hier sammeln sich Inserate, die nicht passen.",
    },
  };
  const m = messages[stage];
  return (
    <Card className="rounded-[6px] border-[0.5px] border-dashed border-hairline bg-white/40 shadow-none">
      <CardContent className="flex flex-col items-center py-16 text-center">
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-steel mb-2">
          Status
        </p>
        <h3 className="font-serif-display text-3xl text-sapphire">{m.title}</h3>
        {m.sub && (
          <p className="mt-2 max-w-sm text-sm font-light text-steel">{m.sub}</p>
        )}
        {stage === "new" && <PorscheGoalAnimation />}
      </CardContent>
    </Card>
  );
}

function PipelineCard({
  listing,
  stage,
  isArchived,
  onSetStatus,
  onArchive,
  onToggleFav,
}: {
  listing: Listing;
  stage: PipelineStage;
  isArchived: boolean;
  onSetStatus: (s: ListingStatus) => void;
  onArchive: (a: boolean) => void;
  onToggleFav: () => void;
}) {
  const ppsm = listing.price_per_sqm != null ? Number(listing.price_per_sqm) : null;

  // Quick actions per stage — what makes sense to do next
  const actions: ReadonlyArray<{
    key: ListingStatus;
    label: string;
    icon: typeof Sparkles;
    variant: "default" | "outline" | "ghost";
    tone?: string;
  }> = stage === "new"
    ? [
        { key: "interested", label: "Interessant", icon: Sparkles, variant: "default" },
        { key: "rejected", label: "Ablehnen", icon: X, variant: "outline" },
      ]
    : stage === "interested"
    ? [
        { key: "contacted", label: "Anschreiben", icon: Phone, variant: "default" },
        { key: "rejected", label: "Ablehnen", icon: X, variant: "outline" },
      ]
    : stage === "contacted"
    ? [
        { key: "visited", label: "Besichtigt", icon: Eye, variant: "default" },
        { key: "rejected", label: "Ablehnen", icon: X, variant: "outline" },
      ]
    : stage === "visited"
    ? [
        { key: "interested", label: "Zurück zu Liste", icon: Sparkles, variant: "outline" },
        { key: "rejected", label: "Doch nicht", icon: X, variant: "outline" },
      ]
    : [
        { key: "new", label: "In Inbox zurück", icon: Inbox, variant: "outline" },
        { key: "interested", label: "Doch interessant", icon: Sparkles, variant: "default" },
      ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      className="group relative"
    >
      <Card className="overflow-hidden rounded-[6px] border-[0.5px] border-hairline bg-white shadow-[0_1px_2px_rgba(8,29,66,0.03)] transition-all hover:border-sapphire/20 hover:shadow-[0_4px_24px_-8px_rgba(8,29,66,0.10)] gap-0 py-0">
        <Link to="/listings/$id" params={{ id: listing.id }} className="block">
          <div className="relative aspect-[16/10] overflow-hidden bg-muted">
            {listing.image_url ? (
              <img
                src={listing.image_url}
                alt={listing.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-steel">
                Kein Bild
              </div>
            )}
            {/* Hairline inner outline */}
            <div className="pointer-events-none absolute inset-0 outline outline-1 -outline-offset-1 outline-black/5" />
            {/* Top-left badges */}
            <div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1">
              <Badge
                variant="secondary"
                className="rounded-[2px] border-[0.5px] border-hairline bg-white/90 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-[0.18em] text-sapphire backdrop-blur-md"
              >
                {PORTAL_LABELS[listing.primary_portal] ?? listing.primary_portal}
              </Badge>
              {isArchived && (
                <Badge className="rounded-[2px] border-0 bg-black/70 px-1.5 py-0 text-[9px] uppercase tracking-[0.18em] text-white backdrop-blur-md">
                  Archiv
                </Badge>
              )}
            </div>
            {/* Favorite toggle */}
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFav();
              }}
              className="absolute right-2.5 top-2.5 rounded-[3px] border-[0.5px] border-hairline bg-white/90 p-1.5 backdrop-blur-md transition-transform active:scale-90"
              aria-label="Favorit"
            >
              {listing.is_favorite ? (
                <Star className="h-3 w-3 fill-sapphire text-sapphire" />
              ) : (
                <Star className="h-3 w-3 text-steel" />
              )}
            </button>
          </div>

          <CardContent className="space-y-3 p-3.5">
            {/* Title + price */}
            <div className="flex items-start justify-between gap-3">
              <h3 className="line-clamp-2 flex-1 text-sm font-medium leading-tight text-foreground">
                {listing.title}
              </h3>
              <p className="font-serif-display whitespace-nowrap text-base tabular-nums text-sapphire">
                {formatCHF(listing.price_chf ? Number(listing.price_chf) : null)}
              </p>
            </div>

            {/* Location */}
            <div className="flex items-center justify-between gap-2 text-[11px] text-steel">
              {listing.city ? (
                <div className="flex min-w-0 items-center gap-1 font-light tracking-wide">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {listing.postal_code} {listing.city}
                  </span>
                </div>
              ) : (
                <span />
              )}
              <div
                className="flex shrink-0 items-center gap-1 text-[10px] font-light tabular-nums"
                title={formatExactTime(listing.first_seen_at)}
              >
                <Clock className="h-2.5 w-2.5" />
                {formatDateTime(listing.first_seen_at)}
              </div>
            </div>

            {/* Metric grid — hairline separated */}
            <div className="grid grid-cols-3 gap-2 border-t-[0.5px] border-hairline pt-2.5">
              <div>
                <p className="mb-0.5 text-[8px] font-medium uppercase tracking-[0.22em] text-steel">
                  Fläche
                </p>
                <p className="text-xs font-medium tabular-nums text-foreground">
                  {formatSqm(listing.area_sqm ? Number(listing.area_sqm) : null)}
                </p>
              </div>
              <div>
                <p className="mb-0.5 text-[8px] font-medium uppercase tracking-[0.22em] text-steel">
                  CHF/m²
                </p>
                <p className="text-xs font-medium tabular-nums text-foreground">
                  {formatPricePerSqm(ppsm)}
                </p>
              </div>
              <div>
                <p className="mb-0.5 text-[8px] font-medium uppercase tracking-[0.22em] text-steel">
                  Stage
                </p>
                <p className="text-xs font-medium text-foreground">
                  {STAGES.find((s) => s.key === stage)?.short ?? "—"}
                </p>
              </div>
            </div>
          </CardContent>
        </Link>

        {/* Quick action bar — hairline & sapphire */}
        <div className="flex items-stretch gap-1.5 border-t-[0.5px] border-hairline bg-white/40 p-2">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.key}
                variant={a.variant}
                size="sm"
                className={`h-8 flex-1 rounded-[3px] text-[11px] font-medium ${
                  a.variant === "default"
                    ? "bg-sapphire text-white hover:bg-sapphire-light"
                    : "border-[0.5px] border-hairline bg-white text-sapphire hover:bg-white/80"
                }`}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSetStatus(a.key);
                }}
              >
                <Icon className="mr-1 h-3 w-3" />
                {a.label}
              </Button>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 rounded-[3px] p-0 text-steel hover:text-sapphire"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onArchive(!isArchived);
            }}
            aria-label={isArchived ? "Wiederherstellen" : "Archivieren"}
          >
            {isArchived ? (
              <ArchiveRestore className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {/* Contact progress — only when contacted */}
        {stage === "contacted" && <ContactProgress listingId={listing.id} compact />}

        {/* Stage indicator strip */}
        <StageIndicator current={listing.status as PipelineStage} />
      </Card>
    </motion.div>
  );
}

function StageIndicator({ current }: { current: PipelineStage }) {
  const idx = STAGES.findIndex((s) => s.key === current);
  return (
    <div className="flex items-center gap-1 border-t-[0.5px] border-hairline bg-white/40 px-3.5 py-2 text-[9px] uppercase tracking-[0.22em] text-steel">
      {STAGES.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <span
            className={`flex h-3.5 w-3.5 items-center justify-center rounded-[2px] text-[8px] font-semibold ${
              i < idx
                ? "bg-sapphire/15 text-sapphire"
                : i === idx
                ? "bg-sapphire text-white"
                : "bg-muted text-steel/60"
            }`}
          >
            {i < idx ? <Check className="h-2 w-2" /> : i + 1}
          </span>
          {i < STAGES.length - 1 && (
            <ChevronRight className="h-2 w-2 text-steel/40" />
          )}
        </div>
      ))}
      <span className="ml-auto font-medium text-sapphire">{STAGES[idx]?.label}</span>
    </div>
  );
}
