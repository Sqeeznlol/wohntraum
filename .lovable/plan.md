

## Ziel
Suchabos laufen weiter auf `sqeezylol@gmail.com`. Gmail leitet jede neue Suchabo-Mail automatisch an die Webhook-Adresse weiter, dort übernimmt die KI-Extraktion wie bisher geplant.

## Lösungsweg

Gmail kann nicht direkt an einen HTTPS-Webhook senden. Wir brauchen eine **Inbound-E-Mail-Adresse** dazwischen, die Mails empfängt und als JSON an unseren Webhook POSTet. Empfehlung: **Resend Inbound** (Connector ist in Lovable bereits verfügbar, kostenlos für kleines Volumen, keine eigene Domain nötig — du bekommst sofort eine Adresse wie `irgendwas@inbound.resend.dev`).

Ablauf:
```text
Portal-Suchabo → sqeezylol@gmail.com → Gmail-Filter (Weiterleitung)
   → abo@inbound.resend.dev → Resend-Webhook → /functions/v1/inbound-email
   → KI-Extraktion → Dashboard
```

## Was ich umsetze

1. **Resend-Connector verbinden** (per `standard_connectors--connect`), damit wir eine funktionierende Inbound-Adresse + Webhook-Routing bekommen.
2. **Inbound-Adresse auf der Onboarding-Seite anzeigen** statt nur der Webhook-URL — das ist die Adresse, die du in Gmail einträgst.
3. **Onboarding-Seite umbauen** mit konkreter Schritt-für-Schritt-Anleitung speziell für Gmail + `sqeezylol@gmail.com`:
   - Schritt A: Weiterleitungsadresse in Gmail hinzufügen (Settings → Forwarding and POP/IMAP → Add a forwarding address) und Bestätigungs-Code aus der eingehenden Mail holen.
   - Schritt B: Filter pro Portal erstellen (von `noreply@immoscout24.ch`, `noreply@homegate.ch`, `noreply@flatfox.ch`, `newsletter@casasoft.ch`, `noreply@home.ch`, `noreply@newhome.ch`, `noreply@immostreet.ch`) → Aktion „Forward to: abo@inbound.resend.dev".
   - Optional: Sammel-Filter mit `from:(immoscout24.ch OR homegate.ch OR flatfox.ch OR home.ch OR newhome.ch OR casasoft.ch OR immostreet.ch)`.
4. **Webhook an Resend-Format anpassen** — der bestehende `inbound-email` Handler liest `from/to/subject/html/text`; ich ergänze das Mapping für Resends Payload-Struktur, damit beides funktioniert.
5. **Test-Hinweis** auf der Onboarding-Seite: erste Mail manuell weiterleiten und prüfen, ob sie auf `/` als Inserat erscheint.

## Voraussetzung von dir
- Bestätigung, dass ich **Resend** als Inbound-Anbieter verbinden darf (einmaliger OAuth-Klick).
- Falls Resend bei dir noch nicht eingerichtet ist: Account auf resend.com (gratis) — den Verbindungs-Schritt führe ich danach durch.

## Alternative (falls du Resend nicht willst)
- **CloudMailin** oder **Mailgun Routes**: gleiches Prinzip, kein Lovable-Connector — du müsstest Account selbst anlegen und die Webhook-URL dort eintragen. Mehr manuelle Arbeit, sonst gleichwertig.
- **Gmail API direkt pollen** (alle paar Minuten neue Mails von Gmail abholen): aufwändiger, braucht Google-OAuth, mehr Latenz, nicht empfohlen für diesen Use Case.

