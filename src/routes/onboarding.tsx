import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Copy,
  CheckCircle2,
  ExternalLink,
  Lightbulb,
  RefreshCw,
  Inbox,
  Code2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

interface RawEmailRow {
  id: string;
  from_address: string | null;
  subject: string | null;
  status: "received" | "processing" | "processed" | "failed";
  error_message: string | null;
  listings_extracted: number;
  received_at: string;
}

const collectiveFilter =
  "from:(immoscout24.ch OR homegate.ch OR flatfox.ch OR home.ch OR newhome.ch OR casasoft.ch OR immostreet.ch)";

function formatReceivedAt(receivedAt: string) {
  return new Date(receivedAt).toISOString().slice(0, 16).replace("T", " ");
}

function StatusBadge({ status }: { status: RawEmailRow["status"] }) {
  const map: Record<RawEmailRow["status"], { label: string; cls: string }> = {
    received: { label: "Empfangen", cls: "bg-muted text-muted-foreground" },
    processing: {
      label: "Wird verarbeitet",
      cls: "bg-accent text-accent-foreground",
    },
    processed: { label: "Verarbeitet ✓", cls: "bg-primary/10 text-primary" },
    failed: { label: "Fehler", cls: "bg-destructive/10 text-destructive" },
  };

  const { label, cls } = map[status];

  return (
    <Badge className={cls} variant="secondary">
      {label}
    </Badge>
  );
}

function InboundStatus() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["raw_emails_recent"],
    queryFn: async (): Promise<RawEmailRow[]> => {
      const { data, error } = await supabase
        .from("raw_emails")
        .select(
          "id, from_address, subject, status, error_message, listings_extracted, received_at",
        )
        .order("received_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return (data ?? []) as RawEmailRow[];
    },
    enabled: mounted,
    refetchInterval: mounted ? 5000 : false,
  });

  const rows = data ?? [];

  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-3 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Inbox className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase">
                Live-Status: Eingehende Mails
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Hier siehst du die letzten 10 Mails, die direkt bei Lovable angekommen
              sind.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={!mounted || isFetching}
          >
            <RefreshCw
              className={`h-4 w-4 ${mounted && isFetching ? "animate-spin" : ""}`}
            />
          </Button>
        </div>

        {!mounted || isLoading ? (
          <p className="text-sm text-muted-foreground">Lade …</p>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm">
            <p className="font-medium">Noch keine Mails angekommen.</p>
            <p className="mt-1 text-muted-foreground">
              Sobald dein Gmail-Script eine Mail schickt, erscheint sie hier.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Empfangen</th>
                  <th className="px-3 py-2 text-left font-medium">Von</th>
                  <th className="px-3 py-2 text-left font-medium">Betreff</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Inserate</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t align-top">
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
                      {formatReceivedAt(r.received_at)}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-xs">
                      {r.from_address ?? "–"}
                    </td>
                    <td className="max-w-[320px] truncate px-3 py-2">
                      <div className="truncate">{r.subject ?? "(kein Betreff)"}</div>
                      {r.status === "failed" && r.error_message && (
                        <div className="mt-1 text-xs text-destructive">
                          {r.error_message}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.listings_extracted}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OnboardingPage() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const webhookUrl = `${supabaseUrl}/functions/v1/inbound-email`;
  const appsScript = `const WEBHOOK_URL = "${webhookUrl}";
const SEARCH_QUERY = '${collectiveFilter}';

function forwardPropertyEmailsToLovable() {
  const threads = GmailApp.search(SEARCH_QUERY, 0, 20);

  for (const thread of threads) {
    const messages = thread.getMessages();

    for (const message of messages) {
      const labels = message.getThread().getLabels().map((label) => label.getName());
      if (labels.includes('lovable-sent')) continue;

      const payload = {
        from: message.getFrom(),
        to: 'lovable-inbox',
        subject: message.getSubject(),
        html: message.getBody(),
        text: message.getPlainBody(),
      };

      UrlFetchApp.fetch(WEBHOOK_URL, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      });

      let label = GmailApp.getUserLabelByName('lovable-sent');
      if (!label) label = GmailApp.createLabel('lovable-sent');
      message.getThread().addLabel(label);
    }
  }
}
`;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Kopiert");
    setTimeout(() => setCopiedKey(null), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Direkte Gmail-Weiterleitung zu Lovable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ohne CloudMailin. Ohne Resend. Gmail schickt passende Immo-Mails direkt an
          dein Backend.
        </p>
      </div>

      <InboundStatus />

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase">So funktioniert es jetzt</h2>
          </div>
          <p className="text-sm">
            Statt eines externen Briefträgers nutzt du jetzt direkt <strong>Google Apps Script</strong>.
            Das kleine Script läuft in deinem Google-Konto und sendet passende Such-Mails
            direkt an Lovable weiter.
          </p>
          <p className="text-sm text-muted-foreground">
            Bildlich: <em>Gmail → Google Apps Script → Lovable</em>
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Schritt 1 von 4
            </div>
            <h2 className="mt-1 text-lg font-semibold">Google Apps Script öffnen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Das ist ein eingebautes Google-Tool und braucht keinen Drittanbieter.
            </p>
          </div>

          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>Öffne den Button unten.</li>
            <li>Klick auf <strong>„Neues Projekt“</strong>.</li>
            <li>Lösch den vorhandenen Beispielcode komplett.</li>
          </ol>

          <a
            href="https://script.google.com/home"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Google Apps Script öffnen <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Schritt 2 von 4
            </div>
            <h2 className="mt-1 text-lg font-semibold">Script einfügen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Kopiere den kompletten Code unten in Google Apps Script.
            </p>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-semibold uppercase text-muted-foreground">
                Gmail → Lovable Script
              </label>
              <Button onClick={() => copy(appsScript, "script")} variant="outline" size="sm">
                {copiedKey === "script" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="max-h-[420px] overflow-auto rounded-md bg-background p-3 font-mono text-xs whitespace-pre-wrap">
              {appsScript}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Schritt 3 von 4
            </div>
            <h2 className="mt-1 text-lg font-semibold">Script einmal autorisieren</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Danach darf Google das Script auf deine Gmail-Mails loslassen.
            </p>
          </div>

          <ol className="list-inside list-decimal space-y-3 text-sm">
            <li>Oben auf <strong>Speichern</strong> klicken.</li>
            <li>
              In der Funktions-Auswahl <strong>forwardPropertyEmailsToLovable</strong>{" "}
              wählen.
            </li>
            <li>Auf <strong>Ausführen</strong> klicken.</li>
            <li>
              Google fragt nach Rechten → dein Konto auswählen → <strong>Erweitert</strong>
              → <strong>Weiter zu Projekt</strong> → zulassen.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Schritt 4 von 4
            </div>
            <h2 className="mt-1 text-lg font-semibold">Automatisch jede Minute laufen lassen</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              So werden neue Such-Mails laufend direkt importiert.
            </p>
          </div>

          <ol className="list-inside list-decimal space-y-3 text-sm">
            <li>Links auf das <strong>Uhr-Symbol „Trigger“</strong> klicken.</li>
            <li>Unten rechts <strong>„Trigger hinzufügen“</strong>.</li>
            <li>
              Funktion: <strong>forwardPropertyEmailsToLovable</strong>
            </li>
            <li>
              Ereignisquelle: <strong>Zeitgesteuert</strong>
            </li>
            <li>
              Typ: <strong>Minuten-Timer</strong> → <strong>Jede Minute</strong>
            </li>
            <li>Speichern.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Nützliche Werte</h2>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Gmail-Suchfilter im Script
            </label>
            <div className="flex gap-2">
              <Input value={collectiveFilter} readOnly className="font-mono text-xs" />
              <Button onClick={() => copy(collectiveFilter, "filter")} variant="outline">
                {copiedKey === "filter" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Webhook-URL
            </label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button onClick={() => copy(webhookUrl, "wh")} variant="outline">
                {copiedKey === "wh" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-primary" />
            <h2 className="text-lg font-semibold">✅ Test</h2>
          </div>
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>Führe das Script einmal manuell aus.</li>
            <li>Schau oben im Live-Status nach.</li>
            <li>
              Wenn eine Immo-Mail erkannt wurde, erscheinen kurz danach die Inserate im
              Dashboard.
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
