import { z } from "zod";
import { jsonSuccess, jsonError } from "../utils/response";
import { authenticateRequest, requireAdminAuth } from "../middleware/auth";
import { validateRequestBody } from "../middleware/validate";
import {
  createRazorpayOrder,
  verifyAndProcessPayment,
  processRazorpayWebhook,
  getRazorpayConfig,
  fetchAuthorizedInvoiceForPayment,
  recordPaymentFailureOrCancel,
  getPaymentReceipt,
  RazorpayConfigError,
} from "../services/razorpay";
import { getAdminDb } from "../config/firebase-admin";
import { COLLECTIONS } from "../services/firestore";

const createOrderSchema = z.object({
  invoiceId: z.string().min(1, "invoiceId is required").max(128),
  clientName: z.string().max(160).optional(),
  clientEmail: z.string().email().max(254).optional().or(z.literal("")),
});

const verifyPaymentSchema = z.object({
  invoiceId: z.string().min(1).max(128),
  razorpayOrderId: z.string().min(1).max(128),
  razorpayPaymentId: z.string().min(1).max(128),
  razorpaySignature: z.string().min(1).max(512),
  paymentMethod: z.string().max(64).optional(),
});

const recordFailureSchema = z.object({
  invoiceId: z.string().min(1).max(128),
  razorpayOrderId: z.string().max(128).optional(),
  razorpayPaymentId: z.string().max(128).optional(),
  outcome: z.enum(["failed", "cancelled"]).default("failed"),
  reason: z.string().max(500).optional(),
});

const ADMIN_ROLES = new Set(["super_admin", "admin", "project_manager", "content_admin"]);

export async function handlePaymentsRoute(request: Request, subpath: string): Promise<Response> {
  const method = request.method;

  // 1. Webhook endpoint: POST /api/payments/webhook
  if (subpath === "/webhook" || subpath === "/webhook/") {
    if (method !== "POST") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    try {
      const rawBody = await request.text();
      const signatureHeader = request.headers.get("x-razorpay-signature");

      const result = await processRazorpayWebhook(rawBody, signatureHeader);
      return jsonSuccess(result, 200);
    } catch (err: unknown) {
      console.error("[Payments Route] Webhook processing error:", err);
      if (err instanceof RazorpayConfigError) {
        return jsonError(err.message, 503, err.code);
      }
      const msg = err instanceof Error ? err.message : "Webhook verification failed";
      return jsonError(msg, 400, "WEBHOOK_FAILED");
    }
  }

  // 2. Public config endpoint: GET /api/payments/config
  if (subpath === "/config" || subpath === "/config/") {
    if (method !== "GET") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }
    const { keyId, isConfigured, webhookConfigured, isTestMode } = getRazorpayConfig();
    return jsonSuccess({
      keyId: isConfigured ? keyId : "",
      isConfigured,
      webhookConfigured,
      isTestMode,
    });
  }

  // 3. Admin: list all payment records: GET /api/payments/admin/all
  if (subpath === "/admin/all" || subpath === "/admin/all/") {
    if (method !== "GET") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }
    const adminUser = await requireAdminAuth(request);
    if (!adminUser) {
      return jsonError("Administrative access required", 403, "FORBIDDEN");
    }

    try {
      const db = getAdminDb();
      const snap = await db.collection(COLLECTIONS.PAYMENTS).orderBy("createdAt", "desc").get();
      const payments = snap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      return jsonSuccess({
        payments,
        count: payments.length,
      });
    } catch (err: unknown) {
      console.error("[Payments Route] Admin fetch payments error:", err);
      return jsonError("Failed to fetch payments ledger", 500, "DATABASE_ERROR");
    }
  }

  // All remaining endpoints require authenticated user
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonError("Authentication required for payments", 401, "UNAUTHORIZED");
  }
  const isAdmin = ADMIN_ROLES.has(user.role) || user.email === "shreyar2918@gmail.com";

  // 4. Fetch authoritative invoice & remaining balance: GET /api/payments/invoice/:invoiceId
  const invoiceMatch = subpath.match(/^\/invoice\/([a-zA-Z0-9_-]+)\/?$/);
  if (invoiceMatch) {
    if (method !== "GET") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }
    try {
      const invoice = await fetchAuthorizedInvoiceForPayment(invoiceMatch[1], user.uid, isAdmin);
      return jsonSuccess({ invoice });
    } catch (err: unknown) {
      const status = (err as Error & { statusCode?: number }).statusCode || 404;
      const msg = err instanceof Error ? err.message : "Invoice lookup failed";
      return jsonError(msg, status, status === 403 ? "FORBIDDEN" : "INVOICE_NOT_FOUND");
    }
  }

  // 5. Fetch official payment receipt: GET /api/payments/receipt/:paymentId
  const receiptMatch = subpath.match(/^\/receipt\/([a-zA-Z0-9_-]+)\/?$/);
  if (receiptMatch) {
    if (method !== "GET") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }
    try {
      const receipt = await getPaymentReceipt(receiptMatch[1], user.uid, isAdmin);
      return jsonSuccess({ receipt });
    } catch (err: unknown) {
      const status = (err as Error & { statusCode?: number }).statusCode || 404;
      const msg = err instanceof Error ? err.message : "Receipt lookup failed";
      return jsonError(msg, status, status === 403 ? "FORBIDDEN" : "RECEIPT_NOT_FOUND");
    }
  }

  // 6. Create Order: POST /api/payments/create-order
  if (subpath === "/create-order" || subpath === "/create-order/") {
    if (method !== "POST") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const validated = await validateRequestBody(request, createOrderSchema);
    if (!validated.success || !validated.data) {
      return jsonError(
        validated.error?.message || "Invalid input",
        400,
        "INVALID_INPUT",
        validated.error?.details,
      );
    }

    try {
      const orderResult = await createRazorpayOrder({
        invoiceId: validated.data.invoiceId,
        clientUid: user.uid,
        clientName: validated.data.clientName || undefined,
        clientEmail: validated.data.clientEmail || user.email || undefined,
      });

      return jsonSuccess(orderResult, 201);
    } catch (err: unknown) {
      console.error("[Payments Route] Order creation failure:", err);
      if (err instanceof RazorpayConfigError) {
        return jsonError(err.message, 503, err.code);
      }
      const msg = err instanceof Error ? err.message : "Failed to create payment order";
      const isForbidden = msg.toLowerCase().includes("unauthorized");
      return jsonError(
        msg,
        isForbidden ? 403 : 400,
        isForbidden ? "FORBIDDEN" : "ORDER_CREATION_FAILED",
      );
    }
  }

  // 7. Verify Payment: POST /api/payments/verify
  if (subpath === "/verify" || subpath === "/verify/") {
    if (method !== "POST") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const validated = await validateRequestBody(request, verifyPaymentSchema);
    if (!validated.success || !validated.data) {
      return jsonError(
        validated.error?.message || "Invalid verification payload",
        400,
        "INVALID_INPUT",
        validated.error?.details,
      );
    }

    try {
      const verificationResult = await verifyAndProcessPayment(
        {
          invoiceId: validated.data.invoiceId,
          clientUid: user.uid,
          razorpayOrderId: validated.data.razorpayOrderId,
          razorpayPaymentId: validated.data.razorpayPaymentId,
          razorpaySignature: validated.data.razorpaySignature,
        },
        {
          paymentMethod: validated.data.paymentMethod,
        },
      );

      return jsonSuccess(verificationResult, 200);
    } catch (err: unknown) {
      console.error("[Payments Route] Verification error:", err);
      if (err instanceof RazorpayConfigError) {
        return jsonError(err.message, 503, err.code);
      }
      const msg = err instanceof Error ? err.message : "Payment signature verification failed";
      const isForbidden = msg.toLowerCase().includes("unauthorized");
      return jsonError(
        msg,
        isForbidden ? 403 : 400,
        isForbidden ? "FORBIDDEN" : "VERIFICATION_FAILED",
      );
    }
  }

  // 8. Record failed or cancelled checkout attempt: POST /api/payments/record-failure
  if (subpath === "/record-failure" || subpath === "/record-failure/") {
    if (method !== "POST") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    const validated = await validateRequestBody(request, recordFailureSchema);
    if (!validated.success || !validated.data) {
      return jsonError(
        validated.error?.message || "Invalid failure payload",
        400,
        "INVALID_INPUT",
        validated.error?.details,
      );
    }

    try {
      const result = await recordPaymentFailureOrCancel({
        invoiceId: validated.data.invoiceId,
        clientUid: user.uid,
        razorpayOrderId: validated.data.razorpayOrderId,
        razorpayPaymentId: validated.data.razorpayPaymentId,
        outcome: validated.data.outcome,
        reason: validated.data.reason,
      });

      return jsonSuccess(result, 200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to record payment attempt status";
      const isForbidden = msg.toLowerCase().includes("unauthorized");
      return jsonError(
        msg,
        isForbidden ? 403 : 400,
        isForbidden ? "FORBIDDEN" : "RECORD_FAILURE_ERROR",
      );
    }
  }

  // 9. Client payment history: GET /api/payments/my-payments
  if (subpath === "/my-payments" || subpath === "/my-payments/") {
    if (method !== "GET") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    try {
      const db = getAdminDb();
      const snap = await db
        .collection(COLLECTIONS.PAYMENTS)
        .where("clientId", "==", user.uid)
        .get();

      const payments = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      payments.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const timeA = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
        const timeB = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
        return timeB - timeA;
      });

      return jsonSuccess({ payments });
    } catch (err: unknown) {
      console.error("[Payments Route] Client payments error:", err);
      return jsonError("Failed to fetch client payment history", 500, "DATABASE_ERROR");
    }
  }

  return jsonError(`Endpoint /api/payments${subpath} not found`, 404, "NOT_FOUND");
}
