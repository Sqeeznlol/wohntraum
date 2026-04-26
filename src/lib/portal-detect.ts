/**
 * Erkennt das Inserat-Portal automatisch anhand der URL.
 * Nutzt die Hostname-Struktur — funktioniert auch mit Subdomains, www. etc.
 */
import type { Portal } from "./db-types";

const HOST_RULES: Array<{ match: (host: string) => boolean; portal: Portal }> = [
  { match: (h) => h.includes("immoscout24"), portal: "immoscout24" },
  { match: (h) => h.includes("homegate"), portal: "homegate" },
  { match: (h) => h.includes("flatfox"), portal: "flatfox" },
  { match: (h) => h.includes("immostreet"), portal: "immostreet" },
  { match: (h) => h.includes("newhome"), portal: "newhome" },
  { match: (h) => h.includes("home.ch") || h.includes("homech"), portal: "home_ch" },
  { match: (h) => h.includes("casasoft"), portal: "casasoft" },
];

export function detectPortalFromUrl(url: string | null | undefined): Portal {
  if (!url) return "other";
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    for (const rule of HOST_RULES) {
      if (rule.match(host)) return rule.portal;
    }
    return "other";
  } catch {
    // Kein gültiger URL → versuche bare String-Match (ohne Protokoll)
    const h = url.toLowerCase();
    for (const rule of HOST_RULES) {
      if (rule.match(h)) return rule.portal;
    }
    return "other";
  }
}
