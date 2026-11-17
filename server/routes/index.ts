import { handleOptions, getCorsHeaders } from "../middleware/cors";
import {
  checkRateLimit,
  STRICT_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  DEFAULT_RATE_LIMIT,
} from "../middleware/rate-limiter";
import { jsonError } from "../utils/response";
import { handleHealthRoute } from "./health";
import { handleAuthRoute } from "./auth";
import { handleClientsRoute } from "./clients";
import { handleAdminRoute } from "./admin";
import { handleProjectsRoute } from "./projects";
import { handleProjectRequestsRoute } from "./project-requests";
import { handleContactRoute } from "./contact";
import { handleMessagesRoute } from "./messages";
import { handleMeetingsRoute } from "./meetings";
import { handleRequestsRoute } from "./requests";
import { handleDocumentsRoute } from "./documents";
import { handleProposalsRoute } from "./proposals";
import { handleInvoicesRoute } from "./invoices";
import { handlePaymentsRoute } from "./payments";
import { handleShowcaseRoute } from "./showcase";
import { handleReferralsRoute } from "./referrals";
import { handleAiRoute } from "./ai";
import { handleNotificationsRoute } from "./notifications";

export async function handleApiRequest(request: Request): Promise<Response> {
  // 1. Handle CORS Preflight
  if (request.method === "OPTIONS") {
    return handleOptions(request);
  }

  const corsHeaders = getCorsHeaders(request);
  const url = new URL(request.url);
  const path = url.pathname;

  // 2. Determine Rate Limit Tier
  let rateLimitConfig = DEFAULT_RATE_LIMIT;
  if (path.startsWith("/api/auth")) {
    rateLimitConfig = AUTH_RATE_LIMIT;
  } else if (path.startsWith("/api/contact") || path.startsWith("/api/project-requests")) {
    rateLimitConfig = STRICT_RATE_LIMIT;
  }

  const rateCheck = checkRateLimit(request, rateLimitConfig);
  if (!rateCheck.allowed) {
    corsHeaders.set("Retry-After", String(rateCheck.retryAfterSeconds));
    return jsonError(
      `Rate limit exceeded. Please retry after ${rateCheck.retryAfterSeconds} seconds.`,
      429,
      "RATE_LIMIT_EXCEEDED",
      undefined,
      corsHeaders,
    );
  }

  // 3. Route Dispatcher
  try {
    let response: Response;

    if (
      path === "/api/health" ||
      path === "/api/health/" ||
      path === "/health" ||
      path === "/_health"
    ) {
      response = await handleHealthRoute(request);
    } else if (path.startsWith("/api/auth")) {
      const subpath = path.slice("/api/auth".length) || "/";
      response = await handleAuthRoute(request, subpath);
    } else if (path.startsWith("/api/clients")) {
      const subpath = path.slice("/api/clients".length) || "/";
      response = await handleClientsRoute(request, subpath);
    } else if (path.startsWith("/api/admin")) {
      const subpath = path.slice("/api/admin".length) || "/";
      response = await handleAdminRoute(request, subpath);
    } else if (path.startsWith("/api/projects")) {
      const subpath = path.slice("/api/projects".length) || "/";
      response = await handleProjectsRoute(request, subpath);
    } else if (path.startsWith("/api/project-requests")) {
      const subpath = path.slice("/api/project-requests".length) || "/";
      response = await handleProjectRequestsRoute(request, subpath);
    } else if (path.startsWith("/api/contact")) {
      const subpath = path.slice("/api/contact".length) || "/";
      response = await handleContactRoute(request, subpath);
    } else if (path.startsWith("/api/messages")) {
      const subpath = path.slice("/api/messages".length) || "/";
      response = await handleMessagesRoute(request, subpath);
    } else if (path.startsWith("/api/meetings")) {
      const subpath = path.slice("/api/meetings".length) || "/";
      response = await handleMeetingsRoute(request, subpath);
    } else if (path.startsWith("/api/requests")) {
      const subpath = path.slice("/api/requests".length) || "/";
      response = await handleRequestsRoute(request, subpath);
    } else if (path.startsWith("/api/documents")) {
      const subpath = path.slice("/api/documents".length) || "/";
      response = await handleDocumentsRoute(request, subpath);
    } else if (path.startsWith("/api/proposals")) {
      const subpath = path.slice("/api/proposals".length) || "/";
      response = await handleProposalsRoute(request, subpath);
    } else if (path.startsWith("/api/invoices")) {
      const subpath = path.slice("/api/invoices".length) || "/";
      response = await handleInvoicesRoute(request, subpath);
    } else if (path.startsWith("/api/payments")) {
      const subpath = path.slice("/api/payments".length) || "/";
      response = await handlePaymentsRoute(request, subpath);
    } else if (path.startsWith("/api/showcase")) {
      const subpath = path.slice("/api/showcase".length) || "/";
      response = await handleShowcaseRoute(request, subpath);
    } else if (path.startsWith("/api/referrals")) {
      const subpath = path.slice("/api/referrals".length) || "/";
      response = await handleReferralsRoute(request, subpath);
    } else if (path.startsWith("/api/ai")) {
      const subpath = path.slice("/api/ai".length) || "/";
      response = await handleAiRoute(request, subpath);
    } else if (path.startsWith("/api/notifications")) {
      const subpath = path.slice("/api/notifications".length) || "/";
      response = await handleNotificationsRoute(request, subpath);
    } else {
      response = jsonError(`Endpoint not found: ${path}`, 404, "NOT_FOUND");
    }

    // Merge CORS headers onto response
    const finalHeaders = new Headers(response.headers);
    corsHeaders.forEach((val, key) => {
      finalHeaders.set(key, val);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders,
    });
  } catch (error) {
    console.error("API Unhandled Error:", error);
    return jsonError(
      "An unexpected server error occurred.",
      500,
      "INTERNAL_SERVER_ERROR",
      undefined,
      corsHeaders,
    );
  }
}
