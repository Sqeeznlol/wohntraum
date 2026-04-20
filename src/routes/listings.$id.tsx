import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  formatCHF,
  formatPricePerSqm,
  formatSqm,
  PORTAL_LABELS,
  STATUS_LABELS,
} from "@/lib/format";
import type { Listing, ListingSource, ListingStatus } from "@/lib/db-types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Heart, ExternalLink, ArrowLeft, Archive, ArchiveRestore } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ListingGallery } from "@/components/ListingGallery";

export const Route = createFileRoute("/listings/$id")({
  component: ListingDetail,
});

function ListingDetail() {
  const { id } = Route.useParams();
  const router = useRouter();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const [listingRes, sourcesRes] = await Promise.all([
        supabase.from("listings").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("listing_sources")
          .select("*")
          .eq("listing_id", id)
          .order("seen_at", { ascending: false }),
      ]);
      if (listingRes.error) throw listingRes.error;
      if (sourcesRes.error) throw sourcesRes.error;
      return {
        listing: listingRes.data as Listing | null,
        sources: (sourcesRes.data ?? []) as ListingSource[],
      };
    },
  });

  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (data?.listing) setNotes(data.listing.notes ?? "");
  }, [data?.listing]);

  const update = useMutation({
    mutationFn: async (patch: Partial<Listing>) => {
      const { error } = await supabase.from("listings").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing", id] });
      qc.invalidateQueries({ queryKey: ["listings"] });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Lade…</p>;
  if (!data?.listing)
    return (
      <div className="text-center">
        <p>Inserat nicht gefunden.</p>
        <Link to="/" className="text-primary underline">
          Zurück
        </Link>
      </div>
    );

  const l = data.listing;
  const ppsm = l.price_per_sqm != null ? Number(l.price_per_sqm) : null;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Zurück
      </Button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <ListingGallery listingId={id} fallbackUrl={l.image_url} title={l.title} primaryUrl={l.primary_url} />
          <Card>
            <CardContent className="space-y-3 p-6">
              <h1 className="text-xl font-semibold">{l.title}</h1>
              <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                {l.address && <span>{l.address}</span>}
                {l.city && (
                  <span>
                    · {l.postal_code} {l.city}
                  </span>
                )}
              </div>
              {l.description && (
                <p className="whitespace-pre-wrap text-sm">{l.description}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <h2 className="text-sm font-semibold uppercase text-muted-foreground">
                Quellen ({data.sources.length})
              </h2>
              {data.sources.length === 0 && (
                <p className="text-sm text-muted-foreground">Keine Quellen.</p>
              )}
              {data.sources.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-4 border-t pt-3"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{PORTAL_LABELS[s.portal]}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.seen_at).toLocaleString("de-CH")}
                    </span>
                  </div>
                  {s.url && (
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      Öffnen <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-6">
              <div className="text-center">
                <div className="text-xs uppercase text-muted-foreground">
                  CHF / m²
                </div>
                <div className="text-3xl font-bold text-primary">
                  {formatPricePerSqm(ppsm)}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Stat label="Preis" value={formatCHF(l.price_chf ? Number(l.price_chf) : null)} />
                <Stat label="Fläche" value={formatSqm(l.area_sqm ? Number(l.area_sqm) : null)} />
                <Stat label="Zimmer" value={l.rooms ? String(l.rooms) : "—"} />
                <Stat label="Portal" value={PORTAL_LABELS[l.primary_portal] ?? l.primary_portal} />
              </div>
              <Button
                variant={l.is_favorite ? "default" : "outline"}
                className="w-full"
                onClick={() => update.mutate({ is_favorite: !l.is_favorite })}
              >
                <Heart className="mr-1 h-4 w-4" />
                {l.is_favorite ? "Favorit entfernen" : "Als Favorit markieren"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  const archiving = !l.archived_at;
                  update.mutate({ archived_at: archiving ? new Date().toISOString() : null });
                  toast.success(archiving ? "Inserat archiviert" : "Inserat wiederhergestellt");
                }}
              >
                {l.archived_at ? (
                  <><ArchiveRestore className="mr-1 h-4 w-4" /> Wiederherstellen</>
                ) : (
                  <><Archive className="mr-1 h-4 w-4" /> Archivieren</>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3 p-6">
              <div>
                <label className="text-xs uppercase text-muted-foreground">
                  Status
                </label>
                <Select
                  value={l.status}
                  onValueChange={(v) =>
                    update.mutate({ status: v as ListingStatus })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs uppercase text-muted-foreground">
                  Notizen
                </label>
                <Textarea
                  className="mt-1 min-h-[100px]"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Eigene Notizen…"
                />
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  onClick={() => {
                    update.mutate({ notes });
                    toast.success("Notiz gespeichert");
                  }}
                >
                  Speichern
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
