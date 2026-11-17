import { jsonSuccess, jsonError } from "../utils/response";
import { authenticateRequest, requireAdminAuth } from "../middleware/auth";
import {
  getOrCreateClientReferralCode,
  validateReferralCode,
  attributeClientReferral,
  updateReferralStatusByAdmin,
} from "../services/referrals";
import { getAdminDb } from "../config/firebase-admin";

export async function handleReferralsRoute(request: Request, subpath: string): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);

  // 1. Public code validation: GET /api/referrals/validate-code?code=VINORA-ABC123
  if (subpath === "/validate-code" || subpath === "/validate-code/") {
    const code = url.searchParams.get("code") || "";
    if (!code) {
      return jsonError("Missing referral code query parameter.", 400, "MISSING_CODE");
    }

    try {
      const result = await validateReferralCode(code);
      return jsonSuccess(result, result.valid ? 200 : 404);
    } catch (err: unknown) {
      console.error("[Referrals Route] Validate code error:", err);
      return jsonError("Failed to validate referral code.", 500, "SERVER_ERROR");
    }
  }

  // 2. Admin routes: require verified admin auth
  if (subpath.startsWith("/admin")) {
    const adminUser = await requireAdminAuth(request);
    if (!adminUser) {
      return jsonError("Administrative authorization required.", 403, "FORBIDDEN");
    }

    // GET /api/referrals/admin/all
    if (subpath === "/admin/all" || subpath === "/admin/all/") {
      try {
        const db = getAdminDb();
        const snap = await db.collection("referrals").orderBy("createdAt", "desc").get();
        const referrals = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        return jsonSuccess({
          referrals,
          count: referrals.length,
        });
      } catch (err: unknown) {
        console.error("[Referrals Route] Admin fetch all referrals error:", err);
        return jsonError("Failed to fetch referrals ledger.", 500, "DATABASE_ERROR");
      }
    }

    // POST /api/referrals/admin/update-status
    if (subpath === "/admin/update-status" || subpath === "/admin/update-status/") {
      if (method !== "POST") {
        return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
      }

      try {
        const body = (await request.json()) as {
          referralId?: string;
          status?: "Qualified" | "Rewarded" | "Cancelled";
          rewardType?: "points" | "credit" | "discount" | "custom";
          rewardAmount?: number;
          rewardCurrency?: string;
          rewardDescription?: string;
          cancellationReason?: string;
        };

        if (!body.referralId || !body.status) {
          return jsonError(
            "Missing required parameters (referralId, status).",
            400,
            "INVALID_INPUT",
          );
        }

        const result = await updateReferralStatusByAdmin({
          adminUid: adminUser.uid,
          adminName: adminUser.name || adminUser.email || "Admin",
          referralId: body.referralId,
          status: body.status,
          rewardType: body.rewardType,
          rewardAmount: body.rewardAmount,
          rewardCurrency: body.rewardCurrency,
          rewardDescription: body.rewardDescription,
          cancellationReason: body.cancellationReason,
        });

        return jsonSuccess(result, 200);
      } catch (err: unknown) {
        console.error("[Referrals Route] Admin update status error:", err);
        const msg = err instanceof Error ? err.message : "Failed to update referral status.";
        return jsonError(msg, 400, "UPDATE_FAILED");
      }
    }
  }

  // 3. Client Authenticated Routes
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonError("Authentication required.", 401, "UNAUTHORIZED");
  }

  // GET /api/referrals/my-code
  if (subpath === "/my-code" || subpath === "/my-code/") {
    try {
      const codeInfo = await getOrCreateClientReferralCode(
        user.uid,
        user.name || undefined,
        user.email || undefined,
      );
      return jsonSuccess(codeInfo, 200);
    } catch (err: unknown) {
      console.error("[Referrals Route] My code error:", err);
      const msg = err instanceof Error ? err.message : "Failed to retrieve referral code.";
      return jsonError(msg, 500, "SERVER_ERROR");
    }
  }

  // GET /api/referrals/my-referrals
  if (subpath === "/my-referrals" || subpath === "/my-referrals/") {
    try {
      const db = getAdminDb();
      const snap = await db.collection("referrals").where("referrerUid", "==", user.uid).get();

      const referrals = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Sort descending by date
      referrals.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const timeA = a.createdAt ? new Date(String(a.createdAt)).getTime() : 0;
        const timeB = b.createdAt ? new Date(String(b.createdAt)).getTime() : 0;
        return timeB - timeA;
      });

      // Calculate totals
      let registeredCount = 0;
      let qualifiedCount = 0;
      let rewardedCount = 0;
      let rewardPoints = 0;
      let accountCredits = 0;

      for (const r of referrals as Array<Record<string, unknown>>) {
        const st = String(r.status || "").toLowerCase();
        if (st === "registered") registeredCount++;
        else if (st === "qualified") qualifiedCount++;
        else if (st === "rewarded") {
          rewardedCount++;
          if (r.rewardType === "points") {
            rewardPoints += Number(r.rewardAmount || 0);
          } else {
            accountCredits += Number(r.rewardAmount || 0);
          }
        }
      }

      return jsonSuccess(
        {
          referrals,
          stats: {
            totalReferrals: referrals.length,
            registeredCount,
            qualifiedCount,
            rewardedCount,
            rewardPoints,
            accountCredits,
          },
        },
        200,
      );
    } catch (err: unknown) {
      console.error("[Referrals Route] My referrals error:", err);
      return jsonError("Failed to fetch referral history.", 500, "DATABASE_ERROR");
    }
  }

  // POST /api/referrals/attribute
  if (subpath === "/attribute" || subpath === "/attribute/") {
    if (method !== "POST") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }

    try {
      const body = (await request.json()) as {
        referralCode?: string;
        newClientUid?: string;
        newClientEmail?: string;
        newClientName?: string;
      };

      const code = body.referralCode?.trim();
      const targetUid = body.newClientUid || user.uid;
      const targetEmail = body.newClientEmail || user.email;

      if (!code) {
        return jsonError("Missing referralCode parameter.", 400, "INVALID_INPUT");
      }
      if (!targetEmail) {
        return jsonError("Missing client email.", 400, "INVALID_INPUT");
      }

      const result = await attributeClientReferral({
        referralCode: code,
        newClientUid: targetUid,
        newClientEmail: targetEmail,
        newClientName: body.newClientName || user.name || "Client",
      });

      return jsonSuccess(result, 201);
    } catch (err: unknown) {
      console.error("[Referrals Route] Attribution error:", err);
      const msg = err instanceof Error ? err.message : "Referral attribution failed.";
      return jsonError(msg, 400, "ATTRIBUTION_FAILED");
    }
  }

  return jsonError(`Endpoint /api/referrals${subpath} not found`, 404, "NOT_FOUND");
}
