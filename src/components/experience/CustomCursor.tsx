import { useEffect, useRef, useState } from "react";

/**
 * Desktop-only cursor glow. Disabled on touch devices and for reduced motion.
 * Never hides the native cursor — it only adds a soft trailing halo.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEnabled(fine && !reduced);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const el = dotRef.current;
    if (!el) return;

    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let cx = x;
    let cy = y;
    let raf = 0;

    const move = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      const t = e.target as HTMLElement | null;
      const interactive = t?.closest(
        "a,button,[role='button'],input,select,textarea,[data-cursor]",
      );
      el.dataset["active"] = interactive ? "true" : "false";
    };

    const loop = () => {
      cx += (x - cx) * 0.16;
      cy += (y - cy) * 0.16;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0) translate(-50%, -50%)`;
      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", move, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("mousemove", move);
      cancelAnimationFrame(raf);
    };
  }, [enabled]);

  if (!enabled) return null;
  return <div ref={dotRef} aria-hidden className="cursor-halo" />;
}
