import { useEffect, useState } from "react";

import { LogoMark } from "@/components/brand/Logo";

const KEY = "vinora:intro-played";

/**
 * Short cinematic intro. Plays once per browser session, is skipped entirely
 * for reduced-motion users, and never blocks interaction for more than ~1.6s.
 */
export function IntroCurtain() {
  const [phase, setPhase] = useState<"idle" | "playing" | "leaving" | "done">("idle");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let played = false;
    try {
      played = sessionStorage.getItem(KEY) === "1";
    } catch {
      played = false;
    }
    if (played) return;
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    setPhase("playing");
    document.documentElement.style.overflow = "hidden";
    const leave = window.setTimeout(() => setPhase("leaving"), 1500);
    const done = window.setTimeout(() => {
      setPhase("done");
      document.documentElement.style.overflow = "";
    }, 2200);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
      document.documentElement.style.overflow = "";
    };
  }, []);

  if (phase === "idle" || phase === "done") return null;

  return (
    <div
      aria-hidden
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-ink transition-[opacity,clip-path] duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] ${
        phase === "leaving"
          ? "pointer-events-none opacity-0 [clip-path:inset(0_0_100%_0)]"
          : "opacity-100 [clip-path:inset(0_0_0_0)]"
      }`}
    >
      <div className="hero-aurora absolute inset-0 opacity-70" />
      <div className="intro-sweep absolute inset-0" />
      <div className="relative flex flex-col items-center">
        <LogoMark className="intro-pop size-14" />
        <p className="intro-word mt-6 font-display text-2xl tracking-[0.5em] text-ink-foreground uppercase sm:text-3xl">
          Vinora
        </p>
        <p className="intro-word-2 mt-4 text-[0.6rem] tracking-[0.35em] text-ink-foreground/60 uppercase sm:text-xs">
          Ideas today. Impact tomorrow.
        </p>
      </div>
    </div>
  );
}
