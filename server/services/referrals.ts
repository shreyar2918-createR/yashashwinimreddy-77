import crypto from "crypto";
import { getAdminDb, isFirebaseAdminInitialized } from "../config/firebase-admin";

export interface AttributeReferralParams {
  referralCode: string;
  newClientUid: string;
  newClientEmail: string;
  newClientName?: string;
}

export interface ReferralValidationResult {
  valid: boolean;
  code: string;
  referrerUid?: string;
  referrerName?: string;
  message?: string;
}

export interface UpdateReferralStatusParams {
  adminUid: string;
  adminName: string;
  referralId: string;
  status: "Qualified" | "Rewarded" | "Cancelled";
  rewardType?: "points" | "credit" | "discount" | "custom";
  rewardAmount?: number;
  rewardCurrency?: string;
  rewardDescription?: string;
  cancellationReason?: string;
}

/**
 * Deterministically or randomly formats a unique VINORA referral code:
 * E.g., VINORA-7K9M2P
 */
export function formatReferralCode(seed?: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omits confusing O, 0, I, 1
  let randomPart = "";
  if (seed) {
    const hash = crypto.createHash("sha256").update(seed).digest("hex");
    for (let i = 0; i < 6; i++) {
      const idx = parseInt(hash.slice(i * 2, i * 2 + 2), 16) % chars.length;
      randomPart += chars[idx];
    }
  } else {
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      randomPart += chars[bytes[i] % chars.length];
    }
  }
  return `VINORA-${randomPart}`;
}

/**
 * Retrieves or registers a unique referral code for a client
 */
export async function getOrCreateClientReferralCode(
  clientUid: string,
  clientName?: string,
  clientEmail?: string,
): Promise<{ referralCode: string; referralLink: string }> {
  if (!clientUid) {
    throw new Error("clientUid is required.");
  }

  const db = getAdminDb();
  const clientRef = db.collection("clients").doc(clientUid);
  const clientSnap = await clientRef.get();

  let existingCode = "";
  if (clientSnap.exists) {
    const data = clientSnap.data() || {};
    existingCode = String(data.referralCode || data.referral_code || "").trim();
  }

  // If client already has a registered code, return it
  if (existingCode) {
    return {
      referralCode: existingCode,
      referralLink: `/signup?ref=${existingCode}`,
    };
  }

  // Check if code was already mapped in referralCodes collection
  const existingCodeSnap = await db
    .collection("referralCodes")
    .where("referrerUid", "==", clientUid)
    .limit(1)
    .get();

  if (!existingCodeSnap.empty) {
    const code = existingCodeSnap.docs[0].id;
    await clientRef.set({ referralCode: code }, { merge: true });
    return {
      referralCode: code,
      referralLink: `/signup?ref=${code}`,
    };
  }

  // Generate new unique code
  let newCode = formatReferralCode(clientUid);
  // Ensure uniqueness
  let attempts = 0;
  while (attempts < 5) {
    const checkDoc = await db.collection("referralCodes").doc(newCode).get();
    if (!checkDoc.exists) break;
    newCode = formatReferralCode();
    attempts++;
  }

  const now = new Date().toISOString();
  await db
    .collection("referralCodes")
    .doc(newCode)
    .set({
      code: newCode,
      referrerUid: clientUid,
      referrerName: clientName || "VINORA Client",
      referrerEmail: clientEmail || "",
      createdAt: now,
    });

  await clientRef.set(
    {
      referralCode: newCode,
      updatedAt: now,
    },
    { merge: true },
  );

  return {
    referralCode: newCode,
    referralLink: `/signup?ref=${newCode}`,
  };
}

/**
 * Validates a referral code against the registry
 */
export async function validateReferralCode(rawCode: string): Promise<ReferralValidationResult> {
  const code = (rawCode || "").trim().toUpperCase();
  if (!code || !code.startsWith("VINORA-")) {
    return { valid: false, code, message: "Invalid referral code format." };
  }

  const db = getAdminDb();
  const codeDoc = await db.collection("referralCodes").doc(code).get();

  if (codeDoc.exists) {
    const data = codeDoc.data() || {};
    return {
      valid: true,
      code,
      referrerUid: data.referrerUid,
      referrerName: data.referrerName || "A verified VINORA client",
      message: "Valid referral code.",
    };
  }

  // Fallback: look up in clients collection directly
  const clientMatchSnap = await db
    .collection("clients")
    .where("referralCode", "==", code)
    .limit(1)
    .get();

  if (!clientMatchSnap.empty) {
    const clientData = clientMatchSnap.docs[0].data() || {};
    return {
      valid: true,
      code,
      referrerUid: clientMatchSnap.docs[0].id,
      referrerName: clientData.name || clientData.fullName || "A verified VINORA client",
      message: "Valid referral code.",
    };
  }

  return {
    valid: false,
    code,
    message: "Referral code not found in VINORA registry.",
  };
}

/**
 * Attributes a newly registered client to an existing referrer with strict anti-fraud invariants
 */
export async function attributeClientReferral(params: AttributeReferralParams): Promise<{
  success: boolean;
  referralId: string;
  status: string;
  referrerUid: string;
  message: string;
}> {
  const { referralCode, newClientUid, newClientEmail, newClientName } = params;

  if (!referralCode || !newClientUid || !newClientEmail) {
    throw new Error("Missing required parameters for referral attribution.");
  }

  const cleanCode = referralCode.trim().toUpperCase();
  const cleanNewEmail = newClientEmail.trim().toLowerCase();

  const db = getAdminDb();

  // 1. Verify code validity
  const validation = await validateReferralCode(cleanCode);
  if (!validation.valid || !validation.referrerUid) {
    throw new Error(`Referral code "${cleanCode}" is invalid or does not exist.`);
  }

  const referrerUid = validation.referrerUid;

  // 2. SELF-REFERRAL PREVENTION (Security Requirement 5)
  if (referrerUid === newClientUid) {
    throw new Error("Self-referral is strictly prohibited. You cannot use your own referral code.");
  }

  // Check referrer email to prevent self-referral with duplicate email
  const referrerDoc = await db.collection("clients").doc(referrerUid).get();
  const referrerData = referrerDoc.data() || {};
  const referrerEmail = String(referrerData.email || "")
    .trim()
    .toLowerCase();

  if (referrerEmail && referrerEmail === cleanNewEmail) {
    throw new Error("Self-referral is strictly prohibited. Email matches the referrer account.");
  }

  // 3. DUPLICATE ATTRIBUTION PREVENTION (Security Requirement 6)
  // Check if newClientUid is already linked to a referral
  const existingByUidSnap = await db
    .collection("referrals")
    .where("referredClientUid", "==", newClientUid)
    .limit(1)
    .get();

  if (!existingByUidSnap.empty) {
    const existing = existingByUidSnap.docs[0].data();
    return {
      success: true,
      referralId: existingByUidSnap.docs[0].id,
      status: existing.status || "Registered",
      referrerUid: existing.referrerUid,
      message: "Client was already attributed to a referral.",
    };
  }

  // Check if newClientEmail was already linked to a referral
  const existingByEmailSnap = await db
    .collection("referrals")
    .where("referredEmail", "==", cleanNewEmail)
    .limit(1)
    .get();

  if (!existingByEmailSnap.empty) {
    const existing = existingByEmailSnap.docs[0].data();
    return {
      success: true,
      referralId: existingByEmailSnap.docs[0].id,
      status: existing.status || "Registered",
      referrerUid: existing.referrerUid,
      message: "Email address was already attributed to an existing referral.",
    };
  }

  // 4. Create Immutable Referral Document
  const referralRef = db.collection("referrals").doc();
  const referralId = referralRef.id;
  const now = new Date().toISOString();

  const referrerName =
    referrerData.name || referrerData.fullName || validation.referrerName || "VINORA Client";

  const referralRecord = {
    id: referralId,
    referralId,
    referrerUid,
    referrerClientId: referrerUid, // backward compat
    referrerName,
    referrerEmail,
    referredClientUid: newClientUid,
    referredName: newClientName || "New Client",
    referredEmail: cleanNewEmail,
    referralCode: cleanCode,
    code: cleanCode,
    status: "Registered", // Initial confirmed status upon verified registration
    rewardType: "credit",
    rewardAmount: 250, // Default configurable $250 / 250 credit toward project architecture
    rewardCurrency: "USD",
    rewardStatus: "pending", // Rewards are not automatic until qualified
    rewardDescription: "Standard Client Referral Credit (Applies upon project milestone scoping)",
    createdAt: now,
    registeredAt: now,
    updatedAt: now,
  };

  await referralRef.set(referralRecord);

  // 5. Update new client's document with attribution (immutable once set)
  await db.collection("clients").doc(newClientUid).set(
    {
      referredByCode: cleanCode,
      referredByUid: referrerUid,
      referralAttributedAt: now,
    },
    { merge: true },
  );

  // 6. Increment referrer's referral count in clients collection
  try {
    const currentCount = Number(referrerData.referralCount || 0);
    await db
      .collection("clients")
      .doc(referrerUid)
      .set(
        {
          referralCount: currentCount + 1,
          updatedAt: now,
        },
        { merge: true },
      );
  } catch (err) {
    console.warn("Could not increment referrer referralCount:", err);
  }

  return {
    success: true,
    referralId,
    status: "Registered",
    referrerUid,
    message: "Referral attribution completed successfully.",
  };
}

/**
 * Updates a referral's qualification, reward, or cancellation status (Authorized Admin only)
 */
export async function updateReferralStatusByAdmin(
  params: UpdateReferralStatusParams,
): Promise<{ success: boolean; referral: Record<string, unknown> }> {
  const {
    adminUid,
    adminName,
    referralId,
    status,
    rewardType,
    rewardAmount,
    rewardCurrency,
    rewardDescription,
    cancellationReason,
  } = params;

  if (!referralId) {
    throw new Error("Missing referralId.");
  }

  const db = getAdminDb();
  const refDoc = db.collection("referrals").doc(referralId);
  const snap = await refDoc.get();

  if (!snap.exists) {
    throw new Error(`Referral document "${referralId}" not found.`);
  }

  const current = snap.data() || {};
  const now = new Date().toISOString();

  const updates: Record<string, unknown> = {
    status,
    updatedAt: now,
    lastModifiedByAdminUid: adminUid,
    lastModifiedByAdminName: adminName,
  };

  if (status === "Qualified") {
    updates.qualifiedAt = now;
    updates.rewardStatus = "approved";
  } else if (status === "Rewarded") {
    updates.rewardedAt = now;
    updates.completedAt = now;
    updates.rewardStatus = "credited";
    if (rewardType) updates.rewardType = rewardType;
    if (rewardAmount !== undefined) updates.rewardAmount = rewardAmount;
    if (rewardCurrency) updates.rewardCurrency = rewardCurrency;
    if (rewardDescription) updates.rewardDescription = rewardDescription;
  } else if (status === "Cancelled") {
    if (!cancellationReason?.trim()) {
      throw new Error("A cancellation reason is required to cancel a referral.");
    }
    updates.cancelledAt = now;
    updates.cancelledBy = adminName || adminUid;
    updates.cancellationReason = cancellationReason.trim();
    updates.rewardStatus = "cancelled";
  }

  await refDoc.update(updates);

  // If rewarded, also update referrer profile points/credits if points/credit type
  if (status === "Rewarded" && current.referrerUid) {
    try {
      const referrerRef = db.collection("clients").doc(current.referrerUid);
      const referrerSnap = await referrerRef.get();
      if (referrerSnap.exists) {
        const refData = referrerSnap.data() || {};
        const amount = Number(rewardAmount ?? current.rewardAmount ?? 250);
        const type = rewardType || current.rewardType || "credit";

        if (type === "points") {
          const currentPts = Number(refData.referralPoints || 0);
          await referrerRef.set({ referralPoints: currentPts + amount }, { merge: true });
        } else {
          const currentCredits = Number(refData.referralCredits || 0);
          await referrerRef.set({ referralCredits: currentCredits + amount }, { merge: true });
        }
      }
    } catch (err) {
      console.warn("Could not credit referrer wallet:", err);
    }
  }

  const updatedSnap = await refDoc.get();
  return {
    success: true,
    referral: {
      id: updatedSnap.id,
      ...updatedSnap.data(),
    },
  };
}
