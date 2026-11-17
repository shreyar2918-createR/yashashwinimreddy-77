import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  getDocs,
  type Unsubscribe,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage, handleFirestoreError, OperationType } from "@/lib/firebase";
import { createUserNotification } from "@/services/notificationService";
import type { ClientDocument } from "@/lib/types";

// Maximum allowable file size: 50 Megabytes
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export const SUPPORTED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "zip",
] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

export interface UploadDocumentInput {
  file: File;
  clientId: string; // Target client UID
  clientName?: string;
  clientEmail?: string;
  projectId?: string;
  projectTitle?: string;
  displayName?: string;
  visibility?: "client" | "internal" | "public";
  uploadedBy: string; // Admin display name
  uploadedByEmail?: string;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a candidate file before initiating upload.
 * Ensures acceptable extension, MIME category, and size limits.
 */
export function validateDocumentFile(file: File): FileValidationResult {
  if (!file) {
    return { valid: false, error: "Please select a file to upload." };
  }

  if (file.size <= 0) {
    return { valid: false, error: "The selected file is empty (0 bytes)." };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `File size exceeds the 50 MB limit (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  const parts = file.name.split(".");
  const ext = (parts.length > 1 ? parts.pop() : "")?.toLowerCase() || "";

  if (!SUPPORTED_EXTENSIONS.includes(ext as SupportedExtension)) {
    return {
      valid: false,
      error: `Unsupported file type (.${ext}). Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, WEBP, and ZIP.`,
    };
  }

  return { valid: true };
}

/**
 * Determines a concise uppercase file type classification.
 */
export function getFileTypeCategory(fileName: string, mimeType?: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  if (ext === "pdf" || mimeType?.includes("pdf")) return "PDF";
  if (["doc", "docx"].includes(ext) || mimeType?.includes("word")) return "DOC";
  if (["xls", "xlsx"].includes(ext) || mimeType?.includes("sheet") || mimeType?.includes("excel"))
    return "XLS";
  if (["ppt", "pptx"].includes(ext) || mimeType?.includes("presentation")) return "PPT";
  if (["jpg", "jpeg", "png", "webp"].includes(ext) || mimeType?.startsWith("image/"))
    return "IMAGE";
  if (ext === "zip" || mimeType?.includes("zip")) return "ZIP";

  return ext.toUpperCase() || "DOCUMENT";
}

/**
 * Formats byte size into human readable string.
 */
export function formatDocumentSize(bytes?: number): string {
  if (bytes === undefined || bytes === null || isNaN(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Normalizes raw Firestore document snapshot data into ClientDocument.
 */
function parseDocumentDoc(id: string, data: Record<string, unknown>): ClientDocument {
  const fileName =
    typeof data.fileName === "string"
      ? data.fileName
      : typeof data.name === "string"
        ? data.name
        : "file";

  const storagePath = typeof data.storagePath === "string" ? data.storagePath : "";
  const contentType = typeof data.contentType === "string" ? data.contentType : undefined;
  const fileType =
    typeof data.fileType === "string" ? data.fileType : getFileTypeCategory(fileName, contentType);

  return {
    id,
    clientId: typeof data.clientId === "string" ? data.clientId : "",
    clientUid:
      typeof data.clientUid === "string" ? data.clientUid : (data.clientId as string) || "",
    clientName: typeof data.clientName === "string" ? data.clientName : undefined,
    clientEmail: typeof data.clientEmail === "string" ? data.clientEmail : undefined,
    projectId: typeof data.projectId === "string" ? data.projectId : undefined,
    projectTitle: typeof data.projectTitle === "string" ? data.projectTitle : undefined,
    name: typeof data.name === "string" ? data.name : fileName,
    fileName,
    storagePath,
    downloadUrl: typeof data.downloadUrl === "string" ? data.downloadUrl : undefined,
    contentType,
    fileType,
    sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : undefined,
    visibility: (typeof data.visibility === "string" ? data.visibility : "client") as
      "client" | "internal" | "public",
    uploadedBy: typeof data.uploadedBy === "string" ? data.uploadedBy : "VINORA Studio",
    uploadedByEmail: typeof data.uploadedByEmail === "string" ? data.uploadedByEmail : undefined,
    uploadedAt:
      typeof data.uploadedAt === "string"
        ? data.uploadedAt
        : typeof data.createdAt === "string"
          ? data.createdAt
          : new Date().toISOString(),
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
}

/**
 * Uploads a document to Firebase Storage and stores its metadata record in Firestore.
 * Scoped strictly to the target client's UID.
 */
export async function uploadClientDocument(
  input: UploadDocumentInput,
  onProgress?: (progressPercent: number) => void,
): Promise<ClientDocument> {
  const validation = validateDocumentFile(input.file);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid file.");
  }

  if (!input.clientId) {
    throw new Error("A valid Client UID is required to upload a client document.");
  }

  const now = new Date().toISOString();
  const docRef = doc(collection(db, "documents"));
  const documentId = docRef.id;

  // Sanitize file name for cloud storage
  const sanitizedFileName = input.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `client_documents/${input.clientId}/${documentId}/${sanitizedFileName}`;
  const storageRef = ref(storage, storagePath);

  // 1. Upload to Firebase Storage with progress tracking
  const uploadTask = uploadBytesResumable(storageRef, input.file, {
    contentType: input.file.type || "application/octet-stream",
    customMetadata: {
      documentId,
      clientId: input.clientId,
      uploadedBy: input.uploadedBy,
    },
  });

  await new Promise<void>((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (onProgress && snapshot.totalBytes > 0) {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          onProgress(progress);
        }
      },
      (error) => {
        console.error("[VINORA Storage] Upload error:", error);
        reject(error);
      },
      () => resolve(),
    );
  });

  // 2. Obtain permanent/tokenized download URL
  let downloadUrl = "";
  try {
    downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
  } catch (err) {
    console.warn("[VINORA Storage] Failed retrieving download URL immediately:", err);
  }

  // 3. Persist document metadata in Firestore
  const fileType = getFileTypeCategory(input.file.name, input.file.type);
  const metadataRecord: ClientDocument = {
    id: documentId,
    clientId: input.clientId,
    clientUid: input.clientId,
    clientName: input.clientName || undefined,
    clientEmail: input.clientEmail || undefined,
    projectId: input.projectId || undefined,
    projectTitle: input.projectTitle || undefined,
    name: input.displayName?.trim() || input.file.name,
    fileName: input.file.name,
    storagePath,
    downloadUrl: downloadUrl || undefined,
    contentType: input.file.type || "application/octet-stream",
    fileType,
    sizeBytes: input.file.size,
    visibility: input.visibility || "client",
    uploadedBy: input.uploadedBy,
    uploadedByEmail: input.uploadedByEmail || undefined,
    uploadedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(docRef, metadataRecord);
    if (metadataRecord.visibility !== "internal") {
      void createUserNotification({
        userId: input.clientId,
        title: `New Document Shared: ${metadataRecord.name}`,
        body: `${input.uploadedBy || "VINORA Studio"} shared ${metadataRecord.fileName || metadataRecord.name} in your Documents library.`,
        type: "document_uploaded",
        link: `/client?section=documents`,
        projectId: metadataRecord.projectId,
      });
    }
    return metadataRecord;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `documents/${documentId}`);
    throw err;
  }
}

/**
 * Real-time subscription to documents for an authenticated client.
 * Enforces strict client isolation: only files where clientId == auth.uid are returned.
 */
export function subscribeClientDocuments(
  clientId: string,
  onData: (documents: ClientDocument[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  if (!clientId) {
    onData([]);
    return () => {};
  }

  const q = query(collection(db, "documents"), where("clientId", "==", clientId));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ClientDocument[] = [];
      snapshot.forEach((docSnap) => {
        list.push(parseDocumentDoc(docSnap.id, docSnap.data()));
      });

      // Sort newest first
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    (err) => {
      console.error(`[VINORA Documents] Subscription error for client ${clientId}:`, err);
      if (onError) onError(err);
    },
  );
}

/**
 * Real-time subscription to all client documents for the Admin Dashboard.
 * Protected by Firestore security rules to authorized administrators.
 */
export function subscribeAllDocuments(
  onData: (documents: ClientDocument[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const colRef = collection(db, "documents");

  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: ClientDocument[] = [];
      snapshot.forEach((docSnap) => {
        list.push(parseDocumentDoc(docSnap.id, docSnap.data()));
      });

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      onData(list);
    },
    (err) => {
      console.error("[VINORA Documents] Admin subscription error:", err);
      if (onError) onError(err);
    },
  );
}

/**
 * Fetches all documents once for the Admin Dashboard.
 */
export async function fetchAllDocuments(): Promise<ClientDocument[]> {
  try {
    const snap = await getDocs(collection(db, "documents"));
    const list: ClientDocument[] = [];
    snap.forEach((docSnap) => {
      list.push(parseDocumentDoc(docSnap.id, docSnap.data()));
    });
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return list;
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, "documents");
    return [];
  }
}

/**
 * Resolves a direct accessible download URL for a document.
 * Checks existing downloadUrl, or fetches fresh signed URL from Firebase Storage.
 */
export async function resolveDocumentUrl(docItem: ClientDocument): Promise<string> {
  if (docItem.downloadUrl && docItem.downloadUrl.startsWith("http")) {
    return docItem.downloadUrl;
  }

  if (!docItem.storagePath) {
    throw new Error("Document storage path is missing.");
  }

  // If storagePath itself is a valid HTTP link
  if (docItem.storagePath.startsWith("http")) {
    return docItem.storagePath;
  }

  try {
    const storageRef = ref(storage, docItem.storagePath);
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.error("[VINORA Storage] Failed resolving document URL:", err);
    throw new Error("Unable to retrieve download URL from cloud storage.");
  }
}

/**
 * Deletes a document from both Firebase Storage and Firestore.
 * Admin-only operation enforced by Storage and Firestore rules.
 */
export async function deleteClientDocument(
  documentId: string,
  storagePath?: string,
): Promise<void> {
  if (!documentId) {
    throw new Error("Document ID is required.");
  }

  // 1. Attempt to remove physical file from Firebase Storage
  if (storagePath && !storagePath.startsWith("http")) {
    try {
      const storageRef = ref(storage, storagePath);
      await deleteObject(storageRef);
    } catch (err) {
      // If file was already removed or missing, continue deleting Firestore metadata
      console.warn("[VINORA Storage] Notice during storage file deletion:", err);
    }
  }

  // 2. Delete metadata from Firestore
  try {
    const docRef = doc(db, "documents", documentId);
    await deleteDoc(docRef);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `documents/${documentId}`);
    throw err;
  }
}
