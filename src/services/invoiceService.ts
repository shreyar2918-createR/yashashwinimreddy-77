import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { Invoice, InvoiceLineItem, InvoiceStatus, CanonicalInvoiceStatus } from "@/lib/types";

async function getInvoiceAuthHeader(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Authentication required to manage invoices.");
  }
  const token = await currentUser.getIdToken();
  return `Bearer ${token}`;
}

export interface CreateInvoiceInput {
  invoiceNumber: string;
  clientId: string; // Target client UID
  clientUid?: string;
  clientName?: string;
  clientEmail?: string;
  projectId?: string;
  projectName?: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  lineItems: InvoiceLineItem[];
  subtotal?: number;
  taxRate?: number; // e.g. 18 for 18%
  tax?: number;
  discount?: number;
  totalAmount?: number;
  amountPaid?: number;
  balanceDue?: number;
  currency: string;
  status?: InvoiceStatus;
  notes?: string;
  terms?: string;
  createdByAdminUid: string;
  createdByAdminName?: string;
  createdByAdminEmail?: string;
}

export interface UpdateInvoiceInput {
  invoiceId: string;
  invoiceNumber?: string;
  projectId?: string;
  projectName?: string;
  issueDate?: string;
  dueDate?: string;
  lineItems?: InvoiceLineItem[];
  subtotal?: number;
  taxRate?: number;
  tax?: number;
  discount?: number;
  totalAmount?: number;
  amountPaid?: number;
  balanceDue?: number;
  currency?: string;
  status?: InvoiceStatus;
  notes?: string;
  terms?: string;
  updatedByAdminName?: string;
}

export interface CancelInvoiceInput {
  invoiceId: string;
  cancellationReason: string;
  cancelledBy: string; // admin name or email
}

export interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  paidAt?: string;
  updatedByAdminName: string;
}

/**
 * Normalizes any raw status string into canonical form:
 * Draft | Sent | Partially Paid | Paid | Overdue | Cancelled
 */
export function normalizeInvoiceStatus(
  rawStatus?: string,
  dueDate?: string,
  amountPaid = 0,
  totalAmount = 0,
): CanonicalInvoiceStatus {
  if (!rawStatus) return "Draft";
  const s = rawStatus.toLowerCase().trim();

  if (s === "cancelled" || s === "canceled") return "Cancelled";
  if (s === "paid") return "Paid";
  if (s === "partially paid" || s === "partially_paid" || s === "partial") return "Partially Paid";
  if (s === "draft") return "Draft";

  // Check if paid in full
  if (totalAmount > 0 && amountPaid >= totalAmount) {
    return "Paid";
  }
  if (amountPaid > 0 && amountPaid < totalAmount) {
    return "Partially Paid";
  }

  // Check overdue if past due date and not cancelled/paid
  if (dueDate) {
    try {
      const due = new Date(dueDate).getTime();
      const now = new Date().setHours(0, 0, 0, 0);
      if (!isNaN(due) && due < now) {
        return "Overdue";
      }
    } catch {
      // ignore
    }
  }

  if (s === "overdue") return "Overdue";
  if (s === "sent" || s === "issued") return "Sent";

  return "Draft";
}

/**
 * Normalizes Firestore invoice document data into strongly-typed Invoice object
 */
export function normalizeInvoiceDoc(id: string, data: Record<string, unknown>): Invoice {
  const lineItemsRaw = Array.isArray(data.lineItems) ? data.lineItems : [];
  const lineItems: InvoiceLineItem[] = lineItemsRaw.map((item, idx) => {
    const raw = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    const qty = typeof raw.quantity === "number" ? Math.max(1, raw.quantity) : 1;
    const price =
      typeof raw.unitPrice === "number"
        ? Math.max(0, raw.unitPrice)
        : typeof raw.amount === "number"
          ? Math.max(0, raw.amount)
          : 0;
    const lineAmount = typeof raw.amount === "number" && raw.amount > 0 ? raw.amount : qty * price;
    return {
      id: typeof raw.id === "string" ? raw.id : `item-${idx + 1}`,
      description:
        typeof raw.description === "string" && raw.description.trim()
          ? raw.description
          : `Line item ${idx + 1}`,
      quantity: qty,
      unitPrice: price,
      amount: lineAmount,
    };
  });

  const clientId = typeof data.clientId === "string" ? data.clientId : "";
  const clientUid = typeof data.clientUid === "string" ? data.clientUid : clientId;

  const rawSubtotal =
    typeof data.subtotal === "number"
      ? data.subtotal
      : lineItems.reduce((acc, it) => acc + it.amount, 0);
  const taxRate = typeof data.taxRate === "number" ? data.taxRate : 0;
  const tax =
    typeof data.tax === "number"
      ? data.tax
      : typeof data.taxAmount === "number"
        ? data.taxAmount
        : (rawSubtotal * taxRate) / 100;
  const discount = typeof data.discount === "number" ? Math.max(0, data.discount) : 0;

  const calculatedTotal = Math.max(0, rawSubtotal + tax - discount);
  const totalAmount =
    typeof data.totalAmount === "number"
      ? data.totalAmount
      : typeof data.total === "number"
        ? data.total
        : calculatedTotal;
  const amountPaid = typeof data.amountPaid === "number" ? data.amountPaid : 0;
  const balanceDue =
    typeof data.balanceDue === "number" ? data.balanceDue : Math.max(0, totalAmount - amountPaid);

  const issueDateStr =
    typeof data.issueDate === "string"
      ? data.issueDate
      : typeof data.issuedAt === "string"
        ? data.issuedAt.split("T")[0]
        : new Date().toISOString().split("T")[0];
  const dueDateStr =
    typeof data.dueDate === "string"
      ? data.dueDate
      : typeof data.dueAt === "string"
        ? data.dueAt.split("T")[0]
        : "";

  const rawStatus = typeof data.status === "string" ? data.status : "Draft";
  const canonicalStatus = normalizeInvoiceStatus(rawStatus, dueDateStr, amountPaid, totalAmount);

  const invoiceNumber =
    typeof data.invoiceNumber === "string" && data.invoiceNumber
      ? data.invoiceNumber
      : typeof data.number === "string" && data.number
        ? data.number
        : `INV-${id.slice(0, 6).toUpperCase()}`;

  return {
    id,
    invoiceNumber,
    number: invoiceNumber,
    clientId,
    clientUid,
    clientName: typeof data.clientName === "string" ? data.clientName : undefined,
    clientEmail: typeof data.clientEmail === "string" ? data.clientEmail : undefined,
    projectId: typeof data.projectId === "string" ? data.projectId : undefined,
    projectName: typeof data.projectName === "string" ? data.projectName : undefined,
    issueDate: issueDateStr,
    dueDate: dueDateStr,
    lineItems,
    subtotal: rawSubtotal,
    taxRate,
    tax,
    taxAmount: tax,
    discount,
    totalAmount,
    total: totalAmount,
    amountPaid,
    balanceDue,
    currency: typeof data.currency === "string" ? data.currency.toUpperCase() : "USD",
    status: canonicalStatus,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    terms: typeof data.terms === "string" ? data.terms : undefined,
    issuedAt: typeof data.issuedAt === "string" ? data.issuedAt : issueDateStr,
    dueAt: typeof data.dueAt === "string" ? data.dueAt : dueDateStr,
    sentAt: typeof data.sentAt === "string" ? data.sentAt : undefined,
    paidAt: typeof data.paidAt === "string" ? data.paidAt : undefined,
    cancelledAt: typeof data.cancelledAt === "string" ? data.cancelledAt : undefined,
    cancelledBy: typeof data.cancelledBy === "string" ? data.cancelledBy : undefined,
    cancellationReason:
      typeof data.cancellationReason === "string" ? data.cancellationReason : undefined,
    createdByAdminUid:
      typeof data.createdByAdminUid === "string" ? data.createdByAdminUid : undefined,
    createdByAdminName:
      typeof data.createdByAdminName === "string" ? data.createdByAdminName : undefined,
    createdByAdminEmail:
      typeof data.createdByAdminEmail === "string" ? data.createdByAdminEmail : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    documentPath: typeof data.documentPath === "string" ? data.documentPath : undefined,
  };
}

/**
 * Real-time subscription to all invoices for authorized VINORA administrators.
 */
export function subscribeAllInvoices(
  onUpdate: (invoices: Invoice[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const colRef = collection(db, "invoices");

  return onSnapshot(
    colRef,
    (snap) => {
      const list: Invoice[] = snap.docs.map((docSnap) =>
        normalizeInvoiceDoc(docSnap.id, docSnap.data()),
      );

      // Sort descending by issueDate or createdAt
      list.sort((a, b) => {
        const timeA = a.issueDate
          ? new Date(a.issueDate).getTime()
          : new Date(a.createdAt).getTime();
        const timeB = b.issueDate
          ? new Date(b.issueDate).getTime()
          : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });

      onUpdate(list);
    },
    (err) => {
      console.error("[VINORA Invoice Service] Snapshot error (admin all):", err);
      if (onError) onError(err);
    },
  );
}

/**
 * Real-time subscription to invoices belonging strictly to the authenticated client.
 */
export function subscribeClientInvoices(
  clientUid: string,
  onUpdate: (invoices: Invoice[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  if (!clientUid) {
    onUpdate([]);
    return () => {};
  }

  // Subscribe query where clientId == clientUid (rules allow resource.data.clientId == request.auth.uid)
  const q = query(collection(db, "invoices"), where("clientId", "==", clientUid));

  return onSnapshot(
    q,
    (snap) => {
      const list: Invoice[] = snap.docs.map((docSnap) =>
        normalizeInvoiceDoc(docSnap.id, docSnap.data()),
      );

      // Sort descending by issueDate or createdAt
      list.sort((a, b) => {
        const timeA = a.issueDate
          ? new Date(a.issueDate).getTime()
          : new Date(a.createdAt).getTime();
        const timeB = b.issueDate
          ? new Date(b.issueDate).getTime()
          : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });

      onUpdate(list);
    },
    (err) => {
      console.error("[VINORA Invoice Service] Client subscription error:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * Validates invoice line items and calculated totals.
 */
export function calculateInvoiceTotals(
  lineItems: InvoiceLineItem[],
  taxRate = 0,
  discount = 0,
  amountPaid = 0,
) {
  const subtotal = lineItems.reduce((acc, item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const price = Math.max(0, Number(item.unitPrice) || 0);
    return acc + qty * price;
  }, 0);

  const safeTaxRate = Math.max(0, Number(taxRate) || 0);
  const tax = Number(((subtotal * safeTaxRate) / 100).toFixed(2));
  const safeDiscount = Math.max(0, Number(discount) || 0);
  const totalAmount = Math.max(0, Number((subtotal + tax - safeDiscount).toFixed(2)));
  const safePaid = Math.max(0, Number(amountPaid) || 0);
  const balanceDue = Math.max(0, Number((totalAmount - safePaid).toFixed(2)));

  return {
    subtotal,
    tax,
    taxRate: safeTaxRate,
    discount: safeDiscount,
    totalAmount,
    amountPaid: safePaid,
    balanceDue,
  };
}

/**
 * Generates an auto-incrementing/timestamped invoice number, e.g. VIN-2026-0042
 */
export async function generateNextInvoiceNumber(): Promise<string> {
  const currentYear = new Date().getFullYear();
  try {
    const snap = await getDocs(collection(db, "invoices"));
    const count = snap.size + 1;
    const padded = String(count).padStart(4, "0");
    return `VIN-${currentYear}-${padded}`;
  } catch {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `VIN-${currentYear}-${randomSuffix}`;
  }
}

/**
 * Creates a brand new invoice via backend API (calculates totals & notifies client).
 */
export async function createInvoice(input: CreateInvoiceInput): Promise<string> {
  if (!input.clientId || !input.clientId.trim()) {
    throw new Error("Target client account is required.");
  }
  if (!input.invoiceNumber || !input.invoiceNumber.trim()) {
    throw new Error("Invoice number is required.");
  }
  if (!input.lineItems || input.lineItems.length === 0) {
    throw new Error("At least one line item is required.");
  }

  for (const item of input.lineItems) {
    if ((item.quantity ?? 0) <= 0) {
      throw new Error(`Quantity for line item "${item.description}" must be greater than zero.`);
    }
    if ((item.unitPrice ?? 0) < 0) {
      throw new Error(`Unit price for line item "${item.description}" cannot be negative.`);
    }
  }

  const authHeader = await getInvoiceAuthHeader();
  const res = await fetch("/api/invoices", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      invoiceNumber: input.invoiceNumber.trim(),
      clientId: input.clientId.trim(),
      clientUid: input.clientUid?.trim() || input.clientId.trim(),
      clientName: input.clientName?.trim(),
      clientEmail: input.clientEmail?.trim(),
      projectId: input.projectId?.trim(),
      projectName: input.projectName?.trim(),
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      lineItems: input.lineItems.map((li, idx) => ({
        id: li.id || `item-${idx + 1}`,
        description: li.description.trim(),
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
      })),
      taxRate: input.taxRate ?? 0,
      discount: input.discount ?? 0,
      currency: (input.currency || "INR").toUpperCase(),
      status: input.status || "Draft",
      notes: input.notes?.trim() || "",
      terms: input.terms?.trim(),
    }),
  });

  const json = (await res.json()) as {
    success: boolean;
    data?: { invoice: { id: string } };
    error?: { message: string };
  };

  if (!res.ok || !json.success || !json.data?.invoice?.id) {
    throw new Error(json.error?.message || "Failed to create invoice.");
  }

  return json.data.invoice.id;
}

/**
 * Updates an existing draft or editable invoice via backend API.
 */
export async function updateInvoice(input: UpdateInvoiceInput): Promise<void> {
  if (!input.invoiceId) {
    throw new Error("Invoice ID is required for updating.");
  }

  if (input.lineItems) {
    for (const item of input.lineItems) {
      if ((item.quantity ?? 0) <= 0) {
        throw new Error(`Quantity for line item "${item.description}" must be greater than zero.`);
      }
      if ((item.unitPrice ?? 0) < 0) {
        throw new Error(`Unit price for line item "${item.description}" cannot be negative.`);
      }
    }
  }

  const authHeader = await getInvoiceAuthHeader();
  const res = await fetch(`/api/invoices/${encodeURIComponent(input.invoiceId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      invoiceNumber: input.invoiceNumber?.trim(),
      projectId: input.projectId,
      projectName: input.projectName,
      issueDate: input.issueDate,
      dueDate: input.dueDate,
      lineItems: input.lineItems?.map((li, idx) => ({
        id: li.id || `item-${idx + 1}`,
        description: li.description.trim(),
        quantity: Number(li.quantity),
        unitPrice: Number(li.unitPrice),
      })),
      taxRate: input.taxRate,
      discount: input.discount,
      currency: input.currency?.toUpperCase(),
      status: input.status,
      notes: input.notes,
      terms: input.terms,
    }),
  });

  const json = (await res.json()) as {
    success: boolean;
    error?: { message: string };
  };

  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to update invoice.");
  }
}

/**
 * Changes status to "Sent" and triggers client notification & email.
 */
export async function sendInvoice(invoiceId: string, _adminName: string): Promise<void> {
  const authHeader = await getInvoiceAuthHeader();
  const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
  });
  const json = (await res.json()) as { success: boolean; error?: { message: string } };
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to send invoice.");
  }
}

/**
 * Records manual/wire payment against an invoice via atomic backend transaction & generates receipt.
 */
export async function recordInvoicePayment(
  invoice: Invoice,
  paymentAmount: number,
  _adminName: string,
): Promise<void> {
  if (paymentAmount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const authHeader = await getInvoiceAuthHeader();
  const res = await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}/record-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      amount: paymentAmount,
      paymentMethod: "manual_wire",
    }),
  });

  const json = (await res.json()) as { success: boolean; error?: { message: string } };
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to record invoice payment.");
  }
}

/**
 * Cancels an invoice via backend API and notifies the client.
 */
export async function cancelInvoice(input: CancelInvoiceInput): Promise<void> {
  if (!input.cancellationReason || !input.cancellationReason.trim()) {
    throw new Error("A cancellation reason is required.");
  }

  const authHeader = await getInvoiceAuthHeader();
  const res = await fetch(`/api/invoices/${encodeURIComponent(input.invoiceId)}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      cancellationReason: input.cancellationReason.trim(),
    }),
  });

  const json = (await res.json()) as { success: boolean; error?: { message: string } };
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to cancel invoice.");
  }
}

/**
 * Deletes an invoice (admin only, typically draft or testing records).
 */
export async function deleteInvoice(invoiceId: string): Promise<void> {
  const authHeader = await getInvoiceAuthHeader();
  const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`, {
    method: "DELETE",
    headers: {
      Authorization: authHeader,
    },
  });

  const json = (await res.json()) as { success: boolean; error?: { message: string } };
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message || "Failed to delete invoice.");
  }
}
