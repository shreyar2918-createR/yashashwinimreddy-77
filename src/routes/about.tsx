import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { Section, SectionHeading } from "@/components/common/Section";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";

const VALUES = [
  {
    number: "01",
    title: "Honesty about scope",
    copy: "We say what is possible, what it costs, and what it does not include.",
    tag: "Integrity",
  },
  {
    number: "02",
    title: "Clarity over jargon",
    copy: "You should understand your own project without a technical dictionary.",
    tag: "Simplicity",
  },
  {
    number: "03",
    title: "Craft",
    copy: "Design and engineering quality is the product, not a finishing step.",
    tag: "Excellence",
  },
  {
    number: "04",
    title: "Ownership",
    copy: "One party is accountable for the outcome: VINORA.",
    tag: "Accountability",
  },
];

const HOW_WE_WORK = [
  "Requirements are written down before estimates are given.",
  "Scope, timeline, and pricing are agreed in a formal proposal.",
  "Work is delivered in reviewable stages, not one final reveal.",
  "Progress, files, proposals, and invoices live in your client portal.",
  "Specialists are brought in where their expertise is genuinely needed.",
];

interface GalleryImage {
  src: string;
  alt: string;
  tag: string;
  title: string;
  description: string;
}

const ABOUT_GALLERY_IMAGES: GalleryImage[] = [
  {
    src: "/images/about-team-collab.jpg",
    alt: "A diverse creative and technical team collaborating around a table with architectural documents and sketches",
    tag: "01 · Collaboration",
    title: "Cross-Discipline Alignment",
    description:
      "Designers, strategists, and engineers working together around project blueprints and scope.",
  },
  {
    src: "/images/about-team-strategy-docs.jpg",
    alt: "A professional team collaborating around a table, reviewing documents and discussing project strategy",
    tag: "02 · UI/UX Design",
    title: "Digital Interface Craft",
    description:
      "Refining typography, component design systems, and responsive user interfaces with precision.",
  },
  {
    src: "/images/about-strategy-meeting.jpg",
    alt: "A professional team discussing project roadmap metrics and business strategy in a meeting",
    tag: "03 · Strategic Direction",
    title: "Roadmap & Metric Review",
    description:
      "Reviewing delivery timelines, performance goals, and practical release milestones together.",
  },
  {
    src: "/images/about-planning-board.jpg",
    alt: "A close-up of an agile creative planning board with color-coded sticky notes, user flows, and diagrams",
    tag: "04 · Architecture",
    title: "Agile Workflow & User Flows",
    description:
      "Documenting architectural components, task dependencies, and iterative progress on visual boards.",
  },
];

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About VINORA" },
      {
        name: "description",
        content:
          "Why VINORA exists, our mission, vision, values, and the way we work with startups, businesses, creators, and individuals.",
      },
      { property: "og:title", content: "About VINORA" },
      {
        property: "og:description",
        content:
          "VINORA begins with a focused team and a growing network of specialists, built around clarity and accountability.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <SiteLayout>
      {/* 1. Introduction Hero */}
      <section className="relative overflow-hidden border-b border-border bg-background pt-28 pb-14 sm:pt-36 sm:pb-18">
        <div
          className="hairline-grid pointer-events-none absolute inset-0 opacity-40"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-5xl px-5 sm:px-8">
          <p className="eyebrow text-xs font-semibold tracking-[0.2em] text-foreground/80 uppercase">
            About VINORA
          </p>
          <h1 className="mt-4 font-display text-3xl font-medium tracking-tight text-foreground sm:text-4xl lg:text-5xl leading-[1.15]">
            VINORA begins with a focused team and a growing network of specialists.
          </h1>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            We are transparent about our size. VINORA is early, deliberately small, and structured
            so that the right expertise can be brought to a project without pretending it all sits
            in one room.
          </p>
        </div>
      </section>

      {/* 2. Why VINORA Exists & Mission / Vision in balanced compact structure */}
      <Section tone="surface">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-14 lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Why VINORA exists"
              title="Good ideas stall for avoidable reasons."
            />
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              <p>
                People with a real idea often stop at the same place: they do not know what to ask
                for, who to ask, or what it should cost. The answer is usually spread across a
                strategist, a designer, a developer, and a marketer who never speak to each other.
              </p>
              <p>
                VINORA exists to remove that gap. You describe the outcome you want. We define the
                work, assemble the right capability, and stay accountable for delivering it.
              </p>
            </div>
          </div>

          {/* Mission & Vision cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <article className="border border-border bg-background p-6 sm:p-7 transition-colors hover:border-foreground/30">
              <p className="eyebrow text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Mission
              </p>
              <p className="mt-3 font-display text-base font-medium text-foreground sm:text-lg leading-snug">
                To make professional digital execution accessible to anyone with a serious idea —
                regardless of how technical they are.
              </p>
              <div className="mt-5 border-t border-border/80 pt-2.5 text-[0.65rem] font-mono uppercase tracking-wider text-muted-foreground">
                Guiding Principle
              </div>
            </article>

            <article className="border border-border bg-background p-6 sm:p-7 transition-colors hover:border-foreground/30">
              <p className="eyebrow text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                Vision
              </p>
              <p className="mt-3 font-display text-base font-medium text-foreground sm:text-lg leading-snug">
                A single platform where an idea becomes a plan, a plan becomes a product, and the
                client can see every step of it.
              </p>
              <div className="mt-5 border-t border-border/80 pt-2.5 text-[0.65rem] font-mono uppercase tracking-wider text-muted-foreground">
                Long-Term Aspiration
              </div>
            </article>
          </div>
        </div>
      </Section>

      {/* 3. Compact 2-Column Studio Image Gallery (Exactly two images per row on desktop) */}
      <Section>
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between pb-8 border-b border-border">
            <div>
              <SectionHeading
                eyebrow="Studio In Practice"
                title="Inside our collaborative process."
              />
              <p className="mt-3 text-sm text-muted-foreground max-w-xl">
                Real documentation, design systems, and roadmaps from our multi-disciplinary working
                sessions.
              </p>
            </div>
            <span className="mt-4 sm:mt-0 font-mono text-xs tracking-wider uppercase text-muted-foreground">
              4 Distinct Perspectives
            </span>
          </div>

          {/* Responsive 2-column image gallery: exactly 2 images per row on desktop and tablet, 1 on mobile */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7">
            {ABOUT_GALLERY_IMAGES.map((item) => (
              <figure
                key={item.title}
                className="group overflow-hidden rounded-md border border-border bg-background transition-all duration-300 hover:border-foreground/40 hover:shadow-xs"
              >
                {/* Moderate landscape aspect ratio (~4:3) with height between 220–280px on desktop */}
                <div className="relative h-[220px] sm:h-[240px] md:h-[260px] lg:h-[275px] w-full overflow-hidden bg-surface">
                  <img
                    src={item.src}
                    alt={item.alt}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-90" />
                  <div className="absolute top-3 left-3">
                    <span className="inline-block rounded-xs border border-white/20 bg-black/75 px-2.5 py-1 font-mono text-[0.625rem] font-medium tracking-wider uppercase text-white backdrop-blur-xs">
                      {item.tag}
                    </span>
                  </div>
                </div>

                {/* Compact caption card below */}
                <figcaption className="p-4 sm:p-5">
                  <h3 className="font-display text-base font-medium text-foreground tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </Section>

      {/* 4. Values */}
      <Section tone="surface">
        <SectionHeading eyebrow="Values" title="What we hold to." />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map((value) => (
            <article
              key={value.title}
              className="group flex flex-col justify-between border border-border bg-background p-6 transition-all duration-300 hover:border-foreground/50 hover:shadow-xs"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <span className="font-mono text-xs text-muted-foreground">{value.number}</span>
                  <span className="font-mono text-[0.65rem] tracking-wider uppercase text-muted-foreground">
                    {value.tag}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-base font-medium text-foreground">
                  {value.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  {value.copy}
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 text-xs text-foreground/80">
                <CheckCircle2 className="size-3.5 text-foreground" />
                <span className="font-mono text-[0.65rem] tracking-wider uppercase">
                  Standard Enforced
                </span>
              </div>
            </article>
          ))}
        </div>
      </Section>

      {/* 5. How we work / The working agreement */}
      <Section tone="ink">
        <div className="mx-auto max-w-4xl">
          <SectionHeading tone="ink" eyebrow="How we work" title="The working agreement." />
          <ul className="mt-8 divide-y divide-ink-border border-y border-ink-border">
            {HOW_WE_WORK.map((line, idx) => (
              <li
                key={line}
                className="flex items-start gap-3.5 py-4 text-sm text-ink-foreground/90 sm:text-base"
              >
                <span className="font-mono text-xs text-ink-muted mt-0.5">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-ink-muted sm:text-sm">
              Ready to define your scope and discuss delivery milestones?
            </p>
            <Button asChild size="lg" variant="secondary" className="rounded-none px-7">
              <Link to="/contact" className="inline-flex items-center gap-2">
                <span>Contact VINORA</span>
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </Section>
    </SiteLayout>
  );
}
