import { cn } from "@/lib/utils";

/**
 * Official VINORA logo mark (base64 embedded to guarantee 100% reliable rendering
 * without CDN dependency or 404 network failure).
 */
export const VINORA_LOGO_DATA_URI =
  "data:image/png;base64,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";

export const VINORA_LOGO_URL = "/vinora-mark.png";

export function LogoMark({ className }: { className?: string | undefined }) {
  return (
    <span
      className={cn(
        "relative flex size-8 sm:size-9 shrink-0 items-center justify-center overflow-hidden rounded-xs bg-ink p-1 border border-white/10 shadow-xs",
        className,
      )}
      aria-hidden="true"
    >
      <img
        src="/vinora-logo.png"
        alt="VINORA"
        className="size-full object-contain filter contrast-125"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = VINORA_LOGO_DATA_URI;
        }}
      />
    </span>
  );
}

export function LogoLockup({
  className,
  markClassName,
  textClassName,
  showTagline = false,
}: {
  className?: string | undefined;
  markClassName?: string | undefined;
  textClassName?: string | undefined;
  showTagline?: boolean | undefined;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5 sm:gap-3", className)}>
      <LogoMark className={markClassName} />
      <span className="flex min-w-0 flex-col justify-center leading-none">
        <span
          className={cn(
            "font-brand-serif text-xl sm:text-2xl font-medium tracking-[0.24em] sm:tracking-[0.28em] uppercase select-none",
            textClassName,
          )}
        >
          VINORA
        </span>
        {showTagline ? (
          <span className="mt-1 truncate text-[0.5625rem] tracking-[0.16em] uppercase opacity-70">
            Ideas today. Impact tomorrow.
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function LogoFull({
  className,
  alt = "VINORA — Ideas today. Impact tomorrow.",
}: {
  className?: string | undefined;
  alt?: string | undefined;
}) {
  return (
    <div className={cn("relative flex items-center justify-center bg-ink p-4", className)}>
      <img
        src={VINORA_LOGO_DATA_URI}
        alt={alt}
        loading="lazy"
        className="max-h-48 w-auto object-contain"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/vinora-logo.png";
        }}
      />
    </div>
  );
}
