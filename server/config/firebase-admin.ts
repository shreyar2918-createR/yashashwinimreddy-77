import { initializeApp, getApps, getApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage, type Storage } from "firebase-admin/storage";
import { getServerEnv } from "./env";

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;
let adminStorage: Storage | null = null;

export function getAdminApp(): App {
  if (adminApp) return adminApp;

  const existing = getApps();
  if (existing.length > 0 && existing[0]) {
    adminApp = existing[0];
    return adminApp;
  }

  const env = getServerEnv();

  // If service account credentials are provided as env vars
  if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
    adminApp = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      projectId: env.FIREBASE_PROJECT_ID,
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
    });
  } else {
    // Default initialization (e.g. Google Cloud Run ADC or Project default)
    adminApp = initializeApp({
      projectId: env.FIREBASE_PROJECT_ID,
      storageBucket: env.FIREBASE_STORAGE_BUCKET,
    });
  }

  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    const app = getAdminApp();
    const env = getServerEnv();
    adminDb = getFirestore(app, env.FIREBASE_DATABASE_ID);
  }
  return adminDb;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    const app = getAdminApp();
    adminAuth = getAuth(app);
  }
  return adminAuth;
}

export function getAdminStorage(): Storage {
  if (!adminStorage) {
    const app = getAdminApp();
    adminStorage = getStorage(app);
  }
  return adminStorage;
}

export function isFirebaseAdminInitialized(): boolean {
  return getApps().length > 0;
}
