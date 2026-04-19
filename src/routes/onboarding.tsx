import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const webhookUrl = `${supabaseUrl}/functions/v1/inbound-email`;
  const [copied, setCopied] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Kopiert");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Setup</h1>
        <p className="text-sm text-muted-foreground">
          So bekommst du deine Suchabo-Mails automatisch ins Dashboard.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Schritt 1 · Inbound-E-Mail-Adresse einrichten
          </h2>
          <p className="text-sm">
            Damit Mails ankommen, brauchst du eine Inbound-E-Mail-Adresse, die deine Suchabo-Mails an den Webhook unten weiterleitet. Empfehlung:
          </p>
          <ul className="list-inside list-disc space-y-1 text-sm">
            <li>
              <strong>Resend Inbound</strong> – einfach einzurichten, gratis bis kleines Volumen.
              Lege bei Resend eine Inbound-Route an, die Mails per Webhook an die unten stehende URL POSTet.
            </li>
            <li>
              Alternativ: <strong>CloudMailin</strong>, <strong>Mailgun Routes</strong> oder <strong>Postmark Inbound</strong> – alle senden JSON an einen Webhook.
            </li>
          </ul>
          <div className="space-y-2">
            <label className="text-xs uppercase text-muted-foreground">
              Webhook-URL (in deinem Inbound-Anbieter eintragen)
            </label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button onClick={() => copy(webhookUrl)} variant="outline">
                {copied ? <CheckCircle2 className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Die Funktion akzeptiert JSON mit den Feldern <code>from</code>, <code>to</code>, <code>subject</code>, <code>html</code>, <code>text</code> – das ist das Standard-Format aller gängigen Inbound-Anbieter.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Schritt 2 · Suchabos auf die Inbound-Adresse weiterleiten
          </h2>
          <p className="text-sm">
            Sobald du eine Inbound-Adresse hast (z.B. <code>abo@inbound.deinedomain.ch</code>), richte in deinem E-Mail-Programm eine automatische Weiterleitung pro Portal ein – oder ändere die Empfangsadresse direkt im jeweiligen Suchabo.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {[
              {
                name: "ImmoScout24",
                hint: "Suchabo bearbeiten → E-Mail-Adresse ändern oder im Mailclient eine Filterregel anlegen.",
              },
              {
                name: "Homegate",
                hint: "Mein Konto → Suchaufträge → Empfangs-E-Mail anpassen.",
              },
              {
                name: "Flatfox",
                hint: "Suchabo bearbeiten → andere E-Mail-Adresse hinterlegen.",
              },
              {
                name: "Casasoft / ImmoStreet",
                hint: "Filter im Mailclient (Gmail/Outlook): von <newsletter@casasoft.ch> → weiterleiten an Inbound-Adresse.",
              },
              {
                name: "Home.ch",
                hint: "Filter im Mailclient anlegen: von <noreply@home.ch> → weiterleiten.",
              },
              {
                name: "Newhome",
                hint: "Suchabo bearbeiten → Empfänger-Mail anpassen oder Filterregel.",
              },
            ].map((p) => (
              <div key={p.name} className="rounded-md border p-3">
                <div className="font-medium">{p.name}</div>
                <p className="mt-1 text-xs text-muted-foreground">{p.hint}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-sm font-semibold uppercase text-muted-foreground">
            Schritt 3 · Was passiert dann?
          </h2>
          <ol className="list-inside list-decimal space-y-2 text-sm">
            <li>Mail trifft am Webhook ein und wird in <code>raw_emails</code> gespeichert.</li>
            <li>Eine KI (Lovable AI / Gemini) extrahiert jedes einzelne Inserat: Titel, Preis, Fläche, Zimmer, Ort, Bild, Link.</li>
            <li><strong>CHF/m²</strong> wird automatisch berechnet.</li>
            <li>Duplikate über mehrere Portale werden anhand von Adresse + Fläche + Preis erkannt und zusammengeführt.</li>
            <li>Du siehst alles in der Inserate-Übersicht, auf der Karte und mit deinen Alerts.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
