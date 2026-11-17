import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Calendar,
  Building2,
  FolderGit2,
  Loader2,
  Sparkles,
  Layers,
  X,
} from "lucide-react";

import { Reveal } from "@/components/common/Reveal";
import { Button } from "@/components/ui/button";
import { NotConnectedState } from "@/components/common/NotConnectedState";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchPublicShowcaseProjects } from "@/services/showcase";
import type { ShowcaseProject } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PublicProjectShowcaseProps {
  headingTone?: "default" | "standalone";
  limit?: number;
}

export function PublicProjectShowcase({
  headingTone = "default",
  limit,
}: PublicProjectShowcaseProps) {
  const [projects, setProjects] = useState<ShowcaseProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<ShowcaseProject | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadShowcase() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await fetchPublicShowcaseProjects();
        if (isMounted) {
          setProjects(data);
        }
      } catch (err) {
        console.warn("Could not load public showcase projects:", err);
        if (isMounted) {
          setError("Showcase projects are temporarily unavailable.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadShowcase();
    return () => {
      isMounted = false;
    };
  }, []);

  const displayedProjects = limit ? projects.slice(0, limit) : projects;

  // 1. Loading State
  if (isLoading) {
    return (
      <section className="relative overflow-hidden bg-surface px-5 py-12 sm:px-8 sm:py-16">
        <div className="relative mx-auto max-w-7xl">
          <p className="eyebrow text-xs font-semibold tracking-[0.2em] text-foreground/85 uppercase">
            Our work
          </p>
          <div className="mt-8 flex flex-col items-center justify-center border border-border bg-card p-12 text-center">
            <Loader2 className="size-6 animate-spin text-foreground/40" />
            <p className="mt-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
              Retrieving verified project showcase...
            </p>
          </div>
        </div>
      </section>
    );
  }

  // 2. Empty State (No approved projects in Firestore yet)
  // Preserves the existing VINORA placeholder design exactly
  if (projects.length === 0 || error) {
    return (
      <section className="relative overflow-hidden bg-surface px-5 py-12 sm:px-8 sm:py-16">
        <div className="relative mx-auto max-w-7xl">
          <Reveal>
            <p className="eyebrow text-xs font-semibold tracking-[0.2em] text-foreground/85 uppercase">
              Our work
            </p>
          </Reveal>
          <div className="mt-4 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center sm:mt-6">
            <div>
              <h2 className="max-w-xl font-display text-3xl leading-[1.03] font-medium tracking-tight sm:text-5xl">
                BUILDING WHAT'S NEXT.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-foreground/80 sm:text-base">
                VINORA is building a growing portfolio of digital products, technology solutions and
                creative work. Real projects will appear here when they are ready to be shared.
              </p>
              <Button asChild size="lg" className="mt-6 rounded-none px-7 sm:mt-8">
                <Link to="/start-project">
                  Start a Project
                  <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
            </div>
            <div className="relative flex min-h-[14rem] items-center justify-center overflow-hidden border border-border bg-ink text-ink-foreground sm:min-h-[18rem]">
              <div className="project-grid absolute inset-0" aria-hidden />
              <div className="relative flex size-36 items-center justify-center border border-ink-foreground/40 sm:size-48">
                <div className="size-16 border border-ink-foreground/70 sm:size-24" />
                <span className="absolute size-2 rounded-full bg-ink-foreground shadow-[0_0_24px_6px_var(--color-ink-foreground)]" />
              </div>
              <span className="absolute bottom-4 left-4 eyebrow text-xs text-ink-muted">
                Portfolio / awaiting first publication
              </span>
            </div>
          </div>
          <NotConnectedState
            className="sr-only"
            title="No projects published yet"
            description="Real VINORA case studies will appear here once approved for publication."
          />
        </div>
      </section>
    );
  }

  // 3. Populated Showcase (Real Approved Projects from Firestore)
  return (
    <section className="relative overflow-hidden bg-surface px-5 py-12 sm:px-8 sm:py-16">
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <Reveal>
              <div className="inline-flex items-center gap-2 eyebrow text-xs font-semibold tracking-[0.2em] text-foreground/85 uppercase">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Verified Work &bull; Public Showcase
              </div>
            </Reveal>
            <h2 className="mt-3 max-w-2xl font-display text-3xl leading-[1.05] font-medium tracking-tight sm:text-5xl">
              DELIVERED INITIATIVES.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-foreground/80 sm:text-base">
              Explore real client engagements, digital platforms, and technology architectures
              designed and engineered by VINORA.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button asChild size="lg" className="rounded-none px-6">
              <Link to="/start-project">
                Start a Project
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="rounded-none px-5">
              <Link to="/projects">
                All Case Studies
                <ArrowUpRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayedProjects.map((project, idx) => (
            <Reveal key={project.id} index={idx}>
              <div
                onClick={() => setSelectedProject(project)}
                className="group relative flex flex-col justify-between border border-border bg-card p-6 transition-all duration-300 hover:border-foreground/60 hover:shadow-sm cursor-pointer h-full"
              >
                <div>
                  {/* Top Image or Architectural Blueprint Canvas */}
                  <div className="relative mb-5 aspect-[16/10] overflow-hidden border border-border bg-ink text-ink-foreground">
                    {project.imageUrl ? (
                      <img
                        src={project.imageUrl}
                        alt={project.title}
                        className="h-full w-full object-cover grayscale transition-transform duration-500 group-hover:scale-105 group-hover:grayscale-0"
                      />
                    ) : (
                      <div className="relative flex h-full w-full items-center justify-center bg-ink">
                        <div className="project-grid absolute inset-0 opacity-40" aria-hidden />
                        <div className="relative flex size-20 items-center justify-center border border-ink-foreground/30">
                          <div className="size-10 border border-ink-foreground/60" />
                          <span className="absolute size-1.5 rounded-full bg-ink-foreground shadow-[0_0_12px_3px_var(--color-ink-foreground)]" />
                        </div>
                        <span className="absolute bottom-3 left-3 font-mono text-[0.65rem] uppercase tracking-wider text-ink-muted">
                          {project.category}
                        </span>
                      </div>
                    )}
                    <div className="absolute top-3 right-3">
                      <span className="inline-flex items-center gap-1.5 border border-ink-border bg-ink/90 px-2 py-0.5 font-mono text-[0.625rem] uppercase tracking-wider text-ink-foreground backdrop-blur-xs">
                        <span className="size-1 rounded-full bg-emerald-400" />
                        Approved
                      </span>
                    </div>
                  </div>

                  {/* Meta Tags */}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground mb-2">
                    <span className="border border-border bg-background px-2 py-0.5 text-[0.65rem] uppercase">
                      {project.category}
                    </span>
                    {project.clientName && (
                      <span className="inline-flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                        <Building2 className="size-3" />
                        {project.clientName}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="font-display text-xl font-medium tracking-tight text-foreground transition-colors group-hover:text-foreground">
                    {project.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                    {project.description}
                  </p>
                </div>

                {/* Card Footer / Details */}
                <div className="mt-6 border-t border-border pt-4">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[0.65rem] text-muted-foreground">
                      {project.details?.budget
                        ? `Budget: ${project.details.budget}`
                        : "Scope: Custom Architecture"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground group-hover:underline">
                      Inspect Scope
                      <ArrowUpRight className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Selected Project Details Dialog */}
        <Dialog
          open={Boolean(selectedProject)}
          onOpenChange={(open) => !open && setSelectedProject(null)}
        >
          <DialogContent className="max-w-2xl border-border bg-card p-6 sm:p-8 rounded-none">
            {selectedProject && (
              <div>
                <DialogHeader>
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <span className="inline-flex items-center gap-1.5 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[0.65rem] uppercase text-emerald-500">
                      <span className="size-1.5 rounded-full bg-emerald-500" />
                      Verified VINORA Showcase
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      Ref: #{selectedProject.id.slice(0, 8)}
                    </span>
                  </div>
                  <DialogTitle className="font-display text-2xl font-medium tracking-tight sm:text-3xl text-left">
                    {selectedProject.title}
                  </DialogTitle>
                  <DialogDescription className="text-left font-mono text-xs text-muted-foreground">
                    {selectedProject.clientName} &bull; Category: {selectedProject.category}
                  </DialogDescription>
                </DialogHeader>

                {selectedProject.imageUrl && (
                  <div className="mt-4 max-h-64 overflow-hidden border border-border">
                    <img
                      src={selectedProject.imageUrl}
                      alt={selectedProject.title}
                      className="w-full object-cover"
                    />
                  </div>
                )}

                <div className="mt-6 space-y-4 text-left">
                  <div>
                    <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      Initiative Overview & Problem Statement
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-foreground whitespace-pre-line">
                      {selectedProject.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-y border-border py-4 font-mono text-xs">
                    <div>
                      <span className="text-muted-foreground">Client / Organization:</span>
                      <p className="font-medium text-foreground mt-0.5">
                        {selectedProject.clientName || "Direct Engagement"}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Domain / Solution:</span>
                      <p className="font-medium text-foreground mt-0.5">
                        {selectedProject.category}
                      </p>
                    </div>
                    {selectedProject.details?.timeline && (
                      <div>
                        <span className="text-muted-foreground">Timeline / Delivery:</span>
                        <p className="font-medium text-foreground mt-0.5">
                          {selectedProject.details.timeline}
                        </p>
                      </div>
                    )}
                    {selectedProject.details?.budget && (
                      <div>
                        <span className="text-muted-foreground">Engagement Scale:</span>
                        <p className="font-medium text-foreground mt-0.5">
                          {selectedProject.details.budget}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedProject.details?.scope && (
                    <div>
                      <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        Additional Technical Scope
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedProject.details.scope}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row gap-3">
                    <Button asChild className="rounded-none flex-1">
                      <Link to="/start-project" onClick={() => setSelectedProject(null)}>
                        Start Similar Project
                        <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setSelectedProject(null)}
                      className="rounded-none"
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  );
}
