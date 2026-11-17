import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Compass,
  CreditCard,
  FileText,
  Laptop,
  LayoutDashboard,
  Palette,
  Plus,
  ShieldCheck,
  Sparkles,
  Wrench,
  Cpu,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { StrategyBlueprint } from "@/components/brand/StrategyBlueprint";
import { VinoraVisionSlider } from "@/components/brand/VinoraVisionSlider";
import { PublicProjectShowcase } from "@/components/brand/PublicProjectShowcase";
import { Reveal } from "@/components/common/Reveal";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Parallax } from "@/components/experience/Parallax";
import { ServiceGlyph } from "@/components/experience/ServiceGlyph";
import { SplitText } from "@/components/experience/SplitText";
import { Button } from "@/components/ui/button";
import { NotConnectedState } from "@/components/common/NotConnectedState";
import { CONTACT_DETAILS, PROCESS_STEPS, SOLUTION_CATEGORIES, WHY_VINORA } from "@/content/site";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VINORA — Digital Solutions, Technology, Design & Innovation" },
      {
        name: "description",
        content:
          "VINORA turns ideas and business requirements into real digital products, brands and technology solutions — strategy, design, engineering and growth from one accountable team.",
      },
      {
        property: "og:title",
        content: "VINORA — Ideas today. Impact tomorrow.",
      },
      {
        property: "og:description",
        content:
          "From idea to impact: strategy, design, technology and growth for startups, businesses and creators.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "canonical", href: "/" },
      { rel: "preload", as: "image", href: "/images/vinora-hero-background-1.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "VINORA",
          slogan: "Ideas today. Impact tomorrow.",
          email: CONTACT_DETAILS.email ?? undefined,
          description:
            "Digital technology and creative solutions company turning ideas into digital products, brands and technology solutions.",
        }),
      },
    ],
  }),
  component: HomePage,
});

const UNDERSTANDING = [
  { label: "You bring the idea", copy: "In your words — no technical vocabulary needed." },
  {
    label: "VINORA understands it",
    copy: "We study the intent, the audience and the constraints.",
  },
  {
    label: "The requirement is structured",
    copy: "A vague ambition becomes a workable, written scope.",
  },
  {
    label: "The right expertise is connected",
    copy: "Strategy, brand, product or engineering — only what applies.",
  },
  { label: "The solution is built", copy: "Designed, engineered, integrated and tested." },
  { label: "The result is delivered", copy: "Handed over, documented and supported as it grows." },
];

function HomePage() {
  return (
    <SiteLayout>
      <Hero />
      <MorphStage />
      <WhatIsVinora />
      <VinoraVisionSlider />
      <ServicesSection />
      <HowWeWorkSection />
      <ProjectShowcase />
      <CommitmentsSection />
      <WhyVinora />
      <FinalCta />
    </SiteLayout>
  );
}

/* ------------------------------------------------------------------ hero */

function Hero() {
  return (
    <section
      id="hero"
      className="relative flex min-h-[92vh] lg:min-h-screen w-full items-center overflow-hidden bg-black text-white bg-cover bg-no-repeat bg-[position:right_center]"
      style={{
        backgroundImage: "url('/images/vinora-hero-background-1.png')",
        backgroundSize: "cover",
        backgroundPosition: "right center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Restrained dark gradient scrim concentrated on the left for text legibility without covering the laptop on the right */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-r from-black/80 via-black/35 to-transparent sm:from-black/70 sm:via-black/20 sm:to-transparent"
        aria-hidden="true"
      />

      {/* Main hero content floating over the left side of the photograph */}
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 pt-32 pb-20 sm:px-8 sm:pt-40 sm:pb-28 lg:px-12 lg:pt-36 lg:pb-32">
        <div className="w-full max-w-lg lg:max-w-xl">
          {/* Eyebrow & Headline with vertical accent rule line matching IMAGE 2 */}
          <div className="border-l-2 border-white/40 pl-4 sm:pl-5">
            <div
              className="reveal eyebrow text-xs sm:text-sm font-semibold tracking-[0.24em] uppercase text-white/85"
              style={{ animationDelay: "100ms" }}
            >
              IDEAS TODAY.
            </div>
            <SplitText
              as="h1"
              start="mount"
              delay={200}
              stagger={120}
              text="IMPACT TOMORROW."
              className="mt-2 text-3xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-bold tracking-tight text-white leading-[1.05]"
            />
          </div>

          {/* Description */}
          <p
            className="reveal mt-5 sm:mt-6 max-w-lg text-sm sm:text-base leading-relaxed text-white/85 font-normal"
            style={{ animationDelay: "380ms" }}
          >
            We help individuals, startups and organisations turn ideas into powerful digital
            solutions with design, development and strategic support.
          </p>

          {/* Buttons matching IMAGE 2 layout with original hover transitions */}
          <div
            className="reveal mt-7 sm:mt-8 flex flex-wrap items-center gap-3.5 sm:gap-4"
            style={{ animationDelay: "520ms" }}
          >
            <Button
              asChild
              size="lg"
              className="group rounded-md bg-white px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-black shadow-md hover:bg-neutral-100 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <Link to="/start-project" className="inline-flex items-center gap-2">
                Start a Project
                <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="group rounded-md border border-white/40 bg-black/30 backdrop-blur-xs px-5 sm:px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-semibold text-white hover:bg-white/10 hover:border-white hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
            >
              <a href="#services" className="inline-flex items-center gap-2">
                Explore Our Work
                <ArrowDown className="size-4 transition-transform duration-200 group-hover:translate-y-1" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- morph stage */

interface MorphStageItem {
  stage: string;
  label: string;
  copy: string;
  image: string;
  alt: string;
}

const MORPH_STAGES: MorphStageItem[] = [
  {
    stage: "01",
    label: "Idea",
    copy: "Every meaningful product begins with a clear intention. We clarify your goals, audience, and scope before design or development begins.",
    image: "/images/stage-idea.jpg",
    alt: "A close view of a person sketching an initial product concept in a notebook at a desk",
  },
  {
    stage: "02",
    label: "Strategy",
    copy: "We define the project direction, priorities, and roadmap. Every decision is aligned with your goals and practical requirements.",
    image: "/images/stage-strategy.jpg",
    alt: "A professional business meeting with several people reviewing printed reports, business charts, and a presentation around a conference table",
  },
  {
    stage: "03",
    label: "Design",
    copy: "We turn ideas into clear, intuitive digital experiences. Every interface is designed with usability and visual consistency in mind.",
    image: "/images/stage-design.jpg",
    alt: "A digital product designer working on UI/UX layouts, wireframes, and interface mock-ups on a computer screen",
  },
  {
    stage: "04",
    label: "Development",
    copy: "We build and test the solution using suitable technologies. Our focus is functionality, reliability, and a smooth user experience.",
    image: "/images/stage-development.jpg",
    alt: "A developer coding on a computer, with code visible on the monitor and a keyboard or workstation in view",
  },
  {
    stage: "05",
    label: "Launch & Beyond",
    copy: "We prepare the product for release and help you move forward. Ongoing improvements and support depend on your project needs.",
    image: "/images/stage-launch.jpg",
    alt: "A team presenting or launching a finished digital product software dashboard",
  },
];

function MorphStage() {
  const [activeStage, setActiveStage] = useState(0);
  const [slideDirection, setSlideDirection] = useState<"next" | "prev">("next");
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null);

  const showcaseRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchMovedRef = useRef(false);
  const lastTouchNavTimeRef = useRef<number>(0);

  // Boundary-protected navigation: stops at 0 and 4, never wraps around
  const goToNext = useCallback(() => {
    setActiveStage((prev) => {
      if (prev >= MORPH_STAGES.length - 1) return prev;
      setSlideDirection("next");
      return prev + 1;
    });
  }, []);

  const goToPrev = useCallback(() => {
    setActiveStage((prev) => {
      if (prev <= 0) return prev;
      setSlideDirection("prev");
      return prev - 1;
    });
  }, []);

  const selectStage = (index: number) => {
    if (index === activeStage) return;
    setSlideDirection(index > activeStage ? "next" : "prev");
    setActiveStage(index);
  };

  // Keyboard arrow keys move between slides with boundary enforcement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        goToNext();
      } else if (e.key === "ArrowLeft") {
        goToPrev();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrev]);

  // Touch handlers: horizontal swipe without interfering with normal vertical scroll
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() };
    touchMovedRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    // Mark moved if there is slight displacement
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      touchMovedRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const t = e.changedTouches[0];
    if (!t) return;

    const dx = t.clientX - touchStartRef.current.x;
    const dy = t.clientY - touchStartRef.current.y;
    const startX = touchStartRef.current.x;
    touchStartRef.current = null;

    // Horizontal swipe: must be substantial (>40px) and distinctly horizontal
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      lastTouchNavTimeRef.current = Date.now();
      if (dx < 0) {
        goToNext(); // Swipe left moves forward
      } else {
        goToPrev(); // Swipe right moves back
      }
      return;
    }

    // Touch tap: minimal movement on either half of the showcase box
    if (!touchMovedRef.current || Math.hypot(dx, dy) < 15) {
      if (showcaseRef.current) {
        const rect = showcaseRef.current.getBoundingClientRect();
        const tapX = startX - rect.left;
        lastTouchNavTimeRef.current = Date.now();
        if (tapX < rect.width / 2) {
          goToPrev();
        } else {
          goToNext();
        }
      }
    }
  };

  // Mouse click handler: left half -> prev, right half -> next
  const handleClick = (e: React.MouseEvent) => {
    // Avoid double navigation from synthetic click right after a touch event
    if (Date.now() - lastTouchNavTimeRef.current < 600) return;

    // Ignore clicks on child interactive buttons (progress indicators)
    if ((e.target as HTMLElement).closest("button, a")) return;

    if (showcaseRef.current) {
      const rect = showcaseRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX < rect.width / 2) {
        goToPrev();
      } else {
        goToNext();
      }
    }
  };

  // Desktop hover tracking for interactive cues and cursor feedback
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!showcaseRef.current) return;
    const rect = showcaseRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    setHoverSide(x < rect.width / 2 ? "left" : "right");
  };

  const handleMouseLeave = () => {
    setHoverSide(null);
  };

  const current = MORPH_STAGES[activeStage]!;

  return (
    <section className="relative overflow-hidden bg-ink px-5 py-12 text-ink-foreground sm:px-8 sm:py-16">
      <div className="hero-aurora absolute inset-0 opacity-40" aria-hidden />
      <div className="noise-layer absolute inset-0" aria-hidden />

      <div className="relative mx-auto max-w-7xl">
        {/* Heading & Description */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Reveal>
              <p className="eyebrow text-xs font-semibold tracking-[0.2em] text-ink-muted uppercase">
                THE PATH VINORA FOLLOWS
              </p>
            </Reveal>
            <h2 className="mt-2 font-display text-2xl font-medium tracking-tight sm:text-3xl lg:text-4xl text-white">
              From intention to delivered reality.
            </h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-ink-muted sm:text-sm">
            Five deliberate phases designed to eliminate uncertainty and deliver working technology.
          </p>
        </div>

        {/* Five-stage interactive showcase box with Tap-to-navigate and Swipe navigation */}
        <div
          ref={showcaseRef}
          tabIndex={0}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: "pan-y" }}
          className={cn(
            "group relative mt-8 sm:mt-10 rounded-xs border border-ink-border bg-ink-foreground/[0.02] p-5 sm:p-7 lg:p-8 shadow-sm transition-colors duration-300 focus:outline-none focus-visible:ring-1 focus-visible:ring-ink-foreground/40 select-none overflow-hidden",
            hoverSide === "left" && (activeStage > 0 ? "cursor-w-resize" : "cursor-default"),
            hoverSide === "right" &&
              (activeStage < MORPH_STAGES.length - 1 ? "cursor-e-resize" : "cursor-default"),
          )}
          aria-label={`Interactive workflow showcase: Stage ${current.stage} - ${current.label}. Tap left or right half, or swipe horizontally to navigate.`}
        >
          {/* Subtle edge illumination cues on desktop hover */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-white/[0.05] to-transparent transition-opacity duration-300 hidden md:block",
              hoverSide === "left" && activeStage > 0 ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white/[0.05] to-transparent transition-opacity duration-300 hidden md:block",
              hoverSide === "right" && activeStage < MORPH_STAGES.length - 1
                ? "opacity-100"
                : "opacity-0",
            )}
          />

          <div className="grid items-center gap-6 sm:gap-8 md:grid-cols-[2fr_3fr] md:gap-8 lg:grid-cols-[2fr_3fr] lg:gap-10">
            {/* LEFT side (~40%): stage number, stage title, short description, and progress indicator */}
            <div
              key={`content-${activeStage}`}
              className={cn(
                "flex flex-col justify-center",
                slideDirection === "next" ? "animate-slide-in-right" : "animate-slide-in-left",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="eyebrow border border-ink-border px-2.5 py-0.5 text-[0.65rem] tracking-[0.2em] text-ink-muted uppercase">
                  Stage {current.stage} / 05
                </span>
                <span className="h-px w-8 bg-ink-border" />
                <span className="text-xs font-mono tracking-widest text-white/50 uppercase">
                  {current.label}
                </span>
              </div>

              <h3 className="mt-3 font-display text-2xl sm:text-3xl lg:text-3xl font-bold tracking-tight text-white uppercase">
                {current.label}
              </h3>

              <p className="mt-3 text-sm sm:text-base leading-relaxed text-white/85 font-normal">
                {current.copy}
              </p>

              {/* Progress indicators & navigation guide */}
              <div
                className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-ink-border/60"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {/* Progress indicators */}
                <div className="flex items-center gap-1.5" aria-label="Stage indicator">
                  {MORPH_STAGES.map((s, i) => (
                    <button
                      key={s.label}
                      type="button"
                      aria-label={`Jump to stage ${s.stage} - ${s.label}`}
                      onClick={() => selectStage(i)}
                      className="group flex h-8 items-center px-1.5 py-2 cursor-pointer touch-manipulation select-none"
                    >
                      <span
                        className={cn(
                          "h-1.5 transition-all duration-300 rounded-full block",
                          i === activeStage
                            ? "w-8 bg-white"
                            : "w-2.5 bg-white/30 group-hover:bg-white/60 group-hover:w-4",
                        )}
                      />
                    </button>
                  ))}
                </div>

                {/* Stage counter */}
                <div className="flex items-center gap-1.5 text-xs font-mono tracking-wider text-ink-muted uppercase select-none">
                  <span className="text-white font-medium">{current.stage}</span>
                  <span className="text-white/30">/</span>
                  <span className="text-white/60">05</span>
                </div>
              </div>
            </div>

            {/* RIGHT side (~60%): the stage photograph in 16:9 landscape format */}
            <div
              key={`img-${activeStage}`}
              className="relative aspect-[16/9] w-full max-h-[340px] overflow-hidden rounded-xs border border-ink-border bg-black/60 shadow-lg animate-fade-slide"
            >
              <img
                src={current.image}
                alt={current.alt}
                className="size-full object-cover object-center transition-transform duration-500 hover:scale-105"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs">
                <span className="font-mono text-[0.6875rem] tracking-wider uppercase text-white bg-black/75 backdrop-blur-xs px-2.5 py-1 border border-white/20">
                  Stage {current.stage} // {current.label}
                </span>
                <span className="font-mono text-[0.625rem] tracking-wider uppercase text-white/80 bg-black/75 backdrop-blur-xs px-2 py-0.5 border border-white/10 hidden sm:inline-block">
                  VINORA Workflow
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom divider and transition */}
        <div className="mt-12 h-px w-full bg-ink-border" aria-hidden="true" />
      </div>
    </section>
  );
}

/* -------------------------------------------------------- what is vinora */

function WhatIsVinora() {
  return (
    <section
      id="about"
      className="relative overflow-hidden bg-background px-5 py-12 sm:px-8 sm:py-16"
    >
      <div className="hairline-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-7xl">
        <Reveal>
          <p className="eyebrow text-xs font-semibold tracking-[0.2em] text-foreground/85 uppercase">
            What is VINORA?
          </p>
        </Reveal>
        <SplitText
          as="h2"
          text="VINORA helps turn ideas and requirements into real digital solutions."
          className="mt-4 max-w-4xl font-display text-3xl leading-[1.08] font-medium tracking-tight sm:mt-6 sm:text-5xl"
        />

        <ol className="relative mt-10 grid gap-px sm:grid-cols-2 lg:grid-cols-3">
          {UNDERSTANDING.map((stage, i) => (
            <Reveal
              as="li"
              key={stage.label}
              index={i}
              className="group relative bg-background p-6 outline outline-border transition-colors hover:bg-surface sm:p-7"
            >
              <span className="eyebrow text-xs font-medium text-foreground/75">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-3 block font-display text-lg leading-snug font-medium text-foreground">
                {stage.label}
              </span>
              <span className="mt-2 block text-sm leading-relaxed text-foreground/80">
                {stage.copy}
              </span>
              <span className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-foreground to-muted-foreground transition-transform duration-500 group-hover:scale-x-100" />
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ---------------------------------------------------- services section */

interface ServiceItem {
  id: string;
  number: string;
  tag: string;
  title: string;
  image: string;
  alt: string;
  description: string;
  deliverables: string[];
  serviceParam: string;
}

const VINORA_SERVICES: ServiceItem[] = [
  {
    id: "web-app-dev",
    number: "01",
    tag: "Engineering & Platforms",
    title: "Web & App Development",
    image: "/images/service-web-app.jpg",
    alt: "Modern Web and Application Development setup with code and devices",
    description:
      "Websites, web applications, and mobile apps engineered with clean codebases, fast load times, and scalable architectures.",
    deliverables: [
      "Custom Web Applications",
      "Responsive Brand Websites",
      "iOS & Android Mobile Apps",
      "API & Cloud Integrations",
    ],
    serviceParam: "Web & App Development",
  },
  {
    id: "design-branding",
    number: "02",
    tag: "Identity & Interface",
    title: "Design & Branding",
    image: "/images/service-ui-ux.jpg",
    alt: "UI UX design studio workspace with wireframes and design systems",
    description:
      "Digital brand identities, intuitive user interfaces, and cohesive design systems crafted to make digital products memorable.",
    deliverables: [
      "Intuitive UI/UX Design",
      "Design Systems & Tokens",
      "Brand Identity & Guidelines",
      "Interactive Prototypes",
    ],
    serviceParam: "Design & Branding",
  },
  {
    id: "ai-intelligent-solutions",
    number: "03",
    tag: "Applied Intelligence",
    title: "AI & Intelligent Solutions",
    image: "/images/service-ai-solutions.jpg",
    alt: "High-tech AI neural network and intelligent automation setup",
    description:
      "Custom AI integrations, LLM workflows, and intelligent automations designed to eliminate operational friction and accelerate teams.",
    deliverables: [
      "Custom AI & LLM Integration",
      "Automated Business Workflows",
      "Intelligent Data Processing",
      "Custom Internal Tooling",
    ],
    serviceParam: "AI & Intelligent Solutions",
  },
  {
    id: "project-consultation",
    number: "04",
    tag: "Strategic Advisory",
    title: "Project Consultation",
    image: "/images/service-consultation.jpg",
    alt: "Technical roadmap and architectural strategy consultation session",
    description:
      "Product discovery, tech stack evaluation, and feasibility roadmaps to ensure your technology investments deliver maximum business value.",
    deliverables: [
      "Product Discovery & Scoping",
      "Architecture & Tech Audits",
      "Feasibility & Sprint Roadmaps",
      "Stack Modernization Guidance",
    ],
    serviceParam: "Project Consultation",
  },
  {
    id: "support-maintenance",
    number: "05",
    tag: "Reliability & Care",
    title: "Support & Maintenance",
    image: "/images/service-maintenance.jpg",
    alt: "Continuous technical maintenance and support workspace",
    description:
      "Proactive uptime monitoring, security updates, ongoing maintenance, and prompt bug fixes to keep your platforms running smoothly.",
    deliverables: [
      "Proactive Health & Uptime Monitoring",
      "Security Audits & Routine Patches",
      "Continuous Feature Maintenance",
      "Dedicated Technical SLA Support",
    ],
    serviceParam: "Support & Maintenance",
  },
];

function ServicesSection() {
  return (
    <section
      id="services"
      className="relative overflow-hidden bg-surface px-5 py-12 text-surface-foreground sm:px-8 sm:py-16"
    >
      <div className="hairline-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />

      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Reveal>
              <p className="eyebrow text-xs font-semibold tracking-[0.2em] text-foreground/85 uppercase">
                What We Do / Capabilities
              </p>
            </Reveal>
            <SplitText
              as="h2"
              text="Services built for real-world impact."
              className="mt-3 max-w-3xl font-display text-3xl leading-[1.08] font-medium tracking-tight sm:mt-4 sm:text-4xl lg:text-5xl"
            />
          </div>
          <p className="max-w-md text-xs leading-relaxed text-foreground/75 sm:text-sm">
            From early architectural planning to production engineering and ongoing lifecycle
            support — five focused disciplines delivered under one roof.
          </p>
        </div>

        {/* 5-Card Balanced Services Grid:
            Desktop & Tablet (md+): 2 cards per row (Row 1: 2 cards, Row 2: 2 cards, Row 3: 1 card centered below row 2).
            Mobile: 1 column stacked.
            All cards equal in width and consistent in height.
        */}
        <div className="mt-10 mx-auto max-w-5xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 lg:gap-6">
            {VINORA_SERVICES.map((service, index) => {
              const isFifth = index === 4;
              return (
                <Reveal
                  key={service.id}
                  index={index}
                  className={cn(
                    "group flex flex-col justify-between border border-border bg-background transition-all duration-300 hover:border-foreground/50 hover:shadow-md h-[300px] sm:h-[315px] overflow-hidden",
                    isFifth ? "md:col-start-2 md:col-end-4" : "md:col-span-2",
                  )}
                >
                  <div>
                    <div className="relative h-32 w-full overflow-hidden bg-ink">
                      <img
                        src={service.image}
                        alt={service.alt}
                        className="h-full w-full object-cover object-center grayscale contrast-105 transition-all duration-500 group-hover:scale-105 group-hover:grayscale-0"
                        loading="lazy"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs text-white">
                        <span className="font-mono text-[0.625rem] tracking-wider uppercase bg-black/70 backdrop-blur-xs px-2 py-0.5 border border-white/15">
                          {service.number} / {service.tag}
                        </span>
                      </div>
                    </div>

                    <div className="p-4 sm:p-5">
                      <h3 className="font-display text-base sm:text-lg font-medium tracking-tight text-foreground line-clamp-1">
                        {service.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {service.description}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border/80 px-4 py-3 sm:px-5">
                    <Link
                      to="/start-project"
                      search={{ service: service.serviceParam }}
                      className="inline-flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-foreground/80 group-hover:text-foreground transition-colors"
                    >
                      <span>Discuss This Service</span>
                      <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                    </Link>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-foreground/70">
            Have a project that spans multiple services? We design custom cross-functional
            engagements.
          </p>
          <Link
            to="/start-project"
            className="arrow-link ghost-underline inline-flex items-center gap-2 text-xs sm:text-sm font-medium text-foreground hover:underline"
          >
            Submit Custom Project Requirement
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------- how we work section */

const HOW_WE_WORK_STEPS = [
  {
    step: "01",
    title: "Share your idea through the project form",
    summary: "Tell us what you want to exist in your own words.",
    description:
      "Submit your project requirements, goals, audience, and timeline through our structured project inquiry form. No technical vocabulary is needed — our team translates your vision into workable specifications.",
    deliverable: "Project Requirement Confirmed",
  },
  {
    step: "02",
    title: "Create an account or sign in securely",
    summary: "Dedicated client workspace and protected profile.",
    description:
      "Access your personal VINORA portal using password, email OTP, or Google single sign-on. Your draft specifications, documents, and communication remain centralized and protected.",
    deliverable: "Client Portal Activated",
  },
  {
    step: "03",
    title: "Discuss requirements and receive a proposal",
    summary: "Transparent budget with fixed milestones.",
    description:
      "We clarify technical requirements, explore edge cases, and deliver a comprehensive proposal detailing exact milestones, delivery phases, and transparent fixed pricing with no hidden fees.",
    deliverable: "Itemized Milestone Proposal",
  },
  {
    step: "04",
    title: "Approve the proposal and pay securely",
    summary: "Cryptographic sign-off & escrow protection.",
    description:
      "Approve terms with a single digital sign-off and fund milestone phases safely through integrated Razorpay processing with automated GST invoicing and receipts.",
    deliverable: "Contract Locked & Funded",
  },
  {
    step: "05",
    title: "Track milestones, meetings, files & progress",
    summary: "Complete visibility right through to launch.",
    description:
      "Follow real-time progress on your client dashboard. Schedule check-in meetings, review sprint deliverables, download assets, and message the engineering team directly.",
    deliverable: "Live Delivery & Full Handoff",
  },
];

function HowWeWorkSection() {
  const [activeStep, setActiveStep] = useState(0);
  const current = HOW_WE_WORK_STEPS[activeStep]!;

  return (
    <section
      id="how-we-work"
      className="relative overflow-hidden bg-background px-5 py-14 sm:px-8 sm:py-20"
    >
      <div className="hairline-grid pointer-events-none absolute inset-0 opacity-50" aria-hidden />

      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Reveal>
              <p className="eyebrow text-xs font-semibold tracking-[0.2em] text-foreground/85 uppercase">
                The Working Process
              </p>
            </Reveal>
            <SplitText
              as="h2"
              text="How We Work"
              className="mt-3 max-w-3xl font-display text-3xl leading-[1.08] font-medium tracking-tight sm:mt-4 sm:text-5xl"
            />
          </div>
          <p className="max-w-md text-xs leading-relaxed text-foreground/75 sm:text-sm">
            Five transparent stages from your first intention to delivered software, with full
            client visibility at every step.
          </p>
        </div>

        {/* 5-Step interactive progression matrix */}
        <div className="mt-12 grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
          {/* Left: 5 clickable steps list */}
          <div className="space-y-3">
            {HOW_WE_WORK_STEPS.map((s, idx) => {
              const isActive = idx === activeStep;
              return (
                <div
                  key={s.step}
                  onClick={() => setActiveStep(idx)}
                  className={cn(
                    "group relative border p-5 transition-all duration-200 cursor-pointer sm:p-6",
                    isActive
                      ? "border-foreground bg-surface shadow-xs"
                      : "border-border bg-background hover:border-foreground/40 hover:bg-surface/40",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "eyebrow text-xs font-mono tracking-widest uppercase transition-colors",
                        isActive ? "text-foreground font-bold" : "text-muted-foreground",
                      )}
                    >
                      Step {s.step}
                    </span>
                    <span
                      className={cn(
                        "size-2 rounded-full transition-transform duration-300",
                        isActive ? "bg-foreground scale-125" : "bg-border",
                      )}
                    />
                  </div>

                  <h3 className="mt-2.5 font-display text-lg font-medium tracking-tight text-foreground sm:text-xl">
                    {s.title}
                  </h3>

                  <p className="mt-1.5 text-xs leading-relaxed text-foreground/80 sm:text-sm">
                    {s.summary}
                  </p>

                  {isActive && (
                    <div className="mt-3 pt-3 border-t border-border/60 text-xs text-foreground/90 leading-relaxed sm:hidden animate-fade-slide">
                      {s.description}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right: Detailed phase spotlight & CTA */}
          <div className="sticky top-24 hidden lg:flex flex-col justify-between border border-foreground/30 bg-surface p-8 shadow-xs">
            <div>
              <div className="flex items-center justify-between border-b border-border/80 pb-4">
                <span className="eyebrow text-[0.6875rem] font-mono tracking-widest text-muted-foreground uppercase">
                  Stage Detail / Step {current.step}
                </span>
                <span className="font-mono text-xs uppercase tracking-wider text-foreground">
                  VINORA Workflow
                </span>
              </div>

              <h4 className="mt-6 font-display text-2xl font-medium tracking-tight text-foreground">
                {current.title}
              </h4>

              <p className="mt-4 text-sm leading-relaxed text-foreground/85">
                {current.description}
              </p>

              <div className="mt-8 border-t border-border/80 pt-6">
                <span className="text-[0.65rem] font-mono tracking-widest text-muted-foreground uppercase block">
                  Stage Sign-off & Milestone
                </span>
                <p className="mt-2 font-display text-base font-medium text-foreground">
                  {current.deliverable}
                </p>
              </div>
            </div>

            <div className="mt-8 border-t border-border/80 pt-6">
              <Button asChild size="lg" className="cta-accent w-full rounded-none">
                <Link to="/start-project" className="flex items-center justify-center gap-2">
                  <span>Start a Project</span>
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <p className="mt-3 text-center text-[0.7rem] text-muted-foreground">
                Takes ~3 minutes to submit · No technical knowledge required
              </p>
            </div>
          </div>
        </div>

        {/* Mobile bottom CTA */}
        <div className="mt-8 lg:hidden">
          <Button asChild size="lg" className="cta-accent w-full rounded-none py-6">
            <Link to="/start-project" className="flex items-center justify-center gap-2">
              <span>Start a Project</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------- project showcase */

function ProjectShowcase() {
  return (
    <div id="work">
      <PublicProjectShowcase />
    </div>
  );
}

/* ---------------------------------------------------- commitments & trust */

const COMMITMENTS = [
  {
    discipline: "01 // MILESTONE TRANSPARENCY",
    title: "Fixed Scope & Clear Deliverables",
    description:
      "Every project engagement is bounded by written deliverables and agreed milestones. You review and sign off on each phase before subsequent work begins.",
    tag: "Verified Progress",
  },
  {
    discipline: "02 // DIRECT COLLABORATION",
    title: "Senior Engineering Partnership",
    description:
      "You communicate directly with the senior developers and designers building your application — eliminating intermediaries and communication friction.",
    tag: "Direct Access",
  },
  {
    discipline: "03 // COMPLETE OWNERSHIP",
    title: "100% Code & Asset Custody",
    description:
      "Upon milestone completion, your organization retains full legal ownership and repository custody of all clean source code, architecture, and design tokens.",
    tag: "Full IP Rights",
  },
];

function CommitmentsSection() {
  return (
    <section
      id="accountability"
      className="relative overflow-hidden bg-surface px-5 py-14 text-surface-foreground sm:px-8 sm:py-20 border-t border-border"
    >
      <div className="hairline-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto max-w-7xl">
        <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Reveal>
              <p className="eyebrow text-xs font-semibold tracking-[0.2em] text-foreground/85 uppercase">
                Accountability / Operating Standards
              </p>
            </Reveal>
            <h2 className="mt-3 max-w-3xl font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight text-foreground leading-[1.12]">
              Engineered for Clarity. Built on Trust.
            </h2>
          </div>
          <p className="max-w-md text-xs leading-relaxed text-foreground/80 sm:text-sm">
            Our non-negotiable operating commitments to every founder, enterprise, and creative
            partner.
          </p>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {COMMITMENTS.map((c, idx) => (
            <Reveal
              key={idx}
              index={idx}
              className="group flex flex-col justify-between border border-border bg-background p-6 transition-colors hover:border-foreground/50 sm:p-7"
            >
              <div>
                <span className="font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground block mb-3">
                  {c.discipline}
                </span>
                <h3 className="font-display text-lg font-medium text-foreground sm:text-xl">
                  {c.title}
                </h3>
                <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-foreground/80">
                  {c.description}
                </p>
              </div>
              <div className="mt-6 border-t border-border/80 pt-3 flex items-center justify-between">
                <span className="text-[0.6875rem] font-mono uppercase tracking-wider text-muted-foreground">
                  Standard
                </span>
                <span className="text-xs font-medium text-foreground">{c.tag}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- why vinora */

function WhyVinora() {
  const reasons = [
    "Idea-first approach",
    "Strategy before building",
    "Design and technology together",
    "Transparent, written process",
    "Scalable solutions",
    "One point of responsibility",
  ];

  return (
    <section className="relative overflow-hidden bg-background px-5 py-12 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-7xl">
        <Reveal>
          <p className="eyebrow text-xs font-semibold tracking-[0.2em] text-foreground/85 uppercase">
            Why VINORA
          </p>
        </Reveal>

        <ul className="mt-6 border-t border-border sm:mt-8">
          {reasons.map((reason, i) => (
            <Reveal
              as="li"
              key={reason}
              index={i}
              className="group relative flex items-center gap-4 border-b border-border py-4.5 sm:gap-6 sm:py-5"
            >
              <span className="eyebrow w-8 text-xs font-medium text-foreground/70 sm:w-10">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-lg leading-none font-medium tracking-tight transition-transform duration-300 group-hover:translate-x-1 sm:text-2xl lg:text-3xl">
                {reason}
              </span>
              <ArrowUpRight className="ml-auto size-4.5 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-60 sm:-translate-x-2" />
            </Reveal>
          ))}
        </ul>

        <div className="mt-10 grid gap-px sm:grid-cols-2">
          {WHY_VINORA.map((item, i) => (
            <Reveal
              key={item.title}
              index={i}
              className="card-glow bg-background p-6 outline outline-border sm:p-7"
            >
              <h3 className="font-display text-base font-medium text-foreground sm:text-lg">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground/80">{item.copy}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------ final cta */

function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden bg-ink px-5 py-16 text-ink-foreground sm:px-8 sm:py-20">
      <div className="hero-aurora absolute inset-0 opacity-70" aria-hidden />
      <div className="noise-layer absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-7xl">
        <SplitText
          as="h2"
          text="Let's build something meaningful."
          className="display-xl max-w-4xl"
        />
        <p className="mt-6 max-w-xl text-base leading-relaxed text-ink-foreground/85 sm:mt-8 sm:text-lg">
          Tell us what you want to exist. We'll come back with a plan you can act on — whether you
          build it with us or not.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:mt-10 sm:flex-row sm:items-center">
          <Button asChild size="lg" className="cta-accent rounded-none px-7">
            <Link to="/start-project">
              Start Your Project
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
          {CONTACT_DETAILS.email ? (
            <a
              href={`mailto:${CONTACT_DETAILS.email}`}
              className="ghost-underline text-sm text-ink-foreground/85"
            >
              {CONTACT_DETAILS.email}
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
