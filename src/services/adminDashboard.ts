import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { normalizeInvoiceDoc } from "@/services/invoiceService";
import { createUserNotification } from "@/services/notificationService";
import type {
  ProjectRequest,
  ContactSubmission,
  Project,
  Proposal,
  Invoice,
  Message,
  UpdateVisibility,
} from "@/lib/types";

export interface AdminClientProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  companyName?: string;
  phone?: string;
  accountStatus: string;
  createdAt: string;
  updatedAt?: string;
}

export interface AdminDashboardData {
  clients: AdminClientProfile[];
  projectRequests: ProjectRequest[];
  contactEnquiries: ContactSubmission[];
  projects: Project[];
  proposals: Proposal[];
  invoices: Invoice[];
  messages: Message[];
  stats: {
    totalClients: number;
    activeProjects: number;
    pendingProjectRequests: number;
    contactEnquiries: number;
    totalProposals: number;
    totalInvoices: number;
    showcaseApprovedCount: number;
  };
}

/**
 * Normalizes client profile records from Firestore collections (clients and users).
 */
export async function fetchAllClients(): Promise<AdminClientProfile[]> {
  const clientsMap = new Map<string, AdminClientProfile>();

  try {
    // 1. Read from "clients" collection
    const clientsSnap = await getDocs(collection(db, "clients"));
    for (const docSnap of clientsSnap.docs) {
      const data = docSnap.data();
      const uid = data.uid || data.userId || docSnap.id;
      clientsMap.set(uid, {
        id: docSnap.id,
        uid,
        name: data.fullName || data.name || "Client",
        email: data.email || data.contactEmail || "",
        companyName: data.companyName || data.company || "",
        phone: data.phone || data.phoneNumber || "",
        accountStatus: data.accountStatus || data.status || "active",
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || "",
      });
    }
  } catch (err) {
    console.warn("[AdminDashboard] Error reading clients collection:", err);
  }

  try {
    // 2. Read from "users" collection (role == 'client') to merge any direct registrations
    const usersSnap = await getDocs(collection(db, "users"));
    for (const docSnap of usersSnap.docs) {
      const data = docSnap.data();
      if (data.role === "client" || !data.role) {
        const uid = data.uid || docSnap.id;
        const existing = clientsMap.get(uid);
        if (!existing) {
          clientsMap.set(uid, {
            id: docSnap.id,
            uid,
            name: data.fullName || data.name || "Client",
            email: data.email || "",
            companyName: data.companyName || "",
            phone: data.phone || "",
            accountStatus: data.accountStatus || "active",
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || "",
          });
        }
      }
    }
  } catch (err) {
    console.warn("[AdminDashboard] Error reading users collection:", err);
  }

  const list = Array.from(clientsMap.values());
  list.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
  return list;
}

/**
 * Reads all project requests from Firestore collection "projectRequests".
 */
export async function fetchAllProjectRequests(): Promise<ProjectRequest[]> {
  try {
    const snap = await getDocs(collection(db, "projectRequests"));
    const list: ProjectRequest[] = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        clientId: data.clientId || null,
        clientProfile: data.clientProfile || null,
        name: data.name || "Untitled Request",
        email: data.email || "",
        businessName: data.businessName || "",
        serviceRequired: data.serviceRequired || "General Inquiry",
        projectDescription: data.projectDescription || "",
        budget: data.budget || "",
        expectedCompletionDate: data.expectedCompletionDate || "",
        referenceWebsites: data.referenceWebsites || "",
        preferredCommunication: data.preferredCommunication || "email",
        additionalRequirements: data.additionalRequirements || "",
        attachmentPaths: Array.isArray(data.attachmentPaths) ? data.attachmentPaths : [],
        status: data.status || "Pending Review",
        showcaseApproved: Boolean(data.showcaseApproved),
        approvedAt: data.approvedAt || null,
        approvedBy: data.approvedBy || null,
        rejectionReason: data.rejectionReason || undefined,
        showcaseTitle: data.showcaseTitle || undefined,
        showcaseDescription: data.showcaseDescription || undefined,
        imageUrl: data.imageUrl || undefined,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || "",
        isRegisteredClient: Boolean(data.isRegisteredClient || data.clientId),
      });
    }

    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  } catch (err) {
    console.warn("[AdminDashboard] Error reading projectRequests:", err);
    return [];
  }
}

/**
 * Reads all contact enquiries from both contactSubmissions and contactEnquiries.
 */
export async function fetchAllContactEnquiries(): Promise<ContactSubmission[]> {
  const map = new Map<string, ContactSubmission>();

  try {
    const snapSubmissions = await getDocs(collection(db, "contactSubmissions"));
    for (const docSnap of snapSubmissions.docs) {
      const data = docSnap.data();
      map.set(docSnap.id, {
        id: docSnap.id,
        name: data.name || "Visitor",
        email: data.email || "",
        subject: data.subject || "General Inquiry",
        message: data.message || "",
        status: data.status || "New",
        timestamp: data.timestamp || data.createdAt || "",
        createdAt: data.createdAt || data.timestamp || new Date().toISOString(),
        uid: data.uid || data.userId || null,
        userId: data.userId || data.uid || null,
        clientId: data.clientId || null,
        userEmail: data.userEmail || null,
        isGuest: data.isGuest ?? !data.uid,
      });
    }
  } catch (err) {
    console.warn("[AdminDashboard] Error reading contactSubmissions:", err);
  }

  try {
    const snapEnquiries = await getDocs(collection(db, "contactEnquiries"));
    for (const docSnap of snapEnquiries.docs) {
      if (!map.has(docSnap.id)) {
        const data = docSnap.data();
        map.set(docSnap.id, {
          id: docSnap.id,
          name: data.name || "Visitor",
          email: data.email || "",
          subject: data.subject || "General Inquiry",
          message: data.message || "",
          status: data.status || "New",
          timestamp: data.timestamp || data.createdAt || "",
          createdAt: data.createdAt || data.timestamp || new Date().toISOString(),
          uid: data.uid || null,
          userId: data.userId || null,
          clientId: data.clientId || null,
          userEmail: data.userEmail || null,
          isGuest: data.isGuest ?? !data.uid,
        });
      }
    }
  } catch (err) {
    console.warn("[AdminDashboard] Error reading contactEnquiries:", err);
  }

  const list = Array.from(map.values());
  list.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });
  return list;
}

/**
 * Reads all projects from Firestore collection "projects".
 */
export async function fetchAllProjects(): Promise<Project[]> {
  try {
    const snap = await getDocs(collection(db, "projects"));
    const list: Project[] = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        clientId: data.clientId || "",
        title: data.title || "Untitled Project",
        description: data.description || "",
        category: data.category || data.serviceRequired || "",
        serviceRequired: data.serviceRequired || data.category || "",
        status: data.status || "planning",
        progress: typeof data.progress === "number" ? data.progress : 0,
        assignedAdminId: data.assignedAdminId || undefined,
        assignedAdminName: data.assignedAdminName || undefined,
        startDate: data.startDate || data.startedAt || "",
        startedAt: data.startedAt || data.startDate || "",
        dueAt: data.dueAt || data.expectedCompletionDate || "",
        expectedCompletionDate: data.expectedCompletionDate || data.dueAt || "",
        showcaseApproved: Boolean(data.showcaseApproved),
        approvedAt: data.approvedAt || null,
        approvedBy: data.approvedBy || null,
        imageUrl: data.imageUrl || undefined,
        clientName: data.clientName || undefined,
        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || "",
      });
    }

    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  } catch (err) {
    console.warn("[AdminDashboard] Error reading projects:", err);
    return [];
  }
}

/**
 * Reads all proposals from Firestore collection "proposals".
 */
export async function fetchAllProposals(): Promise<Proposal[]> {
  try {
    const snap = await getDocs(collection(db, "proposals"));
    const list: Proposal[] = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        clientId: data.clientId || "",
        projectId: data.projectId || "",
        scope: data.scope || "",
        deliverables: Array.isArray(data.deliverables) ? data.deliverables : [],
        timeline: data.timeline || "",
        totalPrice: Number(data.totalPrice) || 0,
        currency: data.currency || "USD",
        advanceAmount: Number(data.advanceAmount) || 0,
        remainingAmount: Number(data.remainingAmount) || 0,
        terms: data.terms || "",
        notes: data.notes || undefined,
        status: data.status || "draft",
        createdAt: data.createdAt || new Date().toISOString(),
      });
    }

    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  } catch (err) {
    console.warn("[AdminDashboard] Error reading proposals:", err);
    return [];
  }
}

/**
 * Reads all invoices from Firestore collection "invoices".
 */
export async function fetchAllInvoices(): Promise<Invoice[]> {
  try {
    const snap = await getDocs(collection(db, "invoices"));
    const list: Invoice[] = [];
    for (const docSnap of snap.docs) {
      list.push(normalizeInvoiceDoc(docSnap.id, docSnap.data()));
    }

    list.sort((a, b) => {
      const timeA = a.issueDate ? new Date(a.issueDate).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.issueDate ? new Date(b.issueDate).getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    return list;
  } catch (err) {
    console.warn("[AdminDashboard] Error reading invoices:", err);
    return [];
  }
}

/**
 * Reads all messages from Firestore collection "messages".
 */
export async function fetchAllMessages(): Promise<Message[]> {
  try {
    const snap = await getDocs(collection(db, "messages"));
    const list: Message[] = [];
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      list.push({
        id: docSnap.id,
        projectId: data.projectId || "",
        senderId: data.senderId || "",
        body: data.body || "",
        createdAt: data.createdAt || new Date().toISOString(),
        readAt: data.readAt || undefined,
      });
    }

    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  } catch (err) {
    console.warn("[AdminDashboard] Error reading messages:", err);
    return [];
  }
}

/**
 * Fetches all collections for the Admin Dashboard in parallel.
 */
export async function fetchAdminDashboardData(): Promise<AdminDashboardData> {
  const [clients, projectRequests, contactEnquiries, projects, proposals, invoices, messages] =
    await Promise.all([
      fetchAllClients(),
      fetchAllProjectRequests(),
      fetchAllContactEnquiries(),
      fetchAllProjects(),
      fetchAllProposals(),
      fetchAllInvoices(),
      fetchAllMessages(),
    ]);

  const activeProjectsCount = projects.filter(
    (p) => p.status !== "completed" && p.status !== "closed",
  ).length;

  const pendingRequestsCount = projectRequests.filter((r) => {
    const s = (r.status || "").toLowerCase();
    return s.includes("pending") || s.includes("new") || s === "reviewing";
  }).length;

  const showcaseApprovedCount =
    projectRequests.filter((r) => r.showcaseApproved === true).length +
    projects.filter((p) => p.showcaseApproved === true).length;

  return {
    clients,
    projectRequests,
    contactEnquiries,
    projects,
    proposals,
    invoices,
    messages,
    stats: {
      totalClients: clients.length,
      activeProjects: activeProjectsCount,
      pendingProjectRequests: pendingRequestsCount,
      contactEnquiries: contactEnquiries.length,
      totalProposals: proposals.length,
      totalInvoices: invoices.length,
      showcaseApprovedCount,
    },
  };
}

/**
 * Updates a Project Request status (e.g. Pending, Reviewing, Approved, Rejected).
 */
export async function updateProjectRequestStatus(
  requestId: string,
  newStatus: "Pending Review" | "Reviewing" | "Approved" | "Rejected",
): Promise<void> {
  try {
    const ref = doc(db, "projectRequests", requestId);
    await updateDoc(ref, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `projectRequests/${requestId}`);
  }
}

/**
 * Updates a Contact Enquiry status (e.g. New, Contacted, Resolved, Archived).
 */
export async function updateContactStatus(
  enquiryId: string,
  newStatus: "New" | "Contacted" | "Resolved" | "Archived",
): Promise<void> {
  try {
    const subRef = doc(db, "contactSubmissions", enquiryId);
    await updateDoc(subRef, {
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // If not in contactSubmissions, try contactEnquiries
    try {
      const enqRef = doc(db, "contactEnquiries", enquiryId);
      await updateDoc(enqRef, {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `contactEnquiries/${enquiryId}`);
    }
  }
}

/**
 * Updates a Client account status (e.g. active, suspended, pending).
 */
export async function updateClientStatus(
  clientId: string,
  accountStatus: "active" | "suspended" | "pending",
): Promise<void> {
  try {
    const clientRef = doc(db, "clients", clientId);
    await updateDoc(clientRef, {
      accountStatus,
      status: accountStatus,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // Also try users collection
    try {
      const userRef = doc(db, "users", clientId);
      await updateDoc(userRef, {
        accountStatus,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `clients/${clientId}`);
    }
  }
}

export { approveProjectForShowcase, rejectProjectFromShowcase } from "./showcase";

export interface CreateAdminProjectInput {
  clientId: string;
  clientName?: string;
  title: string;
  category: string;
  description: string;
  status: string;
  progress: number;
  startDate?: string;
  dueAt?: string;
  imageUrl?: string;
  assignedAdminId?: string;
  assignedAdminName?: string;
  showcaseApproved?: boolean;
}

export interface UpdateAdminProjectInput {
  projectId: string;
  clientId?: string;
  clientName?: string;
  title?: string;
  category?: string;
  description?: string;
  status?: string;
  progress?: number;
  startDate?: string;
  dueAt?: string;
  imageUrl?: string;
  assignedAdminId?: string;
  assignedAdminName?: string;
  showcaseApproved?: boolean;
}

/**
 * Creates a Studio Project document in Firestore `/projects` and notifies the assigned client.
 */
export async function createAdminProject(input: CreateAdminProjectInput): Promise<Project> {
  if (!input.clientId) {
    throw new Error("Target client is required for project creation.");
  }
  if (!input.title.trim()) {
    throw new Error("Project title is required.");
  }

  const now = new Date().toISOString();
  const projectRef = doc(collection(db, "projects"));
  const clampedProgress = Math.min(100, Math.max(0, Math.round(Number(input.progress) || 0)));

  const record: Project = {
    id: projectRef.id,
    clientId: input.clientId,
    clientName: input.clientName?.trim() || undefined,
    title: input.title.trim(),
    category: input.category.trim() || "Digital Engineering",
    serviceRequired: input.category.trim() || "Digital Engineering",
    description: input.description.trim(),
    status: input.status || "In Progress",
    progress: clampedProgress,
    startDate: input.startDate || now.slice(0, 10),
    startedAt: input.startDate || now.slice(0, 10),
    dueAt: input.dueAt || undefined,
    expectedCompletionDate: input.dueAt || undefined,
    imageUrl: input.imageUrl?.trim() || undefined,
    assignedAdminId: input.assignedAdminId || undefined,
    assignedAdminName: input.assignedAdminName || undefined,
    showcaseApproved: Boolean(input.showcaseApproved),
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(projectRef, record);
    void createUserNotification({
      userId: input.clientId,
      title: `New Project Created: ${record.title}`,
      body: `Your project "${record.title}" (${record.category}) is now active in your portal at ${record.progress}% progress.`,
      type: "project_created",
      link: `/client?section=projects`,
      projectId: record.id,
    });
    return record;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `projects/${projectRef.id}`);
    throw err;
  }
}

/**
 * Updates an existing Studio Project in Firestore `/projects` and notifies the client.
 */
export async function updateAdminProject(input: UpdateAdminProjectInput): Promise<void> {
  const now = new Date().toISOString();
  const projectRef = doc(db, "projects", input.projectId);
  const updates: Record<string, unknown> = {
    updatedAt: now,
  };

  if (input.clientId !== undefined) updates.clientId = input.clientId;
  if (input.clientName !== undefined) updates.clientName = input.clientName.trim();
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.category !== undefined) {
    updates.category = input.category.trim();
    updates.serviceRequired = input.category.trim();
  }
  if (input.description !== undefined) updates.description = input.description.trim();
  if (input.status !== undefined) updates.status = input.status;
  if (input.progress !== undefined) {
    updates.progress = Math.min(100, Math.max(0, Math.round(Number(input.progress) || 0)));
  }
  if (input.startDate !== undefined) {
    updates.startDate = input.startDate;
    updates.startedAt = input.startDate;
  }
  if (input.dueAt !== undefined) {
    updates.dueAt = input.dueAt;
    updates.expectedCompletionDate = input.dueAt;
  }
  if (input.imageUrl !== undefined) updates.imageUrl = input.imageUrl.trim();
  if (input.assignedAdminId !== undefined) updates.assignedAdminId = input.assignedAdminId;
  if (input.assignedAdminName !== undefined) updates.assignedAdminName = input.assignedAdminName;
  if (input.showcaseApproved !== undefined) updates.showcaseApproved = input.showcaseApproved;

  try {
    await updateDoc(projectRef, updates);
    if (input.clientId) {
      const progressStr =
        typeof input.progress === "number" ? ` (${Math.round(input.progress)}% complete)` : "";
      void createUserNotification({
        userId: input.clientId,
        title: `Project Updated: ${input.title || "Studio Project"}`,
        body: `Status updated to ${input.status || "updated"}${progressStr}. Check My Projects for details.`,
        type: "project_updated",
        link: `/client?section=projects`,
        projectId: input.projectId,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `projects/${input.projectId}`);
    throw err;
  }
}

/**
 * Deletes a Studio Project document from Firestore `/projects`.
 */
export async function deleteAdminProject(projectId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "projects", projectId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}`);
    throw err;
  }
}

export interface StudioUpdateRecord {
  id: string;
  title: string;
  description: string;
  category: "announcement" | "milestone" | "status" | "note" | string;
  visibility: UpdateVisibility | "all_clients" | "specific_client";
  projectId?: string;
  projectTitle?: string;
  clientId?: string;
  clientName?: string;
  authorName?: string;
  authorEmail?: string;
  pinned: boolean;
  archived: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt?: string;
}

function parseStudioUpdateDoc(id: string, d: Record<string, unknown>): StudioUpdateRecord {
  return {
    id,
    title: typeof d.title === "string" ? d.title : "Studio Update",
    description:
      typeof d.description === "string"
        ? d.description
        : typeof d.content === "string"
          ? d.content
          : "",
    category: typeof d.category === "string" ? d.category : "announcement",
    visibility: d.visibility === "specific_client" ? "specific_client" : "all_clients",
    projectId: typeof d.projectId === "string" ? d.projectId : undefined,
    projectTitle: typeof d.projectTitle === "string" ? d.projectTitle : undefined,
    clientId: typeof d.clientId === "string" ? d.clientId : undefined,
    clientName: typeof d.clientName === "string" ? d.clientName : undefined,
    authorName: typeof d.authorName === "string" ? d.authorName : undefined,
    authorEmail: typeof d.authorEmail === "string" ? d.authorEmail : undefined,
    pinned: Boolean(d.pinned),
    archived: Boolean(d.archived),
    publishedAt:
      typeof d.publishedAt === "string"
        ? d.publishedAt
        : typeof d.createdAt === "string"
          ? d.createdAt
          : new Date().toISOString(),
    createdAt: typeof d.createdAt === "string" ? d.createdAt : new Date().toISOString(),
    updatedAt: typeof d.updatedAt === "string" ? d.updatedAt : undefined,
  };
}

/**
 * Real-time subscription to `projectUpdates` collection for Admin Portal.
 */
export function subscribeAllStudioUpdates(
  onData: (updates: StudioUpdateRecord[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, "projectUpdates"),
    (snap) => {
      const list = snap.docs.map((docSnap) =>
        parseStudioUpdateDoc(docSnap.id, docSnap.data() as Record<string, unknown>),
      );
      list.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
      onData(list);
    },
    (err) => {
      console.warn("[AdminDashboard] Error subscribing projectUpdates:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * One-time read of all studio updates (`projectUpdates`).
 */
export async function fetchAllStudioUpdates(): Promise<StudioUpdateRecord[]> {
  try {
    const snap = await getDocs(collection(db, "projectUpdates"));
    const list = snap.docs.map((docSnap) =>
      parseStudioUpdateDoc(docSnap.id, docSnap.data() as Record<string, unknown>),
    );
    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    });
    return list;
  } catch (err) {
    console.warn("[AdminDashboard] Error reading projectUpdates:", err);
    return [];
  }
}

export interface CreateStudioUpdateInput {
  title: string;
  description: string;
  category: "announcement" | "milestone" | "status" | "note";
  visibility: "all_clients" | "specific_client";
  projectId?: string;
  projectTitle?: string;
  clientId?: string;
  clientName?: string;
  pinned?: boolean;
  authorName?: string;
  authorEmail?: string;
  notifyClients?: boolean;
  allClientUids?: string[];
}

export async function createStudioUpdate(
  input: CreateStudioUpdateInput,
): Promise<StudioUpdateRecord> {
  if (!input.title.trim()) throw new Error("Update title is required.");
  if (!input.description.trim()) throw new Error("Update message content is required.");

  const now = new Date().toISOString();
  const ref = doc(collection(db, "projectUpdates"));

  const payload: StudioUpdateRecord = {
    id: ref.id,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category || "announcement",
    visibility: input.visibility,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.projectTitle ? { projectTitle: input.projectTitle } : {}),
    ...(input.clientId ? { clientId: input.clientId } : {}),
    ...(input.clientName ? { clientName: input.clientName } : {}),
    authorName: input.authorName || "VINORA Studio",
    authorEmail: input.authorEmail || "",
    pinned: Boolean(input.pinned),
    archived: false,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(ref, payload);

    if (input.notifyClients !== false) {
      if (input.visibility === "specific_client" && input.clientId) {
        void createUserNotification({
          userId: input.clientId,
          title: `Update: ${payload.title}`,
          body: payload.description,
          type: `update_${payload.category}`,
          link: "/client?section=updates",
          projectId: payload.projectId,
        });
      } else if (input.visibility === "all_clients" && input.allClientUids?.length) {
        for (const cid of input.allClientUids.slice(0, 100)) {
          void createUserNotification({
            userId: cid,
            title: `Announcement: ${payload.title}`,
            body: payload.description,
            type: `update_${payload.category}`,
            link: "/client?section=updates",
          });
        }
      }
    }

    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `projectUpdates/${ref.id}`);
    throw err;
  }
}

export async function updateStudioUpdate(
  updateId: string,
  fields: Partial<
    Pick<
      StudioUpdateRecord,
      | "title"
      | "description"
      | "category"
      | "visibility"
      | "projectId"
      | "projectTitle"
      | "clientId"
      | "clientName"
      | "pinned"
      | "archived"
    >
  >,
): Promise<void> {
  try {
    await updateDoc(doc(db, "projectUpdates", updateId), {
      ...fields,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `projectUpdates/${updateId}`);
    throw err;
  }
}

export async function deleteStudioUpdate(updateId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "projectUpdates", updateId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `projectUpdates/${updateId}`);
    throw err;
  }
}
