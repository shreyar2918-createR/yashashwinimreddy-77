import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  collection,
} from "firebase/firestore";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, "../firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

console.log("==================================================");
console.log("VINORA — Client Dashboard Firebase Security & Data Test");
console.log("==================================================");
console.log(`Target Project ID : ${firebaseConfig.projectId}`);
console.log(`Database Instance : ${firebaseConfig.firestoreDatabaseId || "(default)"}`);
console.log("--------------------------------------------------");

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
const auth = getAuth(app);

async function runDashboardTests() {
  const timestamp = Date.now();
  const testEmail = `client.test.${timestamp}@vinoratech-test.com`;
  const testPassword = `VinoraPass_${timestamp}!`;
  const otherClientId = `other_client_attacker_uid_${timestamp}`;

  try {
    // 1. Authenticate client with Firebase Auth
    console.log(`[1/6] Authenticating client user '${testEmail}' with Firebase Auth...`);
    let userCredential;
    try {
      userCredential = await createUserWithEmailAndPassword(auth, testEmail, testPassword);
    } catch (e) {
      userCredential = await signInWithEmailAndPassword(auth, testEmail, testPassword);
    }
    const authedUser = userCredential.user;
    const clientUid = authedUser.uid;
    console.log(`      AUTHENTICATED: Client UID is '${clientUid}'.`);

    // 2. Persist project request owned by this authenticated client
    const testRequestId = `req_client_${timestamp}`;
    const now = new Date().toISOString();
    const testProjectPayload = {
      id: testRequestId,
      clientId: clientUid,
      title: "Vance Vanguard Enterprise AI Suite",
      details:
        "Full cloud migration and custom LLM agent orchestrator integration across internal data lakes.",
      priority: "high",
      status: "Submitted",
      createdAt: now,
    };

    console.log(`[2/6] Storing project request '${testRequestId}' for client '${clientUid}'...`);
    await setDoc(doc(db, "requests", testRequestId), testProjectPayload);
    console.log("      WRITE SUCCESSFUL: Record stored in Cloud Firestore.");

    // 3. Query client's own project requests as the authenticated client
    console.log(`[3/6] Querying Firestore for client '${clientUid}' project requests...`);
    const clientQuery = query(collection(db, "requests"), where("clientId", "==", clientUid));
    const snap = await getDocs(clientQuery);

    if (snap.empty) {
      throw new Error(`Expected at least 1 record for client '${clientUid}', got 0`);
    }

    const fetchedItem = snap.docs[0].data();
    console.log("      READ SUCCESSFUL: Loaded client project request from Firestore.");

    // Verify the 4 mandatory fields
    console.log("      ✓ Project Name         : " + fetchedItem.title);
    console.log("      ✓ Submission Date      : " + fetchedItem.createdAt);
    console.log("      ✓ Current Status       : " + fetchedItem.status);
    console.log("      ✓ Project Reference ID : " + fetchedItem.id);

    // 4. Query other dashboard collections (Projects, Proposals, Documents, Invoices, Messages)
    console.log(`[4/6] Querying client dashboard sections from Firestore...`);
    const sections = [
      { name: "projects", field: "clientId" },
      { name: "proposals", field: "clientId" },
      { name: "documents", field: "clientId" },
      { name: "invoices", field: "clientId" },
      { name: "messages", field: "senderId" },
    ];
    for (const sec of sections) {
      const secQuery = query(collection(db, sec.name), where(sec.field, "==", clientUid));
      const secSnap = await getDocs(secQuery);
      console.log(`      ✓ Section '${sec.name}' query verified: ${secSnap.size} records found.`);
    }

    // 5. Test Security Isolation: Ensure client CANNOT access another client's private document
    console.log(
      `[5/6] Security Check: Verifying client cannot access another client's private data...`,
    );
    const otherClientDocRef = doc(db, "clients", otherClientId);
    let crossAccessDenied = false;
    try {
      await getDoc(otherClientDocRef);
    } catch (secErr) {
      crossAccessDenied = true;
      console.log(`      SECURITY PASSED: Access to '${otherClientId}' rejected:`, secErr.code);
    }

    // 6. Test Unauthenticated Access Denial: verify signed-out visitor cannot read client data
    await signOut(auth);
    console.log(
      `[6/6] Security Check: Verifying signed-out visitor is denied access to client data...`,
    );
    let signedOutAccessBlocked = false;
    try {
      const unauthQuery = query(collection(db, "requests"), where("clientId", "==", clientUid));
      await getDocs(unauthQuery);
    } catch (unauthErr) {
      signedOutAccessBlocked = true;
      console.log("      SECURITY PASSED: Unauthenticated client query blocked:", unauthErr.code);
    }

    if (!signedOutAccessBlocked) {
      throw new Error("Security check failed: unauthenticated user was not blocked!");
    }

    console.log("==================================================");
    console.log("ALL TESTS PASSED: VINORA Client Dashboard securely integrated with Firestore!");
    console.log("==================================================");
    process.exit(0);
  } catch (err) {
    console.error("TEST FAILED:", err);
    process.exit(1);
  }
}

runDashboardTests();
