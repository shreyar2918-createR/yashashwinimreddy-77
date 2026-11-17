import { jsonSuccess, jsonError } from "../utils/response";
import { authenticateRequest } from "../middleware/auth";
import { getAdminDb } from "../config/firebase-admin";
import { COLLECTIONS } from "../services/firestore";

export async function handleNotificationsRoute(
  request: Request,
  subpath: string,
): Promise<Response> {
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonError("Authentication required for notifications", 401, "UNAUTHORIZED");
  }

  const db = getAdminDb();
  const method = request.method;

  // GET /api/notifications — list notifications scoped strictly to authenticated user
  if (subpath === "/" || subpath === "") {
    if (method !== "GET") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }
    try {
      const snap = await db
        .collection(COLLECTIONS.NOTIFICATIONS)
        .where("userId", "==", user.uid)
        .get();

      const notifications = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      notifications.sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
        const tA = new Date(String(a.createdAt || 0)).getTime();
        const tB = new Date(String(b.createdAt || 0)).getTime();
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });

      const unreadCount = notifications.filter(
        (n: Record<string, unknown>) => n.read === false,
      ).length;

      return jsonSuccess({ notifications, unreadCount });
    } catch (err) {
      console.error("[Notifications Route] List error:", err);
      return jsonError("Failed to fetch notifications", 500, "DATABASE_ERROR");
    }
  }

  // POST /api/notifications/read-all — mark all user notifications as read
  if (subpath === "/read-all" || subpath === "/read-all/") {
    if (method !== "POST") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }
    try {
      const snap = await db
        .collection(COLLECTIONS.NOTIFICATIONS)
        .where("userId", "==", user.uid)
        .where("read", "==", false)
        .get();

      const now = new Date().toISOString();
      const batch = db.batch();
      for (const d of snap.docs) {
        batch.update(d.ref, { read: true, readAt: now });
      }
      if (!snap.empty) {
        await batch.commit();
      }
      return jsonSuccess({ updatedCount: snap.size });
    } catch (err) {
      console.error("[Notifications Route] Mark all read error:", err);
      return jsonError("Failed to mark notifications as read", 500, "DATABASE_ERROR");
    }
  }

  // PATCH /api/notifications/:id/read — mark single notification as read (owner only)
  const readMatch = subpath.match(/^\/([a-zA-Z0-9_-]+)\/read\/?$/);
  if (readMatch) {
    if (method !== "PATCH" && method !== "POST") {
      return jsonError("Method Not Allowed", 405, "METHOD_NOT_ALLOWED");
    }
    try {
      const notifRef = db.collection(COLLECTIONS.NOTIFICATIONS).doc(readMatch[1]);
      const docSnap = await notifRef.get();
      if (!docSnap.exists) {
        return jsonError("Notification not found", 404, "NOT_FOUND");
      }
      const data = docSnap.data() || {};
      if (String(data.userId || "") !== user.uid) {
        return jsonError("Unauthorized access to notification", 403, "FORBIDDEN");
      }
      const now = new Date().toISOString();
      await notifRef.update({ read: true, readAt: now });
      return jsonSuccess({ id: docSnap.id, read: true, readAt: now });
    } catch (err) {
      console.error("[Notifications Route] Mark read error:", err);
      return jsonError("Failed to update notification", 500, "DATABASE_ERROR");
    }
  }

  return jsonError(`Endpoint /api/notifications${subpath} not found`, 404, "NOT_FOUND");
}
