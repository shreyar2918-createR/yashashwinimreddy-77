import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import fs from "fs";

const config = JSON.parse(fs.readFileSync("firebase-applet-config.json", "utf8"));
const app = !getApps().length ? initializeApp(config) : getApps()[0];
const db = getFirestore(app);

async function check() {
  try {
    const snap = await getDoc(doc(db, "test", "connection"));
    console.log("Read test/connection SUCCESS. exists:", snap.exists());
    if (snap.exists()) console.log("Data:", snap.data());
  } catch (err) {
    console.log("Read test/connection ERROR:", err.code, err.message);
  }
  process.exit(0);
}

check();
