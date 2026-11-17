import { z } from "zod";
import { jsonSuccess, jsonError } from "../utils/response";
import { authenticateRequest, requireAdminAuth } from "../middleware/auth";
import { validateRequestBody } from "../middleware/validate";
import { getAdminDb } from "../config/firebase-admin";
import { COLLECTIONS } from "../services/firestore";
import { logActivity } from "../services/activity-log";
import {
  getDetailedVideoIntegrationsStatus,
  createGoogleMeetConference,
  createMicrosoftTeamsMeeting,
  validateMeetingUrlInput,
  type MeetingPlatform,
} from "../services/videoConferencing";
import {
  notifyAdminsMeetingRequested,
  notifyClientMeetingSubmitted,
  notifyClientMeetingUpdated,
  notifyAdminsMeetingCancelledByClient,
} from "../services/notifications";

const createMeetingSchema = z.object({
  title: z.string().min(1, "Meeting title is required").max(160),
  purpose: z.string().min(3, "Meeting purpose is required").max(2000),
  platform: z.enum(["Google Meet", "Microsoft Teams", "In-Person"]).default("Google Meet"),
  meetingType: z.enum(["Online Meeting", "In-Person Meeting"]).optional(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  preferredTime: z.string().min(3, "Preferred time is required").max(32),
  projectId: z.string().max(128).optional(),
  projectTitle: z.string().max(160).optional(),
  notes: z.string().max(2000).optional(),
});

const approveMeetingSchema = z.object({
  finalDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  finalTime: z.string().min(3).max(32).optional(),
  scheduledAt: z.string().max(64).optional(),
  platform: z.enum(["Google Meet", "Microsoft Teams", "In-Person"]).optional(),
  autoCreateLink: z.boolean().optional(),
  meetingUrl: z.string().max(500).optional(),
  location: z.string().max(500).optional(),
  adminNotes: z.string().max(2000).optional(),
});

const rescheduleMeetingSchema = z.object({
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "New date must be YYYY-MM-DD"),
  newTime: z.string().min(3, "New time is required").max(32),
  scheduledAt: z.string().max(64).optional(),
  rescheduleReason: z.string().min(3, "Reschedule reason is required").max(1000),
  platform: z.enum(["Google Meet", "Microsoft Teams", "In-Person"]).optional(),
  autoCreateLink: z.boolean().optional(),
  meetingUrl: z.string().max(500).optional(),
  location: z.string().max(500).optional(),
  adminNotes: z.string().max(2000).optional(),
});

const rejectMeetingSchema = z.object({
  rejectionReason: z.string().min(3, "Reason for declining is required").max(1000),
  adminNotes: z.string().max(2000).optional(),
});

const cancelMeetingSchema = z.object({
  cancellationReason: z.string().max(1000).optional(),
});

const completeMeetingSchema = z.object({
  adminNotes: z.string().max(2000).optional(),
});

const ADMIN_ROLES = new Set(["super_admin", "admin", "project_manager", "content_admin"]);

function buildIsoSchedule(dateStr?: string, timeStr?: string, fallbackIso?: string): string {
  if (fallbackIso) {
    const d = new Date(fallbackIso);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  if (dateStr && timeStr) {
    // Handle HH:mm or "02:00 PM"
    const hhmmMatch = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (hhmmMatch) {
      let hours = parseInt(hhmmMatch[1], 10);
      const mins = parseInt(hhmmMatch[2], 10);
      const meridiem = hhmmMatch[3]?.toUpperCase();
      if (meridiem === "PM" && hours < 12) hours += 12;
      if (meridiem === "AM" && hours === 12) hours = 0;
      const paddedH = String(hours).padStart(2, "0");
      const paddedM = String(mins).padStart(2, "0");
      const combined = new Date(`${dateStr}T${paddedH}:${paddedM}:00Z`);
      if (!isNaN(combined.getTime())) return combined.toISOString();
    }
    const parsed = new Date(`${dateStr}T${timeStr}`);
    if (!isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
}

function resolveMeetingPlatform(data: Record<string, unknown>): MeetingPlatform {
  const rawPlatform = String(data.platform || "").trim();
  if (
    rawPlatform === "Google Meet" ||
    rawPlatform === "Microsoft Teams" ||
    rawPlatform === "In-Person"
  ) {
    return rawPlatform;
  }
  if (data.meetingType === "In-Person Meeting") return "In-Person";
  const url = String(data.meetingUrl || "").toLowerCase();
  if (url.includes("teams.microsoft.com") || url.includes("teams.live.com")) {
    return "Microsoft Teams";
  }
  return "Google Meet";
}

export async function handleMeetingsRoute(request: Request, subpath: string): Promise<Response> {
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonError("Authentication required for meetings", 401, "UNAUTHORIZED");
  }

  const isAdmin = ADMIN_ROLES.has(user.role) || user.email === "shreyar2918@gmail.com";
  const method = request.method;
  const db = getAdminDb();

  // 1. Admin video conference API configuration status: GET /api/meetings/integrations
  if (subpath === "/integrations" || subpath === "/integrations/") {
    if (method !== "GET") return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    const admin = await requireAdminAuth(request);
    if (!admin) return jsonError("Administrative access required", 403, "FORBIDDEN");

    return jsonSuccess({ integrations: getDetailedVideoIntegrationsStatus() });
  }

  // 2. List / Create meetings: GET / POST /api/meetings
  if (subpath === "/" || subpath === "") {
    if (method === "GET") {
      try {
        const snap = isAdmin
          ? await db.collection(COLLECTIONS.MEETINGS).get()
          : await db.collection(COLLECTIONS.MEETINGS).where("clientId", "==", user.uid).get();

        const meetings = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        meetings.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
          const tA = new Date(String(a.createdAt || 0)).getTime();
          const tB = new Date(String(b.createdAt || 0)).getTime();
          return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
        });
        return jsonSuccess({ meetings, count: meetings.length });
      } catch (err) {
        console.error("[Meetings Route] List error:", err);
        return jsonError("Failed to fetch meetings", 500, "DATABASE_ERROR");
      }
    }

    if (method === "POST") {
      const validated = await validateRequestBody(request, createMeetingSchema);
      if (!validated.success || !validated.data) {
        return jsonError(
          validated.error?.message || "Invalid meeting request payload",
          400,
          "INVALID_INPUT",
          validated.error?.details,
        );
      }

      const input = validated.data;
      const todayIso = new Date().toISOString().split("T")[0];
      if (input.preferredDate < todayIso) {
        return jsonError("Preferred date cannot be in the past.", 400, "INVALID_DATE");
      }

      // Resolve client's actual profile name & email from Firestore
      let clientName = user.email?.split("@")[0] || "Client";
      let clientEmail = user.email || "";
      let clientCompany = "";

      try {
        const [userDoc, clientDoc] = await Promise.all([
          db.collection(COLLECTIONS.USERS).doc(user.uid).get(),
          db.collection(COLLECTIONS.CLIENTS).doc(user.uid).get(),
        ]);
        if (userDoc.exists) {
          const u = userDoc.data() || {};
          clientName = String(u.fullName || u.name || clientName);
          clientEmail = String(u.email || clientEmail);
        }
        if (clientDoc.exists) {
          const c = clientDoc.data() || {};
          clientCompany = String(c.companyName || "");
        }
      } catch (lookupErr) {
        console.warn("[Meetings Route] Client profile lookup notice:", lookupErr);
      }

      const platform: MeetingPlatform =
        input.meetingType === "In-Person Meeting" ? "In-Person" : input.platform;
      const meetingType = platform === "In-Person" ? "In-Person Meeting" : "Online Meeting";

      const docRef = db.collection(COLLECTIONS.MEETINGS).doc();
      const now = new Date().toISOString();
      const scheduledAt = buildIsoSchedule(input.preferredDate, input.preferredTime);

      const meetingRecord = {
        id: docRef.id,
        clientId: user.uid,
        clientName,
        clientEmail,
        clientCompany,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.projectTitle ? { projectTitle: input.projectTitle } : {}),
        title: input.title.trim(),
        purpose: input.purpose.trim(),
        meetingType,
        platform,
        preferredDate: input.preferredDate,
        preferredTime: input.preferredTime,
        scheduledAt,
        status: "Pending",
        ...(input.notes?.trim() ? { adminNotes: input.notes.trim() } : {}),
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(meetingRecord);

      await logActivity({
        actorId: user.uid,
        actorRole: user.role,
        action: "meeting_requested",
        targetType: "meeting",
        targetId: docRef.id,
        metadata: {
          platform,
          preferredDate: input.preferredDate,
          preferredTime: input.preferredTime,
        },
      });

      await Promise.all([
        notifyAdminsMeetingRequested({
          meetingId: docRef.id,
          clientName,
          clientEmail,
          title: meetingRecord.title,
          purpose: meetingRecord.purpose,
          platform,
          preferredDate: input.preferredDate,
          preferredTime: input.preferredTime,
          projectId: input.projectId,
        }),
        notifyClientMeetingSubmitted({
          meetingId: docRef.id,
          clientUid: user.uid,
          clientEmail,
          clientName,
          title: meetingRecord.title,
          platform,
          preferredDate: input.preferredDate,
          preferredTime: input.preferredTime,
          projectId: input.projectId,
        }),
      ]);

      return jsonSuccess({ meeting: meetingRecord }, 201);
    }

    return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
  }

  // 3. Approve meeting (Admin only): POST /api/meetings/:id/approve
  const approveMatch = subpath.match(/^\/([a-zA-Z0-9_-]+)\/approve\/?$/);
  if (approveMatch) {
    if (method !== "POST") return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    const admin = await requireAdminAuth(request);
    if (!admin) return jsonError("Administrative access required", 403, "FORBIDDEN");

    const validated = await validateRequestBody(request, approveMeetingSchema);
    if (!validated.success || !validated.data) {
      return jsonError(
        validated.error?.message || "Invalid approval payload",
        400,
        "INVALID_INPUT",
        validated.error?.details,
      );
    }

    const meetingRef = db.collection(COLLECTIONS.MEETINGS).doc(approveMatch[1]);
    const snap = await meetingRef.get();
    if (!snap.exists) return jsonError("Meeting request not found", 404, "NOT_FOUND");
    const existing = snap.data() || {};

    if (existing.status === "Cancelled" || existing.status === "Completed") {
      return jsonError(
        `Cannot approve a meeting with status "${existing.status}".`,
        400,
        "INVALID_STATE",
      );
    }

    const body = validated.data;
    const platform: MeetingPlatform = body.platform || resolveMeetingPlatform(existing);
    const finalDate = body.finalDate || String(existing.preferredDate || "");
    const finalTime = body.finalTime || String(existing.preferredTime || "");
    const scheduledAt = buildIsoSchedule(finalDate, finalTime, body.scheduledAt);
    const now = new Date().toISOString();

    let meetingUrl = existing.meetingUrl ? String(existing.meetingUrl) : undefined;
    let meetingProvider = existing.meetingProvider ? String(existing.meetingProvider) : undefined;
    let externalEventId = existing.externalEventId ? String(existing.externalEventId) : undefined;

    if (platform !== "In-Person") {
      if (body.meetingUrl !== undefined && body.meetingUrl.trim()) {
        const urlCheck = validateMeetingUrlInput(body.meetingUrl, platform);
        if (!urlCheck.valid) {
          return jsonError(urlCheck.error || "Invalid meeting URL", 400, "INVALID_MEETING_URL");
        }
        meetingUrl = urlCheck.normalizedUrl;
        meetingProvider = "manual_admin";
      } else if (body.autoCreateLink) {
        try {
          if (platform === "Google Meet") {
            const created = await createGoogleMeetConference({
              meetingId: snap.id,
              title: String(existing.title || "VINORA Consultation"),
              purpose: String(existing.purpose || ""),
              startDateTimeIso: scheduledAt,
              clientEmail: existing.clientEmail ? String(existing.clientEmail) : undefined,
              clientName: existing.clientName ? String(existing.clientName) : undefined,
            });
            meetingUrl = created.meetingUrl;
            meetingProvider = created.provider;
            externalEventId = created.externalEventId;
          } else if (platform === "Microsoft Teams") {
            const created = await createMicrosoftTeamsMeeting({
              meetingId: snap.id,
              title: String(existing.title || "VINORA Consultation"),
              purpose: String(existing.purpose || ""),
              startDateTimeIso: scheduledAt,
              clientEmail: existing.clientEmail ? String(existing.clientEmail) : undefined,
              clientName: existing.clientName ? String(existing.clientName) : undefined,
            });
            meetingUrl = created.meetingUrl;
            meetingProvider = created.provider;
            externalEventId = created.externalEventId;
          }
        } catch (confErr: unknown) {
          const msg =
            confErr instanceof Error ? confErr.message : "Failed to generate meeting link.";
          const isMissingCreds =
            msg.includes("GOOGLE_MEET_NOT_CONFIGURED") || msg.includes("TEAMS_NOT_CONFIGURED");
          return jsonError(
            msg,
            isMissingCreds ? 503 : 502,
            isMissingCreds ? "VIDEO_API_NOT_CONFIGURED" : "VIDEO_API_ERROR",
          );
        }
      }
    }

    const updates: Record<string, unknown> = {
      status: "Approved",
      platform,
      meetingType: platform === "In-Person" ? "In-Person Meeting" : "Online Meeting",
      preferredDate: finalDate,
      preferredTime: finalTime,
      scheduledAt,
      approvedBy: admin.email || admin.uid,
      approvedAt: now,
      updatedAt: now,
    };

    if (meetingUrl) updates.meetingUrl = meetingUrl;
    if (meetingProvider) updates.meetingProvider = meetingProvider;
    if (externalEventId) updates.externalEventId = externalEventId;
    if (body.location !== undefined) updates.location = body.location.trim();
    if (body.adminNotes !== undefined) updates.adminNotes = body.adminNotes.trim();

    await meetingRef.update(updates);

    await logActivity({
      actorId: admin.uid,
      actorRole: admin.role,
      action: "meeting_approved",
      targetType: "meeting",
      targetId: snap.id,
      metadata: {
        platform,
        scheduledAt,
        hasMeetingUrl: Boolean(meetingUrl),
        meetingProvider: meetingProvider || "none",
      },
    });

    await notifyClientMeetingUpdated({
      meetingId: snap.id,
      clientUid: String(existing.clientId || ""),
      clientEmail: String(existing.clientEmail || ""),
      clientName: String(existing.clientName || "Client"),
      status: "Approved",
      title: String(existing.title || "Consultation"),
      platform,
      date: finalDate,
      time: finalTime,
      meetingUrl,
      previousMeetingUrl: existing.meetingUrl ? String(existing.meetingUrl) : undefined,
      location:
        body.location?.trim() || (existing.location ? String(existing.location) : undefined),
      adminNotes: body.adminNotes?.trim(),
      projectId: existing.projectId ? String(existing.projectId) : undefined,
    });

    return jsonSuccess({ meeting: { id: snap.id, ...existing, ...updates } });
  }

  // 4. Reschedule meeting (Admin only): POST /api/meetings/:id/reschedule
  const rescheduleMatch = subpath.match(/^\/([a-zA-Z0-9_-]+)\/reschedule\/?$/);
  if (rescheduleMatch) {
    if (method !== "POST") return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    const admin = await requireAdminAuth(request);
    if (!admin) return jsonError("Administrative access required", 403, "FORBIDDEN");

    const validated = await validateRequestBody(request, rescheduleMeetingSchema);
    if (!validated.success || !validated.data) {
      return jsonError(
        validated.error?.message || "Invalid reschedule payload",
        400,
        "INVALID_INPUT",
        validated.error?.details,
      );
    }

    const meetingRef = db.collection(COLLECTIONS.MEETINGS).doc(rescheduleMatch[1]);
    const snap = await meetingRef.get();
    if (!snap.exists) return jsonError("Meeting request not found", 404, "NOT_FOUND");
    const existing = snap.data() || {};

    const body = validated.data;
    const platform: MeetingPlatform = body.platform || resolveMeetingPlatform(existing);
    const scheduledAt = buildIsoSchedule(body.newDate, body.newTime, body.scheduledAt);
    const now = new Date().toISOString();

    let meetingUrl = existing.meetingUrl ? String(existing.meetingUrl) : undefined;
    let meetingProvider = existing.meetingProvider ? String(existing.meetingProvider) : undefined;
    let externalEventId = existing.externalEventId ? String(existing.externalEventId) : undefined;

    if (platform !== "In-Person") {
      if (body.meetingUrl !== undefined && body.meetingUrl.trim()) {
        const urlCheck = validateMeetingUrlInput(body.meetingUrl, platform);
        if (!urlCheck.valid) {
          return jsonError(urlCheck.error || "Invalid meeting URL", 400, "INVALID_MEETING_URL");
        }
        meetingUrl = urlCheck.normalizedUrl;
        meetingProvider = "manual_admin";
      } else if (body.autoCreateLink) {
        try {
          if (platform === "Google Meet") {
            const created = await createGoogleMeetConference({
              meetingId: snap.id,
              title: String(existing.title || "VINORA Consultation"),
              purpose: String(existing.purpose || ""),
              startDateTimeIso: scheduledAt,
              clientEmail: existing.clientEmail ? String(existing.clientEmail) : undefined,
              clientName: existing.clientName ? String(existing.clientName) : undefined,
            });
            meetingUrl = created.meetingUrl;
            meetingProvider = created.provider;
            externalEventId = created.externalEventId;
          } else if (platform === "Microsoft Teams") {
            const created = await createMicrosoftTeamsMeeting({
              meetingId: snap.id,
              title: String(existing.title || "VINORA Consultation"),
              purpose: String(existing.purpose || ""),
              startDateTimeIso: scheduledAt,
              clientEmail: existing.clientEmail ? String(existing.clientEmail) : undefined,
              clientName: existing.clientName ? String(existing.clientName) : undefined,
            });
            meetingUrl = created.meetingUrl;
            meetingProvider = created.provider;
            externalEventId = created.externalEventId;
          }
        } catch (confErr: unknown) {
          const msg =
            confErr instanceof Error ? confErr.message : "Failed to generate meeting link.";
          const isMissingCreds =
            msg.includes("GOOGLE_MEET_NOT_CONFIGURED") || msg.includes("TEAMS_NOT_CONFIGURED");
          return jsonError(
            msg,
            isMissingCreds ? 503 : 502,
            isMissingCreds ? "VIDEO_API_NOT_CONFIGURED" : "VIDEO_API_ERROR",
          );
        }
      }
    }

    const updates: Record<string, unknown> = {
      status: "Rescheduled",
      platform,
      meetingType: platform === "In-Person" ? "In-Person Meeting" : "Online Meeting",
      preferredDate: body.newDate,
      preferredTime: body.newTime,
      scheduledAt,
      rescheduleReason: body.rescheduleReason.trim(),
      approvedBy: admin.email || admin.uid,
      updatedAt: now,
    };
    if (meetingUrl) updates.meetingUrl = meetingUrl;
    if (meetingProvider) updates.meetingProvider = meetingProvider;
    if (externalEventId) updates.externalEventId = externalEventId;
    if (body.location !== undefined) updates.location = body.location.trim();
    if (body.adminNotes !== undefined) updates.adminNotes = body.adminNotes.trim();

    await meetingRef.update(updates);

    await notifyClientMeetingUpdated({
      meetingId: snap.id,
      clientUid: String(existing.clientId || ""),
      clientEmail: String(existing.clientEmail || ""),
      clientName: String(existing.clientName || "Client"),
      status: "Rescheduled",
      title: String(existing.title || "Consultation"),
      platform,
      date: body.newDate,
      time: body.newTime,
      meetingUrl,
      previousMeetingUrl: existing.meetingUrl ? String(existing.meetingUrl) : undefined,
      location: body.location?.trim(),
      reason: body.rescheduleReason.trim(),
      adminNotes: body.adminNotes?.trim(),
      projectId: existing.projectId ? String(existing.projectId) : undefined,
    });

    return jsonSuccess({ meeting: { id: snap.id, ...existing, ...updates } });
  }

  // 5. Reject meeting (Admin only): POST /api/meetings/:id/reject
  const rejectMatch = subpath.match(/^\/([a-zA-Z0-9_-]+)\/reject\/?$/);
  if (rejectMatch) {
    if (method !== "POST") return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    const admin = await requireAdminAuth(request);
    if (!admin) return jsonError("Administrative access required", 403, "FORBIDDEN");

    const validated = await validateRequestBody(request, rejectMeetingSchema);
    if (!validated.success || !validated.data) {
      return jsonError(
        validated.error?.message || "Rejection reason is required",
        400,
        "INVALID_INPUT",
        validated.error?.details,
      );
    }

    const meetingRef = db.collection(COLLECTIONS.MEETINGS).doc(rejectMatch[1]);
    const snap = await meetingRef.get();
    if (!snap.exists) return jsonError("Meeting request not found", 404, "NOT_FOUND");
    const existing = snap.data() || {};
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      status: "Rejected",
      rejectionReason: validated.data.rejectionReason.trim(),
      approvedBy: admin.email || admin.uid,
      updatedAt: now,
    };
    if (validated.data.adminNotes !== undefined) {
      updates.adminNotes = validated.data.adminNotes.trim();
    }

    await meetingRef.update(updates);

    await notifyClientMeetingUpdated({
      meetingId: snap.id,
      clientUid: String(existing.clientId || ""),
      clientEmail: String(existing.clientEmail || ""),
      clientName: String(existing.clientName || "Client"),
      status: "Rejected",
      title: String(existing.title || "Consultation"),
      platform: resolveMeetingPlatform(existing),
      date: String(existing.preferredDate || ""),
      time: String(existing.preferredTime || ""),
      reason: validated.data.rejectionReason.trim(),
      adminNotes: validated.data.adminNotes?.trim(),
      projectId: existing.projectId ? String(existing.projectId) : undefined,
    });

    return jsonSuccess({ meeting: { id: snap.id, ...existing, ...updates } });
  }

  // 6. Complete meeting (Admin only): POST /api/meetings/:id/complete
  const completeMatch = subpath.match(/^\/([a-zA-Z0-9_-]+)\/complete\/?$/);
  if (completeMatch) {
    if (method !== "POST") return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    const admin = await requireAdminAuth(request);
    if (!admin) return jsonError("Administrative access required", 403, "FORBIDDEN");

    const validated = await validateRequestBody(request, completeMeetingSchema);
    const meetingRef = db.collection(COLLECTIONS.MEETINGS).doc(completeMatch[1]);
    const snap = await meetingRef.get();
    if (!snap.exists) return jsonError("Meeting request not found", 404, "NOT_FOUND");
    const existing = snap.data() || {};
    const now = new Date().toISOString();

    const updates: Record<string, unknown> = {
      status: "Completed",
      updatedAt: now,
      ...(validated.data?.adminNotes ? { adminNotes: validated.data.adminNotes.trim() } : {}),
    };
    await meetingRef.update(updates);

    return jsonSuccess({ meeting: { id: snap.id, ...existing, ...updates } });
  }

  // 7. Cancel meeting (Client owner OR Admin): POST /api/meetings/:id/cancel
  const cancelMatch = subpath.match(/^\/([a-zA-Z0-9_-]+)\/cancel\/?$/);
  if (cancelMatch) {
    if (method !== "POST") return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");

    const meetingRef = db.collection(COLLECTIONS.MEETINGS).doc(cancelMatch[1]);
    const snap = await meetingRef.get();
    if (!snap.exists) return jsonError("Meeting request not found", 404, "NOT_FOUND");
    const existing = snap.data() || {};

    if (!isAdmin && String(existing.clientId || "") !== user.uid) {
      return jsonError(
        "Unauthorized: You cannot cancel another client's meeting.",
        403,
        "FORBIDDEN",
      );
    }

    if (existing.status === "Completed" || existing.status === "Rejected") {
      return jsonError(
        `Cannot cancel a meeting with status "${existing.status}".`,
        400,
        "INVALID_STATE",
      );
    }

    let reason = "";
    try {
      const validated = await validateRequestBody(request, cancelMeetingSchema);
      if (validated.success && validated.data?.cancellationReason) {
        reason = validated.data.cancellationReason.trim();
      }
    } catch {
      // Optional body
    }

    const now = new Date().toISOString();
    const updates = {
      status: "Cancelled",
      cancelledAt: now,
      cancelledBy: isAdmin
        ? adminLabel(user)
        : String(existing.clientName || user.email || user.uid),
      ...(reason ? { cancellationReason: reason } : {}),
      updatedAt: now,
    };

    await meetingRef.update(updates);

    if (isAdmin) {
      await notifyClientMeetingUpdated({
        meetingId: snap.id,
        clientUid: String(existing.clientId || ""),
        clientEmail: String(existing.clientEmail || ""),
        clientName: String(existing.clientName || "Client"),
        status: "Cancelled",
        title: String(existing.title || "Consultation"),
        platform: resolveMeetingPlatform(existing),
        date: String(existing.preferredDate || ""),
        time: String(existing.preferredTime || ""),
        reason: reason || "Cancelled by VINORA administration.",
        projectId: existing.projectId ? String(existing.projectId) : undefined,
      });
    } else {
      await notifyAdminsMeetingCancelledByClient({
        meetingId: snap.id,
        clientName: String(existing.clientName || "Client"),
        clientEmail: String(existing.clientEmail || user.email || ""),
        title: String(existing.title || "Consultation"),
        date: String(existing.preferredDate || ""),
        time: String(existing.preferredTime || ""),
        reason,
      });
    }

    return jsonSuccess({ meeting: { id: snap.id, ...existing, ...updates } });
  }

  return jsonError(`Endpoint /api/meetings${subpath} not found`, 404, "NOT_FOUND");
}

function adminLabel(user: { email: string | null; uid: string }): string {
  return user.email || user.uid;
}
