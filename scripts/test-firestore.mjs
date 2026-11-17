import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDocFromServer } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, "../firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

console.log("==================================================");
console.log("VINORA — Cloud Firestore Connection Test Script");
console.log("==================================================");
console.log(`Target Project ID  : ${firebaseConfig.projectId}`);
console.log(`Database Instance  : ${firebaseConfig.firestoreDatabaseId || "(default)"}`);
console.log(`Collection Name    : test_collection`);
console.log(`Test Document ID   : connection_status`);
console.log("--------------------------------------------------");

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function executeTest() {
  const startTime = Date.now();
  const testDocRef = doc(db, "test_collection", "connection_status");

  const testPayload = {
    message: "VINORA Cloud Firestore connection active",
    status: "online",
    collection: "test_collection",
    testedBy: "VINORA Verification Agent",
    clientTimestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  };

  try {
    // 1. Write Operation
    console.log("[1/2] Executing write operation to 'test_collection/connection_status'...");
    await setDoc(testDocRef, testPayload);
    console.log("      WRITE SUCCESSFUL: Document written to Cloud Firestore.");

    // 2. Read Operation directly from server
    console.log(
      "[2/2] Executing server read operation from 'test_collection/connection_status'...",
    );
    const snapshot = await getDocFromServer(testDocRef);

    if (!snapshot.exists()) {
      throw new Error("Document was written, but snapshot.exists() is false.");
    }

    const retrievedData = snapshot.data();
    const duration = Date.now() - startTime;

    console.log("      READ SUCCESSFUL: Data retrieved from Cloud Firestore!");
    console.log("--------------------------------------------------");
    console.log("Retrieved Payload:");
    console.log(JSON.stringify(retrievedData, null, 2));
    console.log("--------------------------------------------------");
    console.log(`STATUS: SUCCESS (Total round-trip: ${duration}ms)`);
    console.log("==================================================");
    process.exit(0);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("--------------------------------------------------");
    console.error(`STATUS: FAILED after ${duration}ms`);
    console.error(`Error Code    : ${error?.code || "UNKNOWN"}`);
    console.error(`Error Message : ${error?.message || error}`);
    console.error("--------------------------------------------------");

    if (error?.code === "permission-denied") {
      console.error("ACTION REQUIRED:");
      console.error(
        "Firestore rules on project '" +
          firebaseConfig.projectId +
          "' blocked access.\n" +
          "In Firebase Console > Firestore Database > Rules, ensure you have published:\n\n" +
          "  match /test_collection/{docId} {\n" +
          "    allow get: if docId == 'connection_status';\n" +
          "    allow create, update: if docId == 'connection_status' &&\n" +
          "      incoming().keys().hasAll(['status', 'clientTimestamp', 'message']) &&\n" +
          "      incoming().status is string &&\n" +
          "      incoming().message is string && incoming().message.size() <= 200 &&\n" +
          "      incoming().clientTimestamp is string;\n" +
          "    allow delete: if isAdmin();\n" +
          "  }\n",
      );
    }
    console.error("==================================================");
    process.exit(1);
  }
}

executeTest();
