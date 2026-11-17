import {
  collection,
  doc,
  getDocs,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import type { ShowcaseProject, ProjectRequest, Project } from "@/lib/types";

/**
 * Fetches only publicly approved showcase projects from Firestore.
 * Strictly filters by showcaseApproved === true in the database query.
 * Pending, reviewing, or rejected projects are never returned.
 */
export async function fetchPublicShowcaseProjects(): Promise<ShowcaseProject[]> {
  const showcaseList: ShowcaseProject[] = [];

  // 1. Fetch approved project requests
  try {
    const qRequests = query(
      collection(db, "projectRequests"),
      where("showcaseApproved", "==", true),
    );
    const snapRequests = await getDocs(qRequests);

    for (const docSnap of snapRequests.docs) {
      const data = docSnap.data();
      // Double check in memory as defense in depth
      if (data.showcaseApproved !== true) continue;

      const title =
        data.showcaseTitle ||
        (data.businessName
          ? `${data.businessName} — ${data.serviceRequired}`
          : data.serviceRequired) ||
        data.name ||
        "Digital Solution";

      showcaseList.push({
        id: docSnap.id,
        source: "projectRequest",
        title,
        clientName:
          data.clientProfile?.companyName || data.businessName || data.name || "Enterprise Partner",
        businessName: data.businessName || undefined,
        category: data.serviceRequired || "Digital Technology",
        description:
          data.showcaseDescription ||
          data.projectDescription ||
          "Client initiative delivered by VINORA.",
        details: {
          serviceRequired: data.serviceRequired,
          budget: data.budget || undefined,
          timeline: data.expectedCompletionDate || undefined,
          deliverables: data.referenceWebsites ? [data.referenceWebsites] : undefined,
          scope: data.additionalRequirements || undefined,
        },
        imageUrl: data.imageUrl || undefined,
        status: data.status || "Approved",
        showcaseApproved: true,
        approvedAt: data.approvedAt || data.updatedAt || data.createdAt,
        approvedBy: data.approvedBy || undefined,
        createdAt: data.createdAt || new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("[Showcase] Public query for approved projectRequests returned:", err);
  }

  // 2. Fetch approved studio projects
  try {
    const qProjects = query(collection(db, "projects"), where("showcaseApproved", "==", true));
    const snapProjects = await getDocs(qProjects);

    for (const docSnap of snapProjects.docs) {
      const data = docSnap.data();
      if (data.showcaseApproved !== true) continue;

      showcaseList.push({
        id: docSnap.id,
        source: "project",
        title: data.title || "Studio Engagement",
        clientName: data.clientName || "Client Partner",
        businessName: data.clientName || undefined,
        category: "Custom Engineering",
        description: data.description || "Delivered architecture and technology engagement.",
        details: {
          timeline: data.dueAt || data.expectedCompletionDate || undefined,
          scope: data.description,
        },
        imageUrl: data.imageUrl || undefined,
        status: data.status || "Completed",
        showcaseApproved: true,
        approvedAt: data.approvedAt || data.createdAt,
        approvedBy: data.approvedBy || undefined,
        createdAt: data.createdAt || new Date().toISOString(),
      });
    }
  } catch (err) {
    console.warn("[Showcase] Public query for approved projects returned:", err);
  }

  // Sort newest approved / created first
  showcaseList.sort((a, b) => {
    const timeA = a.approvedAt ? new Date(a.approvedAt).getTime() : new Date(a.createdAt).getTime();
    const timeB = b.approvedAt ? new Date(b.approvedAt).getTime() : new Date(b.createdAt).getTime();
    return timeB - timeA;
  });

  return showcaseList;
}

/**
 * Admin: Approve a project request for the public VINORA showcase.
 * Sets showcaseApproved to true, updates status, and records admin audit trail.
 */
export async function approveProjectForShowcase(
  id: string,
  adminIdentifier: string,
  options?: {
    collectionName?: "projectRequests" | "projects";
    showcaseTitle?: string;
    showcaseDescription?: string;
    imageUrl?: string;
  },
): Promise<void> {
  const collectionName = options?.collectionName || "projectRequests";
  try {
    const docRef = doc(db, collectionName, id);
    const now = new Date().toISOString();

    const payload: Record<string, unknown> = {
      showcaseApproved: true,
      status: "Approved",
      approvedAt: now,
      approvedBy: adminIdentifier,
      rejectionReason: null,
      updatedAt: now,
    };

    if (options?.showcaseTitle?.trim()) {
      payload.showcaseTitle = options.showcaseTitle.trim();
    }
    if (options?.showcaseDescription?.trim()) {
      payload.showcaseDescription = options.showcaseDescription.trim();
    }
    if (options?.imageUrl?.trim()) {
      payload.imageUrl = options.imageUrl.trim();
    }

    await updateDoc(docRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
  }
}

/**
 * Admin: Reject or revoke a project request from the public VINORA showcase.
 * Sets showcaseApproved to false, updates status, and records reason.
 */
export async function rejectProjectFromShowcase(
  id: string,
  adminIdentifier: string,
  reason?: string,
  collectionName: "projectRequests" | "projects" = "projectRequests",
): Promise<void> {
  try {
    const docRef = doc(db, collectionName, id);
    const now = new Date().toISOString();

    await updateDoc(docRef, {
      showcaseApproved: false,
      status: "Rejected",
      approvedAt: null,
      approvedBy: adminIdentifier,
      rejectionReason: reason || "Declined for public showcase by VINORA operations",
      updatedAt: now,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${collectionName}/${id}`);
  }
}
