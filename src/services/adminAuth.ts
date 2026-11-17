import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface AdminRecord {
  uid: string;
  name: string;
  email: string;
  role: "admin";
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Exactly 4 authorized administrator accounts for VINORA.
 * Admin authorization is strictly enforced by UID check against the Firestore 'admins' collection.
 */
export const AUTHORIZED_ADMIN_ACCOUNTS: ReadonlyArray<{
  readonly email: string;
  readonly name: string;
  readonly title: string;
}> = [
  {
    email: "shreyar2918@gmail.com",
    name: "Shreya R",
    title: "Engineering Director & Lead Administrator",
  },
  {
    email: "admin@vinora.io",
    name: "Alex Vance",
    title: "Head of Product & Delivery",
  },
  {
    email: "architecture@vinora.io",
    name: "Elena Rostova",
    title: "Technical Architecture Lead",
  },
  {
    email: "operations@vinora.io",
    name: "David Kim",
    title: "Security & Infrastructure Lead",
  },
] as const;

let cachedAdmin: AdminRecord | null = null;
let adminListeners: Array<(admin: AdminRecord | null, loading: boolean) => void> = [];
let isInitialCheckDone = false;

function notifyAdminListeners(admin: AdminRecord | null, loading = false) {
  cachedAdmin = admin;
  for (const listener of adminListeners) {
    try {
      listener(admin, loading);
    } catch (err) {
      console.error("[VINORA AdminAuth] Listener error:", err);
    }
  }
}

/**
 * Verifies whether a given Firebase Auth UID corresponds to an active authorized admin in Firestore.
 */
export async function getAdminRecord(uid: string): Promise<AdminRecord | null> {
  if (!uid) return null;
  try {
    const adminDocRef = doc(db, "admins", uid);
    const snap = await getDoc(adminDocRef);
    if (!snap.exists()) {
      return null;
    }
    const data = snap.data();
    const docUid = data.uid || data.id || snap.id;

    // Check active status: reject only if explicitly deactivated
    const isDeactivated =
      data.active === false ||
      data.status === "inactive" ||
      data.status === "disabled" ||
      data.disabled === true;
    if (isDeactivated) {
      return null;
    }

    // Check admin role (case-insensitive, default to admin if in admins collection)
    const role = (data.role || "admin").toString().trim().toLowerCase();
    if (role !== "admin" && role !== "administrator") {
      return null;
    }

    return {
      uid: docUid,
      name: data.name || data.fullName || "Administrator",
      email: data.email || "",
      role: "admin",
      active: true,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.warn("[VINORA AdminAuth] Error loading admin record for UID:", uid, err);
    return null;
  }
}

/**
 * Verifies that the signed-in user's UID exists in Firestore under /admins/{uid}.
 * Does not overwrite existing admin records; only creates/initializes when genuinely required for authorized admins.
 */
export async function verifyAndLoadAdmin(user: FirebaseUser): Promise<AdminRecord | null> {
  if (!user || !user.uid) return null;
  const uid = user.uid;
  const userEmail = (user.email || "").trim().toLowerCase();

  // 1. Direct check in Firestore admins collection by UID (/admins/{uid})
  try {
    const adminDocRef = doc(db, "admins", uid);
    const snap = await getDoc(adminDocRef);
    if (snap.exists()) {
      const data = snap.data();
      const docUid = data.uid || data.id || snap.id;

      // Check active status: reject if explicitly deactivated
      const isDeactivated =
        data.active === false ||
        data.status === "inactive" ||
        data.status === "disabled" ||
        data.disabled === true;
      if (isDeactivated) {
        return null;
      }

      // Check admin role
      const role = (data.role || "admin").toString().trim().toLowerCase();
      if (role !== "admin" && role !== "administrator") {
        return null;
      }

      return {
        uid: docUid,
        name: data.name || data.fullName || user.displayName || "Administrator",
        email: data.email || userEmail,
        role: "admin",
        active: true,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn("[VINORA AdminAuth] Error checking existing admin record for UID:", uid, err);
  }

  // 2. Check if admin record exists keyed by email (/admins/{email})
  if (userEmail) {
    try {
      const adminEmailDocRef = doc(db, "admins", userEmail);
      const snapByEmail = await getDoc(adminEmailDocRef);
      if (snapByEmail.exists()) {
        const data = snapByEmail.data();
        const isDeactivated =
          data.active === false ||
          data.status === "inactive" ||
          data.status === "disabled" ||
          data.disabled === true;
        if (isDeactivated) {
          return null;
        }

        const role = (data.role || "admin").toString().trim().toLowerCase();
        if (role !== "admin" && role !== "administrator") {
          return null;
        }

        const record: AdminRecord = {
          uid,
          name: data.name || data.fullName || user.displayName || "Administrator",
          email: userEmail,
          role: "admin",
          active: true,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Mirror to /admins/{uid} for future single-read lookups
        try {
          await setDoc(doc(db, "admins", uid), record, { merge: true });
        } catch {
          // Non-blocking
        }

        return record;
      }
    } catch {
      // Non-blocking
    }
  }

  // 3. Check users/{uid} collection for admin role
  try {
    const userDocRef = doc(db, "users", uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const uData = userSnap.data();
      const role = (uData.role || "").toString().trim().toLowerCase();
      if (role === "admin" || role === "administrator") {
        const isDeactivated =
          uData.active === false ||
          uData.status === "inactive" ||
          uData.status === "disabled" ||
          uData.disabled === true;
        if (isDeactivated) {
          return null;
        }

        const record: AdminRecord = {
          uid,
          name: uData.fullName || uData.name || user.displayName || "Administrator",
          email: uData.email || userEmail,
          role: "admin",
          active: true,
          createdAt: uData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        try {
          await setDoc(doc(db, "admins", uid), record, { merge: true });
        } catch {
          // Non-blocking
        }

        return record;
      }
    }
  } catch {
    // Non-blocking
  }

  // 4. Check if the user's authenticated email matches one of the authorized admin accounts
  const match = AUTHORIZED_ADMIN_ACCOUNTS.find((acc) => acc.email.toLowerCase() === userEmail);

  if (!match) {
    return null;
  }

  // 5. Provision the authorized admin document in Firestore (/admins/{uid}) without overwriting
  const now = new Date().toISOString();
  const adminDocRef = doc(db, "admins", uid);
  const newRecord: AdminRecord = {
    uid,
    name: user.displayName || match.name,
    email: userEmail,
    role: "admin",
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await setDoc(adminDocRef, newRecord, { merge: true });
    return newRecord;
  } catch (writeErr) {
    console.warn("[VINORA AdminAuth] Notice while writing admin record:", writeErr);
    return newRecord;
  }
}

/**
 * Subscribes to Admin Auth state changes.
 */
export function subscribeToAdminAuth(
  callback: (admin: AdminRecord | null, loading: boolean) => void,
): () => void {
  adminListeners.push(callback);
  callback(cachedAdmin, !isInitialCheckDone);

  return () => {
    adminListeners = adminListeners.filter((cb) => cb !== callback);
  };
}

if (typeof window !== "undefined") {
  onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (!user) {
      isInitialCheckDone = true;
      notifyAdminListeners(null, false);
      return;
    }

    try {
      const adminRecord = await verifyAndLoadAdmin(user);
      isInitialCheckDone = true;
      notifyAdminListeners(adminRecord, false);
    } catch {
      isInitialCheckDone = true;
      notifyAdminListeners(null, false);
    }
  });
}

/**
 * Authenticates an admin using email & password.
 * Strictly verifies that the authenticated UID exists and is active in Firestore admins collection.
 */
export async function signInAdmin(email: string, password: string): Promise<AdminRecord> {
  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!cleanEmail) {
    throw new Error("Please enter your admin email address.");
  }
  if (!emailRegex.test(cleanEmail)) {
    throw new Error("Please enter a valid email address.");
  }
  if (!password) {
    throw new Error("Please enter your password.");
  }

  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  } catch (err: unknown) {
    const fbErr = err as { code?: string; message?: string };
    if (fbErr?.code === "auth/operation-not-allowed") {
      throw new Error(
        "Email/Password sign-in is not enabled in Firebase. Please enable 'Email/Password' in Firebase Console > Authentication > Sign-in method.",
      );
    }
    if (
      fbErr?.code === "auth/user-not-found" ||
      fbErr?.code === "auth/invalid-credential" ||
      fbErr?.code === "auth/wrong-password"
    ) {
      throw new Error(
        "Invalid admin email or password. Please verify your credentials and try again.",
      );
    }
    if (fbErr?.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address format.");
    }
    if (fbErr?.code === "auth/user-disabled") {
      throw new Error(
        "This administrator account has been disabled. Please contact the security lead.",
      );
    }
    if (fbErr?.code === "auth/too-many-requests") {
      throw new Error(
        "Too many unsuccessful login attempts. Access is temporarily suspended. Please try again later or use Forgot Password.",
      );
    }
    if (fbErr?.code === "auth/network-request-failed") {
      throw new Error(
        "Network connection error. Please check your internet connectivity and try again.",
      );
    }
    throw new Error("Authentication failed. Please verify your credentials and try again.");
  }

  const user = cred.user;

  try {
    // Verify in Firestore that the UID belongs to an active authorized admin
    const adminRecord = await verifyAndLoadAdmin(user);

    if (!adminRecord || adminRecord.role !== "admin" || !adminRecord.active) {
      await firebaseSignOut(auth);
      notifyAdminListeners(null, false);
      throw new Error(
        "Admin access required: This account is authenticated with Firebase, but is not authorized as a VINORA administrator.",
      );
    }

    notifyAdminListeners(adminRecord, false);
    return adminRecord;
  } catch (authErr) {
    // Deny access and sign out from Firebase
    await firebaseSignOut(auth);
    notifyAdminListeners(null, false);
    if (authErr instanceof Error) {
      throw authErr;
    }
    throw new Error(
      "Admin access required: You do not have permissions to access the Admin Portal.",
    );
  }
}

/**
 * Securely signs out the admin using Firebase signOut().
 */
export async function adminSignOut(): Promise<void> {
  await firebaseSignOut(auth);
  cachedAdmin = null;
  notifyAdminListeners(null, false);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("vinora_admin_session");
    } catch {
      // Ignore
    }
  }
}

/**
 * Triggers Firebase's password reset email flow.
 */
export async function sendAdminPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!cleanEmail) {
    throw new Error("Please enter your admin email address.");
  }
  if (!emailRegex.test(cleanEmail)) {
    throw new Error("Please enter a valid email address.");
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: unknown) {
    const fbErr = err as { code?: string; message?: string };
    if (fbErr?.code === "auth/user-not-found") {
      // Do not disclose whether email exists for security, or provide friendly notice
      return;
    }
    if (fbErr?.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address.");
    }
    if (fbErr?.code === "auth/network-request-failed") {
      throw new Error("Network error. Please check your connection and try again.");
    }
    throw new Error("Unable to send password reset email. Please try again.");
  }
}

/**
 * Returns the currently cached admin record if authenticated, otherwise null.
 */
export function getCurrentAdmin(): AdminRecord | null {
  return cachedAdmin;
}

/**
 * Updates the currently signed-in administrator's display name on their own /admins/{uid} document
 * and Firebase Auth profile without modifying any other admin account.
 */
export async function updateAdminProfileName(
  uid: string,
  fullName: string,
): Promise<AdminRecord | null> {
  const trimmed = fullName.trim();
  if (!uid || !trimmed) {
    throw new Error("Administrator name cannot be empty.");
  }

  const now = new Date().toISOString();
  const adminDocRef = doc(db, "admins", uid);
  await updateDoc(adminDocRef, {
    name: trimmed,
    fullName: trimmed,
    updatedAt: now,
  });

  if (auth.currentUser && auth.currentUser.uid === uid) {
    try {
      await updateProfile(auth.currentUser, { displayName: trimmed });
    } catch {
      // Non-blocking Auth display name sync
    }
  }

  const refreshed = await getAdminRecord(uid);
  if (refreshed) {
    notifyAdminListeners(refreshed, false);
  }
  return refreshed;
}
