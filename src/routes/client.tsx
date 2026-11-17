import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Lock,
  Circle,
  UserCheck,
  RefreshCw,
  FolderOpen,
  FileText,
  Folder,
  Receipt,
  MessageSquare,
  Copy,
  Check,
  Calendar,
  ExternalLink,
  Plus,
  AlertCircle,
  Clock,
  Layers,
  Bell,
  CreditCard,
  ChevronRight,
} from "lucide-react";

import { ClientPortalLayout } from "@/components/layout/ClientPortalLayout";
import projectAiWorkspaceImg from "@/assets/images/project_ai_workspace_1794747843261.jpg";
import projectAnalyticsGrowthImg from "@/assets/images/project_analytics_growth_1794747844865.jpg";
import { ClientProfileSection } from "@/components/auth/ClientProfileSection";
import { Button } from "@/components/ui/button";
import {
  subscribeToAuth,
  signOut,
  getClientDetailedProfile,
  type ClientDetailedData,
} from "@/services/auth";
import {
  fetchClientDashboardData,
  fetchProjectMilestones,
  normalizeMilestoneStatus,
  type ClientDashboardData,
  type ClientUpdateItem,
} from "@/services/clientDashboard";
import { WhatsAppClientChat } from "@/components/messaging/WhatsAppClientChat";
import { subscribeToUnreadCount } from "@/services/messaging";
import { ClientMeetingsSection } from "@/components/meetings/ClientMeetingsSection";
import { subscribeClientMeetings } from "@/services/meetingService";
import { ClientDocumentsSection } from "@/components/documents/ClientDocumentsSection";
import { ClientProposalsSection } from "@/components/proposals/ClientProposalsSection";
import { ClientInvoicesSection } from "@/components/invoices/ClientInvoicesSection";
import { ClientReferralSection } from "@/components/referrals/ClientReferralSection";
import {
  subscribeClientNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/services/notificationService";
import type {
  UserProfile,
  ProjectRequest,
  Milestone,
  Proposal,
  ClientDocument,
  Invoice,
  Message,
  MeetingRequest,
  Notification,
} from "@/lib/types";

function normalizeSection(raw?: string): string {
  if (!raw) return "Overview";
  const s = raw.toLowerCase().trim();
  if (s === "home" || s === "overview") return "Overview";
  if (s === "profile" || s === "my profile") return "Profile";
  if (
    s === "projects" ||
    s === "my projects" ||
    s === "project status" ||
    s === "project-status" ||
    s === "projectstatus"
  ) {
    return "Projects";
  }
  if (s === "updates" || s === "announcements" || s === "notes") return "Updates";
  if (s === "proposals") return "Proposals";
  if (s === "files" || s === "documents" || s === "document" || s === "file") return "Documents";
  if (s === "invoices" || s === "payments" || s === "payment") return "Invoices";
  if (
    s === "referrals" ||
    s === "refer & earn" ||
    s === "refer" ||
    s === "refer-earn" ||
    s === "rewards" ||
    s === "referandearn"
  ) {
    return "Refer & Earn";
  }
  if (s === "messages") return "Messages";
  if (s === "meetings" || s === "consultations" || s === "meeting") return "Meetings";
  if (s === "support") return "Support";
  return "Overview";
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  } catch {
    return dateStr;
  }
}

export type CanonicalProjectStatus =
  "Pending Review" | "Approved" | "In Progress" | "On Hold" | "Completed" | "Rejected";

export function normalizeProjectStatus(raw?: string): CanonicalProjectStatus {
  if (!raw) return "Pending Review";
  const s = raw.toLowerCase().trim();

  if (
    s.includes("reject") ||
    s.includes("cancel") ||
    s.includes("decline") ||
    s.includes("closed")
  ) {
    return "Rejected";
  }
  if (
    s.includes("complete") ||
    s.includes("delivered") ||
    s.includes("done") ||
    s.includes("finalized")
  ) {
    return "Completed";
  }
  if (s.includes("hold") || s.includes("pause") || s.includes("blocked") || s.includes("wait")) {
    return "On Hold";
  }
  if (
    s.includes("in progress") ||
    s.includes("active") ||
    s.includes("development") ||
    s.includes("design") ||
    s.includes("testing") ||
    s.includes("production")
  ) {
    return "In Progress";
  }
  if (s.includes("approved") || s.includes("accepted") || s.includes("converted")) {
    return "Approved";
  }
  return "Pending Review";
}

function getStatusBadge(status?: string) {
  const norm = normalizeProjectStatus(status);
  switch (norm) {
    case "Approved":
      return (
        <span className="inline-flex items-center gap-1.5 border border-foreground/30 bg-foreground/5 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
          <span className="size-1.5 rounded-full bg-foreground" />
          Approved
        </span>
      );
    case "In Progress":
      return (
        <span className="inline-flex items-center gap-1.5 border border-foreground/40 bg-foreground text-background px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider font-semibold">
          <span className="size-1.5 rounded-full bg-background" />
          In Progress
        </span>
      );
    case "Completed":
      return (
        <span className="inline-flex items-center gap-1.5 border border-foreground bg-background text-foreground px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider">
          <Check className="size-3 text-foreground" />
          Completed
        </span>
      );
    case "On Hold":
      return (
        <span className="inline-flex items-center gap-1.5 border border-border bg-surface px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          On Hold
        </span>
      );
    case "Rejected":
      return (
        <span className="inline-flex items-center gap-1.5 border border-border bg-background px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground line-through opacity-80">
          <span className="size-1.5 rounded-full bg-muted-foreground" />
          Rejected
        </span>
      );
    case "Pending Review":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 border border-border bg-surface/80 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
          <span className="size-1.5 rounded-full bg-foreground/60" />
          Pending Review
        </span>
      );
  }
}

export interface FormattedProjectItem {
  id: string;
  name: string;
  refId: string;
  status: CanonicalProjectStatus;
  rawStatus: string;
  submissionDate: string;
  startDate: string;
  lastUpdatedDate: string;
  expectedDate?: string;
  description: string;
  isProject: boolean;
  progress: number;
  clientUid: string;
  serviceRequired?: string;
  budget?: string;
  attachmentsCount?: number;
  email?: string;
  imageUrl?: string;
  milestones?: Milestone[];
}

export function buildFormattedProjects(dashboardData: ClientDashboardData): FormattedProjectItem[] {
  const items: FormattedProjectItem[] = [];

  for (const proj of dashboardData.projects) {
    items.push({
      id: proj.id,
      name: proj.title || "Client Project",
      refId: proj.id,
      status: normalizeProjectStatus(proj.status),
      rawStatus: proj.status || "In Progress",
      submissionDate: proj.createdAt || proj.startedAt || new Date().toISOString(),
      startDate: proj.startDate || proj.startedAt || proj.createdAt || new Date().toISOString(),
      lastUpdatedDate:
        proj.updatedAt || proj.startedAt || proj.createdAt || new Date().toISOString(),
      expectedDate: proj.expectedCompletionDate || proj.dueAt,
      description: proj.description || "Active production engagement scoped with VINORA.",
      isProject: true,
      progress: typeof proj.progress === "number" ? proj.progress : 0,
      clientUid: proj.clientId || "",
      imageUrl: proj.imageUrl,
      milestones: proj.milestones,
    });
  }

  for (const req of dashboardData.projectRequests) {
    const projectName =
      req.businessName && req.serviceRequired
        ? `${req.businessName} — ${req.serviceRequired}`
        : req.businessName || req.serviceRequired || req.name || "Project Request";

    const isDone = req.status?.toLowerCase().includes("complete");
    const isApproved = req.status?.toLowerCase().includes("approved");

    items.push({
      id: req.id,
      name: projectName,
      refId: req.id,
      status: normalizeProjectStatus(req.status),
      rawStatus: req.status || "Pending Review",
      submissionDate: req.createdAt || new Date().toISOString(),
      startDate: req.createdAt || new Date().toISOString(),
      lastUpdatedDate: req.updatedAt || req.createdAt || new Date().toISOString(),
      expectedDate: req.expectedCompletionDate,
      description: req.projectDescription || "Client technical specification and request details.",
      isProject: false,
      progress: isDone ? 100 : isApproved ? 35 : 10,
      clientUid: req.clientId || "",
      serviceRequired: req.serviceRequired,
      budget: req.budget,
      attachmentsCount: req.attachmentPaths ? req.attachmentPaths.length : 0,
      email: req.email,
      imageUrl: req.imageUrl,
    });
  }

  // Sort by newest activity date
  items.sort((a, b) => {
    const timeA = new Date(a.lastUpdatedDate || a.submissionDate).getTime();
    const timeB = new Date(b.lastUpdatedDate || b.submissionDate).getTime();
    return timeB - timeA;
  });

  return items;
}

function ProjectCard({
  item,
  onNavigate,
  onSelectProject,
}: {
  item: FormattedProjectItem;
  onNavigate?: (section: string) => void;
  onSelectProject?: (item: FormattedProjectItem) => void;
}) {
  const categoryLabel =
    item.serviceRequired || (item.isProject ? "Digital Engineering" : "Project Scope");

  return (
    <article className="group relative rounded-xl border border-border bg-card overflow-hidden transition-all hover:border-foreground/50 lift flex flex-col justify-between">
      {/* Top 16:9 Project Image */}
      <div className="p-3 pb-0">
        <ProjectThumbnail
          item={item}
          className="w-full aspect-video rounded-lg border border-border bg-zinc-900"
        />
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1">
              <span className="inline-block font-mono text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {categoryLabel}
              </span>
              <h3
                onClick={() => onSelectProject && onSelectProject(item)}
                className={`font-display text-lg font-medium tracking-tight text-foreground leading-snug ${
                  onSelectProject ? "cursor-pointer hover:underline" : ""
                }`}
              >
                {item.name}
              </h3>
            </div>
            <div className="shrink-0">{getStatusBadge(item.status)}</div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 font-mono">
              <Clock className="size-3 text-muted-foreground" />
              <span>Updated:</span>
              <span className="text-foreground/90 tabular-nums">
                {formatShortDate(item.lastUpdatedDate)}
              </span>
            </span>
            {item.expectedDate && (
              <span className="flex items-center gap-1 font-mono border-l border-border pl-3">
                <Calendar className="size-3 text-muted-foreground" />
                <span>Target:</span>
                <span className="text-foreground/90 tabular-nums">
                  {formatShortDate(item.expectedDate)}
                </span>
              </span>
            )}
            {item.budget && (
              <span className="border-l border-border pl-3 font-mono text-[11px]">
                Budget: <span className="text-foreground/90">{item.budget}</span>
              </span>
            )}
          </div>

          {item.description && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-2 font-sans">
              {item.description}
            </p>
          )}
        </div>

        <div className="space-y-3 border-t border-border/60 pt-3">
          {item.progress !== undefined && (
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5 font-mono">
                <span className="uppercase tracking-wider text-[10px]">Progress</span>
                <span className="font-semibold text-foreground tabular-nums">{item.progress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-foreground transition-all duration-700 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
            <CopyIdBadge id={item.refId} label="Ref ID" />

            <div className="flex items-center gap-2">
              {onSelectProject ? (
                <button
                  type="button"
                  onClick={() => onSelectProject(item)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-mono font-medium text-foreground hover:bg-foreground hover:text-background transition-colors cursor-pointer group"
                >
                  <span>View Dossier & Milestones</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : onNavigate ? (
                <button
                  type="button"
                  onClick={() => onNavigate("Projects")}
                  className="inline-flex items-center gap-1 text-foreground hover:underline cursor-pointer text-xs font-mono"
                >
                  <span>View in Projects</span>
                  <ArrowRight className="size-3" />
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function CopyIdBadge({ id, label = "Ref" }: { id: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy reference ID"
      className="inline-flex items-center gap-1.5 border border-border bg-surface px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground cursor-pointer"
    >
      <span>
        {label}: {id}
      </span>
      {copied ? (
        <Check className="size-3 text-emerald-500" />
      ) : (
        <Copy className="size-3 opacity-60" />
      )}
    </button>
  );
}

function getMilestoneStatusBadge(status?: string) {
  const norm = normalizeMilestoneStatus(status);
  switch (norm) {
    case "Completed":
      return (
        <span className="inline-flex items-center gap-1.5 border border-foreground bg-foreground text-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider font-medium">
          <Check className="size-3 text-background" />
          Completed
        </span>
      );
    case "In Progress":
      return (
        <span className="inline-flex items-center gap-1.5 border border-foreground/40 bg-foreground/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-foreground">
          <span className="size-1.5 rounded-full bg-foreground animate-pulse" />
          In Progress
        </span>
      );
    case "On Hold":
      return (
        <span className="inline-flex items-center gap-1.5 border border-border bg-surface px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="size-1.5 rounded-full bg-muted-foreground/60" />
          On Hold
        </span>
      );
    case "Not Started":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 border border-border bg-background px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="size-1.5 rounded-full border border-muted-foreground/60" />
          Not Started
        </span>
      );
  }
}

function ProjectDetailView({
  project,
  clientUid,
  allUpdates,
  onBack,
}: {
  project: FormattedProjectItem;
  clientUid: string;
  allUpdates?: ClientUpdateItem[];
  onBack: () => void;
}) {
  const [milestones, setMilestones] = useState<Milestone[]>(project.milestones || []);
  const [isLoadingMilestones, setIsLoadingMilestones] = useState<boolean>(true);
  const [milestoneError, setMilestoneError] = useState<string | null>(null);

  const loadMilestones = useCallback(async () => {
    // UID data isolation check (Requirement 11)
    if (project.clientUid && clientUid && project.clientUid !== clientUid) {
      setMilestoneError("Access Denied: You do not have permission to view this project.");
      setIsLoadingMilestones(false);
      return;
    }

    setIsLoadingMilestones(true);
    setMilestoneError(null);
    try {
      const items = await fetchProjectMilestones(project.refId, clientUid, project.milestones);
      setMilestones(items);
    } catch (err) {
      console.warn("Milestone fetch error:", err);
      setMilestoneError("Unable to load milestones from Firestore. Please try again.");
    } finally {
      setIsLoadingMilestones(false);
    }
  }, [project.refId, project.clientUid, project.milestones, clientUid]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  // Overall progress calculation (Requirement 8)
  const completedMilestonesCount = useMemo(
    () => milestones.filter((m) => normalizeMilestoneStatus(m.status) === "Completed").length,
    [milestones],
  );

  const computedProgress = useMemo(() => {
    if (milestones.length > 0) {
      const sum = milestones.reduce(
        (acc, m) => acc + (typeof m.progress === "number" ? m.progress : 0),
        0,
      );
      const avg = Math.round(sum / milestones.length);
      return project.progress > 0 ? project.progress : avg;
    }
    return project.progress || 0;
  }, [milestones, project.progress]);

  // Associated project updates (Requirement 9)
  const projectUpdates = useMemo(() => {
    if (!allUpdates) return [];
    return allUpdates.filter(
      (u) =>
        u.projectId === project.refId ||
        u.projectId === project.id ||
        (u.projectName && u.projectName.toLowerCase() === project.name.toLowerCase()),
    );
  }, [allUpdates, project.refId, project.id, project.name]);

  // If unauthorized access detected
  if (project.clientUid && clientUid && project.clientUid !== clientUid) {
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          className="rounded-none cursor-pointer text-xs"
        >
          <ArrowLeft className="mr-1.5 size-3" />
          Back to All Projects
        </Button>
        <div className="border border-destructive/40 bg-destructive/10 p-8 text-center">
          <AlertCircle className="mx-auto size-8 text-destructive" />
          <h3 className="mt-3 font-display text-lg text-destructive">Unauthorized Access</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            This project belongs to a different client profile and cannot be accessed from your
            account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Nav & Breadcrumbs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="rounded-none cursor-pointer text-xs h-8"
          >
            <ArrowLeft className="mr-1.5 size-3" />
            Back to Projects
          </Button>
          <span className="font-mono text-xs text-muted-foreground hidden sm:inline">
            Projects / <span className="text-foreground">{project.name}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 border border-border bg-surface px-2.5 py-1 font-mono text-[0.7rem] text-muted-foreground">
            <Lock className="size-3 text-muted-foreground" />
            Read-Only Client Workspace
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={loadMilestones}
            disabled={isLoadingMilestones}
            className="rounded-none cursor-pointer text-xs h-8"
            title="Refresh milestones from Firestore"
          >
            <RefreshCw className={`size-3 ${isLoadingMilestones ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Project Header & Metadata Grid (Requirement 3) */}
      <div className="border border-border bg-surface p-6 sm:p-8 space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-2xl sm:text-3xl text-foreground">{project.name}</h2>
              {getStatusBadge(project.status)}
            </div>
            <p className="text-xs text-muted-foreground">
              {project.isProject
                ? "Active production engagement managed by VINORA Engineering."
                : "Submitted project specification under technical evaluation."}
            </p>
          </div>
          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <CopyIdBadge id={project.refId} label="Ref ID" />
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-2 gap-4 border-t border-border/60 pt-5 sm:grid-cols-4 text-xs font-mono">
          <div className="space-y-1">
            <span className="text-muted-foreground uppercase text-[0.65rem] tracking-wider block">
              Start Date
            </span>
            <span className="text-foreground font-medium">
              {formatDate(project.startDate || project.submissionDate)}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground uppercase text-[0.65rem] tracking-wider block">
              Target Completion
            </span>
            <span className="text-foreground font-medium">
              {project.expectedDate ? formatDate(project.expectedDate) : "Scheduled in Sprints"}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground uppercase text-[0.65rem] tracking-wider block">
              Last Updated
            </span>
            <span className="text-foreground font-medium">
              {formatDate(project.lastUpdatedDate)}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-muted-foreground uppercase text-[0.65rem] tracking-wider block">
              Client UID
            </span>
            <span
              className="text-foreground truncate block font-mono text-[0.7rem]"
              title={project.clientUid || clientUid}
            >
              {project.clientUid || clientUid || "N/A"}
            </span>
          </div>
        </div>

        {/* Project Description */}
        {project.description && (
          <div className="border-t border-border/60 pt-4 space-y-1.5">
            <span className="text-muted-foreground font-mono uppercase text-[0.65rem] tracking-wider block">
              Scope Specification & Summary
            </span>
            <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
              {project.description}
            </p>
          </div>
        )}

        {/* Service and Budget tags if present */}
        {(project.serviceRequired || project.budget || project.attachmentsCount) && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border/60 pt-4 text-xs">
            {project.serviceRequired && (
              <span className="border border-border bg-background px-2.5 py-1 font-mono text-[0.7rem] text-muted-foreground">
                Service: <span className="text-foreground">{project.serviceRequired}</span>
              </span>
            )}
            {project.budget && (
              <span className="border border-border bg-background px-2.5 py-1 font-mono text-[0.7rem] text-muted-foreground">
                Budget Allocation: <span className="text-foreground">{project.budget}</span>
              </span>
            )}
            {project.attachmentsCount ? (
              <span className="border border-border bg-background px-2.5 py-1 font-mono text-[0.7rem] text-muted-foreground">
                {project.attachmentsCount} Attachment(s) on file
              </span>
            ) : null}
          </div>
        )}
      </div>

      {/* Visual Overall Project Progress (Requirement 8) */}
      <section className="border border-border bg-surface p-6 sm:p-7 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="font-display text-lg text-foreground">Overall Project Progress</h3>
            <p className="text-xs text-muted-foreground">
              {milestones.length > 0
                ? `${completedMilestonesCount} of ${milestones.length} milestones completed (${computedProgress}% overall progress)`
                : `Current phase completion: ${computedProgress}%`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-semibold text-foreground">
              {computedProgress}%
            </span>
          </div>
        </div>

        {/* Visual Progress Bar in VINORA monochrome aesthetic */}
        <div className="h-2.5 w-full bg-border overflow-hidden">
          <div
            className="h-full bg-foreground transition-all duration-700 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, computedProgress))}%` }}
          />
        </div>

        {milestones.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border/50 text-[0.7rem] font-mono text-muted-foreground">
            <div>
              Total Milestones:{" "}
              <span className="text-foreground font-medium">{milestones.length}</span>
            </div>
            <div>
              Completed:{" "}
              <span className="text-emerald-500 font-medium">{completedMilestonesCount}</span>
            </div>
            <div>
              In Progress:{" "}
              <span className="text-blue-500 font-medium">
                {
                  milestones.filter((m) => normalizeMilestoneStatus(m.status) === "In Progress")
                    .length
                }
              </span>
            </div>
            <div>
              On Hold / Queued:{" "}
              <span className="text-foreground font-medium">
                {
                  milestones.filter(
                    (m) =>
                      normalizeMilestoneStatus(m.status) === "Not Started" ||
                      normalizeMilestoneStatus(m.status) === "On Hold",
                  ).length
                }
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Milestone Timeline (Requirements 5, 6, 7) */}
      <section className="space-y-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-display text-xl text-foreground">Milestone Delivery Timeline</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Production phases, verifiable engineering deliverables, and scheduled sprint targets.
            </p>
          </div>
          <span className="border border-border bg-surface px-2.5 py-1 font-mono text-xs self-start sm:self-auto">
            {milestones.length} {milestones.length === 1 ? "Milestone" : "Milestones"}
          </span>
        </div>

        {/* Loading state (Requirement 13) */}
        {isLoadingMilestones && (
          <div className="border border-border bg-surface p-8 text-center text-xs text-muted-foreground animate-pulse flex items-center justify-center gap-2">
            <RefreshCw className="size-4 animate-spin text-foreground" />
            <span>Fetching project milestone timeline from Firestore...</span>
          </div>
        )}

        {/* Error state (Requirement 13) */}
        {milestoneError && (
          <div className="border border-destructive/40 bg-destructive/10 p-4 text-xs flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{milestoneError}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-none text-xs h-7 cursor-pointer"
              onClick={loadMilestones}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Milestone Timeline List */}
        {!isLoadingMilestones &&
          !milestoneError &&
          (milestones.length > 0 ? (
            <div className="relative border-l border-border pl-6 space-y-6 sm:pl-8 sm:space-y-8 ml-3 sm:ml-4 py-2">
              {milestones.map((m, idx) => {
                const norm = normalizeMilestoneStatus(m.status);
                return (
                  <div key={m.id || idx} className="relative group">
                    {/* Timeline Node Marker */}
                    {norm === "Completed" ? (
                      <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 flex size-6 sm:size-7 items-center justify-center rounded-full bg-foreground text-background border-2 border-background ring-1 ring-border">
                        <Check className="size-3.5" />
                      </span>
                    ) : norm === "In Progress" ? (
                      <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 flex size-6 sm:size-7 items-center justify-center rounded-full border-2 border-foreground bg-background text-foreground shadow-sm">
                        <span className="size-2 rounded-full bg-foreground animate-ping" />
                      </span>
                    ) : norm === "On Hold" ? (
                      <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 flex size-6 sm:size-7 items-center justify-center rounded-full border border-border bg-surface text-muted-foreground">
                        <Clock className="size-3" />
                      </span>
                    ) : (
                      <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 flex size-6 sm:size-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground/50">
                        <Circle className="size-2.5" />
                      </span>
                    )}

                    {/* Milestone Card */}
                    <article className="border border-border bg-surface p-4 sm:p-5 transition-colors hover:border-foreground/30 space-y-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">
                              Phase {idx + 1}
                            </span>
                            <h4 className="font-medium text-sm sm:text-base text-foreground">
                              {m.title}
                            </h4>
                            {getMilestoneStatusBadge(m.status)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-xs font-medium text-foreground border border-border px-2 py-0.5 bg-background">
                            {m.progress}%
                          </span>
                        </div>
                      </div>

                      {m.description && (
                        <p className="text-xs leading-relaxed text-muted-foreground whitespace-pre-line">
                          {m.description}
                        </p>
                      )}

                      {/* Milestone Progress Bar */}
                      <div>
                        <div className="h-1.5 w-full bg-border overflow-hidden">
                          <div
                            className="h-full bg-foreground transition-all duration-500"
                            style={{ width: `${Math.min(100, Math.max(0, m.progress))}%` }}
                          />
                        </div>
                      </div>

                      {/* Date Stamps (Requirement 6) */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border/40 pt-2.5 text-[0.7rem] text-muted-foreground font-mono">
                        {(m.dueDate || m.deadline) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="size-3 text-muted-foreground" />
                            <span>Due:</span>
                            <span className="text-foreground/90">
                              {formatDate(m.dueDate || m.deadline)}
                            </span>
                          </span>
                        )}
                        {(m.completedDate || m.completedAt) && (
                          <span className="flex items-center gap-1 border-l border-border pl-4">
                            <Check className="size-3 text-emerald-500" />
                            <span>Completed:</span>
                            <span className="text-foreground/90">
                              {formatDate(m.completedDate || m.completedAt)}
                            </span>
                          </span>
                        )}
                        {(m.updatedAt || m.createdAt) && (
                          <span className="flex items-center gap-1 border-l border-border pl-4">
                            <Clock className="size-3 text-muted-foreground" />
                            <span>Updated:</span>
                            <span className="text-foreground/90">
                              {formatDate(m.updatedAt || m.createdAt)}
                            </span>
                          </span>
                        )}
                      </div>
                    </article>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-border bg-surface p-8 text-center">
              <Layers className="mx-auto size-8 text-muted-foreground/60" />
              <h4 className="mt-3 font-medium text-base text-foreground">
                Milestones in Architectural Scoping
              </h4>
              <p className="mx-auto mt-1.5 max-w-md text-xs text-muted-foreground leading-relaxed">
                Detailed delivery milestones and technical checkpoints for this project are
                currently being structured by the VINORA engineering team lead. Milestones will
                populate automatically as sprint planning concludes.
              </p>
            </div>
          ))}
      </section>

      {/* Latest Project Updates & Notes (Requirement 9) */}
      <section className="space-y-4 border-t border-border pt-8">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-lg text-foreground">Latest Project Updates & Notes</h3>
            <span className="border border-border bg-surface px-2 py-0.5 font-mono text-xs">
              {projectUpdates.length}
            </span>
          </div>
        </div>

        {projectUpdates.length > 0 ? (
          <div className="space-y-3">
            {projectUpdates.map((upd) => (
              <article
                key={upd.id}
                className="border border-border bg-surface p-4 transition-colors hover:border-foreground/30"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="border border-border bg-background px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-muted-foreground">
                      {upd.category}
                    </span>
                    <h4 className="font-medium text-sm text-foreground">{upd.title}</h4>
                  </div>
                  <span className="font-mono text-[0.7rem] text-muted-foreground">
                    {formatDate(upd.date)}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {upd.description}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="border border-border bg-surface/50 p-6 text-center text-xs text-muted-foreground">
            No updates published for this project yet. Engineering sprint notes and status briefings
            will appear here.
          </div>
        )}
      </section>

      {/* Read-Only Notice (Requirement 10) */}
      <div className="border border-border bg-surface p-4 flex items-start gap-3 text-xs text-muted-foreground">
        <Lock className="size-4 shrink-0 mt-0.5 text-foreground/80" />
        <div className="space-y-1">
          <span className="font-medium text-foreground">Read-Only Client Specification</span>
          <p className="leading-relaxed">
            Project deliverables, milestone schedules, completion percentages, and status
            designations are maintained and audited exclusively by your assigned VINORA engineering
            lead. Clients do not have direct write permissions on milestone data. For scope
            adjustments, contact your dedicated lead.
          </p>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/client")({
  validateSearch: (search: Record<string, unknown>): { section?: string; tab?: string } => ({
    section: typeof search.section === "string" ? search.section : undefined,
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Client portal — VINORA" },
      {
        name: "description",
        content:
          "The VINORA client portal: profile management, project status, milestones, files, proposals, invoices and direct communication.",
      },
      { property: "og:title", content: "Client portal — VINORA" },
      {
        property: "og:description",
        content: "Full visibility and management of your account and project with VINORA.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ClientPortalPage,
});

function ClientPortalPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authResolved, setAuthResolved] = useState(false);

  const initialSection = normalizeSection(search.section || search.tab);
  const [activeSection, setActiveSection] = useState<string>(initialSection);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Firestore dashboard data scoped to authenticated client
  const [dashboardData, setDashboardData] = useState<ClientDashboardData>({
    projectRequests: [],
    projects: [],
    proposals: [],
    documents: [],
    invoices: [],
    messages: [],
    updates: [],
  });
  const [detailedProfile, setDetailedProfile] = useState<ClientDetailedData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Unread messages count, live notifications, and client meetings
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [clientMeetings, setClientMeetings] = useState<MeetingRequest[]>([]);
  const [clientNotifications, setClientNotifications] = useState<Notification[]>([]);

  // Subscribe to unread messages in real-time
  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeToUnreadCount("client", profile.id, (count) => {
      setUnreadMessagesCount(count);
    });
    return () => unsub();
  }, [profile?.id]);

  // Subscribe to client meetings in real-time
  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeClientMeetings(profile.id, (list) => {
      setClientMeetings(list);
    });
    return () => unsub();
  }, [profile?.id]);

  // Subscribe to client in-app notifications in real-time
  useEffect(() => {
    if (!profile?.id) return;
    const unsub = subscribeClientNotifications(profile.id, (list) => {
      setClientNotifications(list);
    });
    return () => unsub();
  }, [profile?.id]);

  // Derived badge counts for sidebar items
  const upcomingMeetingsCount = useMemo(
    () =>
      clientMeetings.filter(
        (m) => m.status === "Approved" || m.status === "Pending" || m.status === "Rescheduled",
      ).length,
    [clientMeetings],
  );
  const pendingProposalsCount = useMemo(
    () =>
      dashboardData.proposals.filter((p) => p.status === "Sent" || p.status === "Pending Review")
        .length,
    [dashboardData.proposals],
  );

  // Sync with auth changes
  useEffect(() => {
    return subscribeToAuth((user) => {
      setProfile(user);
      setAuthResolved(true);
    });
  }, []);

  // Redirection guard for unauthenticated visitors (Requirement 11)
  useEffect(() => {
    if (authResolved && !profile) {
      navigate({
        to: "/login",
        search: { role: "client", mode: "login" },
      });
    }
  }, [authResolved, profile, navigate]);

  // Fetch Firestore data for authenticated client
  const loadClientData = useCallback(async (clientUser: UserProfile) => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const data = await fetchClientDashboardData(clientUser.id, clientUser.email);
      setDashboardData(data);
    } catch (err) {
      console.error("Failed to load client dashboard records:", err);
      setDataError("Unable to retrieve all client records from Firestore.");
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (profile?.id) {
      getClientDetailedProfile(profile.id).then((det) => {
        if (det) setDetailedProfile(det);
      });
      loadClientData(profile);
    }
  }, [profile, loadClientData]);

  // Handle section navigation
  function handleSelectNav(label: string) {
    const norm = normalizeSection(label);
    setActiveSection(norm);
    if (norm !== "Projects") {
      setSelectedProjectId(null);
    }
    if (norm === "Overview") {
      navigate({ search: (prev) => ({ ...prev, section: undefined, tab: undefined }) });
    } else {
      navigate({ search: (prev) => ({ ...prev, section: norm.toLowerCase(), tab: undefined }) });
    }
  }

  // Synchronize section with URL search changes
  useEffect(() => {
    const currentFromUrl = normalizeSection(search.section || search.tab);
    if (currentFromUrl !== activeSection) {
      setActiveSection(currentFromUrl);
    }
  }, [search.section, search.tab, activeSection]);

  async function handleSignOut() {
    await signOut();
    window.location.href = "/login?role=client&mode=login";
  }

  const clientDisplayName =
    detailedProfile?.fullName || profile?.fullName || profile?.email?.split("@")[0] || "Client";

  return (
    <ClientPortalLayout
      activeSection={activeSection}
      onSelectSection={handleSelectNav}
      onSignOut={handleSignOut}
      clientName={clientDisplayName}
      clientEmail={detailedProfile?.email || profile?.email}
      unreadMessagesCount={unreadMessagesCount}
      pendingProposalsCount={pendingProposalsCount}
      upcomingMeetingsCount={upcomingMeetingsCount}
      notifications={clientNotifications}
      showStudioBackground={Boolean(profile)}
      onMarkNotificationRead={(id) => {
        void markNotificationAsRead(id);
      }}
      onMarkAllNotificationsRead={() => {
        void markAllNotificationsAsRead(clientNotifications);
      }}
    >
      {/* 1. Loading State */}
      {!authResolved ? (
        <div className="rounded-2xl border border-white/10 bg-[#121216] p-12 text-center text-xs uppercase tracking-widest text-zinc-400 animate-pulse">
          Verifying client authentication session...
        </div>
      ) : /* 2. Unauthenticated Guard */
      !profile ? (
        <div className="rounded-2xl border border-white/10 bg-[#121216] p-8 text-center sm:p-12">
          <UserCheck className="mx-auto size-10 text-zinc-500" />
          <h3 className="mt-4 font-display text-2xl text-white">
            Authenticated Client Access Required
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-zinc-400 leading-relaxed">
            The VINORA client dashboard is protected and scoped strictly to authorized client
            accounts. Please sign in to access your projects, proposals, deliverables, payments, and
            private communication.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-lg cursor-pointer">
              <Link to="/login" search={{ role: "client", mode: "login" }}>
                Sign in to Client Portal
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-lg cursor-pointer">
              <Link to="/start-project">Submit a Project Request</Link>
            </Button>
          </div>
        </div>
      ) : /* 3. Authenticated Client Views */
      activeSection === "Profile" ? (
        <ClientProfileSection
          initialProfile={profile}
          onProfileUpdated={(updated) => setProfile(updated)}
        />
      ) : activeSection === "Projects" ? (
        <ProjectsSection
          dashboardData={dashboardData}
          isLoading={isLoadingData}
          dataError={dataError}
          onRefresh={() => profile && loadClientData(profile)}
          onNavigate={handleSelectNav}
          clientUid={profile.id}
          selectedProjectId={selectedProjectId}
          onSelectProject={setSelectedProjectId}
        />
      ) : activeSection === "Updates" ? (
        <UpdatesSection
          updates={dashboardData.updates}
          isLoading={isLoadingData}
          onRefresh={() => profile && loadClientData(profile)}
          onNavigate={handleSelectNav}
        />
      ) : activeSection === "Proposals" ? (
        <ClientProposalsSection profile={profile} />
      ) : activeSection === "Documents" || activeSection === "Files" ? (
        <ClientDocumentsSection profile={profile} projectRequests={dashboardData.projectRequests} />
      ) : activeSection === "Invoices" ? (
        <ClientInvoicesSection profile={profile} />
      ) : activeSection === "Refer & Earn" || activeSection === "Referrals" ? (
        <ClientReferralSection profile={profile} />
      ) : activeSection === "Messages" ? (
        <MessagesSection
          profile={profile}
          messages={dashboardData.messages}
          isLoading={isLoadingData}
          onRefresh={() => profile && loadClientData(profile)}
        />
      ) : activeSection === "Meetings" ? (
        <ClientMeetingsSection profile={profile} projects={dashboardData.projects} />
      ) : activeSection === "Support" ? (
        <SupportSection profile={profile} onNavigate={handleSelectNav} />
      ) : (
        /* Home (Overview Section) */
        <OverviewSection
          profile={profile}
          detailedProfile={detailedProfile}
          dashboardData={dashboardData}
          meetings={clientMeetings}
          notifications={clientNotifications}
          isLoading={isLoadingData}
          dataError={dataError}
          onRefresh={() => profile && loadClientData(profile)}
          onNavigate={handleSelectNav}
          onSelectProject={(projectId) => {
            setSelectedProjectId(projectId);
            handleSelectNav("Projects");
          }}
        />
      )}
    </ClientPortalLayout>
  );
}

// -------------------------------------------------------------
// Project Thumbnail & Update Feed Helpers
// -------------------------------------------------------------

function getCategoryFallbackThumbnail(item: FormattedProjectItem): string {
  const haystack =
    `${item.serviceRequired || ""} ${item.name} ${item.description || ""}`.toLowerCase();
  if (
    /\b(ai|ml|machine learning|artificial intelligence|neural|llm|rag|copilot|chatbot|gpt)\b/.test(
      haystack,
    )
  ) {
    return projectAiWorkspaceImg;
  }
  if (/\b(market|marketing|seo|growth|analytics|attribution|funnel)\b/.test(haystack)) {
    return projectAnalyticsGrowthImg;
  }
  if (/\b(ui|ux|design|figma|prototype|branding)\b/.test(haystack)) {
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

function getProjectThumbnail(item: FormattedProjectItem): string {
  const custom = item.imageUrl?.trim() || "";
  if (custom.startsWith("https://") || custom.startsWith("/")) {
    return custom;
  }
  return getCategoryFallbackThumbnail(item);
}

function ProjectThumbnail({
  item,
  className = "",
}: {
  item: FormattedProjectItem;
  className?: string;
}) {
  const primarySrc = getProjectThumbnail(item);
  const categoryFallback = getCategoryFallbackThumbnail(item);
  const [src, setSrc] = useState<string>(primarySrc);
  const [failedCompletely, setFailedCompletely] = useState(false);

  useEffect(() => {
    setSrc(primarySrc);
    setFailedCompletely(false);
  }, [primarySrc]);

  if (failedCompletely) {
    return (
      <div
        className={`relative overflow-hidden bg-gradient-to-br from-slate-800 via-zinc-800 to-slate-900 flex flex-col items-center justify-center p-2 text-center ${className}`}
      >
        <FolderOpen className="size-5 text-blue-400 mb-1" />
        <span className="text-[10px] font-medium text-zinc-200 line-clamp-1">{item.name}</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={src}
        alt={item.name}
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

function getCompactStatusPill(status: CanonicalProjectStatus) {
  switch (status) {
    case "In Progress":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/15 border border-blue-400/25 px-2.5 py-0.5 text-[11px] font-medium text-blue-300 shrink-0">
          <span className="size-1.5 rounded-full bg-blue-400" />
          In Progress
        </span>
      );
    case "Approved":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 shrink-0">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Approved
        </span>
      );
    case "Completed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/25 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300 shrink-0">
          <Check className="size-3" />
          Completed
        </span>
      );
    case "On Hold":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-700/40 border border-zinc-600/40 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 shrink-0">
          On Hold
        </span>
      );
    case "Rejected":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 border border-rose-400/25 px-2.5 py-0.5 text-[11px] font-medium text-rose-300 shrink-0">
          Declined
        </span>
      );
    case "Pending Review":
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-400/25 px-2.5 py-0.5 text-[11px] font-medium text-amber-300 shrink-0">
          <span className="size-1.5 rounded-full bg-amber-400" />
          Pending Review
        </span>
      );
  }
}

interface FeedActivityEntry {
  id: string;
  kind: "project" | "payment" | "meeting" | "proposal" | "announcement";
  title: string;
  description: string;
  date: string;
  targetSection: string;
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

// -------------------------------------------------------------
// Section Component: Home (Overview)
// -------------------------------------------------------------

function OverviewSection({
  profile,
  detailedProfile,
  dashboardData,
  meetings,
  notifications = [],
  isLoading,
  dataError,
  onRefresh,
  onNavigate,
  onSelectProject,
}: {
  profile: UserProfile;
  detailedProfile: ClientDetailedData | null;
  dashboardData: ClientDashboardData;
  meetings: MeetingRequest[];
  notifications?: Notification[];
  isLoading: boolean;
  dataError: string | null;
  onRefresh: () => void;
  onNavigate: (section: string) => void;
  onSelectProject?: (projectId: string) => void;
}) {
  const formattedProjects = useMemo(() => buildFormattedProjects(dashboardData), [dashboardData]);

  const clientDisplayName =
    detailedProfile?.fullName?.trim() ||
    profile.fullName?.trim() ||
    profile.email?.split("@")[0] ||
    "Client";

  // Dynamic Firestore-derived summary metrics (zero fake numbers)
  const overviewMetrics = useMemo(() => {
    const activeProjectsCount = formattedProjects.filter(
      (p) => p.status === "In Progress" || p.status === "Approved",
    ).length;

    const pendingProposalsCount = (dashboardData.proposals || []).filter((p) => {
      const s = (p.status || "").toLowerCase();
      return s === "sent" || s === "pending" || s === "pending review";
    }).length;

    const pendingInvoices = (dashboardData.invoices || []).filter((inv) => {
      const s = (inv.status || "").toLowerCase();
      return s !== "paid" && s !== "cancelled";
    });
    const pendingPaymentsAmount = pendingInvoices.reduce((sum, inv) => {
      const rawBal = inv.balanceDue !== undefined ? inv.balanceDue : inv.total;
      return sum + (Number(rawBal) || 0);
    }, 0);
    const primaryCurrency =
      pendingInvoices[0]?.currency || dashboardData.invoices[0]?.currency || "INR";

    const upcomingMeetingsCount = (meetings || []).filter(
      (m) => m.status === "Approved" || m.status === "Rescheduled" || m.status === "Pending",
    ).length;

    return {
      activeProjectsCount,
      totalProjectsCount: formattedProjects.length,
      pendingProposalsCount,
      pendingPaymentsCount: pendingInvoices.length,
      pendingPaymentsAmount,
      primaryCurrency,
      upcomingMeetingsCount,
    };
  }, [formattedProjects, dashboardData.proposals, dashboardData.invoices, meetings]);

  // Build genuine recent updates feed from notifications, project updates, invoices, meetings, and proposals
  const feedUpdates = useMemo<FeedActivityEntry[]>(() => {
    const entries: FeedActivityEntry[] = [];

    for (const notif of notifications || []) {
      const t = (notif.type || "").toLowerCase();
      let kind: FeedActivityEntry["kind"] = "announcement";
      let targetSection = "Updates";
      if (t.includes("meeting")) {
        kind = "meeting";
        targetSection = "Meetings";
      } else if (t.includes("payment") || t.includes("invoice")) {
        kind = "payment";
        targetSection = "Invoices";
      } else if (t.includes("proposal")) {
        kind = "proposal";
        targetSection = "Proposals";
      } else if (t.includes("project") || notif.projectId) {
        kind = "project";
        targetSection = "Projects";
      }
      entries.push({
        id: `notif-${notif.id}`,
        kind,
        title: notif.title,
        description: notif.body,
        date: notif.createdAt || new Date().toISOString(),
        targetSection,
      });
    }

    for (const upd of dashboardData.updates || []) {
      const cat = (upd.category || "").toLowerCase();
      let kind: FeedActivityEntry["kind"] = "announcement";
      if (cat.includes("project") || cat.includes("milestone") || upd.projectId) {
        kind = "project";
      } else if (cat.includes("payment") || cat.includes("invoice")) {
        kind = "payment";
      } else if (cat.includes("meeting")) {
        kind = "meeting";
      } else if (cat.includes("proposal")) {
        kind = "proposal";
      }
      entries.push({
        id: `upd-${upd.id}`,
        kind,
        title: upd.title,
        description: upd.description,
        date: upd.date,
        targetSection: "Updates",
      });
    }

    for (const inv of dashboardData.invoices || []) {
      const isPaid = (inv.status || "").toLowerCase() === "paid";
      entries.push({
        id: `inv-${inv.id}`,
        kind: "payment",
        title: isPaid
          ? `Payment received — ${inv.invoiceNumber || inv.number || "Invoice"}`
          : `Payment ${inv.status || "Pending"} — ${inv.invoiceNumber || inv.number || "Invoice"}`,
        description: `${inv.currency || "INR"} ${(inv.totalAmount ?? inv.total ?? 0).toLocaleString()} billing record`,
        date: inv.updatedAt || inv.issuedAt || inv.createdAt || new Date().toISOString(),
        targetSection: "Invoices",
      });
    }

    for (const mtg of meetings || []) {
      entries.push({
        id: `mtg-${mtg.id}`,
        kind: "meeting",
        title: `Meeting ${mtg.status || "Scheduled"}: ${mtg.title || mtg.projectTitle || "Consultation"}`,
        description: mtg.preferredDate
          ? `${formatShortDate(mtg.preferredDate)}${mtg.preferredTime ? ` at ${mtg.preferredTime}` : ""}`
          : "Consultation with VINORA team",
        date: mtg.updatedAt || mtg.createdAt || mtg.preferredDate || new Date().toISOString(),
        targetSection: "Meetings",
      });
    }

    for (const prop of dashboardData.proposals || []) {
      entries.push({
        id: `prop-${prop.id}`,
        kind: "proposal",
        title: `Proposal ${prop.status || "Issued"}`,
        description:
          prop.title ||
          (prop.scope
            ? `${prop.scope.slice(0, 72)}${prop.scope.length > 72 ? "…" : ""}`
            : "Scope & investment proposal"),
        date: prop.updatedAt || prop.createdAt || new Date().toISOString(),
        targetSection: "Proposals",
      });
    }

    entries.sort((a, b) => {
      const tA = new Date(a.date).getTime();
      const tB = new Date(b.date).getTime();
      return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
    });

    return entries.slice(0, 5);
  }, [
    notifications,
    dashboardData.updates,
    dashboardData.invoices,
    dashboardData.proposals,
    meetings,
  ]);

  const summaryCards = [
    {
      title: "Active Projects",
      count: overviewMetrics.activeProjectsCount,
      subtitle:
        overviewMetrics.totalProjectsCount > 0
          ? `${overviewMetrics.totalProjectsCount} total scoped`
          : "No projects yet",
      icon: FolderOpen,
      iconWrapperClass: "bg-white/10 border border-white/15 text-white",
      target: "Projects",
    },
    {
      title: "Pending Proposals",
      count: overviewMetrics.pendingProposalsCount,
      subtitle:
        overviewMetrics.pendingProposalsCount > 0
          ? "Awaiting your decision"
          : "No pending proposals",
      icon: FileText,
      iconWrapperClass: "bg-white/10 border border-white/15 text-white",
      target: "Proposals",
    },
    {
      title: "Pending Payments",
      count: overviewMetrics.pendingPaymentsCount,
      subtitle:
        overviewMetrics.pendingPaymentsCount > 0
          ? `${overviewMetrics.primaryCurrency} ${overviewMetrics.pendingPaymentsAmount.toLocaleString()} balance due`
          : "All accounts settled",
      icon: CreditCard,
      iconWrapperClass: "bg-white/10 border border-white/15 text-white",
      target: "Invoices",
    },
    {
      title: "Upcoming Meetings",
      count: overviewMetrics.upcomingMeetingsCount,
      subtitle:
        overviewMetrics.upcomingMeetingsCount > 0
          ? "Scheduled or under review"
          : "No upcoming meetings",
      icon: Calendar,
      iconWrapperClass: "bg-white/10 border border-white/15 text-white",
      target: "Meetings",
    },
  ];

  return (
    <div className="space-y-8">
      {/* 1. Main Welcome Section */}
      <section className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white drop-shadow-xs">
            Welcome back, {clientDisplayName}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-200/90">Manage your projects and stay updated.</p>
        </div>

        {isLoading && (
          <div className="inline-flex items-center gap-2 text-xs text-zinc-300">
            <RefreshCw className="size-3.5 animate-spin text-zinc-200" />
            <span>Syncing workspace...</span>
          </div>
        )}
      </section>

      {/* Error banner with retry if Firestore read failed */}
      {dataError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/60 backdrop-blur-md p-4 text-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2 text-rose-200">
            <AlertCircle className="size-4 shrink-0" />
            <span>{dataError}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg text-xs h-8 cursor-pointer shrink-0"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-1.5 size-3 ${isLoading ? "animate-spin" : ""}`} />
            Retry
          </Button>
        </div>
      )}

      {/* 2. Summary Cards (4 real-time Firestore metric cards as dark translucent panels) */}
      <section aria-label="Portal summary">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.title}
                type="button"
                onClick={() => onNavigate(card.target)}
                className="group flex items-center justify-between gap-3 rounded-xl bg-[#0d0d12]/74 hover:bg-[#14141c]/84 backdrop-blur-md border border-white/[0.14] hover:border-white/25 p-4 sm:p-5 text-left transition-all duration-200 hover:-translate-y-0.5 shadow-lg cursor-pointer"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-xl mt-0.5 ${card.iconWrapperClass}`}
                  >
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xs font-semibold text-zinc-300 leading-tight">
                      {card.title}
                    </h2>
                    <p className="text-2xl font-semibold text-white tabular-nums leading-tight mt-1">
                      {card.count}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug tabular-nums">
                      {card.subtitle}
                    </p>
                  </div>
                </div>
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-zinc-200 group-hover:bg-white group-hover:text-zinc-950 transition-all group-hover:translate-x-0.5">
                  <ChevronRight className="size-4" />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 3. Lower Dashboard Sections: Recent Updates + My Projects */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT CARD: Recent Updates */}
        <div className="lg:col-span-5 rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md shadow-xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
              <h2 className="font-display text-base sm:text-lg font-semibold text-white">
                Recent Updates
              </h2>
              <button
                type="button"
                onClick={() => onNavigate("Updates")}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>

            {feedUpdates.length > 0 ? (
              <div className="mt-4 space-y-2.5">
                {feedUpdates.map((item) => {
                  const Icon =
                    item.kind === "project"
                      ? FolderOpen
                      : item.kind === "payment"
                        ? CreditCard
                        : item.kind === "meeting"
                          ? Calendar
                          : item.kind === "proposal"
                            ? FileText
                            : Bell;

                  const iconTint =
                    item.kind === "project"
                      ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
                      : item.kind === "payment"
                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                        : item.kind === "meeting"
                          ? "bg-violet-500/15 text-violet-400 border-violet-500/20"
                          : item.kind === "proposal"
                            ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
                            : "bg-zinc-800 text-zinc-300 border-white/10";

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onNavigate(item.targetSection)}
                      className="w-full flex items-start gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.05] p-3.5 text-left transition-colors cursor-pointer"
                    >
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${iconTint}`}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-zinc-100 truncate">{item.title}</p>
                          <span className="text-[11px] text-zinc-500 shrink-0 tabular-nums">
                            {formatShortDate(item.date)}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">
                          {item.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <Bell className="mx-auto size-8 text-zinc-500" />
                <p className="mt-3 text-sm font-medium text-zinc-200">No recent updates yet</p>
                <p className="mt-1 text-xs text-zinc-500 max-w-xs mx-auto">
                  Project milestones, payment statuses, and meeting updates will appear here as your
                  engagement progresses.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT CARD: My Projects (16:9 top images + Name, Category, Status, Progress %, Last Updated) */}
        <div className="lg:col-span-7 rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md shadow-xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
              <h2 className="font-display text-base sm:text-lg font-semibold text-white">
                My Projects
              </h2>
              <button
                type="button"
                onClick={() => onNavigate("Projects")}
                className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="size-3.5" />
              </button>
            </div>

            {formattedProjects.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {formattedProjects.slice(0, 4).map((item) => {
                  const pct = Math.min(100, Math.max(0, Math.round(item.progress ?? 0)));
                  const categoryLabel =
                    item.serviceRequired ||
                    (item.isProject ? "Digital Engineering" : "Project Scope");

                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        onSelectProject ? onSelectProject(item.id) : onNavigate("Projects")
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (onSelectProject) {
                            onSelectProject(item.id);
                          } else {
                            onNavigate("Projects");
                          }
                        }
                      }}
                      className="group flex flex-col rounded-xl border border-white/[0.10] bg-black/45 hover:bg-black/60 overflow-hidden transition-colors cursor-pointer"
                    >
                      <div className="p-2.5 pb-0">
                        <ProjectThumbnail
                          item={item}
                          className="w-full aspect-video rounded-lg border border-white/10 bg-zinc-900"
                        />
                      </div>

                      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 truncate">
                              {categoryLabel}
                            </span>
                            {getCompactStatusPill(item.status)}
                          </div>
                          <h3 className="text-sm font-semibold text-white truncate group-hover:text-zinc-100">
                            {item.name}
                          </h3>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center justify-between text-[11px] mb-1">
                              <span className="text-zinc-400">Progress</span>
                              <span className="font-medium text-zinc-200 tabular-nums">{pct}%</span>
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-white transition-all duration-500"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-white/[0.06]">
                            <span>Last updated</span>
                            <span className="text-zinc-300 tabular-nums">
                              {formatShortDate(item.lastUpdatedDate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                <FolderOpen className="mx-auto size-8 text-zinc-500" />
                <p className="mt-3 text-sm font-medium text-zinc-200">No active projects yet</p>
                <p className="mt-1 text-xs text-zinc-500 max-w-xs mx-auto">
                  Start a new project request and your timeline, deliverables, and progress will
                  appear here.
                </p>
                <div className="mt-4">
                  <Button asChild size="sm" className="rounded-lg cursor-pointer">
                    <Link to="/start-project">
                      <Plus className="mr-1.5 size-3.5" />
                      Start Your Project
                    </Link>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

// -------------------------------------------------------------
// Section Component: Projects
// -------------------------------------------------------------

function ProjectsSection({
  dashboardData,
  isLoading,
  dataError,
  onRefresh,
  onNavigate,
  clientUid,
  selectedProjectId,
  onSelectProject,
}: {
  dashboardData: ClientDashboardData;
  isLoading: boolean;
  dataError: string | null;
  onRefresh: () => void;
  onNavigate: (section: string) => void;
  clientUid: string;
  selectedProjectId?: string | null;
  onSelectProject?: (id: string | null) => void;
}) {
  const [filter, setFilter] = useState<"All" | "Active" | "Pending Review" | "Completed">("All");

  const formattedProjects = useMemo(() => buildFormattedProjects(dashboardData), [dashboardData]);

  // Check if a specific project detail is currently selected (Requirements 4, 5, 8, 9, 10, 11)
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return (
      formattedProjects.find((p) => p.id === selectedProjectId || p.refId === selectedProjectId) ||
      null
    );
  }, [selectedProjectId, formattedProjects]);

  const activeProjectsCount = useMemo(
    () =>
      formattedProjects.filter((p) => p.status === "In Progress" || p.status === "Approved").length,
    [formattedProjects],
  );

  const pendingCount = useMemo(
    () => formattedProjects.filter((p) => p.status === "Pending Review").length,
    [formattedProjects],
  );

  const completedCount = useMemo(
    () => formattedProjects.filter((p) => p.status === "Completed").length,
    [formattedProjects],
  );

  const filteredProjects = useMemo(() => {
    if (filter === "Active") {
      return formattedProjects.filter((p) => p.status === "In Progress" || p.status === "Approved");
    }
    if (filter === "Pending Review") {
      return formattedProjects.filter((p) => p.status === "Pending Review");
    }
    if (filter === "Completed") {
      return formattedProjects.filter((p) => p.status === "Completed");
    }
    return formattedProjects;
  }, [formattedProjects, filter]);

  if (selectedProjectId) {
    if (selectedProject) {
      return (
        <ProjectDetailView
          project={selectedProject}
          clientUid={clientUid}
          allUpdates={dashboardData.updates}
          onBack={() => onSelectProject?.(null)}
        />
      );
    }
    return (
      <div className="space-y-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onSelectProject?.(null)}
          className="rounded-none cursor-pointer text-xs"
        >
          <ArrowLeft className="mr-1.5 size-3" />
          Back to All Projects
        </Button>
        <div className="border border-border bg-surface p-12 text-center text-xs text-muted-foreground">
          <FolderOpen className="mx-auto size-8 text-muted-foreground/60 mb-3" />
          <h4 className="font-medium text-sm text-foreground">Project Not Located</h4>
          <p className="mt-1 max-w-sm mx-auto">
            The requested project reference could not be found or is not associated with your
            authenticated client account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h2 className="font-display text-2xl">Client Projects & Requests</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Displaying only projects and technical inquiries belonging to your authenticated client
            profile.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-none cursor-pointer text-xs"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-1.5 size-3 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" className="rounded-none cursor-pointer text-xs" asChild>
            <Link to="/start-project">
              <Plus className="mr-1.5 size-3" />
              Start Your Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Loading & Error notifications */}
      {isLoading && (
        <div className="border border-border bg-surface p-4 text-xs flex items-center gap-2 text-muted-foreground animate-pulse">
          <RefreshCw className="size-3.5 animate-spin text-foreground" />
          <span>Syncing client projects and inquiries from Firestore...</span>
        </div>
      )}

      {dataError && (
        <div className="border border-destructive/40 bg-destructive/10 p-4 text-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{dataError}</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-none text-xs h-7 cursor-pointer"
            onClick={onRefresh}
            disabled={isLoading}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Filter Tabs */}
      {formattedProjects.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <button
            type="button"
            onClick={() => setFilter("All")}
            className={`border px-3 py-1 font-mono text-xs transition-colors cursor-pointer ${
              filter === "All"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({formattedProjects.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("Active")}
            className={`border px-3 py-1 font-mono text-xs transition-colors cursor-pointer ${
              filter === "Active"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            Active ({activeProjectsCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("Pending Review")}
            className={`border px-3 py-1 font-mono text-xs transition-colors cursor-pointer ${
              filter === "Pending Review"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            Pending Review ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setFilter("Completed")}
            className={`border px-3 py-1 font-mono text-xs transition-colors cursor-pointer ${
              filter === "Completed"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            Completed ({completedCount})
          </button>
        </div>
      )}

      {/* Projects Grid */}
      {formattedProjects.length > 0 ? (
        filteredProjects.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {filteredProjects.map((item) => (
              <ProjectCard
                key={item.id}
                item={item}
                onNavigate={onNavigate}
                onSelectProject={(selected) => onSelectProject?.(selected.id)}
              />
            ))}
          </div>
        ) : (
          <div className="border border-border bg-surface/50 p-8 text-center text-xs text-muted-foreground">
            No projects found matching the filter "{filter}".
          </div>
        )
      ) : (
        <div className="border border-border bg-surface p-12 text-center">
          <FolderOpen className="mx-auto size-10 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-xl">No Client Projects Yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
            Your submitted project requests will appear here. Submit a project request to begin the
            technical evaluation and scoping process with VINORA.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild className="rounded-none cursor-pointer">
              <Link to="/start-project">
                <Plus className="mr-1.5 size-3.5" />
                Start Your Project
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-none cursor-pointer">
              <Link to="/contact">Contact Support</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Section Component: Updates / Announcements
// -------------------------------------------------------------

function UpdatesSection({
  updates,
  isLoading,
  onRefresh,
  onNavigate,
}: {
  updates: ClientUpdateItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onNavigate: (section: string) => void;
}) {
  const [filter, setFilter] = useState<string>("All");

  const categories = useMemo(() => {
    const cats = new Set<string>();
    updates.forEach((u) => cats.add(u.category));
    return Array.from(cats);
  }, [updates]);

  const filteredUpdates = useMemo(() => {
    if (filter === "All") return updates;
    return updates.filter((u) => u.category === filter);
  }, [updates, filter]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h2 className="font-display text-2xl">Updates & Announcements</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Milestone progress notes, project status changes, and studio announcements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-none cursor-pointer text-xs"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-1.5 size-3 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="border border-border bg-surface p-4 text-xs flex items-center gap-2 text-muted-foreground animate-pulse">
          <RefreshCw className="size-3.5 animate-spin text-foreground" />
          <span>Fetching latest updates and notifications...</span>
        </div>
      )}

      {/* Category Filter Pills */}
      {updates.length > 0 && categories.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
          <button
            type="button"
            onClick={() => setFilter("All")}
            className={`border px-3 py-1 font-mono text-xs transition-colors cursor-pointer ${
              filter === "All"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-surface text-muted-foreground hover:text-foreground"
            }`}
          >
            All ({updates.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              className={`border px-3 py-1 font-mono text-xs transition-colors cursor-pointer ${
                filter === cat
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground"
              }`}
            >
              {cat} ({updates.filter((u) => u.category === cat).length})
            </button>
          ))}
        </div>
      )}

      {/* Updates List */}
      {updates.length > 0 ? (
        filteredUpdates.length > 0 ? (
          <div className="space-y-4">
            {filteredUpdates.map((item) => (
              <article
                key={item.id}
                className="border border-border bg-surface p-5 sm:p-6 transition-colors hover:border-foreground/30"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="border border-border bg-background px-2.5 py-0.5 font-mono text-[0.68rem] uppercase tracking-wider text-muted-foreground">
                      {item.category}
                    </span>
                    <h3 className="font-medium text-base text-foreground">{item.title}</h3>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDate(item.date)}
                  </span>
                </div>

                <div className="mt-3 border-t border-border/40 pt-3">
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                    {item.description}
                  </p>
                </div>

                {item.projectId && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono text-[0.7rem]">Project Ref: {item.projectId}</span>
                    <button
                      type="button"
                      onClick={() => onNavigate("Projects")}
                      className="text-foreground hover:underline ml-auto cursor-pointer inline-flex items-center gap-1"
                    >
                      <span>View Project</span>
                      <ArrowRight className="size-3" />
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="border border-border bg-surface/50 p-8 text-center text-xs text-muted-foreground">
            No updates found matching the category "{filter}".
          </div>
        )
      ) : (
        <div className="border border-border bg-surface p-12 text-center">
          <Bell className="mx-auto size-10 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-xl">No Updates Recorded Yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
            Important project milestones, status changes, and announcements will appear here once
            your project commences.
          </p>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Section Component: Proposals
// -------------------------------------------------------------

function ProposalsSection({
  proposals,
  projectRequestsCount,
  isLoading,
  onRefresh,
}: {
  proposals: Proposal[];
  projectRequestsCount: number;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h2 className="font-display text-2xl">Proposals & Scope Approvals</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Formal architectural scopes, milestone schedules, and investment proposals.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-none cursor-pointer text-xs"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-1.5 size-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {proposals.length > 0 ? (
        <div className="space-y-4">
          {proposals.map((prop) => (
            <article key={prop.id} className="border border-border bg-surface p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg">Project Proposal</h3>
                    {getStatusBadge(prop.status)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Issued: {formatDate(prop.createdAt)} • Timeline: {prop.timeline}
                  </p>
                </div>
                <CopyIdBadge id={prop.id} label="Proposal ID" />
              </div>

              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line">
                  {prop.scope}
                </p>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4 text-xs sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Total Investment</span>
                  <p className="font-display text-base text-foreground mt-0.5">
                    {prop.currency} {prop.totalPrice?.toLocaleString()}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Advance Deposit</span>
                  <p className="font-display text-base text-foreground mt-0.5">
                    {prop.currency} {prop.advanceAmount?.toLocaleString() || 0}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Remaining Balance</span>
                  <p className="font-display text-base text-foreground mt-0.5">
                    {prop.currency} {prop.remainingAmount?.toLocaleString() || 0}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className="font-medium text-foreground capitalize mt-0.5">{prop.status}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border border-border bg-surface p-12 text-center">
          <FileText className="mx-auto size-10 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-xl">No Proposals Issued Yet</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
            {projectRequestsCount > 0
              ? `You have ${projectRequestsCount} project inquiry under technical evaluation. Once reviewed by our engineering leads, your formal proposal and commercial terms will be published here.`
              : "Once your project inquiry is reviewed by our engineering team, your formal technical proposal and scope of work will be published here for digital review and approval."}
          </p>
          <div className="mt-6">
            <Button asChild variant="outline" size="sm" className="rounded-none cursor-pointer">
              <Link to="/start-project">Submit a Project Scope</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Section Component: Files & Deliverables
// -------------------------------------------------------------

function FilesSection({
  documents,
  projectRequests,
  isLoading,
  onRefresh,
}: {
  documents: ClientDocument[];
  projectRequests: ProjectRequest[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  // Extract attachments from project requests as well
  const inquiryFiles: Array<{
    name: string;
    path: string;
    requestId: string;
    date: string;
  }> = [];

  for (const req of projectRequests) {
    if (req.attachmentPaths && req.attachmentPaths.length > 0) {
      req.attachmentPaths.forEach((p, idx) => {
        inquiryFiles.push({
          name: p.includes("/") ? p.split("/").pop() || `Attachment ${idx + 1}` : p,
          path: p,
          requestId: req.id,
          date: req.createdAt,
        });
      });
    }
  }

  const hasFiles = documents.length > 0 || inquiryFiles.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h2 className="font-display text-2xl">Files & Deliverables</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Architecture blueprints, production builds, design assets, and submission files.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-none cursor-pointer text-xs"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-1.5 size-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {hasFiles ? (
        <div className="space-y-6">
          {documents.length > 0 && (
            <div className="space-y-3">
              <h3 className="eyebrow text-muted-foreground">Deliverables & Documents</h3>
              <div className="border border-border divide-y divide-border bg-surface">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded: {formatDate(doc.createdAt)}
                        {doc.sizeBytes && ` • ${(doc.sizeBytes / 1024).toFixed(1)} KB`}
                      </p>
                    </div>
                    {doc.storagePath?.startsWith("http") ? (
                      <a
                        href={doc.storagePath}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-foreground hover:underline"
                      >
                        <span>Download</span>
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">
                        {doc.storagePath}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {inquiryFiles.length > 0 && (
            <div className="space-y-3">
              <h3 className="eyebrow text-muted-foreground">Inquiry Submission Attachments</h3>
              <div className="border border-border divide-y divide-border bg-surface">
                {inquiryFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-sm">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Attached on: {formatDate(f.date)} • Ref: {f.requestId}
                      </p>
                    </div>
                    {f.path.startsWith("http") ? (
                      <a
                        href={f.path}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-foreground hover:underline"
                      >
                        <span>View Attachment</span>
                        <ExternalLink className="size-3" />
                      </a>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground">{f.path}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="border border-border bg-surface p-12 text-center">
          <Folder className="mx-auto size-10 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-xl">No Files or Deliverables Uploaded</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
            As milestones are completed, design files, component libraries, backend schemas, and
            production builds will be uploaded directly to this directory by the engineering team.
          </p>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Section Component: Invoices
// -------------------------------------------------------------

function InvoicesSection({
  invoices,
  isLoading,
  onRefresh,
}: {
  invoices: Invoice[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h2 className="font-display text-2xl">Invoices & Billing History</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Milestone billing statements, retainer records, and payment receipts.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-none cursor-pointer text-xs"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-1.5 size-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {invoices.length > 0 ? (
        <div className="space-y-4">
          <div className="border border-border divide-y divide-border bg-surface">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-base">{inv.number}</h3>
                    {getStatusBadge(inv.status)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Issued: {formatDate(inv.issuedAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display text-lg">
                    {inv.currency} {inv.total?.toLocaleString()}
                  </p>
                  <CopyIdBadge id={inv.id} label="Invoice ID" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-border bg-surface p-12 text-center">
          <Receipt className="mx-auto size-10 text-muted-foreground/50" />
          <h3 className="mt-4 font-display text-xl">No Invoices Generated</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground leading-relaxed">
            Billing statements and retainer receipts are issued upon project confirmation and
            milestone delivery. All statements will be documented here with itemized line items.
          </p>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Section Component: Messages
// -------------------------------------------------------------

function MessagesSection({
  profile,
  messages,
  isLoading,
  onRefresh,
}: {
  profile: UserProfile;
  messages: Message[];
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h2 className="font-display text-2xl">Messages & Direct Communications</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Direct communication thread with your dedicated VINORA project lead.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-none cursor-pointer text-xs"
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-1.5 size-3 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Real-time WhatsApp-Style Direct Chat with VINORA Architecture Team */}
      <WhatsAppClientChat profile={profile} />

      {/* Legacy Workspace Messages Archive (if present) */}
      {messages.length > 0 && (
        <details className="border border-border bg-surface p-4">
          <summary className="font-mono text-xs cursor-pointer text-muted-foreground hover:text-foreground">
            Legacy Project Workspace Messages ({messages.length})
          </summary>
          <div className="divide-y divide-border mt-3 pt-3 border-t border-border">
            {messages.map((m) => (
              <div key={m.id} className="p-3 text-xs space-y-1">
                <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px]">
                  <span>Sender: {m.senderId}</span>
                  <span>{formatDate(m.createdAt)}</span>
                </div>
                <p className="text-foreground">{m.body}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Section Component: Support
// -------------------------------------------------------------

function SupportSection({
  profile,
  onNavigate,
}: {
  profile: UserProfile;
  onNavigate: (section: string) => void;
}) {
  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-5">
        <h2 className="font-display text-2xl">Client Support & Inquiries</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Assistance, change requests, or technical inquiries for your account.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="border border-border bg-surface p-6">
          <h3 className="font-display text-lg">Direct Technical Support</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Our engineering team monitors client tickets and requests continuously. Send a message
            directly referencing your client ID ({profile.id}).
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <Button asChild size="sm" className="rounded-none cursor-pointer">
              <Link to="/contact">Open Contact Form</Link>
            </Button>
          </div>
        </div>

        <div className="border border-border bg-surface p-6">
          <h3 className="font-display text-lg">Direct Channels</h3>
          <div className="mt-3 space-y-2 text-xs text-muted-foreground">
            <p>
              <strong className="text-foreground">Email:</strong>{" "}
              <a href="mailto:contact@vinoratech.com" className="hover:underline">
                contact@vinoratech.com
              </a>
            </p>
            <p>
              <strong className="text-foreground">Location:</strong> San Francisco, CA & London, UK
            </p>
            <p>
              <strong className="text-foreground">Hours:</strong> 24/7 Priority Client Response
            </p>
          </div>
          <div className="mt-6">
            <Button
              variant="outline"
              size="sm"
              className="rounded-none cursor-pointer"
              onClick={() => onNavigate("Projects")}
            >
              Check Project Status
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
