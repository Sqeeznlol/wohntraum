/**
 * Zürich GIS-Helpers: erkennt Zürcher PLZ und baut Deep-Links
 * in den GIS-Browser (maps.zh.ch) und das ZH-Geoportal.
 *
 * Zürcher PLZ-Bereich (Kanton ZH): 8000-8999 sowie einige 8400er
 * für Winterthur. Wir nutzen 8000-8999 als pragmatische Heuristik,
 * exakte Liste käme aus zh_postal_codes Table.
 */

export function isZhPostalCode(plz: string | null | undefined): boolean {
  if (!plz) return false;
  const n = parseInt(plz, 10);
  return n >= 8000 && n <= 8999;
}

/**
 * Adress-Suche im GIS-Browser maps.zh.ch.
 * Der Browser unterstützt URL-Parameter zum Vor-Selektieren von Themen.
 */
export function gisAddressSearchUrl(address: string, postalCode: string, city: string): string {
  const q = encodeURIComponent(`${address}, ${postalCode} ${city}`);
  return `https://maps.zh.ch/?searchExpression=${q}`;
}

/**
 * Direkter Link in den Zonenplan (Bauzonen) der Stadt Zürich /
 * kantonsweite Nutzungsplanung.
 */
export function gisZonenplanUrl(address: string, postalCode: string, city: string): string {
  const q = encodeURIComponent(`${address}, ${postalCode} ${city}`);
  return `https://maps.zh.ch/?topic=BauzonenZH&searchExpression=${q}`;
}

/**
 * Eigentumsauskunft (Grundstück / Parzelle).
 */
export function gisEigentumUrl(address: string, postalCode: string, city: string): string {
  const q = encodeURIComponent(`${address}, ${postalCode} ${city}`);
  return `https://maps.zh.ch/?topic=DLGOWfarbigZH&searchExpression=${q}`;
}

/**
 * GeoAdmin Bundes-Karte mit GWR-Layer aktiviert (zeigt EGID & Gebäudedaten).
 */
export function geoadminGwrUrl(address: string, postalCode: string, city: string): string {
  const q = encodeURIComponent(`${address}, ${postalCode} ${city}`);
  return `https://map.geo.admin.ch/?layers=ch.bfs.gebaeude_wohnungs_register&swisssearch=${q}`;
}
