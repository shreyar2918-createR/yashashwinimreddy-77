import { doc, getDocFromServer, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface FirestoreTestDocument {
  message: string;
  status: string;
  collection: string;
  clientTimestamp: string;
  writtenBy: string;
  pingCount: number;
}

export interface FirestoreTestResult {
  state: "idle" | "testing" | "success" | "error";
  collectionName: string;
  documentId: string;
  writeSuccess: boolean;
  readSuccess: boolean;
  retrievedData: FirestoreTestDocument | null;
  durationMs: number;
  timestamp: string;
  errorMessage?: string;
  errorCode?: string;
  actionRequired?: string;
}

let pingCounter = 0;

/**
 * Performs a real write and read operation against Firestore 'test_collection'
 * and returns the outcome and retrieved data.
 */
export async function executeFirestoreConnectionTest(): Promise<FirestoreTestResult> {
  const startTime = Date.now();
  pingCounter += 1;
  const collectionName = "test_collection";
  const documentId = "connection_status";
  const docRef = doc(db, collectionName, documentId);

  const payload: FirestoreTestDocument = {
    message: "Cloud Firestore connection active & verified",
    status: "online",
    collection: collectionName,
    clientTimestamp: new Date().toISOString(),
    writtenBy: "VINORA Client Web App",
    pingCount: pingCounter,
  };

  let writeSuccess = false;
  let readSuccess = false;
  let retrievedData: FirestoreTestDocument | null = null;

  try {
    // 1. Write to test_collection
    await setDoc(docRef, payload);
    writeSuccess = true;

    // 2. Read back directly from server (bypassing local cache)
    const snapshot = await getDocFromServer(docRef);
    if (!snapshot.exists()) {
      throw new Error("Write acknowledged, but document was not found on server read.");
    }

    readSuccess = true;
    retrievedData = snapshot.data() as FirestoreTestDocument;
    const durationMs = Date.now() - startTime;

    return {
      state: "success",
      collectionName,
      documentId,
      writeSuccess: true,
      readSuccess: true,
      retrievedData,
      durationMs,
      timestamp: new Date().toLocaleTimeString(),
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const errorObj = err as { code?: string; message?: string };
    const code = errorObj?.code || "unknown";
    const message = errorObj?.message || String(err);

    let actionRequired: string | undefined;
    if (code.includes("permission-denied")) {
      actionRequired =
        "Firestore rules on your project blocked access to 'test_collection'. In Firebase Console > Firestore Database > Rules, add: match /test_collection/{docId} { allow read, write: if true; } and click Publish.";
    } else if (code.includes("unavailable") || message.includes("offline")) {
      actionRequired =
        "Could not establish connection to Google Cloud Firestore servers. Please check your network or ensure Firestore Database is enabled in Firebase Console.";
    }

    return {
      state: "error",
      collectionName,
      documentId,
      writeSuccess,
      readSuccess,
      retrievedData,
      durationMs,
      timestamp: new Date().toLocaleTimeString(),
      errorCode: code,
      errorMessage: message,
      actionRequired,
    };
  }
}
