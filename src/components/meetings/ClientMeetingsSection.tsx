import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Video,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CalendarCheck,
  CalendarX,
  CalendarRange,
  Loader2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createMeetingRequest,
  cancelMeeting,
  subscribeClientMeetings,
  type CreateMeetingInput,
} from "@/services/meetingService";
import type {
  MeetingPlatform,
  MeetingRequest,
  MeetingStatus,
  MeetingType,
  UserProfile,
  Project,
} from "@/lib/types";

interface ClientMeetingsSectionProps {
  profile: UserProfile;
  projects?: Project[];
}

const PURPOSE_PRESETS = [
  "Architecture & Solution Review",
  "Milestone Walkthrough & Acceptance",
  "Technical Discovery & Scoping",
  "Cloud & Security Integration Sync",
  "Contract & Timeline Alignment",
];

const TIME_SLOTS = [
  { value: "09:00", label: "09:00 AM (Morning Sync)" },
  { value: "11:00", label: "11:00 AM (Pre-Midday)" },
  { value: "14:00", label: "02:00 PM (Afternoon Architectural Review)" },
  { value: "16:00", label: "04:00 PM (Late Afternoon Wrap-up)" },
];

export function ClientMeetingsSection({ profile, projects = [] }: ClientMeetingsSectionProps) {
  const [meetings, setMeetings] = useState<MeetingRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Form State
  const [meetingType, setMeetingType] = useState<MeetingType>("Online Meeting");
  const [platform, setPlatform] = useState<MeetingPlatform>("Google Meet");
  const [purposePreset, setPurposePreset] = useState(PURPOSE_PRESETS[0]);
  const [customTitle, setCustomTitle] = useState("");
  const [purposeDetails, setPurposeDetails] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState(TIME_SLOTS[2].value);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [clientNotes, setClientNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancellingMeetingId, setCancellingMeetingId] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Default preferred date to tomorrow formatted YYYY-MM-DD
  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const dd = String(tomorrow.getDate()).padStart(2, "0");
    setPreferredDate(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Subscribe to real-time meetings for this client
  useEffect(() => {
    if (!profile.id) return;
    setIsLoading(true);

    const unsub = subscribeClientMeetings(
      profile.id,
      (data) => {
        setMeetings(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Failed to load meetings:", err);
        setError("Unable to load meeting history from Firestore.");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [profile.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!preferredDate) {
      setFormError("Please select a preferred date for the meeting.");
      return;
    }
    if (!preferredTime) {
      setFormError("Please select a preferred time window.");
      return;
    }
    if (!purposeDetails.trim() && !purposePreset) {
      setFormError("Please provide an agenda or purpose for the meeting.");
      return;
    }

    setIsSubmitting(true);

    const selectedProj = projects.find((p) => p.id === selectedProjectId);

    const effectivePlatform: MeetingPlatform =
      meetingType === "In-Person Meeting"
        ? "In-Person"
        : platform === "In-Person"
          ? "Google Meet"
          : platform;

    const input: CreateMeetingInput = {
      clientId: profile.id,
      clientName: profile.fullName || profile.email?.split("@")[0] || "Client",
      clientEmail: profile.email || "",
      clientCompany: profile.company || "",
      projectId: selectedProjectId || undefined,
      projectTitle: selectedProj?.title || undefined,
      title: customTitle.trim() || purposePreset,
      purpose: purposeDetails.trim() || purposePreset,
      meetingType,
      platform: effectivePlatform,
      preferredDate,
      preferredTime,
      notes: clientNotes.trim() || undefined,
    };

    try {
      await createMeetingRequest(input);
      setFormSuccess(
        `Meeting request for "${input.title}" (${effectivePlatform}) submitted successfully! Your VINORA lead architect will review and confirm shortly.`,
      );
      setPurposeDetails("");
      setCustomTitle("");
      setClientNotes("");
      setIsFormOpen(false);
    } catch (err: unknown) {
      console.error("Meeting request submission error:", err);
      setFormError(
        err instanceof Error ? err.message : "Failed to submit meeting request. Please retry.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRequest = async (meeting: MeetingRequest) => {
    setError(null);
    setCancellingMeetingId(meeting.id);
    try {
      await cancelMeeting(meeting.id, "Cancelled by client from Client Portal.");
      setFormSuccess(`Meeting "${meeting.title}" has been cancelled.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to cancel meeting request.");
    } finally {
      setCancellingMeetingId(null);
    }
  };

  const getJoinLabel = (meeting: MeetingRequest) => {
    const p = meeting.platform;
    const url = (meeting.meetingUrl || "").toLowerCase();
    if (
      p === "Microsoft Teams" ||
      url.includes("teams.microsoft.com") ||
      url.includes("teams.live.com")
    ) {
      return "Join Microsoft Teams";
    }
    if (p === "Google Meet" || url.includes("meet.google.com")) {
      return "Join Google Meet";
    }
    return "Join Meeting";
  };

  // Group meetings cleanly for human-friendly scanning
  const upcomingMeetings = meetings.filter(
    (m) => m.status === "Approved" || m.status === "Rescheduled",
  );
  const pendingMeetings = meetings.filter((m) => m.status === "Pending");
  const pastMeetings = meetings.filter(
    (m) => m.status === "Completed" || m.status === "Rejected" || m.status === "Cancelled",
  );

  // Filter meetings
  const filteredMeetings = meetings.filter((m) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "upcoming") return m.status === "Approved" || m.status === "Rescheduled";
    if (statusFilter === "pending") return m.status === "Pending";
    if (statusFilter === "past")
      return m.status === "Completed" || m.status === "Rejected" || m.status === "Cancelled";
    return m.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const pendingCount = pendingMeetings.length;
  const upcomingCount = upcomingMeetings.length;
  const pastCount = pastMeetings.length;

  const formatDateDisplay = (dateStr?: string, timeStr?: string) => {
    if (!dateStr) return "Pending Confirmation";
    try {
      const d = new Date(dateStr);
      const dateFormatted = isNaN(d.getTime())
        ? dateStr
        : d.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
      return timeStr ? `${dateFormatted} at ${timeStr}` : dateFormatted;
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: MeetingStatus) => {
    switch (status) {
      case "Approved":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="size-3" />
            Approved
          </span>
        );
      case "Rescheduled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
            <CalendarRange className="size-3" />
            Rescheduled
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-destructive/10 text-destructive border border-destructive/30">
            <CalendarX className="size-3" />
            Declined
          </span>
        );
      case "Cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-muted text-muted-foreground border border-border">
            <CalendarX className="size-3" />
            Cancelled
          </span>
        );
      case "Completed":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-muted text-muted-foreground border border-border">
            <CalendarCheck className="size-3" />
            Completed
          </span>
        );
      case "Pending":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="size-3" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Quick Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">Meetings</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Request meetings, track upcoming sessions, and join your confirmed video calls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setIsFormOpen(!isFormOpen);
              setFormSuccess(null);
              setFormError(null);
            }}
            className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs h-9 px-4"
          >
            <Plus className="size-3.5 mr-1.5" />
            {isFormOpen ? "Close Meeting Form" : "Request a Meeting"}
          </Button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {formSuccess && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-400 flex items-start gap-3">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{formSuccess}</p>
          </div>
          <button
            type="button"
            onClick={() => setFormSuccess(null)}
            className="font-mono text-[11px] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification Banner */}
      {error && (
        <div className="border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
            className="h-7 text-xs font-mono"
          >
            Retry
          </Button>
        </div>
      )}

      {/* REQUEST MEETING FORM DRAWER / PANEL */}
      {isFormOpen && (
        <div className="border border-border bg-surface p-5 sm:p-7 shadow-sm transition-all duration-200">
          <div className="flex items-center justify-between border-b border-border/80 pb-4 mb-5">
            <div>
              <h3 className="font-display text-lg font-medium">New Meeting Request</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Propose your preferred schedule and discussion objectives.
              </p>
            </div>
            <span className="font-mono text-[11px] border border-border bg-card px-2 py-0.5 text-muted-foreground">
              Direct with VINORA Leads
            </span>
          </div>

          {formError && (
            <div className="mb-5 border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1. Preferred Platform (Google Meet / Microsoft Teams / In-Person) */}
            <div className="space-y-2">
              <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Preferred Platform *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMeetingType("Online Meeting");
                    setPlatform("Google Meet");
                  }}
                  className={`p-3.5 border text-left cursor-pointer transition-all flex items-center justify-between ${
                    meetingType === "Online Meeting" && platform === "Google Meet"
                      ? "border-foreground bg-card text-foreground shadow-xs"
                      : "border-border bg-surface/50 text-muted-foreground hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Video className="size-4 text-foreground" />
                    <span className="font-display text-sm font-semibold">Google Meet</span>
                  </div>
                  {meetingType === "Online Meeting" && platform === "Google Meet" && (
                    <span className="size-2 rounded-full bg-emerald-500" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMeetingType("Online Meeting");
                    setPlatform("Microsoft Teams");
                  }}
                  className={`p-3.5 border text-left cursor-pointer transition-all flex items-center justify-between ${
                    meetingType === "Online Meeting" && platform === "Microsoft Teams"
                      ? "border-foreground bg-card text-foreground shadow-xs"
                      : "border-border bg-surface/50 text-muted-foreground hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Video className="size-4 text-foreground" />
                    <span className="font-display text-sm font-semibold">Microsoft Teams</span>
                  </div>
                  {meetingType === "Online Meeting" && platform === "Microsoft Teams" && (
                    <span className="size-2 rounded-full bg-emerald-500" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMeetingType("In-Person Meeting");
                    setPlatform("In-Person");
                  }}
                  className={`p-3.5 border text-left cursor-pointer transition-all flex items-center justify-between ${
                    meetingType === "In-Person Meeting"
                      ? "border-foreground bg-card text-foreground shadow-xs"
                      : "border-border bg-surface/50 text-muted-foreground hover:border-border/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MapPin className="size-4 text-foreground" />
                    <span className="font-display text-sm font-semibold">In-Person</span>
                  </div>
                  {meetingType === "In-Person Meeting" && (
                    <span className="size-2 rounded-full bg-emerald-500" />
                  )}
                </button>
              </div>
            </div>

            {/* 2. Date & Time Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Preferred Date *
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    required
                    value={preferredDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setPreferredDate(e.target.value)}
                    className="rounded-none border-border bg-background text-xs font-mono h-10"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Preferred Time *
                </label>
                <div className="flex gap-2">
                  <select
                    value={
                      TIME_SLOTS.some((s) => s.value === preferredTime) ? preferredTime : "custom"
                    }
                    onChange={(e) => {
                      if (e.target.value !== "custom") setPreferredTime(e.target.value);
                    }}
                    className="flex-1 h-10 border border-border bg-background px-3 text-xs font-mono text-foreground focus:border-foreground focus:outline-hidden"
                  >
                    {TIME_SLOTS.map((slot) => (
                      <option key={slot.value} value={slot.value}>
                        {slot.label}
                      </option>
                    ))}
                    <option value="custom">Custom Time...</option>
                  </select>
                  <Input
                    type="time"
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-28 rounded-none border-border bg-background text-xs font-mono h-10"
                    aria-label="Exact preferred time"
                  />
                </div>
              </div>
            </div>

            {/* 3. Meeting Purpose & Description */}
            <div className="space-y-2">
              <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Quick Purpose Topics
              </label>
              <div className="flex flex-wrap gap-2">
                {PURPOSE_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setPurposePreset(preset);
                      setCustomTitle(preset);
                    }}
                    className={`px-3 py-1.5 border text-xs font-mono transition-colors cursor-pointer ${
                      purposePreset === preset
                        ? "border-foreground bg-foreground text-background font-bold"
                        : "border-border bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Meeting Purpose *
                </label>
                <Input
                  type="text"
                  placeholder={purposePreset || "e.g. Project Roadmap & Architecture Review"}
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="rounded-none border-border bg-background text-xs h-10"
                />
              </div>

              {projects.length > 0 && (
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Related Project (Optional)
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full h-10 border border-border bg-background px-3 text-xs text-foreground focus:border-foreground focus:outline-hidden"
                  >
                    <option value="">-- General Account Consultation --</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} ({p.status || "Active"})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1.5 sm:col-span-2">
                <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Meeting Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Briefly describe what you would like to discuss during this meeting..."
                  value={purposeDetails}
                  onChange={(e) => setPurposeDetails(e.target.value)}
                  className="w-full border border-border bg-background p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-hidden"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                className="rounded-none cursor-pointer text-xs h-9 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs h-9 px-5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Calendar className="size-3.5 mr-1.5" />
                    Submit Meeting Request
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Tabs: Upcoming, Pending, Past */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "All Meetings", count: meetings.length },
            { id: "upcoming", label: "Upcoming Meetings", count: upcomingCount },
            { id: "pending", label: "Pending Requests", count: pendingCount },
            { id: "past", label: "Past Meetings", count: pastCount },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
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

        <div className="text-[11px] font-mono text-muted-foreground">
          Showing {filteredMeetings.length} of {meetings.length} meetings
        </div>
      </div>

      {/* MEETINGS LIST / HISTORY */}
      {isLoading ? (
        <div className="border border-border bg-surface p-12 text-center space-y-3">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Loading consultations from Firestore...
          </p>
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="border border-border bg-surface p-12 text-center space-y-4">
          <Calendar className="size-10 mx-auto text-muted-foreground/40" />
          <div className="max-w-md mx-auto">
            <h3 className="font-display text-base font-semibold">No Meetings Found</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {statusFilter !== "all"
                ? `You have no ${statusFilter} meeting records.`
                : "You have not scheduled any meetings yet. Book an online discovery session or in-person architectural review with our engineering leadership."}
            </p>
          </div>
          {statusFilter === "all" && (
            <Button
              onClick={() => setIsFormOpen(true)}
              size="sm"
              className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs"
            >
              <Plus className="size-3.5 mr-1" />
              Schedule First Meeting
            </Button>
          )}
        </div>
      ) : (
        (() => {
          const renderMeetingCard = (meeting: MeetingRequest) => {
            const isApproved = meeting.status === "Approved";
            const isRescheduled = meeting.status === "Rescheduled";
            const isRejected = meeting.status === "Rejected";
            const isCancelled = meeting.status === "Cancelled";
            const canCancel =
              meeting.status === "Pending" ||
              meeting.status === "Approved" ||
              meeting.status === "Rescheduled";
            const platformLabel =
              meeting.platform ||
              (meeting.meetingType === "In-Person Meeting" ? "In-Person" : "Google Meet");

            return (
              <div
                key={meeting.id}
                className="border border-border bg-card p-5 sm:p-6 transition-all hover:border-foreground/30 space-y-4"
              >
                {/* Top Bar: Title & Status */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-border/60 pb-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-display text-base font-semibold text-foreground">
                        {meeting.title}
                      </h4>
                      <span className="font-mono text-[10px] px-2 py-0.5 border border-border bg-surface text-muted-foreground">
                        {platformLabel}
                      </span>
                      {meeting.projectTitle && (
                        <span className="font-mono text-[10px] px-2 py-0.5 border border-border bg-surface text-muted-foreground">
                          Project: {meeting.projectTitle}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-sans line-clamp-2">
                      {meeting.purpose}
                    </p>
                  </div>

                  <div className="shrink-0">{getStatusBadge(meeting.status)}</div>
                </div>

                {/* Timing & Logistics Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs font-mono">
                  {/* Requested Date & Time */}
                  <div className="border border-border/70 bg-surface/50 p-3 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                      Requested Window
                    </span>
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      <span>{formatDateDisplay(meeting.preferredDate, meeting.preferredTime)}</span>
                    </div>
                  </div>

                  {/* Confirmed / Scheduled Date */}
                  <div className="border border-border/70 bg-surface/50 p-3 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                      Confirmed Schedule
                    </span>
                    <div className="flex items-center gap-1.5 text-foreground font-medium">
                      <Clock className="size-3.5 text-muted-foreground" />
                      <span>
                        {meeting.scheduledAt
                          ? new Date(meeting.scheduledAt).toLocaleString("en-US", {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : meeting.status === "Approved"
                            ? formatDateDisplay(meeting.preferredDate, meeting.preferredTime)
                            : meeting.status === "Completed" ||
                                meeting.status === "Cancelled" ||
                                meeting.status === "Rejected"
                              ? formatDateDisplay(meeting.preferredDate, meeting.preferredTime)
                              : "Awaiting Confirmation"}
                      </span>
                    </div>
                  </div>

                  {/* Format / Location */}
                  <div className="border border-border/70 bg-surface/50 p-3 space-y-1 sm:col-span-2 md:col-span-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                      Location / Access
                    </span>
                    <div className="flex items-center gap-1.5 text-foreground font-medium truncate">
                      {meeting.meetingType === "Online Meeting" ? (
                        <>
                          <Video className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {meeting.meetingUrl
                              ? `${platformLabel} Link Ready`
                              : meeting.status === "Completed" ||
                                  meeting.status === "Cancelled" ||
                                  meeting.status === "Rejected"
                                ? `${platformLabel}`
                                : "Meeting link will be shared soon."}
                          </span>
                        </>
                      ) : (
                        <>
                          <MapPin className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            {meeting.location || "VINORA Studio (SF / London)"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* If Rescheduled: Show Explanation & Highlighted Changes */}
                {isRescheduled && (
                  <div className="border border-indigo-500/20 bg-indigo-500/5 p-3.5 text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 text-indigo-400 font-mono font-semibold">
                      <CalendarRange className="size-3.5" />
                      <span>Rescheduling Notice from Lead Architect</span>
                    </div>
                    <p className="text-foreground leading-relaxed">
                      {meeting.rescheduleReason ||
                        "Our engineering leads have proposed an updated time window to ensure complete technical alignment."}
                    </p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Updated Proposed Time:{" "}
                      <strong className="text-foreground">
                        {formatDateDisplay(meeting.preferredDate, meeting.preferredTime)}
                      </strong>
                    </p>
                  </div>
                )}

                {/* If Rejected: Show Explanation */}
                {isRejected && (
                  <div className="border border-destructive/20 bg-destructive/5 p-3.5 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-destructive font-mono font-semibold">
                      <CalendarX className="size-3.5" />
                      <span>Notice of Non-Availability</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {meeting.rejectionReason ||
                        "Our team is fully booked during this specific window. Please submit a new preferred time."}
                    </p>
                  </div>
                )}

                {/* If Cancelled: Show Cancellation details */}
                {isCancelled && (
                  <div className="border border-border bg-surface/50 p-3.5 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground font-mono font-semibold">
                      <CalendarX className="size-3.5" />
                      <span>Meeting Cancelled</span>
                    </div>
                    {meeting.cancellationReason && (
                      <p className="text-muted-foreground leading-relaxed">
                        {meeting.cancellationReason}
                      </p>
                    )}
                  </div>
                )}

                {/* Admin Notes / Instructions */}
                {meeting.adminNotes && (
                  <div className="border border-border/80 bg-surface/30 p-3 text-xs space-y-1">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Studio Note from {meeting.approvedBy || "Lead Architect"}:
                    </span>
                    <p className="text-foreground font-sans leading-relaxed">
                      {meeting.adminNotes}
                    </p>
                  </div>
                )}

                {/* Action Bar (Join Button or Cancel Request) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 text-xs">
                  <div className="text-[11px] font-mono text-muted-foreground">
                    Requested on {new Date(meeting.createdAt).toLocaleDateString()} • Ref:{" "}
                    {meeting.id.slice(0, 10)}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {(isApproved || isRescheduled) && meeting.meetingUrl && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={meeting.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline truncate max-w-[220px]"
                          title={meeting.meetingUrl}
                        >
                          {meeting.meetingUrl}
                        </a>
                        <Button
                          asChild
                          size="sm"
                          className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs h-8 px-3.5"
                        >
                          <a href={meeting.meetingUrl} target="_blank" rel="noopener noreferrer">
                            <Video className="size-3.5 mr-1.5" />
                            {getJoinLabel(meeting)}
                            <ExternalLink className="size-3 ml-1" />
                          </a>
                        </Button>
                      </div>
                    )}

                    {(isApproved || isRescheduled) && meeting.location && (
                      <div className="font-mono text-xs border border-border bg-surface px-3 py-1 text-foreground">
                        Venue: {meeting.location}
                      </div>
                    )}

                    {canCancel && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={cancellingMeetingId === meeting.id}
                        onClick={() => handleCancelRequest(meeting)}
                        className="rounded-none cursor-pointer font-mono text-xs h-8 px-3 border-border text-muted-foreground hover:text-destructive hover:border-destructive/50"
                      >
                        {cancellingMeetingId === meeting.id ? (
                          <Loader2 className="size-3 animate-spin mr-1" />
                        ) : (
                          <CalendarX className="size-3 mr-1" />
                        )}
                        Cancel Request
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          };

          if (statusFilter === "all") {
            const groups = [
              { id: "upcoming", title: "Upcoming Meetings", items: upcomingMeetings },
              { id: "pending", title: "Pending Requests", items: pendingMeetings },
              { id: "past", title: "Past Meetings", items: pastMeetings },
            ].filter((g) => g.items.length > 0);

            return (
              <div className="space-y-8">
                {groups.map((group) => (
                  <section key={group.id} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-2">
                      <h3 className="font-display text-base font-medium text-foreground">
                        {group.title}
                      </h3>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {group.items.length}
                      </span>
                    </div>
                    <div className="space-y-4">{group.items.map(renderMeetingCard)}</div>
                  </section>
                ))}
              </div>
            );
          }

          return <div className="space-y-4">{filteredMeetings.map(renderMeetingCard)}</div>;
        })()
      )}
    </div>
  );
}
