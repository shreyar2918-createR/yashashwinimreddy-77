import { getAdminAuth, getAdminDb } from "../config/firebase-admin";
import type { UserEntity, UserRole } from "../types";

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  role: UserRole;
}

/**
 * Extracts and verifies Firebase ID Token from Authorization header.
 */
export async function authenticateRequest(request: Request): Promise<AuthenticatedUser | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) return null;

  try {
    const adminAuth = getAdminAuth();
    const decoded = await adminAuth.verifyIdToken(token);

    // Fetch user profile or admin role from Firestore
    let role: UserRole = "client";
    try {
      const db = getAdminDb();
      const adminDoc = await db.collection("admins").doc(decoded.uid).get();
      if (adminDoc.exists || decoded.email === "shreyar2918@gmail.com") {
        role = "admin";
      } else {
        const userDoc = await db.collection("users").doc(decoded.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data() as UserEntity;
          role = userData.role || "client";
        }
      }
    } catch {
      // Fallback if db query fails or not provisioned yet
      if (decoded.email === "shreyar2918@gmail.com") {
        role = "admin";
      }
    }

    return {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified: decoded.email_verified ?? false,
      role,
    };
  } catch (error) {
    console.error("Failed to verify authentication token:", error);
    return null;
  }
}

/**
 * Checks if the request is from an authenticated admin.
 */
export async function requireAdminAuth(request: Request): Promise<AuthenticatedUser | null> {
  const user = await authenticateRequest(request);
  if (!user) return null;

  const adminRoles: UserRole[] = ["super_admin", "admin", "project_manager", "content_admin"];
  if (adminRoles.includes(user.role) || user.email === "shreyar2918@gmail.com") {
    return user;
  }

  return null;
}
