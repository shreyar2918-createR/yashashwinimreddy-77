import crypto from "crypto";
import { getServerEnv } from "../config/env";

export type MeetingPlatform = "Google Meet" | "Microsoft Teams" | "In-Person";

export interface VideoIntegrationsStatus {
  googleMeetConfigured: boolean;
  googleMeetMode: "oauth2" | "service_account_delegation" | "unconfigured";
  teamsConfigured: boolean;
  teamsMode: "graph_client_credentials" | "unconfigured";
}

export interface CreateConferenceParams {
  meetingId: string;
  title: string;
  purpose: string;
  startDateTimeIso: string;
  durationMinutes?: number;
  clientEmail?: string;
  clientName?: string;
}

export interface CreatedConferenceResult {
  meetingUrl: string;
  provider: "google_calendar_meet" | "microsoft_graph_teams";
  externalEventId: string;
}

export interface DetailedVideoIntegrationsStatus {
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

/**
 * Inspects server environment credentials to accurately report whether
 * Google Calendar Meet API and Microsoft Graph Teams API are configured.
 * Never exposes secret keys.
 */
export function getVideoIntegrationsStatus(): VideoIntegrationsStatus {
  const env = getServerEnv();

  const hasGoogleOAuth = Boolean(
    (env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID) &&
    (env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET) &&
    (env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN),
  );

  const hasServiceAccountDelegation = Boolean(
    (env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL) &&
    (env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY) &&
    (env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL || process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL),
  );

  const googleMeetConfigured = hasGoogleOAuth || hasServiceAccountDelegation;
  const googleMeetMode = hasGoogleOAuth
    ? "oauth2"
    : hasServiceAccountDelegation
      ? "service_account_delegation"
      : "unconfigured";

  const teamsConfigured = Boolean(
    (env.AZURE_TENANT_ID || process.env.AZURE_TENANT_ID) &&
    (env.AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID) &&
    (env.AZURE_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET) &&
    (env.MS_TEAMS_ORGANIZER_USER_ID || process.env.MS_TEAMS_ORGANIZER_USER_ID),
  );

  return {
    googleMeetConfigured,
    googleMeetMode,
    teamsConfigured,
    teamsMode: teamsConfigured ? "graph_client_credentials" : "unconfigured",
  };
}

/**
 * Returns the structured integrations object expected by AdminMeetingsSection & meetingService.
 */
export function getDetailedVideoIntegrationsStatus(): DetailedVideoIntegrationsStatus {
  const env = getServerEnv();
  const base = getVideoIntegrationsStatus();

  const googleMissing: string[] = [];
  if (!base.googleMeetConfigured) {
    if (!(env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID)) {
      googleMissing.push("GOOGLE_CLIENT_ID");
    }
    if (!(env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET)) {
      googleMissing.push("GOOGLE_CLIENT_SECRET");
    }
    if (!(env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN)) {
      googleMissing.push("GOOGLE_REFRESH_TOKEN");
    }
  }

  const teamsMissing: string[] = [];
  if (!base.teamsConfigured) {
    if (!(env.AZURE_TENANT_ID || process.env.AZURE_TENANT_ID)) {
      teamsMissing.push("AZURE_TENANT_ID");
    }
    if (!(env.AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID)) {
      teamsMissing.push("AZURE_CLIENT_ID");
    }
    if (!(env.AZURE_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET)) {
      teamsMissing.push("AZURE_CLIENT_SECRET");
    }
    if (!(env.MS_TEAMS_ORGANIZER_USER_ID || process.env.MS_TEAMS_ORGANIZER_USER_ID)) {
      teamsMissing.push("MS_TEAMS_ORGANIZER_USER_ID");
    }
  }

  return {
    googleMeet: {
      configured: base.googleMeetConfigured,
      mode:
        base.googleMeetMode === "oauth2"
          ? "oauth_refresh_token"
          : base.googleMeetMode === "service_account_delegation"
            ? "service_account_delegation"
            : "unconfigured",
      missingEnvVars: googleMissing,
    },
    microsoftTeams: {
      configured: base.teamsConfigured,
      mode: base.teamsMode,
      missingEnvVars: teamsMissing,
    },
  };
}

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getGoogleAccessToken(): Promise<string> {
  const env = getServerEnv();
  const clientId = env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = env.GOOGLE_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(`Google OAuth token exchange failed (${tokenRes.status}): ${errText}`);
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new Error("Google OAuth response did not include access_token.");
    }
    return tokenJson.access_token;
  }

  const clientEmail = env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY;
  const impersonateEmail =
    env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL || process.env.GOOGLE_CALENDAR_IMPERSONATE_EMAIL;

  if (clientEmail && privateKeyRaw && impersonateEmail) {
    const nowSec = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claimSet = base64UrlEncode(
      JSON.stringify({
        iss: clientEmail,
        sub: impersonateEmail,
        scope: "https://www.googleapis.com/auth/calendar.events",
        aud: "https://oauth2.googleapis.com/token",
        iat: nowSec,
        exp: nowSec + 3600,
      }),
    );

    const signingInput = `${header}.${claimSet}`;
    const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
    const signer = crypto.createSign("RSA-SHA256");
    signer.update(signingInput);
    const signature = base64UrlEncode(signer.sign(privateKey));
    const assertion = `${signingInput}.${signature}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      throw new Error(
        `Google Service Account JWT exchange failed (${tokenRes.status}): ${errText}`,
      );
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      throw new Error("Google Service Account token response missing access_token.");
    }
    return tokenJson.access_token;
  }

  throw new Error(
    "GOOGLE_MEET_NOT_CONFIGURED: Google Calendar API credentials (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN or Workspace delegation) are not configured on the server.",
  );
}

/**
 * Creates a real Google Calendar event with Google Meet conferenceData.
 * Throws if credentials are missing or Google Calendar API fails. Never fakes a Meet URL.
 */
export async function createGoogleMeetConference(
  params: CreateConferenceParams,
): Promise<CreatedConferenceResult> {
  const status = getVideoIntegrationsStatus();
  if (!status.googleMeetConfigured) {
    throw new Error(
      "GOOGLE_MEET_NOT_CONFIGURED: Google Calendar API credentials are missing on the server. Paste an existing Google Meet link manually or configure server credentials.",
    );
  }

  const accessToken = await getGoogleAccessToken();
  const env = getServerEnv();
  const calendarId = env.GOOGLE_CALENDAR_ID || process.env.GOOGLE_CALENDAR_ID || "primary";

  const startDate = new Date(params.startDateTimeIso);
  if (isNaN(startDate.getTime())) {
    throw new Error("Invalid meeting start date/time for Google Calendar event.");
  }
  const durationMs = (params.durationMinutes ?? 45) * 60 * 1000;
  const endDate = new Date(startDate.getTime() + durationMs);

  const attendees = params.clientEmail
    ? [{ email: params.clientEmail, displayName: params.clientName || undefined }]
    : [];

  const endpoint = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
    calendarId,
  )}/events?conferenceDataVersion=1&sendUpdates=${attendees.length > 0 ? "all" : "none"}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: `VINORA: ${params.title}`,
      description: params.purpose,
      start: {
        dateTime: startDate.toISOString(),
        timeZone: "UTC",
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: "UTC",
      },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `vinora-${params.meetingId}-${Date.now()}`,
          conferenceSolutionKey: {
            type: "hangoutsMeet",
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Calendar API error (${response.status}): ${errText}`);
  }

  const eventData = (await response.json()) as {
    id?: string;
    hangoutLink?: string;
    conferenceData?: {
      entryPoints?: Array<{ entryPointType?: string; uri?: string }>;
    };
  };

  const meetUrl =
    eventData.hangoutLink ||
    eventData.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")?.uri;

  if (!meetUrl) {
    throw new Error(
      "Google Calendar event was created, but Google did not return a Meet conference link. Ensure Google Meet is enabled for the target calendar.",
    );
  }

  return {
    meetingUrl: meetUrl,
    provider: "google_calendar_meet",
    externalEventId: eventData.id || "",
  };
}

/**
 * Creates a real Microsoft Teams online meeting via Microsoft Graph API.
 * Throws if credentials are missing or Microsoft Graph API fails. Never fakes a Teams URL.
 */
export async function createMicrosoftTeamsMeeting(
  params: CreateConferenceParams,
): Promise<CreatedConferenceResult> {
  const status = getVideoIntegrationsStatus();
  if (!status.teamsConfigured) {
    throw new Error(
      "TEAMS_NOT_CONFIGURED: Microsoft Graph API credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, MS_TEAMS_ORGANIZER_USER_ID) are missing on the server. Paste an existing Microsoft Teams link manually or configure server credentials.",
    );
  }

  const env = getServerEnv();
  const tenantId = env.AZURE_TENANT_ID || process.env.AZURE_TENANT_ID!;
  const clientId = env.AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID!;
  const clientSecret = env.AZURE_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET!;
  const organizerUserId = env.MS_TEAMS_ORGANIZER_USER_ID || process.env.MS_TEAMS_ORGANIZER_USER_ID!;

  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Microsoft Graph token acquisition failed (${tokenRes.status}): ${errText}`);
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) {
    throw new Error("Microsoft Graph token response did not include access_token.");
  }

  const startDate = new Date(params.startDateTimeIso);
  if (isNaN(startDate.getTime())) {
    throw new Error("Invalid meeting start date/time for Microsoft Teams onlineMeeting.");
  }
  const endDate = new Date(startDate.getTime() + (params.durationMinutes ?? 45) * 60 * 1000);

  const attendees = params.clientEmail
    ? [
        {
          upn: params.clientEmail,
          identity: {
            user: {
              displayName: params.clientName || params.clientEmail,
            },
          },
        },
      ]
    : [];

  const graphUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    organizerUserId,
  )}/onlineMeetings`;

  const meetingRes = await fetch(graphUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      startDateTime: startDate.toISOString(),
      endDateTime: endDate.toISOString(),
      subject: `VINORA: ${params.title}`,
      ...(attendees.length > 0 ? { participants: { attendees } } : {}),
    }),
  });

  if (!meetingRes.ok) {
    const errText = await meetingRes.text();
    throw new Error(`Microsoft Graph onlineMeetings API error (${meetingRes.status}): ${errText}`);
  }

  const meetingData = (await meetingRes.json()) as { id?: string; joinWebUrl?: string };
  if (!meetingData.joinWebUrl) {
    throw new Error("Microsoft Graph did not return a joinWebUrl for the Teams meeting.");
  }

  return {
    meetingUrl: meetingData.joinWebUrl,
    provider: "microsoft_graph_teams",
    externalEventId: meetingData.id || "",
  };
}

/**
 * Validates manually entered meeting URLs to enforce HTTPS and reject fake/placeholder links.
 */
export function validateMeetingUrlInput(
  rawUrl: string,
  platform: MeetingPlatform,
): { valid: boolean; normalizedUrl?: string; error?: string } {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { valid: true, normalizedUrl: undefined };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Please enter a valid HTTPS meeting URL." };
  }

  if (parsed.protocol !== "https:") {
    return { valid: false, error: "Meeting links must use secure https:// URLs." };
  }

  if (trimmed.includes("vin-arch-sync")) {
    return { valid: false, error: "Placeholder meeting links are not permitted." };
  }

  const host = parsed.hostname.toLowerCase();
  if (platform === "Google Meet") {
    const isGoogleHost = host === "meet.google.com" || host.endsWith(".meet.google.com");
    if (!isGoogleHost) {
      return {
        valid: false,
        error: "Google Meet links must point to https://meet.google.com/...",
      };
    }
  } else if (platform === "Microsoft Teams") {
    const isTeamsHost =
      host === "teams.microsoft.com" ||
      host.endsWith(".teams.microsoft.com") ||
      host === "teams.live.com" ||
      host.endsWith(".teams.live.com");
    if (!isTeamsHost) {
      return {
        valid: false,
        error:
          "Microsoft Teams links must point to https://teams.microsoft.com/... or https://teams.live.com/...",
      };
    }
  }

  return { valid: true, normalizedUrl: parsed.toString() };
}
