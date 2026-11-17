import { useEffect, useState } from "react";
import { FolderOpen } from "lucide-react";

import projectAiWorkspaceImg from "@/assets/images/project_ai_workspace_1794747843261.jpg";
import projectAnalyticsGrowthImg from "@/assets/images/project_analytics_growth_1794747844865.jpg";

export const PROJECT_CATEGORIES = [
  "Web & SaaS Platform",
  "AI & Automation",
  "UI/UX & Brand System",
  "Growth & Analytics",
  "Consultation & Strategy",
  "Maintenance & Retainer",
  "Custom Software Engineering",
] as const;

export interface ProjectThumbnailSubject {
  name?: string;
  title?: string;
  category?: string;
  serviceRequired?: string;
  description?: string;
  imageUrl?: string;
}

export function getCategoryFallbackThumbnail(item: ProjectThumbnailSubject): string {
  const haystack = `${item.category || ""} ${item.serviceRequired || ""} ${
    item.title || item.name || ""
  } ${item.description || ""}`.toLowerCase();

  if (
    /\b(ai|ml|machine learning|artificial intelligence|neural|llm|rag|copilot|chatbot|gpt|automation)\b/.test(
      haystack,
    )
  ) {
    return projectAiWorkspaceImg;
  }
  if (/\b(market|marketing|seo|growth|analytics|attribution|funnel)\b/.test(haystack)) {
    return projectAnalyticsGrowthImg;
  }
  if (/\b(ui|ux|design|figma|prototype|branding|brand)\b/.test(haystack)) {
    return "/images/service-ui-ux.jpg";
  }
  if (/\b(consult|consultation|strategy|advisory|roadmap)\b/.test(haystack)) {
    return "/images/service-consultation.jpg";
  }
  if (/\b(maintenance|support|retainer|sla|monitoring)\b/.test(haystack)) {
    return "/images/service-maintenance.jpg";
  }
  if (
    /\b(web|website|app|ecommerce|commerce|portal|platform|saas|frontend|backend)\b/.test(haystack)
  ) {
    return "/images/service-web-app.jpg";
  }
  return "/images/stage-development.jpg";
}

export function getProjectThumbnailSrc(item: ProjectThumbnailSubject): string {
  const custom = item.imageUrl?.trim() || "";
  if (custom.startsWith("https://") || custom.startsWith("/")) {
    return custom;
  }
  return getCategoryFallbackThumbnail(item);
}

export function ProjectThumbnailBox({
  item,
  className = "",
}: {
  item: ProjectThumbnailSubject;
  className?: string;
}) {
  const primarySrc = getProjectThumbnailSrc(item);
  const categoryFallback = getCategoryFallbackThumbnail(item);
  const [src, setSrc] = useState<string>(primarySrc);
  const [failedCompletely, setFailedCompletely] = useState(false);

  useEffect(() => {
    setSrc(primarySrc);
    setFailedCompletely(false);
  }, [primarySrc]);

  const label = item.title || item.name || "Project";

  if (failedCompletely) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-zinc-800 via-zinc-900 to-black flex flex-col items-center justify-center p-2 text-center ${className}`}
      >
        <FolderOpen className="size-5 text-zinc-400 mb-1" />
        <span className="text-[10px] font-medium text-zinc-200 line-clamp-1">{label}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt={label}
        referrerPolicy="no-referrer"
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        onError={() => {
          if (src !== categoryFallback) {
            setSrc(categoryFallback);
          } else if (src !== "/images/stage-development.jpg") {
            setSrc("/images/stage-development.jpg");
          } else {
            setFailedCompletely(true);
          }
        }}
      />
    </div>
  );
}
