import { z } from "zod";
import { jsonSuccess, jsonError } from "../utils/response";
import { authenticateRequest, requireAdminAuth } from "../middleware/auth";
import { validateRequestBody } from "../middleware/validate";
import { getAdminDb } from "../config/firebase-admin";
import { COLLECTIONS } from "../services/firestore";
import { logActivity } from "../services/activity-log";
import {
  notifyClientInvoiceUpdated,
  notifyClientPaymentSucceeded,
} from "../services/notifications";

const lineItemSchema = z.object({
  id: z.string().max(64).optional(),
  description: z.string().min(1, "Line item description is required").max(400),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unitPrice: z.coerce.number().min(0, "Unit price cannot be negative"),
});

const createInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(60),
  clientId: z.string().min(1).max(128),
  clientUid: z.string().max(128).optional(),
  clientName: z.string().max(160).optional(),
  clientEmail: z.string().max(254).optional(),
  projectId: z.string().max(128).optional(),
  projectName: z.string().max(160).optional(),
  issueDate: z.string().max(40).optional(),
  dueDate: z.string().max(40).optional(),
  lineItems: z.array(lineItemSchema).min(1, "At least one line item is required"),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  discount: z.coerce.number().min(0).optional(),
  currency: z.string().min(3).max(10).default("INR"),
  status: z.enum(["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"]).optional(),
  notes: z.string().max(3000).optional(),
  terms: z.string().max(3000).optional(),
});

const updateInvoiceSchema = z.object({
  invoiceNumber: z.string().min(1).max(60).optional(),
  projectId: z.string().max(128).optional(),
  projectName: z.string().max(160).optional(),
  issueDate: z.string().max(40).optional(),
  dueDate: z.string().max(40).optional(),
  lineItems: z.array(lineItemSchema).min(1).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  discount: z.coerce.number().min(0).optional(),
  currency: z.string().min(3).max(10).optional(),
  status: z.enum(["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"]).optional(),
  notes: z.string().max(3000).optional(),
  terms: z.string().max(3000).optional(),
});

const cancelInvoiceSchema = z.object({
  cancellationReason: z.string().min(1, "Cancellation reason is required").max(1000),
});

const recordOfflinePaymentSchema = z.object({
  amount: z.coerce.number().positive("Payment amount must be greater than zero"),
  paymentMethod: z.string().max(60).optional(),
});

const ADMIN_ROLES = new Set(["super_admin", "admin", "project_manager", "content_admin"]);

function computeTotals(
  lineItems: Array<{ id?: string; description: string; quantity: number; unitPrice: number }>,
  taxRate = 0,
  discount = 0,
  amountPaid = 0,
) {
  const normalizedItems = lineItems.map((li, idx) => {
    const qty = Number(li.quantity);
    const price = Number(li.unitPrice);
    return {
      id: li.id || `item-${idx + 1}`,
      description: li.description.trim(),
      quantity: qty,
      unitPrice: price,
      amount: Number((qty * price).toFixed(2)),
    };
  });
  const subtotal = Number(normalizedItems.reduce((acc, item) => acc + item.amount, 0).toFixed(2));
  const safeTaxRate = Math.max(0, Number(taxRate) || 0);
  const tax = Number(((subtotal * safeTaxRate) / 100).toFixed(2));
  const safeDiscount = Math.max(0, Number(discount) || 0);
  const totalAmount = Math.max(0, Number((subtotal + tax - safeDiscount).toFixed(2)));
  const safePaid = Math.max(0, Number(amountPaid) || 0);
  const balanceDue = Math.max(0, Number((totalAmount - safePaid).toFixed(2)));

  return {
    lineItems: normalizedItems,
    subtotal,
    taxRate: safeTaxRate,
    tax,
    discount: safeDiscount,
    totalAmount,
    amountPaid: safePaid,
    balanceDue,
  };
}

export async function handleInvoicesRoute(request: Request, subpath: string): Promise<Response> {
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonError("Authentication required for invoices", 401, "UNAUTHORIZED");
  }

  const isAdmin = ADMIN_ROLES.has(user.role) || user.email === "shreyar2918@gmail.com";
  const method = request.method;
  const db = getAdminDb();

  // 1. GET /api/invoices (list own for client, all for admin)
  if (subpath === "/" || subpath === "") {
    if (method === "GET") {
      try {
        const snap = isAdmin
          ? await db.collection(COLLECTIONS.INVOICES).get()
          : await db.collection(COLLECTIONS.INVOICES).where("clientId", "==", user.uid).get();

        const invoices = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        invoices.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
          const tA = new Date(String(a.issueDate || a.createdAt || 0)).getTime();
          const tB = new Date(String(b.issueDate || b.createdAt || 0)).getTime();
          return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
        });
        return jsonSuccess({ invoices, count: invoices.length });
      } catch (err) {
        console.error("[Invoices Route] List error:", err);
        return jsonError("Failed to load invoices", 500, "DATABASE_ERROR");
      }
    }

    // POST /api/invoices (admin create)
    if (method === "POST") {
      const admin = await requireAdminAuth(request);
      if (!admin) {
        return jsonError("Administrative access required", 403, "FORBIDDEN");
      }

      const validated = await validateRequestBody(request, createInvoiceSchema);
      if (!validated.success || !validated.data) {
        return jsonError(
          validated.error?.message || "Invalid invoice payload",
          400,
          "INVALID_INPUT",
          validated.error?.details,
        );
      }

      const d = validated.data;
      const totals = computeTotals(d.lineItems, d.taxRate ?? 0, d.discount ?? 0, 0);
      const docRef = db.collection(COLLECTIONS.INVOICES).doc();
      const now = new Date().toISOString();
      const issueDate = d.issueDate || now.split("T")[0];
      const dueDate = d.dueDate || "";
      const currency = d.currency.toUpperCase();
      const initialStatus = d.status || "Draft";

      // Resolve client email/name if omitted
      let clientName = d.clientName?.trim() || "";
      let clientEmail = d.clientEmail?.trim() || "";
      if (!clientName || !clientEmail) {
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(d.clientId).get();
        if (userDoc.exists) {
          const u = userDoc.data() || {};
          clientName = clientName || String(u.fullName || u.name || "Valued Client");
          clientEmail = clientEmail || String(u.email || "");
        }
      }

      const payload = {
        id: docRef.id,
        invoiceNumber: d.invoiceNumber.trim(),
        number: d.invoiceNumber.trim(),
        clientId: d.clientId.trim(),
        clientUid: (d.clientUid || d.clientId).trim(),
        clientName: clientName || "Valued Client",
        clientEmail,
        projectId: d.projectId?.trim() || "",
        projectName: d.projectName?.trim() || "Custom Architecture Engagement",
        issueDate,
        dueDate,
        lineItems: totals.lineItems,
        subtotal: totals.subtotal,
        taxRate: totals.taxRate,
        tax: totals.tax,
        taxAmount: totals.tax,
        discount: totals.discount,
        totalAmount: totals.totalAmount,
        total: totals.totalAmount,
        amountPaid: 0,
        balanceDue: totals.balanceDue,
        currency,
        status: initialStatus,
        notes: d.notes?.trim() || "",
        terms:
          d.terms?.trim() ||
          "Payment is due according to project milestone agreement. Net 15 days.",
        createdByAdminUid: admin.uid,
        createdByAdminName: admin.email?.split("@")[0] || "VINORA Administration",
        createdByAdminEmail: admin.email || "",
        createdAt: now,
        updatedAt: now,
        issuedAt: `${issueDate}T00:00:00.000Z`,
        dueAt: dueDate ? `${dueDate}T23:59:59.000Z` : "",
        ...(initialStatus === "Sent" ? { sentAt: now } : {}),
      };

      await docRef.set(payload);

      await logActivity({
        actorId: admin.uid,
        actorRole: admin.role,
        action: "invoice_created",
        targetType: "invoice",
        targetId: docRef.id,
        metadata: {
          invoiceNumber: payload.invoiceNumber,
          clientId: payload.clientId,
          totalAmount: payload.totalAmount,
          currency,
        },
      });

      if (initialStatus !== "Draft") {
        await notifyClientInvoiceUpdated({
          clientUid: payload.clientId,
          clientEmail: payload.clientEmail,
          clientName: payload.clientName,
          invoiceId: docRef.id,
          invoiceNumber: payload.invoiceNumber,
          status: initialStatus,
          totalAmount: payload.totalAmount,
          balanceDue: payload.balanceDue,
          currency,
          summary: "A new invoice has been issued to your VINORA account.",
          projectId: payload.projectId,
        });
      }

      return jsonSuccess({ invoice: payload }, 201);
    }

    return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
  }

  // 2. Send invoice: POST /api/invoices/:id/send
  const sendMatch = subpath.match(/^\/([a-zA-Z0-9_-]+)\/send\/?$/);
  if (sendMatch) {
    if (method !== "POST") return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    const admin = await requireAdminAuth(request);
    if (!admin) return jsonError("Administrative access required", 403, "FORBIDDEN");

    const invoiceRef = db.collection(COLLECTIONS.INVOICES).doc(sendMatch[1]);
    const snap = await invoiceRef.get();
    if (!snap.exists) return jsonError("Invoice not found", 404, "NOT_FOUND");
    const data = snap.data() || {};
    if (data.status === "Cancelled" || data.status === "Paid") {
      return jsonError(
        `Cannot send an invoice that is already ${data.status}.`,
        400,
        "INVALID_STATE",
      );
    }

    const now = new Date().toISOString();
    await invoiceRef.update({
      status: "Sent",
      sentAt: now,
      updatedAt: now,
      sentByAdminEmail: admin.email || "",
    });

    await notifyClientInvoiceUpdated({
      clientUid: String(data.clientId || data.clientUid || ""),
      clientEmail: String(data.clientEmail || ""),
      clientName: String(data.clientName || "Client"),
      invoiceId: snap.id,
      invoiceNumber: String(data.invoiceNumber || data.number || ""),
      status: "Sent",
      totalAmount: Number(data.totalAmount ?? data.total ?? 0),
      balanceDue: Number(data.balanceDue ?? data.totalAmount ?? 0),
      currency: String(data.currency || "INR"),
      summary: "Your invoice is ready for review and online settlement.",
      projectId: String(data.projectId || ""),
    });

    return jsonSuccess({ id: snap.id, status: "Sent" });
  }

  // 3. Admin manual/wire payment: POST /api/invoices/:id/record-payment
  const recordPaymentMatch = subpath.match(/^\/([a-zA-Z0-9_-]+)\/record-payment\/?$/);
  if (recordPaymentMatch) {
    if (method !== "POST") return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    const admin = await requireAdminAuth(request);
    if (!admin) return jsonError("Administrative access required", 403, "FORBIDDEN");

    const validated = await validateRequestBody(request, recordOfflinePaymentSchema);
    if (!validated.success || !validated.data) {
      return jsonError(
        validated.error?.message || "Invalid payment amount",
        400,
        "INVALID_INPUT",
        validated.error?.details,
      );
    }

    const invoiceId = recordPaymentMatch[1];
    const invoiceRef = db.collection(COLLECTIONS.INVOICES).doc(invoiceId);
    const now = new Date().toISOString();
    const payAmount = validated.data.amount;

    try {
      const txOut = await db.runTransaction(async (tx) => {
        const snap = await tx.get(invoiceRef);
        if (!snap.exists) throw new Error("Invoice not found.");
        const data = snap.data() || {};
        if (data.status === "Cancelled")
          throw new Error("Cannot record payment for a cancelled invoice.");
        const total = Number(data.totalAmount ?? data.total ?? 0);
        const alreadyPaid = Number(data.amountPaid ?? 0);
        const currentBalance =
          typeof data.balanceDue === "number"
            ? data.balanceDue
            : Math.max(0, Number((total - alreadyPaid).toFixed(2)));

        if (currentBalance <= 0) throw new Error("Invoice balance is already zero.");
        if (payAmount > currentBalance) {
          throw new Error(
            `Payment amount exceeds remaining balance due (${data.currency || "USD"} ${currentBalance}).`,
          );
        }

        const newAmountPaid = Number((alreadyPaid + payAmount).toFixed(2));
        const newBalanceDue = Math.max(0, Number((total - newAmountPaid).toFixed(2)));
        const newStatus = newBalanceDue <= 0 ? "Paid" : "Partially Paid";

        const paymentRef = db.collection(COLLECTIONS.PAYMENTS).doc();
        const datePart = now.slice(0, 10).replace(/-/g, "");
        const receiptNumber = `RCPT-${datePart}-${paymentRef.id.slice(-6).toUpperCase()}`;

        tx.set(paymentRef, {
          id: paymentRef.id,
          invoiceId,
          invoiceNumber: String(data.invoiceNumber || data.number || ""),
          receiptNumber,
          clientId: String(data.clientId || data.clientUid || ""),
          clientUid: String(data.clientId || data.clientUid || ""),
          clientName: String(data.clientName || "Client"),
          clientEmail: String(data.clientEmail || ""),
          projectId: String(data.projectId || ""),
          projectName: String(data.projectName || "Architecture Scope"),
          amount: payAmount,
          currency: String(data.currency || "USD").toUpperCase(),
          gateway: "Direct / Wire",
          paymentMethod: validated.data?.paymentMethod || "manual_wire",
          status: "paid",
          paidAt: now,
          verifiedAt: now,
          createdAt: now,
          updatedAt: now,
        });

        tx.update(invoiceRef, {
          amountPaid: newAmountPaid,
          balanceDue: newBalanceDue,
          status: newStatus,
          ...(newStatus === "Paid" ? { paidAt: now } : {}),
          updatedAt: now,
          lastReceiptNumber: receiptNumber,
          lastPaymentRecordedBy: admin.email || admin.uid,
        });

        return {
          paymentId: paymentRef.id,
          receiptNumber,
          newAmountPaid,
          newBalanceDue,
          newStatus,
          data,
        };
      });

      const d = txOut.data;
      const clientUid = String(d.clientId || d.clientUid || "");
      const clientEmail = String(d.clientEmail || "");
      const clientName = String(d.clientName || "Client");
      const invoiceNumber = String(d.invoiceNumber || d.number || "");
      const currency = String(d.currency || "USD").toUpperCase();

      await notifyClientPaymentSucceeded({
        clientUid,
        clientEmail,
        clientName,
        invoiceId,
        invoiceNumber,
        receiptNumber: txOut.receiptNumber,
        amount: payAmount,
        currency,
        razorpayPaymentId: txOut.paymentId,
        paymentMethod: validated.data.paymentMethod || "manual_wire",
        newBalanceDue: txOut.newBalanceDue,
        invoiceStatus: txOut.newStatus,
        projectId: String(d.projectId || ""),
      });

      return jsonSuccess({
        invoiceId,
        paymentId: txOut.paymentId,
        receiptNumber: txOut.receiptNumber,
        amountPaid: txOut.newAmountPaid,
        balanceDue: txOut.newBalanceDue,
        status: txOut.newStatus,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record payment";
      return jsonError(msg, 400, "RECORD_PAYMENT_FAILED");
    }
  }

  // 4. Cancel invoice: POST /api/invoices/:id/cancel
  const cancelMatch = subpath.match(/^\/([a-zA-Z0-9_-]+)\/cancel\/?$/);
  if (cancelMatch) {
    if (method !== "POST") return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    const admin = await requireAdminAuth(request);
    if (!admin) return jsonError("Administrative access required", 403, "FORBIDDEN");

    const validated = await validateRequestBody(request, cancelInvoiceSchema);
    if (!validated.success || !validated.data) {
      return jsonError(
        validated.error?.message || "Cancellation reason is required",
        400,
        "INVALID_INPUT",
      );
    }

    const invoiceRef = db.collection(COLLECTIONS.INVOICES).doc(cancelMatch[1]);
    const snap = await invoiceRef.get();
    if (!snap.exists) return jsonError("Invoice not found", 404, "NOT_FOUND");
    const data = snap.data() || {};
    const now = new Date().toISOString();

    await invoiceRef.update({
      status: "Cancelled",
      cancelledAt: now,
      cancelledBy: admin.email || admin.uid,
      cancellationReason: validated.data.cancellationReason.trim(),
      updatedAt: now,
    });

    await notifyClientInvoiceUpdated({
      clientUid: String(data.clientId || data.clientUid || ""),
      clientEmail: String(data.clientEmail || ""),
      clientName: String(data.clientName || "Client"),
      invoiceId: snap.id,
      invoiceNumber: String(data.invoiceNumber || data.number || ""),
      status: "Cancelled",
      totalAmount: Number(data.totalAmount ?? data.total ?? 0),
      balanceDue: Number(data.balanceDue ?? 0),
      currency: String(data.currency || "USD"),
      summary: `This invoice has been cancelled. Reason: ${validated.data.cancellationReason.trim()}`,
      projectId: String(data.projectId || ""),
    });

    return jsonSuccess({ id: snap.id, status: "Cancelled" });
  }

  // 5. Single invoice CRUD: GET / PATCH / DELETE /api/invoices/:id
  const singleMatch = subpath.match(/^\/([a-zA-Z0-9_-]+)\/?$/);
  if (singleMatch) {
    const invoiceId = singleMatch[1];
    const invoiceRef = db.collection(COLLECTIONS.INVOICES).doc(invoiceId);
    const snap = await invoiceRef.get();
    if (!snap.exists) return jsonError("Invoice not found", 404, "NOT_FOUND");
    const data = snap.data() || {};
    const ownerUid = String(data.clientId || data.clientUid || "");

    if (method === "GET") {
      if (!isAdmin && ownerUid !== user.uid) {
        return jsonError("Unauthorized access to invoice", 403, "FORBIDDEN");
      }
      return jsonSuccess({ invoice: { id: snap.id, ...data } });
    }

    if (method === "PATCH") {
      const admin = await requireAdminAuth(request);
      if (!admin) return jsonError("Administrative access required", 403, "FORBIDDEN");

      const validated = await validateRequestBody(request, updateInvoiceSchema);
      if (!validated.success || !validated.data) {
        return jsonError(
          validated.error?.message || "Invalid update payload",
          400,
          "INVALID_INPUT",
          validated.error?.details,
        );
      }

      const u = validated.data;
      const now = new Date().toISOString();
      const updates: Record<string, unknown> = { updatedAt: now };

      if (u.invoiceNumber) {
        updates.invoiceNumber = u.invoiceNumber.trim();
        updates.number = u.invoiceNumber.trim();
      }
      if (u.projectId !== undefined) updates.projectId = u.projectId;
      if (u.projectName !== undefined) updates.projectName = u.projectName;
      if (u.issueDate !== undefined) {
        updates.issueDate = u.issueDate;
        updates.issuedAt = `${u.issueDate}T00:00:00.000Z`;
      }
      if (u.dueDate !== undefined) {
        updates.dueDate = u.dueDate;
        updates.dueAt = `${u.dueDate}T23:59:59.000Z`;
      }
      if (u.currency) updates.currency = u.currency.toUpperCase();
      if (u.notes !== undefined) updates.notes = u.notes;
      if (u.terms !== undefined) updates.terms = u.terms;
      if (u.status) updates.status = u.status;

      const existingAmountPaid = Number(data.amountPaid ?? 0);
      let finalTotal = Number(data.totalAmount ?? data.total ?? 0);
      let finalBalance = Number(data.balanceDue ?? Math.max(0, finalTotal - existingAmountPaid));

      if (u.lineItems) {
        const totals = computeTotals(
          u.lineItems,
          u.taxRate ?? Number(data.taxRate ?? 0),
          u.discount ?? Number(data.discount ?? 0),
          existingAmountPaid,
        );
        updates.lineItems = totals.lineItems;
        updates.subtotal = totals.subtotal;
        updates.taxRate = totals.taxRate;
        updates.tax = totals.tax;
        updates.taxAmount = totals.tax;
        updates.discount = totals.discount;
        updates.totalAmount = totals.totalAmount;
        updates.total = totals.totalAmount;
        updates.balanceDue = totals.balanceDue;
        finalTotal = totals.totalAmount;
        finalBalance = totals.balanceDue;
      }

      await invoiceRef.update(updates);

      const finalStatus = String(updates.status || data.status || "Sent");
      if (finalStatus !== "Draft") {
        await notifyClientInvoiceUpdated({
          clientUid: ownerUid,
          clientEmail: String(data.clientEmail || ""),
          clientName: String(data.clientName || "Client"),
          invoiceId,
          invoiceNumber: String(updates.invoiceNumber || data.invoiceNumber || data.number || ""),
          status: finalStatus,
          totalAmount: finalTotal,
          balanceDue: finalBalance,
          currency: String(updates.currency || data.currency || "USD"),
          summary: "Details on your invoice have been updated by VINORA administration.",
          projectId: String(updates.projectId ?? data.projectId ?? ""),
        });
      }

      return jsonSuccess({ id: invoiceId, ...updates });
    }

    if (method === "DELETE") {
      const admin = await requireAdminAuth(request);
      if (!admin) return jsonError("Administrative access required", 403, "FORBIDDEN");
      await invoiceRef.delete();
      return jsonSuccess({ deleted: true, id: invoiceId });
    }

    return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
  }

  return jsonError(`Endpoint /api/invoices${subpath} not found`, 404, "NOT_FOUND");
}
