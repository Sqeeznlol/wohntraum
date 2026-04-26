import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Mail,
  MessageCircle,
  FileText,
  CalendarClock,
  CalendarCheck,
  Loader2,
  Plus,
  Trash2,
  Sparkles,
  Clock,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ContactStepKey =
  | "message_sent"
  | "reply_received"
  | "precheck_sent"
  | "viewing_requested"
  | "viewing_confirmed";

const STEPS: ReadonlyArray<{
  key: ContactStepKey;
  label: string;
  short: string;
  icon: typeof Mail;
}> = [
  { key: "message_sent", label: "Anfrage gesendet", short: "Anfrage", icon: Mail },
  { key: "reply_received", label: "Antwort erhalten", short: "Antwort", icon: MessageCircle },
  { key: "precheck_sent", label: "Vorprüfung gesendet", short: "Vorprüfung", icon: FileText },
  { key: "viewing_requested", label: "Termin angefragt", short: "Termin", icon: CalendarClock },
  { key: "viewing_confirmed", label: "Termin bestätigt", short: "Bestätigt", icon: CalendarCheck },
];

const CUSTOM_KEY = "__custom__";

export type CustomStatus = "offen" | "in_bearbeitung" | "erledigt";

type StepLog = Partial<Record<ContactStepKey, string>> & {
  [CUSTOM_KEY]?: CustomMilestone[];
};

type CustomMilestone = {
  id: string;
  label: string;
  ts: string; // ISO – created/updated
  // legacy field, kept for backwards compatibility (true === "erledigt")
  done?: boolean;
  status?: CustomStatus;
};

type ProgressRow = {
  id: string;
  listing_id: string;
  current_step: ContactStepKey;
  steps: StepLog;
  note: string | null;
  updated_at: string;
};

function relTime(iso: string | undefined): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "gerade eben";
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  return `vor ${d} Tg.`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getCustom(steps: StepLog | undefined): CustomMilestone[] {
  return (steps?.[CUSTOM_KEY] as CustomMilestone[] | undefined) ?? [];
}

function statusOf(m: CustomMilestone): CustomStatus {
  if (m.status) return m.status;
  return m.done ? "erledigt" : "offen";
}

function nextStatus(s: CustomStatus): CustomStatus {
  if (s === "offen") return "in_bearbeitung";
  if (s === "in_bearbeitung") return "erledigt";
  return "offen";
}

export function ContactProgress({ listingId, compact = false }: { listingId: string; compact?: boolean }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contact-progress", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_contact_progress" as any)
        .select("*")
        .eq("listing_id", listingId)
        .maybeSingle();
      if (error && error.code !== "PGRST116") throw error;
      return (data ?? null) as ProgressRow | null;
    },
  });

  const progress = data;
  const currentIdx = useMemo(() => {
    if (!progress) return 0;
    const i = STEPS.findIndex((s) => s.key === progress.current_step);
    return i >= 0 ? i : 0;
  }, [progress]);

  const customMilestones = useMemo(
    () => getCustom(progress?.steps),
    [progress?.steps],
  );

  const upsertSteps = async (
    nextSteps: StepLog,
    nextCurrent?: ContactStepKey,
  ) => {
    if (progress) {
      const patch: Record<string, unknown> = { steps: nextSteps };
      if (nextCurrent) patch.current_step = nextCurrent;
      const { error } = await supabase
        .from("listing_contact_progress" as any)
        .update(patch)
        .eq("listing_id", listingId);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("listing_contact_progress" as any)
        .insert({
          listing_id: listingId,
          current_step: nextCurrent ?? "message_sent",
          steps: nextSteps,
        });
      if (error) throw error;
    }
  };

  const setStep = useMutation({
    mutationFn: async (stepKey: ContactStepKey) => {
      const now = new Date().toISOString();
      const existingSteps = (progress?.steps ?? {}) as StepLog;
      const nextSteps: StepLog = { ...existingSteps };
      const targetIdx = STEPS.findIndex((s) => s.key === stepKey);
      for (let i = 0; i <= targetIdx; i++) {
        const k = STEPS[i].key;
        if (!nextSteps[k]) nextSteps[k] = now;
      }
      for (let i = targetIdx + 1; i < STEPS.length; i++) {
        delete nextSteps[STEPS[i].key];
      }
      await upsertSteps(nextSteps, stepKey);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-progress", listingId] });
    },
  });

  const addCustom = useMutation({
    mutationFn: async (label: string) => {
      const trimmed = label.trim();
      if (!trimmed) return;
      const existingSteps = (progress?.steps ?? {}) as StepLog;
      const list = getCustom(existingSteps);
      const next: CustomMilestone = {
        id: crypto.randomUUID(),
        label: trimmed,
        ts: new Date().toISOString(),
        done: false,
      };
      const nextSteps: StepLog = {
        ...existingSteps,
        [CUSTOM_KEY]: [...list, next],
      };
      await upsertSteps(nextSteps);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-progress", listingId] }),
  });

  const updateCustom = useMutation({
    mutationFn: async (patch: { id: string; changes: Partial<CustomMilestone> }) => {
      const existingSteps = (progress?.steps ?? {}) as StepLog;
      const list = getCustom(existingSteps);
      const nextList = list.map((m) =>
        m.id === patch.id ? { ...m, ...patch.changes } : m,
      );
      const nextSteps: StepLog = { ...existingSteps, [CUSTOM_KEY]: nextList };
      await upsertSteps(nextSteps);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-progress", listingId] }),
  });

  const deleteCustom = useMutation({
    mutationFn: async (id: string) => {
      const existingSteps = (progress?.steps ?? {}) as StepLog;
      const list = getCustom(existingSteps).filter((m) => m.id !== id);
      const nextSteps: StepLog = { ...existingSteps, [CUSTOM_KEY]: list };
      await upsertSteps(nextSteps);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-progress", listingId] }),
  });

  const [noteDraft, setNoteDraft] = useState<string>("");
  useEffect(() => {
    setNoteDraft(progress?.note ?? "");
  }, [progress?.note]);

  const saveNote = useMutation({
    mutationFn: async (text: string) => {
      if (progress) {
        const { error } = await supabase
          .from("listing_contact_progress" as any)
          .update({ note: text })
          .eq("listing_id", listingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("listing_contact_progress" as any)
          .insert({ listing_id: listingId, current_step: "message_sent", note: text });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-progress", listingId] }),
  });

  const completedBuiltin = progress
    ? STEPS.filter((s) => (progress.steps as StepLog)[s.key]).length
    : 0;
  const completedCustom = customMilestones.filter((m) => m.done).length;
  const totalSteps = STEPS.length + customMilestones.length;
  const completedTotal = completedBuiltin + completedCustom;
  const pct = totalSteps > 0 ? (completedTotal / totalSteps) * 100 : 0;

  if (compact) {
    return (
      <div className="border-t border-border/70 bg-gradient-to-b from-card to-muted/20 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Kontakt-Fortschritt
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {completedTotal}/{totalSteps}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {STEPS.map((s, i) => {
            const done = progress ? !!(progress.steps as StepLog)[s.key] : false;
            const active = progress ? s.key === progress.current_step : false;
            return (
              <div key={s.key} className="flex flex-1 items-center gap-1.5">
                <div
                  className={cn(
                    "relative flex h-2 flex-1 overflow-hidden rounded-full",
                    done ? "bg-foreground" : "bg-muted",
                  )}
                  title={s.label}
                >
                  {active && !done && (
                    <motion.div
                      className="absolute inset-y-0 left-0 bg-foreground/60"
                      initial={{ width: "0%" }}
                      animate={{ width: ["0%", "70%", "30%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  )}
                </div>
                {i === STEPS.length - 1 && done && (
                  <Check className="h-3 w-3 shrink-0 text-foreground" />
                )}
              </div>
            );
          })}
          {customMilestones.map((m) => (
            <div
              key={m.id}
              className={cn(
                "h-2 flex-1 rounded-full",
                m.done ? "bg-primary" : "bg-primary/20",
              )}
              title={m.label}
            />
          ))}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11px] font-medium text-foreground">
            {progress ? STEPS[currentIdx].label : "Noch nicht gestartet"}
          </span>
          {progress?.updated_at && (
            <span className="text-[10px] text-muted-foreground">
              {relTime(progress.updated_at)}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card shadow-soft">
      <div className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider">Kontakt-Fortschritt</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Wo stehst du im Gespräch mit dem Anbieter?
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Fortschritt
            </div>
            <div className="text-sm font-semibold tabular-nums">
              {completedTotal}/{totalSteps}
            </div>
          </div>
          <div className="relative h-10 w-10">
            <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
              <circle cx="18" cy="18" r="15.9" className="fill-none stroke-muted" strokeWidth="3" />
              <motion.circle
                cx="18"
                cy="18"
                r="15.9"
                className="fill-none stroke-foreground"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={100}
                initial={{ strokeDashoffset: 100 }}
                animate={{ strokeDashoffset: 100 - pct }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                pathLength={100}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold tabular-nums">
              {Math.round(pct)}%
            </span>
          </div>
        </div>
      </div>

      <ol className="relative px-5 py-5">
        <div className="absolute left-[36px] top-8 bottom-8 w-px bg-border" aria-hidden />
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const done = progress ? !!(progress.steps as StepLog)[s.key] : false;
          const active = progress ? s.key === progress.current_step : i === 0 && !progress;
          const ts = progress ? (progress.steps as StepLog)[s.key] : undefined;

          return (
            <li key={s.key} className="relative flex items-start gap-4 py-2.5">
              <button
                onClick={() => setStep.mutate(s.key)}
                disabled={setStep.isPending || isLoading}
                className={cn(
                  "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  done
                    ? "border-foreground bg-foreground text-background shadow-soft"
                    : active
                    ? "border-foreground bg-background text-foreground shadow-soft ring-4 ring-foreground/10"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
                aria-label={`Schritt ${i + 1}: ${s.label}`}
              >
                {setStep.isPending && setStep.variables === s.key ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : done ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </button>
              <div className="min-w-0 flex-1 pt-1">
                <button
                  onClick={() => setStep.mutate(s.key)}
                  className="block w-full text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        done || active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {s.label}
                    </span>
                    {ts && (
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        {fmtDate(ts as string)}
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-[11px]",
                      active && !done
                        ? "text-foreground/70"
                        : "text-muted-foreground/70",
                    )}
                  >
                    {done ? "erledigt" : active ? "aktueller Schritt" : "ausstehend"}
                  </span>
                </button>
              </div>
            </li>
          );
        })}

        {/* Custom milestones */}
        <AnimatePresence initial={false}>
          {customMilestones.map((m) => (
            <motion.li
              key={m.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="relative flex items-start gap-4 py-2.5"
            >
              <button
                onClick={() =>
                  updateCustom.mutate({
                    id: m.id,
                    changes: { done: !m.done, ts: !m.done ? new Date().toISOString() : m.ts },
                  })
                }
                className={cn(
                  "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed transition-all",
                  m.done
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : "border-primary/50 bg-background text-primary hover:bg-primary/5",
                )}
                aria-label={m.label}
              >
                {m.done ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              </button>
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <input
                    defaultValue={m.label}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== m.label) {
                        updateCustom.mutate({ id: m.id, changes: { label: v } });
                      } else if (!v) {
                        e.target.value = m.label;
                      }
                    }}
                    className={cn(
                      "min-w-0 flex-1 truncate border-b border-transparent bg-transparent text-sm font-medium outline-none transition-colors hover:border-border focus:border-primary",
                      m.done ? "text-foreground line-through opacity-70" : "text-foreground",
                    )}
                  />
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {fmtDate(m.ts)}
                  </span>
                  <button
                    onClick={() => deleteCustom.mutate(m.id)}
                    className="text-muted-foreground/50 hover:text-destructive"
                    aria-label="Schritt entfernen"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-[11px] text-muted-foreground/70">
                  {m.done ? "erledigt" : "individuell · klicke zum Abhaken"}
                </span>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>

        {/* Add custom step */}
        <li className="relative flex items-start gap-4 py-2.5">
          <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-border bg-background text-muted-foreground">
            <Plus className="h-4 w-4" />
          </div>
          <AddCustomInput onAdd={(label) => addCustom.mutate(label)} />
        </li>
      </ol>

      <div className="border-t border-border/70 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Notiz zum Kontakt
          </label>
          <span className="text-[10px] text-muted-foreground">
            {saveNote.isPending
              ? "Speichert…"
              : noteDraft !== (progress?.note ?? "")
              ? "Ungespeicherte Änderungen"
              : progress?.note
              ? "Gespeichert"
              : ""}
          </span>
        </div>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if (noteDraft !== (progress?.note ?? "")) saveNote.mutate(noteDraft);
          }}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              if (noteDraft !== (progress?.note ?? "")) saveNote.mutate(noteDraft);
            }
          }}
          placeholder="z. B. Maklerin angerufen, ruft morgen zurück…"
          rows={3}
          className="mt-2 w-full resize-y rounded-lg border border-border/70 bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          {noteDraft !== (progress?.note ?? "") && (
            <button
              type="button"
              onClick={() => setNoteDraft(progress?.note ?? "")}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Verwerfen
            </button>
          )}
          <button
            type="button"
            onClick={() => saveNote.mutate(noteDraft)}
            disabled={saveNote.isPending || noteDraft === (progress?.note ?? "")}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveNote.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function AddCustomInput({ onAdd }: { onAdd: (label: string) => void }) {
  const [value, setValue] = useState("");
  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue("");
  };
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 pt-1">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Eigenen Schritt hinzufügen … (z. B. Besichtigung notiert)"
        className="min-w-0 flex-1 border-b border-border bg-transparent py-1 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground"
      />
      <button
        onClick={submit}
        disabled={!value.trim()}
        className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
      >
        Hinzufügen
      </button>
    </div>
  );
}
