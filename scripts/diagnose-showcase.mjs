import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  collection,
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = !getApps().length ? initializeApp(config) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

async function diagnose() {
  console.log("Checking projectRequests...");
  // 1. Try getDoc on a specific ID as unauthenticated
  try {
    const docRef = doc(db, "projectRequests", "non_existent_id");
    const snap = await getDoc(docRef);
    console.log("Get unauthenticated result:", snap.exists());
  } catch (err) {
    console.log("Get unauthenticated error:", err.code, err.message);
  }

  // 2. Try query as unauthenticated
  try {
    const q = query(collection(db, "projectRequests"), where("showcaseApproved", "==", true));
    const snap = await getDocs(q);
    console.log("Query unauthenticated size:", snap.size);
  } catch (err) {
    console.log("Query unauthenticated error:", err.code, err.message);
  }
}

diagnose();
