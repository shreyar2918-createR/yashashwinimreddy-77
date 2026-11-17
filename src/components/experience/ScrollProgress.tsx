import { useEffect, useState } from "react";

/** Thin monochrome progress rail pinned to the top of the viewport. */
export function ScrollProgress() {
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const doc = document.documentElement;
        const max = doc.scrollHeight - doc.clientHeight;
        setP(max > 0 ? Math.min(1, doc.scrollTop / max) : 0);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-px">
      <div
        className="h-full origin-left bg-gradient-to-r from-foreground to-muted-foreground"
        style={{ transform: `scaleX(${p})` }}
      />
    </div>
  );
}
