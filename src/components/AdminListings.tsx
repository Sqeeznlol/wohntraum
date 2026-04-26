import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@tanstack/react-router";
import {
  Plus,
  Save,
  Trash2,
  Search,
  ExternalLink,
  Pencil,
  Archive,
  ArchiveRestore,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Listing, ListingStatus, Portal } from "@/lib/db-types";
import { PORTAL_LABELS, STATUS_LABELS, formatCHF, formatPricePerSqm } from "@/lib/format";
import { detectPortalFromUrl } from "@/lib/portal-detect";

interface ListingDraft {
  title: string;
  primary_url: string;
  primary_portal: Portal;
  price_chf: string;
  area_sqm: string;
  rooms: string;
  city: string;
  postal_code: string;
  address: string;
  description: string;
  status: ListingStatus;
  image_url: string;
}

const EMPTY_DRAFT: ListingDraft = {
  title: "",
  primary_url: "",
  primary_portal: "other",
  price_chf: "",
  area_sqm: "",
  rooms: "",
  city: "",
  postal_code: "",
  address: "",
  description: "",
  status: "new",
  image_url: "",
};

function draftFromListing(l: Listing): ListingDraft {
  return {
    title: l.title ?? "",
    primary_url: l.primary_url ?? "",
    primary_portal: l.primary_portal ?? "other",
    price_chf: l.price_chf != null ? String(l.price_chf) : "",
    area_sqm: l.area_sqm != null ? String(l.area_sqm) : "",
    rooms: l.rooms != null ? String(l.rooms) : "",
    city: l.city ?? "",
    postal_code: l.postal_code ?? "",
    address: l.address ?? "",
    description: l.description ?? "",
    status: l.status ?? "new",
    image_url: l.image_url ?? "",
  };
}

function payloadFromDraft(d: ListingDraft) {
  const price = d.price_chf.trim() ? Number(d.price_chf) : null;
  const area = d.area_sqm.trim() ? Number(d.area_sqm) : null;
  return {
    title: d.title.trim(),
    primary_url: d.primary_url.trim() || null,
    primary_portal: d.primary_portal,
    price_chf: price,
    area_sqm: area,
    price_per_sqm: price && area && area > 0 ? Math.round(price / area) : null,
    rooms: d.rooms.trim() ? Number(d.rooms) : null,
    city: d.city.trim() || null,
    postal_code: d.postal_code.trim() || null,
    address: d.address.trim() || null,
    description: d.description.trim() || null,
    status: d.status,
    image_url: d.image_url.trim() || null,
  };
}

export function AdminListings() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: listings, isLoading } = useQuery({
    queryKey: ["admin-listings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .order("last_seen_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as Listing[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("listings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-listings"] });
      toast.success("Inserat gelöscht");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleArchive = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from("listings")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-listings"] }),
  });

  const filtered = useMemo(() => {
    if (!listings) return [];
    const s = search.toLowerCase().trim();
    if (!s) return listings;
    return listings.filter((l) =>
      `${l.title} ${l.address ?? ""} ${l.city ?? ""} ${l.postal_code ?? ""} ${l.primary_url ?? ""}`
        .toLowerCase()
        .includes(s),
    );
  }, [listings, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif-display text-2xl">Inserate verwalten</h2>
          <p className="text-xs text-muted-foreground">
            Manuell anlegen, bearbeiten oder entfernen.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setShowCreate((v) => !v);
            setEditingId(null);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {showCreate ? "Abbrechen" : "Neues Inserat"}
        </Button>
      </div>

      {showCreate && (
        <ListingForm
          mode="create"
          initial={EMPTY_DRAFT}
          onCancel={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            qc.invalidateQueries({ queryKey: ["admin-listings"] });
          }}
        />
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche: Titel, Adresse, Stadt, URL…"
          className="h-10 rounded-full pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lade Inserate…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Noch keine Inserate.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((l) => (
            <div key={l.id}>
              <Card
                className={`overflow-hidden ${l.archived_at ? "opacity-60" : ""} ${editingId === l.id ? "ring-2 ring-accent/40" : ""}`}
              >
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                  {l.image_url && (
                    <img
                      src={l.image_url}
                      alt=""
                      className="h-20 w-28 shrink-0 rounded-md object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">
                        {PORTAL_LABELS[l.primary_portal] ?? l.primary_portal}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {STATUS_LABELS[l.status] ?? l.status}
                      </Badge>
                      {l.archived_at && (
                        <Badge variant="outline" className="text-[10px]">
                          archiviert
                        </Badge>
                      )}
                    </div>
                    <h3 className="mt-1 truncate text-sm font-semibold">{l.title}</h3>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {(l.address || l.city) && (
                        <span>
                          {l.address}
                          {l.address && (l.postal_code || l.city) ? ", " : ""}
                          {l.postal_code} {l.city}
                        </span>
                      )}
                      <span>{formatCHF(l.price_chf ? Number(l.price_chf) : null)}</span>
                      {l.area_sqm != null && <span>{Number(l.area_sqm)} m²</span>}
                      {l.price_per_sqm != null && (
                        <span className="font-medium text-foreground/80">
                          {formatPricePerSqm(Number(l.price_per_sqm))}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Link
                      to="/listings/$id"
                      params={{ id: l.id }}
                      className="inline-flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs hover:bg-muted"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Öffnen
                    </Link>
                    <Button
                      size="sm"
                      variant={editingId === l.id ? "default" : "outline"}
                      className="h-8"
                      onClick={() => {
                        setShowCreate(false);
                        setEditingId(editingId === l.id ? null : l.id);
                      }}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Bearbeiten
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() =>
                        toggleArchive.mutate({ id: l.id, archived: !l.archived_at })
                      }
                    >
                      {l.archived_at ? (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-destructive"
                      onClick={() => {
                        if (confirm("Inserat wirklich löschen?")) remove.mutate(l.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
              {editingId === l.id && (
                <div className="mt-2">
                  <ListingForm
                    mode="edit"
                    listingId={l.id}
                    initial={draftFromListing(l)}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      setEditingId(null);
                      qc.invalidateQueries({ queryKey: ["admin-listings"] });
                      qc.invalidateQueries({ queryKey: ["listing", l.id] });
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Form
// ============================================================================

function ListingForm({
  mode,
  listingId,
  initial,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  listingId?: string;
  initial: ListingDraft;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ListingDraft>(initial);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  // Auto-Detect Portal aus URL
  const handleUrlChange = (url: string) => {
    const detected = detectPortalFromUrl(url);
    setDraft((d) => ({
      ...d,
      primary_url: url,
      // nur überschreiben wenn aktuell "other" ODER neuer Treffer eindeutig
      primary_portal: d.primary_portal === "other" || detected !== "other" ? detected : d.primary_portal,
    }));
  };

  const save = async () => {
    if (!draft.title.trim()) {
      toast.error("Titel erforderlich");
      return;
    }
    setSaving(true);
    try {
      const payload = payloadFromDraft(draft);
      if (mode === "create") {
        const { data, error } = await supabase
          .from("listings")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        // Auch Source erfassen wenn URL da
        if (data && payload.primary_url) {
          await supabase.from("listing_sources").insert({
            listing_id: data.id,
            url: payload.primary_url,
            portal: payload.primary_portal,
          });
        }
        toast.success("Inserat angelegt");
      } else {
        const { error } = await supabase
          .from("listings")
          .update(payload)
          .eq("id", listingId!);
        if (error) throw error;
        toast.success("Inserat aktualisiert");
      }
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  const detectedPreview = detectPortalFromUrl(draft.primary_url);

  return (
    <Card className="border-accent/30">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent" />
          <h3 className="font-serif-display text-lg">
            {mode === "create" ? "Neues Inserat" : "Inserat bearbeiten"}
          </h3>
        </div>

        {/* URL + Portal */}
        <div className="space-y-1.5">
          <Label className="text-xs">Inserat-URL</Label>
          <Input
            value={draft.primary_url}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://www.homegate.ch/mieten/..."
          />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Portal wird aus URL erkannt.</span>
            {draft.primary_url && (
              <Badge variant="outline" className="text-[10px]">
                erkannt: {PORTAL_LABELS[detectedPreview] ?? detectedPreview}
              </Badge>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Titel *">
            <Input
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="3.5-Zimmer-Wohnung in Zürich"
            />
          </Field>
          <Field label="Portal (manuell überschreiben)">
            <Select value={draft.primary_portal} onValueChange={(v) => set("primary_portal", v as Portal)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PORTAL_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Preis (CHF)">
            <Input
              type="number"
              value={draft.price_chf}
              onChange={(e) => set("price_chf", e.target.value)}
              placeholder="2400"
            />
          </Field>
          <Field label="Fläche (m²)">
            <Input
              type="number"
              value={draft.area_sqm}
              onChange={(e) => set("area_sqm", e.target.value)}
              placeholder="85"
            />
          </Field>

          <Field label="Zimmer">
            <Input
              type="number"
              step="0.5"
              value={draft.rooms}
              onChange={(e) => set("rooms", e.target.value)}
              placeholder="3.5"
            />
          </Field>
          <Field label="Status">
            <Select
              value={draft.status}
              onValueChange={(v) => set("status", v as ListingStatus)}
            >
              <SelectTrigger>
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
          </Field>

          <Field label="Adresse">
            <Input
              value={draft.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Bahnhofstrasse 1"
            />
          </Field>
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <Field label="PLZ">
              <Input
                value={draft.postal_code}
                onChange={(e) => set("postal_code", e.target.value)}
                placeholder="8001"
              />
            </Field>
            <Field label="Ort">
              <Input
                value={draft.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Zürich"
              />
            </Field>
          </div>

          <Field label="Bild-URL" wide>
            <Input
              value={draft.image_url}
              onChange={(e) => set("image_url", e.target.value)}
              placeholder="https://…"
            />
          </Field>

          <Field label="Beschreibung" wide>
            <Textarea
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              rows={4}
              placeholder="Notizen, Beschreibung, Highlights…"
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Speichern…
              </>
            ) : (
              <>
                <Save className="mr-1.5 h-4 w-4" />
                {mode === "create" ? "Anlegen" : "Speichern"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
