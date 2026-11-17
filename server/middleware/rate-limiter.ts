interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
}

const ipBuckets = new Map<string, RateLimitBucket>();

export interface RateLimitConfig {
  maxRequests: number; // max bucket capacity
  windowMs: number; // time window in ms
}

export const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60 * 1000, // 100 requests per minute
};

export const STRICT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 10 requests per minute (e.g. contact, inquiry)
};

export const AUTH_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 25,
  windowMs: 60 * 1000, // 25 requests per minute for auth flows (OTP, verification, account creation)
};

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Checks if the request is within rate limits.
 * Returns null if allowed, or retryAfterSeconds if exceeded.
 */
export function checkRateLimit(
  request: Request,
  config: RateLimitConfig = DEFAULT_RATE_LIMIT,
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const ip = getClientIp(request);
  const now = Date.now();

  let bucket = ipBuckets.get(ip);
  if (!bucket) {
    bucket = { tokens: config.maxRequests, lastRefill: now };
    ipBuckets.set(ip, bucket);
  }

  // Refill tokens proportionally
  const elapsed = now - bucket.lastRefill;
  const refillRate = config.maxRequests / config.windowMs;
  const tokensToAdd = elapsed * refillRate;

  bucket.tokens = Math.min(config.maxRequests, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      retryAfterSeconds: 0,
    };
  }

  const missingTokens = 1 - bucket.tokens;
  const retryAfterSeconds = Math.ceil(missingTokens / (refillRate * 1000));

  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds,
  };
}
