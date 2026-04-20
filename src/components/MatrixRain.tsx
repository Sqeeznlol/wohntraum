import { useEffect, useRef } from "react";

/**
 * Matrix-style falling code animation rendered on a full-width canvas.
 * Used to mask backend-setup details from public visitors.
 */
export function MatrixRain({ height = 520 }: { height?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;
    let width = canvas.offsetWidth;
    let h = canvas.offsetHeight;
    const dpr = window.devicePixelRatio || 1;

    const setSize = () => {
      width = canvas.offsetWidth;
      h = canvas.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    };
    setSize();

    const fontSize = 14;
    const columns = Math.floor(width / fontSize);
    const drops: number[] = Array.from({ length: columns }, () =>
      Math.floor((Math.random() * h) / fontSize),
    );

    const chars =
      "01アイウエオカキクケコサシスセソタチツテトabcdef{};</>=>POSTGETSELECTFROMWHERE$_λ→•";

    const draw = () => {
      // translucent background → trail effect
      ctx.fillStyle = "rgba(10, 14, 12, 0.08)";
      ctx.fillRect(0, 0, width, h);

      ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars.charAt(Math.floor(Math.random() * chars.length));
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // head glyph brighter
        ctx.fillStyle = "rgba(180, 230, 200, 0.95)";
        ctx.fillText(text, x, y);

        // tail glyph dimmer green
        ctx.fillStyle = "rgba(80, 170, 120, 0.55)";
        ctx.fillText(text, x, y - fontSize);

        if (y > h && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    const onResize = () => setSize();
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-[#0a0e0c]"
      style={{ height }}
    >
      <canvas ref={canvasRef} className="block h-full w-full" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0e0c]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-black/40 px-4 py-2 font-mono text-xs text-emerald-300 backdrop-blur">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          system online · processing inbound stream
        </div>
      </div>
    </div>
  );
}
