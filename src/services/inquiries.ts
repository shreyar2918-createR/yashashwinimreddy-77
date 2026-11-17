import { collection, doc, setDoc, getDocs, query, where, orderBy } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage, handleFirestoreError, OperationType } from "@/lib/firebase";
import { getClientDetailedProfile } from "./auth";
import type { ProjectRequest } from "@/lib/types";

export interface ProjectInquiryInput {
  name: string;
  email: string;
  businessName?: string | undefined;
  serviceRequired: string;
  projectDescription: string;
  budget?: string | undefined;
  expectedCompletionDate?: string | undefined;
  referenceWebsites?: string | undefined;
  preferredCommunication: string;
  additionalRequirements?: string | undefined;
  files?: File[];
}

/**
 * Uploads an attachment to Firebase Storage.
 * Falls back gracefully to file metadata if Storage bucket access is restricted.
 */
async function uploadInquiryFile(requestId: string, file: File): Promise<string> {
  try {
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `project_attachments/${requestId}/${timestamp}_${safeName}`;
    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);
    return downloadUrl;
  } catch (err) {
    console.warn(
      "Notice: File upload to Firebase Storage skipped or restricted, saving reference:",
      err,
    );
    return `local:${file.name} (${Math.round(file.size / 1024)} KB)`;
  }
}

/**
 * Persists a project inquiry to Firestore collection "projectRequests".
 * If the user is logged in, automatically associates the request with their Firebase UID and client profile.
 * Sets initial status to "Pending Review" and timestamps the submission.
 */
export async function submitProjectInquiry(input: ProjectInquiryInput): Promise<ProjectRequest> {
  const reqRef = doc(collection(db, "projectRequests"));
  const requestId = reqRef.id;
  const now = new Date().toISOString();

  // 1. Check current authenticated user session
  const currentUser = auth.currentUser;
  let clientId: string | null = null;
  let clientProfile: ProjectRequest["clientProfile"] = null;

  if (currentUser) {
    clientId = currentUser.uid;
    try {
      const detailed = await getClientDetailedProfile(currentUser.uid);
      if (detailed) {
        clientProfile = {
          uid: currentUser.uid,
          email: detailed.email || currentUser.email || input.email,
          fullName: detailed.fullName || currentUser.displayName || input.name,
          companyName: detailed.companyName || input.businessName || "",
          phone: detailed.phone || "",
          role: detailed.role || "client",
        };
      } else {
        clientProfile = {
          uid: currentUser.uid,
          email: currentUser.email || input.email,
          fullName: currentUser.displayName || input.name,
          companyName: input.businessName || "",
          phone: currentUser.phoneNumber || "",
          role: "client",
        };
      }
    } catch (err) {
      console.warn("Could not retrieve detailed client profile for project request:", err);
      clientProfile = {
        uid: currentUser.uid,
        email: currentUser.email || input.email,
        fullName: currentUser.displayName || input.name,
        companyName: input.businessName || "",
        phone: currentUser.phoneNumber || "",
        role: "client",
      };
    }
  }

  // 2. Handle file attachments (if any)
  const attachmentPaths: string[] = [];
  if (input.files && input.files.length > 0) {
    for (const file of input.files) {
      const pathOrUrl = await uploadInquiryFile(requestId, file);
      attachmentPaths.push(pathOrUrl);
    }
  }

  // 3. Assemble complete project request document
  const record: ProjectRequest = {
    id: requestId,
    clientId: clientId || null,
    clientProfile: clientProfile || null,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    businessName: input.businessName?.trim() || "",
    serviceRequired: input.serviceRequired.trim(),
    projectDescription: input.projectDescription.trim(),
    budget: input.budget?.trim() || "",
    expectedCompletionDate: input.expectedCompletionDate?.trim() || "",
    referenceWebsites: input.referenceWebsites?.trim() || "",
    preferredCommunication: input.preferredCommunication.trim(),
    additionalRequirements: input.additionalRequirements?.trim() || "",
    attachmentPaths,
    status: "Pending Review",
    createdAt: now,
    isRegisteredClient: Boolean(clientId),
  };

  // 4. Save to Firestore "projectRequests" collection
  try {
    await setDoc(reqRef, record);
    return record;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `projectRequests/${requestId}`);
  }
}

/**
 * Admin: list inbound project requests from Firestore "projectRequests" collection.
 * Ready for the admin dashboard in subsequent steps.
 */
export async function listProjectRequests(): Promise<ProjectRequest[]> {
  try {
    const q = query(collection(db, "projectRequests"), orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => docSnap.data() as ProjectRequest);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "projectRequests");
  }
}

/**
 * Client: list own submitted project requests by client UID and/or email.
 * Automatically links requests submitted as guest once client logs in.
 */
export async function listClientProjectRequests(
  clientId: string,
  clientEmail?: string,
): Promise<ProjectRequest[]> {
  try {
    const resultsMap = new Map<string, ProjectRequest>();

    // 1. Query by clientId
    try {
      const qUid = query(
        collection(db, "projectRequests"),
        where("clientId", "==", clientId),
        orderBy("createdAt", "desc"),
      );
      const snapshotUid = await getDocs(qUid);
      for (const docSnap of snapshotUid.docs) {
        resultsMap.set(docSnap.id, docSnap.data() as ProjectRequest);
      }
    } catch (uidErr) {
      console.warn("UID-based inquiry query fallback:", uidErr);
    }

    // 2. Query by email if provided to locate inquiries submitted prior to registration
    if (clientEmail) {
      try {
        const cleanEmail = clientEmail.trim().toLowerCase();
        const qEmail = query(collection(db, "projectRequests"), where("email", "==", cleanEmail));
        const snapshotEmail = await getDocs(qEmail);
        for (const docSnap of snapshotEmail.docs) {
          const data = docSnap.data() as ProjectRequest;
          resultsMap.set(docSnap.id, data);

          // Auto-link if clientId is missing
          if (!data.clientId && docSnap.ref) {
            setDoc(
              docSnap.ref,
              {
                clientId,
                isRegisteredClient: true,
                updatedAt: new Date().toISOString(),
              },
              { merge: true },
            ).catch((linkErr) => console.warn("Auto-link project request notice:", linkErr));
          }
        }
      } catch (emailErr) {
        console.warn("Email-based inquiry link notice:", emailErr);
      }
    }

    return Array.from(resultsMap.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "projectRequests");
  }
}
