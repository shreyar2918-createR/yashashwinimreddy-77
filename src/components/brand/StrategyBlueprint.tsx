import { useId } from "react";
import { cn } from "@/lib/utils";

interface StrategyBlueprintProps {
  className?: string;
}

export function StrategyBlueprint({ className }: StrategyBlueprintProps) {
  const filterId = useId();

  const nodes = [
    { label: "DISCOVER", phase: "01", x: 42, y: 76 },
    { label: "PLAN", phase: "02", x: 120, y: 44 },
    { label: "DESIGN", phase: "03", x: 198, y: 88 },
    { label: "BUILD", phase: "04", x: 276, y: 52 },
    { label: "LAUNCH", phase: "05", x: 354, y: 84 },
  ];

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center overflow-hidden border border-border bg-ink p-3 text-ink-foreground select-none sm:p-5",
        className,
      )}
      aria-label="Strategy Blueprint: Monochromatic execution map from Discover to Launch"
    >
      {/* Blueprint fine coordinate grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      {/* Blueprint Header / Badge */}
      <div className="pointer-events-none absolute top-3 left-4 flex items-center gap-2 text-[0.625rem] font-mono tracking-widest text-ink-muted uppercase">
        <span className="size-1.5 rounded-full bg-ink-foreground" />
        <span>STRATEGY BLUEPRINT // SYSTEM.01</span>
      </div>

      <div className="pointer-events-none absolute top-3 right-4 text-[0.625rem] font-mono tracking-wider text-ink-muted/80 uppercase">
        FLOW: 01 → 05
      </div>

      {/* SVG Blueprint Canvas */}
      <svg
        viewBox="0 0 400 140"
        className="relative h-full w-full max-h-48 overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <filter id={`${filterId}-glow`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Structural connecting baseline */}
        <line
          x1="30"
          y1="120"
          x2="370"
          y2="120"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
          strokeDasharray="2 4"
        />

        {/* Planning connecting path (Thin planning lines) */}
        <path
          d="M 42 76 L 120 44 L 198 88 L 276 52 L 354 84"
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Highlighted production execution line with glow */}
        <path
          d="M 42 76 L 120 44 L 198 88 L 276 52 L 354 84"
          fill="none"
          stroke="#ffffff"
          strokeWidth="1.75"
          filter={`url(#${filterId}-glow)`}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-95"
        />

        {/* Directional ticks on the path */}
        {[
          { x: 81, y: 60, angle: -22 },
          { x: 159, y: 66, angle: 29 },
          { x: 237, y: 70, angle: -25 },
          { x: 315, y: 68, angle: 22 },
        ].map((tick, i) => (
          <g key={i} transform={`translate(${tick.x}, ${tick.y}) rotate(${tick.angle})`}>
            <polygon points="-3,-2 2,0 -3,2" fill="#ffffff" opacity="0.8" />
          </g>
        ))}

        {/* Nodes and Stage Boxes */}
        {nodes.map((node) => {
          const isFinal = node.phase === "05";
          const isFirst = node.phase === "01";

          return (
            <g key={node.phase} className="transition-transform duration-200">
              {/* Vertical plumb guideline */}
              <line
                x1={node.x}
                y1={node.y + 16}
                x2={node.x}
                y2="120"
                stroke="rgba(255,255,255,0.15)"
                strokeWidth="0.75"
                strokeDasharray="2 2"
              />

              {/* Node box container */}
              <rect
                x={node.x - 32}
                y={node.y - 14}
                width="64"
                height="28"
                rx="0"
                fill="#09090b"
                stroke={isFinal || isFirst ? "#ffffff" : "rgba(255,255,255,0.45)"}
                strokeWidth={isFinal ? "1.5" : "1"}
              />

              {/* Node index */}
              <text
                x={node.x - 26}
                y={node.y - 2}
                fill="rgba(255,255,255,0.5)"
                fontSize="6.5"
                fontFamily="ui-monospace, monospace"
                fontWeight="500"
              >
                {node.phase}
              </text>

              {/* Node label */}
              <text
                x={node.x + 2}
                y={node.y + 3}
                fill="#ffffff"
                fontSize="7"
                fontFamily="system-ui, sans-serif"
                fontWeight="600"
                letterSpacing="0.08em"
                textAnchor="middle"
              >
                {node.label}
              </text>

              {/* Center connector dot */}
              <circle
                cx={node.x}
                cy={node.y}
                r="2"
                fill={isFinal ? "#ffffff" : "#ffffff"}
                opacity={isFinal ? "1" : "0.7"}
              />
            </g>
          );
        })}
      </svg>

      {/* Blueprint Footer / Metric */}
      <div className="pointer-events-none absolute bottom-2.5 inset-x-4 flex items-center justify-between border-t border-ink-border/50 pt-2 text-[0.5625rem] font-mono tracking-wider text-ink-muted uppercase">
        <span>DELIVERY MODEL // REAL PRODUCT</span>
        <span className="text-ink-foreground/90 font-semibold">100% SPEC VERIFIED</span>
      </div>
    </div>
  );
}
