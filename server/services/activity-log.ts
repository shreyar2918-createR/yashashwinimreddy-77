import { getAdminDb } from "../config/firebase-admin";
import { serverTimestamp, COLLECTIONS } from "./firestore";
import type { ActivityAction, ActivityLogEntity } from "../types";
import { createHash } from "crypto";

export interface LogActivityParams {
  actorId: string;
  actorRole: string;
  action: ActivityAction | string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Anonymizes client IP address to preserve privacy while supporting fraud analysis.
 */
function hashIp(ip?: string): string | undefined {
  if (!ip || ip === "unknown") return undefined;
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

/**
 * Production-ready activity logging service recording immutable audit trails to Firestore.
 */
export async function logActivity(params: LogActivityParams): Promise<string | null> {
  try {
    const db = getAdminDb();
    const docRef = db.collection(COLLECTIONS.ACTIVITY_LOGS).doc();

    const logEntry: Omit<ActivityLogEntity, "id"> & { timestamp: unknown } = {
      actorId: params.actorId,
      actorRole: params.actorRole,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      metadata: params.metadata || {},
      ipHash: hashIp(params.ipAddress),
      timestamp: serverTimestamp(),
    };

    await docRef.set(logEntry);
    return docRef.id;
  } catch (error) {
    // Non-blocking logger error logging to prevent interrupting caller operations
    console.error("Failed to persist activity log:", error);
    return null;
  }
}
