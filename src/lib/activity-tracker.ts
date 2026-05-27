/**
 * Lightweight client-side activity tracker.
 *
 * - Buffers events and flushes via sendBeacon (or fetch) every few seconds
 *   and on page hide.
 * - Auto-tracks: page views, clicks on buttons/links, scroll depth milestones,
 *   page view duration.
 * - Manual usage: trackEvent("listing_view", { listing_id, label: "Foo" })
 */

export type TrackedEvent = {
  event_type: string;
  event_label?: string | null;
  path?: string | null;
  listing_id?: string | null;
  target_id?: string | null;
  duration_ms?: number | null;
  metadata?: Record<string, unknown> | null;
  session_id?: string | null;
  ts?: number;
};

const SESSION_KEY = "wt_session_id";
const ENDPOINT = "/api/track-activity";
const FLUSH_INTERVAL_MS = 4000;
const MAX_BUFFER = 30;

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        (crypto.randomUUID && crypto.randomUUID()) ||
        Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

const buffer: TrackedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let initialized = false;

function flush(useBeacon = false) {
  if (typeof window === "undefined" || buffer.length === 0) return;
  const events = buffer.splice(0, buffer.length);
  const payload = JSON.stringify({ events });
  try {
    if (useBeacon && "sendBeacon" in navigator) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(ENDPOINT, blob);
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush(false);
  }, FLUSH_INTERVAL_MS);
}

/** Public API — track an event */
export function trackEvent(
  event_type: string,
  data: Omit<TrackedEvent, "event_type" | "session_id" | "ts" | "path"> & {
    path?: string;
  } = {},
) {
  if (typeof window === "undefined") return;
  buffer.push({
    event_type,
    event_label: data.event_label ?? null,
    path: data.path ?? window.location.pathname,
    listing_id: data.listing_id ?? null,
    target_id: data.target_id ?? null,
    duration_ms: data.duration_ms ?? null,
    metadata: data.metadata ?? null,
    session_id: getSessionId(),
    ts: Date.now(),
  });
  if (buffer.length >= MAX_BUFFER) {
    flush(false);
  } else {
    scheduleFlush();
  }
}

// ============== Auto-tracking ==============
let currentPath = "";
let pageEnterTs = 0;
let maxScrollDepth = 0;

function emitPageView(path: string) {
  trackEvent("page_view", {
    path,
    event_label: document.title,
    metadata: {
      referrer: document.referrer || null,
      vw: window.innerWidth,
      vh: window.innerHeight,
    },
  });
}

function emitPageLeave() {
  if (!currentPath || !pageEnterTs) return;
  const duration = Date.now() - pageEnterTs;
  trackEvent("page_leave", {
    path: currentPath,
    duration_ms: duration,
    metadata: { max_scroll_depth: maxScrollDepth },
  });
}

function handleRouteChange() {
  const newPath = window.location.pathname;
  if (newPath === currentPath) return;
  emitPageLeave();
  currentPath = newPath;
  pageEnterTs = Date.now();
  maxScrollDepth = 0;
  emitPageView(newPath);
}

function handleClick(ev: MouseEvent) {
  const target = ev.target as HTMLElement | null;
  if (!target) return;
  const el = target.closest(
    "button, a, [data-track], [role='button']",
  ) as HTMLElement | null;
  if (!el) return;

  const tag = el.tagName.toLowerCase();
  const trackName = el.getAttribute("data-track");
  const label =
    trackName ||
    el.getAttribute("aria-label") ||
    (el.textContent || "").trim().slice(0, 120) ||
    el.getAttribute("title") ||
    el.id ||
    tag;

  // Detect listing card / link to listing
  let listingId: string | null = null;
  const listingLink = el.closest("[data-listing-id]") as HTMLElement | null;
  if (listingLink) listingId = listingLink.getAttribute("data-listing-id");
  if (!listingId && tag === "a") {
    const href = (el as HTMLAnchorElement).getAttribute("href") || "";
    const m = href.match(
      /\/listings\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i,
    );
    if (m) listingId = m[1];
  }

  const eventType =
    tag === "a" ? "link_click" : tag === "button" ? "button_click" : "click";

  trackEvent(eventType, {
    event_label: label.slice(0, 200),
    target_id: el.id || null,
    listing_id: listingId,
    metadata: {
      tag,
      href: tag === "a" ? (el as HTMLAnchorElement).href : null,
    },
  });
}

function handleScroll() {
  if (typeof window === "undefined") return;
  const scrolled = window.scrollY + window.innerHeight;
  const total = document.documentElement.scrollHeight || 1;
  const depth = Math.min(100, Math.round((scrolled / total) * 100));
  if (depth > maxScrollDepth) maxScrollDepth = depth;
}

let inputDebounce: ReturnType<typeof setTimeout> | null = null;
function handleInput(ev: Event) {
  const t = ev.target as HTMLElement | null;
  if (!t) return;
  if (
    !(
      t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.getAttribute("contenteditable") === "true"
    )
  )
    return;
  // Skip secret/password fields
  const inputType = (t as HTMLInputElement).type;
  if (inputType === "password") return;

  if (inputDebounce) clearTimeout(inputDebounce);
  inputDebounce = setTimeout(() => {
    const fieldName =
      (t as HTMLInputElement).name ||
      t.getAttribute("aria-label") ||
      t.getAttribute("placeholder") ||
      t.id ||
      "field";
    const value = (t as HTMLInputElement).value || t.textContent || "";
    trackEvent("input_change", {
      event_label: fieldName.slice(0, 120),
      target_id: t.id || null,
      metadata: {
        type: inputType || t.tagName.toLowerCase(),
        length: value.length,
        // Don't store values longer than 200 chars; never store password
        value: value.length <= 200 ? value : `${value.slice(0, 200)}…`,
      },
    });
  }, 800);
}

/** Initialize once at app boot */
export function initActivityTracker() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  currentPath = window.location.pathname;
  pageEnterTs = Date.now();
  emitPageView(currentPath);

  // Listen to clicks (capture so we catch even stopped events)
  document.addEventListener("click", handleClick, true);
  document.addEventListener("input", handleInput, true);
  window.addEventListener("scroll", handleScroll, { passive: true });

  // SPA navigation detection — patch pushState/replaceState
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    const r = origPush.apply(this, args);
    setTimeout(handleRouteChange, 0);
    return r;
  };
  history.replaceState = function (...args) {
    const r = origReplace.apply(this, args);
    setTimeout(handleRouteChange, 0);
    return r;
  };
  window.addEventListener("popstate", handleRouteChange);

  // Flush on hide / unload
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      emitPageLeave();
      flush(true);
    }
  });
  window.addEventListener("pagehide", () => {
    emitPageLeave();
    flush(true);
  });
}
