import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = !getApps().length ? initializeApp(config) : getApps()[0];
const db = getFirestore(app);

async function check() {
  console.log("1. Querying projectRequests where showcaseApproved == true as unauthenticated...");
  try {
    const q = query(collection(db, "projectRequests"), where("showcaseApproved", "==", true));
    const snap = await getDocs(q);
    console.log("Success! size:", snap.size);
    snap.forEach((d) => console.log("Doc:", d.id, d.data().name, d.data().showcaseApproved));
  } catch (err) {
    console.log("Query Error:", err.code, err.message);
  }

  console.log("\n2. Querying projects where showcaseApproved == true as unauthenticated...");
  try {
    const q2 = query(collection(db, "projects"), where("showcaseApproved", "==", true));
    const snap2 = await getDocs(q2);
    console.log("Success projects! size:", snap2.size);
    snap2.forEach((d) => console.log("Doc:", d.id, d.data().title, d.data().showcaseApproved));
  } catch (err) {
    console.log("Projects Query Error:", err.code, err.message);
  }

  process.exit(0);
}

check();
