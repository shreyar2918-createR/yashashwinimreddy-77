import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db, auth, handleFirestoreError, OperationType } from "@/lib/firebase";
import type { MeetingPlatform, MeetingRequest, MeetingStatus, MeetingType } from "@/lib/types";

export interface CreateMeetingInput {
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientCompany?: string;
  projectId?: string;
  projectTitle?: string;
  title: string;
  purpose: string;
  meetingType: MeetingType;
  platform?: MeetingPlatform;
  preferredDate: string; // YYYY-MM-DD
  preferredTime: string; // e.g. "14:00"
  notes?: string;
}

export interface ApproveMeetingInput {
  meetingId: string;
  adminName: string;
  finalDate?: string;
  finalTime?: string;
  scheduledAt?: string;
  platform?: MeetingPlatform;
  autoCreateLink?: boolean;
  meetingUrl?: string;
  location?: string;
  adminNotes?: string;
}

export interface RescheduleMeetingInput {
  meetingId: string;
  adminName: string;
  newDate: string;
  newTime: string;
  scheduledAt?: string;
  rescheduleReason: string;
  platform?: MeetingPlatform;
  autoCreateLink?: boolean;
  meetingUrl?: string;
  location?: string;
  adminNotes?: string;
}

export interface RejectMeetingInput {
  meetingId: string;
  adminName: string;
  rejectionReason: string;
  adminNotes?: string;
}

export interface VideoIntegrationsStatus {
  googleMeet: {
    configured: boolean;
    mode: "oauth_refresh_token" | "service_account_delegation" | "unconfigured";
    missingEnvVars: string[];
  };
  microsoftTeams: {
    configured: boolean;
    mode: "graph_client_credentials" | "unconfigured";
    missingEnvVars: string[];
  };
}

async function getMeetingAuthHeader(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in to manage meetings.");
  }
  const token = await currentUser.getIdToken();
  return `Bearer ${token}`;
}

/**
 * Normalizes raw Firestore document data into a typed MeetingRequest object.
 */
function parseMeetingDoc(id: string, data: Record<string, unknown>): MeetingRequest {
  let status: MeetingStatus = "Pending";
  const rawStatus = (typeof data.status === "string" ? data.status : "").toLowerCase().trim();

  if (rawStatus === "approved" || rawStatus === "confirmed" || rawStatus === "scheduled") {
    status = "Approved";
  } else if (rawStatus === "rescheduled") {
    status = "Rescheduled";
  } else if (rawStatus === "cancelled" || rawStatus === "canceled") {
    status = "Cancelled";
  } else if (rawStatus === "rejected" || rawStatus === "declined") {
    status = "Rejected";
  } else if (rawStatus === "completed" || rawStatus === "done" || rawStatus === "finished") {
    status = "Completed";
  }

  const meetingType: MeetingType =
    data.meetingType === "In-Person Meeting" || data.type === "in_person"
      ? "In-Person Meeting"
      : "Online Meeting";

  let platform: MeetingPlatform = meetingType === "In-Person Meeting" ? "In-Person" : "Google Meet";
  if (
    data.platform === "Google Meet" ||
    data.platform === "Microsoft Teams" ||
    data.platform === "In-Person"
  ) {
    platform = data.platform;
  } else if (typeof data.meetingUrl === "string") {
    const lowerUrl = data.meetingUrl.toLowerCase();
    if (lowerUrl.includes("teams.microsoft.com") || lowerUrl.includes("teams.live.com")) {
      platform = "Microsoft Teams";
    }
  }

  return {
    id,
    clientId: typeof data.clientId === "string" ? data.clientId : "",
    clientName: typeof data.clientName === "string" ? data.clientName : "Client",
    clientEmail: typeof data.clientEmail === "string" ? data.clientEmail : "",
    clientCompany: typeof data.clientCompany === "string" ? data.clientCompany : "",
    projectId: typeof data.projectId === "string" ? data.projectId : undefined,
    projectTitle: typeof data.projectTitle === "string" ? data.projectTitle : undefined,
    title:
      typeof data.title === "string"
        ? data.title
        : typeof data.purpose === "string"
          ? data.purpose
          : "Architecture & Project Sync",
    purpose:
      typeof data.purpose === "string"
        ? data.purpose
        : typeof data.details === "string"
          ? data.details
          : "",
    meetingType,
    platform,
    meetingProvider: typeof data.meetingProvider === "string" ? data.meetingProvider : undefined,
    preferredDate: typeof data.preferredDate === "string" ? data.preferredDate : "",
    preferredTime: typeof data.preferredTime === "string" ? data.preferredTime : "",
    scheduledAt: typeof data.scheduledAt === "string" ? data.scheduledAt : undefined,
    meetingUrl: typeof data.meetingUrl === "string" ? data.meetingUrl : undefined,
    location: typeof data.location === "string" ? data.location : undefined,
    status,
    adminNotes: typeof data.adminNotes === "string" ? data.adminNotes : undefined,
    rescheduleReason: typeof data.rescheduleReason === "string" ? data.rescheduleReason : undefined,
    rejectionReason: typeof data.rejectionReason === "string" ? data.rejectionReason : undefined,
    cancellationReason:
      typeof data.cancellationReason === "string" ? data.cancellationReason : undefined,
    cancelledBy: typeof data.cancelledBy === "string" ? data.cancelledBy : undefined,
    cancelledAt: typeof data.cancelledAt === "string" ? data.cancelledAt : undefined,
    approvedBy: typeof data.approvedBy === "string" ? data.approvedBy : undefined,
    approvedAt: typeof data.approvedAt === "string" ? data.approvedAt : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date().toISOString(),
  };
}

/**
 * Checks whether Google Calendar Meet API & Microsoft Graph Teams API credentials are configured.
 */
export async function getMeetingIntegrationsStatus(): Promise<VideoIntegrationsStatus> {
  const authHeader = await getMeetingAuthHeader();
  const res = await fetch("/api/meetings/integrations", {
    headers: { Authorization: authHeader },
  });
  const json = (await res.json()) as {
    success: boolean;
    data?: { integrations: VideoIntegrationsStatus };
    error?: { message: string };
  };
  if (!res.ok || !json.success || !json.data?.integrations) {
    throw new Error(json.error?.message || "Failed to fetch video integration status.");
  }
  return json.data.integrations;
}

/**
 * Creates and submits a new meeting request via backend API (stores record + notifies admins).
 */
export async function createMeetingRequest(input: CreateMeetingInput): Promise<MeetingRequest> {
  if (!input.clientId) {
    throw new Error("Client ID is required to request a meeting.");
  }
  if (!input.preferredDate || !input.preferredTime) {
    throw new Error("Please select both a preferred date and time.");
  }
  if (!input.purpose?.trim()) {
    throw new Error("Please provide the purpose of the meeting.");
  }

  const platform: MeetingPlatform =
    input.meetingType === "In-Person Meeting" ? "In-Person" : input.platform || "Google Meet";

  const authHeader = await getMeetingAuthHeader();
  const res = await fetch("/api/meetings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      title: input.title?.trim() || `${platform}: ${input.purpose.slice(0, 45)}`,
      purpose: input.purpose.trim(),
      platform,
      meetingType: input.meetingType,
      preferredDate: input.preferredDate,
      preferredTime: input.preferredTime,
      projectId: input.projectId || undefined,
      projectTitle: input.projectTitle || undefined,
      notes: input.notes?.trim() || undefined,
    }),
  });

  const json = (await res.json()) as {
    success: boolean;
    data?: { meeting: Record<string, unknown> };
    error?: { message: string };
  };

  if (!res.ok || !json.success || !json.data?.meeting) {
    throw new Error(json.error?.message || "Failed to submit meeting request.");
  }

  return parseMeetingDoc(String(json.data.meeting.id || ""), json.data.meeting);
}

/**
 * Real-time subscription to meetings for a specific client.
 */
export function subscribeClientMeetings(
  clientId: string,
  onData: (meetings: MeetingRequest[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  if (!clientId) {
    onData([]);
    return () => {};
  }

  const q = query(collection(db, "meetings"), where("clientId", "==", clientId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: MeetingRequest[] = [];
      snapshot.forEach((docSnap) => {
        list.push(parseMeetingDoc(docSnap.id, docSnap.data()));
      });

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    (err) => {
      console.error(
        `[VINORA Meetings] Failed subscribing to meetings for client ${clientId}:`,
        err,
      );
      if (onError) onError(err);
    },
  );
}

/**
 * Fetches all meeting requests for a specific client once.
 */
export async function fetchClientMeetings(clientId: string): Promise<MeetingRequest[]> {
  if (!clientId) return [];
  try {
    const q = query(collection(db, "meetings"), where("clientId", "==", clientId));
    const snapshot = await getDocs(q);
    const list: MeetingRequest[] = [];
    snapshot.forEach((docSnap) => {
      list.push(parseMeetingDoc(docSnap.id, docSnap.data()));
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `meetings?clientId=${clientId}`);
    return [];
  }
}

/**
 * Real-time subscription to all meeting requests for the Admin Dashboard.
 */
export function subscribeAllMeetings(
  onData: (meetings: MeetingRequest[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const colRef = collection(db, "meetings");

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: MeetingRequest[] = [];
      snapshot.forEach((docSnap) => {
        list.push(parseMeetingDoc(docSnap.id, docSnap.data()));
      });

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    (err) => {
      console.error("[VINORA Meetings] Admin subscription error:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * Fetches all meeting requests for the Admin Dashboard once.
 */
export async function fetchAllMeetings(): Promise<MeetingRequest[]> {
  try {
    const snapshot = await getDocs(collection(db, "meetings"));
    const list: MeetingRequest[] = [];
    snapshot.forEach((docSnap) => {
      list.push(parseMeetingDoc(docSnap.id, docSnap.data()));
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "meetings");
    return [];
  }
}

/**
 * Admin action: Approve a meeting request via backend API (creates real conference link or attaches manual URL & notifies client).
 */
export async function approveMeeting(input: ApproveMeetingInput): Promise<MeetingRequest> {
  const authHeader = await getMeetingAuthHeader();
  const res = await fetch(`/api/meetings/${encodeURIComponent(input.meetingId)}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      finalDate: input.finalDate || undefined,
      finalTime: input.finalTime || undefined,
      scheduledAt: input.scheduledAt || undefined,
      platform: input.platform,
      autoCreateLink: Boolean(input.autoCreateLink),
      meetingUrl: input.meetingUrl?.trim() || undefined,
      location: input.location?.trim() || undefined,
      adminNotes: input.adminNotes?.trim() || undefined,
    }),
  });

  const json = (await res.json()) as {
    success: boolean;
    data?: { meeting: Record<string, unknown> };
    error?: { message: string };
  };

  if (!res.ok || !json.success || !json.data?.meeting) {
    throw new Error(json.error?.message || "Failed to approve meeting.");
  }

  return parseMeetingDoc(String(json.data.meeting.id || input.meetingId), json.data.meeting);
}

/**
 * Admin action: Reschedule a meeting request via backend API & notify client.
 */
export async function rescheduleMeeting(input: RescheduleMeetingInput): Promise<MeetingRequest> {
  const authHeader = await getMeetingAuthHeader();
  const res = await fetch(`/api/meetings/${encodeURIComponent(input.meetingId)}/reschedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      newDate: input.newDate,
      newTime: input.newTime,
      scheduledAt: input.scheduledAt || undefined,
      rescheduleReason: input.rescheduleReason.trim(),
      platform: input.platform,
      autoCreateLink: Boolean(input.autoCreateLink),
      meetingUrl: input.meetingUrl?.trim() || undefined,
      location: input.location?.trim() || undefined,
      adminNotes: input.adminNotes?.trim() || undefined,
    }),
  });

  const json = (await res.json()) as {
    success: boolean;
    data?: { meeting: Record<string, unknown> };
    error?: { message: string };
  };

  if (!res.ok || !json.success || !json.data?.meeting) {
    throw new Error(json.error?.message || "Failed to reschedule meeting.");
  }

  return parseMeetingDoc(String(json.data.meeting.id || input.meetingId), json.data.meeting);
}

/**
 * Admin action: Reject a meeting request via backend API & notify client.
 */
export async function rejectMeeting(input: RejectMeetingInput): Promise<MeetingRequest> {
  const authHeader = await getMeetingAuthHeader();
  const res = await fetch(`/api/meetings/${encodeURIComponent(input.meetingId)}/reject`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      rejectionReason: input.rejectionReason.trim(),
      adminNotes: input.adminNotes?.trim() || undefined,
    }),
  });

  const json = (await res.json()) as {
    success: boolean;
    data?: { meeting: Record<string, unknown> };
    error?: { message: string };
  };

  if (!res.ok || !json.success || !json.data?.meeting) {
    throw new Error(json.error?.message || "Failed to decline meeting.");
  }

  return parseMeetingDoc(String(json.data.meeting.id || input.meetingId), json.data.meeting);
}

/**
 * Admin action: Mark a meeting as Completed via backend API.
 */
export async function completeMeeting(
  meetingId: string,
  params?: { adminNotes?: string },
): Promise<MeetingRequest> {
  const authHeader = await getMeetingAuthHeader();
  const res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      adminNotes: params?.adminNotes?.trim() || undefined,
    }),
  });

  const json = (await res.json()) as {
    success: boolean;
    data?: { meeting: Record<string, unknown> };
    error?: { message: string };
  };

  if (!res.ok || !json.success || !json.data?.meeting) {
    throw new Error(json.error?.message || "Failed to complete meeting.");
  }

  return parseMeetingDoc(String(json.data.meeting.id || meetingId), json.data.meeting);
}

/**
 * Client owner or Admin action: Cancel a meeting request via backend API & notify opposite party.
 */
export async function cancelMeeting(
  meetingId: string,
  cancellationReason?: string,
): Promise<MeetingRequest> {
  const authHeader = await getMeetingAuthHeader();
  const res = await fetch(`/api/meetings/${encodeURIComponent(meetingId)}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify({
      cancellationReason: cancellationReason?.trim() || undefined,
    }),
  });

  const json = (await res.json()) as {
    success: boolean;
    data?: { meeting: Record<string, unknown> };
    error?: { message: string };
  };

  if (!res.ok || !json.success || !json.data?.meeting) {
    throw new Error(json.error?.message || "Failed to cancel meeting.");
  }

  return parseMeetingDoc(String(json.data.meeting.id || meetingId), json.data.meeting);
}
