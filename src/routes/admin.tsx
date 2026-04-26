import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Shield,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Lock,
  LogOut,
  Ban,
  CheckCircle2,
  Search,
  Trash2,
  RefreshCw,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

const ADMIN_USER = "Admin";
const ADMIN_PASSWORD = "Alys_1203";
const SESSION_KEY = "ir_admin_session";

interface Visitor {
  id: string;
  ip_address: string;
  user_agent: string | null;
  os: string | null;
  browser: string | null;
  device_type: string | null;
  hostname: string | null;
  country: string | null;
  city: string | null;
  language: string | null;
  referrer: string | null;
  path: string | null;
  visit_count: number;
  is_blocked: boolean;
  custom_label: string | null;
  first_seen_at: string;
  last_seen_at: string;
}

function deviceIcon(d: string | null) {
  const s = (d ?? "").toLowerCase();
  if (s.includes("iphone") || s.includes("phone") || s.includes("mobile")) return Smartphone;
  if (s.includes("ipad") || s.includes("tablet")) return Tablet;
  return Monitor;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminPage() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [user, setUser] = useState("");
  const [pw, setPw] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY) === "1") {
      setAuthed(true);
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (user === ADMIN_USER && pw === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "1");
      setAuthed(true);
      toast.success("Eingeloggt");
    } else {
      toast.error("Falsche Zugangsdaten");
    }
  };

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center">
        <Card className="w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle>Admin-Zugang</CardTitle>
            <p className="text-sm text-muted-foreground">
              Geschützter Bereich – nur Administrator
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="user">Benutzer</Label>
                <Input
                  id="user"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  autoFocus
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Passwort</Label>
                <Input
                  id="pw"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full">
                Einloggen
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <AdminDashboard search={search} setSearch={setSearch} onLogout={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); }} />;
}

function AdminDashboard({
  search,
  setSearch,
  onLogout,
}: {
  search: string;
  setSearch: (v: string) => void;
  onLogout: () => void;
}) {
  const qc = useQueryClient();

  const { data: visitors, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["visitors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("visitor_log" as never)
        .select("*")
        .order("last_seen_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as unknown as Visitor[];
    },
    refetchInterval: 15_000,
  });

  const block = useMutation({
    mutationFn: async ({ id, blocked }: { id: string; blocked: boolean }) => {
      const { error } = await supabase
        .from("visitor_log" as never)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ is_blocked: blocked } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["visitors"] });
      toast.success(vars.blocked ? "IP blockiert" : "IP freigegeben");
    },
  });

  const setLabel = useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase
        .from("visitor_log" as never)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ custom_label: label } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["visitors"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("visitor_log" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["visitors"] });
      toast.success("Eintrag gelöscht");
    },
  });

  const filtered = useMemo(() => {
    if (!visitors) return [];
    const s = search.toLowerCase().trim();
    if (!s) return visitors;
    return visitors.filter((v) =>
      `${v.ip_address} ${v.hostname ?? ""} ${v.os ?? ""} ${v.browser ?? ""} ${v.device_type ?? ""} ${v.country ?? ""} ${v.city ?? ""} ${v.custom_label ?? ""}`
        .toLowerCase()
        .includes(s),
    );
  }, [visitors, search]);

  const stats = useMemo(() => {
    const total = visitors?.length ?? 0;
    const blocked = visitors?.filter((v) => v.is_blocked).length ?? 0;
    const today = visitors?.filter(
      (v) => new Date(v.last_seen_at).toDateString() === new Date().toDateString(),
    ).length ?? 0;
    return { total, blocked, today };
  }, [visitors]);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Admin-Konsole
            </span>
          </div>
          <h1 className="mt-1 font-serif-display text-3xl sm:text-4xl">Besucher-Übersicht</h1>
        </div>
        <Button variant="outline" size="sm" onClick={onLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Gesamt" value={stats.total} />
        <StatCard label="Heute aktiv" value={stats.today} accent />
        <StatCard label="Blockiert" value={stats.blocked} danger />
      </div>

      {/* Search + refresh */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="IP, Hostname, OS, Land, Label…"
            className="h-10 rounded-full pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Visitor list */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lade Besucher…</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Noch keine Besucher erfasst.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((v) => {
            const Icon = deviceIcon(v.device_type);
            return (
              <Card
                key={v.id}
                className={`transition-colors ${v.is_blocked ? "border-destructive/40 bg-destructive/5" : ""}`}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    {/* Left: identity */}
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          v.is_blocked ? "bg-destructive/10 text-destructive" : "bg-muted"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold tabular-nums">
                            {v.ip_address}
                          </span>
                          {v.is_blocked && (
                            <Badge variant="destructive" className="text-[10px]">
                              <Ban className="mr-1 h-3 w-3" />
                              Blockiert
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px] tabular-nums">
                            {v.visit_count}× Besuch
                          </Badge>
                        </div>
                        {v.hostname && (
                          <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                            {v.hostname}
                          </div>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Monitor className="h-3 w-3" />
                            {v.os ?? "—"} · {v.browser ?? "—"}
                          </span>
                          {v.device_type && (
                            <span className="inline-flex items-center gap-1">
                              <Smartphone className="h-3 w-3" />
                              {v.device_type}
                            </span>
                          )}
                          {(v.city || v.country) && (
                            <span className="inline-flex items-center gap-1">
                              <Globe className="h-3 w-3" />
                              {[v.city, v.country].filter(Boolean).join(", ")}
                            </span>
                          )}
                          {v.language && (
                            <span className="text-[10px] uppercase tracking-wider">
                              {v.language.split(",")[0]}
                            </span>
                          )}
                        </div>
                        {v.path && (
                          <div className="mt-1 truncate font-mono text-[10px] text-muted-foreground/70">
                            zuletzt auf: {v.path}
                          </div>
                        )}
                        <Input
                          defaultValue={v.custom_label ?? ""}
                          placeholder={'Label setzen (z. B. „mein iPhone")'}
                          className="mt-2 h-7 text-xs"
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (val !== (v.custom_label ?? "")) {
                              setLabel.mutate({ id: v.id, label: val });
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* Right: meta + actions */}
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <div className="text-right text-[10px] text-muted-foreground">
                        <div>Erstmals: {fmtDate(v.first_seen_at)}</div>
                        <div>Zuletzt: {fmtDate(v.last_seen_at)}</div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant={v.is_blocked ? "outline" : "destructive"}
                          onClick={() => block.mutate({ id: v.id, blocked: !v.is_blocked })}
                          className="h-8"
                        >
                          {v.is_blocked ? (
                            <>
                              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                              Freigeben
                            </>
                          ) : (
                            <>
                              <Ban className="mr-1.5 h-3.5 w-3.5" />
                              Blockieren
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            if (confirm("Eintrag löschen?")) remove.mutate(v.id);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  danger,
}: {
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </div>
        <div
          className={`mt-1 font-serif-display text-3xl tabular-nums ${
            danger ? "text-destructive" : accent ? "text-accent" : ""
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
