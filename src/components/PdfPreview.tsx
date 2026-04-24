import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

// pdf.js v4 - load worker via Vite ?url import (CDN-free, bundled)
import * as pdfjsLib from "pdfjs-dist";
// @ts-expect-error - vite worker url import
import pdfjsWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|od|ad)/.test(navigator.userAgent) ||
    // iPad on iOS 13+ reports MacIntel + touch
    (navigator.platform === "MacIntel" && (navigator as any).maxTouchPoints > 1)
  );
}

function isMobile() {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iP(hone|od|ad)/.test(navigator.userAgent);
}

/**
 * Scroll-friendly PDF preview.
 * - Desktop & Android Chrome: native <iframe> (fast, supports search/zoom).
 * - iOS Safari / mobile: renders pages as <canvas> images so the user can
 *   scroll naturally with momentum scrolling instead of being trapped in
 *   the broken in-iframe PDF viewer.
 */
export function PdfPreview({
  src,
  fileName,
  className = "",
}: {
  src: string;
  fileName?: string;
  className?: string;
}) {
  const [useCanvas, setUseCanvas] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setUseCanvas(isIOS() || isMobile());
  }, []);

  useEffect(() => {
    if (!useCanvas) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPages([]);

    (async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: src });
        const pdf = await loadingTask.promise;
        const containerWidth =
          containerRef.current?.clientWidth ?? window.innerWidth - 32;
        // Render at 1.5x device pixel ratio for crispness, capped
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const rendered: string[] = [];
        const maxPages = Math.min(pdf.numPages, 30); // safety cap
        for (let p = 1; p <= maxPages; p++) {
          if (cancelled) return;
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: 1 });
          const scale = (containerWidth / viewport.width) * dpr;
          const scaled = page.getViewport({ scale });

          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(scaled.width);
          canvas.height = Math.floor(scaled.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          await page.render({ canvasContext: ctx, viewport: scaled, canvas })
            .promise;
          rendered.push(canvas.toDataURL("image/jpeg", 0.85));
          if (!cancelled) setPages([...rendered]);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "PDF konnte nicht geladen werden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, useCanvas]);

  if (!useCanvas) {
    return (
      <iframe
        src={`${src}#view=FitH`}
        className={className}
        title={fileName ?? "PDF"}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`overflow-y-auto bg-muted/40 ${className}`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {loading && pages.length === 0 && (
        <div className="flex h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> PDF wird geladen…
        </div>
      )}
      {error && (
        <div className="space-y-2 p-4 text-sm">
          <p className="text-destructive">{error}</p>
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            PDF in neuem Tab öffnen
          </a>
        </div>
      )}
      <div className="space-y-2 p-2">
        {pages.map((dataUrl, i) => (
          <img
            key={i}
            src={dataUrl}
            alt={`Seite ${i + 1}`}
            className="w-full rounded border bg-white shadow-sm"
            loading="lazy"
          />
        ))}
        {loading && pages.length > 0 && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Weitere Seiten…
          </div>
        )}
      </div>
    </div>
  );
}
