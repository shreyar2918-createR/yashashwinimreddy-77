import { collection, query, where, getDocs } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { normalizeInvoiceDoc } from "@/services/invoiceService";
import type {
  ProjectRequest,
  Project,
  Milestone,
  Proposal,
  Invoice,
  ClientDocument,
  Message,
} from "@/lib/types";

export type CanonicalMilestoneStatus = "Not Started" | "In Progress" | "Completed" | "On Hold";

export function normalizeMilestoneStatus(status?: string): CanonicalMilestoneStatus {
  if (!status) return "Not Started";
  const s = status.toLowerCase().trim();
  if (
    s === "completed" ||
    s === "done" ||
    s === "finished" ||
    s === "delivered" ||
    s === "closed"
  ) {
    return "Completed";
  }
  if (
    s === "in_progress" ||
    s === "in progress" ||
    s === "active" ||
    s === "review" ||
    s === "in_review" ||
    s === "testing" ||
    s === "development"
  ) {
    return "In Progress";
  }
  if (s === "on_hold" || s === "on hold" || s === "blocked" || s === "paused" || s === "delayed") {
    return "On Hold";
  }
  return "Not Started";
}

/**
 * Fetches milestones for a specific project from Firestore.
 * Scoped strictly to the project ID, with client UID verification.
 */
export async function fetchProjectMilestones(
  projectId: string,
  clientUid?: string,
  embeddedMilestones?: Milestone[],
): Promise<Milestone[]> {
  if (!projectId) return [];
  const milestonesMap = new Map<string, Milestone>();

  // 1. If embedded milestones exist on the project object, hydrate them first
  if (embeddedMilestones && Array.isArray(embeddedMilestones)) {
    for (const m of embeddedMilestones) {
      if (m && m.id) {
        milestonesMap.set(m.id, {
          ...m,
          status: normalizeMilestoneStatus(m.status),
          progress: Math.min(100, Math.max(0, typeof m.progress === "number" ? m.progress : 0)),
        });
      }
    }
  }

  // 2. Query Firestore 'milestones' collection for this project
  try {
    const q = query(collection(db, "milestones"), where("projectId", "==", projectId));
    const snap = await getDocs(q);
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      // If doc has clientId, verify data isolation
      if (data.clientId && clientUid && data.clientId !== clientUid) {
        continue;
      }
      milestonesMap.set(docSnap.id, {
        id: docSnap.id,
        projectId: data.projectId || projectId,
        clientId: data.clientId,
        title: data.title || "Project Milestone",
        description: data.description || "",
        status: normalizeMilestoneStatus(data.status),
        progress: Math.min(100, Math.max(0, typeof data.progress === "number" ? data.progress : 0)),
        dueDate: data.dueDate || data.deadline || "",
        deadline: data.deadline || data.dueDate || "",
        completedDate: data.completedDate || data.completedAt || "",
        completedAt: data.completedAt || data.completedDate || "",
        createdAt: data.createdAt || "",
        updatedAt: data.updatedAt || data.lastUpdatedDate || data.createdAt || "",
      });
    }
  } catch (err) {
    console.warn("Could not query milestones collection:", err);
  }

  const result = Array.from(milestonesMap.values());
  // Sort milestones chronologically: earliest due date first
  result.sort((a, b) => {
    const timeA = a.dueDate
      ? new Date(a.dueDate).getTime()
      : a.createdAt
        ? new Date(a.createdAt).getTime()
        : 0;
    const timeB = b.dueDate
      ? new Date(b.dueDate).getTime()
      : b.createdAt
        ? new Date(b.createdAt).getTime()
        : 0;
    return timeA - timeB;
  });

  return result;
}

export interface ClientUpdateItem {
  id: string;
  title: string;
  description: string;
  date: string;
  category: "status" | "announcement" | "milestone" | "note";
  projectId?: string;
  projectName?: string;
}

export interface ClientDashboardData {
  projectRequests: ProjectRequest[];
  projects: Project[];
  proposals: Proposal[];
  documents: ClientDocument[];
  invoices: Invoice[];
  messages: Message[];
  updates: ClientUpdateItem[];
}

/**
 * Retrieves all project inquiries and requests submitted by this client.
 * Scoped strictly to the client's Firebase UID and email.
 */
export async function fetchClientProjectRequests(
  clientId: string,
  email?: string | null,
): Promise<ProjectRequest[]> {
  try {
    const itemsMap = new Map<string, ProjectRequest>();

    // 1. Query by authenticated client UID
    if (clientId) {
      try {
        const qUid = query(collection(db, "projectRequests"), where("clientId", "==", clientId));
        const snapUid = await getDocs(qUid);
        for (const docSnap of snapUid.docs) {
          itemsMap.set(docSnap.id, docSnap.data() as ProjectRequest);
        }
      } catch (uidErr) {
        console.warn("Could not query projectRequests by clientId:", uidErr);
      }
    }

    // 2. Query by verified email address (for inquiries created with the client's email)
    if (email) {
      try {
        const qEmail = query(
          collection(db, "projectRequests"),
          where("email", "==", email.trim().toLowerCase()),
        );
        const snapEmail = await getDocs(qEmail);
        for (const docSnap of snapEmail.docs) {
          if (!itemsMap.has(docSnap.id)) {
            itemsMap.set(docSnap.id, docSnap.data() as ProjectRequest);
          }
        }
      } catch (emailErr) {
        console.warn("Could not query projectRequests by email:", emailErr);
      }
    }

    // 3. Query client requests collection (Client change/project requests in blueprint)
    if (clientId) {
      try {
        const qReq = query(collection(db, "requests"), where("clientId", "==", clientId));
        const snapReq = await getDocs(qReq);
        for (const docSnap of snapReq.docs) {
          const d = docSnap.data();
          if (!itemsMap.has(docSnap.id)) {
            itemsMap.set(docSnap.id, {
              id: docSnap.id,
              name: d.title || "Project Request",
              businessName: d.title || "Project Request",
              serviceRequired:
                (d.priority ? `${d.priority.toUpperCase()} Priority` : "") || "Project Engagement",
              projectDescription:
                d.details || d.description || "Project request submitted via client portal.",
              status: d.status || "Submitted",
              createdAt: d.createdAt || new Date().toISOString(),
              email: email || "",
              clientId: clientId,
            } as ProjectRequest);
          }
        }
      } catch (reqErr) {
        console.warn("Could not query requests by clientId:", reqErr);
      }
    }

    const list = Array.from(itemsMap.values());
    // Sort in-memory to prevent missing composite index requirements
    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "projectRequests");
  }
}

/**
 * Retrieves active and completed projects belonging strictly to this client.
 */
export async function fetchClientProjects(clientId: string): Promise<Project[]> {
  if (!clientId) return [];
  try {
    const q = query(collection(db, "projects"), where("clientId", "==", clientId));
    const snap = await getDocs(q);
    const list = snap.docs.map((docSnap) => docSnap.data() as Project);
    list.sort((a, b) => {
      const timeA = (a as { createdAt?: string }).createdAt
        ? new Date((a as { createdAt?: string }).createdAt!).getTime()
        : 0;
      const timeB = (b as { createdAt?: string }).createdAt
        ? new Date((b as { createdAt?: string }).createdAt!).getTime()
        : 0;
      return timeB - timeA;
    });
    return list;
  } catch (error) {
    console.warn("Client projects fetch notice:", error);
    return [];
  }
}

/**
 * Retrieves formal proposals submitted for this client.
 */
export async function fetchClientProposals(clientId: string): Promise<Proposal[]> {
  if (!clientId) return [];
  try {
    const q = query(collection(db, "proposals"), where("clientId", "==", clientId));
    const snap = await getDocs(q);
    const list = snap.docs.map((docSnap) => docSnap.data() as Proposal);
    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    return list;
  } catch (error) {
    console.warn("Client proposals fetch notice:", error);
    return [];
  }
}

/**
 * Retrieves documents and project assets belonging to this client.
 */
export async function fetchClientDocuments(clientId: string): Promise<ClientDocument[]> {
  if (!clientId) return [];
  try {
    const q = query(collection(db, "documents"), where("clientId", "==", clientId));
    const snap = await getDocs(q);
    const list = snap.docs.map((docSnap) => docSnap.data() as ClientDocument);
    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    return list;
  } catch (error) {
    console.warn("Client documents fetch notice:", error);
    return [];
  }
}

/**
 * Retrieves invoices issued for this client.
 */
export async function fetchClientInvoices(clientId: string): Promise<Invoice[]> {
  if (!clientId) return [];
  try {
    const q = query(collection(db, "invoices"), where("clientId", "==", clientId));
    const snap = await getDocs(q);
    const list = snap.docs.map((docSnap) => normalizeInvoiceDoc(docSnap.id, docSnap.data()));
    list.sort((a, b) => {
      const timeA = a.issueDate ? new Date(a.issueDate).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.issueDate ? new Date(b.issueDate).getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
    return list;
  } catch (error) {
    console.warn("Client invoices fetch notice:", error);
    return [];
  }
}

/**
 * Retrieves messages authored by or directed to this client.
 */
export async function fetchClientMessages(clientId: string): Promise<Message[]> {
  if (!clientId) return [];
  try {
    const q = query(collection(db, "messages"), where("senderId", "==", clientId));
    const snap = await getDocs(q);
    const list = snap.docs.map((docSnap) => docSnap.data() as Message);
    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
    return list;
  } catch (error) {
    console.warn("Client messages fetch notice:", error);
    return [];
  }
}

/**
 * Retrieves client-facing updates, announcements, and project status notes.
 * Scoped to the authenticated client or global client announcements.
 */
export async function fetchClientUpdates(
  clientId: string,
  clientProjects: Project[] = [],
  clientRequests: ProjectRequest[] = [],
): Promise<ClientUpdateItem[]> {
  const updates: ClientUpdateItem[] = [];
  const seenIds = new Set<string>();

  // 1. Query client notifications (userId == clientId)
  if (clientId) {
    try {
      const qNotif = query(collection(db, "notifications"), where("userId", "==", clientId));
      const snapNotif = await getDocs(qNotif);
      for (const docSnap of snapNotif.docs) {
        const d = docSnap.data();
        if (!seenIds.has(docSnap.id)) {
          seenIds.add(docSnap.id);
          updates.push({
            id: docSnap.id,
            title: d.title || "Portal Notification",
            description: d.body || d.message || "",
            date: d.createdAt || new Date().toISOString(),
            category: (d.type as "status" | "announcement" | "milestone" | "note") || "status",
            projectId: d.projectId,
          });
        }
      }
    } catch (err) {
      console.warn("Could not query notifications by userId:", err);
    }
  }

  // 2. Query broadcasted project updates (visibility == 'all_clients')
  try {
    const qUpdates = query(
      collection(db, "projectUpdates"),
      where("visibility", "==", "all_clients"),
    );
    const snapUpdates = await getDocs(qUpdates);
    for (const docSnap of snapUpdates.docs) {
      const d = docSnap.data();
      if (!seenIds.has(docSnap.id) && !d.archived) {
        seenIds.add(docSnap.id);
        updates.push({
          id: docSnap.id,
          title: d.title || "VINORA Studio Update",
          description: d.content || d.description || "",
          date: d.createdAt || d.publishedAt || new Date().toISOString(),
          category:
            (d.category as "status" | "announcement" | "milestone" | "note") || "announcement",
          projectId: d.projectId,
        });
      }
    }
  } catch (err) {
    console.warn("Could not query broadcast projectUpdates:", err);
  }

  // 2b. Query project-scoped updates (visibility == 'specific_client' && projectId matches owned project)
  for (const proj of clientProjects) {
    if (!proj.id) continue;
    try {
      const qScoped = query(
        collection(db, "projectUpdates"),
        where("projectId", "==", proj.id),
        where("visibility", "==", "specific_client"),
      );
      const snapScoped = await getDocs(qScoped);
      for (const docSnap of snapScoped.docs) {
        const d = docSnap.data();
        if (!seenIds.has(docSnap.id) && !d.archived) {
          seenIds.add(docSnap.id);
          updates.push({
            id: docSnap.id,
            title: d.title || `${proj.title} Update`,
            description: d.content || d.description || "",
            date: d.createdAt || d.publishedAt || new Date().toISOString(),
            category:
              (d.category as "status" | "announcement" | "milestone" | "note") || "milestone",
            projectId: d.projectId || proj.id,
            projectName: proj.title,
          });
        }
      }
    } catch (err) {
      console.warn(`Could not query project-specific updates for ${proj.id}:`, err);
    }
  }

  // 3. Generate milestone and lifecycle updates from client's active projects & requests
  for (const proj of clientProjects) {
    const projUpdateId = `proj-update-${proj.id}`;
    if (!seenIds.has(projUpdateId)) {
      seenIds.add(projUpdateId);
      updates.push({
        id: projUpdateId,
        title: `${proj.title} — Active Development`,
        description: `Project is currently in ${proj.status.replace(/_/g, " ")} phase with ${proj.progress || 0}% milestone progress completed.`,
        date: proj.updatedAt || proj.startedAt || proj.createdAt || new Date().toISOString(),
        category: "status",
        projectId: proj.id,
        projectName: proj.title,
      });
    }
  }

  for (const req of clientRequests) {
    const reqUpdateId = `req-update-${req.id}`;
    if (!seenIds.has(reqUpdateId)) {
      seenIds.add(reqUpdateId);
      const reqName = req.businessName || req.name || "Project Request";
      const statusTitle =
        req.status === "Approved"
          ? "Proposal & Scope Approved"
          : req.status === "Completed"
            ? "Deliverables Finalized"
            : "Inquiry Queued for Engineering Review";
      updates.push({
        id: reqUpdateId,
        title: `${reqName}: ${statusTitle}`,
        description: `Ref ID ${req.id} • Current status: ${req.status || "Pending Review"}. Technical lead assigned for architectural scoping.`,
        date: req.updatedAt || req.createdAt || new Date().toISOString(),
        category: req.status === "Approved" ? "milestone" : "status",
        projectId: req.id,
        projectName: reqName,
      });
    }
  }

  // Sort updates newest first
  updates.sort((a, b) => {
    const timeA = a.date ? new Date(a.date).getTime() : 0;
    const timeB = b.date ? new Date(b.date).getTime() : 0;
    return timeB - timeA;
  });

  return updates;
}

/**
 * Aggregates all client dashboard records in parallel with isolated resilience.
 */
export async function fetchClientDashboardData(
  clientId: string,
  email?: string | null,
): Promise<ClientDashboardData> {
  const [requestsRes, projectsRes, proposalsRes, docsRes, invoicesRes, messagesRes] =
    await Promise.allSettled([
      fetchClientProjectRequests(clientId, email),
      fetchClientProjects(clientId),
      fetchClientProposals(clientId),
      fetchClientDocuments(clientId),
      fetchClientInvoices(clientId),
      fetchClientMessages(clientId),
    ]);

  const projectRequests = requestsRes.status === "fulfilled" ? requestsRes.value : [];
  const projects = projectsRes.status === "fulfilled" ? projectsRes.value : [];
  const proposals = proposalsRes.status === "fulfilled" ? proposalsRes.value : [];
  const documents = docsRes.status === "fulfilled" ? docsRes.value : [];
  const invoices = invoicesRes.status === "fulfilled" ? invoicesRes.value : [];
  const messages = messagesRes.status === "fulfilled" ? messagesRes.value : [];

  const updates = await fetchClientUpdates(clientId, projects, projectRequests);

  return {
    projectRequests,
    projects,
    proposals,
    documents,
    invoices,
    messages,
    updates,
  };
}
