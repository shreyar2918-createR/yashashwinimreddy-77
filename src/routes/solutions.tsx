import { Link, createFileRoute } from "@tanstack/react-router";

import { PageHero, Section } from "@/components/common/Section";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { SOLUTION_CATEGORIES } from "@/content/site";

export const Route = createFileRoute("/solutions")({
  head: () => ({
    meta: [
      { title: "Solutions — VINORA" },
      {
        name: "description",
        content:
          "Start & strategy, brand & creative, digital products, AI & technology and growth — the solutions VINORA delivers for startups and businesses.",
      },
      { property: "og:title", content: "Solutions — VINORA" },
      {
        property: "og:description",
        content: "Strategy, brand, digital products, AI and growth solutions delivered by VINORA.",
      },
    ],
  }),
  component: SolutionsPage,
});

function SolutionsPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Solutions"
        title="What VINORA can take responsibility for."
        copy="Solutions are grouped by the outcome you are after, not by job title. If you are unsure which group your requirement belongs to, that is our job to determine."
      >
        <Button asChild size="lg" className="rounded-none px-7">
          <Link to="/start-project">Start Your Project</Link>
        </Button>
      </PageHero>

      {SOLUTION_CATEGORIES.map((category, index) => (
        <Section key={category.id} id={category.id} tone={index % 2 === 1 ? "surface" : "default"}>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
            <div>
              <p className="eyebrow text-muted-foreground">{String(index + 1).padStart(2, "0")}</p>
              <h2 className="mt-4 text-3xl font-medium sm:text-4xl">{category.title}</h2>
              <p className="mt-4 max-w-md text-muted-foreground">{category.intro}</p>
            </div>
            <ul className="grid gap-px self-start border border-border bg-border sm:grid-cols-2">
              {category.items.map((item) => (
                <li
                  key={item}
                  className="bg-background p-5 text-sm transition-colors hover:bg-surface"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Section>
      ))}

      <Section tone="ink">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-medium sm:text-4xl">
              Need something else? Tell us what you&apos;re trying to build.
            </h2>
            <p className="mt-4 text-ink-muted">
              This list is what we do most often, not a boundary. Describe the requirement and we
              will tell you honestly whether VINORA is the right partner for it.
            </p>
          </div>
          <Button asChild size="lg" variant="secondary" className="rounded-none px-7">
            <Link to="/start-project">Talk to VINORA</Link>
          </Button>
        </div>
      </Section>
    </SiteLayout>
  );
}
