import crypto from "node:crypto";
import { getAdminDb, isFirebaseAdminInitialized } from "../config/firebase-admin";

export interface OtpRecord {
  requestId: string;
  identifier: string; // Lowercase email or normalized phone
  type: "email" | "phone";
  otpHash: string;
  salt: string;
  createdAt: number;
  expiresAt: number;
  cooldownUntil: number;
  attemptCount: number;
  maxAttempts: number;
  verified: boolean;
  verifiedAt: number | null;
  usedAt: number | null;
  status: "pending" | "verified" | "consumed" | "expired" | "invalidated" | "max_attempts_exceeded";
  verificationToken?: string;
}

// In-memory sliding cache ensuring immediate reliable runtime state
const otpStore = new Map<string, OtpRecord>();
// Identifier to active requestId index
const activeRequestByIdentifier = new Map<string, string>();
// Sliding window of recent request timestamps per identifier for hourly rate limiting
const requestHistoryByIdentifier = new Map<string, number[]>();
// Verification token to requestId index
const verificationTokens = new Map<string, string>();

const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5;
const MAX_HOURLY_REQUESTS = 5; // Max OTP requests per identifier per hour
const HOURLY_WINDOW_MS = 60 * 60 * 1000;
const VERIFICATION_TOKEN_VALIDITY_MS = 15 * 60 * 1000; // 15 minutes to complete password setup

function hashOtp(otp: string, salt: string): string {
  return crypto.createHmac("sha256", salt).update(otp).digest("hex");
}

function generateSecureOtp(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Loads an OtpRecord from Firestore by requestId if not found in memory.
 */
async function fetchOtpFromFirestore(requestId: string): Promise<OtpRecord | null> {
  if (!isFirebaseAdminInitialized()) return null;
  try {
    const db = getAdminDb();
    const doc = await db.collection("otpRequests").doc(requestId).get();
    if (!doc.exists) return null;

    const data = doc.data();
    if (!data) return null;

    const createdAt =
      typeof data.createdAt === "string"
        ? new Date(data.createdAt).getTime()
        : Number(data.createdAt || Date.now());
    const expiresAt =
      typeof data.expiresAt === "string"
        ? new Date(data.expiresAt).getTime()
        : Number(data.expiresAt || createdAt + OTP_EXPIRY_MS);
    const cooldownUntil =
      typeof data.cooldownUntil === "string"
        ? new Date(data.cooldownUntil).getTime()
        : Number(data.cooldownUntil || createdAt + RESEND_COOLDOWN_MS);
    const verifiedAt = data.verifiedAt
      ? typeof data.verifiedAt === "string"
        ? new Date(data.verifiedAt).getTime()
        : Number(data.verifiedAt)
      : null;
    const usedAt =
      data.consumedAt || data.usedAt
        ? typeof (data.consumedAt || data.usedAt) === "string"
          ? new Date(data.consumedAt || data.usedAt).getTime()
          : Number(data.consumedAt || data.usedAt)
        : null;

    const record: OtpRecord = {
      requestId: data.id || requestId,
      identifier: data.identifier,
      type: data.type || "email",
      otpHash: data.otpHash,
      salt: data.salt,
      createdAt,
      expiresAt,
      cooldownUntil,
      attemptCount: Number(data.attempts ?? data.attemptCount ?? 0),
      maxAttempts: Number(data.maxAttempts ?? MAX_ATTEMPTS),
      verified: Boolean(data.verified),
      verifiedAt,
      usedAt,
      status: data.status || "pending",
      verificationToken: data.verificationToken,
    };

    return record;
  } catch (err) {
    console.warn("Could not read otpRequests from Firestore:", err);
    return null;
  }
}

/**
 * Safely persists OTP metadata to the 'otpRequests' Firestore collection.
 */
async function syncOtpToFirestore(record: OtpRecord): Promise<void> {
  if (!isFirebaseAdminInitialized()) return;
  try {
    const db = getAdminDb();
    await db
      .collection("otpRequests")
      .doc(record.requestId)
      .set(
        {
          id: record.requestId,
          identifier: record.identifier,
          type: record.type,
          otpHash: record.otpHash,
          salt: record.salt,
          attempts: record.attemptCount,
          maxAttempts: record.maxAttempts,
          status: record.status,
          consumed: record.status === "consumed" || record.usedAt !== null,
          verified: record.verified,
          createdAt: new Date(record.createdAt).toISOString(),
          expiresAt: new Date(record.expiresAt).toISOString(),
          cooldownUntil: new Date(record.cooldownUntil).toISOString(),
          verifiedAt: record.verifiedAt ? new Date(record.verifiedAt).toISOString() : null,
          consumedAt: record.usedAt ? new Date(record.usedAt).toISOString() : null,
          verificationToken: record.verificationToken || null,
        },
        { merge: true },
      );
  } catch (err) {
    console.warn("Could not sync otpRequest to Firestore:", err);
  }
}

/**
 * Creates and registers a new secure 6-digit OTP stored in 'otpRequests'.
 * Returns the raw OTP ONLY to be sent via the email/SMS transport.
 * The raw OTP is NEVER persisted, logged, or returned in API responses.
 */
export async function createOtp(
  identifierRaw: string,
  type: "email" | "phone",
): Promise<{
  success: boolean;
  requestId?: string;
  otp?: string;
  cooldownSeconds?: number;
  expiresInSeconds?: number;
  error?: string;
  errorCode?: string;
}> {
  const identifier = identifierRaw.trim().toLowerCase();
  const now = Date.now();

  // 1. Hourly rate limit check (max 5 requests per hour)
  const history = requestHistoryByIdentifier.get(identifier) || [];
  const recentHistory = history.filter((t) => now - t < HOURLY_WINDOW_MS);
  if (recentHistory.length >= MAX_HOURLY_REQUESTS) {
    const oldest = recentHistory[0];
    const waitMinutes = Math.ceil((HOURLY_WINDOW_MS - (now - oldest)) / 60000);
    return {
      success: false,
      errorCode: "HOURLY_RATE_LIMIT_EXCEEDED",
      error: `Too many verification requests. Please try again in ${waitMinutes} minute${waitMinutes === 1 ? "" : "s"}.`,
    };
  }

  // 2. Check active request and enforce resend cooldown (60 seconds)
  const previousRequestId = activeRequestByIdentifier.get(identifier);
  let previous: OtpRecord | null = previousRequestId
    ? otpStore.get(previousRequestId) || null
    : null;

  if (!previous && previousRequestId) {
    previous = await fetchOtpFromFirestore(previousRequestId);
  }

  if (previous && previous.status === "pending") {
    const elapsed = now - previous.createdAt;
    if (elapsed < RESEND_COOLDOWN_MS) {
      const remainingCooldown = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        success: false,
        errorCode: "COOLDOWN_ACTIVE",
        error: `Please wait ${remainingCooldown} seconds before requesting a new code.`,
        cooldownSeconds: remainingCooldown,
      };
    }
    // Invalidate previous pending OTP
    previous.status = "invalidated";
    await syncOtpToFirestore(previous);
  }

  // 3. Generate cryptographically random 6-digit OTP and salt
  const otp = generateSecureOtp();
  const salt = crypto.randomBytes(16).toString("hex");
  const otpHash = hashOtp(otp, salt);
  const requestId = crypto.randomUUID();

  const record: OtpRecord = {
    requestId,
    identifier,
    type,
    otpHash,
    salt,
    createdAt: now,
    expiresAt: now + OTP_EXPIRY_MS,
    cooldownUntil: now + RESEND_COOLDOWN_MS,
    attemptCount: 0,
    maxAttempts: MAX_ATTEMPTS,
    verified: false,
    verifiedAt: null,
    usedAt: null,
    status: "pending",
  };

  // Update in-memory stores
  otpStore.set(requestId, record);
  activeRequestByIdentifier.set(identifier, requestId);
  recentHistory.push(now);
  requestHistoryByIdentifier.set(identifier, recentHistory);

  // Persist to 'otpRequests' in Firestore
  await syncOtpToFirestore(record);

  return {
    success: true,
    requestId,
    otp, // For transport delivery only
    expiresInSeconds: Math.floor(OTP_EXPIRY_MS / 1000),
    cooldownSeconds: Math.floor(RESEND_COOLDOWN_MS / 1000),
  };
}

/**
 * Verifies a submitted OTP code against the stored hash using timing-safe comparison.
 */
export async function verifyOtpCode(
  requestId: string,
  identifierRaw: string,
  submittedOtp: string,
): Promise<{
  success: boolean;
  verificationToken?: string;
  remainingAttempts?: number;
  error?: string;
  errorCode?: string;
}> {
  const identifier = identifierRaw.trim().toLowerCase();
  let record = otpStore.get(requestId);

  // Fallback to Firestore if not present in memory
  if (!record) {
    record = (await fetchOtpFromFirestore(requestId)) || undefined;
    if (record) {
      otpStore.set(requestId, record);
    }
  }

  if (!record || record.identifier !== identifier) {
    return {
      success: false,
      errorCode: "INVALID_REQUEST",
      error: "Verification request not found. Please request a new code.",
    };
  }

  // Check state transitions
  if (record.status === "consumed" || record.usedAt !== null) {
    return {
      success: false,
      errorCode: "ALREADY_USED",
      error: "This verification code has already been used.",
    };
  }

  if (record.status === "invalidated") {
    return {
      success: false,
      errorCode: "INVALIDATED",
      error: "This code was superseded by a newer request. Please check your latest email.",
    };
  }

  if (Date.now() > record.expiresAt || record.status === "expired") {
    record.status = "expired";
    await syncOtpToFirestore(record);
    return {
      success: false,
      errorCode: "OTP_EXPIRED",
      error: "Verification code has expired. Please request a new one.",
    };
  }

  if (record.attemptCount >= record.maxAttempts || record.status === "max_attempts_exceeded") {
    record.status = "max_attempts_exceeded";
    await syncOtpToFirestore(record);
    return {
      success: false,
      errorCode: "TOO_MANY_ATTEMPTS",
      error: "Maximum attempts exceeded. For your security, please request a new code.",
    };
  }

  // Timing safe comparison of hashes
  const cleanInput = submittedOtp.trim();
  const inputHash = hashOtp(cleanInput, record.salt);

  const hashBuffer = Buffer.from(record.otpHash, "hex");
  const inputBuffer = Buffer.from(inputHash, "hex");

  const isMatch =
    hashBuffer.length === inputBuffer.length && crypto.timingSafeEqual(hashBuffer, inputBuffer);

  if (!isMatch) {
    record.attemptCount += 1;
    const remaining = Math.max(0, record.maxAttempts - record.attemptCount);

    if (remaining === 0) {
      record.status = "max_attempts_exceeded";
    }

    await syncOtpToFirestore(record);

    return {
      success: false,
      errorCode: "INVALID_OTP",
      error:
        remaining > 0
          ? `Incorrect verification code. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
          : "Maximum attempts exceeded. Please request a new code.",
      remainingAttempts: remaining,
    };
  }

  // Successful verification
  record.verified = true;
  record.verifiedAt = Date.now();
  record.status = "verified";

  // Generate single-use verification token for the password creation step
  const verificationToken = crypto.randomBytes(32).toString("hex");
  record.verificationToken = verificationToken;
  verificationTokens.set(verificationToken, record.requestId);

  await syncOtpToFirestore(record);

  return {
    success: true,
    verificationToken,
  };
}

/**
 * Validates and consumes the single-use verification token before account creation.
 */
export async function consumeVerificationToken(
  token: string,
  identifierRaw: string,
): Promise<{
  valid: boolean;
  identifier?: string;
  error?: string;
  errorCode?: string;
}> {
  const identifier = identifierRaw.trim().toLowerCase();
  let requestId = verificationTokens.get(token);

  let record: OtpRecord | undefined;
  if (requestId) {
    record = otpStore.get(requestId);
  }

  // Fallback check from Firestore if token or record missing from memory
  if (!record && isFirebaseAdminInitialized()) {
    try {
      const db = getAdminDb();
      const snapshot = await db
        .collection("otpRequests")
        .where("verificationToken", "==", token)
        .limit(1)
        .get();
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        record = (await fetchOtpFromFirestore(doc.id)) || undefined;
        if (record) {
          requestId = record.requestId;
          otpStore.set(record.requestId, record);
        }
      }
    } catch {
      // Ignore fallback errors
    }
  }

  if (!requestId || !record) {
    return {
      valid: false,
      errorCode: "INVALID_TOKEN",
      error: "Invalid or expired verification session. Please verify your email again.",
    };
  }

  if (record.identifier !== identifier || !record.verified) {
    return {
      valid: false,
      errorCode: "INVALID_SESSION",
      error: "Verification record mismatch. Please start again.",
    };
  }

  const now = Date.now();
  if (record.verifiedAt && now - record.verifiedAt > VERIFICATION_TOKEN_VALIDITY_MS) {
    record.status = "expired";
    await syncOtpToFirestore(record);
    return {
      valid: false,
      errorCode: "SESSION_EXPIRED",
      error: "Verification session timed out. Please verify your email again.",
    };
  }

  if (record.status === "consumed" || record.usedAt !== null) {
    const timeSinceConsumed = now - (record.usedAt || 0);
    // Allow idempotent retry and duplicate submission within token validity window (15 mins) for the exact same identifier
    if (timeSinceConsumed < VERIFICATION_TOKEN_VALIDITY_MS && record.identifier === identifier) {
      return {
        valid: true,
        identifier: record.identifier,
      };
    }
    return {
      valid: false,
      errorCode: "TOKEN_ALREADY_USED",
      error: "This verification session has already been used to create an account.",
    };
  }

  // Mark consumed
  record.status = "consumed";
  record.usedAt = now;

  await syncOtpToFirestore(record);

  return {
    valid: true,
    identifier: record.identifier,
  };
}
