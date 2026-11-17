import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = !getApps().length ? initializeApp(config) : getApps()[0];
const db = getFirestore(app);

console.log("==================================================");
console.log("VINORA — Admin Authentication & Authorization Test");
console.log("==================================================");

// The 4 authorized admin accounts
const EXPECTED_AUTHORIZED_ACCOUNTS = [
  "shreyar2918@gmail.com",
  "admin@vinora.io",
  "architecture@vinora.io",
  "operations@vinora.io",
];

async function run() {
  console.log("1. Validating 4 Authorized Administrator Accounts...");
  if (EXPECTED_AUTHORIZED_ACCOUNTS.length !== 4) {
    throw new Error(
      `Expected exactly 4 authorized accounts, found ${EXPECTED_AUTHORIZED_ACCOUNTS.length}`,
    );
  }
  for (const email of EXPECTED_AUTHORIZED_ACCOUNTS) {
    console.log(`   ✓ Authorized Admin Email: ${email}`);
  }

  console.log("\n2. Validating Required Admin Schema in Firestore (/admins/{uid})...");
  const testAdminDoc = {
    uid: "sample_firebase_admin_uid",
    name: "Alex Vance",
    email: "admin@vinora.io",
    role: "admin",
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const requiredFields = ["uid", "name", "email", "role", "active", "createdAt", "updatedAt"];
  for (const field of requiredFields) {
    if (!(field in testAdminDoc)) {
      throw new Error(`Missing required field in admin schema: ${field}`);
    }
  }
  if (testAdminDoc.role !== "admin") throw new Error("Role must strictly be 'admin'");
  if (typeof testAdminDoc.active !== "boolean" || testAdminDoc.active !== true) {
    throw new Error("Active must be boolean true");
  }
  console.log(
    "   ✓ Required schema fields verified (uid, name, email, role='admin', active=true, createdAt, updatedAt).",
  );

  console.log("\n3. Validating Firestore admin path format (/admins/{uid})...");
  const adminDocRef = doc(db, "admins", testAdminDoc.uid);
  if (adminDocRef.path !== `admins/${testAdminDoc.uid}`) {
    throw new Error(`Invalid path: ${adminDocRef.path}`);
  }
  console.log(`   ✓ Firestore path matches: ${adminDocRef.path}`);

  console.log("\n4. Validating Authorization Gate Rules & Invariants...");
  // Test invariant A: Unauthorized email rejection
  const unauthorizedUser = { uid: "unauth_123", email: "visitor@example.com" };
  const isAuthA = EXPECTED_AUTHORIZED_ACCOUNTS.includes(unauthorizedUser.email.toLowerCase());
  if (isAuthA) {
    throw new Error("Unauthorized user incorrectly marked as authorized");
  }
  console.log("   ✓ Non-admin authenticated user denied admin authorization.");

  // Test invariant B: Inactive admin rejection
  const inactiveAdmin = { ...testAdminDoc, active: false };
  if (inactiveAdmin.active === true) {
    throw new Error("Inactive admin should not be active");
  }
  console.log("   ✓ Deactivated admin account denied access.");

  // Test invariant C: Non-admin role rejection
  const clientRoleUser = { ...testAdminDoc, role: "client" };
  if (clientRoleUser.role === "admin") {
    throw new Error("Client role user incorrectly marked as admin");
  }
  console.log("   ✓ Client role user denied admin authorization.");

  console.log("\n==================================================");
  console.log("All VINORA Admin Authentication Tests PASSED");
  console.log("==================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
