// Helpers for formatting Swiss currency and area
export function formatCHF(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatSqm(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(value)} m²`;
}

export function formatPricePerSqm(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(value)} CHF/m²`;
}

export const PORTAL_LABELS: Record<string, string> = {
  immoscout24: "ImmoScout24",
  homegate: "Homegate",
  flatfox: "Flatfox",
  casasoft: "Casasoft",
  immostreet: "ImmoStreet",
  home_ch: "Home.ch",
  newhome: "Newhome",
  other: "Andere",
};

export const STATUS_LABELS: Record<string, string> = {
  new: "Neu",
  interested: "Interessant",
  contacted: "Kontaktiert",
  visited: "Besichtigt",
  rejected: "Abgelehnt",
};
