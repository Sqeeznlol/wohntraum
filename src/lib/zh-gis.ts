/**
 * Zürich GIS-Helpers: erkennt Zürcher PLZ und baut Deep-Links
 * in den GIS-Browser (maps.zh.ch) und das ZH-Geoportal.
 *
 * WICHTIG: maps.zh.ch funktioniert NICHT zuverlässig mit `searchExpression`.
 * Korrekte Deep-Links nutzen LV95-Koordinaten (EPSG:2056) via x/y.
 * Beispiel:
 *   https://maps.zh.ch/?topic=OerebKatasterZH&scale=500&x=2686329.56&y=1264969.81&srid=2056
 *
 * Zürcher PLZ-Bereich (Kanton ZH): 8000-8999.
 */

export function isZhPostalCode(plz: string | null | undefined): boolean {
  if (!plz) return false;
  const n = parseInt(plz, 10);
  return n >= 8000 && n <= 8999;
}

/**
 * WGS84 (lat/lng) → LV95 (E/N) Approximation nach swisstopo (genau auf ~1 m).
 * Wir verwenden diese, falls in der DB nur lat/lon gespeichert sind.
 */
export function wgs84ToLv95(lat: number, lon: number): { east: number; north: number } {
  const phi = (lat * 3600 - 169028.66) / 10000;
  const lambda = (lon * 3600 - 26782.5) / 10000;
  const east =
    2600072.37 +
    211455.93 * lambda -
    10938.51 * lambda * phi -
    0.36 * lambda * phi * phi -
    44.54 * Math.pow(lambda, 3);
  const north =
    1200147.07 +
    308807.95 * phi +
    3745.25 * lambda * lambda +
    76.63 * phi * phi -
    194.56 * lambda * lambda * phi +
    119.79 * Math.pow(phi, 3);
  return { east, north };
}

interface LocationInput {
  lv95_east?: number | null;
  lv95_north?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** Liefert LV95-Koordinaten — entweder direkt oder umgerechnet aus WGS84. */
export function resolveLv95(loc: LocationInput): { east: number; north: number } | null {
  if (loc.lv95_east != null && loc.lv95_north != null) {
    return { east: Number(loc.lv95_east), north: Number(loc.lv95_north) };
  }
  if (loc.latitude != null && loc.longitude != null) {
    return wgs84ToLv95(Number(loc.latitude), Number(loc.longitude));
  }
  return null;
}

const BASE = "https://maps.zh.ch/";

function buildMapsUrl(
  topic: string,
  x: number,
  y: number,
  scale = 500,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({
    topic,
    scale: String(scale),
    x: x.toFixed(2),
    y: y.toFixed(2),
    srid: "2056",
    ...(extra ?? {}),
  });
  return `${BASE}?${params.toString()}`;
}

/**
 * Adress-Suche im GIS-Browser maps.zh.ch — koordinatenbasiert auf der Liegenschaft.
 * Fallback (kein Coord) → einfache Suche.
 */
export function gisAddressSearchUrl(loc: LocationInput, fallbackQuery?: string): string {
  const c = resolveLv95(loc);
  if (c) return buildMapsUrl("BasiskarteZH", c.east, c.north, 500);
  const q = encodeURIComponent(fallbackQuery ?? "");
  return `${BASE}?searchExpression=${q}`;
}

/** Zonenplan / Bauzonen direkt auf der Parzelle. */
export function gisZonenplanUrl(loc: LocationInput, fallbackQuery?: string): string {
  const c = resolveLv95(loc);
  if (c) return buildMapsUrl("BauzonenZH", c.east, c.north, 1000);
  const q = encodeURIComponent(fallbackQuery ?? "");
  return `${BASE}?topic=BauzonenZH&searchExpression=${q}`;
}

/** Eigentumsauskunft (Grundstück / Parzelle). */
export function gisEigentumUrl(loc: LocationInput, fallbackQuery?: string): string {
  const c = resolveLv95(loc);
  if (c) return buildMapsUrl("DLGOWfarbigZH", c.east, c.north, 500);
  const q = encodeURIComponent(fallbackQuery ?? "");
  return `${BASE}?topic=DLGOWfarbigZH&searchExpression=${q}`;
}

/** GeoAdmin Bundes-Karte mit GWR-Layer (zeigt EGID & Gebäudedaten). */
export function geoadminGwrUrl(loc: LocationInput, fallbackQuery?: string): string {
  const c = resolveLv95(loc);
  if (c) {
    return `https://map.geo.admin.ch/?layers=ch.bfs.gebaeude_wohnungs_register&E=${c.east.toFixed(
      2,
    )}&N=${c.north.toFixed(2)}&zoom=10&crosshair=marker`;
  }
  const q = encodeURIComponent(fallbackQuery ?? "");
  return `https://map.geo.admin.ch/?layers=ch.bfs.gebaeude_wohnungs_register&swisssearch=${q}`;
}

/**
 * ÖREB-Kataster direkt auf der Liegenschaft (koordinatenbasiert).
 * `bfs` und `parcelNumber` werden ignoriert wenn Koordinaten vorhanden sind,
 * weil maps.zh.ch BFS+Katasternr-Links unzuverlässig auflöst.
 */
export function gisOerebUrl(
  loc: LocationInput,
  bfs?: number | null,
  parcelNumber?: string | null,
): string {
  const c = resolveLv95(loc);
  if (c) return buildMapsUrl("OerebKatasterZH", c.east, c.north, 500);
  if (bfs && parcelNumber) {
    return `${BASE}?topic=OerebKatasterZH&srid=2056&scale=1500&bfsnr=${bfs}&katasternr=${encodeURIComponent(
      parcelNumber,
    )}`;
  }
  return `${BASE}?topic=OerebKatasterZH`;
}
