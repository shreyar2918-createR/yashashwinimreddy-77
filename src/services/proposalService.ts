import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "@/lib/firebase";
import { createUserNotification } from "@/services/notificationService";
import type {
  Proposal,
  CanonicalProposalStatus,
  ProposalStatus,
  ProposalBudgetItem,
  ProposalMilestonePlanItem,
  PaymentPlanType,
  ProposalPaymentStatus,
} from "@/lib/types";

export interface CreateProposalInput {
  clientId: string; // Target client UID
  clientName?: string;
  clientEmail?: string;
  clientCompany?: string;
  projectId?: string;
  projectName?: string;
  title: string;
  description?: string;
  scope: string; // Detailed architectural scope / description
  deliverables: string[];
  timeline?: string;
  revisions?: string;
  totalPrice: number;
  currency: string;
  advanceAmount?: number;
  validityDate: string; // YYYY-MM-DD
  terms?: string;
  notes?: string;
  createdBy: string; // Admin UID
  createdByAdminName?: string;
  createdByAdminEmail?: string;

  // Dynamic Budget Breakdown
  budgetItems?: ProposalBudgetItem[];
  subtotal?: number;
  taxRate?: number;
  tax?: number;
  discount?: number;

  // Payment Plan Selection
  paymentPlanType?: PaymentPlanType;
  milestonePlan?: ProposalMilestonePlanItem[];
  paymentStatus?: ProposalPaymentStatus;
  invoiceId?: string;
  invoiceNumber?: string;
}

export interface UpdateProposalInput {
  proposalId: string;
  clientId?: string;
  title?: string;
  description?: string;
  scope?: string;
  deliverables?: string[];
  timeline?: string;
  revisions?: string;
  totalPrice?: number;
  currency?: string;
  advanceAmount?: number;
  validityDate?: string;
  terms?: string;
  notes?: string;
  updatedByAdminName: string;

  // Dynamic Budget Breakdown
  budgetItems?: ProposalBudgetItem[];
  subtotal?: number;
  taxRate?: number;
  tax?: number;
  discount?: number;

  // Payment Plan Selection
  paymentPlanType?: PaymentPlanType;
  milestonePlan?: ProposalMilestonePlanItem[];
  paymentStatus?: ProposalPaymentStatus;
  invoiceId?: string;
  invoiceNumber?: string;
}

export interface WithdrawProposalInput {
  proposalId: string;
  withdrawnReason: string;
  adminName: string;
}

export interface RespondProposalInput {
  proposalId: string;
  clientUid: string;
  decision: "Accepted" | "Rejected";
  feedback?: string;
}

/**
 * Normalizes raw Firestore document snapshot data into a strictly-typed Proposal.
 */
export function parseProposalDoc(id: string, data: Record<string, unknown>): Proposal {
  let status: CanonicalProposalStatus = "Pending";
  const rawStatus = (typeof data.status === "string" ? data.status : "").toLowerCase().trim();

  if (rawStatus === "accepted") {
    status = "Accepted";
  } else if (rawStatus === "rejected") {
    status = "Rejected";
  } else if (rawStatus === "expired") {
    status = "Expired";
  } else if (rawStatus === "withdrawn") {
    status = "Withdrawn";
  } else if (rawStatus === "draft") {
    status = "Draft";
  } else {
    status = "Pending";
  }

  // Check automated expiration if validityDate is passed and still pending
  const validityDateStr = typeof data.validityDate === "string" ? data.validityDate : undefined;
  if (status === "Pending" && validityDateStr) {
    try {
      const expDate = new Date(`${validityDateStr}T23:59:59Z`);
      if (!isNaN(expDate.getTime()) && Date.now() > expDate.getTime()) {
        status = "Expired";
      }
    } catch {
      // Keep existing status
    }
  }

  // Parse deliverables list safely
  let deliverables: string[] = [];
  if (Array.isArray(data.deliverables)) {
    deliverables = data.deliverables.map((item) => String(item).trim()).filter(Boolean);
  } else if (typeof data.deliverables === "string") {
    deliverables = data.deliverables
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);
  }

  const clientId = typeof data.clientId === "string" ? data.clientId : "";
  const clientUid = typeof data.clientUid === "string" ? data.clientUid : clientId;

  const totalPrice = typeof data.totalPrice === "number" ? data.totalPrice : 0;
  const advanceAmount =
    typeof data.advanceAmount === "number" ? data.advanceAmount : Math.round(totalPrice * 0.5);

  // Parse budget items safely
  let budgetItems: ProposalBudgetItem[] = [];
  if (Array.isArray(data.budgetItems)) {
    budgetItems = data.budgetItems
      .map((item, idx) => {
        if (typeof item === "object" && item !== null) {
          const raw = item as Record<string, unknown>;
          return {
            id: typeof raw.id === "string" ? raw.id : `bgt-${idx + 1}`,
            description: typeof raw.description === "string" ? raw.description : "",
            amount: typeof raw.amount === "number" ? Math.max(0, raw.amount) : 0,
          };
        }
        return null;
      })
      .filter((b): b is ProposalBudgetItem => Boolean(b && b.description.trim()));
  }

  // Parse milestone plan safely
  let milestonePlan: ProposalMilestonePlanItem[] = [];
  if (Array.isArray(data.milestonePlan)) {
    milestonePlan = data.milestonePlan
      .map((item, idx) => {
        if (typeof item === "object" && item !== null) {
          const raw = item as Record<string, unknown>;
          return {
            id: typeof raw.id === "string" ? raw.id : `ms-${idx + 1}`,
            name: typeof raw.name === "string" ? raw.name : `Milestone ${idx + 1}`,
            percentage: typeof raw.percentage === "number" ? raw.percentage : undefined,
            amount: typeof raw.amount === "number" ? Math.max(0, raw.amount) : 0,
            dueTrigger: typeof raw.dueTrigger === "string" ? raw.dueTrigger : undefined,
            status: (typeof raw.status === "string" ? raw.status : "Pending") as
              "Pending" | "Paid" | "In Progress" | "Completed",
            invoiceId: typeof raw.invoiceId === "string" ? raw.invoiceId : undefined,
            paidAt: typeof raw.paidAt === "string" ? raw.paidAt : undefined,
          };
        }
        return null;
      })
      .filter((m): m is ProposalMilestonePlanItem => Boolean(m && m.name.trim()));
  }

  let paymentStatus: ProposalPaymentStatus = "Unpaid";
  const rawPayStatus = (typeof data.paymentStatus === "string" ? data.paymentStatus : "")
    .toLowerCase()
    .trim();
  if (rawPayStatus === "fully paid" || rawPayStatus === "paid") {
    paymentStatus = "Fully Paid";
  } else if (rawPayStatus === "advance paid" || rawPayStatus === "advance_paid") {
    paymentStatus = "Advance Paid";
  } else if (rawPayStatus === "partially paid" || rawPayStatus === "partially_paid") {
    paymentStatus = "Partially Paid";
  }

  const paymentPlanType: PaymentPlanType =
    data.paymentPlanType === "full" || data.paymentPlanType === "milestone"
      ? data.paymentPlanType
      : milestonePlan.length > 0
        ? "milestone"
        : "full";

  return {
    id,
    clientId,
    clientUid,
    clientName: typeof data.clientName === "string" ? data.clientName : undefined,
    clientEmail: typeof data.clientEmail === "string" ? data.clientEmail : undefined,
    clientCompany: typeof data.clientCompany === "string" ? data.clientCompany : undefined,
    projectId: typeof data.projectId === "string" ? data.projectId : undefined,
    projectName:
      typeof data.projectName === "string"
        ? data.projectName
        : typeof data.projectTitle === "string"
          ? data.projectTitle
          : undefined,
    projectTitle:
      typeof data.projectTitle === "string"
        ? data.projectTitle
        : typeof data.projectName === "string"
          ? data.projectName
          : undefined,
    title:
      typeof data.title === "string"
        ? data.title
        : typeof data.projectName === "string"
          ? `${data.projectName} Architectural Proposal`
          : "Commercial & Architectural Proposal",
    description: typeof data.description === "string" ? data.description : undefined,
    scope:
      typeof data.scope === "string"
        ? data.scope
        : typeof data.description === "string"
          ? data.description
          : "",
    deliverables,
    timeline:
      typeof data.timeline === "string" ? data.timeline : "Standard 6-8 week sprint delivery",
    revisions:
      typeof data.revisions === "string"
        ? data.revisions
        : "Up to 3 architecture review iterations per sprint milestone.",
    totalPrice,
    currency: typeof data.currency === "string" ? data.currency.toUpperCase() : "USD",
    advanceAmount,
    remainingAmount:
      typeof data.remainingAmount === "number"
        ? data.remainingAmount
        : Math.max(0, totalPrice - advanceAmount),
    validityDate: validityDateStr,
    terms:
      typeof data.terms === "string"
        ? data.terms
        : "Standard VINORA IP transfer on final payment milestone. Dedicated lead architect oversight.",
    notes: typeof data.notes === "string" ? data.notes : undefined,
    status,
    createdBy: typeof data.createdBy === "string" ? data.createdBy : "",
    createdByAdminName:
      typeof data.createdByAdminName === "string"
        ? data.createdByAdminName
        : "VINORA Lead Architect",
    createdByAdminEmail:
      typeof data.createdByAdminEmail === "string" ? data.createdByAdminEmail : undefined,
    clientResponse: typeof data.clientResponse === "string" ? data.clientResponse : undefined,
    responseAt: typeof data.responseAt === "string" ? data.responseAt : undefined,
    withdrawnAt: typeof data.withdrawnAt === "string" ? data.withdrawnAt : undefined,
    withdrawnBy: typeof data.withdrawnBy === "string" ? data.withdrawnBy : undefined,
    withdrawnReason: typeof data.withdrawnReason === "string" ? data.withdrawnReason : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),

    // Dynamic Budget Breakdown
    budgetItems: budgetItems.length > 0 ? budgetItems : undefined,
    subtotal: typeof data.subtotal === "number" ? data.subtotal : totalPrice,
    taxRate: typeof data.taxRate === "number" ? data.taxRate : undefined,
    tax: typeof data.tax === "number" ? data.tax : undefined,
    discount: typeof data.discount === "number" ? data.discount : undefined,

    // Payment Plan
    paymentPlanType,
    milestonePlan: milestonePlan.length > 0 ? milestonePlan : undefined,
    paymentStatus,
    invoiceId: typeof data.invoiceId === "string" ? data.invoiceId : undefined,
    invoiceNumber: typeof data.invoiceNumber === "string" ? data.invoiceNumber : undefined,
  };
}

/**
 * Creates and submits a new proposal to the dedicated Firestore collection.
 * Restricted to verified VINORA admins.
 */
export async function createProposal(input: CreateProposalInput): Promise<Proposal> {
  if (!input.clientId) {
    throw new Error("Target Client UID is required.");
  }
  if (!input.title?.trim()) {
    throw new Error("Proposal title is required.");
  }
  if (!input.scope?.trim()) {
    throw new Error("Scope / architectural description is required.");
  }
  if (input.totalPrice <= 0) {
    throw new Error("Total price must be greater than zero.");
  }
  if (!input.validityDate) {
    throw new Error("Proposal validity date is required.");
  }

  const now = new Date().toISOString();
  const proposalsCol = collection(db, "proposals");
  const newRef = doc(proposalsCol);
  const proposalId = newRef.id;

  const advanceAmount =
    input.advanceAmount !== undefined ? input.advanceAmount : Math.round(input.totalPrice * 0.5);
  const remainingAmount = Math.max(0, input.totalPrice - advanceAmount);

  const payload: Proposal = {
    id: proposalId,
    clientId: input.clientId,
    clientUid: input.clientId,
    clientName: input.clientName || undefined,
    clientEmail: input.clientEmail || undefined,
    clientCompany: input.clientCompany || undefined,
    projectId: input.projectId || undefined,
    projectName: input.projectName || undefined,
    projectTitle: input.projectName || undefined,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    scope: input.scope.trim(),
    deliverables: input.deliverables || [],
    timeline: input.timeline?.trim() || "Standard 6-8 week sprint schedule",
    revisions:
      input.revisions?.trim() || "Up to 3 architecture review iterations per sprint milestone.",
    totalPrice: input.totalPrice,
    currency: input.currency || "USD",
    advanceAmount,
    remainingAmount,
    validityDate: input.validityDate,
    terms:
      input.terms?.trim() ||
      "Standard VINORA intellectual property transfer upon final milestone settlement. 30 days post-launch warranty.",
    notes: input.notes?.trim() || undefined,
    status: "Pending",
    createdBy: input.createdBy,
    createdByAdminName: input.createdByAdminName || "VINORA Lead Architect",
    createdByAdminEmail: input.createdByAdminEmail || "",
    createdAt: now,
    updatedAt: now,

    // Dynamic Budget Breakdown
    budgetItems: input.budgetItems || [],
    subtotal: input.subtotal !== undefined ? input.subtotal : input.totalPrice,
    taxRate: input.taxRate !== undefined ? input.taxRate : 0,
    tax: input.tax !== undefined ? input.tax : 0,
    discount: input.discount !== undefined ? input.discount : 0,

    // Payment Plan
    paymentPlanType: input.paymentPlanType || "full",
    milestonePlan: input.milestonePlan || [],
    paymentStatus: input.paymentStatus || "Unpaid",
    invoiceId: input.invoiceId || undefined,
    invoiceNumber: input.invoiceNumber || undefined,
  };

  try {
    await setDoc(newRef, payload);
    void createUserNotification({
      userId: input.clientId,
      title: `New Proposal Ready: ${payload.title}`,
      body: `${payload.projectName ? `${payload.projectName} — ` : ""}${payload.currency} ${payload.totalPrice.toLocaleString()} proposal awaiting your review.`,
      type: "proposal_created",
      link: `/client?section=proposals`,
      projectId: payload.projectId,
    });
    return payload;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `proposals/${proposalId}`);
    throw err;
  }
}

/**
 * Updates an existing proposal. Admin only.
 */
export async function updateProposal(input: UpdateProposalInput): Promise<void> {
  const now = new Date().toISOString();
  const ref = doc(db, "proposals", input.proposalId);

  const updates: Record<string, unknown> = {
    updatedAt: now,
  };

  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description.trim();
  if (input.scope !== undefined) updates.scope = input.scope.trim();
  if (input.deliverables !== undefined) updates.deliverables = input.deliverables;
  if (input.timeline !== undefined) updates.timeline = input.timeline.trim();
  if (input.revisions !== undefined) updates.revisions = input.revisions.trim();
  if (input.totalPrice !== undefined) {
    updates.totalPrice = input.totalPrice;
    if (input.advanceAmount !== undefined) {
      updates.advanceAmount = input.advanceAmount;
      updates.remainingAmount = Math.max(0, input.totalPrice - input.advanceAmount);
    }
  }
  if (input.currency !== undefined) updates.currency = input.currency.toUpperCase();
  if (input.validityDate !== undefined) updates.validityDate = input.validityDate;
  if (input.terms !== undefined) updates.terms = input.terms.trim();
  if (input.notes !== undefined) updates.notes = input.notes.trim();

  // Dynamic budget updates
  if (input.budgetItems !== undefined) updates.budgetItems = input.budgetItems;
  if (input.subtotal !== undefined) updates.subtotal = input.subtotal;
  if (input.taxRate !== undefined) updates.taxRate = input.taxRate;
  if (input.tax !== undefined) updates.tax = input.tax;
  if (input.discount !== undefined) updates.discount = input.discount;

  // Payment plan updates
  if (input.paymentPlanType !== undefined) updates.paymentPlanType = input.paymentPlanType;
  if (input.milestonePlan !== undefined) updates.milestonePlan = input.milestonePlan;
  if (input.paymentStatus !== undefined) updates.paymentStatus = input.paymentStatus;
  if (input.invoiceId !== undefined) updates.invoiceId = input.invoiceId;
  if (input.invoiceNumber !== undefined) updates.invoiceNumber = input.invoiceNumber;

  try {
    await updateDoc(ref, updates);
    if (input.clientId) {
      void createUserNotification({
        userId: input.clientId,
        title: `Proposal Updated: ${input.title || "Commercial Scope"}`,
        body: `Your proposal details${typeof input.totalPrice === "number" ? ` (${input.currency || "USD"} ${input.totalPrice.toLocaleString()})` : ""} have been updated for review.`,
        type: "proposal_updated",
        link: `/client?section=proposals`,
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `proposals/${input.proposalId}`);
    throw err;
  }
}

/**
 * Admin action: Withdraws an open proposal.
 */
export async function withdrawProposal(input: WithdrawProposalInput): Promise<void> {
  const now = new Date().toISOString();
  const ref = doc(db, "proposals", input.proposalId);

  const updates: Record<string, unknown> = {
    status: "Withdrawn",
    withdrawnAt: now,
    withdrawnBy: input.adminName,
    withdrawnReason: input.withdrawnReason.trim() || "Withdrawn by VINORA studio leadership.",
    updatedAt: now,
  };

  try {
    await updateDoc(ref, updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `proposals/${input.proposalId}`);
    throw err;
  }
}

/**
 * Client action: Accepts or rejects a proposal.
 * Strictly limited by security rules to the authenticated client UID.
 * Only the status, response, responseAt, and updatedAt fields can be touched.
 */
export async function respondToProposal(input: RespondProposalInput): Promise<void> {
  if (!input.clientUid) {
    throw new Error("Client identity is required to respond to a proposal.");
  }
  if (!input.decision || (input.decision !== "Accepted" && input.decision !== "Rejected")) {
    throw new Error("Please select either Accept or Reject.");
  }

  const now = new Date().toISOString();
  const ref = doc(db, "proposals", input.proposalId);

  const updates: Record<string, unknown> = {
    status: input.decision,
    clientResponse:
      input.feedback?.trim() ||
      (input.decision === "Accepted" ? "Accepted by client" : "Declined by client"),
    responseAt: now,
    updatedAt: now,
  };

  try {
    await updateDoc(ref, updates);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `proposals/${input.proposalId}`);
    throw err;
  }
}

/**
 * Admin action: Deletes a proposal.
 */
export async function deleteProposal(proposalId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "proposals", proposalId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `proposals/${proposalId}`);
    throw err;
  }
}

/**
 * Real-time subscription to proposals for an authenticated client.
 * Enforces strict client data isolation.
 */
export function subscribeClientProposals(
  clientId: string,
  onData: (proposals: Proposal[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  if (!clientId) {
    onData([]);
    return () => {};
  }

  const q = query(collection(db, "proposals"), where("clientId", "==", clientId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: Proposal[] = [];
      snapshot.forEach((docSnap) => {
        list.push(parseProposalDoc(docSnap.id, docSnap.data()));
      });

      // Sort newest created first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    (err) => {
      console.error(`[VINORA Proposals] Subscription error for client ${clientId}:`, err);
      if (onError) onError(err);
    },
  );
}

/**
 * Real-time subscription to all proposals for the Admin Dashboard.
 */
export function subscribeAllProposals(
  onData: (proposals: Proposal[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const colRef = collection(db, "proposals");

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: Proposal[] = [];
      snapshot.forEach((docSnap) => {
        list.push(parseProposalDoc(docSnap.id, docSnap.data()));
      });

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    (err) => {
      console.error("[VINORA Proposals] Admin subscription error:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * Fetches all proposals once.
 */
export async function fetchAllProposals(): Promise<Proposal[]> {
  try {
    const snap = await getDocs(collection(db, "proposals"));
    const list: Proposal[] = [];
    snap.forEach((docSnap) => {
      list.push(parseProposalDoc(docSnap.id, docSnap.data()));
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "proposals");
    return [];
  }
}
