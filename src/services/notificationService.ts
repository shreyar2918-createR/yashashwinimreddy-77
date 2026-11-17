import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "@/lib/firebase";
import type { Notification } from "@/lib/types";

function parseNotificationDoc(id: string, raw: Record<string, unknown>): Notification {
  return {
    id,
    userId: String(raw.userId || ""),
    type: String(raw.type || "general"),
    title: String(raw.title || "Notification"),
    body: String(raw.body || ""),
    link: typeof raw.link === "string" ? raw.link : undefined,
    read: typeof raw.read === "boolean" ? raw.read : Boolean(raw.readAt),
    projectId: typeof raw.projectId === "string" ? raw.projectId : undefined,
    readAt: typeof raw.readAt === "string" ? raw.readAt : undefined,
    createdAt: String(raw.createdAt || new Date().toISOString()),
  };
}

/**
 * Creates a real Firestore notification targeting a specific user UID (client or admin).
 * Non-throwing helper wrapper available via createUserNotification.
 */
export async function createUserNotification(params: {
  userId: string;
  title: string;
  body: string;
  type: string;
  link?: string;
  projectId?: string;
}): Promise<string | null> {
  if (!params.userId) return null;
  try {
    const docRef = doc(collection(db, "notifications"));
    const now = new Date().toISOString();
    await setDoc(docRef, {
      id: docRef.id,
      userId: params.userId,
      title: params.title.slice(0, 160),
      body: params.body.slice(0, 1000),
      type: params.type.slice(0, 50),
      link: params.link ? params.link.slice(0, 400) : "/client",
      read: false,
      ...(params.projectId ? { projectId: params.projectId } : {}),
      createdAt: now,
    });
    return docRef.id;
  } catch (err) {
    console.warn("[VINORA Notifications] Could not persist notification:", err);
    return null;
  }
}

/**
 * Real-time subscription to notifications belonging strictly to the authenticated client UID.
 */
export function subscribeClientNotifications(
  userId: string,
  onUpdate: (notifications: Notification[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const q = query(collection(db, "notifications"), where("userId", "==", userId));

  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) =>
        parseNotificationDoc(d.id, d.data() as Record<string, unknown>),
      );
      items.sort((a, b) => {
        const tA = new Date(a.createdAt || 0).getTime();
        const tB = new Date(b.createdAt || 0).getTime();
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });
      onUpdate(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, "notifications");
      } catch (wrappedErr) {
        if (onError) onError(wrappedErr);
      }
    },
  );
}

/**
 * Real-time subscription to studio notifications visible to authorized admins.
 * Filters cleanly so an admin sees alerts addressed to their UID (and optional admin alert events).
 */
export function subscribeAdminNotifications(
  adminUid: string,
  onUpdate: (notifications: Notification[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  if (!adminUid) {
    onUpdate([]);
    return () => {};
  }

  const colRef = collection(db, "notifications");

  return onSnapshot(
    colRef,
    (snap) => {
      const items = snap.docs
        .map((d) => parseNotificationDoc(d.id, d.data() as Record<string, unknown>))
        .filter((n) => n.userId === adminUid || n.userId === "vinora_admin_team");

      items.sort((a, b) => {
        const tA = new Date(a.createdAt || 0).getTime();
        const tB = new Date(b.createdAt || 0).getTime();
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });
      onUpdate(items);
    },
    (err) => {
      console.warn("[VINORA Notifications] Admin snapshot error:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * Marks a single client or admin notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!notificationId) return;
  const now = new Date().toISOString();

  try {
    await updateDoc(doc(db, "notifications", notificationId), {
      read: true,
      readAt: now,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
  }
}

/**
 * Marks all unread notifications as read.
 */
export async function markAllNotificationsAsRead(notifications: Notification[]): Promise<void> {
  const unread = notifications.filter((n) => !n.read && !n.readAt);
  if (unread.length === 0) return;

  const currentUser = auth.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok && unread.every((n) => n.userId === currentUser.uid)) {
        return;
      }
    } catch {
      // Fallback to direct Firestore batch update below
    }
  }

  const now = new Date().toISOString();
  const ownUnread = currentUser ? unread.filter((item) => item.userId === currentUser.uid) : [];
  if (ownUnread.length === 0) return;

  const batch = writeBatch(db);
  for (const item of ownUnread.slice(0, 450)) {
    batch.update(doc(db, "notifications", item.id), {
      read: true,
      readAt: now,
    });
  }
  await batch.commit();
}
