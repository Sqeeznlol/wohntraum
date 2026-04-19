
## Schweizer Immobilien-Dashboard (E-Mail → KI → Übersicht)

### So funktioniert's
1. **Du bekommst eine eigene Inbound-Adresse**, z. B. `dein-name@inbound.lovable.app`.
2. In jedem Suchabo (ImmoScout24, Flatfox, Homegate, Casasoft, ImmoStreet, Home.ch …) richtest du **automatische Weiterleitung** an diese Adresse ein – einmalig.
3. Sobald eine Suchabo-Mail eintrifft, läuft im Hintergrund:
   - **Mail empfangen** über einen Inbound-Webhook (Resend Inbound oder gleichwertiger Schweizer-tauglicher Anbieter).
   - **KI-Extraktion** mit Lovable AI (Gemini): erkennt aus dem Mail-HTML *jedes einzelne Inserat* und liefert Titel, Preis (CHF), Fläche (m²), Zimmer, Ort/PLZ, Adresse falls vorhanden, Link, Bildvorschau, Portal.
   - **CHF/m² automatisch berechnet** und gespeichert.
   - **Duplikat-Erkennung**: gleiche Objekte über verschiedene Portale werden anhand von Adresse + Fläche + Preis zusammengeführt; alle Quell-Links bleiben sichtbar.

### Dashboard
- **Listen-/Kachelansicht** aller Inserate, sortierbar nach CHF/m², Preis, Fläche, Datum, Portal.
- **Filter**: Preisbereich, m²-Bereich, CHF/m²-Bereich, Zimmer, Ort/PLZ, Portal, Status, nur Favoriten.
- **Karten-Ansicht** (OpenStreetMap/Leaflet) mit Pins; Klick öffnet das Inserat.
- **Status pro Objekt**: Neu / Interessant / Kontaktiert / Besichtigt / Abgelehnt + freies Notizfeld.
- **Detailseite**: alle Felder, Bild, Original-Mail-Auszug, alle Quell-Links bei Duplikaten, CHF/m² gross hervorgehoben.
- **Alerts**: Schwellwert für CHF/m² einstellbar – bei Unterschreitung Highlight im Dashboard + optional Mail an dich.
- **Gesamt-Statistik**: Anzahl Inserate pro Portal, Median CHF/m² pro Ort, Trend über die Zeit.

### Daten
- Tabellen für Inserate, Portale, Status/Notizen, Duplikat-Gruppen, Alert-Regeln, Roh-Mails (zur Nachverfolgung).
- Alle Beträge in CHF, alle Flächen in m².

### Onboarding-Seite
- Schritt-für-Schritt-Anleitung mit deiner persönlichen Inbound-Adresse und kurzen Klick-Anleitungen pro Portal, wie man dort die Suchabo-Mails an diese Adresse weiterleitet.

### Offen / Voraussetzungen, die ich nach Freigabe einrichte
- **Lovable Cloud** aktivieren (Datenbank + Server-Funktionen + Lovable AI).
- **Inbound-E-Mail-Anbieter**: Empfehlung **Resend Inbound** (Connector vorhanden, du brauchst nur einmal bestätigen). Damit bekommst du sofort eine funktionierende Eingangsadresse, ohne eigene Domain.
- Ohne Login (nur du), wie gewünscht – die Inbound-Adresse ist dein „Schlüssel".
