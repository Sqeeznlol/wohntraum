import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StickyNote, Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

type ListingNote = {
  id: string;
  listing_id: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export function ListingNotes({ listingId }: { listingId: string }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["listing-notes", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_notes" as any)
        .select("*")
        .eq("listing_id", listingId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ListingNote[];
    },
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["listing-notes", listingId] });

  const create = useMutation({
    mutationFn: async (content: string) => {
      const { error } = await supabase
        .from("listing_notes" as any)
        .insert({ listing_id: listingId, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      toast.success("Notiz gespeichert");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Speichern fehlgeschlagen"),
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { error } = await supabase
        .from("listing_notes" as any)
        .update({ content })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      toast.success("Notiz aktualisiert");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Update fehlgeschlagen"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("listing_notes" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notiz gelöscht");
      invalidate();
    },
    onError: (e: any) => toast.error(e.message ?? "Löschen fehlgeschlagen"),
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">
          Notizen ({notes.length})
        </h2>

        <div className="space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Neue Notiz hinzufügen…"
            className="min-h-[80px]"
          />
          <Button
            size="sm"
            disabled={!draft.trim() || create.isPending}
            onClick={() => create.mutate(draft.trim())}
            className="w-full"
          >
            Notiz speichern
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Lade…</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch keine Notizen.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => {
              const isEditing = editingId === n.id;
              const edited =
                new Date(n.updated_at).getTime() - new Date(n.created_at).getTime() > 1500;
              return (
                <div
                  key={n.id}
                  className="rounded-md border bg-card p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <StickyNote className="h-3.5 w-3.5 text-primary" />
                      <span>{new Date(n.created_at).toLocaleString("de-CH")}</span>
                      {edited && (
                        <span className="italic">
                          (bearb. {new Date(n.updated_at).toLocaleString("de-CH")})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() =>
                              updateNote.mutate({ id: n.id, content: editText.trim() })
                            }
                            disabled={!editText.trim()}
                            title="Speichern"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => setEditingId(null)}
                            title="Abbrechen"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              setEditingId(n.id);
                              setEditText(n.content);
                            }}
                            title="Bearbeiten"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => {
                              if (confirm("Notiz wirklich löschen?")) remove.mutate(n.id);
                            }}
                            title="Löschen"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="min-h-[80px]"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap text-sm">{n.content}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
