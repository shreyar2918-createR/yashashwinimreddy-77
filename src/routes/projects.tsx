import { Link, createFileRoute } from "@tanstack/react-router";

import { PageHero, Section, SectionHeading } from "@/components/common/Section";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { PublicProjectShowcase } from "@/components/brand/PublicProjectShowcase";

const CASE_STUDY_STRUCTURE = [
  { title: "Client problem", copy: "What was not working, in the client's own terms." },
  { title: "VINORA approach", copy: "How the requirement was structured and sequenced." },
  { title: "Services", copy: "Which VINORA solutions were actually applied." },
  { title: "Features", copy: "What the delivered product does." },
  { title: "Technologies", copy: "The stack and integrations used." },
  { title: "Design", copy: "Interface, brand and system decisions." },
  { title: "Final result", copy: "What was handed over and what changed for the client." },
];

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Projects & Case Studies — VINORA" },
      {
        name: "description",
        content:
          "VINORA publishes full case studies — client problem, approach, services, features, technologies, design and result — as projects are completed.",
      },
      { property: "og:title", content: "Projects & Case Studies — VINORA" },
      {
        property: "og:description",
        content:
          "Case studies documenting how VINORA takes a client requirement from problem to delivered result.",
      },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Projects"
        title="Work documented properly, or not at all."
        copy="VINORA publishes case studies rather than screenshots. Each one explains the problem, the approach and the result — and only appears once the work is real and the client has approved publication."
      />

      <PublicProjectShowcase headingTone="standalone" />

      <Section tone="surface">
        <SectionHeading
          eyebrow="Case study structure"
          title="What every VINORA case study will contain."
        />
        <div className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {CASE_STUDY_STRUCTURE.map((item, i) => (
            <article key={item.title} className="bg-background p-7">
              <p className="eyebrow text-muted-foreground">{String(i + 1).padStart(2, "0")}</p>
              <h3 className="mt-3 text-base font-medium">{item.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{item.copy}</p>
            </article>
          ))}
        </div>
      </Section>
    </SiteLayout>
  );
}
