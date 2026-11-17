import type { ApiResponse } from "../types";

export function jsonSuccess<T>(data: T, status = 200, customHeaders?: HeadersInit): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...customHeaders,
  });

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

export function jsonError(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
  details?: unknown,
  customHeaders?: HeadersInit,
): Response {
  const body: ApiResponse<null> = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    meta: {
      timestamp: new Date().toISOString(),
    },
  };

  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    ...customHeaders,
  });

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}
