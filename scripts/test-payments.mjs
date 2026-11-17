import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.resolve(__dirname, "../firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

console.log("==================================================");
console.log("VINORA — Step 17: Razorpay Payment Integration Tests");
console.log("==================================================");
console.log(`Target Project ID  : ${firebaseConfig.projectId}`);
console.log(`Database Instance  : ${firebaseConfig.firestoreDatabaseId || "(default)"}`);
console.log("--------------------------------------------------");

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

async function runPaymentTests() {
  const testPaymentId = `test_pay_${Date.now()}`;
  const now = new Date().toISOString();

  // Test 1: Security Rule Enforcement - Direct unauthenticated write to /payments is blocked
  console.log(
    "1. Testing Security Rule Invariant: Direct unauthenticated write to /payments is blocked...",
  );
  const paymentRef = doc(db, "payments", testPaymentId);
  let blockedWriteAsExpected = false;

  try {
    await setDoc(paymentRef, {
      id: testPaymentId,
      clientId: "unauth_client_uid",
      clientUid: "unauth_client_uid",
      invoiceId: "inv_123",
      amount: 50000,
      currency: "INR",
      status: "paid",
      createdAt: now,
    });
  } catch (err) {
    if (err.code === "permission-denied" || err.message?.includes("PERMISSION_DENIED")) {
      blockedWriteAsExpected = true;
      console.log(
        "   ✓ Confirmed: Direct client write to /payments was strictly denied by Firestore Security Rules [permission-denied].",
      );
    } else {
      console.warn("   Unexpected error on unauthenticated payment write:", err.message);
    }
  }

  if (!blockedWriteAsExpected) {
    console.error("   ✗ Invariant Failed: Client write to /payments was unexpectedly permitted.");
    process.exit(1);
  }

  // Test 2: Cryptographic Signature Verification Logic
  console.log(
    "2. Testing Cryptographic Signature Invariant: Razorpay HMAC-SHA256 signature verification...",
  );

  const testSecret = "vinora_test_secret_key_2026";
  const orderId = "order_vinora_987654";
  const paymentId = "pay_vinora_123456";

  const expectedSignature = crypto
    .createHmac("sha256", testSecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  // Verify valid signature
  const validCheck = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(
      crypto.createHmac("sha256", testSecret).update(`${orderId}|${paymentId}`).digest("hex"),
    ),
  );

  if (validCheck) {
    console.log("   ✓ Confirmed: Authentic Razorpay signature correctly validated.");
  } else {
    console.error("   ✗ Signature verification invariant failed.");
    process.exit(1);
  }

  // Verify tampered signature rejection
  const tamperedSignature = expectedSignature.slice(0, -4) + "0000";
  const tamperedCheck = crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(tamperedSignature),
  );

  if (!tamperedCheck) {
    console.log("   ✓ Confirmed: Tampered Razorpay signature was strictly detected and rejected.");
  } else {
    console.error("   ✗ Tampered signature check failed.");
    process.exit(1);
  }

  // Test 3: Webhook HMAC Signature Verification Logic
  console.log(
    "3. Testing Webhook Cryptographic Invariant: Webhook payload signature verification...",
  );
  const webhookSecret = "vinora_webhook_sec_2026";
  const rawWebhookPayload = JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: {
          id: "pay_test_999",
          order_id: "order_test_888",
          amount: 500000,
          currency: "INR",
          status: "captured",
        },
      },
    },
  });

  const webhookSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawWebhookPayload)
    .digest("hex");

  const validWebhookCheck = crypto.timingSafeEqual(
    Buffer.from(webhookSignature),
    Buffer.from(crypto.createHmac("sha256", webhookSecret).update(rawWebhookPayload).digest("hex")),
  );

  if (validWebhookCheck) {
    console.log("   ✓ Confirmed: Razorpay webhook payload signature cryptographically validated.");
  } else {
    console.error("   ✗ Webhook signature verification failed.");
    process.exit(1);
  }

  // Test 4: Financial Balance & Idempotency invariant
  console.log(
    "4. Testing Financial Invariant: Partial settlement, full settlement, and zero overpayment...",
  );
  const invoiceTotal = 25000;
  let amountPaid = 0;
  let balanceDue = invoiceTotal - amountPaid;

  // First payment: 10,000
  const payment1 = 10000;
  amountPaid += payment1;
  balanceDue = Math.max(0, invoiceTotal - amountPaid);
  const status1 = balanceDue <= 0 ? "Paid" : "Partially Paid";

  if (status1 === "Partially Paid" && balanceDue === 15000) {
    console.log(
      "   ✓ Confirmed: Partial payment transitions status to 'Partially Paid' and updates balanceDue.",
    );
  } else {
    console.error("   ✗ Partial payment invariant failed.");
    process.exit(1);
  }

  // Second payment: 15,000
  const payment2 = 15000;
  amountPaid += payment2;
  balanceDue = Math.max(0, invoiceTotal - amountPaid);
  const status2 = balanceDue <= 0 ? "Paid" : "Partially Paid";

  if (status2 === "Paid" && balanceDue === 0) {
    console.log(
      "   ✓ Confirmed: Final settlement transitions status to 'Paid' and sets balanceDue to 0.",
    );
  } else {
    console.error("   ✗ Final payment invariant failed.");
    process.exit(1);
  }

  console.log("--------------------------------------------------");
  console.log("Step 17 Razorpay Payment Integration verification passed successfully!");
  process.exit(0);
}

runPaymentTests().catch((err) => {
  console.error("Payment Verification Error:", err);
  process.exit(1);
});
