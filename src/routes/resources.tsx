import { createFileRoute } from "@tanstack/react-router";

import { NotConnectedState } from "@/components/common/NotConnectedState";
import { PageHero, Section, SectionHeading } from "@/components/common/Section";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PLANNED_TOOLS, RESOURCE_CATEGORIES } from "@/content/site";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Resources — VINORA" },
      {
        name: "description",
        content:
          "Business guides, startup resources, design resources, technical articles, templates and tools published by VINORA.",
      },
      { property: "og:title", content: "Resources — VINORA" },
      {
        property: "og:description",
        content: "A growing library of practical material for founders, businesses and creators.",
      },
    ],
  }),
  component: ResourcesPage,
});

function ResourcesPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Resources"
        title="Useful material, published deliberately."
        copy="The VINORA resource library is written and maintained by the team. Items are published from the admin portal as they are ready — nothing is filled in with generic content."
      />

      <Section>
        <SectionHeading eyebrow="Categories" title="What the library will cover." />
        <div className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCE_CATEGORIES.map((item) => (
            <article key={item.title} className="bg-background p-7">
              <h3 className="text-base font-medium">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </div>
        <NotConnectedState
          className="mt-12"
          title="No resources published yet"
          description="Guides, articles, templates and tools will be listed here once the resource management system in the VINORA admin portal is connected to the platform database."
        />
      </Section>

      <Section tone="surface">
        <SectionHeading
          eyebrow="Tools"
          title="Planned VINORA tools"
          copy="These utilities are on the roadmap. They are listed as planned, not as available features."
        />
        <ul className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {PLANNED_TOOLS.map((tool) => (
            <li
              key={tool}
              className="flex items-center justify-between gap-4 bg-background p-6 text-sm"
            >
              <span>{tool}</span>
              <span className="eyebrow shrink-0 text-muted-foreground">Planned</span>
            </li>
          ))}
        </ul>
      </Section>
    </SiteLayout>
  );
}
