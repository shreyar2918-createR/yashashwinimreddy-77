import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Section({
  children,
  className,
  tone = "default",
  id,
}: {
  children: ReactNode;
  className?: string | undefined;
  tone?: "default" | "surface" | "ink" | undefined;
  id?: string | undefined;
}) {
  return (
    <section
      id={id}
      className={cn(
        "px-5 py-14 sm:px-8 sm:py-16 lg:py-20",
        tone === "surface" && "bg-surface text-surface-foreground",
        tone === "ink" && "bg-ink text-ink-foreground",
        className,
      )}
    >
      <div className="mx-auto max-w-7xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "left",
  tone = "default",
  className,
}: {
  eyebrow?: string | undefined;
  title: string;
  copy?: string | undefined;
  align?: "left" | "center" | undefined;
  tone?: "default" | "ink" | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? (
        <p className={cn("eyebrow", tone === "ink" ? "text-ink-muted" : "text-muted-foreground")}>
          {eyebrow}
        </p>
      ) : null}
      <h2 className="mt-4 text-3xl leading-[1.1] font-medium sm:text-4xl lg:text-[2.75rem]">
        {title}
      </h2>
      {copy ? (
        <p
          className={cn(
            "mt-5 text-base leading-relaxed sm:text-lg",
            tone === "ink" ? "text-ink-muted" : "text-muted-foreground",
          )}
        >
          {copy}
        </p>
      ) : null}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  copy,
  children,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border bg-background px-5 pt-16 pb-14 sm:px-8 sm:pt-24 sm:pb-20">
      <div className="mx-auto max-w-7xl">
        <div className="reveal max-w-3xl">
          <p className="eyebrow text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-5 text-4xl leading-[1.05] font-medium sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            {copy}
          </p>
          {children ? <div className="mt-9">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
