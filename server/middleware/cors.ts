import { getServerEnv } from "../config/env";

export function getCorsHeaders(request: Request): Headers {
  const env = getServerEnv();
  const origin = request.headers.get("origin") || "*";
  const allowedOrigin = env.CORS_ORIGIN === "*" ? origin : env.CORS_ORIGIN;

  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With, Accept",
  );
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");

  return headers;
}

export function handleOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}
