/**
 * VINORA Transactional Email Service
 *
 * Sends secure OTP verification codes and portal event notifications
 * using Resend. Provider API keys remain strictly server-side.
 */

export interface EmailSendResult {
  delivered: boolean;
  messageId?: string;
  error?: string;
  code?: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function wrapVinoraEmailLayout(params: {
  title: string;
  headline: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): string {
  const ctaBlock =
    params.ctaLabel && params.ctaUrl
      ? `
        <div style="margin-top: 24px; margin-bottom: 8px;">
          <a href="${escapeHtml(params.ctaUrl)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #ffffff; color: #090a0a; font-size: 13px; font-weight: 600; text-decoration: none; padding: 12px 22px; border-radius: 6px; letter-spacing: 0.02em;">
            ${escapeHtml(params.ctaLabel)}
          </a>
        </div>
      `
      : "";

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${escapeHtml(params.title)}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0c0d0e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0c0d0e; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #141618; border: 1px solid #27272a; padding: 36px 32px;">
                <tr>
                  <td align="left" style="padding-bottom: 24px; border-bottom: 1px solid #27272a;">
                    <span style="font-size: 20px; font-weight: 700; letter-spacing: 0.15em; color: #ffffff;">VINORA</span>
                    <span style="display: block; font-size: 10px; letter-spacing: 0.25em; text-transform: uppercase; color: #a1a1aa; margin-top: 4px;">Idea to Impact</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 28px;">
                    <h1 style="font-size: 20px; font-weight: 600; color: #ffffff; margin: 0 0 14px 0; letter-spacing: -0.02em;">${escapeHtml(params.headline)}</h1>
                    ${params.bodyHtml}
                    ${ctaBlock}
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 32px; border-top: 1px solid #27272a; margin-top: 32px; font-size: 11px; color: #71717a; text-align: center;">
                    &copy; ${new Date().getFullYear()} VINORA. All rights reserved. Confidential.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export async function sendTransactionalEmail(params: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<EmailSendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      delivered: false,
      code: "EMAIL_PROVIDER_NOT_CONFIGURED",
      error:
        "Transactional email provider is not configured. Please add RESEND_API_KEY to environment secrets.",
    };
  }

  const recipients = (Array.isArray(params.to) ? params.to : [params.to])
    .map((e) => e.trim())
    .filter(Boolean);

  if (recipients.length === 0) {
    return {
      delivered: false,
      code: "NO_RECIPIENTS",
      error: "No valid recipient email address provided.",
    };
  }

  const fromAddress = process.env.RESEND_FROM_EMAIL || "VINORA <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: recipients,
        subject: params.subject,
        html: params.html,
      }),
    });

    if (!res.ok) {
      let message = "Failed to deliver email through transactional provider.";
      let code = "EMAIL_SEND_FAILED";
      try {
        const errJson = (await res.json()) as {
          message?: string;
          name?: string;
          statusCode?: number;
        };
        if (errJson.message) {
          message = errJson.message;
        }
        if (errJson.name === "validation_error" || errJson.statusCode === 403) {
          code = "RESEND_DOMAIN_RESTRICTION";
        }
      } catch {
        // Use default message
      }
      return {
        delivered: false,
        code,
        error: message,
      };
    }

    const data = (await res.json()) as { id?: string };
    return {
      delivered: true,
      messageId: data.id,
    };
  } catch (err) {
    console.error("Resend fetch exception:", err);
    return {
      delivered: false,
      code: "NETWORK_ERROR",
      error: "Network error attempting to contact email provider.",
    };
  }
}

export async function sendOtpEmail(
  toEmail: string,
  otpCode: string,
  expiresInMinutes = 10,
): Promise<EmailSendResult> {
  const subject = `Your VINORA Verification Code: ${otpCode}`;
  const html = wrapVinoraEmailLayout({
    title: "VINORA Verification Code",
    headline: "Verify your email address",
    bodyHtml: `
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 24px 0;">
        Welcome to VINORA. Please enter the verification code below to verify your email and complete your client account creation.
      </p>
      <div style="background-color: #090a0a; border: 1px solid #3f3f46; padding: 20px; text-align: center; margin-bottom: 24px;">
        <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.3em; color: #ffffff;">${escapeHtml(otpCode)}</span>
      </div>
      <p style="font-size: 13px; line-height: 1.5; color: #71717a; margin: 0 0 8px 0;">
        This code is valid for <strong>${expiresInMinutes} minutes</strong> and can only be used once.
      </p>
      <p style="font-size: 12px; line-height: 1.5; color: #52525b; margin: 0;">
        If you did not request this code, no further action is required. Please ignore this email.
      </p>
    `,
  });

  return sendTransactionalEmail({ to: toEmail, subject, html });
}

export async function sendMeetingRequestedAdminEmail(params: {
  adminEmails: string[];
  clientName: string;
  clientEmail: string;
  title: string;
  purpose: string;
  platform: string;
  preferredDate: string;
  preferredTime: string;
}): Promise<EmailSendResult> {
  const subject = `New Meeting Request from ${params.clientName}: ${params.title}`;
  const html = wrapVinoraEmailLayout({
    title: "New Meeting Request",
    headline: "New client meeting request submitted",
    bodyHtml: `
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 16px 0;">
        <strong style="color: #ffffff;">${escapeHtml(params.clientName)}</strong> (${escapeHtml(params.clientEmail)}) has requested a consultation via the VINORA Client Portal.
      </p>
      <div style="background-color: #090a0a; border: 1px solid #27272a; padding: 16px; font-size: 13px; color: #e4e4e7; line-height: 1.6;">
        <div><strong>Topic:</strong> ${escapeHtml(params.title)}</div>
        <div><strong>Platform:</strong> ${escapeHtml(params.platform)}</div>
        <div><strong>Requested Schedule:</strong> ${escapeHtml(params.preferredDate)} at ${escapeHtml(params.preferredTime)}</div>
        <div style="margin-top: 8px;"><strong>Purpose:</strong><br/>${escapeHtml(params.purpose)}</div>
      </div>
    `,
  });

  return sendTransactionalEmail({ to: params.adminEmails, subject, html });
}

export async function sendMeetingStatusClientEmail(params: {
  clientEmail: string;
  clientName: string;
  status: "Approved" | "Rescheduled" | "Rejected" | "Cancelled" | "Completed";
  title: string;
  platform: string;
  date: string;
  time: string;
  meetingUrl?: string;
  location?: string;
  reason?: string;
  adminNotes?: string;
}): Promise<EmailSendResult> {
  const joinLabel =
    params.platform === "Microsoft Teams"
      ? "Join Microsoft Teams"
      : params.platform === "Google Meet"
        ? "Join Google Meet"
        : "Open Meeting Link";

  const statusHeadlineMap: Record<typeof params.status, string> = {
    Approved: "Your VINORA meeting has been approved",
    Rescheduled: "Your VINORA meeting has been rescheduled",
    Rejected: "Update on your VINORA meeting request",
    Cancelled: "Your VINORA meeting has been cancelled",
    Completed: "Your VINORA meeting has been marked completed",
  };

  const subject = `VINORA Meeting ${params.status}: ${params.title}`;
  const reasonHtml = params.reason
    ? `<div style="margin-top: 8px;"><strong>Note / Reason:</strong> ${escapeHtml(params.reason)}</div>`
    : "";
  const notesHtml = params.adminNotes
    ? `<div style="margin-top: 8px;"><strong>Studio Notes:</strong> ${escapeHtml(params.adminNotes)}</div>`
    : "";
  const locationHtml = params.location
    ? `<div><strong>Venue:</strong> ${escapeHtml(params.location)}</div>`
    : "";
  const linkHtml = params.meetingUrl
    ? `<div style="margin-top: 8px;"><strong>Meeting Link:</strong> <a href="${escapeHtml(params.meetingUrl)}" style="color: #60a5fa;">${escapeHtml(params.meetingUrl)}</a></div>`
    : "";

  const html = wrapVinoraEmailLayout({
    title: subject,
    headline: statusHeadlineMap[params.status],
    bodyHtml: `
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 16px 0;">
        Hello ${escapeHtml(params.clientName || "Client")}, here is the latest update on your meeting request.
      </p>
      <div style="background-color: #090a0a; border: 1px solid #27272a; padding: 16px; font-size: 13px; color: #e4e4e7; line-height: 1.6;">
        <div><strong>Topic:</strong> ${escapeHtml(params.title)}</div>
        <div><strong>Status:</strong> ${escapeHtml(params.status)}</div>
        <div><strong>Platform:</strong> ${escapeHtml(params.platform)}</div>
        <div><strong>Schedule:</strong> ${escapeHtml(params.date)} at ${escapeHtml(params.time)}</div>
        ${locationHtml}
        ${linkHtml}
        ${reasonHtml}
        ${notesHtml}
      </div>
    `,
    ctaLabel:
      params.meetingUrl && (params.status === "Approved" || params.status === "Rescheduled")
        ? joinLabel
        : undefined,
    ctaUrl:
      params.meetingUrl && (params.status === "Approved" || params.status === "Rescheduled")
        ? params.meetingUrl
        : undefined,
  });

  return sendTransactionalEmail({ to: params.clientEmail, subject, html });
}

export async function sendPaymentReceiptClientEmail(params: {
  clientEmail: string;
  clientName: string;
  invoiceNumber: string;
  receiptNumber: string;
  amount: number;
  currency: string;
  razorpayPaymentId: string;
  paymentMethod: string;
  newBalanceDue: number;
  invoiceStatus: string;
}): Promise<EmailSendResult> {
  const subject = `Payment Receipt ${params.receiptNumber} — Invoice ${params.invoiceNumber}`;
  const html = wrapVinoraEmailLayout({
    title: subject,
    headline: "Payment Verified & Receipt Issued",
    bodyHtml: `
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 16px 0;">
        Hello ${escapeHtml(params.clientName || "Client")}, your payment for invoice <strong style="color: #ffffff;">${escapeHtml(params.invoiceNumber)}</strong> has been cryptographically verified and recorded.
      </p>
      <div style="background-color: #090a0a; border: 1px solid #27272a; padding: 16px; font-size: 13px; color: #e4e4e7; line-height: 1.7;">
        <div><strong>Receipt Number:</strong> ${escapeHtml(params.receiptNumber)}</div>
        <div><strong>Transaction Ref:</strong> ${escapeHtml(params.razorpayPaymentId)}</div>
        <div><strong>Amount Paid:</strong> ${escapeHtml(params.currency)} ${params.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div><strong>Payment Method:</strong> ${escapeHtml(params.paymentMethod)}</div>
        <div><strong>Invoice Status:</strong> ${escapeHtml(params.invoiceStatus)}</div>
        <div><strong>Remaining Balance:</strong> ${escapeHtml(params.currency)} ${params.newBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    `,
  });

  return sendTransactionalEmail({ to: params.clientEmail, subject, html });
}

export async function sendPaymentFailedClientEmail(params: {
  clientEmail: string;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  reason: string;
}): Promise<EmailSendResult> {
  const subject = `Payment Failed — Invoice ${params.invoiceNumber}`;
  const html = wrapVinoraEmailLayout({
    title: subject,
    headline: "Payment Could Not Be Completed",
    bodyHtml: `
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 16px 0;">
        Hello ${escapeHtml(params.clientName || "Client")}, your payment attempt for invoice <strong style="color: #ffffff;">${escapeHtml(params.invoiceNumber)}</strong> was not completed. No balance changes were applied.
      </p>
      <div style="background-color: #090a0a; border: 1px solid #27272a; padding: 16px; font-size: 13px; color: #e4e4e7; line-height: 1.7;">
        <div><strong>Invoice:</strong> ${escapeHtml(params.invoiceNumber)}</div>
        <div><strong>Attempted Amount:</strong> ${escapeHtml(params.currency)} ${params.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div><strong>Reason:</strong> ${escapeHtml(params.reason)}</div>
      </div>
      <p style="font-size: 13px; line-height: 1.5; color: #a1a1aa; margin: 16px 0 0 0;">
        You can retry payment anytime from the Payments section of your VINORA Client Portal.
      </p>
    `,
  });

  return sendTransactionalEmail({ to: params.clientEmail, subject, html });
}

export async function sendInvoiceUpdatedClientEmail(params: {
  clientEmail: string;
  clientName: string;
  invoiceNumber: string;
  status: string;
  totalAmount: number;
  balanceDue: number;
  currency: string;
  summary: string;
}): Promise<EmailSendResult> {
  const subject = `Invoice ${params.invoiceNumber} Update — ${params.status}`;
  const html = wrapVinoraEmailLayout({
    title: subject,
    headline: `Invoice ${params.invoiceNumber} — ${params.status}`,
    bodyHtml: `
      <p style="font-size: 14px; line-height: 1.6; color: #a1a1aa; margin: 0 0 16px 0;">
        Hello ${escapeHtml(params.clientName || "Client")}, ${escapeHtml(params.summary)}
      </p>
      <div style="background-color: #090a0a; border: 1px solid #27272a; padding: 16px; font-size: 13px; color: #e4e4e7; line-height: 1.7;">
        <div><strong>Invoice #:</strong> ${escapeHtml(params.invoiceNumber)}</div>
        <div><strong>Status:</strong> ${escapeHtml(params.status)}</div>
        <div><strong>Total Amount:</strong> ${escapeHtml(params.currency)} ${params.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div><strong>Balance Due:</strong> ${escapeHtml(params.currency)} ${params.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    `,
  });

  return sendTransactionalEmail({ to: params.clientEmail, subject, html });
}
