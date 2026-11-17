import crypto from "crypto";
import { getServerEnv } from "../config/env";
import { getAdminDb } from "../config/firebase-admin";
import { COLLECTIONS } from "./firestore";
import { logActivity } from "./activity-log";
import {
  notifyClientPaymentSucceeded,
  notifyClientPaymentFailed,
  notifyClientInvoiceUpdated,
  notifyAdminsPaymentCompleted,
  notifyAdminsPaymentFailed,
} from "./notifications";

export interface CreateOrderParams {
  invoiceId: string;
  clientUid: string;
  clientName?: string;
  clientEmail?: string;
}

export interface RazorpayOrderResult {
  orderId: string;
  amount: number; // in smallest currency unit (paise for INR, cents for USD)
  amountDisplay: number; // in standard unit, e.g. 10000.00
  currency: string;
  keyId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientUid: string;
  clientName?: string;
  clientEmail?: string;
  isTestMode: boolean;
}

export interface VerifyPaymentParams {
  invoiceId: string;
  clientUid: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  alreadyProcessed?: boolean;
  paymentId: string;
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  amountPaidNow: number;
  newTotalPaid: number;
  newBalanceDue: number;
  invoiceStatus: "Paid" | "Partially Paid";
  currency: string;
  razorpayPaymentId: string;
  razorpayOrderId: string;
  paymentMethod: string;
}

export class RazorpayConfigError extends Error {
  code: string;
  constructor(message: string, code = "RAZORPAY_NOT_CONFIGURED") {
    super(message);
    this.name = "RazorpayConfigError";
    this.code = code;
  }
}

/**
 * Gets the configured Razorpay credentials from server environment.
 * Never returns fake fallback keys or exposes secrets.
 */
export function getRazorpayConfig() {
  const env = getServerEnv();
  const keyId = (env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET || "").trim();
  const webhookSecret = (
    env.RAZORPAY_WEBHOOK_SECRET ||
    process.env.RAZORPAY_WEBHOOK_SECRET ||
    ""
  ).trim();

  const isConfigured = Boolean(keyId && keySecret);
  const webhookConfigured = Boolean(webhookSecret);
  const isTestMode = keyId ? keyId.startsWith("rzp_test_") : true;

  return {
    keyId,
    keySecret,
    webhookSecret,
    isConfigured,
    webhookConfigured,
    isTestMode,
  };
}

function generateReceiptNumber(refId: string): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = refId
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(-6)
    .toUpperCase()
    .padStart(6, "0");
  return `RCPT-${datePart}-${suffix}`;
}

/**
 * Fetches an invoice and its authoritative remaining balance from Firestore,
 * verifying ownership unless the requester is an admin.
 */
export async function fetchAuthorizedInvoiceForPayment(
  invoiceId: string,
  requesterUid: string,
  isAdmin: boolean,
) {
  if (!invoiceId) {
    throw new Error("Missing invoiceId parameter.");
  }

  const db = getAdminDb();
  const invoiceDoc = await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).get();
  if (!invoiceDoc.exists) {
    throw new Error(`Invoice "${invoiceId}" not found.`);
  }

  const data = invoiceDoc.data() || {};
  const ownerUid = String(data.clientId || data.clientUid || "");
  if (!isAdmin && ownerUid !== requesterUid) {
    const authErr = new Error("Unauthorized: You do not have access to this invoice.");
    (authErr as Error & { statusCode?: number }).statusCode = 403;
    throw authErr;
  }

  const totalAmount = Number(data.totalAmount ?? data.total ?? 0);
  const amountPaid = Number(data.amountPaid ?? 0);
  const rawBalance = data.balanceDue !== undefined ? Number(data.balanceDue) : NaN;
  const balanceDue = !isNaN(rawBalance)
    ? Math.max(0, Number(rawBalance.toFixed(2)))
    : Math.max(0, Number((totalAmount - amountPaid).toFixed(2)));

  return {
    id: invoiceDoc.id,
    invoiceNumber: String(data.invoiceNumber || data.number || `INV-${invoiceId.slice(0, 6)}`),
    clientId: ownerUid,
    clientName: String(data.clientName || "Client"),
    clientEmail: String(data.clientEmail || ""),
    projectId: String(data.projectId || ""),
    projectName: String(data.projectName || "Architecture Scope"),
    currency: String(data.currency || "INR").toUpperCase(),
    status: String(data.status || "Sent"),
    totalAmount,
    amountPaid,
    balanceDue,
    issueDate: data.issueDate ? String(data.issueDate) : undefined,
    dueDate: data.dueDate ? String(data.dueDate) : undefined,
  };
}

/**
 * Creates a real Razorpay Order server-side after verifying the invoice from Firestore.
 * Never trusts any amount supplied by the browser.
 * Throws RazorpayConfigError if RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing.
 */
export async function createRazorpayOrder(params: CreateOrderParams): Promise<RazorpayOrderResult> {
  const { invoiceId, clientUid } = params;
  if (!invoiceId) {
    throw new Error("Missing invoiceId parameter.");
  }
  if (!clientUid) {
    throw new Error("Missing clientUid parameter.");
  }

  const { keyId, keySecret, isConfigured, isTestMode } = getRazorpayConfig();
  if (!isConfigured) {
    throw new RazorpayConfigError(
      "Razorpay payment gateway is not configured on the server. Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET.",
      "RAZORPAY_NOT_CONFIGURED",
    );
  }

  const db = getAdminDb();
  const invoiceDoc = await db.collection(COLLECTIONS.INVOICES).doc(invoiceId).get();

  if (!invoiceDoc.exists) {
    throw new Error(`Invoice with ID "${invoiceId}" does not exist.`);
  }

  const invoiceData = invoiceDoc.data() || {};

  // Strict ownership check
  const invoiceOwnerUid = String(invoiceData.clientId || invoiceData.clientUid || "");
  if (invoiceOwnerUid !== clientUid) {
    throw new Error(
      "Unauthorized: This invoice does not belong to the authenticated client account.",
    );
  }

  // Check invoice status
  const currentStatus = String(invoiceData.status || "").toLowerCase();
  if (currentStatus === "cancelled" || currentStatus === "canceled") {
    throw new Error("Cannot process payment for a cancelled invoice.");
  }
  if (currentStatus === "paid") {
    throw new Error("This invoice is already paid in full.");
  }

  // Retrieve authoritative balance due directly from server-side Firestore
  const totalAmount = Number(invoiceData.totalAmount ?? invoiceData.total ?? 0);
  const amountPaid = Number(invoiceData.amountPaid ?? 0);
  const rawBalance = Number(invoiceData.balanceDue);

  const verifiableBalance =
    !isNaN(rawBalance) && rawBalance > 0
      ? Number(rawBalance.toFixed(2))
      : Math.max(0, Number((totalAmount - amountPaid).toFixed(2)));

  if (verifiableBalance <= 0) {
    throw new Error("This invoice has zero balance due.");
  }

  const currency = String(invoiceData.currency || "INR").toUpperCase();
  const invoiceNumber = String(
    invoiceData.invoiceNumber || invoiceData.number || `INV-${invoiceId.slice(0, 6)}`,
  );

  // Convert to lowest currency unit (paise for INR, cents for USD/EUR/GBP)
  const amountSubunit = Math.round(verifiableBalance * 100);

  const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
  const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      amount: amountSubunit,
      currency,
      receipt: `rcpt_${invoiceId.slice(0, 14)}_${Date.now().toString().slice(-6)}`,
      notes: {
        invoiceId,
        invoiceNumber,
        clientUid,
        clientName: params.clientName || invoiceData.clientName || "",
        clientEmail: params.clientEmail || invoiceData.clientEmail || "",
      },
    }),
  });

  if (!rzpResponse.ok) {
    const errBody = await rzpResponse.text();
    console.error("[Razorpay Service] Order creation error from Razorpay:", errBody);
    throw new Error(`Razorpay Order creation failed (${rzpResponse.status}): ${errBody}`);
  }

  const orderData = (await rzpResponse.json()) as { id?: string };
  if (!orderData.id) {
    throw new Error("Razorpay Order API response did not include an order ID.");
  }
  const razorpayOrderId = orderData.id;

  // Record pending payment intent in Firestore
  const paymentIntentRef = db.collection(COLLECTIONS.PAYMENTS).doc();
  const now = new Date().toISOString();

  await paymentIntentRef.set({
    id: paymentIntentRef.id,
    invoiceId,
    invoiceNumber,
    clientId: clientUid,
    clientUid,
    clientName: params.clientName || invoiceData.clientName || "Client",
    clientEmail: params.clientEmail || invoiceData.clientEmail || "",
    projectId: invoiceData.projectId || "",
    projectName: invoiceData.projectName || "Architecture Scope",
    razorpayOrderId,
    amount: verifiableBalance,
    currency,
    status: "pending",
    gateway: "Razorpay",
    createdAt: now,
    updatedAt: now,
  });

  return {
    orderId: razorpayOrderId,
    amount: amountSubunit,
    amountDisplay: verifiableBalance,
    currency,
    keyId,
    invoiceId,
    invoiceNumber,
    clientUid,
    clientName: params.clientName || invoiceData.clientName || "",
    clientEmail: params.clientEmail || invoiceData.clientEmail || "",
    isTestMode,
  };
}

/**
 * Verifies Razorpay payment signature cryptographically:
 * hmac_sha256(order_id + "|" + payment_id, secret) === signature
 */
export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  keySecret: string,
): boolean {
  if (!orderId || !paymentId || !signature || !keySecret) {
    return false;
  }
  try {
    const text = `${orderId}|${paymentId}`;
    const generatedSignature = crypto.createHmac("sha256", keySecret).update(text).digest("hex");
    const genBuf = Buffer.from(generatedSignature, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    if (genBuf.length !== sigBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(genBuf, sigBuf);
  } catch (err) {
    console.error("[Razorpay Service] Signature verification comparison error:", err);
    return false;
  }
}

/**
 * Verifies Razorpay webhook signature cryptographically:
 * hmac_sha256(raw_body, webhook_secret) === signature
 */
export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  webhookSecret: string,
): boolean {
  if (!rawBody || !signature || !webhookSecret) {
    return false;
  }
  try {
    const generatedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");
    const genBuf = Buffer.from(generatedSignature, "utf8");
    const sigBuf = Buffer.from(signature, "utf8");
    if (genBuf.length !== sigBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(genBuf, sigBuf);
  } catch (err) {
    console.error("[Razorpay Service] Webhook signature comparison error:", err);
    return false;
  }
}

async function fetchRazorpayPaymentDetails(
  razorpayPaymentId: string,
): Promise<{ method?: string; amountSubunit?: number; status?: string } | null> {
  const { keyId, keySecret, isConfigured } = getRazorpayConfig();
  if (!isConfigured) return null;

  try {
    const authHeader = `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
    const res = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`,
      {
        method: "GET",
        headers: { Authorization: authHeader },
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { method?: string; amount?: number; status?: string };
    return {
      method: data.method,
      amountSubunit: typeof data.amount === "number" ? data.amount : undefined,
      status: data.status,
    };
  } catch {
    return null;
  }
}

/**
 * Verifies a Razorpay payment response and updates invoice & payment records atomically
 * inside a Firestore transaction with idempotency protection.
 */
export async function verifyAndProcessPayment(
  params: VerifyPaymentParams,
  options?: {
    paymentMethod?: string;
    verifiedByWebhook?: boolean;
    capturedAmountSubunit?: number;
  },
): Promise<PaymentVerificationResult> {
  const { invoiceId, clientUid, razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

  if (!invoiceId || !clientUid || !razorpayOrderId || !razorpayPaymentId) {
    throw new Error("Missing required payment verification parameters.");
  }

  const { keySecret, isConfigured } = getRazorpayConfig();
  const verifiedByWebhook = Boolean(options?.verifiedByWebhook);

  if (!verifiedByWebhook) {
    if (!isConfigured || !keySecret) {
      throw new RazorpayConfigError(
        "Razorpay server credentials are not configured. Payment signature cannot be verified.",
        "RAZORPAY_NOT_CONFIGURED",
      );
    }
    if (!razorpaySignature) {
      throw new Error("Missing Razorpay payment signature.");
    }
    const isValid = verifyRazorpaySignature(
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      keySecret,
    );
    if (!isValid) {
      throw new Error("Invalid Razorpay payment signature. Verification failed.");
    }
  }

  // Enrich payment method & amount from Razorpay API when available
  let resolvedMethod = options?.paymentMethod || "";
  let apiCapturedAmountSubunit = options?.capturedAmountSubunit;
  if (!verifiedByWebhook && (!resolvedMethod || resolvedMethod === "razorpay_checkout")) {
    const details = await fetchRazorpayPaymentDetails(razorpayPaymentId);
    if (details?.method) {
      resolvedMethod = details.method;
    }
    if (details?.amountSubunit && !apiCapturedAmountSubunit) {
      apiCapturedAmountSubunit = details.amountSubunit;
    }
  }
  const finalMethod = resolvedMethod || "razorpay_checkout";

  const db = getAdminDb();
  const now = new Date().toISOString();
  const idempotencyRef = db.collection("paymentIdempotency").doc(razorpayPaymentId);
  const invoiceRef = db.collection(COLLECTIONS.INVOICES).doc(invoiceId);

  let clientEmail = "";
  let clientName = "Client";
  let projectId = "";

  const txResult = await db.runTransaction(async (tx) => {
    const existingLock = await tx.get(idempotencyRef);
    const invoiceDoc = await tx.get(invoiceRef);

    if (!invoiceDoc.exists) {
      throw new Error(`Invoice "${invoiceId}" not found for reconciliation.`);
    }

    const invoiceData = invoiceDoc.data() || {};
    const invoiceOwnerUid = String(invoiceData.clientId || invoiceData.clientUid || "");

    // Strict client ownership enforcement
    if (invoiceOwnerUid !== clientUid) {
      throw new Error(
        "Unauthorized: Payment cannot be applied to an invoice owned by a different client.",
      );
    }

    clientEmail = String(invoiceData.clientEmail || "");
    clientName = String(invoiceData.clientName || "Client");
    projectId = String(invoiceData.projectId || "");

    // Idempotency return if already reconciled in an earlier /verify or webhook request
    if (existingLock.exists) {
      const lockData = existingLock.data() || {};
      return {
        alreadyProcessed: true,
        result: {
          verified: true,
          alreadyProcessed: true,
          paymentId: String(lockData.paymentId || ""),
          receiptNumber: String(lockData.receiptNumber || generateReceiptNumber(razorpayPaymentId)),
          invoiceId,
          invoiceNumber: String(invoiceData.invoiceNumber || invoiceData.number || ""),
          amountPaidNow: Number(lockData.amountPaidNow || 0),
          newTotalPaid: Number(invoiceData.amountPaid || 0),
          newBalanceDue: Number(invoiceData.balanceDue || 0),
          invoiceStatus: (invoiceData.status === "Paid" ? "Paid" : "Partially Paid") as
            "Paid" | "Partially Paid",
          currency: String(invoiceData.currency || "INR").toUpperCase(),
          razorpayPaymentId,
          razorpayOrderId,
          paymentMethod: String(lockData.paymentMethod || finalMethod),
        },
      };
    }

    const currentStatus = String(invoiceData.status || "").toLowerCase();
    if (currentStatus === "cancelled" || currentStatus === "canceled") {
      throw new Error("Cannot reconcile payment for a cancelled invoice.");
    }

    const currentTotalAmount = Number(invoiceData.totalAmount ?? invoiceData.total ?? 0);
    const currentAmountPaid = Number(invoiceData.amountPaid ?? 0);
    const currentBalanceDue =
      invoiceData.balanceDue !== undefined && typeof invoiceData.balanceDue === "number"
        ? Number(invoiceData.balanceDue.toFixed(2))
        : Math.max(0, Number((currentTotalAmount - currentAmountPaid).toFixed(2)));

    if (currentBalanceDue <= 0) {
      throw new Error("This invoice is already settled with zero balance due.");
    }

    // Check pending intent for this orderId inside transaction
    const pendingQuery = db
      .collection(COLLECTIONS.PAYMENTS)
      .where("razorpayOrderId", "==", razorpayOrderId)
      .limit(1);
    const pendingSnap = await tx.get(pendingQuery);

    if (!pendingSnap.empty) {
      const intentData = pendingSnap.docs[0].data();
      if (String(intentData.invoiceId || "") !== invoiceId) {
        throw new Error("Order ID does not match the target invoice.");
      }
      if (String(intentData.clientId || intentData.clientUid || "") !== clientUid) {
        throw new Error("Order ID does not belong to the authenticated client.");
      }
      if (intentData.status === "paid") {
        return {
          alreadyProcessed: true,
          result: {
            verified: true,
            alreadyProcessed: true,
            paymentId: pendingSnap.docs[0].id,
            receiptNumber: String(
              intentData.receiptNumber || generateReceiptNumber(razorpayPaymentId),
            ),
            invoiceId,
            invoiceNumber: String(invoiceData.invoiceNumber || invoiceData.number || ""),
            amountPaidNow: Number(intentData.amount || 0),
            newTotalPaid: currentAmountPaid,
            newBalanceDue: currentBalanceDue,
            invoiceStatus: (invoiceData.status === "Paid" ? "Paid" : "Partially Paid") as
              "Paid" | "Partially Paid",
            currency: String(invoiceData.currency || "INR").toUpperCase(),
            razorpayPaymentId: String(intentData.razorpayPaymentId || razorpayPaymentId),
            razorpayOrderId,
            paymentMethod: String(intentData.paymentMethod || finalMethod),
          },
        };
      }
    }

    // Determine settled amount (verify against captured amount if available, capped at currentBalanceDue)
    const capturedDisplay =
      typeof apiCapturedAmountSubunit === "number" && apiCapturedAmountSubunit > 0
        ? Number((apiCapturedAmountSubunit / 100).toFixed(2))
        : currentBalanceDue;
    const amountSettled = Math.min(currentBalanceDue, capturedDisplay);

    const newAmountPaid = Number((currentAmountPaid + amountSettled).toFixed(2));
    const newBalanceDue = Math.max(0, Number((currentTotalAmount - newAmountPaid).toFixed(2)));
    const newInvoiceStatus: "Paid" | "Partially Paid" =
      newBalanceDue <= 0 ? "Paid" : "Partially Paid";
    const currency = String(invoiceData.currency || "INR").toUpperCase();
    const invoiceNumber = String(
      invoiceData.invoiceNumber || invoiceData.number || `INV-${invoiceId.slice(0, 6)}`,
    );
    const receiptNumber = generateReceiptNumber(razorpayPaymentId);

    let paymentRecordId: string;

    if (!pendingSnap.empty) {
      const docRef = pendingSnap.docs[0].ref;
      paymentRecordId = docRef.id;
      tx.update(docRef, {
        razorpayPaymentId,
        razorpaySignature: verifiedByWebhook ? "webhook_hmac_verified" : razorpaySignature,
        receiptNumber,
        amount: amountSettled,
        currency,
        status: "paid",
        paymentMethod: finalMethod,
        paidAt: now,
        verifiedAt: now,
        updatedAt: now,
      });
    } else {
      const newDocRef = db.collection(COLLECTIONS.PAYMENTS).doc();
      paymentRecordId = newDocRef.id;
      tx.set(newDocRef, {
        id: paymentRecordId,
        invoiceId,
        invoiceNumber,
        receiptNumber,
        clientId: clientUid,
        clientUid,
        clientName,
        clientEmail,
        projectId,
        projectName: invoiceData.projectName || "Architecture Scope",
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: verifiedByWebhook ? "webhook_hmac_verified" : razorpaySignature,
        amount: amountSettled,
        currency,
        status: "paid",
        gateway: "Razorpay",
        paymentMethod: finalMethod,
        paidAt: now,
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      });
    }

    const invoiceUpdate: Record<string, unknown> = {
      amountPaid: newAmountPaid,
      balanceDue: newBalanceDue,
      status: newInvoiceStatus,
      updatedAt: now,
      lastPaymentRazorpayId: razorpayPaymentId,
      lastPaymentOrderId: razorpayOrderId,
      lastPaymentMethod: finalMethod,
      lastReceiptNumber: receiptNumber,
    };
    if (newInvoiceStatus === "Paid") {
      invoiceUpdate.paidAt = now;
    }

    tx.update(invoiceRef, invoiceUpdate);

    // Record idempotency lock inside the same atomic transaction
    tx.set(idempotencyRef, {
      razorpayPaymentId,
      razorpayOrderId,
      paymentId: paymentRecordId,
      receiptNumber,
      invoiceId,
      clientUid,
      amountPaidNow: amountSettled,
      paymentMethod: finalMethod,
      processedAt: now,
    });

    return {
      alreadyProcessed: false,
      result: {
        verified: true,
        alreadyProcessed: false,
        paymentId: paymentRecordId,
        receiptNumber,
        invoiceId,
        invoiceNumber,
        amountPaidNow: amountSettled,
        newTotalPaid: newAmountPaid,
        newBalanceDue: newBalanceDue,
        invoiceStatus: newInvoiceStatus,
        currency,
        razorpayPaymentId,
        razorpayOrderId,
        paymentMethod: finalMethod,
      },
    };
  });

  // Side effects run once outside transaction only on first reconciliation
  if (!txResult.alreadyProcessed) {
    const r = txResult.result;
    await logActivity({
      actorId: clientUid,
      actorRole: verifiedByWebhook ? "webhook" : "client",
      action: "payment_completed",
      targetType: "invoice",
      targetId: invoiceId,
      metadata: {
        paymentId: r.paymentId,
        receiptNumber: r.receiptNumber,
        razorpayPaymentId,
        razorpayOrderId,
        amount: r.amountPaidNow,
        currency: r.currency,
        newInvoiceStatus: r.invoiceStatus,
      },
    });

    await Promise.all([
      notifyClientPaymentSucceeded({
        clientUid,
        clientEmail,
        clientName,
        invoiceId,
        invoiceNumber: r.invoiceNumber,
        receiptNumber: r.receiptNumber,
        amount: r.amountPaidNow,
        currency: r.currency,
        razorpayPaymentId,
        paymentMethod: r.paymentMethod,
        newBalanceDue: r.newBalanceDue,
        invoiceStatus: r.invoiceStatus,
        projectId,
      }),
      notifyClientInvoiceUpdated({
        clientUid,
        clientEmail,
        clientName,
        invoiceId,
        invoiceNumber: r.invoiceNumber,
        status: r.invoiceStatus,
        totalAmount: r.newTotalPaid + r.newBalanceDue,
        balanceDue: r.newBalanceDue,
        currency: r.currency,
        summary: `Payment of ${r.currency} ${r.amountPaidNow.toLocaleString()} has been credited to your invoice.`,
        projectId,
      }),
      notifyAdminsPaymentCompleted({
        clientUid,
        clientName,
        clientEmail,
        invoiceId,
        invoiceNumber: r.invoiceNumber,
        receiptNumber: r.receiptNumber,
        amount: r.amountPaidNow,
        currency: r.currency,
        razorpayPaymentId,
        paymentMethod: r.paymentMethod,
        invoiceStatus: r.invoiceStatus,
        projectId,
      }),
    ]);
  }

  return txResult.result;
}

/**
 * Records a failed or cancelled Razorpay checkout attempt without altering invoice balance.
 */
export async function recordPaymentFailureOrCancel(params: {
  invoiceId: string;
  clientUid: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  outcome: "failed" | "cancelled";
  reason?: string;
}): Promise<{ recorded: boolean; paymentId?: string }> {
  const db = getAdminDb();
  const invoiceDoc = await db.collection(COLLECTIONS.INVOICES).doc(params.invoiceId).get();
  if (!invoiceDoc.exists) {
    throw new Error(`Invoice "${params.invoiceId}" not found.`);
  }
  const invoiceData = invoiceDoc.data() || {};
  const ownerUid = String(invoiceData.clientId || invoiceData.clientUid || "");
  if (ownerUid !== params.clientUid) {
    throw new Error("Unauthorized: Invoice does not belong to the authenticated client.");
  }

  const now = new Date().toISOString();
  const reason =
    params.reason ||
    (params.outcome === "cancelled"
      ? "Payment checkout was cancelled by the client."
      : "Payment was declined or failed at the gateway.");

  let paymentId: string | undefined;
  let amount = Number(invoiceData.balanceDue ?? invoiceData.totalAmount ?? 0);
  const currency = String(invoiceData.currency || "INR").toUpperCase();
  const invoiceNumber = String(
    invoiceData.invoiceNumber || invoiceData.number || `INV-${params.invoiceId.slice(0, 6)}`,
  );

  if (params.razorpayOrderId) {
    const snap = await db
      .collection(COLLECTIONS.PAYMENTS)
      .where("razorpayOrderId", "==", params.razorpayOrderId)
      .limit(1)
      .get();

    if (!snap.empty) {
      const docRef = snap.docs[0].ref;
      const existing = snap.docs[0].data();
      // Never overwrite an already settled payment
      if (existing.status === "paid") {
        return { recorded: false, paymentId: docRef.id };
      }
      paymentId = docRef.id;
      amount = Number(existing.amount || amount);
      await docRef.update({
        status: params.outcome,
        failureReason: reason,
        ...(params.razorpayPaymentId ? { razorpayPaymentId: params.razorpayPaymentId } : {}),
        ...(params.outcome === "cancelled" ? { cancelledAt: now } : {}),
        updatedAt: now,
      });
    }
  }

  if (!paymentId) {
    const newRef = db.collection(COLLECTIONS.PAYMENTS).doc();
    paymentId = newRef.id;
    await newRef.set({
      id: paymentId,
      invoiceId: params.invoiceId,
      invoiceNumber,
      clientId: params.clientUid,
      clientUid: params.clientUid,
      clientName: String(invoiceData.clientName || "Client"),
      clientEmail: String(invoiceData.clientEmail || ""),
      projectId: String(invoiceData.projectId || ""),
      projectName: String(invoiceData.projectName || "Architecture Scope"),
      ...(params.razorpayOrderId ? { razorpayOrderId: params.razorpayOrderId } : {}),
      ...(params.razorpayPaymentId ? { razorpayPaymentId: params.razorpayPaymentId } : {}),
      amount,
      currency,
      gateway: "Razorpay",
      status: params.outcome,
      failureReason: reason,
      ...(params.outcome === "cancelled" ? { cancelledAt: now } : {}),
      createdAt: now,
      updatedAt: now,
    });
  }

  if (params.outcome === "failed") {
    await Promise.all([
      notifyClientPaymentFailed({
        clientUid: params.clientUid,
        clientEmail: String(invoiceData.clientEmail || ""),
        clientName: String(invoiceData.clientName || "Client"),
        invoiceId: params.invoiceId,
        invoiceNumber,
        amount,
        currency,
        reason,
        projectId: String(invoiceData.projectId || ""),
      }),
      notifyAdminsPaymentFailed({
        clientUid: params.clientUid,
        clientName: String(invoiceData.clientName || "Client"),
        clientEmail: String(invoiceData.clientEmail || ""),
        invoiceId: params.invoiceId,
        invoiceNumber,
        amount,
        currency,
        reason,
        projectId: String(invoiceData.projectId || ""),
      }),
    ]);
  }

  return { recorded: true, paymentId };
}

/**
 * Handles incoming Razorpay Webhook events idempotently with mandatory HMAC verification.
 */
export async function processRazorpayWebhook(
  rawBody: string,
  signatureHeader: string | null,
): Promise<{ processed: boolean; event: string; message: string }> {
  const { webhookSecret } = getRazorpayConfig();

  if (!webhookSecret) {
    throw new RazorpayConfigError(
      "RAZORPAY_WEBHOOK_SECRET is not configured on the server.",
      "WEBHOOK_SECRET_NOT_CONFIGURED",
    );
  }

  if (!signatureHeader) {
    throw new Error("Missing X-Razorpay-Signature header.");
  }

  const isValid = verifyRazorpayWebhookSignature(rawBody, signatureHeader, webhookSecret);
  if (!isValid) {
    throw new Error("Invalid Razorpay webhook signature.");
  }

  let eventPayload: {
    event: string;
    payload?: {
      payment?: {
        entity?: {
          id: string;
          order_id: string;
          amount: number;
          currency: string;
          status: string;
          method?: string;
          error_description?: string;
          error_reason?: string;
          notes?: Record<string, string>;
        };
      };
      order?: {
        entity?: {
          id: string;
          receipt?: string;
          notes?: Record<string, string>;
        };
      };
    };
  };

  try {
    eventPayload = JSON.parse(rawBody);
  } catch {
    throw new Error("Invalid JSON in webhook payload.");
  }

  const eventName = eventPayload.event;

  if (eventName === "payment.captured" || eventName === "order.paid") {
    const paymentEntity = eventPayload.payload?.payment?.entity;
    if (!paymentEntity) {
      return { processed: false, event: eventName, message: "No payment entity found in payload" };
    }

    const razorpayPaymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id;
    const notes = paymentEntity.notes || eventPayload.payload?.order?.entity?.notes || {};

    let invoiceId = notes.invoiceId;
    let clientUid = notes.clientUid;

    if (!invoiceId || !clientUid) {
      const db = getAdminDb();
      const snap = await db
        .collection(COLLECTIONS.PAYMENTS)
        .where("razorpayOrderId", "==", razorpayOrderId)
        .limit(1)
        .get();

      if (snap.empty) {
        return {
          processed: false,
          event: eventName,
          message: `Unable to match order ID ${razorpayOrderId} to any VINORA invoice.`,
        };
      }

      const paymentData = snap.docs[0].data();
      invoiceId = String(paymentData.invoiceId || "");
      clientUid = String(paymentData.clientId || paymentData.clientUid || "");
    }

    await verifyAndProcessPayment(
      {
        invoiceId,
        clientUid,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature: "webhook_hmac_verified",
      },
      {
        paymentMethod: paymentEntity.method,
        verifiedByWebhook: true,
        capturedAmountSubunit: paymentEntity.amount,
      },
    );

    return {
      processed: true,
      event: eventName,
      message: `Successfully reconciled payment ${razorpayPaymentId} for invoice ${invoiceId}`,
    };
  }

  if (eventName === "payment.failed") {
    const paymentEntity = eventPayload.payload?.payment?.entity;
    if (!paymentEntity) {
      return { processed: false, event: eventName, message: "No payment entity found in payload" };
    }

    const razorpayOrderId = paymentEntity.order_id;
    const notes = paymentEntity.notes || eventPayload.payload?.order?.entity?.notes || {};
    let invoiceId = notes.invoiceId;
    let clientUid = notes.clientUid;

    if (!invoiceId || !clientUid) {
      const db = getAdminDb();
      const snap = await db
        .collection(COLLECTIONS.PAYMENTS)
        .where("razorpayOrderId", "==", razorpayOrderId)
        .limit(1)
        .get();
      if (!snap.empty) {
        const paymentData = snap.docs[0].data();
        invoiceId = String(paymentData.invoiceId || "");
        clientUid = String(paymentData.clientId || paymentData.clientUid || "");
      }
    }

    if (!invoiceId || !clientUid) {
      return {
        processed: false,
        event: eventName,
        message: `Unable to match failed order ID ${razorpayOrderId} to a VINORA invoice.`,
      };
    }

    await recordPaymentFailureOrCancel({
      invoiceId,
      clientUid,
      razorpayOrderId,
      razorpayPaymentId: paymentEntity.id,
      outcome: "failed",
      reason:
        paymentEntity.error_description ||
        paymentEntity.error_reason ||
        "Payment failed at Razorpay gateway.",
    });

    return {
      processed: true,
      event: eventName,
      message: `Recorded failed payment ${paymentEntity.id} for invoice ${invoiceId}`,
    };
  }

  return {
    processed: true,
    event: eventName,
    message: `Event ${eventName} acknowledged without action.`,
  };
}

/**
 * Fetches an official receipt record for a verified payment.
 */
export async function getPaymentReceipt(paymentId: string, requesterUid: string, isAdmin: boolean) {
  const db = getAdminDb();
  const docSnap = await db.collection(COLLECTIONS.PAYMENTS).doc(paymentId).get();
  if (!docSnap.exists) {
    throw new Error("Payment receipt not found.");
  }

  const paymentData = docSnap.data() || {};
  const ownerUid = String(paymentData.clientId || paymentData.clientUid || "");
  if (!isAdmin && ownerUid !== requesterUid) {
    const err = new Error("Unauthorized access to payment receipt.");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }

  return {
    id: docSnap.id,
    receiptNumber:
      paymentData.receiptNumber ||
      generateReceiptNumber(String(paymentData.razorpayPaymentId || docSnap.id)),
    ...paymentData,
  };
}
