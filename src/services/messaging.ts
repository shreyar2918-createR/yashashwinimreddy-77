import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  increment,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Conversation, ConversationMessage } from "@/lib/types";

/**
 * Real-time listener for all active conversations in VINORA Studio.
 * Restricted by Firestore security rules to authorized administrators.
 */
export function subscribeToConversations(
  onData: (conversations: Conversation[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const convCol = collection(db, "conversations");

  return onSnapshot(
    convCol,
    (snapshot) => {
      const convList: Conversation[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        convList.push({
          id: d.id,
          clientId: data.clientId || d.id,
          clientName: data.clientName || "Client",
          clientEmail: data.clientEmail || "",
          adminUid: data.adminUid || null,
          adminName: data.adminName || "VINORA Architecture Team",
          adminEmail: data.adminEmail || "architecture@vinora.io",
          lastMessageText: data.lastMessageText || "",
          lastMessageTimestamp:
            data.lastMessageTimestamp || data.updatedAt || new Date().toISOString(),
          lastSenderRole: data.lastSenderRole || "client",
          lastSenderUid: data.lastSenderUid || "",
          lastSenderName: data.lastSenderName || "",
          unreadCountClient: Number(data.unreadCountClient || 0),
          unreadCountAdmin: Number(data.unreadCountAdmin || 0),
          status: data.status || "active",
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      // Sort in-memory by newest message / updated timestamp
      convList.sort((a, b) => {
        const timeA = new Date(a.updatedAt || a.lastMessageTimestamp).getTime();
        const timeB = new Date(b.updatedAt || b.lastMessageTimestamp).getTime();
        return timeB - timeA;
      });

      onData(convList);
    },
    (err) => {
      console.error("[VINORA Messaging] Failed to subscribe to conversations:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * Real-time listener for a single client conversation.
 * Scoped to the authenticated client UID or admin.
 */
export function subscribeToClientConversation(
  clientId: string,
  onData: (conversation: Conversation | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const convRef = doc(db, "conversations", clientId);

  return onSnapshot(
    convRef,
    (snap) => {
      if (!snap.exists()) {
        onData(null);
        return;
      }
      const data = snap.data();
      onData({
        id: snap.id,
        clientId: data.clientId || snap.id,
        clientName: data.clientName || "Client",
        clientEmail: data.clientEmail || "",
        adminUid: data.adminUid || null,
        adminName: data.adminName || "VINORA Architecture Team",
        adminEmail: data.adminEmail || "architecture@vinora.io",
        lastMessageText: data.lastMessageText || "",
        lastMessageTimestamp:
          data.lastMessageTimestamp || data.updatedAt || new Date().toISOString(),
        lastSenderRole: data.lastSenderRole || "client",
        lastSenderUid: data.lastSenderUid || "",
        lastSenderName: data.lastSenderName || "",
        unreadCountClient: Number(data.unreadCountClient || 0),
        unreadCountAdmin: Number(data.unreadCountAdmin || 0),
        status: data.status || "active",
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      });
    },
    (err) => {
      console.error(
        `[VINORA Messaging] Error subscribing to client conversation ${clientId}:`,
        err,
      );
      if (onError) onError(err);
    },
  );
}

/**
 * Real-time listener for messages within a specific conversation.
 * Listens to `conversations/{conversationId}/messages`.
 */
export function subscribeToMessages(
  conversationId: string,
  onData: (messages: ConversationMessage[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const msgCol = collection(db, "conversations", conversationId, "messages");

  return onSnapshot(
    msgCol,
    (snapshot) => {
      const messages: ConversationMessage[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        messages.push({
          id: d.id,
          conversationId,
          clientId: data.clientId || conversationId,
          senderUid: data.senderUid || "",
          senderEmail: data.senderEmail || "",
          senderName: data.senderName || "User",
          senderRole: data.senderRole || "client",
          recipientRole: data.recipientRole || "admin",
          text: data.text || "",
          read: Boolean(data.read),
          readAt: data.readAt || null,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });

      // Sort chronologically ascending for WhatsApp chat stream
      messages.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        return timeA - timeB;
      });

      onData(messages);
    },
    (err) => {
      console.error(`[VINORA Messaging] Error subscribing to messages for ${conversationId}:`, err);
      if (onError) onError(err);
    },
  );
}

/**
 * Client sends a new message to VINORA Admins.
 * Creates conversation document if first message, writes message doc,
 * and increments unreadCountAdmin.
 */
export async function sendClientMessage(params: {
  clientId: string;
  clientName: string;
  clientEmail: string;
  text: string;
}): Promise<string> {
  const text = params.text.trim();
  if (!text) {
    throw new Error("Message text cannot be empty.");
  }

  const now = new Date().toISOString();
  const convRef = doc(db, "conversations", params.clientId);
  const msgCol = collection(db, "conversations", params.clientId, "messages");
  const newMsgRef = doc(msgCol);

  // 1. Message record
  const messageData: ConversationMessage = {
    id: newMsgRef.id,
    conversationId: params.clientId,
    clientId: params.clientId,
    senderUid: params.clientId,
    senderEmail: params.clientEmail || "",
    senderName: params.clientName || "Client",
    senderRole: "client",
    recipientRole: "admin",
    text,
    read: false,
    readAt: null,
    createdAt: now,
  };

  // 2. Set conversation top-level document
  await setDoc(
    convRef,
    {
      id: params.clientId,
      clientId: params.clientId,
      clientName: params.clientName || "Client",
      clientEmail: params.clientEmail || "",
      adminUid: "vinora_admin_team",
      adminName: "VINORA Architecture Team",
      adminEmail: "architecture@vinora.io",
      lastMessageText: text,
      lastMessageTimestamp: now,
      lastSenderRole: "client",
      lastSenderUid: params.clientId,
      lastSenderName: params.clientName || "Client",
      unreadCountAdmin: increment(1),
      status: "active",
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  );

  // 3. Save message in subcollection
  await setDoc(newMsgRef, messageData);

  return newMsgRef.id;
}

/**
 * Authorized VINORA Admin sends a reply message to a client.
 * Writes message doc to `conversations/{conversationId}/messages`,
 * updates conversation, and increments unreadCountClient.
 */
export async function sendAdminReply(params: {
  conversationId: string;
  adminUid: string;
  adminName: string;
  adminEmail: string;
  text: string;
}): Promise<string> {
  const text = params.text.trim();
  if (!text) {
    throw new Error("Reply message cannot be empty.");
  }

  const now = new Date().toISOString();
  const convRef = doc(db, "conversations", params.conversationId);
  const msgCol = collection(db, "conversations", params.conversationId, "messages");
  const newMsgRef = doc(msgCol);

  const messageData: ConversationMessage = {
    id: newMsgRef.id,
    conversationId: params.conversationId,
    clientId: params.conversationId,
    senderUid: params.adminUid,
    senderEmail: params.adminEmail,
    senderName: params.adminName || "VINORA Lead Architect",
    senderRole: "admin",
    recipientRole: "client",
    text,
    read: false,
    readAt: null,
    createdAt: now,
  };

  // 1. Update conversation overview
  await setDoc(
    convRef,
    {
      lastMessageText: text,
      lastMessageTimestamp: now,
      lastSenderRole: "admin",
      lastSenderUid: params.adminUid,
      lastSenderName: params.adminName || "VINORA Lead Architect",
      adminUid: params.adminUid,
      adminName: params.adminName || "VINORA Architecture Team",
      adminEmail: params.adminEmail,
      unreadCountClient: increment(1),
      updatedAt: now,
    },
    { merge: true },
  );

  // 2. Save message record
  await setDoc(newMsgRef, messageData);

  return newMsgRef.id;
}

/**
 * Marks messages in a conversation as read and resets the viewer's unread counter.
 */
export async function markConversationAsRead(
  conversationId: string,
  viewerRole: "client" | "admin",
): Promise<void> {
  try {
    const convRef = doc(db, "conversations", conversationId);

    // Reset unread badge on conversation
    if (viewerRole === "client") {
      await updateDoc(convRef, { unreadCountClient: 0 }).catch(() => null);
    } else {
      await updateDoc(convRef, { unreadCountAdmin: 0 }).catch(() => null);
    }

    // Query unread messages targeting this viewer role
    const msgCol = collection(db, "conversations", conversationId, "messages");
    const qUnread = query(
      msgCol,
      where("recipientRole", "==", viewerRole),
      where("read", "==", false),
    );
    const snap = await getDocs(qUnread);

    if (!snap.empty) {
      const batch = writeBatch(db);
      const readAt = new Date().toISOString();
      snap.forEach((d) => {
        batch.update(d.ref, { read: true, readAt });
      });
      await batch.commit();
    }
  } catch (err) {
    console.warn(`[VINORA Messaging] Could not mark conversation ${conversationId} as read:`, err);
  }
}

/**
 * Subscribes to total unread count for badge indicators in the portal layout.
 */
export function subscribeToUnreadCount(
  role: "client" | "admin",
  uid: string,
  onCount: (count: number) => void,
): Unsubscribe {
  if (role === "client") {
    const convRef = doc(db, "conversations", uid);
    return onSnapshot(
      convRef,
      (snap) => {
        if (!snap.exists()) {
          onCount(0);
          return;
        }
        const data = snap.data();
        onCount(Number(data.unreadCountClient || 0));
      },
      () => onCount(0),
    );
  }

  // Admin role: sum all unreadCountAdmin across conversations
  const convCol = collection(db, "conversations");
  return onSnapshot(
    convCol,
    (snap) => {
      let total = 0;
      snap.forEach((d) => {
        const c = Number(d.data().unreadCountAdmin || 0);
        if (c > 0) total += c;
      });
      onCount(total);
    },
    () => onCount(0),
  );
}
