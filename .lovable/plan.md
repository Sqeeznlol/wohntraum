

## Antwort auf die Resend-Frage

**Resend ist gratis, ABER:** Das Empfangen von Mails geht bei Resend nur, wenn du eine **eigene Domain** hast (z. B. `deinname.ch`) und im Domain-Anbieter komplizierte DNS-Einträge (sog. „MX-Records") setzt. Ohne eigene Domain → bei Resend **gar nicht möglich**, Mails zu empfangen. Versenden geht, Empfangen nicht.

Das ist genau der Grund, warum CloudMailin überhaupt empfohlen wurde: dort kriegst du **sofort eine fertige Adresse** ohne Domain.

## Warum CloudMailin bei dir nicht ging

Du hast geschrieben: „macht die Nachrichten nicht auf". Das klingt, als ob CloudMailin entweder gar keine Mails empfängt oder die Mails im CloudMailin-Dashboard nicht lesbar sind. Bevor wir den Dienst wechseln, müssen wir **wissen, was genau schiefgeht** — sonst wechseln wir nur zum nächsten Dienst und es passiert das Gleiche.

## Mögliche Wege (von einfach bis aufwändig)

| Weg | Eigene Domain nötig? | Gratis? | Schwierigkeit |
|---|---|---|---|
| **CloudMailin reparieren** | nein | ja (10 000/Monat) | leicht — wir debuggen |
| **Postmark Inbound** | nein | ja, aber nur 100 Mails/Monat | leicht |
| **improvmx + Webhook-Trick** | nein (du kriegst eine `@improvmx`-Adresse) | ja | mittel |
| **Resend Inbound** | **JA** (eigene Domain mit MX) | ja | schwer |
| **Eigene Domain + Lovable/Resend** | **JA** | ja | schwer |

## Was ich vorschlage als nächsten Schritt

**Schritt 1 (5 Min): CloudMailin debuggen.** Ich ergänze auf der Setup-Seite einen kleinen **Status-Bereich**, der die letzten 10 eingegangenen Mails (Tabelle `raw_emails`) anzeigt — mit Absender, Status (`processing`/`processed`/`failed`) und Fehlermeldung. So sehen wir sofort:
- Ob CloudMailin überhaupt Mails an uns weitergibt (= leerer Bereich heisst: CloudMailin schickt nichts)
- Ob unsere Verarbeitung scheitert (= Status `failed` mit Fehlertext)
- Ob die Gmail-Weiterleitung schon eingerichtet ist

**Schritt 2 (nur falls CloudMailin wirklich kaputt):** Falls sich rausstellt, dass CloudMailin gar nichts schickt, wechseln wir auf **Postmark** (auch ohne Domain, gratis 100/Monat — reicht problemlos für ein paar Such-Abos).

## Konkret zu ändern

- `src/routes/onboarding.tsx`: Status-Card oben hinzufügen mit den letzten 10 `raw_emails` (auto-refresh alle 5 Sek). Zeigt Spalten: Empfangen, Von, Betreff, Status, extrahierte Inserate.
- Keine DB-Änderungen nötig.
- Keine Webhook-Änderungen nötig (akzeptiert bereits Postmark, CloudMailin und Mailgun).

## Was du danach genau siehst und mir sagst

- „Bereich ist leer" → CloudMailin sendet nichts → wir wechseln auf Postmark
- „Da steht eine Mail, aber Status = failed" → wir lesen den Fehler und fixen ihn
- „Da stehen Mails mit Status = processed" → es funktioniert, dann müssen wir nur schauen warum sie nicht im Inserate-Tab erscheinen

Sag „los" und ich baue Schritt 1.

