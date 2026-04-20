import { Link, Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";

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
      { title: "Immo Radar — Schweizer Immobilien-Übersicht" },
      {
        name: "description",
        content:
          "Aggregiert Suchabo-Mails von ImmoScout24, Homegate, Flatfox & Co. mit automatischer CHF/m²-Analyse.",
      },
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

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
            <Link to="/" className="flex items-baseline gap-2">
              <span className="font-serif-display text-2xl">Immo Radar</span>
              <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Schweiz
              </span>
            </Link>
            <nav className="flex items-center gap-7 text-sm">
              {navItems.map(({ to, label, exact }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={exact ? { exact: true } : undefined}
                  className="relative py-1 text-muted-foreground transition-colors hover:text-foreground"
                  activeProps={{
                    className:
                      "relative py-1 text-foreground after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:bg-foreground",
                  }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-6 py-10">
          <Outlet />
        </main>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}
