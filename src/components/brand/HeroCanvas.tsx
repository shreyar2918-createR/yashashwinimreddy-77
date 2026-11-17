import { useEffect, useRef, useState } from "react";

/**
 * VINORA hero background.
 *
 * A cinematic flow-field particle animation over a slowly drifting
 * monochrome aurora, rendered on a 2D canvas (cheap, no WebGL context cost).
 * Particles use a restrained grayscale range and leave short glowing trails.
 *
 * Degrades gracefully:
 *  - prefers-reduced-motion -> static gradient only
 *  - mobile                 -> fewer particles, 30fps budget
 *  - tab hidden             -> animation paused
 */
export function HeroCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(!window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!animate) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let running = true;
    let mobile = false;

    type P = { x: number; y: number; vx: number; vy: number; r: number; h: number };
    let particles: P[] = [];

    const seed = () => {
      mobile = width < 768;
      const density = mobile ? 11000 : 5200;
      const count = Math.min(
        mobile ? 45 : 190,
        Math.max(24, Math.round((width * height) / density)),
      );
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: 0,
        vy: 0,
        r: Math.random() * 1.5 + 0.4,
        h: Math.random(),
      }));
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      width = rect.width;
      height = rect.height;
      if (width === 0 || height === 0) return;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let t = 0;
    let last = 0;

    const field = (x: number, y: number, time: number) =>
      Math.sin(x * 0.0022 + time) * 1.15 +
      Math.cos(y * 0.0027 - time * 0.8) * 1.15 +
      Math.sin((x + y) * 0.0013 + time * 0.5);

    const draw = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(draw);
      const frameBudget = mobile ? 1000 / 30 : 1000 / 60;
      if (now - last < frameBudget) return;
      last = now;
      t += 0.0018;

      // Trail fade instead of hard clear -> silky motion streaks
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.09)";
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "lighter";

      // Slow glowing wave field
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const phase = t * 12 + i * 1.7;
        for (let x = 0; x <= width; x += 12) {
          const y =
            height * (0.42 + i * 0.13) +
            Math.sin(x * 0.0035 + phase) * (26 + i * 14) +
            Math.cos(x * 0.0012 - phase * 0.6) * 22;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 - i * 0.02})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      for (const p of particles) {
        const a = field(p.x, p.y, t);
        p.vx = p.vx * 0.94 + Math.cos(a) * 0.18;
        p.vy = p.vy * 0.94 + Math.sin(a) * 0.18;
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < -20) p.x = width + 20;
        if (p.x > width + 20) p.x = -20;
        if (p.y < -20) p.y = height + 20;
        if (p.y > height + 20) p.y = -20;

        const alpha = 0.28 + p.r * 0.24;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(0, 0%, ${58 + p.h * 34}%, ${alpha})`;
        ctx.fill();
      }
      ctx.globalCompositeOperation = "source-over";
    };

    raf = requestAnimationFrame(draw);

    const onVisibility = () => {
      running = document.visibilityState === "visible";
      if (running) {
        last = 0;
        raf = requestAnimationFrame(draw);
      } else {
        cancelAnimationFrame(raf);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [animate]);

  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden
    >
      {/* Animated gradient mesh base — also the full fallback when motion is off */}
      <div className="hero-aurora absolute inset-0" />
      {animate ? (
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-90" />
      ) : null}
      {/* Contrast scrim so headline text always clears WCAG AA */}
      <div className="hero-scrim absolute inset-0" />
    </div>
  );
}
