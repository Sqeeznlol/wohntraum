import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AlertRule } from "@/lib/db-types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/alerts")({
  component: AlertsPage,
});

function AlertsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["alert_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alert_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AlertRule[];
    },
  });

  const [name, setName] = useState("");
  const [maxPpsm, setMaxPpsm] = useState("");
  const [city, setCity] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("alert_rules").insert({
        name: name || `Alert ${new Date().toLocaleDateString("de-CH")}`,
        max_price_per_sqm: maxPpsm ? Number(maxPpsm) : null,
        city_filter: city || null,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setMaxPpsm("");
      setCity("");
      qc.invalidateQueries({ queryKey: ["alert_rules"] });
      toast.success("Alert erstellt");
    },
    onError: () => toast.error("Alert konnte nicht erstellt werden"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("alert_rules")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["alert_rules"] }),
    onError: () => toast.error("Status konnte nicht geändert werden"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alert_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alert_rules"] });
      toast.success("Alert gelöscht");
    },
    onError: () => toast.error("Alert konnte nicht gelöscht werden"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Alerts</h1>
        <p className="text-sm text-muted-foreground">
          Markiert Inserate auf der Übersicht, deren CHF/m² unter deinem Schwellwert liegen.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Neuen Alert erstellen
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Günstig in Zürich"
              />
            </div>
            <div>
              <Label>Max CHF/m²</Label>
              <Input
                type="number"
                value={maxPpsm}
                onChange={(e) => setMaxPpsm(e.target.value)}
                placeholder="8000"
              />
            </div>
            <div>
              <Label>Ort (optional)</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Zürich"
              />
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={() => {
                  if (maxPpsm && (!isFinite(Number(maxPpsm)) || Number(maxPpsm) <= 0)) {
                    toast.error("CHF/m² muss eine positive Zahl sein");
                    return;
                  }
                  create.mutate();
                }}
                disabled={create.isPending}
              >
                Hinzufügen
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(data ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Noch keine Alerts.</p>
        )}
        {(data ?? []).map((rule) => (
          <Card key={rule.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div>
                <div className="font-medium">{rule.name}</div>
                <div className="text-sm text-muted-foreground">
                  ≤ {rule.max_price_per_sqm ?? "—"} CHF/m²
                  {rule.city_filter ? ` · ${rule.city_filter}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.is_active}
                    onCheckedChange={(v) =>
                      toggle.mutate({ id: rule.id, is_active: v })
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    {rule.is_active ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove.mutate(rule.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
