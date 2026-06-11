import { Link, Outlet, createRootRoute, HeadContent, Scripts, useLocation, useRouter } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { initActivityTracker } from "@/lib/activity-tracker";
import { LoginGate } from "@/components/LoginGate";

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
      { title: "Homeseeker — Maison für Schweizer Immobilien" },
      {
        name: "description",
        content:
          "Homeseeker kuratiert hochwertige Schweizer Immobilien mit präziser Markt- und GIS-Analyse.",
      },
      { property: "og:title", content: "Homeseeker — Maison für Schweizer Immobilien" },
      { name: "twitter:title", content: "Homeseeker — Maison für Schweizer Immobilien" },
      { property: "og:description", content: "Kuratierte Schweizer Immobilien mit präziser CHF/m²- und GIS-Analyse." },
      { name: "twitter:description", content: "Kuratierte Schweizer Immobilien mit präziser CHF/m²- und GIS-Analyse." },
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
        href: "https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Inter:wght@300;400;500;600;700&display=swap",
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
      <body style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const navItems: ReadonlyArray<{
  to: "/" | "/map" | "/alerts" | "/onboarding" | "/insights" | "/archive";
  label: string;
  exact?: boolean;
}> = [
  { to: "/", label: "Inserate", exact: true },
  { to: "/map", label: "Karte" },
  { to: "/alerts", label: "Alerts" },
  { to: "/insights", label: "Tims Geschmack" },
  { to: "/archive", label: "Archiv" },
  { to: "/onboarding", label: "Setup" },
];

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

function MobileRedirect() {
  const router = useRouter();
  const location = useLocation();
  useEffect(() => {
    if (isMobileDevice() && location.pathname === "/") {
      router.navigate({ to: "/swipe" });
    }
  }, [location.pathname, router]);
  return null;
}

function VisitTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const isAdmin = window.location.pathname.startsWith("/admin");
    if (isAdmin) return;
    fetch("/api/track-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: window.location.pathname,
        referrer: document.referrer || null,
        language: navigator.language || null,
      }),
    }).catch(() => {});
    initActivityTracker();
  }, []);
  return null;
}

function RootComponent() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false } },
      }),
  );
  const location = useLocation();
  const isSwipe = location.pathname.startsWith("/swipe");

  if (isSwipe) {
    return (
      <QueryClientProvider client={queryClient}>
        <Outlet />
        <Toaster />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <LoginGate>
      <MobileRedirect />
      <VisitTracker />
      <div className="min-h-screen bg-background pb-[env(safe-area-inset-bottom)]">
        {/* Maison-Header — Marineblau auf Sand, Wortmarke in Serif, Gold-Akzent */}
        <header
          className="sticky top-0 z-40 border-b border-white/10"
          style={{ backgroundColor: "var(--marine)", color: "oklch(0.985 0.008 86)" }}
        >
          <div className="mx-auto grid h-16 max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 md:px-8">
            <Link to="/" className="flex min-w-0 items-center gap-3">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                style={{ background: "var(--gold)", color: "var(--marine)", fontFamily: "var(--font-serif)", fontWeight: 600 }}
              >
                H
              </span>
              <span
                className="truncate font-serif-display text-[20px] tracking-wide"
                style={{ color: "oklch(0.985 0.008 86)" }}
              >
                Homeseeker
              </span>
              <span
                className="hidden text-[9px] uppercase sm:inline"
                style={{ letterSpacing: "0.28em", color: "var(--gold)" }}
              >
                · Maison
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-xs md:gap-1">
              {navItems.map(({ to, label, exact }) => (
                <Link
                  key={to}
                  to={to}
                  activeOptions={exact ? { exact: true } : undefined}
                  className="rounded-full px-3 py-1.5 text-[11px] font-medium uppercase transition-colors hover:text-white/95"
                  style={{ letterSpacing: "0.10em", color: "color-mix(in srgb, white 70%, transparent)" }}
                  activeProps={{
                    className:
                      "rounded-full px-3 py-1.5 text-[11px] font-medium uppercase",
                    style: { letterSpacing: "0.10em", color: "var(--marine)", background: "var(--gold)" },
                  }}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>
          <div
            className="h-px w-full"
            style={{
              background:
                "linear-gradient(to right, transparent, var(--gold) 50%, transparent)",
              opacity: 0.6,
            }}
          />
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-8 md:px-6 md:py-12">
          <Outlet />
        </main>
        <Toaster />
      </div>
      </LoginGate>
    </QueryClientProvider>
  );
}
