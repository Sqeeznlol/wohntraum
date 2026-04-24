import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CalendarClock, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

type Viewing = {
  id: string;
  listing_id: string;
  viewing_at: string;
  attendees: string | null;
  notes: string | null;
  created_at: string;
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ListingViewings({ listingId }: { listingId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const [notes, setNotes] = useState("");

  const { data: viewings = [], isLoading } = useQuery({
    queryKey: ["listing-viewings", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_viewings")
        .select("*")
        .eq("listing_id", listingId)
        .order("viewing_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Viewing[];
    },
  });

  const reset = () => {
    setDate("");
    setAttendees("");
    setNotes("");
    setOpen(false);
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!date) throw new Error("Datum erforderlich");
      const { error } = await supabase.from("listing_viewings").insert({
        listing_id: listingId,
        viewing_at: new Date(date).toISOString(),
        attendees: attendees.trim() || null,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Besichtigung gespeichert");
      qc.invalidateQueries({ queryKey: ["listing-viewings", listingId] });
      reset();
    },
    onError: (e: any) => toast.error(e.message ?? "Speichern fehlgeschlagen"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("listing_viewings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Besichtigung gelöscht");
      qc.invalidateQueries({ queryKey: ["listing-viewings", listingId] });
    },
  });

  const update = useMutation({
    mutationFn: async (v: Viewing) => {
      const { error } = await supabase
        .from("listing_viewings")
        .update({
          viewing_at: v.viewing_at,
          attendees: v.attendees,
          notes: v.notes,
        })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aktualisiert");
      qc.invalidateQueries({ queryKey: ["listing-viewings", listingId] });
    },
  });

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Besichtigungen ({viewings.length})
          </h2>
          <Button size="sm" variant="outline" onClick={() => setOpen((o) => !o)}>
            <Plus className="mr-1 h-4 w-4" /> {open ? "Schliessen" : "Termin"}
          </Button>
        </div>

        {open && (
          <div className="space-y-2 rounded-md border bg-muted/30 p-3">
            <div>
              <label className="text-xs uppercase text-muted-foreground">
                Datum & Zeit
              </label>
              <Input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground">
                Teilnehmer
              </label>
              <Input
                value={attendees}
                onChange={(e) => setAttendees(e.target.value)}
                placeholder="z.B. Max, Anna, Makler"
                className="mt-1"
                maxLength={300}
              />
            </div>
            <div>
              <label className="text-xs uppercase text-muted-foreground">
                Notizen
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Treffpunkt, Fragen…"
                className="mt-1 min-h-[60px]"
                maxLength={1000}
              />
            </div>
            <Button size="sm" className="w-full" onClick={() => create.mutate()}>
              Speichern
            </Button>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Lade…</p>
        ) : viewings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Keine Termine geplant.</p>
        ) : (
          <div className="space-y-2">
            {viewings.map((v) => {
              const past = new Date(v.viewing_at) < new Date();
              return (
                <div
                  key={v.id}
                  className={`space-y-2 rounded-md border bg-card p-3 ${past ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <Input
                      type="datetime-local"
                      defaultValue={toLocalInputValue(v.viewing_at)}
                      onBlur={(e) => {
                        const iso = new Date(e.target.value).toISOString();
                        if (iso !== v.viewing_at) {
                          update.mutate({ ...v, viewing_at: iso });
                        }
                      }}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => {
                        if (confirm("Termin löschen?")) remove.mutate(v.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <Input
                      defaultValue={v.attendees ?? ""}
                      placeholder="Teilnehmer"
                      className="h-8 text-sm"
                      onBlur={(e) => {
                        const val = e.target.value.trim() || null;
                        if (val !== v.attendees) {
                          update.mutate({ ...v, attendees: val });
                        }
                      }}
                    />
                  </div>
                  {v.notes && (
                    <p className="whitespace-pre-wrap pl-6 text-xs text-muted-foreground">
                      {v.notes}
                    </p>
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
