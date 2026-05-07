import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Listing } from "@/lib/db-types";
import { PORTAL_LABELS, formatCHF, formatSqm } from "@/lib/format";

export const Route = createFileRoute("/swipe")({
  head: () => ({
    meta: [
      { title: "Swipe — Tim" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" },
    ],
  }),
  component: SwipePage,
});

const PREFETCH = 10;

function SwipePage() {
  const [queue, setQueue] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [exiting, setExiting] = useState<"left" | "right" | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const loadMore = async () => {
    const { data } = await supabase
      .from("listings")
      .select("*")
      .eq("status", "new")
      .is("bewertet_von", null)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(PREFETCH);
    setQueue(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadMore();
  }, []);

  const current = queue[0];

  const recordSwipe = async (l: Listing, dir: "left" | "right") => {
    const decision = dir === "right" ? "yes" : "no";
    const status = dir === "right" ? "interested" : "rejected";
    await Promise.all([
      supabase
        .from("listings")
        .update({ status, bewertet_von: "tim", updated_at: new Date().toISOString() })
        .eq("id", l.id),
      supabase.from("tim_preferences").insert({
        listing_id: l.id,
        decision,
        price_chf: l.price_chf,
        price_per_sqm: l.price_per_sqm,
        area_sqm: l.area_sqm,
        rooms: l.rooms,
        building_year: l.building_year,
        parcel_area_sqm: l.parcel_area_sqm,
        municipality: l.municipality,
        canton: l.canton,
        usage_zone: l.usage_zone,
        portal: l.primary_portal,
        floor_count: l.floors,
      }),
    ]);
  };

  const finishSwipe = (dir: "left" | "right") => {
    if (!current || exiting) return;
    setExiting(dir);
    const item = current;
    setTimeout(() => {
      setQueue((q) => q.slice(1));
      setExiting(null);
      setDrag(null);
      recordSwipe(item, dir);
      if (queue.length <= 3) loadMore();
    }, 280);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    setDrag({ x: 0, y: 0 });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!startRef.current) return;
    const t = e.touches[0];
    setDrag({ x: t.clientX - startRef.current.x, y: t.clientY - startRef.current.y });
  };
  const onTouchEnd = () => {
    if (!drag) return;
    if (drag.x > 80) finishSwipe("right");
    else if (drag.x < -80) finishSwipe("left");
    else setDrag(null);
    startRef.current = null;
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-[#1a1a1a] text-white">Lade…</div>;
  }

  if (!current) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#1a1a1a] px-6 text-center text-white">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-500 text-5xl">✓</div>
        <h1 className="text-2xl font-semibold">Alles erledigt, Tim!</h1>
        <p className="mt-2 text-sm text-white/70">Neue Inserate kommen automatisch.</p>
      </div>
    );
  }

  const dx = exiting === "right" ? 600 : exiting === "left" ? -600 : drag?.x ?? 0;
  const dy = drag?.y ?? 0;
  const rot = dx / 18;
  const yesOpacity = Math.min(1, Math.max(0, dx / 100));
  const noOpacity = Math.min(1, Math.max(0, -dx / 100));

  const next = queue[1];

  return (
    <div className="fixed inset-0 flex flex-col bg-[#1a1a1a] pb-[env(safe-area-inset-bottom)]">
      <div className="relative flex-1 overflow-hidden">
        {next && <Card listing={next} stacked />}
        <div
          className="absolute inset-0 touch-none"
          style={{
            transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
            transition: exiting || (!drag && dx === 0) ? "transform 280ms ease-out" : "none",
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <Card listing={current}>
            <div
              className="pointer-events-none absolute left-5 top-5 rounded-md border-4 border-green-500 px-3 py-1 text-xl font-extrabold tracking-wider text-green-500"
              style={{ opacity: yesOpacity, transform: "rotate(-12deg)" }}
            >
              INTERESSANT
            </div>
            <div
              className="pointer-events-none absolute right-5 top-5 rounded-md border-4 border-red-500 px-3 py-1 text-xl font-extrabold tracking-wider text-red-500"
              style={{ opacity: noOpacity, transform: "rotate(12deg)" }}
            >
              WEITER
            </div>
          </Card>
        </div>
      </div>
      <div className="flex items-center justify-center gap-12 py-5">
        <button
          onClick={() => finishSwipe("left")}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl text-red-500 shadow-lg active:scale-95"
          aria-label="Nicht interessant"
        >
          ✕
        </button>
        <button
          onClick={() => finishSwipe("right")}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-3xl text-green-500 shadow-lg active:scale-95"
          aria-label="Interessant"
        >
          ♥
        </button>
      </div>
    </div>
  );
}

function Card({
  listing,
  stacked,
  children,
}: {
  listing: Listing;
  stacked?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="absolute inset-x-3 top-3 bottom-3 overflow-hidden rounded-[20px] bg-white shadow-2xl"
      style={stacked ? { transform: "scale(0.96)", opacity: 0.6 } : undefined}
    >
      <div className="relative h-[55%] w-full bg-gray-200">
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.title ?? ""}
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            Kein Bild
          </div>
        )}
        <div className="absolute right-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          {PORTAL_LABELS[listing.primary_portal] ?? listing.primary_portal}
        </div>
        {children}
      </div>
      <div className="flex h-[45%] flex-col gap-2 px-5 py-4">
        <h2 className="line-clamp-2 text-lg font-semibold text-gray-900">
          {listing.title ?? "Inserat"}
        </h2>
        <p className="text-base text-gray-600">
          {[listing.address, listing.postal_code, listing.city].filter(Boolean).join(", ") || "—"}
        </p>
        <p className="mt-1 text-2xl font-bold text-gray-900">{formatCHF(listing.price_chf)}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-base text-gray-700">
          {listing.rooms != null && <span>{listing.rooms} Zimmer</span>}
          {listing.area_sqm != null && <span>{formatSqm(listing.area_sqm)}</span>}
        </div>
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
          {listing.building_year && <span>Baujahr {listing.building_year}</span>}
          {listing.usage_zone && <span>{listing.usage_zone}</span>}
        </div>
      </div>
    </div>
  );
}
