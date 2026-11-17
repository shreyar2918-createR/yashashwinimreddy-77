import { useEffect, useRef, useState, type ElementType } from "react";

import { cn } from "@/lib/utils";

/**
 * Staggered word reveal. Each word rises out of a clipping mask.
 * Respects prefers-reduced-motion (renders instantly).
 */
export function SplitText({
  text,
  as: Tag = "span",
  className,
  wordClassName,
  delay = 0,
  stagger = 60,
  start = "view",
}: {
  text: string;
  as?: ElementType;
  className?: string | undefined;
  wordClassName?: string | undefined;
  delay?: number | undefined;
  stagger?: number | undefined;
  /** "view" waits for scroll into view, "mount" plays immediately. */
  start?: "view" | "mount" | undefined;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return;
    }
    if (start === "mount") {
      const id = window.setTimeout(() => setShown(true), 20);
      return () => window.clearTimeout(id);
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [start]);

  const words = text.split(" ");

  return (
    <Tag ref={ref as never} className={cn("block", className)}>
      {words.map((word, i) => (
        <span key={`${word}-${i}`} className="inline-block overflow-hidden align-bottom">
          <span
            style={{ transitionDelay: `${delay + i * stagger}ms` }}
            className={cn(
              "inline-block will-change-transform transition-[transform,opacity] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
              shown ? "translate-y-0 opacity-100" : "translate-y-[110%] opacity-0",
              wordClassName,
            )}
          >
            {word}
          </span>
          {i < words.length - 1 ? <span>&nbsp;</span> : null}
        </span>
      ))}
    </Tag>
  );
}
