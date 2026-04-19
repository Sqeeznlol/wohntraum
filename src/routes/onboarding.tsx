import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, CheckCircle2, ExternalLink, Lightbulb } from "lucide-react";
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

      {/* Was passiert hier eigentlich? */}
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
            in dein Dashboard fliessen, damit du alle Wohnungen an{" "}
            <strong>einem Ort</strong> siehst – inkl. CHF/m².
          </p>
          <p className="text-sm">
            Dafür brauchen wir einen kleinen „Briefträger" zwischen Gmail und dem
            Dashboard. Dieser Briefträger heisst <strong>Resend</strong>. Resend nimmt die
            E-Mails entgegen und gibt sie ans Dashboard weiter. Mehr macht's nicht.
          </p>
          <p className="text-sm text-muted-foreground">
            Bildlich: <em>Gmail → Resend (Briefträger) → Dashboard</em>
          </p>
        </CardContent>
      </Card>

      {/* SCHRITT 1 */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Schritt 1 von 4
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              Bei Resend einen Account erstellen
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Resend ist gratis für unsere Menge an Mails. Du brauchst nur eine E-Mail und
              ein Passwort.
            </p>
          </div>

          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>
              Klick auf den Button unten – die Resend-Webseite öffnet sich in einem neuen
              Tab.
            </li>
            <li>
              Klick oben rechts auf <strong>„Sign Up"</strong> und melde dich an
              (am besten mit deiner Gmail-Adresse <code>sqeezylol@gmail.com</code>).
            </li>
            <li>Bestätige die Anmeldung über die Mail, die Resend dir schickt.</li>
          </ol>

          <a
            href="https://resend.com/signup"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Resend öffnen <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>

      {/* SCHRITT 2 */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <div className="text-xs font-semibold uppercase text-muted-foreground">
              Schritt 2 von 4
            </div>
            <h2 className="mt-1 text-lg font-semibold">
              In Resend eine „Inbound-Adresse" anlegen
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Das ist die E-Mail-Adresse vom Briefträger. Hier landen deine Such-Abos
              zwischendurch, bevor sie ins Dashboard wandern.
            </p>
          </div>

          <ol className="list-inside list-decimal space-y-3 text-sm">
            <li>
              Geh in Resend links im Menü auf{" "}
              <a
                href="https://resend.com/inbound"
                target="_blank"
                rel="noreferrer"
                className="font-medium underline"
              >
                Inbound
              </a>{" "}
              und klick auf <strong>„Add Inbound"</strong> (oder „Create").
            </li>
            <li>
              Wähle eine Adresse aus, z. B.{" "}
              <code className="rounded bg-muted px-1">abo@inbound.resend.dev</code>. Den
              Teil vor dem <code>@</code> kannst du frei wählen (z. B.{" "}
              <code>sqeezy</code>). <strong>Notiere dir diese Adresse</strong> – du
              brauchst sie in Schritt 3.
            </li>
            <li>
              Bei <strong>„Destination"</strong> wähle <strong>„Webhook"</strong> aus.
            </li>
            <li>
              Kopiere die Adresse unten und füge sie ins Feld <strong>„Webhook URL"</strong>{" "}
              ein. <em>Das ist die Adresse von deinem Dashboard.</em>
            </li>
          </ol>

          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <label className="text-xs font-semibold uppercase text-muted-foreground">
              Webhook-URL (in Resend einfügen)
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

          <ol
            className="list-inside list-decimal space-y-2 text-sm"
            start={5}
          >
            <li>
              Klick <strong>„Save"</strong>. Fertig mit Resend!
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* SCHRITT 3 */}
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
              Mails an die Resend-Adresse weiterleiten darf. Dauert 2 Minuten.
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
              Tippe die <strong>Resend-Inbound-Adresse</strong> aus Schritt 2 ein
              (z. B. <code>abo@inbound.resend.dev</code>) → <strong>„Weiter"</strong> →{" "}
              <strong>„Fortfahren"</strong> → <strong>„OK"</strong>.
            </li>
            <li>
              Gmail schickt jetzt einen <strong>Bestätigungs-Code</strong> an diese
              Adresse. Geh zurück in Resend → <strong>Logs</strong> (oder im Dashboard
              hier auf der <strong>Inserate</strong>-Seite) – dort siehst du die Mail von
              Gmail mit einem Code wie <code>123456789</code>.
            </li>
            <li>
              Kopiere den Code, geh zurück in Gmail-Einstellungen → Code eintippen →{" "}
              <strong>„Bestätigen"</strong>.
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

      {/* SCHRITT 4 */}
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
              <Input
                value={collectiveFilter}
                readOnly
                className="font-mono text-xs"
              />
              <Button
                onClick={() => copy(collectiveFilter, "coll")}
                variant="outline"
              >
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
              Unten rechts auf <strong>„Filter erstellen"</strong> klicken (nicht „Suchen").
            </li>
            <li>
              Es erscheint eine Checkbox-Liste. Hak <strong>„Weiterleiten an:"</strong> an
              und wähle im Dropdown deine <strong>Resend-Inbound-Adresse</strong> aus
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

      {/* TEST */}
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
              <strong>„Weiterleiten"</strong> → an deine{" "}
              <strong>Resend-Inbound-Adresse</strong> senden.
            </li>
            <li>
              Geh zurück hier ins Dashboard auf <strong>Inserate</strong>. Innerhalb von
              ca. 10 Sekunden sollten die Wohnungen aus dieser Mail erscheinen.
            </li>
            <li>
              Wenn nichts kommt: in Resend unter <strong>Logs</strong> nachschauen – dort
              steht, ob die Mail angekommen ist und was passiert ist.
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
            <li>Mail kommt bei Resend an → wird ans Dashboard weitergegeben.</li>
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
