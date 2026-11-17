import {
  collection,
  query,
  where,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { Referral, CanonicalReferralStatus, RewardType, RewardStatus } from "@/lib/types";

/**
 * Normalizes Firestore referral documents into strongly-typed Referral objects
 */
export function normalizeReferralDoc(id: string, data: Record<string, unknown>): Referral {
  // Normalize canonical status
  let status: CanonicalReferralStatus = "Registered";
  const rawStatus = String(data.status || "")
    .toLowerCase()
    .trim();
  if (rawStatus === "qualified") status = "Qualified";
  else if (rawStatus === "rewarded") status = "Rewarded";
  else if (rawStatus === "cancelled" || rawStatus === "rejected") status = "Cancelled";
  else if (rawStatus === "pending") status = "Pending";
  else status = "Registered";

  return {
    id,
    referralId: String(data.referralId || id),
    referrerUid: String(data.referrerUid || data.referrerClientId || ""),
    referrerClientId: String(data.referrerClientId || data.referrerUid || ""),
    referrerName: typeof data.referrerName === "string" ? data.referrerName : undefined,
    referrerEmail: typeof data.referrerEmail === "string" ? data.referrerEmail : undefined,
    referredClientUid:
      typeof data.referredClientUid === "string" ? data.referredClientUid : undefined,
    referredName: typeof data.referredName === "string" ? data.referredName : undefined,
    referredEmail: typeof data.referredEmail === "string" ? data.referredEmail : undefined,
    referralCode: String(data.referralCode || data.code || ""),
    code: String(data.code || data.referralCode || ""),
    status,
    rewardType: (data.rewardType as RewardType) || "credit",
    rewardAmount: typeof data.rewardAmount === "number" ? data.rewardAmount : 250,
    rewardCurrency: typeof data.rewardCurrency === "string" ? data.rewardCurrency : "USD",
    rewardStatus: (data.rewardStatus as RewardStatus) || "pending",
    rewardDescription:
      typeof data.rewardDescription === "string" ? data.rewardDescription : undefined,
    cancellationReason:
      typeof data.cancellationReason === "string" ? data.cancellationReason : undefined,
    cancelledBy: typeof data.cancelledBy === "string" ? data.cancelledBy : undefined,
    cancelledAt: typeof data.cancelledAt === "string" ? data.cancelledAt : undefined,
    registeredAt: typeof data.registeredAt === "string" ? data.registeredAt : undefined,
    qualifiedAt: typeof data.qualifiedAt === "string" ? data.qualifiedAt : undefined,
    rewardedAt: typeof data.rewardedAt === "string" ? data.rewardedAt : undefined,
    completedAt: typeof data.completedAt === "string" ? data.completedAt : undefined,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
}

/**
 * Validates a referral code against the backend API
 */
export async function validateReferralCode(code: string): Promise<{
  valid: boolean;
  code: string;
  referrerName?: string;
  message?: string;
}> {
  if (!code || !code.trim()) {
    return { valid: false, code: "", message: "Please provide a referral code." };
  }

  try {
    const res = await fetch(`/api/referrals/validate-code?code=${encodeURIComponent(code.trim())}`);
    const data = await res.json();
    if (res.ok && data.success && data.data?.valid) {
      return {
        valid: true,
        code: data.data.code,
        referrerName: data.data.referrerName,
        message: data.data.message || "Valid referral code.",
      };
    }
    return {
      valid: false,
      code,
      message: data.error?.message || "Invalid or unrecognized referral code.",
    };
  } catch (err) {
    console.warn("Referral code validation error:", err);
    return {
      valid: false,
      code,
      message: "Unable to verify referral code at this moment.",
    };
  }
}

/**
 * Retrieves or initializes the current authenticated client's unique referral code
 */
export async function getClientReferralCode(
  clientUid: string,
  clientName?: string,
  clientEmail?: string,
): Promise<{ referralCode: string; referralLink: string }> {
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch("/api/referrals/my-code", {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.data?.referralCode) {
        return {
          referralCode: data.data.referralCode,
          referralLink: data.data.referralLink || `/signup?ref=${data.data.referralCode}`,
        };
      }
    }
  } catch (err) {
    console.warn("Server referral code fetch fallback:", err);
  }

  // Deterministic client fallback if offline
  const fallbackCode = `VINORA-${clientUid.slice(0, 6).toUpperCase()}`;
  return {
    referralCode: fallbackCode,
    referralLink: `/signup?ref=${fallbackCode}`,
  };
}

/**
 * Subscribes to real-time referrals for the authenticated client
 */
export function subscribeClientReferrals(
  clientUid: string,
  onUpdate: (referrals: Referral[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  if (!clientUid) {
    onUpdate([]);
    return () => {};
  }

  const q = query(collection(db, "referrals"), where("referrerUid", "==", clientUid));

  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => normalizeReferralDoc(d.id, d.data()));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (err) => {
      console.error("[Referral Service] Client snapshot subscription error:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * Subscribes to all studio referrals (Authorized Admin only)
 */
export function subscribeAllReferrals(
  onUpdate: (referrals: Referral[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const colRef = collection(db, "referrals");

  return onSnapshot(
    colRef,
    (snap) => {
      const list = snap.docs.map((d) => normalizeReferralDoc(d.id, d.data()));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onUpdate(list);
    },
    (err) => {
      console.error("[Referral Service] Admin all referrals subscription error:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * Attributes a newly created client account to a referral code
 */
export async function attributeReferral(params: {
  referralCode: string;
  newClientUid?: string;
  newClientEmail?: string;
  newClientName?: string;
}): Promise<{ success: boolean; referralId?: string; message: string }> {
  try {
    const token = await auth.currentUser?.getIdToken();
    const res = await fetch("/api/referrals/attribute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error?.message || "Failed to attribute referral.");
    }
    return {
      success: true,
      referralId: data.data?.referralId,
      message: data.data?.message || "Referral attributed successfully.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to attribute referral.";
    console.error("[Referral Service] Attribution error:", err);
    throw new Error(msg);
  }
}

/**
 * Admin action to qualify, reward, or cancel a referral
 */
export async function updateReferralStatus(params: {
  referralId: string;
  status: "Qualified" | "Rewarded" | "Cancelled";
  rewardType?: RewardType;
  rewardAmount?: number;
  rewardCurrency?: string;
  rewardDescription?: string;
  cancellationReason?: string;
}): Promise<Referral> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error("Administrative authorization required.");
  }

  const res = await fetch("/api/referrals/admin/update-status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok || !data.success || !data.data?.referral) {
    throw new Error(data.error?.message || "Failed to update referral status.");
  }

  return normalizeReferralDoc(data.data.referral.id, data.data.referral);
}
