import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Users,
  FolderGit2,
  Inbox,
  Mail,
  FileText,
  Receipt,
  MessageSquare,
  Search,
  CheckCircle2,
  Clock,
  X,
  Check,
  Eye,
  Calendar,
  ChevronRight,
  AlertCircle,
  Sparkles,
  ThumbsDown,
  CreditCard,
  Plus,
  ScrollText,
  Megaphone,
  Bell,
  Folder,
  Gift,
  Edit3,
  Trash2,
  ArrowRight,
  ArrowUpRight,
} from "lucide-react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth";

import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { AdminPortalLayout } from "@/components/layout/AdminPortalLayout";
import { AdminProjectModal } from "@/components/admin/AdminProjectModal";
import { AdminClientDossierModal } from "@/components/admin/AdminClientDossierModal";
import { AdminUpdatesSection } from "@/components/admin/AdminUpdatesSection";
import { AdminNotificationsSection } from "@/components/admin/AdminNotificationsSection";
import { AdminProfileSection } from "@/components/admin/AdminProfileSection";
import { ProjectThumbnailBox } from "@/lib/projectThumbnails";
import {
  adminSignOut,
  verifyAndLoadAdmin,
  AUTHORIZED_ADMIN_ACCOUNTS,
  type AdminRecord,
} from "@/services/adminAuth";
import {
  fetchAdminDashboardData,
  updateProjectRequestStatus,
  updateContactStatus,
  updateClientStatus,
  deleteAdminProject,
  subscribeAllStudioUpdates,
  type AdminClientProfile,
  type AdminDashboardData,
  type StudioUpdateRecord,
} from "@/services/adminDashboard";
import { approveProjectForShowcase, rejectProjectFromShowcase } from "@/services/showcase";
import { PublicProjectShowcase } from "@/components/brand/PublicProjectShowcase";
import { WhatsAppAdminChat } from "@/components/messaging/WhatsAppAdminChat";
import { subscribeToUnreadCount } from "@/services/messaging";
import { AdminMeetingsSection } from "@/components/meetings/AdminMeetingsSection";
import { AdminDocumentsSection } from "@/components/documents/AdminDocumentsSection";
import { AdminProposalsSection } from "@/components/proposals/AdminProposalsSection";
import { AdminInvoicesSection } from "@/components/invoices/AdminInvoicesSection";
import { AdminPaymentsSection } from "@/components/invoices/AdminPaymentsSection";
import { AdminReferralsSection } from "@/components/referrals/AdminReferralsSection";
import { subscribeAllMeetings } from "@/services/meetingService";
import { subscribeAllPayments } from "@/services/paymentService";
import { subscribeAllDocuments } from "@/services/documentService";
import {
  subscribeAdminNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/services/notificationService";
import type {
  ProjectRequest,
  ContactSubmission,
  Project,
  MeetingRequest,
  Payment,
  ClientDocument,
  Notification,
} from "@/lib/types";

export type AdminSection =
  | "Dashboard"
  | "Clients"
  | "Projects"
  | "Proposals"
  | "Payments"
  | "Invoices"
  | "Meeting Requests"
  | "Documents"
  | "Messages"
  | "Updates"
  | "Notifications"
  | "Project Requests"
  | "Contact Enquiries"
  | "Referrals"
  | "Admin Profile"
  | "Settings";

function normalizeSection(label?: string): AdminSection {
  if (!label) return "Dashboard";
  const s = label.toLowerCase().trim();
  if (s === "overview" || s === "dashboard" || s === "home") return "Dashboard";
  if (s === "clients" || s === "client directory") return "Clients";
  if (s === "projects" || s === "studio projects") return "Projects";
  if (
    s === "project requests" ||
    s === "requests" ||
    s === "projectrequests" ||
    s === "leads" ||
    s.includes("lead")
  ) {
    return "Project Requests";
  }
  if (
    s === "meeting requests" ||
    s === "meetings" ||
    s === "meeting" ||
    s === "consultations" ||
    s === "meetingrequests"
  ) {
    return "Meeting Requests";
  }
  if (s === "documents" || s === "files" || s === "document" || s === "file") {
    return "Documents";
  }
  if (s === "contact enquiries" || s === "enquiries" || s === "contact" || s === "inquiries") {
    return "Contact Enquiries";
  }
  if (s === "proposals" || s.includes("proposal") || s.includes("budget")) return "Proposals";
  if (s === "invoices" || s.includes("invoice")) return "Invoices";
  if (s === "payments" || s === "razorpay" || s === "transactions") return "Payments";
  if (s === "updates" || s === "announcements" || s === "notes") return "Updates";
  if (s === "notifications" || s === "alerts") return "Notifications";
  if (
    s === "referrals" ||
    s === "referral" ||
    s === "refer" ||
    s === "rewards" ||
    s.includes("referral")
  ) {
    return "Referrals";
  }
  if (s === "messages" || s === "chat") return "Messages";
  if (s === "admin profile" || s === "profile") return "Admin Profile";
  if (s === "settings" || s === "security") return "Settings";
  return "Dashboard";
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

function formatDateShort(dateStr?: string): string {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
  } catch {
    return dateStr;
  }
}

function getProjectStatusBadgeClass(status?: string): string {
  const s = (status || "").toLowerCase();
  if (s.includes("complete")) {
    return "border-emerald-400/30 bg-emerald-500/15 text-emerald-300";
  }
  if (
    s.includes("progress") ||
    s.includes("develop") ||
    s.includes("design") ||
    s.includes("test")
  ) {
    return "border-blue-400/30 bg-blue-500/15 text-blue-300";
  }
  if (s.includes("approv") || s.includes("review")) {
    return "border-white/25 bg-white/10 text-zinc-100";
  }
  if (s.includes("hold")) {
    return "border-amber-400/30 bg-amber-500/15 text-amber-300";
  }
  return "border-white/15 bg-white/[0.06] text-zinc-300";
}

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>): { section?: string } => ({
    section: typeof search.section === "string" ? search.section : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Admin Portal — VINORA Studio Operations" },
      {
        name: "description",
        content:
          "The internal operating system for VINORA. Secure access strictly restricted to authorized administrators.",
      },
      { property: "og:title", content: "Admin Portal — VINORA" },
      {
        property: "og:description",
        content: "Internal operating system for the VINORA leadership team.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPortalPage,
});

function AdminPortalPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [admin, setAdmin] = useState<AdminRecord | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authState, setAuthState] = useState<
    "loading" | "authorized" | "unauthorized" | "unauthenticated"
  >("loading");

  // Navigation section synced with URL ?section=
  const [activeSection, setActiveSection] = useState<AdminSection>(() =>
    normalizeSection(search.section),
  );

  // Dashboard Data State
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Real-time Collections
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [meetings, setMeetings] = useState<MeetingRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [studioUpdates, setStudioUpdates] = useState<StudioUpdateRecord[]>([]);
  const [adminNotifications, setAdminNotifications] = useState<Notification[]>([]);

  // Search & Filter States
  const [clientSearch, setClientSearch] = useState<string>("");
  const [requestSearch, setRequestSearch] = useState<string>("");
  const [requestStatusFilter, setRequestStatusFilter] = useState<string>("all");
  const [enquirySearch, setEnquirySearch] = useState<string>("");
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState<string>("all");

  // Project & Showcase Management States
  const [projectSubTab, setProjectSubTab] = useState<"studio" | "showcase" | "preview">("studio");
  const [studioProjectSearch, setStudioProjectSearch] = useState<string>("");
  const [studioProjectStatusFilter, setStudioProjectStatusFilter] = useState<string>("all");
  const [projectModalOpen, setProjectModalOpen] = useState<boolean>(false);
  const [editingStudioProject, setEditingStudioProject] = useState<Project | null>(null);
  const [projectModalInitialClientId, setProjectModalInitialClientId] = useState<
    string | undefined
  >(undefined);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeletingProject, setIsDeletingProject] = useState<boolean>(false);

  const [projectSearch, setProjectSearch] = useState<string>("");
  const [projectShowcaseFilter, setProjectShowcaseFilter] = useState<
    "all" | "approved" | "pending" | "rejected"
  >("all");
  const [approvalModalRequest, setApprovalModalRequest] = useState<ProjectRequest | null>(null);
  const [approvalCustomTitle, setApprovalCustomTitle] = useState<string>("");
  const [approvalCustomDesc, setApprovalCustomDesc] = useState<string>("");
  const [approvalCustomImg, setApprovalCustomImg] = useState<string>("");

  // Modal / Detail drawer states
  const [selectedRequest, setSelectedRequest] = useState<ProjectRequest | null>(null);
  const [selectedEnquiry, setSelectedEnquiry] = useState<ContactSubmission | null>(null);
  const [selectedClient, setSelectedClient] = useState<AdminClientProfile | null>(null);

  // Status updating indicator & notification banners
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Sync section when URL search parameter changes
  useEffect(() => {
    if (search.section) {
      const normalized = normalizeSection(search.section);
      setActiveSection(normalized);
    }
  }, [search.section]);

  const handleSelectSection = useCallback(
    (sectionLabel: string) => {
      const normalized = normalizeSection(sectionLabel);
      setActiveSection(normalized);
      navigate({
        to: "/admin",
        search: normalized === "Dashboard" ? {} : { section: normalized.toLowerCase() },
        replace: true,
      });
    },
    [navigate],
  );

  // 1. Verify Admin Authentication & Authorization
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setAuthState("unauthenticated");
        navigate({ to: "/login", search: { role: "admin" } });
        return;
      }

      try {
        const record = await verifyAndLoadAdmin(user);
        if (record && record.active && record.role === "admin") {
          setAdmin(record);
          setAuthState("authorized");
        } else {
          setAuthState("unauthorized");
        }
      } catch (err) {
        console.error("[VINORA Admin] Auth verification failed:", err);
        setAuthState("unauthorized");
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  // 2. Fetch real Firestore dashboard data when authorized
  const loadDashboardData = useCallback(async () => {
    setIsLoadingData(true);
    setDataError(null);
    try {
      const result = await fetchAdminDashboardData();
      setData(result);
      setLastRefreshedAt(new Date());
    } catch (err) {
      console.error("[VINORA Admin] Error loading dashboard data:", err);
      setDataError("Unable to retrieve all administrative collections from Firestore.");
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (authState === "authorized") {
      loadDashboardData();
    }
  }, [authState, loadDashboardData]);

  // 3. Real-time Firestore Subscriptions for Notifications, Meetings, Payments, Documents, Updates, Chat
  useEffect(() => {
    if (authState !== "authorized" || !admin) return;
    const unsubUnread = subscribeToUnreadCount("admin", admin.uid, setUnreadMessagesCount);
    const unsubMeetings = subscribeAllMeetings(setMeetings);
    const unsubPayments = subscribeAllPayments(setPayments);
    const unsubDocs = subscribeAllDocuments(setDocuments);
    const unsubUpdates = subscribeAllStudioUpdates(setStudioUpdates);
    const unsubNotifs = subscribeAdminNotifications(admin.uid, setAdminNotifications);

    return () => {
      unsubUnread();
      unsubMeetings();
      unsubPayments();
      unsubDocs();
      unsubUpdates();
      unsubNotifs();
    };
  }, [authState, admin]);

  // Handle Unauthorized redirection after grace period
  useEffect(() => {
    if (authState === "unauthorized") {
      const timer = setTimeout(() => {
        navigate({ to: "/login", search: { role: "admin", status: "unauthorized" } });
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [authState, navigate]);

  async function handleAdminLogout() {
    await adminSignOut();
    navigate({ to: "/login", search: { role: "admin", status: "admin_signed_out" } });
  }

  async function handleSignOutAndSwitchToAdmin() {
    await firebaseSignOut(auth);
    navigate({ to: "/login", search: { role: "admin" } });
  }

  function showTransientSuccess(msg: string) {
    setSuccessBanner(msg);
    setTimeout(() => setSuccessBanner(null), 6000);
  }

  // Action handlers
  async function handleUpdateRequestStatus(
    requestId: string,
    newStatus: "Pending Review" | "Reviewing" | "Approved" | "Rejected",
  ) {
    setIsUpdating(requestId);
    try {
      await updateProjectRequestStatus(requestId, newStatus);
      setData((prev) => {
        if (!prev) return null;
        const updatedRequests = prev.projectRequests.map((r) =>
          r.id === requestId ? { ...r, status: newStatus, updatedAt: new Date().toISOString() } : r,
        );
        return {
          ...prev,
          projectRequests: updatedRequests,
          stats: {
            ...prev.stats,
            pendingProjectRequests: updatedRequests.filter((r) => {
              const s = (r.status || "").toLowerCase();
              return s.includes("pending") || s.includes("new") || s === "reviewing";
            }).length,
          },
        };
      });
      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      showTransientSuccess(`Project request updated to "${newStatus}".`);
    } catch (err) {
      console.error("Failed to update project request status:", err);
    } finally {
      setIsUpdating(null);
    }
  }

  async function handleUpdateContactStatus(
    enquiryId: string,
    newStatus: "New" | "Contacted" | "Resolved" | "Archived",
  ) {
    setIsUpdating(enquiryId);
    try {
      await updateContactStatus(enquiryId, newStatus);
      setData((prev) => {
        if (!prev) return null;
        const updatedEnquiries = prev.contactEnquiries.map((e) =>
          e.id === enquiryId ? { ...e, status: newStatus } : e,
        );
        return {
          ...prev,
          contactEnquiries: updatedEnquiries,
        };
      });
      if (selectedEnquiry && selectedEnquiry.id === enquiryId) {
        setSelectedEnquiry((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      showTransientSuccess(`Contact enquiry marked as "${newStatus}".`);
    } catch (err) {
      console.error("Failed to update contact enquiry status:", err);
    } finally {
      setIsUpdating(null);
    }
  }

  async function handleUpdateClientStatus(
    clientId: string,
    accountStatus: "active" | "suspended" | "pending",
  ) {
    setIsUpdating(clientId);
    try {
      await updateClientStatus(clientId, accountStatus);
      setData((prev) => {
        if (!prev) return null;
        const updatedClients = prev.clients.map((c) =>
          c.uid === clientId || c.id === clientId ? { ...c, accountStatus } : c,
        );
        return {
          ...prev,
          clients: updatedClients,
        };
      });
      if (selectedClient && (selectedClient.uid === clientId || selectedClient.id === clientId)) {
        setSelectedClient((prev) => (prev ? { ...prev, accountStatus } : null));
      }
      showTransientSuccess(`Client account updated to "${accountStatus}".`);
    } catch (err) {
      console.error("Failed to update client status:", err);
    } finally {
      setIsUpdating(null);
    }
  }

  async function confirmDeleteStudioProject() {
    if (!projectToDelete) return;
    setIsDeletingProject(true);
    try {
      await deleteAdminProject(projectToDelete.id);
      setData((prev) =>
        prev
          ? {
              ...prev,
              projects: prev.projects.filter((p) => p.id !== projectToDelete.id),
            }
          : null,
      );
      showTransientSuccess(`Deleted project "${projectToDelete.title}".`);
      setProjectToDelete(null);
    } catch (err) {
      console.error("Failed to delete project:", err);
      setDataError(err instanceof Error ? err.message : "Failed to delete project.");
    } finally {
      setIsDeletingProject(false);
    }
  }

  function openCreateProjectModal(initialClientId?: string) {
    setEditingStudioProject(null);
    setProjectModalInitialClientId(initialClientId);
    setProjectModalOpen(true);
  }

  function openEditProjectModal(project: Project) {
    setEditingStudioProject(project);
    setProjectModalInitialClientId(undefined);
    setProjectModalOpen(true);
  }

  // Showcase Approval Handlers
  function openApprovalModal(req: ProjectRequest) {
    setApprovalModalRequest(req);
    const suggestedTitle =
      req.showcaseTitle ||
      (req.businessName ? `${req.businessName} — ${req.serviceRequired}` : req.serviceRequired) ||
      req.name;
    setApprovalCustomTitle(suggestedTitle);
    setApprovalCustomDesc(req.showcaseDescription || req.projectDescription || "");
    setApprovalCustomImg(req.imageUrl || "");
  }

  async function handleApproveShowcase(
    requestId: string,
    customMeta?: { showcaseTitle?: string; showcaseDescription?: string; imageUrl?: string },
  ) {
    if (!admin) return;
    setIsUpdating(requestId);
    setSuccessBanner(null);
    try {
      const now = new Date().toISOString();
      const adminId = admin.email || admin.name || admin.uid;

      await approveProjectForShowcase(requestId, adminId, {
        collectionName: "projectRequests",
        showcaseTitle: customMeta?.showcaseTitle,
        showcaseDescription: customMeta?.showcaseDescription,
        imageUrl: customMeta?.imageUrl,
      });

      setData((prev) => {
        if (!prev) return null;
        const updatedRequests = prev.projectRequests.map((r) =>
          r.id === requestId
            ? {
                ...r,
                showcaseApproved: true,
                status: "Approved",
                approvedAt: now,
                approvedBy: adminId,
                rejectionReason: undefined,
                showcaseTitle: customMeta?.showcaseTitle || r.showcaseTitle,
                showcaseDescription: customMeta?.showcaseDescription || r.showcaseDescription,
                imageUrl: customMeta?.imageUrl || r.imageUrl,
                updatedAt: now,
              }
            : r,
        );
        const liveCount =
          updatedRequests.filter((r) => r.showcaseApproved === true).length +
          prev.projects.filter((p) => p.showcaseApproved === true).length;

        return {
          ...prev,
          projectRequests: updatedRequests,
          stats: {
            ...prev.stats,
            showcaseApprovedCount: liveCount,
          },
        };
      });

      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest((prev) =>
          prev
            ? {
                ...prev,
                showcaseApproved: true,
                status: "Approved",
                approvedAt: now,
                approvedBy: adminId,
                rejectionReason: undefined,
                showcaseTitle: customMeta?.showcaseTitle || prev.showcaseTitle,
                showcaseDescription: customMeta?.showcaseDescription || prev.showcaseDescription,
                imageUrl: customMeta?.imageUrl || prev.imageUrl,
              }
            : null,
        );
      }

      setApprovalModalRequest(null);
      showTransientSuccess(
        `Project #${requestId.slice(0, 8)} approved and is now live on the public showcase.`,
      );
    } catch (err) {
      console.error("Failed to approve project for showcase:", err);
    } finally {
      setIsUpdating(null);
    }
  }

  async function handleRejectShowcase(requestId: string, reason?: string) {
    if (!admin) return;
    setIsUpdating(requestId);
    setSuccessBanner(null);
    try {
      const now = new Date().toISOString();
      const adminId = admin.email || admin.name || admin.uid;

      await rejectProjectFromShowcase(
        requestId,
        adminId,
        reason || "Declined for public showcase by VINORA operations",
        "projectRequests",
      );

      setData((prev) => {
        if (!prev) return null;
        const updatedRequests = prev.projectRequests.map((r) =>
          r.id === requestId
            ? {
                ...r,
                showcaseApproved: false,
                status: "Rejected",
                approvedAt: null,
                approvedBy: adminId,
                rejectionReason: reason || "Declined for public showcase",
                updatedAt: now,
              }
            : r,
        );
        const liveCount =
          updatedRequests.filter((r) => r.showcaseApproved === true).length +
          prev.projects.filter((p) => p.showcaseApproved === true).length;

        return {
          ...prev,
          projectRequests: updatedRequests,
          stats: {
            ...prev.stats,
            showcaseApprovedCount: liveCount,
          },
        };
      });

      if (selectedRequest && selectedRequest.id === requestId) {
        setSelectedRequest((prev) =>
          prev
            ? {
                ...prev,
                showcaseApproved: false,
                status: "Rejected",
                approvedAt: null,
                approvedBy: adminId,
                rejectionReason: reason || "Declined for public showcase",
              }
            : null,
        );
      }

      showTransientSuccess(
        `Project #${requestId.slice(0, 8)} rejected / removed from the public showcase.`,
      );
    } catch (err) {
      console.error("Failed to reject project from showcase:", err);
    } finally {
      setIsUpdating(null);
    }
  }

  // Client lookup map for fast name resolution across studio projects
  const clientByUidMap = useMemo(() => {
    const map = new Map<string, AdminClientProfile>();
    for (const c of data?.clients || []) {
      map.set(c.uid, c);
      map.set(c.id, c);
    }
    return map;
  }, [data?.clients]);

  // Filtered Queries
  const filteredStudioProjects = useMemo(() => {
    const list = data?.projects || [];
    const q = studioProjectSearch.toLowerCase().trim();
    return list.filter((proj) => {
      if (studioProjectStatusFilter !== "all") {
        const s = (proj.status || "").toLowerCase();
        if (studioProjectStatusFilter === "active") {
          if (s.includes("complete") || s.includes("close") || s.includes("hold")) return false;
        } else if (!s.includes(studioProjectStatusFilter)) {
          return false;
        }
      }
      if (!q) return true;
      const client = clientByUidMap.get(proj.clientId);
      const clientName = (proj.clientName || client?.name || "").toLowerCase();
      return (
        proj.title.toLowerCase().includes(q) ||
        (proj.category || proj.serviceRequired || "").toLowerCase().includes(q) ||
        proj.description.toLowerCase().includes(q) ||
        clientName.includes(q) ||
        proj.id.toLowerCase().includes(q)
      );
    });
  }, [data?.projects, studioProjectSearch, studioProjectStatusFilter, clientByUidMap]);

  const filteredShowcaseRequests = useMemo(() => {
    if (!data?.projectRequests) return [];
    return data.projectRequests.filter((r) => {
      const q = projectSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        (r.businessName && r.businessName.toLowerCase().includes(q)) ||
        (r.serviceRequired && r.serviceRequired.toLowerCase().includes(q)) ||
        (r.projectDescription && r.projectDescription.toLowerCase().includes(q)) ||
        r.id.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (projectShowcaseFilter === "approved") {
        return r.showcaseApproved === true;
      }
      if (projectShowcaseFilter === "pending") {
        const s = (r.status || "").toLowerCase();
        return !r.showcaseApproved && !s.includes("reject");
      }
      if (projectShowcaseFilter === "rejected") {
        const s = (r.status || "").toLowerCase();
        return r.showcaseApproved === false && (s.includes("reject") || Boolean(r.rejectionReason));
      }

      return true;
    });
  }, [data?.projectRequests, projectSearch, projectShowcaseFilter]);

  const filteredClients = useMemo(() => {
    if (!data?.clients) return [];
    if (!clientSearch.trim()) return data.clients;
    const q = clientSearch.toLowerCase();
    return data.clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.companyName && c.companyName.toLowerCase().includes(q)) ||
        c.uid.toLowerCase().includes(q),
    );
  }, [data?.clients, clientSearch]);

  const filteredRequests = useMemo(() => {
    if (!data?.projectRequests) return [];
    return data.projectRequests.filter((r) => {
      const matchesSearch =
        !requestSearch.trim() ||
        r.name.toLowerCase().includes(requestSearch.toLowerCase()) ||
        r.email.toLowerCase().includes(requestSearch.toLowerCase()) ||
        (r.businessName && r.businessName.toLowerCase().includes(requestSearch.toLowerCase())) ||
        (r.serviceRequired &&
          r.serviceRequired.toLowerCase().includes(requestSearch.toLowerCase())) ||
        r.id.toLowerCase().includes(requestSearch.toLowerCase());

      if (!matchesSearch) return false;
      if (requestStatusFilter === "all") return true;

      const s = (r.status || "").toLowerCase();
      if (requestStatusFilter === "pending") return s.includes("pending") || s.includes("new");
      if (requestStatusFilter === "reviewing") return s.includes("review");
      if (requestStatusFilter === "approved") return s.includes("approv");
      if (requestStatusFilter === "rejected") return s.includes("reject");
      return true;
    });
  }, [data?.projectRequests, requestSearch, requestStatusFilter]);

  const filteredEnquiries = useMemo(() => {
    if (!data?.contactEnquiries) return [];
    return data.contactEnquiries.filter((e) => {
      const matchesSearch =
        !enquirySearch.trim() ||
        e.name.toLowerCase().includes(enquirySearch.toLowerCase()) ||
        e.email.toLowerCase().includes(enquirySearch.toLowerCase()) ||
        (e.subject && e.subject.toLowerCase().includes(enquirySearch.toLowerCase())) ||
        (e.message && e.message.toLowerCase().includes(enquirySearch.toLowerCase()));

      if (!matchesSearch) return false;
      if (enquiryStatusFilter === "all") return true;

      const s = (e.status || "").toLowerCase();
      if (enquiryStatusFilter === "new") return s === "new";
      if (enquiryStatusFilter === "contacted") return s.includes("contact");
      if (enquiryStatusFilter === "resolved") return s.includes("resolv");
      return true;
    });
  }, [data?.contactEnquiries, enquirySearch, enquiryStatusFilter]);

  // Derived Metrics (Real Firestore counts only — zero fake numbers)
  const adminMetrics = useMemo(() => {
    const pendingMeetingsCount = meetings.filter((m) => m.status === "Pending").length;
    const upcomingMeetingsCount = meetings.filter(
      (m) => m.status === "Approved" || m.status === "Rescheduled" || m.status === "Pending",
    ).length;

    if (!data) {
      return {
        totalRevenue: 0,
        currency: "₹",
        totalProjectsCount: 0,
        activeProjectsCount: 0,
        pendingProposalsCount: 0,
        totalProposalsCount: 0,
        unpaidInvoicesCount: 0,
        unpaidBalance: 0,
        totalClientsCount: 0,
        activeClientsCount: 0,
        pendingProjectRequestsCount: 0,
        pendingEnquiriesCount: 0,
        pendingLeadsCount: 0,
        pendingMeetingsCount,
        upcomingMeetingsCount,
      };
    }

    const currency = data.invoices[0]?.currency || payments[0]?.currency || "INR";

    const paidPaymentsSum = payments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const invoiceRevenue = data.invoices.reduce((sum, inv) => {
      if (inv.status === "Paid") return sum + (inv.total || inv.totalAmount || 0);
      return sum + (inv.paidAmount || inv.amountPaid || 0);
    }, 0);

    const totalRevenue = Math.max(paidPaymentsSum, invoiceRevenue);

    const activeProjectsCount = data.projects.filter((p) => {
      const s = (p.status || "").toLowerCase();
      return !s.includes("complete") && !s.includes("close") && !s.includes("reject");
    }).length;

    const pendingProposalsCount = data.proposals.filter((p) => {
      const s = (p.status || "").toLowerCase();
      return s === "sent" || s === "pending review" || s === "pending" || s === "draft";
    }).length;

    const unpaidInvoices = data.invoices.filter((inv) => {
      const s = (inv.status || "").toLowerCase();
      return s !== "paid" && s !== "cancelled";
    });
    const unpaidInvoicesCount = unpaidInvoices.length;
    const unpaidBalance = unpaidInvoices.reduce((sum, inv) => {
      const bal =
        typeof inv.balanceDue === "number"
          ? inv.balanceDue
          : (inv.total || inv.totalAmount || 0) - (inv.paidAmount || inv.amountPaid || 0);
      return sum + Math.max(0, bal);
    }, 0);

    const activeClientsCount = data.clients.filter((c) => {
      const s = (c.accountStatus || "").toLowerCase();
      return s !== "suspended" && s !== "archived";
    }).length;

    const pendingProjectRequestsCount = data.projectRequests.filter((r) => {
      const s = (r.status || "").toLowerCase();
      return !r.status || s.includes("pending") || s.includes("new") || s.includes("review");
    }).length;

    const pendingEnquiriesCount = data.contactEnquiries.filter((e) => {
      const s = (e.status || "").toLowerCase();
      return !e.status || s === "new" || s.includes("pending");
    }).length;

    return {
      totalRevenue,
      currency,
      totalProjectsCount: data.projects.length,
      activeProjectsCount,
      pendingProposalsCount,
      totalProposalsCount: data.proposals.length,
      unpaidInvoicesCount,
      unpaidBalance,
      totalClientsCount: data.clients.length,
      activeClientsCount,
      pendingProjectRequestsCount,
      pendingEnquiriesCount,
      pendingLeadsCount: pendingProjectRequestsCount + pendingEnquiriesCount,
      pendingMeetingsCount,
      upcomingMeetingsCount,
    };
  }, [data, meetings, payments]);

  // Combined Studio Updates & Activity Feed (Chronological across announcements, payments, meetings, requests, enquiries)
  const combinedStudioFeed = useMemo(() => {
    const entries: Array<{
      id: string;
      kind: "update" | "payment" | "meeting" | "request" | "enquiry" | "client";
      title: string;
      subtitle: string;
      date: string;
      badge?: string;
      targetSection: AdminSection;
      raw?: ProjectRequest | ContactSubmission | AdminClientProfile;
    }> = [];

    for (const upd of studioUpdates.filter((u) => !u.archived).slice(0, 6)) {
      entries.push({
        id: `upd-${upd.id}`,
        kind: "update",
        title: upd.title,
        subtitle: upd.description,
        date: upd.publishedAt || upd.createdAt,
        badge: upd.visibility === "specific_client" ? upd.projectTitle || "Project" : "All Clients",
        targetSection: "Updates",
      });
    }

    for (const pay of payments.slice(0, 5)) {
      entries.push({
        id: `pay-${pay.id}`,
        kind: "payment",
        title: `Payment ${pay.status}: ${pay.currency} ${pay.amount.toLocaleString()}`,
        subtitle: `${pay.clientName || "Client"}${pay.invoiceNumber ? ` • ${pay.invoiceNumber}` : ""}`,
        date: pay.paidAt || pay.createdAt,
        badge: pay.gateway || "Razorpay",
        targetSection: "Payments",
      });
    }

    for (const mtg of meetings.slice(0, 5)) {
      entries.push({
        id: `mtg-${mtg.id}`,
        kind: "meeting",
        title: `Meeting (${mtg.status}): ${mtg.title}`,
        subtitle: `${mtg.clientName || mtg.clientEmail || "Client"} • ${mtg.preferredDate}`,
        date: mtg.updatedAt || mtg.createdAt,
        badge: mtg.status,
        targetSection: "Meeting Requests",
      });
    }

    for (const r of (data?.projectRequests || []).slice(0, 6)) {
      entries.push({
        id: `req-${r.id}`,
        kind: "request",
        title: `Project Request: ${r.serviceRequired || "Scope Inquiry"}`,
        subtitle: `${r.name} (${r.email})${r.businessName ? ` • ${r.businessName}` : ""}`,
        date: r.createdAt,
        badge: r.status || "Pending",
        targetSection: "Project Requests",
        raw: r,
      });
    }

    for (const e of (data?.contactEnquiries || []).slice(0, 5)) {
      entries.push({
        id: `enq-${e.id}`,
        kind: "enquiry",
        title: `Contact Enquiry: ${e.subject || "General"}`,
        subtitle: `${e.name} (${e.email})`,
        date: e.createdAt,
        badge: e.status || "New",
        targetSection: "Contact Enquiries",
        raw: e,
      });
    }

    entries.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
    });

    return entries.slice(0, 7);
  }, [studioUpdates, payments, meetings, data]);

  // --- Pre-auth Guard States wrapped cleanly in dark architectural frame ---
  if (authState === "loading") {
    return (
      <AdminPortalLayout
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onSignOut={handleAdminLogout}
        showStudioBackground={false}
      >
        <div className="rounded-2xl border border-white/10 bg-[#121216] p-12 text-center">
          <Loader2 className="size-8 animate-spin text-zinc-400 mx-auto" />
          <p className="mt-4 font-mono text-xs tracking-widest uppercase text-zinc-400">
            Verifying administrator authorization...
          </p>
        </div>
      </AdminPortalLayout>
    );
  }

  if (authState === "unauthenticated") {
    return (
      <AdminPortalLayout
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onSignOut={handleAdminLogout}
        showStudioBackground={false}
      >
        <div className="max-w-lg mx-auto rounded-2xl border border-white/10 bg-[#121216] p-8 sm:p-10 text-center">
          <ShieldAlert className="size-10 text-zinc-400 mx-auto" />
          <h1 className="mt-4 font-display text-xl font-semibold text-white tracking-tight">
            Admin Authentication Required
          </h1>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
            This portal is restricted to verified VINORA operations personnel. Redirecting to Admin
            Login...
          </p>
          <Button
            asChild
            className="mt-6 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 w-full sm:w-auto px-6"
          >
            <Link to="/login" search={{ role: "admin" }}>
              Go to Admin Login
            </Link>
          </Button>
        </div>
      </AdminPortalLayout>
    );
  }

  if (authState === "unauthorized") {
    return (
      <AdminPortalLayout
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onSignOut={handleAdminLogout}
        showStudioBackground={false}
      >
        <div className="max-w-lg mx-auto rounded-2xl border border-rose-500/30 bg-[#121216] p-8 sm:p-10 text-center">
          <AlertTriangle className="size-10 text-rose-400 mx-auto" />
          <h1 className="mt-4 font-display text-xl font-semibold text-white tracking-tight">
            Admin Access Required
          </h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            You are signed in as{" "}
            <span className="font-semibold text-white">{firebaseUser?.email}</span>. This account is
            authenticated, but is not authorized as a VINORA administrator. Redirecting to login...
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Button
              onClick={handleSignOutAndSwitchToAdmin}
              className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 w-full cursor-pointer"
            >
              Sign in with Administrator Account
            </Button>
            <Button
              asChild
              variant="outline"
              className="w-full rounded-xl border-white/15 bg-white/[0.04] hover:bg-white/[0.08]"
            >
              <Link to="/client">Return to Client Portal</Link>
            </Button>
          </div>
        </div>
      </AdminPortalLayout>
    );
  }

  const adminDisplayName = admin?.name || admin?.email?.split("@")[0] || "Administrator";

  const summaryCards = [
    {
      title: "Total Clients",
      value: isLoadingData ? "…" : adminMetrics.totalClientsCount,
      subtitle: `${adminMetrics.activeClientsCount} active portal accounts`,
      icon: Users,
      target: "Clients" as AdminSection,
    },
    {
      title: "Active Projects",
      value: isLoadingData ? "…" : adminMetrics.activeProjectsCount,
      subtitle: `${adminMetrics.totalProjectsCount} total studio engagements`,
      icon: FolderGit2,
      target: "Projects" as AdminSection,
    },
    {
      title: "Pending Proposals",
      value: isLoadingData ? "…" : adminMetrics.pendingProposalsCount,
      subtitle: `${adminMetrics.totalProposalsCount} total scopes issued`,
      icon: FileText,
      target: "Proposals" as AdminSection,
    },
    {
      title: "Pending Payments",
      value: isLoadingData ? "…" : adminMetrics.unpaidInvoicesCount,
      subtitle:
        adminMetrics.unpaidBalance > 0
          ? `${adminMetrics.currency} ${adminMetrics.unpaidBalance.toLocaleString()} balance due`
          : `${adminMetrics.currency} ${adminMetrics.totalRevenue.toLocaleString()} collected`,
      icon: CreditCard,
      target: "Payments" as AdminSection,
    },
    {
      title: "Upcoming Meetings",
      value: adminMetrics.upcomingMeetingsCount,
      subtitle:
        adminMetrics.pendingMeetingsCount > 0
          ? `${adminMetrics.pendingMeetingsCount} pending approval`
          : "All consultation requests up to date",
      icon: Calendar,
      target: "Meeting Requests" as AdminSection,
    },
    {
      title: "Pending Requests",
      value: isLoadingData ? "…" : adminMetrics.pendingLeadsCount,
      subtitle: `${adminMetrics.pendingProjectRequestsCount} project scopes • ${adminMetrics.pendingEnquiriesCount} enquiries`,
      icon: Inbox,
      target: "Project Requests" as AdminSection,
    },
  ];

  return (
    <AdminPortalLayout
      activeSection={activeSection}
      onSelectSection={handleSelectSection}
      onSignOut={handleAdminLogout}
      adminName={adminDisplayName}
      adminEmail={admin?.email}
      unreadMessagesCount={unreadMessagesCount}
      pendingProposalsCount={adminMetrics.pendingProposalsCount}
      pendingMeetingsCount={adminMetrics.pendingMeetingsCount}
      pendingRequestsCount={adminMetrics.pendingProjectRequestsCount}
      newEnquiriesCount={adminMetrics.pendingEnquiriesCount}
      notifications={adminNotifications}
      showStudioBackground={authState === "authorized" && Boolean(admin)}
      onMarkNotificationRead={(id) => {
        void markNotificationAsRead(id);
      }}
      onMarkAllNotificationsRead={() => {
        void markAllNotificationsAsRead(adminNotifications);
      }}
    >
      {/* Success Notification Banner */}
      {successBanner && (
        <div className="mb-6 rounded-xl border border-emerald-500/35 bg-emerald-950/65 backdrop-blur-md p-4 flex items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-emerald-400 shrink-0" />
            <p className="text-xs sm:text-sm text-emerald-200">{successBanner}</p>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-300 hover:text-white cursor-pointer p-1"
            aria-label="Dismiss notification"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Error state if data fetch failed */}
      {dataError && (
        <div className="mb-6 rounded-xl border border-rose-500/35 bg-rose-950/65 backdrop-blur-md p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="size-5 text-rose-300 shrink-0" />
            <p className="text-xs text-rose-200">{dataError}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            className="rounded-lg border-white/15 text-xs cursor-pointer"
          >
            Retry
          </Button>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 1: DASHBOARD OVERVIEW                             */}
      {/* ========================================================= */}
      {activeSection === "Dashboard" && (
        <div className="space-y-8">
          {/* Welcome Header (Matches Client Portal aesthetic) */}
          <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-white drop-shadow-xs">
                Welcome back, {adminDisplayName}
              </h1>
              <p className="mt-1.5 text-sm text-zinc-200/90">
                Manage studio operations, client projects, and deliverables.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => openCreateProjectModal()}
                className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer text-xs font-medium h-9 px-3.5"
              >
                <Plus className="mr-1.5 size-3.5" />
                New Project
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSelectSection("Updates")}
                className="rounded-xl border-white/15 bg-[#0c0c11]/70 backdrop-blur-md text-zinc-100 hover:bg-white/[0.1] cursor-pointer text-xs h-9 px-3.5"
              >
                <Megaphone className="mr-1.5 size-3.5" />
                Publish Update
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDashboardData}
                disabled={isLoadingData}
                className="rounded-xl border-white/15 bg-[#0c0c11]/70 backdrop-blur-md text-zinc-200 hover:bg-white/[0.1] cursor-pointer text-xs h-9 px-3"
                title={
                  lastRefreshedAt
                    ? `Last synced ${lastRefreshedAt.toLocaleTimeString()}`
                    : "Sync Firestore collections"
                }
              >
                <RefreshCw
                  className={`size-3.5 mr-1.5 ${isLoadingData ? "animate-spin text-white" : "text-zinc-400"}`}
                />
                {isLoadingData ? "Syncing..." : "Sync Data"}
              </Button>
            </div>
          </section>

          {/* Summary Metric Cards (6 real Firestore cards) */}
          <section aria-label="Studio summary metrics">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {summaryCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.title}
                    type="button"
                    onClick={() => handleSelectSection(card.target)}
                    className="group flex items-center justify-between gap-3 rounded-xl bg-[#0d0d12]/74 hover:bg-[#14141c]/84 backdrop-blur-md border border-white/[0.14] hover:border-white/25 p-4 sm:p-5 text-left transition-all duration-200 hover:-translate-y-0.5 shadow-lg cursor-pointer"
                  >
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 border border-white/15 text-white mt-0.5">
                        <Icon className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="text-xs font-semibold text-zinc-300 leading-tight">
                          {card.title}
                        </h2>
                        <p className="text-2xl font-semibold text-white tabular-nums leading-tight mt-1">
                          {card.value}
                        </p>
                        <p className="text-[11px] text-zinc-400 mt-1 leading-snug tabular-nums truncate">
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

          {/* Lower 2-Column Workspace: Recent Updates & Activity + Active Studio Projects */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* LEFT CARD: Recent Updates & Studio Activity */}
            <div className="lg:col-span-5 rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md shadow-xl p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                  <h2 className="font-display text-base sm:text-lg font-semibold text-white">
                    Recent Updates &amp; Activity
                  </h2>
                  <button
                    type="button"
                    onClick={() => handleSelectSection("Updates")}
                    className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    <span>Manage Updates</span>
                    <ArrowRight className="size-3.5" />
                  </button>
                </div>

                {isLoadingData && combinedStudioFeed.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
                    <Loader2 className="mx-auto size-6 animate-spin text-zinc-400" />
                    <p className="mt-3 text-xs text-zinc-400">Syncing live studio activity...</p>
                  </div>
                ) : combinedStudioFeed.length > 0 ? (
                  <div className="mt-4 space-y-2.5">
                    {combinedStudioFeed.map((item) => {
                      const Icon =
                        item.kind === "update"
                          ? Megaphone
                          : item.kind === "payment"
                            ? CreditCard
                            : item.kind === "meeting"
                              ? Calendar
                              : item.kind === "request"
                                ? Inbox
                                : item.kind === "enquiry"
                                  ? Mail
                                  : Bell;

                      const iconTint =
                        item.kind === "payment"
                          ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
                          : item.kind === "meeting"
                            ? "bg-violet-500/15 text-violet-300 border-violet-500/20"
                            : item.kind === "request"
                              ? "bg-blue-500/15 text-blue-300 border-blue-500/20"
                              : item.kind === "update"
                                ? "bg-white/10 text-white border-white/15"
                                : "bg-amber-500/15 text-amber-300 border-amber-500/20";

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.kind === "request" && item.raw) {
                              setSelectedRequest(item.raw as ProjectRequest);
                            } else if (item.kind === "enquiry" && item.raw) {
                              setSelectedEnquiry(item.raw as ContactSubmission);
                            } else {
                              handleSelectSection(item.targetSection);
                            }
                          }}
                          className="w-full flex items-start gap-3.5 rounded-xl border border-white/[0.06] bg-white/[0.025] hover:bg-white/[0.06] p-3.5 text-left transition-colors cursor-pointer"
                        >
                          <span
                            className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${iconTint}`}
                          >
                            <Icon className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-zinc-100 truncate">
                                {item.title}
                              </p>
                              <span className="text-[11px] text-zinc-500 shrink-0 tabular-nums">
                                {formatDateShort(item.date)}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs text-zinc-400 line-clamp-1">
                              {item.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-8 text-center">
                    <Bell className="mx-auto size-8 text-zinc-500" />
                    <p className="mt-3 text-sm font-medium text-zinc-200">No recent activity yet</p>
                    <p className="mt-1 text-xs text-zinc-500 max-w-xs mx-auto">
                      Studio announcements, Razorpay payments, meetings, and client requests appear
                      here in real time.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT CARD: Active Studio Projects (16:9 thumbnail cards) */}
            <div className="lg:col-span-7 rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md shadow-xl p-5 sm:p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                  <h2 className="font-display text-base sm:text-lg font-semibold text-white">
                    Studio Projects
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openCreateProjectModal()}
                      className="inline-flex items-center gap-1 text-xs font-medium text-white hover:text-zinc-300 transition-colors cursor-pointer"
                    >
                      <Plus className="size-3.5" />
                      <span>Create</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setProjectSubTab("studio");
                        handleSelectSection("Projects");
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <span>View All</span>
                      <ArrowRight className="size-3.5" />
                    </button>
                  </div>
                </div>

                {data?.projects && data.projects.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.projects.slice(0, 4).map((proj) => {
                      const pct = Math.min(100, Math.max(0, Math.round(proj.progress ?? 0)));
                      const clientRec = clientByUidMap.get(proj.clientId);
                      const clientLabel = proj.clientName || clientRec?.name || "Client Account";
                      const categoryLabel =
                        proj.category || proj.serviceRequired || "Digital Engineering";

                      return (
                        <div
                          key={proj.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => openEditProjectModal(proj)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openEditProjectModal(proj);
                            }
                          }}
                          className="group flex flex-col rounded-xl border border-white/[0.10] bg-black/45 hover:bg-black/60 overflow-hidden transition-colors cursor-pointer"
                        >
                          <div className="p-2.5 pb-0">
                            <ProjectThumbnailBox
                              item={proj}
                              className="w-full aspect-video rounded-lg border border-white/10 bg-zinc-900"
                            />
                          </div>

                          <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-1">
                                <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 truncate">
                                  {categoryLabel}
                                </span>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0 ${getProjectStatusBadgeClass(
                                    proj.status,
                                  )}`}
                                >
                                  {proj.status}
                                </span>
                              </div>
                              <h3 className="text-sm font-semibold text-white truncate">
                                {proj.title}
                              </h3>
                              <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                                {clientLabel}
                              </p>
                            </div>

                            <div className="space-y-2">
                              <div>
                                <div className="flex items-center justify-between text-[11px] mb-1">
                                  <span className="text-zinc-400">Progress</span>
                                  <span className="font-medium text-zinc-200 tabular-nums">
                                    {pct}%
                                  </span>
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
                                  {formatDateShort(proj.updatedAt || proj.createdAt)}
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
                    <FolderGit2 className="mx-auto size-8 text-zinc-500" />
                    <p className="mt-3 text-sm font-medium text-zinc-200">No studio projects yet</p>
                    <p className="mt-1 text-xs text-zinc-500 max-w-xs mx-auto">
                      Create an active project to start tracking deliverables, progress, and client
                      portal milestones.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => openCreateProjectModal()}
                      className="mt-4 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs cursor-pointer"
                    >
                      <Plus className="size-3.5 mr-1.5" />
                      Create First Project
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Studio Operations Workspaces Grid */}
          <section className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Operations Workspaces
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {(
                [
                  {
                    label: "Proposals & Budgets",
                    desc: "Issue technical scopes, line-item quotes, and approvals.",
                    icon: ScrollText,
                    target: "Proposals",
                  },
                  {
                    label: "Invoices & Billing",
                    desc: "Create itemized invoices and audit milestone settlements.",
                    icon: Receipt,
                    target: "Invoices",
                  },
                  {
                    label: "Razorpay Ledger",
                    desc: "Inspect live verified transactions and official receipts.",
                    icon: CreditCard,
                    target: "Payments",
                  },
                  {
                    label: "Meetings & Links",
                    desc: "Approve consultations and assign Google Meet or Teams rooms.",
                    icon: Calendar,
                    target: "Meeting Requests",
                  },
                  {
                    label: "Documents Library",
                    desc: "Upload and organize deliverables in Firebase Storage.",
                    icon: Folder,
                    target: "Documents",
                  },
                  {
                    label: "Direct Messages",
                    desc: "Real-time studio chat with registered clients.",
                    icon: MessageSquare,
                    target: "Messages",
                  },
                  {
                    label: "Referral Program",
                    desc: "Track client referrals and studio reward credits.",
                    icon: Gift,
                    target: "Referrals",
                  },
                  {
                    label: "Contact Enquiries",
                    desc: "Follow up on public website inquiries and messages.",
                    icon: Mail,
                    target: "Contact Enquiries",
                  },
                ] as const
              ).map((mod) => {
                const Icon = mod.icon;
                return (
                  <button
                    key={mod.target}
                    type="button"
                    onClick={() => handleSelectSection(mod.target)}
                    className="rounded-xl border border-white/[0.1] bg-[#0c0c11]/70 hover:bg-[#14141c]/85 hover:border-white/25 backdrop-blur-md p-4 text-left transition-all cursor-pointer group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white group-hover:text-white">
                        {mod.label}
                      </span>
                      <Icon className="size-4 text-zinc-400 group-hover:text-white transition-colors" />
                    </div>
                    <p className="mt-1.5 text-xs text-zinc-400 leading-relaxed">{mod.desc}</p>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: CLIENTS DIRECTORY                              */}
      {/* ========================================================= */}
      {activeSection === "Clients" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.1] pb-5">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Client Directory
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-zinc-400">
                Registered client accounts with linked studio projects, invoice balances, and quick
                dossier inspection.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-xl border border-white/15 bg-[#0c0c11]/75 backdrop-blur-md px-3.5 py-1.5 text-xs text-zinc-300 tabular-nums">
                Total: <strong className="text-white">{data?.clients.length || 0}</strong>
              </span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by client name, email, company, or UID..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full rounded-xl border border-white/[0.12] bg-[#0c0c11]/75 backdrop-blur-md pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40"
            />
          </div>

          {isLoadingData ? (
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
              <Loader2 className="size-6 animate-spin mx-auto text-zinc-400" />
              <p className="mt-3 text-xs text-zinc-400 uppercase tracking-widest">
                Loading client records from Firestore...
              </p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
              <Users className="size-8 mx-auto text-zinc-500" />
              <h3 className="mt-3 font-display text-base text-white">No client accounts found</h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
                {clientSearch
                  ? "No client matches your search filter."
                  : "When clients register through the VINORA portal, their profiles will appear here."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-white/[0.03] uppercase tracking-wider text-[10px] text-zinc-400">
                  <tr>
                    <th className="p-3.5 sm:px-4">Client Name</th>
                    <th className="p-3.5 sm:px-4">Email</th>
                    <th className="p-3.5 sm:px-4">Company</th>
                    <th className="p-3.5 sm:px-4">Projects</th>
                    <th className="p-3.5 sm:px-4">Payment Status</th>
                    <th className="p-3.5 sm:px-4">Account</th>
                    <th className="p-3.5 sm:px-4">Joined</th>
                    <th className="p-3.5 sm:px-4 text-right">Dossier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredClients.map((client) => {
                    const isActive = client.accountStatus.toLowerCase() === "active";
                    const projCount = (data?.projects || []).filter(
                      (p) => p.clientId === client.uid,
                    ).length;
                    const clientInvoices = (data?.invoices || []).filter(
                      (inv) =>
                        (inv.clientId === client.uid || inv.clientUid === client.uid) &&
                        inv.status !== "Cancelled",
                    );
                    const unpaidTotal = clientInvoices.reduce(
                      (sum, inv) => sum + Math.max(0, Number(inv.balanceDue) || 0),
                      0,
                    );
                    const hasOverdue = clientInvoices.some(
                      (inv) => (inv.status || "").toLowerCase() === "overdue",
                    );

                    const paymentLabel =
                      clientInvoices.length === 0
                        ? "No Invoices"
                        : unpaidTotal === 0
                          ? "Settled"
                          : hasOverdue
                            ? "Overdue"
                            : "Balance Due";

                    return (
                      <tr key={client.uid} className="hover:bg-white/[0.03] transition-colors">
                        <td className="p-3.5 sm:px-4 font-medium text-white">{client.name}</td>
                        <td className="p-3.5 sm:px-4 text-zinc-300 font-mono text-[11px]">
                          {client.email}
                        </td>
                        <td className="p-3.5 sm:px-4 text-zinc-400">{client.companyName || "—"}</td>
                        <td className="p-3.5 sm:px-4 text-zinc-200 tabular-nums">{projCount}</td>
                        <td className="p-3.5 sm:px-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-medium border ${
                              paymentLabel === "Settled"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : paymentLabel === "Overdue"
                                  ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                                  : paymentLabel === "Balance Due"
                                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                    : "border-white/10 bg-white/[0.04] text-zinc-400"
                            }`}
                          >
                            {paymentLabel}
                          </span>
                        </td>
                        <td className="p-3.5 sm:px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] border ${
                              isActive
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-amber-400"}`}
                            />
                            {client.accountStatus}
                          </span>
                        </td>
                        <td className="p-3.5 sm:px-4 text-zinc-400 tabular-nums">
                          {formatDateShort(client.createdAt)}
                        </td>
                        <td className="p-3.5 sm:px-4 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedClient(client)}
                            className="rounded-lg border-white/15 bg-white/[0.03] hover:bg-white hover:text-zinc-950 text-[11px] cursor-pointer h-7 px-2.5"
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 3: STUDIO PROJECTS & SHOWCASE CURATION            */}
      {/* ========================================================= */}
      {activeSection === "Projects" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.1] pb-5">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Projects &amp; Public Showcase
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-zinc-400">
                Create and manage client deliverables with 16:9 visual cards or curate approved
                projects for the public homepage showcase.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl border border-white/15 bg-[#0c0c11]/75 px-3 py-1.5 text-xs text-zinc-300 tabular-nums">
                Studio Projects:{" "}
                <strong className="text-white">{data?.projects.length || 0}</strong>
              </span>
              <span className="rounded-xl border border-white/15 bg-[#0c0c11]/75 px-3 py-1.5 text-xs text-zinc-300 tabular-nums">
                Showcase Live:{" "}
                <strong className="text-emerald-300">
                  {data?.stats.showcaseApprovedCount || 0}
                </strong>
              </span>
              <Button
                onClick={() => openCreateProjectModal()}
                className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium h-9 px-4 cursor-pointer"
              >
                <Plus className="size-4 mr-1.5" />
                New Project
              </Button>
            </div>
          </div>

          {/* Sub Navigation Tabs */}
          <div className="flex border-b border-white/[0.1] text-xs overflow-x-auto gap-1">
            <button
              type="button"
              onClick={() => setProjectSubTab("studio")}
              className={`px-4 py-2.5 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                projectSubTab === "studio"
                  ? "border-white text-white"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <FolderGit2 className="size-4" />
              Studio Projects ({data?.projects.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setProjectSubTab("showcase")}
              className={`px-4 py-2.5 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                projectSubTab === "showcase"
                  ? "border-white text-white"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <Sparkles className="size-4 text-emerald-400" />
              Showcase Approvals ({data?.projectRequests.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setProjectSubTab("preview")}
              className={`px-4 py-2.5 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                projectSubTab === "preview"
                  ? "border-white text-white"
                  : "border-transparent text-zinc-400 hover:text-white"
              }`}
            >
              <Eye className="size-4" />
              Live Homepage Preview
            </button>
          </div>

          {/* SUBTAB 1: STUDIO PROJECTS (16:9 Visual Cards + Full CRUD) */}
          {projectSubTab === "studio" && (
            <div className="space-y-5">
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search studio projects by name, client, or category..."
                    value={studioProjectSearch}
                    onChange={(e) => setStudioProjectSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.12] bg-[#0c0c11]/75 backdrop-blur-md pl-10 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40"
                  />
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {(
                    [
                      { key: "all", label: "All" },
                      { key: "active", label: "Active" },
                      { key: "progress", label: "In Progress" },
                      { key: "hold", label: "On Hold" },
                      { key: "complete", label: "Completed" },
                    ] as const
                  ).map((st) => (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => setStudioProjectStatusFilter(st.key)}
                      className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                        studioProjectStatusFilter === st.key
                          ? "bg-white text-zinc-950"
                          : "border border-white/[0.1] bg-[#0c0c11]/70 text-zinc-300 hover:text-white"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {isLoadingData ? (
                <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
                  <Loader2 className="size-6 animate-spin mx-auto text-zinc-400" />
                  <p className="mt-3 text-xs text-zinc-400 uppercase tracking-widest">
                    Loading studio projects from Firestore...
                  </p>
                </div>
              ) : filteredStudioProjects.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
                  <FolderGit2 className="size-9 mx-auto text-zinc-500" />
                  <h3 className="mt-3 font-display text-base text-white">
                    No matching studio projects
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
                    {studioProjectSearch || studioProjectStatusFilter !== "all"
                      ? "Try resetting your search filter."
                      : "Create your first client project to track status, progress percentage, and deliverables."}
                  </p>
                  <Button
                    onClick={() => openCreateProjectModal()}
                    className="mt-5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs cursor-pointer"
                  >
                    <Plus className="size-3.5 mr-1.5" />
                    Create Studio Project
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredStudioProjects.map((proj) => {
                    const pct = Math.min(100, Math.max(0, Math.round(proj.progress ?? 0)));
                    const clientRec = clientByUidMap.get(proj.clientId);
                    const clientLabel = proj.clientName || clientRec?.name || "Unassigned Client";
                    const categoryLabel =
                      proj.category || proj.serviceRequired || "Digital Engineering";

                    return (
                      <article
                        key={proj.id}
                        className="group rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 hover:bg-[#111118]/85 hover:border-white/25 backdrop-blur-md overflow-hidden transition-all flex flex-col justify-between shadow-lg"
                      >
                        <div className="p-3 pb-0">
                          <ProjectThumbnailBox
                            item={proj}
                            className="w-full aspect-video rounded-xl border border-white/10 bg-zinc-900"
                          />
                        </div>

                        <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                          <div>
                            <div className="flex items-start justify-between gap-2.5 mb-1.5">
                              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                                {categoryLabel}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium shrink-0 ${getProjectStatusBadgeClass(
                                  proj.status,
                                )}`}
                              >
                                {proj.status}
                              </span>
                            </div>

                            <h3 className="font-display text-base sm:text-lg font-medium text-white leading-snug">
                              {proj.title}
                            </h3>
                            <p className="mt-1 text-xs text-zinc-400">
                              Client: <span className="text-zinc-200">{clientLabel}</span>
                            </p>

                            {proj.description && (
                              <p className="mt-2.5 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                {proj.description}
                              </p>
                            )}
                          </div>

                          <div className="space-y-3 border-t border-white/[0.08] pt-3">
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="text-zinc-400">Progress</span>
                                <span className="font-mono font-semibold text-white tabular-nums">
                                  {pct}%
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-white transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 tabular-nums">
                              <span>
                                Updated:{" "}
                                <strong className="font-normal text-zinc-200">
                                  {formatDateShort(proj.updatedAt || proj.createdAt)}
                                </strong>
                              </span>
                              {proj.dueAt && (
                                <span>
                                  Due:{" "}
                                  <strong className="font-normal text-zinc-200">
                                    {formatDateShort(proj.dueAt)}
                                  </strong>
                                </span>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEditProjectModal(proj)}
                                className="flex-1 rounded-xl border-white/15 bg-white/[0.04] hover:bg-white hover:text-zinc-950 text-xs h-8 cursor-pointer"
                              >
                                <Edit3 className="size-3.5 mr-1.5" />
                                Edit &amp; Progress
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setProjectToDelete(proj)}
                                title="Delete project"
                                className="rounded-xl text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 h-8 px-2.5 cursor-pointer"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 2: CLIENT SUBMISSIONS & SHOWCASE APPROVALS */}
          {projectSubTab === "showcase" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search by client, business name, service, description or ID..."
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.12] bg-[#0c0c11]/75 backdrop-blur-md pl-10 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0 text-xs">
                  {(["all", "approved", "pending", "rejected"] as const).map((filterVal) => {
                    const label =
                      filterVal === "all"
                        ? `All (${data?.projectRequests.length || 0})`
                        : filterVal === "approved"
                          ? `Live (${data?.projectRequests.filter((r) => r.showcaseApproved).length || 0})`
                          : filterVal === "pending"
                            ? `Pending (${data?.projectRequests.filter((r) => !r.showcaseApproved && !r.status?.toLowerCase().includes("reject")).length || 0})`
                            : `Rejected (${data?.projectRequests.filter((r) => r.status?.toLowerCase().includes("reject")).length || 0})`;

                    return (
                      <button
                        key={filterVal}
                        type="button"
                        onClick={() => setProjectShowcaseFilter(filterVal)}
                        className={`px-3 py-2 rounded-lg font-medium cursor-pointer transition-colors ${
                          projectShowcaseFilter === filterVal
                            ? "bg-white text-zinc-950"
                            : "border border-white/[0.1] bg-[#0c0c11]/70 text-zinc-300 hover:text-white"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {isLoadingData ? (
                <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
                  <Loader2 className="size-6 animate-spin mx-auto text-zinc-400" />
                  <p className="mt-3 text-xs text-zinc-400 uppercase tracking-widest">
                    Loading showcase candidates...
                  </p>
                </div>
              ) : filteredShowcaseRequests.length === 0 ? (
                <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
                  <Sparkles className="size-8 mx-auto text-zinc-500" />
                  <h3 className="mt-3 font-display text-base text-white">
                    No project requests match filter
                  </h3>
                  <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
                    {projectSearch || projectShowcaseFilter !== "all"
                      ? "Try resetting your search query or status filter."
                      : "Client project requests submitted via /start-project will appear here for showcase curation."}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-white/[0.08] bg-white/[0.03] uppercase tracking-wider text-[10px] text-zinc-400">
                      <tr>
                        <th className="p-3.5 sm:px-4">Project / Initiative</th>
                        <th className="p-3.5 sm:px-4">Client</th>
                        <th className="p-3.5 sm:px-4">Description</th>
                        <th className="p-3.5 sm:px-4">Submitted</th>
                        <th className="p-3.5 sm:px-4">Showcase Status</th>
                        <th className="p-3.5 sm:px-4 text-right">Approval Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.06]">
                      {filteredShowcaseRequests.map((req) => {
                        const isLive = req.showcaseApproved === true;
                        const isRejected =
                          req.status?.toLowerCase().includes("reject") ||
                          Boolean(req.rejectionReason);

                        return (
                          <tr key={req.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="p-3.5 sm:px-4">
                              <div className="font-medium text-white">
                                {req.showcaseTitle ||
                                  (req.businessName
                                    ? `${req.businessName} — ${req.serviceRequired}`
                                    : req.serviceRequired)}
                              </div>
                              <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2 mt-0.5">
                                <span>#{req.id.slice(0, 8)}</span>
                                {req.budget && <span>• {req.budget}</span>}
                              </div>
                            </td>

                            <td className="p-3.5 sm:px-4">
                              <div className="text-zinc-100">{req.name}</div>
                              <div className="text-[11px] text-zinc-400">
                                {req.email}
                                {req.businessName ? ` • ${req.businessName}` : ""}
                              </div>
                            </td>

                            <td className="p-3.5 sm:px-4 max-w-xs">
                              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                                {req.showcaseDescription || req.projectDescription}
                              </p>
                            </td>

                            <td className="p-3.5 sm:px-4 text-zinc-400 whitespace-nowrap tabular-nums">
                              {formatDateShort(req.createdAt)}
                            </td>

                            <td className="p-3.5 sm:px-4 whitespace-nowrap">
                              {isLive ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 font-medium">
                                  <span className="size-1.5 rounded-full bg-emerald-400" />
                                  Live on Showcase
                                </span>
                              ) : isRejected ? (
                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] border border-rose-500/35 bg-rose-500/15 text-rose-300">
                                  Rejected
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] border border-amber-500/35 bg-amber-500/15 text-amber-300">
                                  Pending Review
                                </span>
                              )}
                            </td>

                            <td className="p-3.5 sm:px-4 text-right space-x-1.5 whitespace-nowrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedRequest(req)}
                                className="rounded-lg text-[11px] cursor-pointer h-7 px-2"
                              >
                                Scope
                              </Button>

                              {isLive ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={isUpdating === req.id}
                                  onClick={() => handleRejectShowcase(req.id, "Revoked by admin")}
                                  className="rounded-lg text-[11px] border-rose-500/35 text-rose-300 hover:bg-rose-500/15 h-7 px-2.5 cursor-pointer"
                                >
                                  {isUpdating === req.id ? (
                                    <Loader2 className="size-3 animate-spin mr-1" />
                                  ) : (
                                    <ThumbsDown className="size-3 mr-1" />
                                  )}
                                  Revoke
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isUpdating === req.id}
                                    onClick={() => openApprovalModal(req)}
                                    className="rounded-lg text-[11px] border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/15 h-7 px-2.5 cursor-pointer"
                                  >
                                    <Sparkles className="size-3 mr-1" />
                                    Approve...
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={isUpdating === req.id}
                                    onClick={() => handleApproveShowcase(req.id)}
                                    className="rounded-lg text-[11px] bg-white text-zinc-950 hover:bg-zinc-200 h-7 px-2 cursor-pointer"
                                    title="1-Click Approve"
                                  >
                                    {isUpdating === req.id ? (
                                      <Loader2 className="size-3 animate-spin" />
                                    ) : (
                                      <Check className="size-3" />
                                    )}
                                  </Button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* SUBTAB 3: LIVE PUBLIC SHOWCASE PREVIEW */}
          {projectSubTab === "preview" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <Eye className="size-4 text-emerald-400" />
                  <p className="text-xs text-zinc-200">
                    Live Public Preview: What visitors see on{" "}
                    <strong className="text-white">/</strong> and{" "}
                    <strong className="text-white">/projects</strong>.
                  </p>
                </div>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-white/15 bg-white/[0.04] text-xs"
                >
                  <Link to="/">
                    Open Homepage <ArrowUpRight className="size-3.5 ml-1" />
                  </Link>
                </Button>
              </div>

              <div className="rounded-2xl border border-white/[0.12] bg-background overflow-hidden">
                <PublicProjectShowcase headingTone="standalone" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 4: PROJECT REQUESTS                               */}
      {/* ========================================================= */}
      {activeSection === "Project Requests" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.1] pb-5">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Project Requests
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-zinc-400">
                Inbound project scopes submitted via Start Your Project or the Client Portal.
              </p>
            </div>
            <span className="rounded-xl border border-white/15 bg-[#0c0c11]/75 px-3.5 py-1.5 text-xs text-zinc-300 tabular-nums">
              Total: <strong className="text-white">{data?.projectRequests.length || 0}</strong>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by client name, email, service, or Request ID..."
                value={requestSearch}
                onChange={(e) => setRequestSearch(e.target.value)}
                className="w-full rounded-xl border border-white/[0.12] bg-[#0c0c11]/75 backdrop-blur-md pl-10 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0 text-xs">
              {(["all", "pending", "reviewing", "approved", "rejected"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setRequestStatusFilter(st)}
                  className={`px-3 py-2 rounded-lg capitalize font-medium cursor-pointer transition-colors ${
                    requestStatusFilter === st
                      ? "bg-white text-zinc-950"
                      : "border border-white/[0.1] bg-[#0c0c11]/70 text-zinc-300 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {isLoadingData ? (
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
              <Loader2 className="size-6 animate-spin mx-auto text-zinc-400" />
              <p className="mt-3 text-xs text-zinc-400 uppercase tracking-widest">
                Loading project requests from Firestore...
              </p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
              <Inbox className="size-8 mx-auto text-zinc-500" />
              <h3 className="mt-3 font-display text-base text-white">No project requests found</h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
                {requestSearch || requestStatusFilter !== "all"
                  ? "No project request matches your current filter."
                  : "New project proposals submitted by clients will appear here for review."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-white/[0.03] uppercase tracking-wider text-[10px] text-zinc-400">
                  <tr>
                    <th className="p-3.5 sm:px-4">Request ID</th>
                    <th className="p-3.5 sm:px-4">Client</th>
                    <th className="p-3.5 sm:px-4">Project / Service</th>
                    <th className="p-3.5 sm:px-4">Submitted</th>
                    <th className="p-3.5 sm:px-4">Status</th>
                    <th className="p-3.5 sm:px-4">Showcase</th>
                    <th className="p-3.5 sm:px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredRequests.map((req) => {
                    const statusStr = (req.status || "Pending Review").toLowerCase();
                    const isApproved = statusStr.includes("approv");
                    const isReviewing = statusStr.includes("review");
                    const isRejected = statusStr.includes("reject");
                    const isShowcaseLive = req.showcaseApproved === true;

                    return (
                      <tr key={req.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="p-3.5 sm:px-4 font-mono">
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(req)}
                            className="hover:underline text-white cursor-pointer font-semibold"
                          >
                            #{req.id.slice(0, 8)}
                          </button>
                        </td>
                        <td className="p-3.5 sm:px-4">
                          <div className="font-medium text-white">{req.name}</div>
                          <div className="text-[11px] text-zinc-400">{req.email}</div>
                        </td>
                        <td className="p-3.5 sm:px-4">
                          <div className="text-zinc-100">
                            {req.businessName || req.serviceRequired || "Project Scope"}
                          </div>
                          <div className="text-[11px] text-zinc-400">
                            {req.serviceRequired}
                            {req.budget ? ` • Budget: ${req.budget}` : ""}
                          </div>
                        </td>
                        <td className="p-3.5 sm:px-4 text-zinc-400 tabular-nums">
                          {formatDateShort(req.createdAt)}
                        </td>
                        <td className="p-3.5 sm:px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] border ${
                              isApproved
                                ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                                : isReviewing
                                  ? "border-blue-500/35 bg-blue-500/15 text-blue-300"
                                  : isRejected
                                    ? "border-rose-500/35 bg-rose-500/15 text-rose-300"
                                    : "border-amber-500/35 bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {req.status || "Pending"}
                          </span>
                        </td>
                        <td className="p-3.5 sm:px-4">
                          {isShowcaseLive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 font-medium">
                              Live Showcase
                            </span>
                          ) : isRejected ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] border border-rose-500/30 bg-rose-500/10 text-rose-300">
                              Rejected
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] border border-white/10 text-zinc-400">
                              Private
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 sm:px-4 text-right space-x-1.5 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedRequest(req)}
                            className="rounded-lg text-[11px] cursor-pointer h-7 px-2"
                          >
                            Details
                          </Button>
                          {isShowcaseLive ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUpdating === req.id}
                              onClick={() => handleRejectShowcase(req.id, "Revoked from showcase")}
                              className="rounded-lg text-[11px] border-rose-500/35 text-rose-300 hover:bg-rose-500/15 h-7 px-2 cursor-pointer"
                            >
                              Revoke
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUpdating === req.id}
                              onClick={() => openApprovalModal(req)}
                              className="rounded-lg text-[11px] border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/15 h-7 px-2 cursor-pointer"
                            >
                              <Sparkles className="size-3 mr-1" />
                              Showcase
                            </Button>
                          )}
                          <select
                            value={req.status || "Pending Review"}
                            disabled={isUpdating === req.id}
                            onChange={(e) =>
                              handleUpdateRequestStatus(
                                req.id,
                                e.target.value as
                                  "Pending Review" | "Reviewing" | "Approved" | "Rejected",
                              )
                            }
                            className="rounded-lg border border-white/15 bg-zinc-900/90 px-2 py-1 text-[11px] text-white focus:outline-none cursor-pointer"
                          >
                            <option value="Pending Review">Pending</option>
                            <option value="Reviewing">Reviewing</option>
                            <option value="Approved">Approved</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION 5: CONTACT ENQUIRIES                              */}
      {/* ========================================================= */}
      {activeSection === "Contact Enquiries" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.1] pb-5">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Contact Enquiries
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-zinc-400">
                Inquiries and direct messages received through the VINORA contact page.
              </p>
            </div>
            <span className="rounded-xl border border-white/15 bg-[#0c0c11]/75 px-3.5 py-1.5 text-xs text-zinc-300 tabular-nums">
              Total: <strong className="text-white">{data?.contactEnquiries.length || 0}</strong>
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search by sender name, email, subject, or message content..."
                value={enquirySearch}
                onChange={(e) => setEnquirySearch(e.target.value)}
                className="w-full rounded-xl border border-white/[0.12] bg-[#0c0c11]/75 backdrop-blur-md pl-10 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-1 sm:pb-0 text-xs">
              {(["all", "new", "contacted", "resolved"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setEnquiryStatusFilter(st)}
                  className={`px-3 py-2 rounded-lg capitalize font-medium cursor-pointer transition-colors ${
                    enquiryStatusFilter === st
                      ? "bg-white text-zinc-950"
                      : "border border-white/[0.1] bg-[#0c0c11]/70 text-zinc-300 hover:text-white"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {isLoadingData ? (
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
              <Loader2 className="size-6 animate-spin mx-auto text-zinc-400" />
              <p className="mt-3 text-xs text-zinc-400 uppercase tracking-widest">
                Loading contact submissions from Firestore...
              </p>
            </div>
          ) : filteredEnquiries.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
              <Mail className="size-8 mx-auto text-zinc-500" />
              <h3 className="mt-3 font-display text-base text-white">No contact enquiries found</h3>
              <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
                {enquirySearch || enquiryStatusFilter !== "all"
                  ? "No enquiries match your search query."
                  : "Incoming contact messages from the public website will appear here in real time."}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/[0.08] bg-white/[0.03] uppercase tracking-wider text-[10px] text-zinc-400">
                  <tr>
                    <th className="p-3.5 sm:px-4">Sender</th>
                    <th className="p-3.5 sm:px-4">Email</th>
                    <th className="p-3.5 sm:px-4">Subject &amp; Message</th>
                    <th className="p-3.5 sm:px-4">Date</th>
                    <th className="p-3.5 sm:px-4">Status</th>
                    <th className="p-3.5 sm:px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.06]">
                  {filteredEnquiries.map((enq) => {
                    const statusStr = (enq.status || "New").toLowerCase();
                    const isResolved = statusStr.includes("resolv");
                    const isContacted = statusStr.includes("contact");

                    return (
                      <tr key={enq.id} className="hover:bg-white/[0.03] transition-colors">
                        <td className="p-3.5 sm:px-4 font-medium text-white">{enq.name}</td>
                        <td className="p-3.5 sm:px-4 text-zinc-300 font-mono text-[11px]">
                          {enq.email}
                        </td>
                        <td className="p-3.5 sm:px-4 max-w-xs">
                          <div className="font-medium text-white truncate">
                            {enq.subject || "General Inquiry"}
                          </div>
                          <div className="text-[11px] text-zinc-400 line-clamp-1">
                            {enq.message}
                          </div>
                        </td>
                        <td className="p-3.5 sm:px-4 text-zinc-400 tabular-nums">
                          {formatDateShort(enq.createdAt)}
                        </td>
                        <td className="p-3.5 sm:px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] border ${
                              isResolved
                                ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                                : isContacted
                                  ? "border-blue-500/35 bg-blue-500/15 text-blue-300"
                                  : "border-amber-500/35 bg-amber-500/15 text-amber-300"
                            }`}
                          >
                            {enq.status || "New"}
                          </span>
                        </td>
                        <td className="p-3.5 sm:px-4 text-right space-x-1.5 whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedEnquiry(enq)}
                            className="rounded-lg text-[11px] cursor-pointer h-7 px-2"
                          >
                            View
                          </Button>
                          <select
                            value={enq.status || "New"}
                            disabled={isUpdating === enq.id}
                            onChange={(e) =>
                              handleUpdateContactStatus(
                                enq.id,
                                e.target.value as "New" | "Contacted" | "Resolved" | "Archived",
                              )
                            }
                            className="rounded-lg border border-white/15 bg-zinc-900/90 px-2 py-1 text-[11px] text-white focus:outline-none cursor-pointer"
                          >
                            <option value="New">New</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Archived">Archived</option>
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* PRESERVED INTEGRATED ADMIN SECTIONS                       */}
      {/* ========================================================= */}
      {activeSection === "Meeting Requests" && admin && <AdminMeetingsSection admin={admin} />}
      {activeSection === "Documents" && admin && <AdminDocumentsSection admin={admin} />}
      {activeSection === "Proposals" && admin && <AdminProposalsSection admin={admin} />}
      {activeSection === "Invoices" && admin && <AdminInvoicesSection admin={admin} />}
      {activeSection === "Payments" && admin && <AdminPaymentsSection admin={admin} />}
      {activeSection === "Referrals" && admin && <AdminReferralsSection admin={admin} />}

      {/* ========================================================= */}
      {/* NEW: UPDATES, NOTIFICATIONS & ADMIN PROFILE               */}
      {/* ========================================================= */}
      {activeSection === "Updates" && admin && (
        <AdminUpdatesSection
          admin={admin}
          projects={data?.projects || []}
          clients={data?.clients || []}
        />
      )}

      {activeSection === "Notifications" && (
        <AdminNotificationsSection
          notifications={adminNotifications}
          onMarkRead={(id) => {
            void markNotificationAsRead(id);
          }}
          onMarkAllRead={() => {
            void markAllNotificationsAsRead(adminNotifications);
          }}
          onNavigateSection={(sec) => handleSelectSection(sec)}
        />
      )}

      {activeSection === "Admin Profile" && admin && (
        <AdminProfileSection
          admin={admin}
          onAdminUpdated={(updated) => setAdmin(updated)}
          onNavigateSettings={() => handleSelectSection("Settings")}
        />
      )}

      {/* ========================================================= */}
      {/* SECTION: MESSAGES                                         */}
      {/* ========================================================= */}
      {activeSection === "Messages" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.1] pb-5">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
                Studio Messages
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-zinc-400">
                Real-time two-way communications with registered VINORA clients.
              </p>
            </div>
            {admin && (
              <span className="rounded-xl border border-white/15 bg-[#0c0c11]/75 px-3.5 py-1.5 text-xs text-zinc-300">
                Active Operator: <strong className="text-white">{admin.name}</strong>
              </span>
            )}
          </div>

          {admin ? (
            <WhatsAppAdminChat admin={admin} />
          ) : (
            <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
              <Loader2 className="size-6 animate-spin mx-auto text-zinc-400" />
              <p className="mt-3 text-xs text-zinc-400 uppercase tracking-widest">
                Verifying administrator authorization...
              </p>
            </div>
          )}

          {data?.messages && data.messages.length > 0 && (
            <details className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-4">
              <summary className="text-xs font-medium cursor-pointer text-zinc-300 hover:text-white">
                Legacy Workspace Messages Archive ({data.messages.length})
              </summary>
              <div className="divide-y divide-white/[0.06] mt-3 pt-3 border-t border-white/[0.08]">
                {data.messages.map((msg) => (
                  <div key={msg.id} className="p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between text-zinc-400 font-mono text-[10px]">
                      <span>Sender: {msg.senderId}</span>
                      <span>{formatDate(msg.createdAt)}</span>
                    </div>
                    <p className="text-zinc-200">{msg.body}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SECTION: SETTINGS & SECURITY                              */}
      {/* ========================================================= */}
      {activeSection === "Settings" && (
        <div className="space-y-6">
          <div className="border-b border-white/[0.1] pb-5">
            <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
              Admin &amp; Security Settings
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400">
              VINORA administration roster, access controls, and Firestore security configuration.
            </p>
          </div>

          <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Current Active Session
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                <ShieldCheck className="size-3.5" />
                Verified Session
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                  Admin Name
                </span>
                <span className="font-medium text-white">{admin?.name}</span>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                  Admin Email
                </span>
                <span className="font-mono text-zinc-200">{admin?.email}</span>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                  Firebase Auth UID
                </span>
                <span className="font-mono text-zinc-200 break-all">{admin?.uid}</span>
              </div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                  Firestore Verification Doc
                </span>
                <span className="font-mono text-zinc-200">/admins/{admin?.uid}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Authorized VINORA Administrator Roster
              </h3>
              <span className="text-xs text-zinc-400">4 authorized accounts</span>
            </div>
            <div className="divide-y divide-white/[0.08] rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
              {AUTHORIZED_ADMIN_ACCOUNTS.map((acc, index) => {
                const isCurrent = admin?.email.toLowerCase() === acc.email.toLowerCase();
                return (
                  <div
                    key={acc.email}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] font-mono text-[11px] text-zinc-400">
                        0{index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white">{acc.name}</span>
                          {isCurrent && (
                            <span className="rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                              Current Session
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-zinc-400">{acc.title}</p>
                      </div>
                    </div>
                    <div className="font-mono text-zinc-300 sm:text-right">{acc.email}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
              Security Rules Architecture
            </h3>
            <div className="space-y-3 text-xs leading-relaxed text-zinc-300">
              <p>
                Authorization is enforced server-side within{" "}
                <span className="font-mono text-white">firestore.rules</span> via the strict{" "}
                <span className="font-mono text-white">isAdmin()</span> predicate.
              </p>
              <ul className="list-disc list-inside space-y-1 text-zinc-400">
                <li>
                  Admin verification checks UID existence against{" "}
                  <span className="font-mono text-zinc-200">/admins/{`{uid}`}</span>.
                </li>
                <li>
                  Write access to{" "}
                  <span className="font-mono text-zinc-200">
                    projects, proposals, invoices, documents, projectUpdates, messages
                  </span>{" "}
                  requires valid admin authorization.
                </li>
                <li>
                  Public users and clients have zero unauthorized read or write access to
                  administrative collections.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODALS: PROJECT CRUD, CLIENT DOSSIER, REQUEST & SHOWCASE   */}
      {/* ========================================================= */}
      {admin && (
        <AdminProjectModal
          isOpen={projectModalOpen}
          editingProject={editingStudioProject}
          initialClientId={projectModalInitialClientId}
          admin={admin}
          clients={data?.clients || []}
          onClose={() => {
            setProjectModalOpen(false);
            setEditingStudioProject(null);
            setProjectModalInitialClientId(undefined);
          }}
          onSaved={(msg) => {
            showTransientSuccess(msg);
            void loadDashboardData();
          }}
        />
      )}

      <AdminClientDossierModal
        client={selectedClient}
        projects={data?.projects || []}
        proposals={data?.proposals || []}
        invoices={data?.invoices || []}
        payments={payments}
        meetings={meetings}
        documents={documents}
        isUpdating={Boolean(selectedClient && isUpdating === selectedClient.uid)}
        onClose={() => setSelectedClient(null)}
        onUpdateStatus={(cid, status) => handleUpdateClientStatus(cid, status)}
        onCreateProjectForClient={(cid) => {
          setSelectedClient(null);
          openCreateProjectModal(cid);
        }}
        onNavigateSection={(sec) => handleSelectSection(sec)}
      />

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => !isDeletingProject && setProjectToDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#121217] p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-base font-semibold text-white">Delete Project?</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently remove{" "}
              <strong className="text-white">&ldquo;{projectToDelete.title}&rdquo;</strong> from
              Firestore? This cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 border-t border-white/10 pt-3">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeletingProject}
                onClick={() => setProjectToDelete(null)}
                className="rounded-xl border-white/15 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isDeletingProject}
                onClick={confirmDeleteStudioProject}
                className="rounded-xl bg-rose-600 text-white hover:bg-rose-500 text-xs cursor-pointer"
              >
                {isDeletingProject && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                Delete Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: PROJECT REQUEST DETAILS DRAWER */}
      {selectedRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setSelectedRequest(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#121217] p-6 sm:p-8 shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                  Project Request Details
                </span>
                <h3 className="font-display text-lg font-medium text-white mt-1">
                  {selectedRequest.serviceRequired || "Project Scope Inquiry"}
                </h3>
                <p className="font-mono text-xs text-zinc-400 mt-0.5">
                  Request #{selectedRequest.id} • Submitted {formatDate(selectedRequest.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                  Client Name
                </span>
                <span className="font-medium text-white">{selectedRequest.name}</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                  Email
                </span>
                <span className="font-mono text-zinc-200">{selectedRequest.email}</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                  Business / Brand
                </span>
                <span className="text-white">
                  {selectedRequest.businessName || "Not specified"}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                  Target Budget
                </span>
                <span className="text-white">{selectedRequest.budget || "Flexible"}</span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                  Target Completion
                </span>
                <span className="text-white">
                  {selectedRequest.expectedCompletionDate || "Scheduled in sprints"}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                  Preferred Contact
                </span>
                <span className="text-white capitalize">
                  {selectedRequest.preferredCommunication}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400">
                Project Description &amp; Scope
              </span>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-zinc-200 whitespace-pre-wrap">
                {selectedRequest.projectDescription}
              </div>
            </div>

            {(selectedRequest.referenceWebsites || selectedRequest.additionalRequirements) && (
              <div className="space-y-3 border-t border-white/10 pt-4 text-xs">
                {selectedRequest.referenceWebsites && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 block">
                      Reference Inspiration
                    </span>
                    <p className="text-zinc-200 mt-0.5">{selectedRequest.referenceWebsites}</p>
                  </div>
                )}
                {selectedRequest.additionalRequirements && (
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 block">
                      Additional Requirements
                    </span>
                    <p className="text-zinc-200 mt-0.5">{selectedRequest.additionalRequirements}</p>
                  </div>
                )}
              </div>
            )}

            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">
                    Public Showcase Visibility
                  </span>
                </div>
                {selectedRequest.showcaseApproved ? (
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] border border-emerald-500/35 bg-emerald-500/15 text-emerald-300 font-medium">
                    Live on Homepage
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] border border-white/10 text-zinc-400">
                    Hidden / Private
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {selectedRequest.showcaseApproved ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isUpdating === selectedRequest.id}
                    onClick={() =>
                      handleRejectShowcase(selectedRequest.id, "Removed from showcase by admin")
                    }
                    className="rounded-xl text-xs border-rose-500/35 text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                  >
                    <ThumbsDown className="size-3.5 mr-1.5" />
                    Revoke from Public Showcase
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={isUpdating === selectedRequest.id}
                      onClick={() => openApprovalModal(selectedRequest)}
                      className="rounded-xl text-xs bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer"
                    >
                      <Sparkles className="size-3.5 mr-1.5" />
                      Approve for Public Showcase...
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isUpdating === selectedRequest.id}
                      onClick={() => handleApproveShowcase(selectedRequest.id)}
                      className="rounded-xl text-xs border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/15 cursor-pointer"
                    >
                      1-Click Approve
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-400">Request Status:</span>
                <span className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-xs text-white">
                  {selectedRequest.status || "Pending"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUpdating === selectedRequest.id}
                  onClick={() => handleUpdateRequestStatus(selectedRequest.id, "Reviewing")}
                  className="rounded-xl border-white/15 text-xs cursor-pointer"
                >
                  Mark Reviewing
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUpdating === selectedRequest.id}
                  onClick={() => handleUpdateRequestStatus(selectedRequest.id, "Approved")}
                  className="rounded-xl text-xs border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/15 cursor-pointer"
                >
                  Approve Request
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUpdating === selectedRequest.id}
                  onClick={() => handleUpdateRequestStatus(selectedRequest.id, "Rejected")}
                  className="rounded-xl text-xs border-rose-500/35 text-rose-300 hover:bg-rose-500/15 cursor-pointer"
                >
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONTACT ENQUIRY DETAILS */}
      {selectedEnquiry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setSelectedEnquiry(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#121217] p-6 sm:p-8 shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">
                  Contact Submission
                </span>
                <h3 className="font-display text-lg font-medium text-white mt-1">
                  {selectedEnquiry.subject || "General Inquiry"}
                </h3>
                <p className="font-mono text-xs text-zinc-400 mt-0.5">
                  Received {formatDate(selectedEnquiry.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEnquiry(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                  Sender
                </span>
                <span className="font-medium text-white">{selectedEnquiry.name}</span>
                <span className="font-mono text-zinc-400 block">{selectedEnquiry.email}</span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">
                  Message Body
                </span>
                <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs leading-relaxed text-zinc-200 whitespace-pre-wrap">
                  {selectedEnquiry.message}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 text-xs text-zinc-300">
                Status: {selectedEnquiry.status || "New"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUpdating === selectedEnquiry.id}
                  onClick={() => handleUpdateContactStatus(selectedEnquiry.id, "Contacted")}
                  className="rounded-xl border-white/15 text-xs cursor-pointer"
                >
                  Mark Contacted
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUpdating === selectedEnquiry.id}
                  onClick={() => handleUpdateContactStatus(selectedEnquiry.id, "Resolved")}
                  className="rounded-xl text-xs border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/15 cursor-pointer"
                >
                  Mark Resolved
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: APPROVE PROJECT FOR PUBLIC SHOWCASE */}
      {approvalModalRequest && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setApprovalModalRequest(null)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#121217] p-6 sm:p-8 shadow-2xl space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-400" />
                  <span className="text-[11px] font-medium uppercase tracking-wider text-emerald-300">
                    Curate Showcase
                  </span>
                </div>
                <h3 className="font-display text-xl font-medium text-white mt-1">
                  Approve Project for Public Showcase
                </h3>
                <p className="font-mono text-xs text-zinc-400 mt-0.5">
                  Request #{approvalModalRequest.id.slice(0, 8)} • Submitted by{" "}
                  {approvalModalRequest.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setApprovalModalRequest(null)}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 space-y-1">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">
                  Original Client Request
                </span>
                <p className="text-sm font-medium text-white">
                  {approvalModalRequest.businessName
                    ? `${approvalModalRequest.businessName} (${approvalModalRequest.serviceRequired})`
                    : approvalModalRequest.serviceRequired}
                </p>
                <p className="text-[11px] text-zinc-400 line-clamp-2 mt-1">
                  {approvalModalRequest.projectDescription}
                </p>
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1.5 font-medium">
                  Showcase Display Title
                </label>
                <input
                  type="text"
                  value={approvalCustomTitle}
                  onChange={(e) => setApprovalCustomTitle(e.target.value)}
                  placeholder="e.g. Acme Corp — Next-Gen Banking Architecture"
                  className="w-full rounded-xl border border-white/15 bg-zinc-900/90 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1.5 font-medium">
                  Showcase Public Description
                </label>
                <textarea
                  rows={4}
                  value={approvalCustomDesc}
                  onChange={(e) => setApprovalCustomDesc(e.target.value)}
                  placeholder="Describe the initiative, architecture, and client impact..."
                  className="w-full rounded-xl border border-white/15 bg-zinc-900/90 p-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40 leading-relaxed resize-y"
                />
              </div>

              <div>
                <label className="block text-[11px] text-zinc-400 uppercase tracking-wider mb-1.5 font-medium">
                  Showcase Cover Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={approvalCustomImg}
                  onChange={(e) => setApprovalCustomImg(e.target.value)}
                  placeholder="https://... (Optional image URL)"
                  className="w-full rounded-xl border border-white/15 bg-zinc-900/90 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40"
                />
              </div>
            </div>

            <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <Button
                variant="outline"
                onClick={() => setApprovalModalRequest(null)}
                className="rounded-xl border-white/15 text-xs w-full sm:w-auto cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                disabled={isUpdating === approvalModalRequest.id}
                onClick={() =>
                  handleApproveShowcase(approvalModalRequest.id, {
                    showcaseTitle: approvalCustomTitle,
                    showcaseDescription: approvalCustomDesc,
                    imageUrl: approvalCustomImg,
                  })
                }
                className="rounded-xl text-xs bg-white text-zinc-950 hover:bg-zinc-200 w-full sm:w-auto cursor-pointer flex items-center gap-1.5 font-medium"
              >
                {isUpdating === approvalModalRequest.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                Approve &amp; Publish to Showcase
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminPortalLayout>
  );
}
