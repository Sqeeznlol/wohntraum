import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Listing } from "@/lib/db-types";
import { PORTAL_LABELS, formatCHF, formatSqm } from "@/lib/format";

export const Route = createFileRoute("/swipe")({
  head: () => ({
    meta: [
      { title: "Swipe — Tim" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
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
  const next1 = queue[1];
  const next2 = queue[2];

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
    setDrag({
      x: t.clientX - startRef.current.x,
      y: t.clientY - startRef.current.y,
    });
  };
  const onTouchEnd = () => {
    if (!drag) {
      startRef.current = null;
      return;
    }
    if (drag.x > 80) finishSwipe("right");
    else if (drag.x < -80) finishSwipe("left");
    else setDrag(null);
    startRef.current = null;
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-[#1a1a1a] text-white"
        style={{ overflow: "hidden" }}
      >
        Lade…
      </div>
    );
  }

  if (!current) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center bg-[#1a1a1a] px-6 text-center text-white"
        style={{ overflow: "hidden" }}
      >
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-500 text-5xl">
          ✓
        </div>
        <h1 className="text-2xl font-semibold">Alles erledigt, Tim!</h1>
        <p className="mt-2 text-sm text-white/70">Neue Inserate kommen automatisch.</p>
      </div>
    );
  }

  const dx = exiting === "right" ? 600 : exiting === "left" ? -600 : drag?.x ?? 0;
  const dy = drag?.y ?? 0;
  const rot = dx / 18;
  const showLabel = Math.abs(dx) > 30;
  const yesOpacity = dx > 30 ? Math.min(1, (dx - 30) / 80) : 0;
  const noOpacity = dx < -30 ? Math.min(1, (-dx - 30) / 80) : 0;
  const borderColor =
    dx > 30 ? "rgb(34,197,94)" : dx < -30 ? "rgb(239,68,68)" : "transparent";

  return (
    <div
      className="fixed inset-0 flex flex-col items-center bg-[#1a1a1a]"
      style={{ overflow: "hidden", height: "100dvh" }}
    >
      {/* Card stack area */}
      <div
        className="relative w-full flex items-start justify-center"
        style={{ height: "calc(100dvh - 110px)", paddingTop: "8px" }}
      >
        {/* Stack card 3 (deepest) */}
        {next2 && (
          <CardShell
            style={{
              transform: "translateY(16px) scale(0.90)",
              opacity: 0.4,
              zIndex: 1,
            }}
          >
            <CardContent listing={next2} />
          </CardShell>
        )}
        {/* Stack card 2 */}
        {next1 && (
          <CardShell
            style={{
              transform: "translateY(8px) scale(0.95)",
              opacity: 0.7,
              zIndex: 2,
            }}
          >
            <CardContent listing={next1} />
          </CardShell>
        )}
        {/* Active card */}
        <CardShell
          style={{
            transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
            transition:
              exiting || (!drag && dx === 0) ? "transform 280ms ease-out" : "none",
            zIndex: 3,
            border: `4px solid ${borderColor}`,
            touchAction: "none",
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <CardContent listing={current}>
            {showLabel && (
              <>
                <div
                  className="pointer-events-none absolute left-4 top-4 rounded-md border-4 border-green-500 px-4 py-1.5 text-3xl font-extrabold tracking-wider text-green-500"
                  style={{ opacity: yesOpacity, transform: "rotate(-15deg)" }}
                >
                  JA
                </div>
                <div
                  className="pointer-events-none absolute right-4 top-4 rounded-md border-4 border-red-500 px-4 py-1.5 text-3xl font-extrabold tracking-wider text-red-500"
                  style={{ opacity: noOpacity, transform: "rotate(15deg)" }}
                >
                  NEIN
                </div>
              </>
            )}
          </CardContent>
        </CardShell>
      </div>

      {/* Buttons */}
      <div
        className="flex w-full items-center justify-center"
        style={{
          gap: "48px",
          paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)",
          paddingTop: "12px",
        }}
      >
        <button
          onClick={() => finishSwipe("left")}
          className="flex items-center justify-center rounded-full bg-white text-3xl text-red-500 shadow-lg active:scale-95"
          style={{ width: 68, height: 68, boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}
          aria-label="Nicht interessant"
        >
          ✕
        </button>
        <button
          onClick={() => finishSwipe("right")}
          className="flex items-center justify-center rounded-full bg-white text-3xl text-green-500 shadow-lg active:scale-95"
          style={{ width: 68, height: 68, boxShadow: "0 4px 14px rgba(0,0,0,0.25)" }}
          aria-label="Interessant"
        >
          ♥
        </button>
      </div>
    </div>
  );
}

function CardShell({
  children,
  style,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onTouchStart?: (e: React.TouchEvent) => void;
  onTouchMove?: (e: React.TouchEvent) => void;
  onTouchEnd?: (e: React.TouchEvent) => void;
}) {
  return (
    <div
      className="absolute overflow-hidden bg-white shadow-2xl"
      style={{
        width: "92vw",
        height: "100%",
        borderRadius: 20,
        ...style,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {children}
    </div>
  );
}

function CardContent({
  listing,
  children,
}: {
  listing: Listing;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex h-full w-full flex-col">
      <div
        className="relative w-full bg-gray-200"
        style={{
          height: "58%",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          overflow: "hidden",
        }}
      >
        {listing.image_url ? (
          <img
            src={listing.image_url}
            alt={listing.title ?? ""}
            className="h-full w-full"
            style={{ objectFit: "cover", objectPosition: "center" }}
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            Kein Bild
          </div>
        )}
        <div className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white backdrop-blur">
          {PORTAL_LABELS[listing.primary_portal] ?? listing.primary_portal}
        </div>
        {children}
      </div>
      <div className="flex flex-1 flex-col gap-2 px-5 py-4">
        <h2 className="line-clamp-2 text-lg font-semibold leading-tight text-gray-900">
          {listing.title ?? "Inserat"}
        </h2>
        <p className="line-clamp-1 text-sm text-gray-500">
          {[listing.address, listing.postal_code, listing.city]
            .filter(Boolean)
            .join(", ") || "—"}
        </p>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-2xl font-bold text-gray-900">
            {formatCHF(listing.price_chf)}
          </span>
          <span className="text-base text-gray-600">
            {[
              listing.rooms != null ? `${listing.rooms} Zi.` : null,
              listing.area_sqm != null ? formatSqm(listing.area_sqm) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        {(listing.building_year || listing.usage_zone) && (
          <div className="flex flex-wrap gap-2">
            {listing.building_year && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                Baujahr {listing.building_year}
              </span>
            )}
            {listing.usage_zone && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                {listing.usage_zone}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
