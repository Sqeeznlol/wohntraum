import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Mail, MessageCircle, FileText, CalendarClock, CalendarCheck, Loader2 } from "lucide-react";
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

type StepLog = Partial<Record<ContactStepKey, string>>; // ISO timestamps

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

export function ContactProgress({ listingId, compact = false }: { listingId: string; compact?: boolean }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["contact-progress", listingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listing_contact_progress" as never)
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

  const setStep = useMutation({
    mutationFn: async (stepKey: ContactStepKey) => {
      const now = new Date().toISOString();
      const existingSteps = (progress?.steps ?? {}) as StepLog;
      const nextSteps: StepLog = { ...existingSteps };
      // Mark all steps up to and including stepKey
      const targetIdx = STEPS.findIndex((s) => s.key === stepKey);
      for (let i = 0; i <= targetIdx; i++) {
        const k = STEPS[i].key;
        if (!nextSteps[k]) nextSteps[k] = now;
      }
      // Remove later steps if user goes back
      for (let i = targetIdx + 1; i < STEPS.length; i++) {
        delete nextSteps[STEPS[i].key];
      }

      if (progress) {
        const { error } = await supabase
          .from("listing_contact_progress" as never)
          .update({ current_step: stepKey, steps: nextSteps })
          .eq("listing_id", listingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("listing_contact_progress" as never)
          .insert({ listing_id: listingId, current_step: stepKey, steps: nextSteps });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contact-progress", listingId] });
    },
  });

  const [noteDraft, setNoteDraft] = useState<string>("");
  useEffect(() => {
    setNoteDraft(progress?.note ?? "");
  }, [progress?.note]);

  const saveNote = useMutation({
    mutationFn: async (text: string) => {
      if (progress) {
        const { error } = await supabase
          .from("listing_contact_progress" as never)
          .update({ note: text })
          .eq("listing_id", listingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("listing_contact_progress" as never)
          .insert({ listing_id: listingId, current_step: "message_sent", note: text });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contact-progress", listingId] }),
  });

  const completedCount = progress
    ? STEPS.filter((s) => (progress.steps as StepLog)[s.key]).length
    : 0;
  const pct = (completedCount / STEPS.length) * 100;

  if (compact) {
    return (
      <div className="border-t border-border/70 bg-gradient-to-b from-card to-muted/20 px-4 py-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Kontakt-Fortschritt
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {completedCount}/{STEPS.length}
          </span>
        </div>
        {/* Stepper dots */}
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

  // Full view (used on detail page)
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
              {completedCount}/{STEPS.length}
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

      {/* Vertical timeline */}
      <ol className="relative px-5 py-5">
        {/* connector */}
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
                        {fmtDate(ts)}
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
                    {done
                      ? "erledigt"
                      : active
                      ? "aktueller Schritt"
                      : "ausstehend"}
                  </span>
                </button>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Note */}
      <div className="border-t border-border/70 px-5 py-4">
        <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Notiz zum Kontakt
        </label>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => {
            if (noteDraft !== (progress?.note ?? "")) saveNote.mutate(noteDraft);
          }}
          placeholder="z. B. Maklerin angerufen, ruft morgen zurück…"
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-border/70 bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-foreground"
        />
      </div>
    </div>
  );
}
