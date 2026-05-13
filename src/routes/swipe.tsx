import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Listing } from "@/lib/db-types";
import {
  PORTAL_LABELS,
  STATUS_LABELS,
  formatCHF,
  formatSqm,
  formatPricePerSqm,
} from "@/lib/format";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
  const draggingRef = useRef(false);

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

  const skipLater = () => {
    if (!current) return;
    // Move current to the back, do not record decision
    setQueue((q) => (q.length > 1 ? [...q.slice(1), q[0]] : q));
  };

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    startRef.current = { x: t.clientX, y: t.clientY };
    draggingRef.current = false;
    setDrag({ x: 0, y: 0 });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!startRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - startRef.current.x;
    const dy = t.clientY - startRef.current.y;
    // only treat as horizontal swipe if mostly horizontal — otherwise let it scroll
    if (!draggingRef.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        draggingRef.current = true;
      } else if (Math.abs(dy) > 8) {
        // allow vertical scroll inside card
        startRef.current = null;
        setDrag(null);
        return;
      }
    }
    if (draggingRef.current) {
      e.preventDefault();
      setDrag({ x: dx, y: dy * 0.3 });
    }
  };
  const onTouchEnd = () => {
    if (!drag || !draggingRef.current) {
      startRef.current = null;
      draggingRef.current = false;
      setDrag(null);
      return;
    }
    if (drag.x > 80) finishSwipe("right");
    else if (drag.x < -80) finishSwipe("left");
    else setDrag(null);
    startRef.current = null;
    draggingRef.current = false;
  };

  if (loading) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center bg-[#0f0f10] text-white"
        style={{ overflow: "hidden" }}
      >
        Lade…
      </div>
    );
  }

  if (!current) {
    return (
      <div
        className="fixed inset-0 flex flex-col items-center justify-center bg-[#0f0f10] px-6 text-center text-white"
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
  const rot = dx / 22;
  const showLabel = Math.abs(dx) > 30;
  const yesOpacity = dx > 30 ? Math.min(1, (dx - 30) / 80) : 0;
  const noOpacity = dx < -30 ? Math.min(1, (-dx - 30) / 80) : 0;
  const borderColor =
    dx > 30 ? "rgb(34,197,94)" : dx < -30 ? "rgb(239,68,68)" : "transparent";

  return (
    <div
      className="fixed inset-0 flex flex-col bg-[#0f0f10]"
      style={{ overflow: "hidden", height: "100dvh" }}
    >
      {/* Card area */}
      <div
        className="relative flex-1 w-full flex items-start justify-center"
        style={{ paddingTop: "max(env(safe-area-inset-top), 8px)", minHeight: 0 }}
      >
        {next1 && (
          <CardShell
            style={{
              transform: "translateY(8px) scale(0.96)",
              opacity: 0.5,
              zIndex: 1,
            }}
          >
            <CardContent listing={next1} />
          </CardShell>
        )}
        <CardShell
          style={{
            transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
            transition:
              exiting || (!drag && dx === 0) ? "transform 280ms ease-out" : "none",
            zIndex: 3,
            border: `3px solid ${borderColor}`,
            touchAction: "pan-y",
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <CardContent listing={current}>
            {showLabel && (
              <>
                <div
                  className="pointer-events-none absolute left-4 top-4 z-20 rounded-md border-4 border-green-500 px-4 py-1.5 text-3xl font-extrabold tracking-wider text-green-500"
                  style={{ opacity: yesOpacity, transform: "rotate(-15deg)" }}
                >
                  JA
                </div>
                <div
                  className="pointer-events-none absolute right-4 top-4 z-20 rounded-md border-4 border-red-500 px-4 py-1.5 text-3xl font-extrabold tracking-wider text-red-500"
                  style={{ opacity: noOpacity, transform: "rotate(15deg)" }}
                >
                  NEIN
                </div>
              </>
            )}
          </CardContent>
        </CardShell>
      </div>

      {/* Sticky action bar */}
      <div
        className="flex w-full items-center justify-center gap-4 bg-[#0f0f10]/95 backdrop-blur"
        style={{
          paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)",
          paddingTop: "10px",
        }}
      >
        <ActionButton
          onClick={() => finishSwipe("left")}
          color="text-red-500"
          label="Nein"
          icon="✕"
        />
        <ActionButton
          onClick={skipLater}
          color="text-yellow-500"
          label="Später"
          icon="⏱"
          size={56}
        />
        <Link
          to="/listings/$id"
          params={{ id: current.id }}
          className="flex h-[56px] w-[56px] items-center justify-center rounded-full bg-white text-xl text-blue-600 shadow-lg active:scale-95"
          style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.3)" }}
          aria-label="Details"
        >
          ⓘ
        </Link>
        <ActionButton
          onClick={() => finishSwipe("right")}
          color="text-green-500"
          label="Ja"
          icon="♥"
        />
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  color,
  label,
  icon,
  size = 64,
}: {
  onClick: () => void;
  color: string;
  label: string;
  icon: string;
  size?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center rounded-full bg-white shadow-lg active:scale-95 ${color}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
      }}
      aria-label={label}
    >
      {icon}
    </button>
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
      className="absolute overflow-hidden bg-white shadow-2xl flex flex-col"
      style={{
        width: "94vw",
        height: "100%",
        borderRadius: 22,
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

function statusBadgeColor(status: string) {
  switch (status) {
    case "new":
      return "bg-blue-100 text-blue-700";
    case "interested":
      return "bg-green-100 text-green-700";
    case "contacted":
      return "bg-purple-100 text-purple-700";
    case "visited":
      return "bg-amber-100 text-amber-700";
    case "rejected":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function objektTyp(l: Listing): string | null {
  return l.building_category || l.usage_zone || null;
}

function CardContent({
  listing: l,
  children,
}: {
  listing: Listing;
  children?: React.ReactNode;
}) {
  const ortLine = [l.postal_code, l.city].filter(Boolean).join(" ");
  const gemeinde = l.municipality;
  const kanton = l.canton;
  const objType = objektTyp(l);
  const statusLabel = STATUS_LABELS[l.status] ?? l.status;

  const mapsQuery = encodeURIComponent(
    [l.address, l.postal_code, l.city, "Schweiz"].filter(Boolean).join(", "),
  );
  const mapsLink =
    l.latitude && l.longitude
      ? `https://www.google.com/maps?q=${l.latitude},${l.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;
  const streetView =
    l.latitude && l.longitude
      ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${l.latitude},${l.longitude}`
      : null;
  const gisLink =
    l.canton?.toLowerCase() === "zh"
      ? `https://maps.zh.ch/?topic=AVTopic&searchtext=${mapsQuery}`
      : null;
  const moneyhouse = `https://www.moneyhouse.ch/de/search?q=${encodeURIComponent(
    l.city ?? l.municipality ?? "",
  )}`;

  // Compact info chips — only those with values (Key-Daten direkt sichtbar)
  const chips: Array<{ label: string; value: string }> = [];
  if (objType) chips.push({ label: "Typ", value: objType });
  if (l.parcel_area_sqm)
    chips.push({ label: "Grundstück", value: formatSqm(l.parcel_area_sqm) });
  if (l.area_sqm) chips.push({ label: "Wohnfläche", value: formatSqm(l.area_sqm) });
  if (l.building_area_sqm)
    chips.push({ label: "Gebäudefl.", value: formatSqm(l.building_area_sqm) });
  if (l.rooms) chips.push({ label: "Zimmer", value: `${l.rooms}` });
  if (l.building_year) chips.push({ label: "Baujahr", value: String(l.building_year) });
  if (l.floors) chips.push({ label: "Geschosse", value: String(l.floors) });
  if (l.dwellings) chips.push({ label: "WE", value: String(l.dwellings) });
  if (l.zone_code) chips.push({ label: "Zone", value: l.zone_code });
  if (l.usage_zone && l.usage_zone !== l.zone_code)
    chips.push({ label: "Nutzung", value: l.usage_zone });
  if (l.zone_legal_status)
    chips.push({ label: "Zonenstatus", value: l.zone_legal_status });
  if (l.heritage_protected) chips.push({ label: "Heimatschutz", value: "Ja" });
  if (l.isos_protected) chips.push({ label: "ISOS", value: "Ja" });

  return (
    <>
      {/* Image */}
      <div
        className="relative w-full bg-black flex-shrink-0"
        style={{
          height: "38%",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          overflow: "hidden",
        }}
      >
        {l.image_url ? (
          <img
            src={l.image_url}
            alt={l.title ?? ""}
            className="h-full w-full"
            style={{ objectFit: "cover", objectPosition: "center" }}
            draggable={false}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            Kein Bild
          </div>
        )}
        <div className="absolute bottom-2 right-2 rounded-full bg-black/65 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          {PORTAL_LABELS[l.primary_portal] ?? l.primary_portal}
        </div>
        <span
          className={`absolute top-2 left-2 rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusBadgeColor(
            l.status,
          )}`}
        >
          {statusLabel}
        </span>
        {children}
      </div>

      {/* Scrollable details */}
      <div
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {/* Header */}
        <div className="mb-3">
          <h2 className="text-base font-bold leading-tight text-gray-900">
            {l.address || l.title || "Ohne Adresse"}
          </h2>
          <p className="mt-0.5 text-sm text-gray-600">
            {ortLine || "—"}
            {gemeinde && gemeinde !== l.city ? ` · ${gemeinde}` : ""}
            {kanton ? ` · ${kanton}` : ""}
          </p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold text-gray-900">
              {formatCHF(l.price_chf)}
            </span>
            {l.price_per_sqm != null && (
              <span className="text-sm font-medium text-gray-600">
                {formatPricePerSqm(l.price_per_sqm)}
              </span>
            )}
          </div>
        </div>

        {/* Chips */}
        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span
                key={c.label}
                className="rounded-full bg-gray-100 px-2.5 py-1 text-[13px] text-gray-800"
              >
                <span className="text-gray-500">{c.label}:</span>{" "}
                <span className="font-semibold">{c.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Sections */}
        <Accordion type="multiple" defaultValue={["objekt"]} className="w-full">
          <SectionItem
            id="objekt"
            title="Objekt & Gebäude"
            rows={[
              ["Objekttyp", objType],
              ["Gebäudeart", l.building_category],
              ["Status Gebäude", l.building_status],
              ["Baujahr", l.building_year],
              ["Geschosse", l.floors],
              ["Wohneinheiten", l.dwellings],
              ["Wohnfläche", l.area_sqm ? formatSqm(l.area_sqm) : null],
              ["Gebäudefläche", l.building_area_sqm ? formatSqm(l.building_area_sqm) : null],
              ["Zimmer", l.rooms],
              ["Heizung", l.heating_type],
              ["Energie", l.energy_source],
            ]}
          />

          <SectionItem
            id="grundstueck"
            title="Grundstück"
            rows={[
              ["Parzellennummer", l.parcel_number],
              ["EGRID", l.egrid],
              ["EGID", l.egid],
              ["BFS-Nr.", l.bfs_number],
              ["Parzellenfläche", l.parcel_area_sqm ? formatSqm(l.parcel_area_sqm) : null],
              ["Zone", l.zone_code],
              ["Zonenstatus", l.zone_legal_status],
              ["Zonenfläche", l.zone_area_sqm ? formatSqm(l.zone_area_sqm) : null],
              ["Anteil Zone", l.zone_part_percent ? `${l.zone_part_percent}%` : null],
              ["Nutzungszone", l.usage_zone],
              ["Heimatschutz", l.heritage_protected ? "Ja" : null],
              ["ISOS", l.isos_protected ? "Ja" : null],
            ]}
          />

          <SectionItem
            id="bewertung"
            title="Bewertung"
            rows={[
              ["Letzter Entscheid", l.bewertet_von],
              ["Aktualisiert", l.updated_at ? new Date(l.updated_at).toLocaleDateString("de-CH") : null],
              ["Erstmals gesehen", l.first_seen_at ? new Date(l.first_seen_at).toLocaleDateString("de-CH") : null],
              ["Notizen", l.notes],
              ["Hinweise", l.extra_notes],
            ]}
          />

          <AccordionItem value="links">
            <AccordionTrigger className="text-sm font-semibold">
              Standort & Links
            </AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-2 text-sm">
                <a
                  href={mapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Google Maps öffnen
                </a>
                {streetView && (
                  <a
                    href={streetView}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Street View
                  </a>
                )}
                {gisLink && (
                  <a
                    href={gisLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    GIS / Kataster (ZH)
                  </a>
                )}
                <a
                  href={moneyhouse}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Moneyhouse
                </a>
                {l.primary_url && (
                  <a
                    href={l.primary_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Original-Inserat ({PORTAL_LABELS[l.primary_portal] ?? l.primary_portal})
                  </a>
                )}
              </div>
            </AccordionContent>
          </AccordionItem>

          {l.description && (
            <AccordionItem value="beschr">
              <AccordionTrigger className="text-sm font-semibold">
                Beschreibung
              </AccordionTrigger>
              <AccordionContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
                  {l.description}
                </p>
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        <div className="h-4" />
      </div>
    </>
  );
}

function SectionItem({
  id,
  title,
  rows,
}: {
  id: string;
  title: string;
  rows: Array<[string, string | number | null | undefined]>;
}) {
  const visible = rows.filter(([, v]) => v != null && v !== "");
  if (visible.length === 0) return null;
  return (
    <AccordionItem value={id}>
      <AccordionTrigger className="text-sm font-semibold">{title}</AccordionTrigger>
      <AccordionContent>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-[13px]">
          {visible.map(([k, v]) => (
            <FragmentRow key={k} k={k} v={String(v)} />
          ))}
        </dl>
      </AccordionContent>
    </AccordionItem>
  );
}

function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-gray-500">{k}</dt>
      <dd className="font-medium text-gray-900 break-words">{v}</dd>
    </>
  );
}
