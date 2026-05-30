import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import porscheImg from "@/assets/porsche-gt4rs.webp";

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
  RefreshCw,
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
  const [showQueue, setShowQueue] = useState(false);
  const hasImage = (l: Listing) => !!(l.image_url && l.image_url.trim() !== "");
  const qc = useQueryClient();

  const LISTING_COLUMNS =
    "id,title,image_url,price_chf,price_per_sqm,area_sqm,rooms,city,postal_code,address,status,is_favorite,archived_at,created_at,updated_at,first_seen_at,primary_portal,primary_url,geo_researched";

  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings", showArchived],
    queryFn: async () => {
      const query = supabase
        .from("listings")
        .select(LISTING_COLUMNS)
        .order("created_at", { ascending: false })
        .limit(500);
      const { data, error } = showArchived
        ? await query.not("archived_at", "is", null)
        : await query.is("archived_at", null);
      if (error) throw error;
      return (data ?? []) as unknown as Listing[];
    },
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });

  // Lightweight count of incomplete (queued) non-archived listings — used for the badge.
  const { data: queueBadgeCount } = useQuery({
    queryKey: ["listings", "queue-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .is("archived_at", null)
        .or("image_url.is.null,image_url.eq.");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
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

  // Fire-and-forget: trigger the enrichment job in the background.
  // Does not wait for completion — the cron job picks up incomplete listings hourly.
  const [refreshTriggered, setRefreshTriggered] = useState(false);
  const triggerRefresh = () => {
    setRefreshTriggered(true);
    supabase.functions
      .invoke("enrich-listing", { body: { all_incomplete: true, limit: 25 } })
      .then(() => qc.invalidateQueries({ queryKey: ["listings"] }))
      .catch(() => {});
    toast.success("Aktualisierung im Hintergrund gestartet");
    setTimeout(() => setRefreshTriggered(false), 2000);
  };

  // Realtime: debounced refresh on listing changes. No browser-side enrichment.
  useEffect(() => {
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidate = () => {
      if (pending) return;
      pending = true;
      timer = setTimeout(() => {
        pending = false;
        qc.invalidateQueries({ queryKey: ["listings"] });
      }, 3000);
    };

    const channel = supabase
      .channel("listings-stream")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "listings" },
        scheduleInvalidate,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "listings" },
        scheduleInvalidate,
      )
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [qc]);


  const completeListings = useMemo(
    () => (listings ?? []).filter((l) => showArchived || hasImage(l)),
    [listings, showArchived],
  );
  const queueListings = useMemo(
    () => (listings ?? []).filter((l) => !hasImage(l) && !l.archived_at),
    [listings],
  );
  const queueCount = queueListings.length;

  const counts = useMemo(() => {
    const c: Record<PipelineStage, number> = {
      new: 0,
      interested: 0,
      contacted: 0,
      visited: 0,
      rejected: 0,
    };
    completeListings.forEach((l) => {
      c[l.status as PipelineStage] = (c[l.status as PipelineStage] ?? 0) + 1;
    });
    return c;
  }, [completeListings]);

  const filtered = useMemo(() => {
    return completeListings.filter((l) => {
      if (l.status !== stage) return false;
      if (favoritesOnly && !l.is_favorite) return false;
      if (search) {
        const s = search.toLowerCase();
        const hay = `${l.title} ${l.city ?? ""} ${l.postal_code ?? ""} ${l.address ?? ""}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [completeListings, stage, favoritesOnly, search]);

  const totalActive = completeListings.length;
  const median = useMemo(() => {
    const v = (listings ?? [])
      .map((l) => (l.price_per_sqm != null ? Number(l.price_per_sqm) : null))
      .filter((x): x is number => x != null)
      .sort((a, b) => a - b);
    return v.length ? v[Math.floor(v.length / 2)] : null;
  }, [listings]);

  const lastUpdated = useMemo(() => {
    if (!listings || listings.length === 0) return null;
    let max = 0;
    for (const l of listings) {
      const t = l.updated_at ? new Date(l.updated_at).getTime() : 0;
      if (t > max) max = t;
    }
    return max > 0 ? new Date(max) : null;
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
              Präzise CHF/m²-Analyse. Dein Weg zum
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
            <Button
              onClick={triggerRefresh}
              variant="outline"
              size="sm"
              className="self-center rounded-[3px] border-[0.5px] border-sapphire/30 bg-white text-xs font-medium text-sapphire hover:bg-sapphire hover:text-white"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshTriggered ? "animate-spin" : ""}`} />
              Aktualisieren
            </Button>
          </div>
        </div>
        {lastUpdated && (
          <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-steel">
            Zuletzt aktualisiert · {formatExactTime(lastUpdated.toISOString())}
          </p>
        )}
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
            onClick={() => {
              setShowArchived((v) => !v);
              setShowQueue(false);
            }}
            className={`shrink-0 rounded-[3px] border-[0.5px] px-3 py-1.5 text-[11px] font-medium transition-all ${
              showArchived
                ? "border-sapphire/30 bg-white text-sapphire shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                : "border-transparent text-steel hover:bg-white/40"
            }`}
          >
            <Archive className="mr-1.5 inline h-3 w-3" />
            Archiv
          </button>
          <button
            onClick={() => {
              setShowQueue((v) => !v);
              setShowArchived(false);
            }}
            className={`shrink-0 rounded-[3px] border-[0.5px] px-3 py-1.5 text-[11px] font-medium transition-all ${
              showQueue
                ? "border-sapphire/30 bg-white text-sapphire shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                : "border-transparent text-steel hover:bg-white/40"
            }`}
            title="Inserate ohne Bild – werden im Hintergrund angereichert"
          >
            <Clock className="mr-1.5 inline h-3 w-3" />
            Warteschlange
            {(queueBadgeCount ?? 0) > 0 && (
              <span className="ml-1.5 rounded-[2px] font-serif-display tabular-nums text-steel">
                {queueBadgeCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Pitch / Wert-Versprechen */}
      <PitchHero />


      {/* Pipeline column tabs — hidden in queue mode */}
      {!showQueue && (
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
      )}

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
      ) : showQueue ? (
        queueListings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-[6px] border-[0.5px] border-hairline bg-white/40 py-16 text-center">
            <Clock className="h-6 w-6 text-steel" />
            <p className="text-sm font-light text-steel">
              Keine Inserate in der Warteschlange.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {queueListings.map((l) => (
              <QueueCard key={l.id} listing={l} />
            ))}
          </div>
        )
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

function QueueCard({ listing }: { listing: Listing }) {
  const location = [listing.postal_code, listing.city].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-2 rounded-[6px] border-[0.5px] border-hairline bg-white/60 p-4 shadow-card">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-eyebrow text-steel">
        <Clock className="h-3 w-3 animate-pulse" />
        <span>Bild wird noch geladen…</span>
      </div>
      <h3 className="font-serif-display text-base leading-snug text-foreground line-clamp-2">
        {listing.title || "Inserat"}
      </h3>
      {location && (
        <div className="flex items-center gap-1 text-xs font-light text-steel">
          <MapPin className="h-3 w-3" />
          <span>{location}</span>
        </div>
      )}
      <div className="flex items-center justify-between text-xs font-light text-steel">
        <span className="tabular-nums">
          {listing.price_chf != null ? formatCHF(Number(listing.price_chf)) : "—"}
        </span>
        {listing.primary_url && (
          <a
            href={listing.primary_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sapphire hover:underline"
          >
            Portal <ChevronRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}

function PorscheGoalAnimation() {
  // Cinematic, Apple-style hero animation:
  // — Deep night skyline with parallax stars
  // — Twin layered roads with motion-blurred lane markers
  // — A red GT4 RS approaches from the horizon, tilts into frame, then dissolves into a hero shot
  // — Live telemetry HUD (km/h, distance) ticks in tabular nums
  return (
    <div className="relative mt-12 w-full max-w-2xl overflow-hidden rounded-[14px] border-[0.5px] border-hairline bg-[oklch(0.14_0.04_265)] shadow-[0_30px_80px_-30px_rgba(8,29,66,0.55)]">
      {/* Eyebrow chip */}
      <div className="absolute left-4 top-4 z-30 flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-red-500" />
        </span>
        <span className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/60">
          Live · Mission GT4 RS
        </span>
      </div>

      {/* HUD telemetry */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-4 text-right">
        <TelemetryCounter label="km/h" from={42} to={312} duration={5.6} />
        <div className="h-6 w-px bg-white/10" />
        <TelemetryCounter label="Distanz" from={9999} to={42} duration={5.6} suffix=" km" />
      </div>

      {/* Sky — sapphire night with stars */}
      <div className="relative h-[260px] w-full overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_85%,oklch(0.32_0.12_265)_0%,oklch(0.14_0.04_265)_55%,oklch(0.08_0.02_265)_100%)]" />
        {/* Stars */}
        <div className="absolute inset-0">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-px w-px rounded-full bg-white"
              style={{
                left: `${(i * 53) % 100}%`,
                top: `${(i * 37) % 60}%`,
                opacity: 0.3 + ((i * 7) % 10) / 14,
              }}
              animate={{ opacity: [0.2, 0.9, 0.2] }}
              transition={{
                duration: 2 + (i % 5) * 0.4,
                repeat: Infinity,
                delay: (i % 7) * 0.2,
              }}
            />
          ))}
        </div>

        {/* Distant city silhouette */}
        <div className="absolute inset-x-0 bottom-[58%] h-8 opacity-40">
          <svg viewBox="0 0 800 32" preserveAspectRatio="none" className="h-full w-full">
            <path
              d="M0 32 V18 L40 18 L40 10 L80 10 L80 14 L120 14 L120 6 L160 6 L160 16 L210 16 L210 8 L260 8 L260 18 L320 18 L320 12 L380 12 L380 4 L430 4 L430 14 L490 14 L490 8 L540 8 L540 18 L600 18 L600 10 L660 10 L660 16 L720 16 L720 6 L800 6 L800 32 Z"
              fill="oklch(0.22 0.08 265)"
            />
          </svg>
        </div>

        {/* Horizon glow */}
        <div className="absolute inset-x-0 bottom-[42%] h-px bg-gradient-to-r from-transparent via-red-500/60 to-transparent shadow-[0_0_20px_2px_rgba(239,68,68,0.5)]" />

        {/* Road — perspective floor */}
        <div
          className="absolute inset-x-0 bottom-0 h-[42%]"
          style={{
            background:
              "linear-gradient(to bottom, oklch(0.10 0.02 265) 0%, oklch(0.16 0.03 265) 100%)",
            perspective: "400px",
            perspectiveOrigin: "50% 0%",
          }}
        >
          {/* Center line — animated dashes vanishing into horizon */}
          <div
            className="absolute left-1/2 top-0 h-full w-[40%] -translate-x-1/2 overflow-hidden"
            style={{
              transform: "rotateX(72deg) translateZ(0)",
              transformOrigin: "50% 0%",
            }}
          >
            <motion.div
              className="flex h-full flex-col items-center gap-6"
              animate={{ y: [0, 80] }}
              transition={{ duration: 0.5, repeat: Infinity, ease: "linear" }}
            >
              {Array.from({ length: 30 }).map((_, i) => (
                <div
                  key={i}
                  className="h-12 w-3 rounded-full bg-amber-300/80 shadow-[0_0_8px_rgba(252,211,77,0.6)]"
                />
              ))}
            </motion.div>
          </div>

          {/* Side guide rails */}
          <div
            className="absolute left-1/2 top-0 h-full w-[90%] -translate-x-1/2"
            style={{
              transform: "rotateX(72deg)",
              transformOrigin: "50% 0%",
              background:
                "linear-gradient(to right, transparent 0%, transparent 8%, rgba(255,255,255,0.15) 8.5%, transparent 9%, transparent 91%, rgba(255,255,255,0.15) 91.5%, transparent 92%)",
            }}
          />
        </div>

        {/* Speed lines */}
        {Array.from({ length: 6 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{
              top: `${30 + i * 8}%`,
              left: 0,
              width: "100%",
            }}
            animate={{ x: ["-100%", "100%"], opacity: [0, 0.7, 0] }}
            transition={{
              duration: 0.6 + i * 0.1,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeIn",
            }}
          />
        ))}

        {/* The Porsche — enters small from horizon, scales up dramatically, holds hero pose */}
        <motion.div
          className="absolute left-1/2 bottom-[6%] -translate-x-1/2"
          initial={{ scale: 0.05, y: -90, opacity: 0, filter: "blur(6px)" }}
          animate={{
            scale: [0.05, 0.15, 0.45, 1, 1, 0.05],
            y: [-90, -70, -30, 0, 0, -90],
            opacity: [0, 0.4, 0.85, 1, 1, 0],
            filter: [
              "blur(6px)",
              "blur(3px)",
              "blur(1px)",
              "blur(0px)",
              "blur(0px)",
              "blur(6px)",
            ],
          }}
          transition={{
            duration: 5.6,
            times: [0, 0.18, 0.38, 0.55, 0.85, 1],
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {/* Subtle ground shadow */}
          <div className="absolute left-1/2 top-full h-3 w-[80%] -translate-x-1/2 rounded-full bg-black/70 blur-md" />
          <motion.img
            src={porscheImg}
            alt="Roter Porsche 718 Cayman GT4 RS"
            className="relative h-auto w-[280px] select-none drop-shadow-[0_20px_40px_rgba(220,38,38,0.45)]"
            animate={{ rotate: [0, -0.6, 0.4, -0.3, 0] }}
            transition={{ duration: 5.6, repeat: Infinity, ease: "easeInOut" }}
            draggable={false}
          />
          {/* Headlight bloom when close */}
          <motion.div
            className="absolute left-[10%] top-1/2 h-6 w-24 -translate-y-1/2 rounded-full bg-white/80 blur-2xl"
            animate={{ opacity: [0, 0, 0.2, 0.7, 0.7, 0] }}
            transition={{
              duration: 5.6,
              times: [0, 0.3, 0.45, 0.6, 0.85, 1],
              repeat: Infinity,
            }}
          />
        </motion.div>

        {/* Vignette */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.55)_100%)]" />
      </div>

      {/* Caption strip */}
      <div className="flex items-center justify-between gap-4 border-t-[0.5px] border-white/10 bg-black/30 px-5 py-3 backdrop-blur-md">
        <div>
          <p className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/40">
            Endgame
          </p>
          <p className="mt-0.5 font-serif-display text-base text-white">
            Porsche 718 Cayman <span className="italic text-red-400">GT4 RS</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/40">
            Status
          </p>
          <p className="mt-0.5 text-xs font-light tabular-nums text-white/80">
            in Anfahrt …
          </p>
        </div>
      </div>
    </div>
  );
}

function TelemetryCounter({
  label,
  from,
  to,
  duration,
  suffix = "",
}: {
  label: string;
  from: number;
  to: number;
  duration: number;
  suffix?: string;
}) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    let raf = 0;
    let start = 0;
    const loop = (t: number) => {
      if (!start) start = t;
      const elapsed = ((t - start) / 1000) % duration;
      const p = elapsed / duration;
      // ease-out for a sense of acceleration then settle
      const eased = 1 - Math.pow(1 - p, 2.4);
      setValue(Math.round(from + (to - from) * eased));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [from, to, duration]);
  return (
    <div className="text-right">
      <p className="text-[8px] font-medium uppercase tracking-[0.28em] text-white/40">
        {label}
      </p>
      <p className="font-serif-display text-base tabular-nums text-white">
        {value.toLocaleString("de-CH")}
        {suffix}
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
            ) : listing.first_seen_at &&
              Date.now() - new Date(listing.first_seen_at).getTime() < 2 * 60 * 1000 ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gray-100 text-xs text-steel">
                <RefreshCw className="h-5 w-5 animate-spin text-sapphire/60" />
                <span>Lade Inseratdaten…</span>
              </div>
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
