import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { Payment, Invoice } from "@/lib/types";

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  handler: (response: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
    escape?: boolean;
    backdropclose?: boolean;
  };
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

/**
 * Dynamically loads the official Razorpay Checkout SDK script
 */
export async function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (window.Razorpay) return true;

  return new Promise((resolve) => {
    const existing = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]',
    );
    if (existing) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("Failed to load Razorpay Checkout script.");
      resolve(false);
    };
    document.body.appendChild(script);
  });
}

/**
 * Gets the current user's Firebase ID Token for authenticating API requests.
 */
async function getAuthBearerToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be logged in to initialize payment.");
  }
  return await currentUser.getIdToken();
}

/**
 * Fetches Razorpay public configuration from the server.
 */
export async function getRazorpayPublicConfig(): Promise<{
  keyId: string;
  isConfigured: boolean;
  webhookConfigured?: boolean;
  isTestMode: boolean;
}> {
  try {
    const res = await fetch("/api/payments/config");
    if (!res.ok) {
      throw new Error(`Failed to fetch payment config: ${res.statusText}`);
    }
    const json = (await res.json()) as {
      data: {
        keyId: string;
        isConfigured: boolean;
        webhookConfigured?: boolean;
        isTestMode: boolean;
      };
    };
    return json.data;
  } catch (err) {
    console.warn("Unable to fetch Razorpay config from server:", err);
    return {
      keyId: "",
      isConfigured: false,
      webhookConfigured: false,
      isTestMode: true,
    };
  }
}

/**
 * Fetches authoritative invoice balance & eligibility from backend before checkout.
 */
export async function fetchAuthorizedInvoice(invoiceId: string): Promise<{
  id: string;
  invoiceNumber: string;
  clientUid: string;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  status: string;
  clientName: string;
  clientEmail: string;
}> {
  const token = await getAuthBearerToken();
  const res = await fetch(`/api/payments/invoice/${encodeURIComponent(invoiceId)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const json = (await res.json()) as {
    success: boolean;
    data?: {
      invoice: {
        id: string;
        invoiceNumber: string;
        clientUid: string;
        totalAmount: number;
        amountPaid: number;
        balanceDue: number;
        currency: string;
        status: string;
        clientName: string;
        clientEmail: string;
      };
    };
    error?: { message: string; code: string };
  };
  if (!res.ok || !json.success || !json.data?.invoice) {
    throw new Error(json.error?.message || "Unable to verify invoice details from server.");
  }
  return json.data.invoice;
}

/**
 * Initiates Razorpay Order on the secure server-side.
 * The server calculates the exact balance due from Firestore.
 */
export async function createPaymentOrder(
  invoiceId: string,
  clientName?: string,
  clientEmail?: string,
) {
  const token = await getAuthBearerToken();

  const res = await fetch("/api/payments/create-order", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      invoiceId,
      clientName,
      clientEmail,
    }),
  });

  const data = (await res.json()) as {
    success: boolean;
    data?: {
      orderId: string;
      amount: number;
      amountDisplay: number;
      currency: string;
      keyId: string;
      invoiceId: string;
      invoiceNumber: string;
      clientUid: string;
      isTestMode: boolean;
    };
    error?: { message: string; code: string };
  };

  if (!res.ok || !data.success || !data.data) {
    throw new Error(data.error?.message || "Failed to create Razorpay Order on server.");
  }

  return data.data;
}

/**
 * Verifies Razorpay payment signature on the server and updates Firestore.
 */
export async function verifyPaymentOnServer(params: {
  invoiceId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  paymentMethod?: string;
}) {
  const token = await getAuthBearerToken();

  const res = await fetch("/api/payments/verify", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const data = (await res.json()) as {
    success: boolean;
    data?: {
      verified: boolean;
      paymentId: string;
      receiptNumber?: string;
      invoiceId: string;
      invoiceNumber: string;
      amountPaidNow: number;
      newTotalPaid: number;
      newBalanceDue: number;
      invoiceStatus: "Paid" | "Partially Paid";
      currency: string;
      razorpayPaymentId: string;
      razorpayOrderId: string;
      paymentMethod?: string;
    };
    error?: { message: string; code: string };
  };

  if (!res.ok || !data.success || !data.data) {
    throw new Error(data.error?.message || "Payment signature verification failed on server.");
  }

  return data.data;
}

/**
 * Records a failed or user-cancelled checkout attempt on the backend without modifying invoice balance.
 */
export async function reportPaymentFailureOrCancel(params: {
  invoiceId: string;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  outcome: "failed" | "cancelled";
  reason?: string;
}) {
  try {
    const token = await getAuthBearerToken();
    await fetch("/api/payments/record-failure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
  } catch (err) {
    console.warn("Unable to log payment failure/cancel attempt:", err);
  }
}

/**
 * Fetches authenticated client's payment history directly from backend API.
 */
export async function fetchMyPayments(): Promise<Payment[]> {
  const token = await getAuthBearerToken();
  const res = await fetch("/api/payments/my-payments", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    success: boolean;
    data?: { payments: Record<string, unknown>[] };
    error?: { message: string };
  };
  if (!res.ok || !json.success || !json.data) {
    throw new Error(json.error?.message || "Failed to load payments.");
  }
  return json.data.payments.map((p) => normalizePaymentDoc(String(p.id || ""), p));
}

/**
 * Fetches an official payment receipt from the backend.
 */
export async function fetchPaymentReceipt(paymentId: string): Promise<Payment> {
  const token = await getAuthBearerToken();
  const res = await fetch(`/api/payments/receipt/${encodeURIComponent(paymentId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = (await res.json()) as {
    success: boolean;
    data?: { receipt: Record<string, unknown> };
    error?: { message: string };
  };
  if (!res.ok || !json.success || !json.data?.receipt) {
    throw new Error(json.error?.message || "Failed to load payment receipt.");
  }
  const r = json.data.receipt;
  return normalizePaymentDoc(String(r.id || paymentId), r);
}

/**
 * Launches the full Razorpay Checkout modal for a client invoice.
 */
export async function launchRazorpayCheckout(
  invoice: Invoice,
  clientUser: { uid: string; name?: string; email?: string; phone?: string },
  onSuccess: (result: {
    paymentId: string;
    receiptNumber?: string;
    razorpayPaymentId: string;
    invoiceStatus: "Paid" | "Partially Paid";
    amountPaid: number;
  }) => void,
  onError: (error: Error) => void,
  onDismiss?: () => void,
) {
  try {
    // 1. Fetch authoritative invoice & remaining balance from backend
    const freshInvoice = await fetchAuthorizedInvoice(invoice.id);
    if (freshInvoice.balanceDue <= 0 || freshInvoice.status === "Paid") {
      throw new Error("This invoice has zero balance due and cannot accept further payments.");
    }
    if (freshInvoice.status === "Cancelled") {
      throw new Error("Cannot pay a cancelled invoice.");
    }

    // 2. Request trusted server-side Razorpay order creation first
    const orderData = await createPaymentOrder(
      invoice.id,
      clientUser.name || freshInvoice.clientName,
      clientUser.email || freshInvoice.clientEmail,
    );

    // 3. Ensure Razorpay SDK is loaded
    const isLoaded = await loadRazorpayScript();
    if (!isLoaded || !window.Razorpay) {
      throw new Error(
        "Unable to load Razorpay payment engine. Please check your internet connection.",
      );
    }

    let paymentCompleted = false;
    let paymentFailed = false;

    // 4. Configure Razorpay modal
    const options: RazorpayCheckoutOptions = {
      key: orderData.keyId,
      amount: orderData.amount,
      currency: orderData.currency,
      name: "VINORA Studio",
      description: `Settlement for Invoice ${orderData.invoiceNumber}`,
      order_id: orderData.orderId,
      prefill: {
        name: clientUser.name || freshInvoice.clientName || "",
        email: clientUser.email || freshInvoice.clientEmail || "",
        contact: clientUser.phone || "",
      },
      notes: {
        invoiceId: invoice.id,
        invoiceNumber: orderData.invoiceNumber,
        clientUid: clientUser.uid,
      },
      theme: {
        color: "#0a0a0a",
      },
      modal: {
        ondismiss: () => {
          if (!paymentCompleted && !paymentFailed) {
            void reportPaymentFailureOrCancel({
              invoiceId: invoice.id,
              razorpayOrderId: orderData.orderId,
              outcome: "cancelled",
              reason: "Payment checkout dismissed by client before completion.",
            });
          }
          if (onDismiss) onDismiss();
        },
        escape: true,
        backdropclose: false,
      },
      handler: async (response) => {
        paymentCompleted = true;
        try {
          // 5. Verify signature cryptographically on server
          const verification = await verifyPaymentOnServer({
            invoiceId: invoice.id,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            paymentMethod: "razorpay_checkout",
          });

          onSuccess({
            paymentId: verification.paymentId,
            receiptNumber: verification.receiptNumber,
            razorpayPaymentId: verification.razorpayPaymentId,
            invoiceStatus: verification.invoiceStatus,
            amountPaid: verification.amountPaidNow,
          });
        } catch (err: unknown) {
          console.error("Payment verification failure:", err);
          onError(err instanceof Error ? err : new Error("Payment signature verification failed."));
        }
      },
    };

    const rzpInstance = new window.Razorpay(options);
    rzpInstance.on("payment.failed", (failData: unknown) => {
      paymentFailed = true;
      console.warn("Razorpay payment failed:", failData);
      const err = failData as {
        error?: { description?: string; reason?: string; metadata?: { payment_id?: string } };
      };
      const reason =
        err?.error?.description ||
        err?.error?.reason ||
        "Payment was declined or cancelled by bank.";
      void reportPaymentFailureOrCancel({
        invoiceId: invoice.id,
        razorpayOrderId: orderData.orderId,
        razorpayPaymentId: err?.error?.metadata?.payment_id,
        outcome: "failed",
        reason,
      });
      onError(new Error(reason));
    });

    rzpInstance.open();
  } catch (err: unknown) {
    console.error("Razorpay initiation error:", err);
    onError(err instanceof Error ? err : new Error("Failed to initialize Razorpay checkout."));
  }
}

/**
 * Normalizes payment documents from Firestore into strongly-typed Payment objects
 */
export function normalizePaymentDoc(id: string, data: Record<string, unknown>): Payment {
  return {
    id,
    clientId: String(data.clientId || data.clientUid || ""),
    clientUid: String(data.clientUid || data.clientId || ""),
    clientName: typeof data.clientName === "string" ? data.clientName : undefined,
    clientEmail: typeof data.clientEmail === "string" ? data.clientEmail : undefined,
    projectId: String(data.projectId || ""),
    projectName: typeof data.projectName === "string" ? data.projectName : undefined,
    proposalId: typeof data.proposalId === "string" ? data.proposalId : undefined,
    invoiceId: typeof data.invoiceId === "string" ? data.invoiceId : undefined,
    invoiceNumber: typeof data.invoiceNumber === "string" ? data.invoiceNumber : undefined,
    receiptNumber: typeof data.receiptNumber === "string" ? data.receiptNumber : undefined,
    razorpayOrderId: typeof data.razorpayOrderId === "string" ? data.razorpayOrderId : undefined,
    razorpayPaymentId:
      typeof data.razorpayPaymentId === "string" ? data.razorpayPaymentId : undefined,
    razorpaySignature:
      typeof data.razorpaySignature === "string" ? data.razorpaySignature : undefined,
    amount: typeof data.amount === "number" ? data.amount : 0,
    currency: typeof data.currency === "string" ? data.currency.toUpperCase() : "INR",
    gateway: typeof data.gateway === "string" ? data.gateway : "Razorpay",
    paymentMethod: typeof data.paymentMethod === "string" ? data.paymentMethod : "online",
    status: (typeof data.status === "string"
      ? data.status.toLowerCase()
      : "paid") as Payment["status"],
    failureReason: typeof data.failureReason === "string" ? data.failureReason : undefined,
    cancelledAt: typeof data.cancelledAt === "string" ? data.cancelledAt : undefined,
    paidAt: typeof data.paidAt === "string" ? data.paidAt : undefined,
    verifiedAt: typeof data.verifiedAt === "string" ? data.verifiedAt : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
}

/**
 * Real-time listener for an authenticated client's payments
 */
export function subscribeClientPayments(
  clientUid: string,
  onUpdate: (payments: Payment[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  if (!clientUid) {
    onUpdate([]);
    return () => {};
  }

  const q = query(collection(db, "payments"), where("clientId", "==", clientUid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => normalizePaymentDoc(d.id, d.data()));
      list.sort((a, b) => {
        const timeA = a.paidAt ? new Date(a.paidAt).getTime() : new Date(a.createdAt).getTime();
        const timeB = b.paidAt ? new Date(b.paidAt).getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });
      onUpdate(list);
    },
    (err) => {
      console.error("[Payment Service] Client payments subscription error:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * Real-time listener for all studio payments (Authorized Admin only)
 */
export function subscribeAllPayments(
  onUpdate: (payments: Payment[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const colRef = collection(db, "payments");

  return onSnapshot(
    colRef,
    (snap) => {
      const list = snap.docs.map((d) => normalizePaymentDoc(d.id, d.data()));
      list.sort((a, b) => {
        const timeA = a.paidAt ? new Date(a.paidAt).getTime() : new Date(a.createdAt).getTime();
        const timeB = b.paidAt ? new Date(b.paidAt).getTime() : new Date(b.createdAt).getTime();
        return timeB - timeA;
      });
      onUpdate(list);
    },
    (err) => {
      console.error("[Payment Service] Admin payments snapshot error:", err);
      if (onError) onError(err);
    },
  );
}
