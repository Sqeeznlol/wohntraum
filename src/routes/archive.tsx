import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Listing } from "@/lib/db-types";
import { toast } from "sonner";
import { ArchiveRestore, MapPin, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCHF, formatSqm, PORTAL_LABELS } from "@/lib/format";

export const Route = createFileRoute("/archive")({
  head: () => ({
    meta: [{ title: "Archiv — Immo Radar" }],
  }),
  component: ArchivePage,
});

function ArchivePage() {
  const qc = useQueryClient();

  const { data: listings, isLoading } = useQuery({
    queryKey: ["listings", "archived"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .not("archived_at", "is", null)
        .order("archived_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as Listing[];
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("listings")
        .update({ archived_at: null, status: "new" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listings"] });
      toast.success("Inserat reaktiviert");
    },
    onError: () => toast.error("Reaktivierung fehlgeschlagen"),
  });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-[10px] font-medium tracking-[0.28em] uppercase text-steel">
          Verwaltung
        </p>
        <h1 className="mt-2 font-serif-display text-4xl text-teal md:text-5xl">
          Archiv
        </h1>
        <p className="mt-2 max-w-xl text-sm text-steel">
          Auto-archivierte Wohnungen und manuell entfernte Inserate. Bei Fehlerkennung
          kannst du jedes Inserat zurück in die Pipeline holen.
        </p>
      </header>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-[6px] border-[0.5px] border-hairline bg-white/40"
            />
          ))}
        </div>
      ) : !listings || listings.length === 0 ? (
        <div className="rounded-[6px] border-[0.5px] border-hairline bg-white/50 p-12 text-center">
          <p className="text-sm text-steel">Keine archivierten Inserate.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <article
              key={l.id}
              className="group flex flex-col overflow-hidden rounded-[6px] border-[0.5px] border-hairline bg-card shadow-card"
            >
              {l.image_url && (
                <div className="aspect-[16/10] overflow-hidden bg-muted">
                  <img
                    src={l.image_url}
                    alt={l.title}
                    loading="lazy"
                    className="h-full w-full object-cover opacity-80 transition-transform duration-[600ms] ease-out group-hover:scale-[1.04]"
                  />
                </div>
              )}
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-medium leading-snug">
                    {l.title}
                  </h3>
                  <span className="shrink-0 rounded-[3px] border-[0.5px] border-hairline px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-steel">
                    {PORTAL_LABELS[l.primary_portal] ?? l.primary_portal}
                  </span>
                </div>

                {(l.city || l.address) && (
                  <p className="flex items-center gap-1 text-xs text-steel">
                    <MapPin className="h-3 w-3" />
                    {[l.address, l.postal_code, l.city].filter(Boolean).join(", ")}
                  </p>
                )}

                <div className="flex items-baseline gap-3 text-xs text-steel">
                  {l.price_chf != null && (
                    <span className="font-serif-display text-base text-teal tabular-nums">
                      {formatCHF(Number(l.price_chf))}
                    </span>
                  )}
                  {l.area_sqm != null && <span>{formatSqm(Number(l.area_sqm))}</span>}
                </div>

                {l.extra_notes && (
                  <p className="rounded-[3px] border-[0.5px] border-hairline bg-secondary/40 p-2 text-[11px] italic text-steel">
                    {l.extra_notes}
                  </p>
                )}

                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => restore.mutate(l.id)}
                    disabled={restore.isPending}
                    className="h-8 rounded-[3px] bg-teal text-[11px] uppercase tracking-[0.10em] text-white hover:opacity-90"
                    style={{ backgroundColor: "var(--teal)" }}
                  >
                    <ArchiveRestore className="mr-1.5 h-3 w-3" />
                    Reaktivieren
                  </Button>
                  <Link
                    to="/listings/$id"
                    params={{ id: l.id }}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.10em] text-steel hover:text-teal"
                  >
                    Details
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
