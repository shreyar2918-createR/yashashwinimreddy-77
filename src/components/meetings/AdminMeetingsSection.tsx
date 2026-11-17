import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Search,
  ExternalLink,
  CalendarCheck,
  CalendarX,
  CalendarRange,
  Loader2,
  Check,
  X,
  User,
  Mail,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  subscribeAllMeetings,
  getMeetingIntegrationsStatus,
  approveMeeting,
  rescheduleMeeting,
  rejectMeeting,
  completeMeeting,
  cancelMeeting,
  type VideoIntegrationsStatus,
} from "@/services/meetingService";
import type { MeetingPlatform, MeetingRequest, MeetingStatus } from "@/lib/types";
import type { AdminRecord } from "@/services/adminAuth";

interface AdminMeetingsSectionProps {
  admin: AdminRecord;
}

export function AdminMeetingsSection({ admin }: AdminMeetingsSectionProps) {
  const [meetings, setMeetings] = useState<MeetingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [integrations, setIntegrations] = useState<VideoIntegrationsStatus | null>(null);

  // Selected meeting for action modals
  const [actionMeeting, setActionMeeting] = useState<MeetingRequest | null>(null);
  const [activeModal, setActiveModal] = useState<
    "approve" | "reschedule" | "reject" | "cancel" | null
  >(null);

  // Modal Form Inputs
  const [finalDateInput, setFinalDateInput] = useState("");
  const [finalTimeInput, setFinalTimeInput] = useState("");
  const [platformInput, setPlatformInput] = useState<MeetingPlatform>("Google Meet");
  const [autoCreateLinkInput, setAutoCreateLinkInput] = useState(false);
  const [meetingUrlInput, setMeetingUrlInput] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [adminNotesInput, setAdminNotesInput] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("14:00");
  const [rescheduleReason, setRescheduleReason] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Subscribe in real-time to all meetings & check video API config status
  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeAllMeetings(
      (data) => {
        setMeetings(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Admin meetings subscription error:", err);
        setError("Unable to load meeting requests from Firestore.");
        setIsLoading(false);
      },
    );

    getMeetingIntegrationsStatus()
      .then((status) => setIntegrations(status))
      .catch(() => setIntegrations(null));

    return () => unsub();
  }, []);

  const isPlatformApiConfigured = (plat: MeetingPlatform): boolean => {
    if (!integrations) return false;
    if (plat === "Google Meet") return integrations.googleMeet.configured;
    if (plat === "Microsoft Teams") return integrations.microsoftTeams.configured;
    return false;
  };

  const getMissingPlatformEnvVars = (plat: MeetingPlatform): string[] => {
    if (!integrations) return [];
    if (plat === "Google Meet") return integrations.googleMeet.missingEnvVars;
    if (plat === "Microsoft Teams") return integrations.microsoftTeams.missingEnvVars;
    return [];
  };

  // Open Approve Modal
  const openApproveModal = (m: MeetingRequest) => {
    const detectedPlatform: MeetingPlatform =
      m.platform || (m.meetingType === "In-Person Meeting" ? "In-Person" : "Google Meet");
    setActionMeeting(m);
    setFinalDateInput(m.preferredDate || new Date().toISOString().split("T")[0]);
    setFinalTimeInput(m.preferredTime || "14:00");
    setPlatformInput(detectedPlatform);
    setAutoCreateLinkInput(!m.meetingUrl && isPlatformApiConfigured(detectedPlatform));
    setMeetingUrlInput(m.meetingUrl || "");
    setLocationInput(
      m.location ||
        (detectedPlatform === "In-Person"
          ? "VINORA Architecture Studio, 100 Montgomery St, San Francisco"
          : ""),
    );
    setAdminNotesInput(m.adminNotes || "Session confirmed. Architectural agenda prepared.");
    setActiveModal("approve");
    setActionError(null);
  };

  // Open Reschedule Modal
  const openRescheduleModal = (m: MeetingRequest) => {
    const detectedPlatform: MeetingPlatform =
      m.platform || (m.meetingType === "In-Person Meeting" ? "In-Person" : "Google Meet");
    setActionMeeting(m);
    setRescheduleDate(m.preferredDate || new Date().toISOString().split("T")[0]);
    setRescheduleTime(m.preferredTime || "14:00");
    setPlatformInput(detectedPlatform);
    setAutoCreateLinkInput(false);
    setMeetingUrlInput(m.meetingUrl || "");
    setRescheduleReason(
      "Rescheduled due to lead architect milestone review. Proposed new slot above.",
    );
    setAdminNotesInput(m.adminNotes || "");
    setActiveModal("reschedule");
    setActionError(null);
  };

  // Open Reject Modal
  const openRejectModal = (m: MeetingRequest) => {
    setActionMeeting(m);
    setRejectionReason(
      "Studio engineering schedule at capacity during this window. Please submit an alternative time.",
    );
    setAdminNotesInput("");
    setActiveModal("reject");
    setActionError(null);
  };

  // Open Cancel Modal
  const openCancelModal = (m: MeetingRequest) => {
    setActionMeeting(m);
    setCancellationReason("Cancelled due to schedule change.");
    setActiveModal("cancel");
    setActionError(null);
  };

  // Handle Approve Submission
  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionMeeting) return;
    setIsProcessing(true);
    setActionError(null);

    try {
      await approveMeeting({
        meetingId: actionMeeting.id,
        adminName: admin.name || "VINORA Lead Architect",
        finalDate: finalDateInput || undefined,
        finalTime: finalTimeInput || undefined,
        platform: platformInput,
        autoCreateLink: platformInput !== "In-Person" ? autoCreateLinkInput : false,
        meetingUrl:
          platformInput !== "In-Person" && !autoCreateLinkInput
            ? meetingUrlInput.trim() || undefined
            : undefined,
        location: platformInput === "In-Person" ? locationInput.trim() || undefined : undefined,
        adminNotes: adminNotesInput.trim() || undefined,
      });

      setActionSuccess(
        `Meeting request for "${actionMeeting.clientName}" has been approved and confirmed.`,
      );
      setActiveModal(null);
      setActionMeeting(null);
    } catch (err: unknown) {
      console.error("Approve error:", err);
      setActionError(err instanceof Error ? err.message : "Failed to approve meeting.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Reschedule Submission
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionMeeting) return;
    if (!rescheduleDate || !rescheduleTime) {
      setActionError("Please provide a new date and time.");
      return;
    }

    setIsProcessing(true);
    setActionError(null);

    try {
      await rescheduleMeeting({
        meetingId: actionMeeting.id,
        adminName: admin.name || "VINORA Lead Architect",
        newDate: rescheduleDate,
        newTime: rescheduleTime,
        rescheduleReason: rescheduleReason.trim(),
        platform: platformInput,
        autoCreateLink: platformInput !== "In-Person" ? autoCreateLinkInput : false,
        meetingUrl:
          platformInput !== "In-Person" && !autoCreateLinkInput
            ? meetingUrlInput.trim() || undefined
            : undefined,
        adminNotes: adminNotesInput.trim() || undefined,
      });

      setActionSuccess(
        `Meeting with "${actionMeeting.clientName}" was rescheduled to ${rescheduleDate} at ${rescheduleTime}.`,
      );
      setActiveModal(null);
      setActionMeeting(null);
    } catch (err: unknown) {
      console.error("Reschedule error:", err);
      setActionError(err instanceof Error ? err.message : "Failed to reschedule meeting.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Reject Submission
  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionMeeting) return;
    setIsProcessing(true);
    setActionError(null);

    try {
      await rejectMeeting({
        meetingId: actionMeeting.id,
        adminName: admin.name || "VINORA Lead Architect",
        rejectionReason: rejectionReason.trim(),
        adminNotes: adminNotesInput.trim() || undefined,
      });

      setActionSuccess(`Meeting request for "${actionMeeting.clientName}" was declined.`);
      setActiveModal(null);
      setActionMeeting(null);
    } catch (err: unknown) {
      console.error("Reject error:", err);
      setActionError(err instanceof Error ? err.message : "Failed to decline meeting.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Cancel Submission
  const handleCancelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionMeeting) return;
    setIsProcessing(true);
    setActionError(null);

    try {
      await cancelMeeting(actionMeeting.id, cancellationReason.trim() || undefined);
      setActionSuccess(`Meeting with "${actionMeeting.clientName}" was cancelled.`);
      setActiveModal(null);
      setActionMeeting(null);
    } catch (err: unknown) {
      console.error("Cancel error:", err);
      setActionError(err instanceof Error ? err.message : "Failed to cancel meeting.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle Mark Completed
  const handleComplete = async (m: MeetingRequest) => {
    try {
      await completeMeeting(m.id, {
        adminNotes: "Meeting successfully concluded and technical action items recorded.",
      });
      setActionSuccess(`Meeting with "${m.clientName}" marked as Completed.`);
    } catch (err: unknown) {
      console.error("Complete error:", err);
      setError(err instanceof Error ? err.message : "Failed to complete meeting.");
    }
  };

  const getJoinLabel = (m: MeetingRequest) => {
    const url = (m.meetingUrl || "").toLowerCase();
    if (
      m.platform === "Microsoft Teams" ||
      url.includes("teams.microsoft.com") ||
      url.includes("teams.live.com")
    ) {
      return "Join Microsoft Teams";
    }
    if (m.platform === "Google Meet" || url.includes("meet.google.com")) {
      return "Join Google Meet";
    }
    return "Join Meeting";
  };

  // Filter meetings
  const filteredMeetings = meetings.filter((m) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      m.clientName.toLowerCase().includes(q) ||
      m.clientEmail.toLowerCase().includes(q) ||
      m.title.toLowerCase().includes(q) ||
      m.purpose.toLowerCase().includes(q) ||
      m.id.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === "all" || m.status.toLowerCase() === statusFilter.toLowerCase();

    const matchesType =
      typeFilter === "all" || m.meetingType.toLowerCase() === typeFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesType;
  });

  const pendingCount = meetings.filter((m) => m.status === "Pending").length;
  const approvedCount = meetings.filter((m) => m.status === "Approved").length;
  const rescheduledCount = meetings.filter((m) => m.status === "Rescheduled").length;
  const completedCount = meetings.filter((m) => m.status === "Completed").length;
  const cancelledCount = meetings.filter((m) => m.status === "Cancelled").length;

  const getStatusBadge = (status: MeetingStatus) => {
    switch (status) {
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="size-3" />
            Approved
          </span>
        );
      case "Rescheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <CalendarRange className="size-3" />
            Rescheduled
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium bg-destructive/10 text-destructive border border-destructive/30">
            <CalendarX className="size-3" />
            Declined
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium bg-muted text-muted-foreground border border-border">
            <CalendarX className="size-3" />
            Cancelled
          </span>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium bg-muted text-muted-foreground border border-border">
            <CalendarCheck className="size-3" />
            Completed
          </span>
        );
      case "Pending":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="size-3 animate-pulse" />
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="font-display text-xl font-medium tracking-tight">
            Client Meeting & Service Requests
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Review client consultation requests, confirm dates/times, attach real Google Meet or
            Microsoft Teams links, or reschedule windows.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {integrations && (
            <>
              <span
                className={`border px-2.5 py-1 font-mono text-[10px] uppercase ${
                  integrations.googleMeet.configured
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                Meet API: {integrations.googleMeet.configured ? "Ready" : "Manual URL"}
              </span>
              <span
                className={`border px-2.5 py-1 font-mono text-[10px] uppercase ${
                  integrations.microsoftTeams.configured
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                Teams API: {integrations.microsoftTeams.configured ? "Ready" : "Manual URL"}
              </span>
            </>
          )}
          <span className="border border-border bg-card px-3 py-1 font-mono text-xs">
            Total Requests: <strong className="text-foreground">{meetings.length}</strong>
          </span>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-border bg-card p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Pending Action
          </span>
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl font-bold text-foreground">{pendingCount}</span>
            {pendingCount > 0 && (
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </div>
        </div>

        <div className="border border-border bg-card p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Approved & Confirmed
          </span>
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl font-bold text-foreground">{approvedCount}</span>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
        </div>

        <div className="border border-border bg-card p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Rescheduled
          </span>
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl font-bold text-foreground">
              {rescheduledCount}
            </span>
            <CalendarRange className="size-4 text-indigo-400" />
          </div>
        </div>

        <div className="border border-border bg-card p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Completed
          </span>
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl font-bold text-foreground">
              {completedCount}
            </span>
            <CalendarCheck className="size-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="font-mono text-[11px] underline cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="h-7 text-xs font-mono"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="border border-border bg-surface p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by client name, email, purpose, or meeting ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs rounded-none border-border bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden"
            >
              <option value="all">All Formats</option>
              <option value="Online Meeting">Online Video</option>
              <option value="In-Person Meeting">In-Person Studio</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 border-t border-border/60 pt-2.5 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "All", count: meetings.length },
            { id: "pending", label: "Pending Review", count: pendingCount },
            { id: "approved", label: "Approved", count: approvedCount },
            { id: "rescheduled", label: "Rescheduled", count: rescheduledCount },
            { id: "completed", label: "Completed", count: completedCount },
            { id: "cancelled", label: "Cancelled", count: cancelledCount },
            {
              id: "rejected",
              label: "Declined",
              count: meetings.filter((m) => m.status === "Rejected").length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? "bg-foreground text-background font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 ${
                    statusFilter === tab.id
                      ? "bg-background text-foreground"
                      : "bg-surface border border-border"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* MEETINGS TABLE / LIST */}
      {isLoading ? (
        <div className="border border-border bg-card p-12 text-center space-y-3">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Loading meetings from Firestore...
          </p>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="border border-border bg-card p-12 text-center space-y-3">
          <Calendar className="size-8 mx-auto text-muted-foreground/40" />
          <h3 className="font-display text-sm font-semibold">No Meeting Requests Found</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? "No meeting records match your search query."
              : "When clients submit consultation requests from their Client Portal, they will appear here in real time."}
          </p>
        </div>
      ) : (
        <div className="border border-border bg-card divide-y divide-border">
          {filteredMeetings.map((m) => {
            const isApproved = m.status === "Approved";
            const isRescheduled = m.status === "Rescheduled";
            const platformLabel =
              m.platform || (m.meetingType === "In-Person Meeting" ? "In-Person" : "Google Meet");

            return (
              <div key={m.id} className="p-5 space-y-4 hover:bg-surface/30 transition-colors">
                {/* Header row: Client info, type, status */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-base font-semibold text-foreground">
                        {m.title}
                      </span>
                      <span className="font-mono text-[10px] px-2 py-0.5 border border-border bg-surface text-muted-foreground">
                        {platformLabel}
                      </span>
                      {m.projectTitle && (
                        <span className="font-mono text-[10px] px-2 py-0.5 border border-border bg-surface text-muted-foreground">
                          Project: {m.projectTitle}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <User className="size-3" />
                        {m.clientName}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Mail className="size-3" />
                        {m.clientEmail}
                      </span>
                      {m.clientCompany && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Building2 className="size-3" />
                            {m.clientCompany}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">{getStatusBadge(m.status)}</div>
                </div>

                {/* Purpose / Discussion topics */}
                <div className="border-l-2 border-border pl-3 text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-mono text-[11px] block uppercase tracking-wider mb-0.5">
                    Discussion Objective:
                  </strong>
                  {m.purpose}
                </div>

                {/* Timing & Logistics Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="border border-border/80 bg-surface/50 p-2.5 space-y-0.5">
                    <span className="text-[10px] uppercase text-muted-foreground block">
                      Requested / Scheduled Window:
                    </span>
                    <span className="text-foreground font-semibold flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      {m.preferredDate} at {m.preferredTime}
                    </span>
                  </div>

                  <div className="border border-border/80 bg-surface/50 p-2.5 space-y-0.5">
                    <span className="text-[10px] uppercase text-muted-foreground block">
                      Confirmed Schedule:
                    </span>
                    <span className="text-foreground font-semibold flex items-center gap-1.5">
                      <Clock className="size-3.5 text-muted-foreground" />
                      {m.scheduledAt
                        ? new Date(m.scheduledAt).toLocaleString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })
                        : isApproved
                          ? `${m.preferredDate} at ${m.preferredTime}`
                          : "Pending Confirmation"}
                    </span>
                  </div>

                  <div className="border border-border/80 bg-surface/50 p-2.5 space-y-0.5">
                    <span className="text-[10px] uppercase text-muted-foreground block">
                      Access Link / Venue:
                    </span>
                    <span className="text-foreground truncate block">
                      {m.meetingUrl ? (
                        <a
                          href={m.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-emerald-400 inline-flex items-center gap-1 truncate"
                        >
                          <Video className="size-3 shrink-0" />
                          <span className="truncate">{getJoinLabel(m)}</span>
                          <ExternalLink className="size-2.5" />
                        </a>
                      ) : m.location ? (
                        <span className="truncate flex items-center gap-1">
                          <MapPin className="size-3 shrink-0" />
                          <span className="truncate">{m.location}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not attached yet</span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Additional Notes or Reasons */}
                {m.rescheduleReason && (
                  <div className="text-xs border border-indigo-500/20 bg-indigo-500/5 p-2.5 space-y-0.5">
                    <span className="font-mono text-[10px] font-semibold text-indigo-400 uppercase">
                      Reschedule Reason Given:
                    </span>
                    <p className="text-foreground">{m.rescheduleReason}</p>
                  </div>
                )}

                {m.rejectionReason && (
                  <div className="text-xs border border-destructive/20 bg-destructive/5 p-2.5 space-y-0.5">
                    <span className="font-mono text-[10px] font-semibold text-destructive uppercase">
                      Decline Reason:
                    </span>
                    <p className="text-muted-foreground">{m.rejectionReason}</p>
                  </div>
                )}

                {m.status === "Cancelled" && (
                  <div className="text-xs border border-border bg-surface/40 p-2.5 space-y-0.5">
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground uppercase">
                      Cancelled {m.cancelledBy ? `by ${m.cancelledBy}` : ""}:
                    </span>
                    {m.cancellationReason && (
                      <p className="text-muted-foreground">{m.cancellationReason}</p>
                    )}
                  </div>
                )}

                {m.adminNotes && (
                  <div className="text-xs border border-border bg-surface/40 p-2.5 space-y-0.5">
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">
                      Admin Note:
                    </span>
                    <p className="text-foreground">{m.adminNotes}</p>
                  </div>
                )}

                {/* ADMIN ACTION CONTROLS */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/60">
                  <div className="text-[11px] font-mono text-muted-foreground">
                    UID: {m.clientId.slice(0, 8)}... • Request ID: {m.id.slice(0, 12)}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {m.status !== "Cancelled" && m.status !== "Completed" && (
                      <Button
                        size="sm"
                        onClick={() => openApproveModal(m)}
                        className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs h-8 px-3"
                      >
                        <Check className="size-3 mr-1" />
                        {isApproved ? "Update Approval" : "Approve Meeting"}
                      </Button>
                    )}

                    {m.status !== "Cancelled" && m.status !== "Completed" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRescheduleModal(m)}
                        className="rounded-none cursor-pointer font-mono text-xs h-8 px-3"
                      >
                        <CalendarRange className="size-3 mr-1" />
                        Reschedule
                      </Button>
                    )}

                    {(isApproved || isRescheduled) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleComplete(m)}
                        className="rounded-none cursor-pointer font-mono text-xs h-8 px-3 text-muted-foreground hover:text-foreground"
                      >
                        <CalendarCheck className="size-3 mr-1" />
                        Mark Completed
                      </Button>
                    )}

                    {m.status === "Pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openRejectModal(m)}
                        className="rounded-none cursor-pointer font-mono text-xs h-8 px-2.5 text-destructive hover:bg-destructive/10"
                      >
                        <X className="size-3 mr-1" />
                        Decline
                      </Button>
                    )}

                    {m.status !== "Rejected" &&
                      m.status !== "Completed" &&
                      m.status !== "Cancelled" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openCancelModal(m)}
                          className="rounded-none cursor-pointer font-mono text-xs h-8 px-2.5 text-muted-foreground hover:text-destructive"
                        >
                          <CalendarX className="size-3 mr-1" />
                          Cancel
                        </Button>
                      )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ACTION MODALS: APPROVE, RESCHEDULE, REJECT, CANCEL                        */}
      {/* ========================================================================= */}

      {/* 1. APPROVE MODAL */}
      {activeModal === "approve" && actionMeeting && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="border border-border bg-card max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-semibold">Approve Meeting Request</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Client: {actionMeeting.clientName} ({actionMeeting.clientEmail})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {actionError && (
              <div className="border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {actionError}
              </div>
            )}

            <form onSubmit={handleApproveSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                    Confirmed Final Date *
                  </label>
                  <Input
                    type="date"
                    required
                    value={finalDateInput}
                    onChange={(e) => setFinalDateInput(e.target.value)}
                    className="rounded-none border-border bg-background text-xs font-mono h-9"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                    Confirmed Final Time *
                  </label>
                  <Input
                    type="time"
                    required
                    value={finalTimeInput}
                    onChange={(e) => setFinalTimeInput(e.target.value)}
                    className="rounded-none border-border bg-background text-xs font-mono h-9"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                  Platform / Format
                </label>
                <select
                  value={platformInput}
                  onChange={(e) => {
                    const nextPlat = e.target.value as MeetingPlatform;
                    setPlatformInput(nextPlat);
                    setAutoCreateLinkInput(!meetingUrlInput && isPlatformApiConfigured(nextPlat));
                  }}
                  className="w-full h-9 border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden"
                >
                  <option value="Google Meet">Google Meet</option>
                  <option value="Microsoft Teams">Microsoft Teams</option>
                  <option value="In-Person">In-Person Studio</option>
                </select>
              </div>

              {platformInput !== "In-Person" ? (
                <div className="space-y-2.5">
                  <label className="flex items-start gap-2 cursor-pointer border border-border bg-surface/50 p-2.5">
                    <input
                      type="checkbox"
                      checked={autoCreateLinkInput}
                      disabled={!isPlatformApiConfigured(platformInput)}
                      onChange={(e) => setAutoCreateLinkInput(e.target.checked)}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <span className="font-mono text-[11px] font-semibold text-foreground block">
                        Generate real {platformInput} link automatically via API
                      </span>
                      {!isPlatformApiConfigured(platformInput) ? (
                        <span className="text-[10px] text-amber-400 font-mono block">
                          Server API credentials not configured (missing:{" "}
                          {getMissingPlatformEnvVars(platformInput).join(", ")}). Paste a real{" "}
                          {platformInput} URL manually below.
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-mono block">
                          API configured on server. Will create a live {platformInput} conference.
                        </span>
                      )}
                    </div>
                  </label>

                  {!autoCreateLinkInput && (
                    <div className="space-y-1">
                      <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                        Real {platformInput} URL
                      </label>
                      <Input
                        type="url"
                        placeholder={
                          platformInput === "Microsoft Teams"
                            ? "https://teams.microsoft.com/l/meetup-join/..."
                            : "https://meet.google.com/abc-defg-hij"
                        }
                        value={meetingUrlInput}
                        onChange={(e) => setMeetingUrlInput(e.target.value)}
                        className="rounded-none border-border bg-background text-xs font-mono h-9"
                      />
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                    In-Person Studio Venue Location
                  </label>
                  <Input
                    type="text"
                    placeholder="e.g. VINORA Studio San Francisco / 100 Montgomery St"
                    value={locationInput}
                    onChange={(e) => setLocationInput(e.target.value)}
                    className="rounded-none border-border bg-background text-xs h-9"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                  Studio Preparation Note for Client
                </label>
                <textarea
                  rows={2}
                  value={adminNotesInput}
                  onChange={(e) => setAdminNotesInput(e.target.value)}
                  className="w-full border border-border bg-background p-2.5 text-xs text-foreground focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveModal(null)}
                  className="rounded-none cursor-pointer h-8 text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isProcessing}
                  size="sm"
                  className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-8 text-xs font-mono"
                >
                  {isProcessing ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : (
                    <Check className="size-3.5 mr-1" />
                  )}
                  Confirm Approval
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. RESCHEDULE MODAL */}
      {activeModal === "reschedule" && actionMeeting && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="border border-border bg-card max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-semibold">Reschedule Meeting</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Propose an updated date and time to {actionMeeting.clientName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {actionError && (
              <div className="border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {actionError}
              </div>
            )}

            <form onSubmit={handleRescheduleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                    New Date *
                  </label>
                  <Input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="rounded-none border-border bg-background text-xs font-mono h-9"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                    New Time *
                  </label>
                  <Input
                    type="time"
                    required
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="rounded-none border-border bg-background text-xs font-mono h-9"
                  />
                </div>
              </div>

              {platformInput !== "In-Person" && (
                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                    Updated {platformInput} URL (optional)
                  </label>
                  <Input
                    type="url"
                    placeholder={
                      platformInput === "Microsoft Teams"
                        ? "https://teams.microsoft.com/l/meetup-join/..."
                        : "https://meet.google.com/abc-defg-hij"
                    }
                    value={meetingUrlInput}
                    onChange={(e) => setMeetingUrlInput(e.target.value)}
                    className="rounded-none border-border bg-background text-xs font-mono h-9"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                  Reason for Rescheduling *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Explain reason to the client..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full border border-border bg-background p-2.5 text-xs text-foreground focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveModal(null)}
                  className="rounded-none cursor-pointer h-8 text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isProcessing}
                  size="sm"
                  className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-8 text-xs font-mono"
                >
                  {isProcessing ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : (
                    <CalendarRange className="size-3.5 mr-1" />
                  )}
                  Save Rescheduled Window
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. REJECT MODAL */}
      {activeModal === "reject" && actionMeeting && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="border border-border bg-card max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-semibold text-destructive">
                  Decline Meeting Request
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Client: {actionMeeting.clientName} ({actionMeeting.clientEmail})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {actionError && (
              <div className="border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {actionError}
              </div>
            )}

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                  Reason for Declining *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="State why the studio cannot accommodate this window..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full border border-border bg-background p-2.5 text-xs text-foreground focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveModal(null)}
                  className="rounded-none cursor-pointer h-8 text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isProcessing}
                  size="sm"
                  className="rounded-none cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs font-mono"
                >
                  {isProcessing ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : (
                    <CalendarX className="size-3.5 mr-1" />
                  )}
                  Decline Request
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. CANCEL MODAL */}
      {activeModal === "cancel" && actionMeeting && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="border border-border bg-card max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-semibold">Cancel Meeting</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Client: {actionMeeting.clientName} ({actionMeeting.clientEmail})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {actionError && (
              <div className="border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {actionError}
              </div>
            )}

            <form onSubmit={handleCancelSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                  Cancellation Note
                </label>
                <textarea
                  rows={3}
                  placeholder="Optional reason shared with the client..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full border border-border bg-background p-2.5 text-xs text-foreground focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveModal(null)}
                  className="rounded-none cursor-pointer h-8 text-xs font-mono"
                >
                  Keep Meeting
                </Button>
                <Button
                  type="submit"
                  disabled={isProcessing}
                  size="sm"
                  className="rounded-none cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs font-mono"
                >
                  {isProcessing ? (
                    <Loader2 className="size-3.5 animate-spin mr-1" />
                  ) : (
                    <CalendarX className="size-3.5 mr-1" />
                  )}
                  Confirm Cancellation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
