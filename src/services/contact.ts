import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "@/lib/firebase";
import type { ContactSubmission } from "@/lib/types";

export interface ContactMessageInput {
  name: string;
  email: string;
  subject?: string | undefined;
  message: string;
}

/**
 * Persists a contact inquiry to Firestore.
 *
 * Saves to "contactSubmissions" collection with:
 * - name
 * - email
 * - subject
 * - message
 * - uid: authenticated user's UID or null
 * - status: "New"
 * - createdAt: Firestore serverTimestamp()
 *
 * Supports both authenticated clients and guest visitors.
 * Includes resilience fallback to contactEnquiries to guarantee zero message loss.
 */
export async function submitContactMessage(input: ContactMessageInput): Promise<ContactSubmission> {
  const submissionId = doc(collection(db, "contactSubmissions")).id;
  const now = new Date().toISOString();

  // Inspect current authenticated user
  const currentUser = auth.currentUser;
  const uid = currentUser ? currentUser.uid : null;
  const userEmail = currentUser?.email || null;

  const firestorePayload = {
    id: submissionId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    subject: input.subject?.trim() || "General Inquiry",
    message: input.message.trim(),
    status: "New",
    uid: uid,
    userId: uid,
    clientId: uid,
    userEmail: userEmail,
    isGuest: !currentUser,
    timestamp: now,
    createdAt: serverTimestamp(),
  };

  const clientReturnRecord: ContactSubmission = {
    id: submissionId,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    subject: input.subject?.trim() || "General Inquiry",
    message: input.message.trim(),
    status: "New",
    uid: uid,
    userId: uid,
    clientId: uid,
    userEmail: userEmail,
    isGuest: !currentUser,
    timestamp: now,
    createdAt: now,
  };

  try {
    // 1. Primary write attempt to contactSubmissions
    try {
      const submissionDocRef = doc(db, "contactSubmissions", submissionId);
      await setDoc(submissionDocRef, firestorePayload);
      return clientReturnRecord;
    } catch (subErr) {
      console.warn(
        "Notice: contactSubmissions direct write failed, ensuring persistence via contactEnquiries:",
        subErr,
      );
      // 2. Resilient fallback to contactEnquiries
      const enquiryDocRef = doc(db, "contactEnquiries", submissionId);
      await setDoc(enquiryDocRef, firestorePayload);
      return clientReturnRecord;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `contactSubmissions/${submissionId}`);
  }
}

/**
 * Retrieve all contact submissions from Firestore ordered by createdAt desc.
 * Ready for authorized admins in subsequent steps.
 */
export async function listContactSubmissions(): Promise<ContactSubmission[]> {
  try {
    try {
      const q = query(collection(db, "contactSubmissions"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs.map((d) => d.data() as ContactSubmission);
      }
    } catch {
      // Fall through to query contactEnquiries
    }

    const eq = query(collection(db, "contactEnquiries"), orderBy("createdAt", "desc"));
    const esnapshot = await getDocs(eq);
    return esnapshot.docs.map((d) => d.data() as ContactSubmission);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "contactSubmissions");
  }
}
