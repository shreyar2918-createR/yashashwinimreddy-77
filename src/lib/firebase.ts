import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
  getDoc,
  type Firestore,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase client app (singleton)
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const firestoreDatabaseId =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? firebaseConfig.firestoreDatabaseId
    : undefined;

// Initialize Firestore with specific database ID or default.
// In browser environments (e.g. sandboxed iframes, reverse proxies), we enforce experimentalForceLongPolling
// to prevent WebChannel stream aborts that trigger "Could not reach Cloud Firestore backend [code=unavailable]".
export const db: Firestore = (() => {
  if (typeof window !== "undefined") {
    try {
      return initializeFirestore(
        app,
        {
          experimentalForceLongPolling: true,
        },
        firestoreDatabaseId,
      );
    } catch {
      return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
    }
  }
  return firestoreDatabaseId ? getFirestore(app, firestoreDatabaseId) : getFirestore(app);
})();

// Initialize Firebase Auth
export const auth = getAuth(app);
if (typeof window !== "undefined") {
  try {
    auth.useDeviceLanguage();
  } catch {
    // Non-blocking
  }
}

export { firebaseConfig };

// Initialize Firebase Storage
export const storage = getStorage(
  app,
  firebaseConfig.storageBucket ? `gs://${firebaseConfig.storageBucket}` : undefined,
);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Standard Firestore error handler per security & debugging guidelines.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const current = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: current?.uid ?? null,
      email: current?.email ?? null,
      emailVerified: current?.emailVerified ?? null,
      isAnonymous: current?.isAnonymous ?? null,
      tenantId: current?.tenantId ?? null,
      providerInfo:
        current?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Tests connection to Firestore in background per Firebase skill specifications.
 */
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, "test", "connection"));
    console.info("[VINORA] Cloud Firestore connected successfully.");
    return true;
  } catch (error) {
    // If server direct read times out while initializing transport, attempt standard read
    try {
      await getDoc(doc(db, "test", "connection"));
      console.info("[VINORA] Cloud Firestore connected successfully (transport active).");
      return true;
    } catch {
      if (error instanceof Error && error.message.includes("the client is offline")) {
        console.warn(
          "[VINORA] Firestore client is offline or network is unreachable. Please check your Firebase configuration.",
        );
      } else {
        console.warn(
          "[VINORA] Firestore connection check:",
          error instanceof Error ? error.message : error,
        );
      }
      return false;
    }
  }
}
