import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowRight, ArrowDown, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatementSlide {
  phase: string;
  statement: string;
  lead: string;
  descriptor: string;
  meta: string;
}

const STATEMENTS: StatementSlide[] = [
  {
    phase: "PHASE 01 // INITIATIVE",
    statement: "YOU BRING THE VISION.",
    lead: "Every meaningful venture begins with a clear intention.",
    descriptor:
      "Your ambition, domain expertise, and user requirements. You supply the purpose and the conviction of what must exist.",
    meta: "INPUT: AMBITION & SCOPE",
  },
  {
    phase: "PHASE 02 // ARCHITECTURE",
    statement: "WE BUILD THE PATH.",
    lead: "Translating intention into disciplined execution.",
    descriptor:
      "Modern engineering, resilient design systems, and verified delivery milestones. We engineer the path from strategy to scalable code.",
    meta: "PROCESS: SPECIFICATION & BUILD",
  },
  {
    phase: "PHASE 03 // OUTCOME",
    statement: "TOGETHER, WE CREATE IMPACT.",
    lead: "Delivered reality that scales and endures.",
    descriptor:
      "Production systems, digital products, and brand experiences launched into the real world to achieve measurable results.",
    meta: "RESULT: SHIPPED IMPACT",
  },
];

interface VinoraVisionSliderProps {
  id?: string;
  className?: string;
}

export function VinoraVisionSlider({ id = "vinora-vision", className }: VinoraVisionSliderProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const totalSlides = STATEMENTS.length;
  const current = STATEMENTS[currentSlide]!;

  const goToNext = useCallback(() => {
    if (currentSlide < totalSlides - 1) {
      setDirection("next");
      setCurrentSlide((prev) => prev + 1);
    } else {
      // After third statement, smoothly continue to next section
      const solutionsSection =
        document.getElementById("solutions-section") || document.getElementById("solutions");
      if (solutionsSection) {
        solutionsSection.scrollIntoView({ behavior: "smooth" });
      } else {
        // Fallback: cycle back to start
        setDirection("next");
        setCurrentSlide(0);
      }
    }
  }, [currentSlide, totalSlides]);

  const goToPrev = useCallback(() => {
    if (currentSlide > 0) {
      setDirection("prev");
      setCurrentSlide((prev) => prev - 1);
    }
  }, [currentSlide]);

  const goToSlide = (idx: number) => {
    if (idx === currentSlide) return;
    setDirection(idx > currentSlide ? "next" : "prev");
    setCurrentSlide(idx);
  };

  // Keyboard navigation when section is in view / focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only react if within container or section is active
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) return;

      if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev]);

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;

    // Horizontal swipe threshold: 35px, and more horizontal than vertical
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <section
      id={id}
      ref={containerRef}
      className={cn(
        "relative overflow-hidden bg-ink px-5 py-10 text-ink-foreground sm:px-8 sm:py-14",
        className,
      )}
      aria-label="The VINORA Vision Slider"
    >
      {/* Subtle monochrome coordinate grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl">
        {/* Section Header: Title & Minimal Stage Navigation */}
        <div className="flex flex-col gap-4 border-b border-ink-border/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="size-1.5 rounded-full bg-white shadow-xs" />
            <h2 className="eyebrow text-xs font-semibold tracking-[0.22em] text-white uppercase sm:text-xs">
              THE VINORA VISION
            </h2>
          </div>

          {/* Minimal 3-step slide indicator */}
          <div
            className="flex items-center gap-2"
            role="tablist"
            aria-label="Vision Statement slides"
          >
            {STATEMENTS.map((s, idx) => {
              const isActive = idx === currentSlide;
              const isPast = idx < currentSlide;
              return (
                <button
                  key={s.phase}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={(e) => {
                    e.stopPropagation();
                    goToSlide(idx);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 text-[0.6875rem] font-mono tracking-wider transition-all duration-200 cursor-pointer select-none",
                    isActive
                      ? "border border-white bg-white text-ink font-bold"
                      : isPast
                        ? "border border-ink-border bg-ink-foreground/10 text-white hover:border-white/60"
                        : "border border-ink-border text-ink-muted hover:border-ink-foreground/40 hover:text-white",
                  )}
                  aria-label={`Slide ${idx + 1}: ${s.statement}`}
                >
                  <span>0{idx + 1}</span>
                  <span className="hidden sm:inline">
                    {idx === 0 ? "VISION" : idx === 1 ? "PATH" : "IMPACT"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Editorial Slide Area */}
        <div
          onClick={goToNext}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={cn(
            "group relative mt-5 min-h-[290px] sm:min-h-[310px] lg:min-h-[330px] cursor-pointer select-none border border-ink-border p-6 transition-all duration-300 sm:p-9 lg:p-11",
            currentSlide === 0 && "bg-ink hover:border-white/40",
            currentSlide === 1 && "border-zinc-700 bg-zinc-950/90 hover:border-white/50",
            currentSlide === 2 &&
              "border-white/60 bg-zinc-950 shadow-[inset_0_0_80px_rgba(255,255,255,0.03)] hover:border-white",
          )}
          role="region"
          aria-live="polite"
          aria-label="Interactive statement card. Tap or swipe to advance."
        >
          {/* Animated Slide Content */}
          <div
            key={`slide-${currentSlide}`}
            className={cn(
              "flex h-full flex-col justify-between",
              direction === "next" ? "animate-vision-right" : "animate-vision-left",
            )}
          >
            {/* Top metadata line */}
            <div className="flex items-center justify-between border-b border-ink-border/50 pb-3 text-[0.6875rem] font-mono uppercase tracking-widest text-ink-muted">
              <span>{current.phase}</span>
              <span className="hidden sm:inline text-ink-foreground/80">{current.meta}</span>
              <span className="sm:hidden text-ink-foreground/80">{`0${currentSlide + 1} / 03`}</span>
            </div>

            {/* Main Statement Typography */}
            <div className="my-6 sm:my-8">
              <h3 className="font-display text-3xl font-medium tracking-tight text-white sm:text-5xl lg:text-6xl uppercase leading-[1.08]">
                {current.statement}
              </h3>

              <p className="mt-3 text-sm font-medium text-ink-foreground/90 sm:text-base lg:text-lg max-w-2xl">
                {current.lead}
              </p>

              <p className="mt-2 text-xs leading-relaxed text-ink-muted sm:text-sm max-w-xl">
                {current.descriptor}
              </p>
            </div>

            {/* Bottom Interaction & Controls Bar */}
            <div className="flex items-center justify-between border-t border-ink-border/50 pt-4 text-xs font-mono">
              {/* Subtle tap/swipe instruction */}
              <div className="flex items-center gap-2 text-[0.6875rem] tracking-wider text-ink-muted uppercase">
                <span className="size-1 rounded-full bg-white/60 animate-pulse" />
                <span>
                  {currentSlide < 2
                    ? "TAP CARD OR SWIPE TO ADVANCE"
                    : "FINAL STATEMENT // READY TO BUILD"}
                </span>
              </div>

              {/* Action trigger */}
              <div className="flex items-center gap-3">
                {currentSlide === 2 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToSlide(0);
                      }}
                      className="inline-flex items-center gap-1.5 border border-ink-border px-3 py-1.5 text-[0.6875rem] tracking-widest text-ink-muted uppercase transition-colors hover:border-white hover:text-white"
                      title="Replay Vision Statement"
                    >
                      <RotateCcw className="size-3" />
                      <span>REPLAY</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const target =
                          document.getElementById("solutions-section") ||
                          document.getElementById("solutions");
                        if (target) {
                          target.scrollIntoView({ behavior: "smooth" });
                        }
                      }}
                      className="inline-flex items-center gap-1.5 border border-white bg-white px-3.5 py-1.5 text-[0.6875rem] font-semibold tracking-widest text-ink uppercase transition-colors hover:bg-zinc-200"
                    >
                      <span>SOLUTIONS</span>
                      <ArrowDown className="size-3" />
                    </button>
                  </div>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[0.6875rem] tracking-widest text-white transition-transform group-hover:translate-x-1">
                    <span>NEXT STATEMENT</span>
                    <ArrowRight className="size-3.5" />
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Seamless bottom transition hair divider */}
        <div className="mt-8 h-px w-full bg-ink-border" aria-hidden="true" />
      </div>
    </section>
  );
}
