

## Bilder automatisch vom Portal importieren

Du hast recht — jedes Inserat hat 10–20 Bilder, aber wir speichern nur 1 (das aus dem E-Mail). Lösung: ein **Import-Button** auf der Detailseite, der per **Firecrawl** alle Bilder direkt vom Portal-Link (ImmoScout24, Homegate, etc.) holt und in die Galerie einfügt.

Firecrawl ist nötig, weil ImmoScout24 normale `fetch`-Anfragen blockiert (Anti-Bot-Schutz). Firecrawl umgeht das mit echtem Browser-Rendering.

### Was gebaut wird

**1. Firecrawl-Connector aktivieren**
Einmalige Verbindung — danach steht `FIRECRAWL_API_KEY` serverseitig zur Verfügung. Kein API-Key-Eingabe-Dialog für dich nötig.

**2. Edge Function `import-listing-images`**
- Input: `listing_id`
- Holt `primary_url` aus DB → ruft Firecrawl `scrape` mit Format `['html', 'links']` auf
- Extrahiert alle `<img>`-URLs + Bilder aus `og:image`, JSON-LD und Lazy-Load-Attributen (`data-src`, `srcset`)
- Filtert: nur große Bilder (>600px im Pfad/URL), keine Logos/Icons/Avatare, keine Tracking-Pixel
- Dedupliziert gegen bestehende `listing_images`
- Insert in `listing_images` mit fortlaufendem `sort_order`
- Return: `{ imported: 12, skipped: 2 }`

**3. UI auf Detailseite (`listings.$id.tsx`)**
Neuer Button **„Alle Bilder vom Portal importieren"** über der Galerie:
- Sichtbar nur wenn `primary_url` existiert
- Während Import: Spinner + „Lade Bilder…"
- Toast nach Erfolg: „12 Bilder importiert"
- Galerie aktualisiert sich automatisch (Query-Invalidation)

**4. Auto-Import bei neuen E-Mails (Bonus)**
In `inbound-email/index.ts`: wenn ein neues Listing angelegt wird und eine `primary_url` hat → Edge Function im Hintergrund (`waitUntil`) triggern. So füllt sich die Galerie ohne Klick.

### Portal-spezifische Selektoren

| Portal | Selektor / Strategie |
|---|---|
| ImmoScout24 | JSON-LD `@type: RealEstateListing` → `image[]`, `srcset` aus Slick-Slider |
| Homegate | `og:image` + `picture > source[srcset]` in Galerie |
| Comparis | `<img class="gallery">` |
| Andere | Generisch: alle `<img>` >600px + `og:image` |

### Deine Aktion

Du musst nur den **Firecrawl-Connector freigeben**, wenn der Verbindungs-Dialog erscheint. Danach läuft alles automatisch — bei bestehenden Inseraten per Button, bei neuen E-Mails automatisch.

