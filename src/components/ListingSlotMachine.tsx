import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import type { Listing } from "@/lib/db-types";
import { formatCHF } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Sparkles, MapPin } from "lucide-react";

const REEL_HEIGHT = 132; // px per item
// Realistic slot timing: each reel spins longer than the last, like a classic fruit machine.
const REEL_BASE_DURATION = 2400; // ms — first reel
const REEL_STAGGER = 700; // ms — added per reel
const STRIP_LENGTH = 40; // many symbols to make the spin feel long & continuous

interface Props {
  listings: Listing[];
}

export function ListingSlotMachine({ listings }: Props) {
  // Pool: nur Inserate, die du selbst markiert hast (interessant oder kontaktiert) + mit Bild
  const pool = useMemo(
    () =>
      listings
        .filter(
          (l) =>
            l.image_url &&
            (l.status === "interested" || l.status === "contacted"),
        )
        .slice(0, 30),
    [listings],
  );

  if (pool.length < 3) {
    return null;
  }

  return <Machine pool={pool} />;
}

function Machine({ pool }: { pool: Listing[] }) {
  const [spinning, setSpinning] = useState(false);
  const [results, setResults] = useState<Listing[]>(() => [
    pool[0],
    pool[1 % pool.length],
    pool[2 % pool.length],
  ]);
  const [jackpot, setJackpot] = useState(false);

  const spin = () => {
    if (spinning) return;
    setSpinning(true);
    setJackpot(false);
    const newResults = [
      pool[Math.floor(Math.random() * pool.length)],
      pool[Math.floor(Math.random() * pool.length)],
      pool[Math.floor(Math.random() * pool.length)],
    ];
    // Last reel stops at base + 2 * stagger; reveal results when last reel lands.
    const totalDuration = REEL_BASE_DURATION + REEL_STAGGER * 2 + 150;
    setTimeout(() => {
      setResults(newResults);
      setSpinning(false);
      if (
        newResults[0].city &&
        newResults[0].city === newResults[1].city &&
        newResults[1].city === newResults[2].city
      ) {
        setJackpot(true);
      }
    }, totalDuration);
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-[oklch(0.18_0.04_280)] via-[oklch(0.14_0.03_290)] to-[oklch(0.10_0.02_300)] p-4 shadow-soft md:p-6">
      {/* glow */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute left-1/4 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-amber-400/30 blur-3xl" />
        <div className="absolute right-1/4 bottom-0 h-40 w-40 translate-x-1/2 rounded-full bg-fuchsia-500/30 blur-3xl" />
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-[0.28em] text-amber-300/80">
            Daily Spin · Deine Shortlist
          </span>
          <h2 className="font-serif-display text-2xl text-white md:text-3xl">
            Inserat-Roulette
          </h2>
          <p className="mt-1 text-[11px] text-amber-100/60">
            Nur Interessant & Kontaktiert mit Bild
          </p>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-[10px] uppercase tracking-[0.22em] text-amber-300/70">
            Pool
          </div>
          <div className="font-serif-display text-2xl text-amber-200">
            {pool.length}
          </div>
        </div>
      </div>

      {/* reels */}
      <div className="relative mt-4 grid grid-cols-3 gap-2 rounded-2xl border-2 border-amber-400/40 bg-black/40 p-2 shadow-[inset_0_4px_12px_rgba(0,0,0,0.6)]">
        {[0, 1, 2].map((i) => (
          <Reel
            key={i}
            pool={pool}
            target={results[i]}
            spinning={spinning}
            reelIndex={i}
          />
        ))}
      </div>

      {/* lever / button */}
      <div className="relative mt-4 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
        <p className="text-xs text-amber-100/70">
          {jackpot
            ? "🎰 JACKPOT — alle drei in derselben Stadt!"
            : spinning
              ? "Drehen…"
              : "Drück den Hebel — finde dein nächstes Zuhause."}
        </p>
        <Button
          onClick={spin}
          disabled={spinning}
          className="group relative h-12 overflow-hidden rounded-full border-2 border-amber-300 bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 px-8 text-sm font-semibold uppercase tracking-widest text-stone-900 shadow-[0_4px_0_rgba(120,53,15,1),0_8px_20px_rgba(245,158,11,0.5)] transition-transform hover:scale-105 active:translate-y-[2px] active:shadow-[0_2px_0_rgba(120,53,15,1)] disabled:opacity-80"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {spinning ? "Spinning" : "Spin"}
        </Button>
      </div>
    </section>
  );
}

function Reel({
  pool,
  target,
  spinning,
  reelIndex,
}: {
  pool: Listing[];
  target: Listing;
  spinning: boolean;
  reelIndex: number;
}) {
  // build a long strip: many random items + target at the end (so motion lands on target)
  const strip = useMemo(() => {
    if (!spinning) return [target];
    const items: Listing[] = [];
    for (let i = 0; i < STRIP_LENGTH; i++) {
      items.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    items.push(target);
    return items;
  }, [spinning, pool, target]);

  const duration = REEL_BASE_DURATION + reelIndex * REEL_STAGGER;

  const [reveal, setReveal] = useState(true);
  const stripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (spinning) {
      setReveal(false);
    } else {
      const t = setTimeout(() => setReveal(true), reelIndex * 200 + 100);
      return () => clearTimeout(t);
    }
  }, [spinning, reelIndex]);

  if (!spinning) {
    return (
      <Link
        to="/listings/$id"
        params={{ id: target.id }}
        className="group relative block h-[132px] overflow-hidden rounded-xl bg-stone-900 ring-1 ring-amber-300/30 transition-all hover:ring-2 hover:ring-amber-300"
      >
        <ReelCard listing={target} highlight={reveal} />
      </Link>
    );
  }

  // Distance to travel: stop with target row aligned in the visible window.
  const distance = (strip.length - 1) * REEL_HEIGHT;

  return (
    <div className="relative h-[132px] overflow-hidden rounded-xl bg-stone-900 ring-1 ring-amber-300/30">
      <motion.div
        ref={stripRef}
        initial={{ y: 0 }}
        animate={{
          // Tiny overshoot then settle — gives the classic mechanical "thunk" feel.
          y: [0, -(distance + 18), -distance],
        }}
        transition={{
          duration: duration / 1000,
          times: [0, 0.92, 1],
          ease: ["circIn", "circOut"],
        }}
      >
        {strip.map((l, idx) => (
          <div key={`${l.id}-${idx}`} style={{ height: REEL_HEIGHT }}>
            <ReelCard listing={l} highlight={false} />
          </div>
        ))}
      </motion.div>
      {/* center highlight line */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
      {/* gradient overlays for depth */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-black/70 to-transparent" />
    </div>
  );
}

function ReelCard({ listing, highlight }: { listing: Listing; highlight: boolean }) {
  return (
    <div className="relative h-full w-full">
      {listing.image_url ? (
        <img
          src={listing.image_url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-stone-800 text-stone-500">
          —
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-2">
        <div className="truncate text-[11px] font-semibold text-white">
          {listing.title}
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] text-amber-200/90">
          <span className="flex items-center gap-1 truncate">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            {listing.city ?? listing.postal_code ?? "—"}
          </span>
          <span className="font-mono shrink-0">
            {listing.price_chf ? formatCHF(listing.price_chf) : "—"}
          </span>
        </div>
      </div>
      {highlight && (
        <div className="pointer-events-none absolute inset-0 ring-2 ring-inset ring-amber-300 animate-pulse" />
      )}
    </div>
  );
}
