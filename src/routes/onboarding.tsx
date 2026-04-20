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
  MailCheck,
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
  text_body: string | null;
}

function extractGmailConfirmationLink(text: string | null | undefined) {
  if (!text) return null;
  const match = text.match(/https:\/\/mail\.google\.com\/mail\/[^\s]+/);
  return match?.[0] ?? null;
}

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
          "id, from_address, subject, status, error_message, listings_extracted, received_at, text_body",
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
  const gmailForwardingMail = rows.find(
    (row) =>
      row.from_address === "forwarding-noreply@google.com" &&
      row.subject?.includes("Bestätigen der Weiterleitung"),
  );
  const gmailConfirmationLink = extractGmailConfirmationLink(
    gmailForwardingMail?.text_body,
  );

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Kopiert");
  };

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
              Hier siehst du die letzten 10 Mails, die bei uns angekommen sind. Du
              musst CloudMailin dafür nicht mehr öffnen.
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

        {gmailForwardingMail && gmailConfirmationLink ? (
          <div className="rounded-md border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <MailCheck className="mt-0.5 h-4 w-4 text-primary" />
              <div className="space-y-2">
                <p className="text-sm font-medium">Gmail-Bestätigung direkt hier</p>
                <p className="text-sm text-muted-foreground">
                  Die Bestätigungsmail ist bereits angekommen. Öffne einfach den Link
                  unten – ganz ohne CloudMailin-Inbox.
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={gmailConfirmationLink}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Bestätigungslink öffnen <ExternalLink className="h-4 w-4" />
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(gmailConfirmationLink)}
                  >
                    <Copy className="h-4 w-4" />
                    Link kopieren
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!mounted || isLoading ? (
          <p className="text-sm text-muted-foreground">Lade …</p>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-sm">
            <p className="font-medium">Noch keine Mails angekommen.</p>
            <p className="mt-1 text-muted-foreground">
              Sobald der Briefträger eine Mail an uns weitergibt, erscheint sie hier.
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
                    <td className="max-w-[280px] truncate px-3 py-2">
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

        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">So liest du das:</strong> Leer = es
          kommt nichts an. <span className="text-destructive">Fehler</span> = Mail kam
          an, aber Verarbeitung schiefgelaufen. <span className="text-primary">Verarbeitet ✓</span>
          = Mail kam technisch an und wurde korrekt gelesen.
        </div>
      </CardContent>
    </Card>
  );
}

function OnboardingPage() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const webhookUrl = `${supabaseUrl}/functions/v1/inbound-email`;
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Kopiert");
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const collectiveFilter =
    "from:(immoscout24.ch OR homegate.ch OR flatfox.ch OR home.ch OR newhome.ch OR casasoft.ch OR immostreet.ch)";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Setup – ganz einfach erklärt</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Wir machen das in 4 Schritten. Du brauchst dafür ca. 10 Minuten und nur deinen
          Browser. Kein Programmierwissen nötig.
        </p>
      </div>

      <InboundStatus />

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="space-y-2 p-6">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase">
              Was passiert hier eigentlich?
            </h2>
          </div>
          <p className="text-sm">
            Du bekommst Such-Abo-Mails von ImmoScout24, Homegate & Co. an{" "}
            <strong>sqeezylol@gmail.com</strong>. Wir wollen, dass diese Mails automatisch
            in dein Dashboard fliessen, damit du alle Wohnungen an <strong>einem Ort</strong>
            siehst – inkl. CHF/m².
          </p>
          <p className="text-sm">
            Dafür brauchen wir einen kleinen „Briefträger" zwischen Gmail und dem
            Dashboard. Dieser Briefträger heisst <strong>CloudMailin</strong>. Er nimmt
            die E-Mails entgegen und gibt sie ans Dashboard weiter. Mehr macht er nicht.
          </p>
          <p className="text-sm text-muted-foreground">
            Bildlich: <em>Gmail → CloudMailin (Briefträger) → Dashboard</em>
          </p>
          <p className="text-xs text-muted-foreground">
            Alles Wichtige siehst du aber direkt hier im Dashboard – auch die
            Gmail-Bestätigung.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Schritt 1 von 4
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              Bei CloudMailin einen Account erstellen
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gratis. Du brauchst nur deine E-Mail und ein Passwort. Keine Kreditkarte.
            </p>
          </div>

          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              Klick auf den Button unten – CloudMailin öffnet sich in einem neuen Tab.
            </li>
            <li>
              Klick auf <strong>„Sign Up"</strong> und melde dich an
              (am besten mit <code>sqeezylol@gmail.com</code>).
            </li>
            <li>Bestätige die Anmeldung über die Mail, die CloudMailin dir schickt.</li>
          </ol>

          <a
            href="https://www.cloudmailin.com/signup"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            CloudMailin öffnen <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Schritt 2 von 4
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              In CloudMailin eine Empfangs-Adresse anlegen
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Das ist die E-Mail-Adresse vom Briefträger. Hier landen deine Such-Abos
              zwischendurch, bevor sie ins Dashboard wandern.
            </p>
          </div>

          <ol className="list-inside list-decimal space-y-3 text-sm">
            <li>
              Nach dem Login kommst du direkt aufs Dashboard. Klick oben auf{" "}
              <strong>„Addresses"</strong> → <strong>„New Address"</strong>.
            </li>
            <li>
              CloudMailin generiert automatisch eine Adresse wie{" "}
              <code className="rounded bg-muted px-1">abc123def@cloudmailin.net</code>.
              <strong> Notiere dir diese Adresse</strong> – du brauchst sie in Schritt 3
              und 4.
            </li>
            <li>
              Bei <strong>„Target URL"</strong> (oder „POST Target") kopiere die
              Webhook-URL hier unten rein:
            </li>
          </ol>

          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Webhook-URL (in CloudMailin als „Target URL" einfügen)
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

          <ol className="list-inside list-decimal space-y-2 text-sm" start={4}>
            <li>
              Bei <strong>„Format"</strong> wähle <strong>„JSON Normalized"</strong>{" "}
              (oder „Original" – beides funktioniert).
            </li>
            <li>
              Klick <strong>„Create Address"</strong>. Fertig mit CloudMailin!
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Schritt 3 von 4
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              Gmail beibringen, dass es dem Briefträger vertrauen darf
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gmail ist von Haus aus misstrauisch. Du musst einmal bestätigen, dass es
              Mails an die CloudMailin-Adresse weiterleiten darf. Dauert 2 Minuten.
            </p>
          </div>

          <ol className="list-inside list-decimal space-y-3 text-sm">
            <li>
              Öffne Gmail (<code>sqeezylol@gmail.com</code>). Klick oben rechts auf das{" "}
              <strong>Zahnrad ⚙</strong> → <strong>„Alle Einstellungen anzeigen"</strong>.
            </li>
            <li>
              Geh oben auf den Tab <strong>„Weiterleitung &amp; POP/IMAP"</strong>.
            </li>
            <li>
              Klick auf <strong>„Weiterleitungsadresse hinzufügen"</strong>.
            </li>
            <li>
              Tippe deine <strong>CloudMailin-Adresse</strong> aus Schritt 2 ein
              (z. B. <code>abc123def@cloudmailin.net</code>) → <strong>„Weiter"</strong>
              → <strong>„Fortfahren"</strong> → <strong>„OK"</strong>.
            </li>
            <li>
              Gmail schickt die Bestätigung an diese Adresse. Du musst dafür <strong>
                CloudMailin nicht öffnen
              </strong>
              : scrolle einfach hier ganz nach oben zum Kasten <strong>
                „Live-Status: Eingehende Mails"
              </strong>
              .
            </li>
            <li>
              Sobald die Gmail-Mail dort erscheint, klick auf <strong>
                „Bestätigungslink öffnen"
              </strong>
              . Danach ist die Weiterleitungsadresse bestätigt.
            </li>
          </ol>

          <div className="rounded-md border-l-4 border-l-primary bg-muted p-3 text-sm">
            ⚠️ <strong>Wichtig:</strong> Wähle <strong>NICHT</strong> „Eine Kopie der
            eingehenden E-Mails an … weiterleiten". Lass das auf{" "}
            <strong>„Weiterleitung deaktivieren"</strong> stehen. Wir leiten gleich nur
            gezielt die Immobilien-Mails weiter (Schritt 4) – nicht alles.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Schritt 4 von 4
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              Gmail-Filter anlegen (nur Immo-Mails weiterleiten)
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Jetzt sagen wir Gmail: „Immer wenn eine Mail von ImmoScout, Homegate, Flatfox
              etc. kommt, schick eine Kopie an den Briefträger." Alles andere bleibt
              unberührt in deinem Posteingang.
            </p>
          </div>

          <ol className="list-inside list-decimal space-y-3 text-sm">
            <li>
              In Gmail oben in die <strong>Suchleiste</strong> klicken. Ganz rechts in der
              Suchleiste ist ein kleines <strong>Filter-Symbol</strong> (Schieberegler) –
              draufklicken.
            </li>
            <li>
              Im Feld <strong>„Von"</strong> diesen Text einfügen (Knopf zum Kopieren
              unten):
            </li>
          </ol>

          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              In Gmail-Filter „Von" einfügen
            </label>
            <div className="flex gap-2">
              <Input value={collectiveFilter} readOnly className="font-mono text-xs" />
              <Button onClick={() => copy(collectiveFilter, "coll")} variant="outline">
                {copiedKey === "coll" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Das deckt alle 7 grossen Schweizer Portale auf einmal ab.
            </p>
          </div>

          <ol className="list-inside list-decimal space-y-3 text-sm" start={3}>
            <li>
              Unten rechts auf <strong>„Filter erstellen"</strong> klicken (nicht
              „Suchen").
            </li>
            <li>
              Es erscheint eine Checkbox-Liste. Hak <strong>„Weiterleiten an:"</strong> an
              und wähle im Dropdown deine <strong>CloudMailin-Adresse</strong> aus
              (die du in Schritt 3 bestätigt hast).
            </li>
            <li>
              Optional zusätzlich anhaken: <strong>„Auf passende Konversationen
              anwenden"</strong> – dann werden auch ältere Mails einmalig importiert.
            </li>
            <li>
              Klick auf <strong>„Filter erstellen"</strong>. <strong>Fertig! 🎉</strong>
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card className="border-primary/40 bg-primary/5">
        <CardContent className="space-y-3 p-6">
          <h2 className="text-lg font-semibold">✅ Funktioniert's? So testest du</h2>
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              Geh in Gmail in deinen Posteingang, such eine alte Mail von ImmoScout24 oder
              Homegate.
            </li>
            <li>
              Öffne sie → oben rechts auf die <strong>drei Punkte</strong> →{" "}
              <strong>„Weiterleiten"</strong> → an deine <strong>CloudMailin-Adresse</strong>
              senden.
            </li>
            <li>
              Geh zurück hier ins Dashboard auf <strong>Inserate</strong>. Innerhalb von
              ca. 10 Sekunden sollten die Wohnungen aus dieser Mail erscheinen.
            </li>
            <li>
              Wenn nichts kommt: ganz oben im <strong>Live-Status</strong> nachschauen –
              dort siehst du sofort, ob die Mail angekommen ist und ob ein Fehler
              passiert ist.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Was läuft im Hintergrund?
          </h2>
          <ol className="list-inside list-decimal space-y-1 text-sm">
            <li>Mail kommt beim Briefträger an → wird ans Dashboard weitergegeben.</li>
            <li>
              Eine KI (Google Gemini) liest die Mail und holt für jedes Inserat: Titel,
              Preis, Fläche, Zimmer, Ort, Bild, Link.
            </li>
            <li>
              <strong>CHF/m²</strong> wird automatisch berechnet.
            </li>
            <li>
              Wenn dasselbe Inserat auf mehreren Portalen erscheint, wird es
              zusammengeführt.
            </li>
            <li>Du siehst alles in Übersicht, Karte und Alerts.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
