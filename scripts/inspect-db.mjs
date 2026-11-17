import { initializeApp, getApps } from "firebase/app";
import { getFirestore, getDocs, collection, query, where } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = !getApps().length ? initializeApp(config) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

async function inspect() {
  const ts = Date.now();
  const cred = await createUserWithEmailAndPassword(auth, `test${ts}@test.com`, `Pass_${ts}!`);
  console.log("Logged in client:", cred.user.uid);

  // Client query own requests
  const qClient = query(collection(db, "projectRequests"), where("clientId", "==", cred.user.uid));
  const snapClient = await getDocs(qClient);
  console.log("Client own requests count:", snapClient.size);

  // Try showcase query with auth
  try {
    const qShowcase = query(
      collection(db, "projectRequests"),
      where("showcaseApproved", "==", true),
    );
    const snapShowcase = await getDocs(qShowcase);
    console.log("Showcase query with auth count:", snapShowcase.size);
  } catch (err) {
    console.log("Showcase query with auth error:", err.code, err.message);
  }
}

inspect().catch((err) => console.error("Error:", err));
