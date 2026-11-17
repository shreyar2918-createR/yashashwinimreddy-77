import { cn } from "@/lib/utils";

export type GlyphKind = "strategy" | "brand" | "product" | "technology" | "growth";

/**
 * Original abstract technology graphics drawn as lightweight SVG.
 * Each glyph animates subtly via CSS (no JS loop, GPU-friendly).
 */
export function ServiceGlyph({
  kind,
  className,
}: {
  kind: GlyphKind;
  className?: string | undefined;
}) {
  return (
    <svg
      viewBox="0 0 240 160"
      className={cn("glyph h-full w-full", className)}
      aria-hidden="true"
      fill="none"
    >
      <defs>
        <linearGradient id={`g-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {kind === "strategy" ? (
        <g stroke={`url(#g-${kind})`} strokeWidth="1.1">
          <path d="M12 132 L72 96 L120 108 L168 52 L228 30" className="glyph-draw" />
          {[
            [72, 96],
            [120, 108],
            [168, 52],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="4"
              className="glyph-pulse"
              style={{ animationDelay: `${i * 0.4}s` }}
              fill="currentColor"
              stroke="none"
            />
          ))}
          <path d="M12 20 H100" opacity="0.35" />
          <path d="M12 34 H64" opacity="0.2" />
        </g>
      ) : null}

      {kind === "brand" ? (
        <g stroke={`url(#g-${kind})`} strokeWidth="1.1">
          <circle cx="80" cy="80" r="44" className="glyph-orbit" />
          <rect x="120" y="44" width="72" height="72" className="glyph-spin" />
          <path d="M56 80 L80 40 L104 80 L80 120 Z" opacity="0.5" />
        </g>
      ) : null}

      {kind === "product" ? (
        <g stroke={`url(#g-${kind})`} strokeWidth="1.1">
          <rect x="18" y="24" width="140" height="104" rx="3" />
          <path d="M18 44 H158" opacity="0.6" />
          <circle cx="30" cy="34" r="2.5" fill="currentColor" stroke="none" />
          <rect x="30" y="58" width="60" height="8" className="glyph-slide" opacity="0.55" />
          <rect
            x="30"
            y="76"
            width="94"
            height="8"
            className="glyph-slide"
            opacity="0.35"
            style={{ animationDelay: "0.3s" }}
          />
          <rect x="174" y="46" width="48" height="88" rx="6" className="glyph-float" />
          <path d="M186 62 H210" opacity="0.5" />
        </g>
      ) : null}

      {kind === "technology" ? (
        <g stroke={`url(#g-${kind})`} strokeWidth="1">
          {[
            [40, 40, 120, 80],
            [40, 120, 120, 80],
            [120, 80, 200, 44],
            [120, 80, 200, 116],
            [40, 40, 40, 120],
          ].map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} opacity="0.45" />
          ))}
          {[
            [40, 40],
            [40, 120],
            [120, 80],
            [200, 44],
            [200, 116],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={i === 2 ? 7 : 4.5}
              className="glyph-pulse"
              style={{ animationDelay: `${i * 0.35}s` }}
              fill="currentColor"
              stroke="none"
            />
          ))}
        </g>
      ) : null}

      {kind === "growth" ? (
        <g stroke={`url(#g-${kind})`} strokeWidth="1.1">
          {[0, 1, 2, 3, 4].map((i) => (
            <rect
              key={i}
              x={28 + i * 38}
              y={130 - (i + 1) * 18}
              width="18"
              height={(i + 1) * 18}
              className="glyph-rise"
              style={{ animationDelay: `${i * 0.12}s` }}
              opacity="0.5"
            />
          ))}
          <path d="M28 116 L66 94 L104 98 L142 62 L180 38 L214 24" className="glyph-draw" />
        </g>
      ) : null}
    </svg>
  );
}
