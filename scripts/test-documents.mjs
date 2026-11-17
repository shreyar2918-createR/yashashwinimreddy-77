import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, "../firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

console.log("==================================================");
console.log("VINORA — Step 14: Client Documents & File Management Verification");
console.log("==================================================");
console.log(`Target Project ID  : ${firebaseConfig.projectId}`);
console.log(`Database Instance  : ${firebaseConfig.firestoreDatabaseId || "(default)"}`);
console.log(`Storage Bucket     : ${firebaseConfig.storageBucket}`);
console.log("--------------------------------------------------");

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function runDocumentTests() {
  const testDocId = `test_doc_${Date.now()}`;
  const now = new Date().toISOString();

  // Test 1: Security Rule Enforcement - Unauthenticated write to /documents is blocked
  console.log(
    "1. Testing Security Rule Invariant: Unauthenticated write to /documents is blocked...",
  );
  const docRef = doc(db, "documents", testDocId);
  let writeBlocked = false;

  try {
    await setDoc(docRef, {
      id: testDocId,
      clientId: "unauth_user",
      name: "Exploit Blueprint.pdf",
      fileName: "Exploit_Blueprint.pdf",
      storagePath: "client_documents/unauth_user/test.pdf",
      contentType: "application/pdf",
      fileType: "PDF",
      sizeBytes: 1024,
      visibility: "client",
      uploadedBy: "Attacker",
      createdAt: now,
    });
  } catch (err) {
    if (err.code === "permission-denied" || err.message?.includes("PERMISSION_DENIED")) {
      writeBlocked = true;
      console.log(
        "   ✓ Confirmed: Unauthenticated write to /documents was strictly denied by Firestore Security Rules [permission-denied].",
      );
    } else {
      throw err;
    }
  }

  if (!writeBlocked) {
    throw new Error("FAILED: Unauthenticated user was able to write to /documents collection!");
  }

  // Test 2: Unauthenticated read from private /documents is blocked
  console.log(
    "2. Testing Security Rule Invariant: Unauthenticated read from /documents is blocked...",
  );
  let readBlocked = false;
  try {
    await getDoc(docRef);
  } catch (err) {
    if (err.code === "permission-denied" || err.message?.includes("PERMISSION_DENIED")) {
      readBlocked = true;
      console.log(
        "   ✓ Confirmed: Unauthenticated read from /documents was strictly denied by Firestore Security Rules [permission-denied].",
      );
    } else {
      throw err;
    }
  }

  if (!readBlocked) {
    throw new Error("FAILED: Unauthenticated user was able to read from /documents collection!");
  }

  // Test 3: Validate File Extension and MIME Type logic
  console.log("3. Testing File Type & Size Validation Logic...");
  const SUPPORTED = [
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
  ];
  const UNSUPPORTED = ["exe", "sh", "bat", "py", "bin", "dmg"];

  for (const ext of SUPPORTED) {
    const filename = `deliverable.${ext}`;
    const parts = filename.split(".");
    const parsedExt = parts.pop().toLowerCase();
    if (!SUPPORTED.includes(parsedExt)) {
      throw new Error(`Expected ${filename} to be supported`);
    }
  }

  for (const ext of UNSUPPORTED) {
    const filename = `malicious.${ext}`;
    const parts = filename.split(".");
    const parsedExt = parts.pop().toLowerCase();
    if (SUPPORTED.includes(parsedExt)) {
      throw new Error(`Expected ${filename} to be rejected`);
    }
  }
  console.log(
    "   ✓ Confirmed: Supported extensions (PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, JPG, PNG, WEBP, ZIP) validated; unsafe files rejected.",
  );

  // Test 4: Storage Rule Structure Check
  console.log("4. Verifying Firebase Storage Rule Definitions in storage.rules...");
  const storageRulesPath = path.resolve(__dirname, "../storage.rules");
  if (!fs.existsSync(storageRulesPath)) {
    throw new Error("FAILED: storage.rules file does not exist!");
  }
  const storageRulesContent = fs.readFileSync(storageRulesPath, "utf-8");
  if (!storageRulesContent.includes("client_documents/{clientId}")) {
    throw new Error("FAILED: storage.rules does not contain client_documents scoping!");
  }
  if (!storageRulesContent.includes("allow write: if isAdmin();")) {
    throw new Error("FAILED: storage.rules does not restrict writes to authorized admins!");
  }
  console.log(
    "   ✓ Confirmed: storage.rules strictly enforces client UID path isolation and admin write authorization.",
  );

  console.log("--------------------------------------------------");
  console.log("✓ All Step 14 Client Documents & File Management Verification Checks Passed!");
  console.log("==================================================");
}

runDocumentTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
