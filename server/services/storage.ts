import { getAdminStorage } from "../config/firebase-admin";

export type StorageCategory =
  | "project_image"
  | "project_video"
  | "client_document"
  | "deliverable"
  | "agreement"
  | "invoice"
  | "chat_attachment";

export interface StoragePolicy {
  allowedMimeTypes: string[];
  maxSizeBytes: number;
}

export const STORAGE_POLICIES: Record<StorageCategory, StoragePolicy> = {
  project_image: {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
    maxSizeBytes: 10 * 1024 * 1024, // 10MB
  },
  project_video: {
    allowedMimeTypes: ["video/mp4", "video/webm", "video/quicktime"],
    maxSizeBytes: 200 * 1024 * 1024, // 200MB
  },
  client_document: {
    allowedMimeTypes: [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
    ],
    maxSizeBytes: 25 * 1024 * 1024, // 25MB
  },
  deliverable: {
    allowedMimeTypes: ["application/zip", "application/pdf", "image/png", "video/mp4"],
    maxSizeBytes: 500 * 1024 * 1024, // 500MB
  },
  agreement: {
    allowedMimeTypes: ["application/pdf"],
    maxSizeBytes: 20 * 1024 * 1024, // 20MB
  },
  invoice: {
    allowedMimeTypes: ["application/pdf"],
    maxSizeBytes: 15 * 1024 * 1024, // 15MB
  },
  chat_attachment: {
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"],
    maxSizeBytes: 20 * 1024 * 1024, // 20MB
  },
};

/**
 * Generates structured, sanitized cloud storage paths according to the security hierarchy.
 */
export function buildStoragePath(
  category: StorageCategory,
  entityId: string,
  filename: string,
): string {
  // Sanitize filename to prevent directory traversal
  const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();

  switch (category) {
    case "project_image":
      return `projects/${entityId}/images/${timestamp}_${cleanName}`;
    case "project_video":
      return `projects/${entityId}/videos/${timestamp}_${cleanName}`;
    case "client_document":
      return `clients/${entityId}/documents/${timestamp}_${cleanName}`;
    case "deliverable":
      return `projects/${entityId}/deliverables/${timestamp}_${cleanName}`;
    case "agreement":
      return `projects/${entityId}/agreements/${timestamp}_${cleanName}`;
    case "invoice":
      return `invoices/${entityId}/files/${timestamp}_${cleanName}`;
    case "chat_attachment":
      return `chats/${entityId}/attachments/${timestamp}_${cleanName}`;
    default:
      return `uploads/${entityId}/${timestamp}_${cleanName}`;
  }
}

/**
 * Validates whether a file upload conforms to security and size constraints.
 */
export function validateStorageFile(
  category: StorageCategory,
  contentType: string,
  sizeBytes: number,
): { valid: boolean; error?: string } {
  const policy = STORAGE_POLICIES[category];
  if (!policy) {
    return { valid: false, error: `Unknown storage category: ${category}` };
  }

  if (!policy.allowedMimeTypes.includes(contentType)) {
    return {
      valid: false,
      error: `Invalid content type '${contentType}'. Allowed types: ${policy.allowedMimeTypes.join(", ")}`,
    };
  }

  if (sizeBytes > policy.maxSizeBytes) {
    return {
      valid: false,
      error: `File size ${sizeBytes} bytes exceeds maximum of ${policy.maxSizeBytes} bytes`,
    };
  }

  return { valid: true };
}

/**
 * Generates signed download URL with expiration for secure authenticated client access.
 */
export async function getSecureDownloadUrl(
  storagePath: string,
  expiresInMinutes = 60,
): Promise<string> {
  const storage = getAdminStorage();
  const bucket = storage.bucket();
  const file = bucket.file(storagePath);

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInMinutes * 60 * 1000,
  });

  return url;
}
