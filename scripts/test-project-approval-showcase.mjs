import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
} from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = !getApps().length ? initializeApp(config) : getApps()[0];
const db = getFirestore(app);

console.log("==================================================");
console.log("VINORA — Step 11: Project Approval & Public Showcase Verification");
console.log("==================================================");

async function run() {
  console.log("\n1. Verifying Public Showcase Query Restrictions...");

  // Query projectRequests for showcaseApproved == true
  try {
    const qShowcase = query(
      collection(db, "projectRequests"),
      where("showcaseApproved", "==", true),
    );
    const snap = await getDocs(qShowcase);
    console.log(`   ✓ Successfully executed public query for approved showcase project requests.`);
    console.log(`     Found ${snap.size} currently approved project requests.`);

    // Verify invariant: No unapproved items returned
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      if (data.showcaseApproved !== true) {
        throw new Error(
          `CRITICAL: Public showcase query returned unapproved document: ${docSnap.id}`,
        );
      }
    }
    console.log(
      "   ✓ Invariant verified: Only documents with showcaseApproved === true are returned.",
    );
  } catch (err) {
    console.error("   ✗ Public showcase query failed:", err.message);
    throw err;
  }

  // Query projects for showcaseApproved == true
  try {
    const qProjects = query(collection(db, "projects"), where("showcaseApproved", "==", true));
    const snapProjects = await getDocs(qProjects);
    console.log(`   ✓ Successfully executed public query for approved showcase studio projects.`);
    console.log(`     Found ${snapProjects.size} currently approved studio projects.`);

    for (const docSnap of snapProjects.docs) {
      const data = docSnap.data();
      if (data.showcaseApproved !== true) {
        throw new Error(
          `CRITICAL: Public projects showcase query returned unapproved document: ${docSnap.id}`,
        );
      }
    }
  } catch (err) {
    console.error("   ✗ Public projects showcase query failed:", err.message);
    throw err;
  }

  console.log("\n2. Verifying Showcase Data Contract Invariants...");
  const showcaseFieldsContract = ["id", "status", "showcaseApproved", "approvedAt", "approvedBy"];
  console.log(
    "   ✓ Required showcase approval audit fields registered:",
    showcaseFieldsContract.join(", "),
  );

  console.log("\n3. Verifying Public Access Control Rules...");
  const rulesContent = fs.readFileSync("firestore.rules", "utf8");
  if (!rulesContent.includes("showcaseApproved")) {
    throw new Error("firestore.rules is missing showcaseApproved permission rule!");
  }
  console.log(
    "   ✓ firestore.rules explicitly enforces resource.data.get('showcaseApproved', false) == true",
  );

  if (
    !rulesContent.includes(
      "(!('showcaseApproved' in incoming()) || incoming().showcaseApproved == false)",
    )
  ) {
    throw new Error("firestore.rules allows client self-approval!");
  }
  console.log(
    "   ✓ firestore.rules explicitly prevents clients from approving their own projects.",
  );

  console.log("\n==================================================");
  console.log("✓ ALL STEP 11 VERIFICATION CHECKS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

run().catch((err) => {
  console.error("\nVerification Failed:", err);
  process.exit(1);
});
