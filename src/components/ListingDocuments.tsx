import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Upload, Trash2, Download, Loader2, ChevronDown, ChevronRight, Maximize2 } from "lucide-react";
import { PdfPreview } from "@/components/PdfPreview";
import { toast } from "sonner";

type ListingDocument = {
  id: string;
  listing_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

const BUCKET = "listing-documents";
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

function publicUrl(path: string) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ListingDocuments({ listingId }: { listingId: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [fullscreenDoc, setFullscreenDoc] = useState<ListingDocument | null>(null);
  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["listing-documents", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_documents")
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ListingDocument[];
    },
  });

  // Auto-expand first/newest document so user immediately sees a preview
  useEffect(() => {
    if (docs.length > 0) {
      setExpanded((prev) => {
        if (Object.keys(prev).length > 0) return prev;
        return { [docs[0].id]: true };
      });
    }
  }, [docs]);
  const uploadFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Nur PDF-Dateien sind erlaubt");
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error("Datei ist zu gross (max. 20 MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "pdf";
      const path = `${listingId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("listing_documents").insert({
        listing_id: listingId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
      });
      if (insErr) throw insErr;

      toast.success("PDF hochgeladen");
      qc.invalidateQueries({ queryKey: ["listing-documents", listingId] });
    } catch (e: any) {
      toast.error(e.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  const deleteDoc = useMutation({
    mutationFn: async (doc: ListingDocument) => {
      await supabase.storage.from(BUCKET).remove([doc.file_path]);
      const { error } = await supabase.from("listing_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dokument gelöscht");
      qc.invalidateQueries({ queryKey: ["listing-documents", listingId] });
    },
    onError: (e: any) => toast.error(e.message ?? "Löschen fehlgeschlagen"),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            PDF-Dokumente ({docs.length})
          </h2>
        </div>

        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-4 py-6 text-sm text-muted-foreground transition hover:bg-muted/50">
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Wird hochgeladen…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" /> PDF hochladen (max. 20 MB)
            </>
          )}
          <Input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadFile(f);
              e.target.value = "";
            }}
          />
        </label>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Lade…</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Dokumente.</p>
        ) : (
          <div className="space-y-2">
            {docs.map((doc) => {
              const isOpen = !!expanded[doc.id];
              return (
                <div key={doc.id} className="overflow-hidden rounded-md border bg-card">
                  <div className="flex items-center gap-3 p-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((p) => ({ ...p, [doc.id]: !isOpen }))
                      }
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      title={isOpen ? "Vorschau einklappen" : "Vorschau aufklappen"}
                    >
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <FileText className="h-5 w-5 shrink-0 text-primary" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={doc.file_name}>
                          {doc.file_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(doc.file_size)} ·{" "}
                          {new Date(doc.created_at).toLocaleDateString("de-CH")}
                        </p>
                      </div>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setFullscreenDoc(doc)}
                      title="Vollbild"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </Button>
                    <a
                      href={publicUrl(doc.file_path)}
                      target="_blank"
                      rel="noopener noreferrer"
                      download={doc.file_name}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
                      title="Herunterladen"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        if (confirm(`"${doc.file_name}" wirklich löschen?`)) {
                          deleteDoc.mutate(doc);
                        }
                      }}
                      title="Löschen"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  {isOpen && (
                    <div className="border-t bg-muted/30 p-2">
                      <iframe
                        src={`${publicUrl(doc.file_path)}#view=FitH`}
                        className="h-[480px] w-full rounded border bg-white"
                        title={doc.file_name}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={!!fullscreenDoc} onOpenChange={(o) => !o && setFullscreenDoc(null)}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle className="truncate">{fullscreenDoc?.file_name}</DialogTitle>
            </DialogHeader>
            {fullscreenDoc && (
              <iframe
                src={publicUrl(fullscreenDoc.file_path)}
                className="h-[75vh] w-full rounded-md border"
                title={fullscreenDoc.file_name}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
