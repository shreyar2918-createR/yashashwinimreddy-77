import { Database } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Honest placeholder used wherever real data will come from the VINORA backend.
 * It never displays invented clients, projects, metrics or testimonials.
 */
export function NotConnectedState({
  title,
  description,
  className,
  tone = "default",
}: {
  title: string;
  description: string;
  className?: string | undefined;
  tone?: "default" | "ink" | undefined;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-4 border border-dashed p-8 sm:p-10",
        tone === "ink" ? "border-ink-border" : "border-border bg-card",
        className,
      )}
      role="status"
    >
      <span
        className={cn(
          "inline-flex size-9 items-center justify-center border",
          tone === "ink" ? "border-ink-border" : "border-border",
        )}
      >
        <Database className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="font-display text-base font-medium">{title}</p>
        <p
          className={cn(
            "mt-2 max-w-xl text-sm leading-relaxed",
            tone === "ink" ? "text-ink-muted" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      </div>
      <p className={cn("eyebrow", tone === "ink" ? "text-ink-muted" : "text-muted-foreground")}>
        Placeholder — backend not connected
      </p>
    </div>
  );
}
