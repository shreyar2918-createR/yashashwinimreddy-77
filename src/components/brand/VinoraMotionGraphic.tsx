import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";

interface VinoraMotionGraphicProps {
  activeStage?: number; // 0 to 4
  className?: string;
}

/**
 * Option A — Abstract VINORA motion graphic:
 * - Thin white lines forming a geometric V
 * - Lines slowly move and connect
 * - Subtle grayscale glow only
 * - Black background
 * - Premium and minimal
 */
export function VinoraMotionGraphic({ activeStage = 0, className }: VinoraMotionGraphicProps) {
  const [phase, setPhase] = useState(0);
  const filterId = useId();

  // Subtle continuous cinematic line oscillation
  useEffect(() => {
    let frameId: number;
    const startTime = performance.now();

    const animate = (time: number) => {
      const elapsed = (time - startTime) / 1000;
      setPhase(elapsed);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Stage-based geometry parameters:
  // 0 = IDEA (nascent points connecting)
  // 1 = STRATEGY (structural alignment)
  // 2 = DESIGN (faceted ribbon curves)
  // 3 = TECHNOLOGY (dense interconnected nodes)
  // 4 = IMPACT (complete luminous V with star pinnacle)

  // Floating micro-shift
  const wobbleX = Math.sin(phase * 0.8) * 1.5;
  const wobbleY = Math.cos(phase * 0.6) * 1.2;

  // Star pulse for activeStage 4 (or present with subtle intensity across all)
  const starOpacity = activeStage === 4 ? 0.95 + Math.sin(phase * 3) * 0.05 : 0.6;
  const lineGlow =
    activeStage === 4
      ? "drop-shadow(0 0 6px rgba(255,255,255,0.45))"
      : "drop-shadow(0 0 3px rgba(255,255,255,0.2))";

  return (
    <div
      className={cn(
        "relative flex aspect-square w-full max-w-[22rem] items-center justify-center overflow-hidden border border-ink-border bg-ink sm:max-w-[26rem]",
        className,
      )}
      style={{ filter: lineGlow }}
      aria-hidden="true"
    >
      {/* Background subtle monochrome grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* SVG Canvas for geometric V with thin animated connecting lines */}
      <svg
        viewBox="0 0 400 400"
        className="relative size-full p-6 transition-transform duration-700 ease-out"
      >
        <defs>
          <radialGradient id={`${filterId}-ambient`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Ambient grayscale halo */}
        <circle cx="200" cy="210" r="140" fill={`url(#${filterId}-ambient)`} />

        {/* Outer alignment guidelines (thin monochrome architectural lines) */}
        <line
          x1="60"
          y1="200"
          x2="340"
          y2="200"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.75"
          strokeDasharray="4 6"
        />
        <line
          x1="200"
          y1="60"
          x2="200"
          y2="340"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.75"
          strokeDasharray="4 6"
        />

        {/* Dynamic connecting diagonal guidelines for the V */}
        <line
          x1="110"
          y1="100"
          x2="200"
          y2="310"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="0.75"
        />
        <line
          x1="290"
          y1="100"
          x2="200"
          y2="310"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="0.75"
        />

        {/* STAGE-SPECIFIC CONNECTING WEBS */}
        {/* Left wing outer ribbon: sweeping bezier line */}
        <path
          d={`M ${110 + wobbleX} 105 C ${130} ${110}, ${175 + wobbleX * 0.5} ${240}, 200 310`}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.25"
          className="transition-all duration-700"
          strokeOpacity={activeStage >= 0 ? 0.9 : 0.4}
        />

        {/* Left wing inner ribbon */}
        <path
          d={`M ${135 + wobbleX * 0.8} 105 C ${150} ${120}, ${185} ${220}, 200 270`}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.1"
          strokeDasharray={activeStage === 0 ? "4 3" : "none"}
          className="transition-all duration-700"
          strokeOpacity={activeStage >= 1 ? 0.85 : 0.45}
        />

        {/* Right wing outer ribbon */}
        <path
          d={`M 200 310 C ${215} ${240}, ${265 + wobbleX * 0.5} ${130}, ${285 + wobbleX} 105`}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.25"
          className="transition-all duration-700"
          strokeOpacity={activeStage >= 2 ? 0.9 : 0.45}
        />

        {/* Right wing inner ribbon */}
        <path
          d={`M 200 270 C ${210} ${220}, ${245} ${130}, ${265 + wobbleX * 0.6} 105`}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.1"
          strokeDasharray={activeStage <= 2 ? "3 3" : "none"}
          className="transition-all duration-700"
          strokeOpacity={activeStage >= 3 ? 0.85 : 0.4}
        />

        {/* Lower diamond / nib facet at the bottom point */}
        <polygon
          points={`200,250 ${188 - wobbleX * 0.3},280 200,312 ${212 + wobbleX * 0.3},280`}
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.2"
          strokeOpacity={0.8}
        />
        <line
          x1="200"
          y1="250"
          x2="200"
          y2="312"
          stroke="#ffffff"
          strokeWidth="0.75"
          strokeOpacity={0.6}
        />

        {/* Floating cross-connecting nodes that pulse and shift per stage */}
        <line
          x1={110 + wobbleX}
          y1="105"
          x2={135 + wobbleX * 0.8}
          y2="105"
          stroke="#ffffff"
          strokeWidth="1"
          strokeOpacity={0.7}
        />
        <line
          x1={265 + wobbleX * 0.6}
          y1="105"
          x2={285 + wobbleX}
          y2="105"
          stroke="#ffffff"
          strokeWidth="1"
          strokeOpacity={0.7}
        />

        {/* Horizontal bridging connections that form based on active stage */}
        {activeStage >= 1 && (
          <line
            x1="150"
            y1="170"
            x2="250"
            y2="170"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.8"
            strokeDasharray="2 4"
            className="animate-pulse"
          />
        )}
        {activeStage >= 2 && (
          <line
            x1="170"
            y1="220"
            x2="230"
            y2="220"
            stroke="rgba(255,255,255,0.4)"
            strokeWidth="0.8"
          />
        )}

        {/* Subtle coordinate nodes (small white dots) */}
        <circle cx={110 + wobbleX} cy="105" r="2.5" fill="#ffffff" />
        <circle cx={135 + wobbleX * 0.8} cy="105" r="2" fill="#ffffff" />
        <circle cx="200" cy="310" r="3" fill="#ffffff" />
        <circle cx={265 + wobbleX * 0.6} cy="105" r="2" fill="#ffffff" />
        <circle cx={285 + wobbleX} cy="105" r="2.5" fill="#ffffff" />

        {/* Pinnacle Star on upper right tip: 4-pointed sparkle */}
        <g
          transform={`translate(${285 + wobbleX}, 105)`}
          opacity={starOpacity}
          className="transition-opacity duration-500"
        >
          {/* Vertical diamond ray */}
          <polygon points="0,-14 2.5,-3 14,0 2.5,3 0,14 -2.5,3 -14,0 -2.5,-3" fill="#ffffff" />
          {/* Core glow */}
          <circle cx="0" cy="0" r="2" fill="#ffffff" />
        </g>

        {/* Stage label at bottom */}
        <text
          x="200"
          y="350"
          textAnchor="middle"
          fill="rgba(255,255,255,0.45)"
          fontSize="9"
          letterSpacing="0.25em"
          fontFamily="monospace"
        >
          {[
            "PHASE 01 // CONVERGENCE",
            "PHASE 02 // STRUCTURE",
            "PHASE 03 // FORM",
            "PHASE 04 // LOGIC",
            "PHASE 05 // DELIVERED",
          ][activeStage] ?? "VINORA ARCHITECTURE"}
        </text>
      </svg>
    </div>
  );
}
