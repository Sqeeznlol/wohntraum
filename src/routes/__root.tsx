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
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Seite nicht gefunden</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Diese Seite existiert nicht.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
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
      { title: "Immobilien-Dashboard Schweiz" },
      {
        name: "description",
        content:
          "Aggregiert Suchabo-Mails von ImmoScout24, Homegate, Flatfox & Co. und berechnet automatisch CHF/m².",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "stylesheet", href: leafletCss },
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
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
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
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
            <Link to="/" className="text-lg font-semibold">
              🏡 Immo-Dashboard CH
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link
                to="/"
                className="text-muted-foreground hover:text-foreground"
                activeProps={{ className: "text-foreground font-medium" }}
                activeOptions={{ exact: true }}
              >
                Inserate
              </Link>
              <Link
                to="/map"
                className="text-muted-foreground hover:text-foreground"
                activeProps={{ className: "text-foreground font-medium" }}
              >
                Karte
              </Link>
              <Link
                to="/alerts"
                className="text-muted-foreground hover:text-foreground"
                activeProps={{ className: "text-foreground font-medium" }}
              >
                Alerts
              </Link>
              <Link
                to="/onboarding"
                className="text-muted-foreground hover:text-foreground"
                activeProps={{ className: "text-foreground font-medium" }}
              >
                Setup
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </main>
        <Toaster />
      </div>
    </QueryClientProvider>
  );
}
