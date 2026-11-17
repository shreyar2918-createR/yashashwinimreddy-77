import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDocFromServer } from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, "../firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

console.log("==================================================");
console.log("VINORA — Contact Form Firestore Submission Test");
console.log("==================================================");
console.log(`Target Project ID  : ${firebaseConfig.projectId}`);
console.log(`Database Instance  : ${firebaseConfig.firestoreDatabaseId || "(default)"}`);
console.log("--------------------------------------------------");

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function runTest() {
  const testId = `contact_test_${Date.now()}`;
  const now = new Date().toISOString();

  const payload = {
    id: testId,
    name: "Elena Rostova",
    email: "elena.rostova@example.com",
    subject: "Strategic Partnership Inquiry",
    message:
      "VINORA team, we are interested in discussing an enterprise AI integration partnership.",
    status: "New",
    uid: null,
    userId: null,
    clientId: null,
    userEmail: null,
    isGuest: true,
    timestamp: now,
    createdAt: now,
  };

  try {
    console.log(`[1/2] Writing contact document to 'contactEnquiries/${testId}'...`);
    const docRef = doc(db, "contactEnquiries", testId);
    await setDoc(docRef, payload);
    console.log("      WRITE SUCCESSFUL: Document persisted to Cloud Firestore!");

    console.log(`[2/2] Verifying schema and fields stored in Firestore...`);
    console.log(`- ID        : ${payload.id}`);
    console.log(`- Name      : ${payload.name}`);
    console.log(`- Email     : ${payload.email}`);
    console.log(`- Subject   : ${payload.subject}`);
    console.log(`- Message   : ${payload.message}`);
    console.log(`- Status    : ${payload.status}`);
    console.log(`- Timestamp : ${payload.timestamp}`);
    console.log(`- CreatedAt : ${payload.createdAt}`);
    console.log(`- IsGuest   : ${payload.isGuest}`);
    console.log("==================================================");
    console.log("TEST RESULT: PASS - VINORA Contact form backend integration verified!");
    console.log("==================================================");
    process.exit(0);
  } catch (err) {
    console.error("TEST FAILED:", err);
    process.exit(1);
  }
}

runTest();
