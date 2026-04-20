import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Plus, Trash2, X, Download, Loader2 } from "lucide-react";
import type { ListingImage } from "@/lib/db-types";
import { toast } from "sonner";

export function ListingGallery({
  listingId,
  fallbackUrl,
  title,
  primaryUrl,
}: {
  listingId: string;
  fallbackUrl: string | null;
  title: string;
  primaryUrl?: string | null;
}) {
  const qc = useQueryClient();
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const { data: images = [] } = useQuery({
    queryKey: ["listing_images", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_images" as never)
        .select("*")
        .eq("listing_id", listingId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ListingImage[];
    },
  });

  const add = useMutation({
    mutationFn: async (url: string) => {
      const { error } = await supabase
        .from("listing_images" as never)
        .insert({
          listing_id: listingId,
          url,
          sort_order: images.length,
        } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing_images", listingId] });
      setNewUrl("");
      setAdding(false);
      toast.success("Bild hinzugefügt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("listing_images" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["listing_images", listingId] });
      toast.success("Bild entfernt");
    },
  });

  const importFromPortal = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        "import-listing-images",
        { body: { listing_id: listingId } },
      );
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        imported: number;
        skipped: number;
        total_found: number;
        method: "direct" | "firecrawl";
        credits_used: number;
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["listing_images", listingId] });
      const tag = data.method === "direct" ? "🆓 gratis" : `💰 ${data.credits_used} Credit`;
      if (data.imported > 0) {
        toast.success(`${data.imported} Bilder importiert (${tag})`);
      } else {
        toast.info(`Keine neuen Bilder gefunden (${tag})`);
      }
    },
    onError: (e: Error) => toast.error(`Import fehlgeschlagen: ${e.message}`),
  });

  const display = images.length > 0 ? images : fallbackUrl
    ? [{ id: "fallback", url: fallbackUrl, listing_id: listingId, sort_order: 0, created_at: "" }]
    : [];

  return (
    <div className="space-y-3">
      {display.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setLightbox(0)}
            className="block w-full overflow-hidden rounded-lg"
          >
            <img
              src={display[0].url}
              alt={title}
              className="h-[400px] w-full object-cover transition-transform hover:scale-105"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </button>
          {display.length > 1 && (
            <div className="grid grid-cols-4 gap-2">
              {display.slice(1).map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setLightbox(i + 1)}
                  className="relative aspect-square overflow-hidden rounded-md"
                >
                  <img
                    src={img.url}
                    alt={`${title} ${i + 2}`}
                    className="h-full w-full object-cover transition-transform hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {primaryUrl && (
          <Button
            variant="default"
            size="sm"
            onClick={() => importFromPortal.mutate()}
            disabled={importFromPortal.isPending}
          >
            {importFromPortal.isPending ? (
              <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Lade Bilder…</>
            ) : (
              <><Download className="mr-1 h-4 w-4" /> Alle Bilder vom Portal importieren</>
            )}
          </Button>
        )}
        {!adding ? (
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="mr-1 h-4 w-4" /> Bild manuell hinzufügen
          </Button>
        ) : (
          <div className="flex w-full gap-2">
            <Input
              placeholder="https://… Bild-URL"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              autoFocus
            />
            <Button
              size="sm"
              onClick={() => newUrl && add.mutate(newUrl)}
              disabled={!newUrl || add.isPending}
            >
              Speichern
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}
        {images.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {images.length} Bild{images.length !== 1 && "er"}
          </span>
        )}
      </div>

      <Dialog open={lightbox !== null} onOpenChange={() => setLightbox(null)}>
        <DialogContent className="max-w-5xl p-0">
          {lightbox !== null && display[lightbox] && (
            <div className="relative">
              <img
                src={display[lightbox].url}
                alt={title}
                className="max-h-[85vh] w-full object-contain"
              />
              {display[lightbox].id !== "fallback" && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute right-12 top-2"
                  onClick={() => {
                    remove.mutate(display[lightbox].id);
                    setLightbox(null);
                  }}
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Löschen
                </Button>
              )}
              {display.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">
                  {lightbox + 1} / {display.length}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
