

## Problem
Resend bietet im Dashboard keine einfache „Inbound-Adresse" mehr an (nur noch via API mit eigener Domain + MX-Records). Für deinen Use Case ungeeignet.

## Lösung: anderer Inbound-Dienst
Ich empfehle **CloudMailin** oder **Postmark Inbound** (ähnlich, beide gratis für unsere Menge):

**Option A — CloudMailin** (mein Favorit für dich)
- Gratis: 10 000 Mails/Monat
- Du bekommst sofort eine fertige Adresse wie `abc123def@cloudmailin.net` — keine eigene Domain nötig
- Setup: Account erstellen → „New Address" → Webhook-URL eintragen → fertig
- Kein OAuth, kein Connector-Zwang — du kopierst einfach die Adresse

**Option B — Postmark Inbound**
- Gratis: 100 Mails/Monat (eher knapp für viele Such-Abos)
- Adresse wie `xyz@inbound.postmarkapp.com`
- Sonst gleicher Ablauf

**Option C — improvmx / Mailgun Routes**
- Auch möglich, aber komplizierter im Setup

## Was ich umsetze
1. **Webhook anpassen** (`supabase/functions/inbound-email/index.ts`): zusätzlich das Payload-Format von CloudMailin/Postmark verstehen (sie schicken `from`, `to`, `subject`, `html`, `plain` als Form-Daten oder JSON — ich mappe beide).
2. **Onboarding-Seite umschreiben** auf den gewählten Dienst, mit denselben einfachen 4 Schritten wie jetzt:
   - Schritt 1: Account bei CloudMailin
   - Schritt 2: Adresse anlegen + Webhook-URL eintragen (Webhook-URL kannst du mit einem Klick kopieren)
   - Schritt 3: Adresse in Gmail bestätigen
   - Schritt 4: Gmail-Filter mit Sammel-Filter
3. **Resend-Connector kann verbunden bleiben** — wir nutzen ihn später trotzdem zum *Versand* von Alert-Mails an dich. Das ist nämlich Resends Stärke.

## Was du jetzt entscheiden musst
Welchen Dienst nehmen wir? Ich würde **CloudMailin** empfehlen wegen 10 000 gratis Mails — das reicht locker auch wenn du 5 Such-Abos hast.

