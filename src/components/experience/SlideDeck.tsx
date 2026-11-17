import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SlideItem {
  eyebrow?: string;
  title: string;
  copy: string;
  content?: ReactNode;
}

/**
 * Compact, interactive slide deck.
 * Supports:
 * - Whole-card tap/click to advance
 * - Keyboard left / right arrow navigation
 * - Touch swipe left / right on mobile
 * - Immediate state update with smooth horizontal slide & subtle fade
 * - Minimal circular pagination and interaction indicator
 */
export function SlideDeck({
  items,
  dark = false,
  className,
  activeIndex,
  onActiveChange,
}: {
  items: SlideItem[];
  dark?: boolean;
  className?: string;
  activeIndex?: number;
  onActiveChange?: (index: number) => void;
}) {
  const count = items.length;
  const [internalActive, setInternalActive] = useState(0);
  const active = activeIndex !== undefined ? activeIndex : internalActive;
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const updateActive = useCallback(
    (index: number, dir: "next" | "prev") => {
      setDirection(dir);
      if (onActiveChange) {
        onActiveChange(index);
      }
      setInternalActive(index);
    },
    [onActiveChange],
  );

  // Touch tracking for mobile swipe
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const goToNext = useCallback(() => {
    if (count <= 1) return;
    const nextIdx = (active + 1) % count;
    updateActive(nextIdx, "next");
  }, [active, count, updateActive]);

  const goToPrev = useCallback(() => {
    if (count <= 1) return;
    const prevIdx = (active - 1 + count) % count;
    updateActive(prevIdx, "prev");
  }, [active, count, updateActive]);

  // Keyboard navigation on element focus
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      }
    },
    [goToNext, goToPrev],
  );

  // Global window arrow key navigation when this deck is in viewport
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inViewport =
        rect.top < window.innerHeight * 0.85 && rect.bottom > window.innerHeight * 0.15;
      if (!inViewport) return;

      if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [goToNext, goToPrev]);

  // Touch swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (!touch) return;
    touchStartX.current = touch.clientX;
    touchStartY.current = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const touch = e.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - touchStartX.current;
    const deltaY = touch.clientY - touchStartY.current;

    // Detect horizontal swipe (must exceed vertical movement)
    if (Math.abs(deltaX) > 36 && Math.abs(deltaX) > Math.abs(deltaY) * 1.1) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  if (count === 0) return null;
  const current = items[active];
  if (!current) return null;

  return (
    <div
      ref={containerRef}
      className={cn("relative my-4 w-full select-none", className)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Interactive presentation"
    >
      <div
        tabIndex={0}
        onClick={goToNext}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "group relative flex flex-col justify-between overflow-hidden border border-current/15 cursor-pointer transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-current/40",
          dark ? "bg-ink text-ink-foreground" : "bg-background text-foreground",
        )}
        aria-label={`Slide ${active + 1} of ${count}: ${current.title}`}
      >
        {/* Active slide content with horizontal slide & subtle fade */}
        <div
          key={active}
          className={cn(
            "grid min-h-[16rem] gap-6 p-6 sm:min-h-[19rem] sm:p-8 lg:min-h-[20rem] lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center",
            direction === "next" ? "animate-slide-in-right" : "animate-slide-in-left",
          )}
        >
          <div className="flex flex-col justify-center">
            {current.eyebrow ? (
              <p
                className={cn(
                  "eyebrow text-xs font-semibold tracking-[0.2em] uppercase",
                  dark ? "text-ink-muted" : "text-foreground/75",
                )}
              >
                {current.eyebrow}
              </p>
            ) : null}
            <h3 className="mt-3 font-display text-2xl font-medium tracking-tight leading-[1.08] sm:text-4xl lg:text-5xl">
              {current.title}
            </h3>
            <p
              className={cn(
                "mt-4 max-w-xl text-sm leading-relaxed sm:text-base",
                dark ? "text-ink-muted" : "text-foreground/80",
              )}
            >
              {current.copy}
            </p>
          </div>

          {current.content ? (
            <div className="flex items-center justify-center lg:justify-end">
              <div className="w-full max-w-xs sm:max-w-sm">{current.content}</div>
            </div>
          ) : null}
        </div>

        {/* Thin divider line */}
        <div className="h-px w-full bg-current/15" aria-hidden="true" />

        {/* Minimal interaction bar: circular indicators & subtle navigation controls */}
        <div className="flex items-center justify-between px-6 py-3 sm:px-8">
          {/* Subtle circular indicators */}
          <div
            className="flex items-center gap-2"
            role="tablist"
            aria-label="Slide dots"
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === active}
                aria-label={`Slide ${i + 1}`}
                onClick={(e) => {
                  e.stopPropagation();
                  updateActive(i, i >= active ? "next" : "prev");
                }}
                className={cn(
                  "rounded-full transition-all duration-300 cursor-pointer",
                  i === active
                    ? "size-2.5 bg-current scale-110"
                    : "size-1.5 bg-current/30 hover:bg-current/60",
                )}
              />
            ))}
          </div>

          {/* Minimal arrow controls without instruction text */}
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={(e) => {
                e.stopPropagation();
                goToPrev();
              }}
              className="flex size-7 items-center justify-center rounded-full border border-current/20 hover:border-current/60 hover:bg-current/5 transition-all cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              className="flex size-7 items-center justify-center rounded-full border border-current/20 hover:border-current/60 hover:bg-current/5 transition-all cursor-pointer"
            >
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
