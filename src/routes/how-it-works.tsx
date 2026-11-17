import { Link, createFileRoute } from "@tanstack/react-router";

import { PageHero, Section, SectionHeading } from "@/components/common/Section";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { JOURNEY, PROCESS_STEPS } from "@/content/site";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — VINORA" },
      {
        name: "description",
        content:
          "Eight clear stages from your first message to delivery and support: tell us, understand, discuss, proposal, begin, build, review, deliver.",
      },
      { property: "og:title", content: "How It Works — VINORA" },
      {
        property: "og:description",
        content:
          "The VINORA working process from requirement to delivery, with scope and pricing agreed before work begins.",
      },
    ],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="How it works"
        title="A process with no hidden steps."
        copy="Every VINORA engagement follows the same sequence. You always know which stage your project is in and what happens next."
      />

      <Section>
        <ol className="border-t border-border">
          {PROCESS_STEPS.map((step) => (
            <li
              key={step.n}
              className="grid gap-3 border-b border-border py-8 sm:grid-cols-[6rem_minmax(0,18rem)_minmax(0,1fr)] sm:items-baseline sm:gap-8"
            >
              <span className="eyebrow text-muted-foreground">{step.n}</span>
              <h2 className="text-xl font-medium">{step.title}</h2>
              <p className="text-muted-foreground">{step.copy}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section tone="surface">
        <SectionHeading
          eyebrow="Where it sits"
          title="The wider journey"
          copy="The eight working stages fit inside a longer arc that begins before the project and continues after launch."
        />
        <div className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {JOURNEY.map((stage) => (
            <div key={stage.step} className="bg-background p-7">
              <h3 className="text-base font-medium">{stage.step}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{stage.copy}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="ink">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <SectionHeading
            tone="ink"
            title="Ready to begin at stage 01?"
            copy="Submit your requirement and VINORA will review it and respond with the next step."
          />
          <Button asChild size="lg" variant="secondary" className="rounded-none px-7">
            <Link to="/start-project">Start Your Project</Link>
          </Button>
        </div>
      </Section>
    </SiteLayout>
  );
}
