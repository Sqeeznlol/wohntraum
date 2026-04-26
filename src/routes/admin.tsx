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
  Wifi,
  MapPin,
  Building2,
  ChevronDown,
  ChevronRight,
  Activity,
  MousePointerClick,
  Eye,
  FileText,
  Pencil,
  ArrowUpRight,
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
  device_name: string | null;
  hostname: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  postal: string | null;
  isp: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
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
    const u = user.trim();
    const p = pw.trim();
    if (u.toLowerCase() === ADMIN_USER.toLowerCase() && p === ADMIN_PASSWORD) {
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
              <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-center text-xs text-muted-foreground">
                <div>Benutzer: <span className="font-mono font-semibold text-foreground">Admin</span></div>
                <div>Passwort: <span className="font-mono font-semibold text-foreground">Alys_1203</span></div>
              </div>
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
    refetchInterval: 5_000,
  });

  // Tick every second so the "live" cutoff stays fresh between refetches
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, []);

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
      `${v.ip_address} ${v.hostname ?? ""} ${v.os ?? ""} ${v.browser ?? ""} ${v.device_type ?? ""} ${v.device_name ?? ""} ${v.country ?? ""} ${v.region ?? ""} ${v.city ?? ""} ${v.isp ?? ""} ${v.custom_label ?? ""}`
        .toLowerCase()
        .includes(s),
    );
  }, [visitors, search]);

  // Group devices by IP — same router = same group
  const grouped = useMemo(() => {
    const map = new Map<string, Visitor[]>();
    for (const v of filtered) {
      const list = map.get(v.ip_address) ?? [];
      list.push(v);
      map.set(v.ip_address, list);
    }
    // Sort groups by most recent activity within the group
    return Array.from(map.entries())
      .map(([ip, devices]) => ({
        ip,
        devices: devices.sort(
          (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
        ),
        lastSeen: devices.reduce(
          (acc, d) => Math.max(acc, new Date(d.last_seen_at).getTime()),
          0,
        ),
        totalVisits: devices.reduce((acc, d) => acc + (d.visit_count ?? 0), 0),
      }))
      .sort((a, b) => b.lastSeen - a.lastSeen);
  }, [filtered]);

  // Devices active in the last 60s = "live on the site right now"
  const LIVE_WINDOW_MS = 60_000;
  const liveDevices = useMemo(() => {
    if (!visitors) return [];
    return visitors
      .filter((v) => !v.is_blocked && now - new Date(v.last_seen_at).getTime() < LIVE_WINDOW_MS)
      .sort(
        (a, b) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime(),
      );
  }, [visitors, now]);

  const stats = useMemo(() => {
    const total = visitors?.length ?? 0;
    const blocked = visitors?.filter((v) => v.is_blocked).length ?? 0;
    const today = visitors?.filter(
      (v) => new Date(v.last_seen_at).toDateString() === new Date().toDateString(),
    ).length ?? 0;
    const uniqueIps = new Set(visitors?.map((v) => v.ip_address)).size;
    return { total, blocked, today, uniqueIps, live: liveDevices.length };
  }, [visitors, liveDevices]);

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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Live jetzt" value={stats.live} live />
        <StatCard label="Geräte gesamt" value={stats.total} />
        <StatCard label="Eindeutige IPs" value={stats.uniqueIps} />
        <StatCard label="Heute aktiv" value={stats.today} accent />
        <StatCard label="Blockiert" value={stats.blocked} danger />
      </div>

      {/* Live now — devices active in last 60s */}
      {liveDevices.length > 0 && (
        <Card className="border-emerald-500/40 bg-emerald-500/5">
          <div className="flex items-center justify-between border-b border-emerald-500/20 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-400">
                Live auf der Seite
              </span>
              <Badge variant="outline" className="border-emerald-500/40 text-[10px] tabular-nums text-emerald-700 dark:text-emerald-400">
                {liveDevices.length}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">aktiv in den letzten 60s</span>
          </div>
          <div className="divide-y divide-emerald-500/10">
            {liveDevices.map((v) => {
              const Icon = deviceIcon(v.device_type);
              const displayName =
                v.custom_label ||
                v.device_name ||
                `${v.device_type ?? "Gerät"} · ${v.browser ?? ""}`.trim();
              const secondsAgo = Math.max(0, Math.floor((now - new Date(v.last_seen_at).getTime()) / 1000));
              return (
                <div key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                    <Icon className="h-4 w-4" />
                    <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold">{displayName}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{v.ip_address}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
                      <span>{v.os ?? "—"} · {v.browser ?? "—"}</span>
                      {(v.address || v.city || v.country) && (
                        <span>
                          {[
                            v.address,
                            [v.postal, v.city].filter(Boolean).join(" "),
                            v.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      )}
                      {v.path && <span className="font-mono truncate">{v.path}</span>}
                    </div>
                  </div>
                  <span className="shrink-0 text-[10px] tabular-nums text-emerald-700 dark:text-emerald-400">
                    {secondsAgo < 5 ? "jetzt" : `vor ${secondsAgo}s`}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      )}

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

      {/* Visitor list grouped by IP */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lade Besucher…</p>
      ) : grouped.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Noch keine Besucher erfasst.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map((group) => {
            // Take richest geo info from any device in the group
            const meta = group.devices.find((d) => d.city || d.country) ?? group.devices[0];
            const isMulti = group.devices.length > 1;
            const allBlocked = group.devices.every((d) => d.is_blocked);
            return (
              <Card
                key={group.ip}
                className={`overflow-hidden ${allBlocked ? "border-destructive/40" : ""}`}
              >
                {/* Group header — the router/IP */}
                <div className="border-b bg-muted/30 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Wifi className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm font-semibold tabular-nums">
                      {group.ip}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {group.devices.length} {isMulti ? "Geräte" : "Gerät"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] tabular-nums">
                      {group.totalVisits}× Besuche
                    </Badge>
                    {meta?.hostname && (
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {meta.hostname}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    {(meta?.city || meta?.region || meta?.country || meta?.address) && (
                      <span className="inline-flex items-start gap-1">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>
                          {meta?.address && (
                            <span className="font-medium text-foreground/80">{meta.address}</span>
                          )}
                          {meta?.address && (meta?.city || meta?.postal || meta?.country) && <br />}
                          {[
                            [meta?.postal, meta?.city].filter(Boolean).join(" "),
                            meta?.region,
                            meta?.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </span>
                      </span>
                    )}
                    {meta?.isp && (
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {meta.isp}
                      </span>
                    )}
                    {meta?.latitude && meta?.longitude && (
                      <a
                        href={`https://www.google.com/maps?q=${meta.latitude},${meta.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        Auf Karte zeigen
                      </a>
                    )}
                  </div>
                </div>

                {/* Devices in this group */}
                <div className="divide-y">
                  {group.devices.map((v) => {
                    const Icon = deviceIcon(v.device_type);
                    const displayName =
                      v.custom_label ||
                      v.device_name ||
                      `${v.device_type ?? "Gerät"} · ${v.browser ?? ""}`.trim();
                    return (
                      <div
                        key={v.id}
                        className={`p-4 transition-colors ${v.is_blocked ? "bg-destructive/5" : ""}`}
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <div
                              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                v.is_blocked ? "bg-destructive/10 text-destructive" : "bg-muted"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold">{displayName}</span>
                                {v.is_blocked && (
                                  <Badge variant="destructive" className="text-[10px]">
                                    <Ban className="mr-1 h-3 w-3" />
                                    Blockiert
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[10px] tabular-nums">
                                  {v.visit_count}×
                                </Badge>
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span>
                                  {v.os ?? "—"} · {v.browser ?? "—"}
                                </span>
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
                                placeholder={`Eigener Name (Vorschlag: ${v.device_name ?? v.device_type ?? "Gerät"})`}
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

                          <div className="flex shrink-0 flex-col items-end gap-2">
                            <div className="text-right text-[10px] text-muted-foreground">
                              <div>Erstmals: {fmtDate(v.first_seen_at)}</div>
                              <div>Zuletzt: {fmtDate(v.last_seen_at)}</div>
                            </div>
                            <div className="flex gap-1.5">
                              <Button
                                size="sm"
                                variant={v.is_blocked ? "outline" : "destructive"}
                                onClick={() =>
                                  block.mutate({ id: v.id, blocked: !v.is_blocked })
                                }
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
                      </div>
                    );
                  })}
                </div>
                {/* Activity timeline (Tagebuch) */}
                <ActivityTimeline ip={group.ip} />
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
  live,
}: {
  label: string;
  value: number;
  accent?: boolean;
  danger?: boolean;
  live?: boolean;
}) {
  return (
    <Card className={live ? "border-emerald-500/40 bg-emerald-500/5" : ""}>
      <CardContent className="p-4">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {live && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          )}
          {label}
        </div>
        <div
          className={`mt-1 font-serif-display text-3xl tabular-nums ${
            danger
              ? "text-destructive"
              : live
                ? "text-emerald-600 dark:text-emerald-400"
                : accent
                  ? "text-accent"
                  : ""
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
