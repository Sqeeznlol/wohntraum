import { Sparkles, Zap, TrendingUp, Phone, Filter, Calculator, Map } from "lucide-react";

export function PitchHero() {
  const features = [
    { icon: Zap, label: "Echtzeit-Aggregation", desc: "Alle Portale, ein Feed" },
    { icon: TrendingUp, label: "Preis-Analyse & Prognose", desc: "CHF/m² gegen Median, Trend" },
    { icon: Phone, label: "Direkter Verkäuferkontakt", desc: "Ohne Makler-Detour" },
    { icon: Filter, label: "Rendite-Vorfilter", desc: "Cash-Flow & Brutto-Yield" },
    { icon: Calculator, label: "Finanzierungs-Check", desc: "Tragbarkeit auf Knopfdruck" },
    { icon: Map, label: "GIS Zürich integriert", desc: "Zonenplan, EGID, Bauzone direkt am Inserat" },
  ];

  return (
    <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-card via-background to-accent/5 px-6 py-7 shadow-soft md:px-8 md:py-9">
      <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-accent/10 blur-3xl" />
      <div className="absolute -bottom-16 -left-12 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative">
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.label}
              className="flex items-start gap-2.5 rounded-xl border border-border/50 bg-background/60 p-3 backdrop-blur-sm transition-colors hover:border-accent/40"
            >
              <div className="rounded-lg bg-accent/10 p-1.5">
                <f.icon className="h-3.5 w-3.5 text-accent" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium leading-tight">{f.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
                  {f.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
