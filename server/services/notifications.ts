import { getAdminDb } from "../config/firebase-admin";
import { COLLECTIONS } from "./firestore";
import { getServerEnv } from "../config/env";
import {
  sendMeetingRequestedAdminEmail,
  sendMeetingStatusClientEmail,
  sendPaymentReceiptClientEmail,
  sendPaymentFailedClientEmail,
  sendInvoiceUpdatedClientEmail,
  sendTransactionalEmail,
} from "./email";

export interface NotificationCreateParams {
  userId: string;
  title: string;
  body: string;
  type: string;
  link?: string;
  projectId?: string;
}

const PRIMARY_ADMIN_EMAIL = "shreyar2918@gmail.com";

/**
 * Persists an in-app notification in Firestore `notifications` collection.
 */
export async function createInAppNotification(
  params: NotificationCreateParams,
): Promise<string | null> {
  if (!params.userId) return null;

  try {
    const db = getAdminDb();
    const docRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc();
    const now = new Date().toISOString();

    await docRef.set({
      id: docRef.id,
      userId: params.userId,
      title: params.title.slice(0, 160),
      body: params.body.slice(0, 1000),
      type: params.type.slice(0, 50),
      link: params.link ? params.link.slice(0, 400) : "/client",
      read: false,
      ...(params.projectId ? { projectId: params.projectId } : {}),
      createdAt: now,
    });

    return docRef.id;
  } catch (err) {
    console.error("[Notifications Service] Failed to persist notification:", err);
    return null;
  }
}

/**
 * Retrieves active admin UIDs and notification emails from Firestore + env.
 */
export async function getAdminNotificationTargets(): Promise<{
  adminUids: string[];
  adminEmails: string[];
}> {
  const adminUids = new Set<string>();
  const adminEmails = new Set<string>([PRIMARY_ADMIN_EMAIL]);
  const env = getServerEnv();
  if (env.ADMIN_NOTIFICATION_EMAIL) {
    adminEmails.add(env.ADMIN_NOTIFICATION_EMAIL.trim());
  }

  try {
    const db = getAdminDb();
    const snap = await db.collection(COLLECTIONS.ADMINS).where("active", "==", true).get();
    for (const d of snap.docs) {
      const data = d.data();
      const uid = typeof data.uid === "string" && data.uid ? data.uid : d.id;
      if (uid) adminUids.add(uid);
      if (typeof data.email === "string" && data.email.trim()) {
        adminEmails.add(data.email.trim());
      }
    }
  } catch (err) {
    console.warn("[Notifications Service] Could not fetch active admins:", err);
  }

  return {
    adminUids: Array.from(adminUids),
    adminEmails: Array.from(adminEmails),
  };
}

/**
 * Notify all active admins when a client requests a new meeting.
 */
export async function notifyAdminsMeetingRequested(params: {
  meetingId: string;
  clientName: string;
  clientEmail: string;
  title: string;
  purpose: string;
  platform: string;
  preferredDate: string;
  preferredTime: string;
  projectId?: string;
}): Promise<{ inAppCount: number; emailDelivered: boolean }> {
  const { adminUids, adminEmails } = await getAdminNotificationTargets();

  const title = `New Meeting Request: ${params.clientName}`;
  const body = `${params.clientName} requested a ${params.platform} meeting ("${params.title}") for ${params.preferredDate} at ${params.preferredTime}.`;

  let inAppCount = 0;
  for (const uid of adminUids) {
    const id = await createInAppNotification({
      userId: uid,
      title,
      body,
      type: "meeting_requested",
      link: `/admin?section=meeting-requests&meetingId=${params.meetingId}`,
      projectId: params.projectId,
    });
    if (id) inAppCount += 1;
  }

  const emailRes = await sendMeetingRequestedAdminEmail({
    adminEmails,
    clientName: params.clientName,
    clientEmail: params.clientEmail,
    title: params.title,
    purpose: params.purpose,
    platform: params.platform,
    preferredDate: params.preferredDate,
    preferredTime: params.preferredTime,
  });

  return { inAppCount, emailDelivered: emailRes.delivered };
}

/**
 * Notify client when an admin approves, reschedules, rejects, or cancels a meeting,
 * and emit an explicit notification when a meeting link becomes available.
 */
export async function notifyClientMeetingUpdated(params: {
  meetingId: string;
  clientUid: string;
  clientEmail?: string;
  clientName: string;
  status: "Approved" | "Rescheduled" | "Rejected" | "Cancelled" | "Completed";
  title: string;
  platform: string;
  date: string;
  time: string;
  meetingUrl?: string;
  previousMeetingUrl?: string;
  location?: string;
  reason?: string;
  adminNotes?: string;
  projectId?: string;
}): Promise<{ inAppIds: string[]; emailDelivered: boolean }> {
  const inAppIds: string[] = [];

  let notifTitle = `Meeting ${params.status}: ${params.title}`;
  let notifBody = `Your ${params.platform} meeting "${params.title}" (${params.date} at ${params.time}) is now ${params.status}.`;
  const notifType = `meeting_${params.status.toLowerCase()}`;

  if (params.status === "Approved") {
    notifTitle = `Meeting Approved: ${params.title}`;
    notifBody = `Your ${params.platform} meeting is confirmed for ${params.date} at ${params.time}.${
      params.meetingUrl ? ` Join link is ready.` : ""
    }`;
  } else if (params.status === "Rescheduled") {
    notifTitle = `Meeting Rescheduled: ${params.title}`;
    notifBody = `Your ${params.platform} meeting was rescheduled to ${params.date} at ${params.time}.${
      params.reason ? ` Reason: ${params.reason}` : ""
    }`;
  } else if (params.status === "Rejected") {
    notifTitle = `Meeting Declined: ${params.title}`;
    notifBody = `Your meeting request for ${params.date} at ${params.time} could not be accommodated.${
      params.reason ? ` Reason: ${params.reason}` : ""
    }`;
  } else if (params.status === "Cancelled") {
    notifTitle = `Meeting Cancelled: ${params.title}`;
    notifBody = `The meeting "${params.title}" scheduled for ${params.date} at ${params.time} has been cancelled.${
      params.reason ? ` Reason: ${params.reason}` : ""
    }`;
  }

  const primaryId = await createInAppNotification({
    userId: params.clientUid,
    title: notifTitle,
    body: notifBody,
    type: notifType,
    link: `/client?section=meetings&meetingId=${params.meetingId}`,
    projectId: params.projectId,
  });
  if (primaryId) inAppIds.push(primaryId);

  // Separate explicit notification when a video meeting link becomes available
  const hasNewLink =
    Boolean(params.meetingUrl) &&
    (params.status === "Approved" || params.status === "Rescheduled") &&
    params.meetingUrl !== params.previousMeetingUrl;

  if (hasNewLink && params.meetingUrl) {
    const linkNotifId = await createInAppNotification({
      userId: params.clientUid,
      title: `${params.platform} Link Available`,
      body: `Your ${params.platform} link for "${params.title}" (${params.date} at ${params.time}) is now ready in your Meetings tab.`,
      type: "meeting_link_ready",
      link: `/client?section=meetings&meetingId=${params.meetingId}`,
      projectId: params.projectId,
    });
    if (linkNotifId) inAppIds.push(linkNotifId);
  }

  let emailDelivered = false;
  if (params.clientEmail) {
    const emailRes = await sendMeetingStatusClientEmail({
      clientEmail: params.clientEmail,
      clientName: params.clientName,
      status: params.status,
      title: params.title,
      platform: params.platform,
      date: params.date,
      time: params.time,
      meetingUrl: params.meetingUrl,
      location: params.location,
      reason: params.reason,
      adminNotes: params.adminNotes,
    });
    emailDelivered = emailRes.delivered;
  }

  return { inAppIds, emailDelivered };
}

/**
 * Notify admins when a client cancels their meeting.
 */
export async function notifyAdminsMeetingCancelledByClient(params: {
  meetingId: string;
  clientName: string;
  clientEmail?: string;
  title: string;
  date: string;
  time: string;
  reason?: string;
}): Promise<void> {
  const { adminUids, adminEmails } = await getAdminNotificationTargets();

  const notifTitle = `Meeting Cancelled by Client: ${params.clientName}`;
  const notifBody = `${params.clientName} cancelled the meeting "${params.title}" (${params.date} at ${params.time}).${
    params.reason ? ` Reason: ${params.reason}` : ""
  }`;

  for (const uid of adminUids) {
    await createInAppNotification({
      userId: uid,
      title: notifTitle,
      body: notifBody,
      type: "meeting_cancelled",
      link: `/admin?section=meeting-requests&meetingId=${params.meetingId}`,
    });
  }

  await sendTransactionalEmail({
    to: adminEmails,
    subject: `Client Cancelled Meeting: ${params.title}`,
    html: `<p><strong>${params.clientName}</strong> (${params.clientEmail || "client"}) cancelled the meeting <strong>${params.title}</strong> scheduled for ${params.date} at ${params.time}.</p><p>${params.reason ? `Reason: ${params.reason}` : ""}</p>`,
  });
}

/**
 * Notify client when a payment succeeds and receipt is issued.
 */
export async function notifyClientPaymentSucceeded(params: {
  clientUid: string;
  clientEmail?: string;
  clientName: string;
  invoiceId: string;
  invoiceNumber: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  razorpayPaymentId: string;
  paymentMethod: string;
  newBalanceDue: number;
  invoiceStatus: string;
  projectId?: string;
}): Promise<{ inAppId: string | null; emailDelivered: boolean }> {
  const inAppId = await createInAppNotification({
    userId: params.clientUid,
    title: `Payment Succeeded — ${params.invoiceNumber}`,
    body: `Payment of ${params.currency} ${params.amount.toLocaleString()} verified (Receipt ${params.receiptNumber}). Invoice status: ${params.invoiceStatus}.`,
    type: "payment_succeeded",
    link: `/client?section=invoices&invoiceId=${params.invoiceId}`,
    projectId: params.projectId,
  });

  let emailDelivered = false;
  if (params.clientEmail) {
    const emailRes = await sendPaymentReceiptClientEmail({
      clientEmail: params.clientEmail,
      clientName: params.clientName,
      invoiceNumber: params.invoiceNumber,
      receiptNumber: params.receiptNumber,
      amount: params.amount,
      currency: params.currency,
      razorpayPaymentId: params.razorpayPaymentId,
      paymentMethod: params.paymentMethod,
      newBalanceDue: params.newBalanceDue,
      invoiceStatus: params.invoiceStatus,
    });
    emailDelivered = emailRes.delivered;
  }

  return { inAppId, emailDelivered };
}

/**
 * Notify client when a payment fails.
 */
export async function notifyClientPaymentFailed(params: {
  clientUid: string;
  clientEmail?: string;
  clientName: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  reason: string;
  projectId?: string;
}): Promise<{ inAppId: string | null; emailDelivered: boolean }> {
  const inAppId = await createInAppNotification({
    userId: params.clientUid,
    title: `Payment Failed — ${params.invoiceNumber}`,
    body: `Your payment of ${params.currency} ${params.amount.toLocaleString()} for ${params.invoiceNumber} could not be completed (${params.reason}). Please retry in Payments.`,
    type: "payment_failed",
    link: `/client?section=invoices&invoiceId=${params.invoiceId}`,
    projectId: params.projectId,
  });

  let emailDelivered = false;
  if (params.clientEmail) {
    const emailRes = await sendPaymentFailedClientEmail({
      clientEmail: params.clientEmail,
      clientName: params.clientName,
      invoiceNumber: params.invoiceNumber,
      amount: params.amount,
      currency: params.currency,
      reason: params.reason,
    });
    emailDelivered = emailRes.delivered;
  }

  return { inAppId, emailDelivered };
}

/**
 * Notify client when an invoice is issued, updated, or cancelled.
 */
export async function notifyClientInvoiceUpdated(params: {
  clientUid: string;
  clientEmail?: string;
  clientName: string;
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  balanceDue: number;
  currency: string;
  summary: string;
  projectId?: string;
}): Promise<{ inAppId: string | null; emailDelivered: boolean }> {
  const inAppId = await createInAppNotification({
    userId: params.clientUid,
    title: `Invoice Updated: ${params.invoiceNumber}`,
    body: `${params.summary} Status: ${params.status}. Balance due: ${params.currency} ${params.balanceDue.toLocaleString()}.`,
    type: "invoice_updated",
    link: `/client?section=invoices&invoiceId=${params.invoiceId}`,
    projectId: params.projectId,
  });

  let emailDelivered = false;
  if (params.clientEmail) {
    const emailRes = await sendInvoiceUpdatedClientEmail({
      clientEmail: params.clientEmail,
      clientName: params.clientName,
      invoiceNumber: params.invoiceNumber,
      status: params.status,
      totalAmount: params.totalAmount,
      balanceDue: params.balanceDue,
      currency: params.currency,
      summary: params.summary,
    });
    emailDelivered = emailRes.delivered;
  }

  return { inAppId, emailDelivered };
}

/**
 * Notify client in-app & via email confirmation when their meeting request is submitted.
 */
export async function notifyClientMeetingSubmitted(params: {
  meetingId: string;
  clientUid: string;
  clientEmail?: string;
  clientName: string;
  title: string;
  platform: string;
  preferredDate: string;
  preferredTime: string;
  projectId?: string;
}): Promise<{ inAppId: string | null; emailDelivered: boolean }> {
  const inAppId = await createInAppNotification({
    userId: params.clientUid,
    title: `Meeting Request Submitted: ${params.title}`,
    body: `Your ${params.platform} meeting request for ${params.preferredDate} at ${params.preferredTime} has been submitted for team review.`,
    type: "meeting_submitted",
    link: `/client?section=meetings&meetingId=${params.meetingId}`,
    projectId: params.projectId,
  });

  let emailDelivered = false;
  if (params.clientEmail) {
    const emailRes = await sendTransactionalEmail({
      to: params.clientEmail,
      subject: `VINORA: Meeting Request Received — ${params.title}`,
      html: `<p>Hi ${params.clientName},</p><p>We have received your <strong>${params.platform}</strong> meeting request (<strong>${params.title}</strong>) for <strong>${params.preferredDate}</strong> at <strong>${params.preferredTime}</strong>.</p><p>You will receive a confirmation notification and link once our team approves your schedule.</p>`,
    });
    emailDelivered = emailRes.delivered;
  }

  return { inAppId, emailDelivered };
}

/**
 * Notify active admins in-app and via email when a client completes an invoice payment.
 */
export async function notifyAdminsPaymentCompleted(params: {
  clientUid: string;
  clientName: string;
  clientEmail?: string;
  invoiceId: string;
  invoiceNumber: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  razorpayPaymentId: string;
  paymentMethod: string;
  invoiceStatus: string;
  projectId?: string;
}): Promise<{ inAppCount: number; emailDelivered: boolean }> {
  const { adminUids, adminEmails } = await getAdminNotificationTargets();

  const title = `Payment Received: ${params.invoiceNumber}`;
  const body = `${params.clientName} completed a ${params.currency} ${params.amount.toLocaleString()} payment (${params.paymentMethod}). Receipt: ${params.receiptNumber}. Invoice is now ${params.invoiceStatus}.`;

  let inAppCount = 0;
  for (const uid of adminUids) {
    const id = await createInAppNotification({
      userId: uid,
      title,
      body,
      type: "payment_completed",
      link: `/admin?section=invoices&invoiceId=${params.invoiceId}`,
      projectId: params.projectId,
    });
    if (id) inAppCount += 1;
  }

  const emailRes = await sendTransactionalEmail({
    to: adminEmails,
    subject: `VINORA Payment Completed: ${params.invoiceNumber} (${params.currency} ${params.amount.toLocaleString()})`,
    html: `<p><strong>${params.clientName}</strong> (${params.clientEmail || params.clientUid}) completed a payment for <strong>${params.invoiceNumber}</strong>.</p><ul><li>Amount: ${params.currency} ${params.amount.toLocaleString()}</li><li>Receipt: ${params.receiptNumber}</li><li>Razorpay Payment ID: ${params.razorpayPaymentId}</li><li>Method: ${params.paymentMethod}</li><li>Status: ${params.invoiceStatus}</li></ul>`,
  });

  return { inAppCount, emailDelivered: emailRes.delivered };
}

/**
 * Notify active admins in-app and via email when a client payment fails.
 */
export async function notifyAdminsPaymentFailed(params: {
  clientUid: string;
  clientName: string;
  clientEmail?: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  reason: string;
  projectId?: string;
}): Promise<{ inAppCount: number; emailDelivered: boolean }> {
  const { adminUids, adminEmails } = await getAdminNotificationTargets();

  const title = `Payment Issue: ${params.invoiceNumber}`;
  const body = `A ${params.currency} ${params.amount.toLocaleString()} payment attempt by ${params.clientName} failed (${params.reason}).`;

  let inAppCount = 0;
  for (const uid of adminUids) {
    const id = await createInAppNotification({
      userId: uid,
      title,
      body,
      type: "payment_failed",
      link: `/admin?section=invoices&invoiceId=${params.invoiceId}`,
      projectId: params.projectId,
    });
    if (id) inAppCount += 1;
  }

  const emailRes = await sendTransactionalEmail({
    to: adminEmails,
    subject: `VINORA Payment Failed Alert: ${params.invoiceNumber}`,
    html: `<p>A payment attempt by <strong>${params.clientName}</strong> (${params.clientEmail || params.clientUid}) for <strong>${params.invoiceNumber}</strong> (${params.currency} ${params.amount.toLocaleString()}) failed.</p><p>Reason: ${params.reason}</p>`,
  });

  return { inAppCount, emailDelivered: emailRes.delivered };
}
