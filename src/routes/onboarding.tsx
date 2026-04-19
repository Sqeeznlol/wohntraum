import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, CheckCircle2, Mail } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

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

  const portals = [
    { name: "ImmoScout24", from: "noreply@immoscout24.ch" },
    { name: "Homegate", from: "noreply@homegate.ch" },
    { name: "Flatfox", from: "noreply@flatfox.ch" },
    { name: "Casasoft", from: "newsletter@casasoft.ch" },
    { name: "ImmoStreet", from: "noreply@immostreet.ch" },
    { name: "Home.ch", from: "noreply@home.ch" },
    { name: "Newhome", from: "noreply@newhome.ch" },
  ];

  const collectiveFilter =
    "from:(immoscout24.ch OR homegate.ch OR flatfox.ch OR home.ch OR newhome.ch OR casasoft.ch OR immostreet.ch)";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Setup für sqeezylol@gmail.com</h1>
        <p className="text-sm text-muted-foreground">
          So leitest du Suchabo-Mails von Gmail automatisch ins Dashboard.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Schritt 1 · Inbound-Adresse bei Resend anlegen
          </h2>
          <p className="text-sm">
            Resend ist verbunden ✅. Lege jetzt im{" "}
            <a
              href="https://resend.com/inbound"
              target="_blank"
              rel="noreferrer"
              className="font-medium underline"
            >
              Resend-Dashboard → Inbound
            </a>{" "}
            eine neue Inbound-Route an:
          </p>
          <ol className="list-inside list-decimal space-y-1 text-sm">
            <li>
              Inbound-Adresse wählen, z. B.{" "}
              <code className="rounded bg-muted px-1">abo@inbound.deinedomain.ch</code>{" "}
              (oder die Default-Resend-Subdomain).
            </li>
            <li>
              Als <strong>Webhook-URL</strong> die untenstehende Adresse eintragen.
            </li>
            <li>Speichern – Resend POSTet jede empfangene Mail an deinen Webhook.</li>
          </ol>

          <div className="space-y-2">
            <label className="text-xs uppercase text-muted-foreground">
              Webhook-URL (in Resend Inbound eintragen)
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
            <p className="text-xs text-muted-foreground">
              Notiere dir danach die <strong>Inbound-E-Mail-Adresse</strong> aus Resend
              (z. B. <code>abo@inbound.deinedomain.ch</code>) – die brauchst du in Schritt 2.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Schritt 2 · Weiterleitungsadresse in Gmail freischalten
          </h2>
          <p className="text-sm">
            Damit Gmail deine Inbound-Adresse als Ziel akzeptiert, musst du sie einmalig
            bestätigen.
          </p>
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              In Gmail (<code>sqeezylol@gmail.com</code>) →{" "}
              <strong>⚙ Einstellungen → Alle Einstellungen anzeigen → „Weiterleitung & POP/IMAP"</strong>.
            </li>
            <li>
              <strong>„Weiterleitungsadresse hinzufügen"</strong> klicken → die Resend-Inbound-Adresse
              eintragen → bestätigen.
            </li>
            <li>
              Resend empfängt die Bestätigungsmail. Schau im{" "}
              <a
                href="https://resend.com/inbound"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                Resend-Inbound-Log
              </a>{" "}
              nach dem Bestätigungs-Code (oder im Dashboard hier unter „Inserate" – die Mail
              landet als Roh-Eintrag).
            </li>
            <li>
              Code zurück in Gmail eingeben → fertig.{" "}
              <strong>Wichtig: NICHT</strong> „Alle Mails weiterleiten" aktivieren – wir
              filtern gleich gezielt.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Schritt 3 · Gmail-Filter pro Portal anlegen
          </h2>
          <p className="text-sm">
            Gmail → <strong>⚙ → Filter und blockierte Adressen → Neuen Filter erstellen</strong>.
            Pro Portal einen Filter, oder einmalig den Sammel-Filter unten.
          </p>

          <div className="rounded-md border bg-muted/40 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <Mail className="h-3 w-3" /> Sammel-Filter (empfohlen)
            </div>
            <div className="flex gap-2">
              <Input value={collectiveFilter} readOnly className="font-mono text-xs" />
              <Button
                onClick={() => copy(collectiveFilter, "coll")}
                variant="outline"
                size="sm"
              >
                {copiedKey === "coll" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Im Filter-Dialog ins Feld <strong>„Von"</strong> einfügen → Filter erstellen →
              Aktion: <strong>„Weiterleiten an: deine Resend-Inbound-Adresse"</strong>.
            </p>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Oder einzeln pro Portal
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {portals.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center justify-between rounded-md border p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">{p.from}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copy(p.from, p.name)}
                  >
                    {copiedKey === p.name ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Schritt 4 · Test
          </h2>
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              Warte auf eine echte Suchabo-Mail – oder leite manuell eine bestehende
              Portal-Mail an deine Inbound-Adresse weiter.
            </li>
            <li>
              Öffne die <strong>Inserate</strong>-Seite. Innerhalb weniger Sekunden sollten
              die extrahierten Objekte erscheinen, inkl. <strong>CHF/m²</strong>.
            </li>
            <li>
              Falls nichts ankommt: prüfe im Resend-Inbound-Log, ob die Mail eingetroffen
              ist – dort siehst du auch Webhook-Antworten.
            </li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Was im Hintergrund passiert
          </h2>
          <ol className="list-inside list-decimal space-y-1 text-sm">
            <li>Mail trifft via Resend Inbound am Webhook ein, wird in <code>raw_emails</code> gespeichert.</li>
            <li>Lovable AI (Gemini) extrahiert jedes Inserat: Titel, Preis, Fläche, Zimmer, Ort, Bild, Link.</li>
            <li><strong>CHF/m²</strong> wird automatisch berechnet.</li>
            <li>Duplikate über mehrere Portale werden anhand Adresse + Fläche + Preis zusammengeführt.</li>
            <li>Du siehst alles in Übersicht, Karte und Alerts.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
