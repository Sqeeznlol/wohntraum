import { Link, Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { initActivityTracker } from "@/lib/activity-tracker";

import appCss from "../styles.css?url";
import leafletCss from "leaflet/dist/leaflet.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-serif-display text-7xl">404</h1>
        <h2 className="mt-4 text-xl font-medium">Seite nicht gefunden</h2>
        <p className="mt-2 text-sm text-muted-foreground">Diese Seite existiert nicht.</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Zur Übersicht
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Immo Radar — Schweizer Immobilien-Intelligenz" },
      {
        name: "description",
        content:
          "Aggregiert Suchabo-Mails von ImmoScout24, Homegate, Flatfox & Co. mit automatischer CHF/m²-Analyse.",
      },
      { property: "og:title", content: "Immo Radar — Schweizer Immobilien-Intelligenz" },
      { name: "twitter:title", content: "Immo Radar — Schweizer Immobilien-Intelligenz" },
      { property: "og:description", content: "Aggregiert Suchabo-Mails von ImmoScout24, Homegate, Flatfox & Co. mit automatischer CHF/m²-Analyse." },
      { name: "twitter:description", content: "Aggregiert Suchabo-Mails von ImmoScout24, Homegate, Flatfox & Co. mit automatischer CHF/m²-Analyse." },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: leafletCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head>
        <HeadContent />
      </head>
      <body style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const navItems: ReadonlyArray<{
  to: "/" | "/map" | "/alerts" | "/onboarding";
  label: string;
  exact?: boolean;
}> = [
  { to: "/", label: "Inserate", exact: true },
  { to: "/map", label: "Karte" },
  { to: "/alerts", label: "Alerts" },
  { to: "/onboarding", label: "Setup" },
];

function VisitTracker() {
  const [tracked, setTracked] = useState(false);
  if (typeof window !== "undefined" && !tracked) {
    setTracked(true);
    // Don't track admin viewing their own dashboard
    const isAdmin = window.location.pathname.startsWith("/admin");
    if (!isAdmin) {
      // Fire-and-forget visit log
      fetch("/api/track-visit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: window.location.pathname,
          referrer: document.referrer || null,
          language: navigator.language || null,
        }),
      }).catch(() => {});
      // Detailed activity tracking (clicks, scrolls, page views, inputs)
      initActivityTracker();
    }
  }
  return null;
}

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <VisitTracker />
      <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
        {/* Apple-style fixed glass nav */}
        <header className="sticky top-0 z-40 border-b-[0.5px] border-hairline bg-background/70 backdrop-blur-2xl">
          <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between px-4 md:px-6">
            <Link to="/" className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-sapphire">
                Immo Radar
              </span>
              <span className="hidden text-[9px] uppercase tracking-[0.28em] text-steel sm:inline">
                · CH
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-xs md:gap-2">
              {navItems.map(({ to, label, exact }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={exact ? { exact: true } : undefined}
                  className="rounded-[3px] px-3 py-1.5 text-[11px] font-medium text-steel transition-colors hover:text-sapphire md:text-xs"
                  activeProps={{
                    className:
                      "rounded-[3px] px-3 py-1.5 text-[11px] md:text-xs font-medium text-sapphire bg-white/60 border-[0.5px] border-hairline",
                  }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-8 md:px-6 md:py-12">
          <Outlet />
        </main>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}
