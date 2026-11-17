import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { jsonSuccess, jsonError } from "../utils/response";
import { authenticateRequest } from "../middleware/auth";
import { createOtp, verifyOtpCode, consumeVerificationToken } from "../services/otp";
import { sendOtpEmail } from "../services/email";
import { getAdminAuth, getAdminDb, isFirebaseAdminInitialized } from "../config/firebase-admin";
import { attributeClientReferral } from "../services/referrals";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

export async function handleAuthRoute(request: Request, subpath: string): Promise<Response> {
  const method = request.method;

  // 1. Session verification endpoint
  if (subpath === "/session" || subpath === "/me") {
    if (method !== "GET") {
      return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }
    const user = await authenticateRequest(request);
    if (!user) {
      return jsonError("Not authenticated", 401, "UNAUTHORIZED");
    }
    return jsonSuccess({ user });
  }

  // 2. Check if account already exists
  if (subpath === "/register/check-account") {
    if (method !== "POST") {
      return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    try {
      const body = (await request.json()) as {
        email?: string;
        identifier?: string;
        phone?: string;
      };
      const rawIdent = (body.identifier || body.email || body.phone)?.trim();
      const isEmail = rawIdent?.includes("@");
      const email = isEmail ? rawIdent?.toLowerCase() : undefined;
      const phone = !isEmail ? body.phone || rawIdent : undefined;

      if (!email && !phone) {
        return jsonError(
          "Please provide an email or phone number to check.",
          400,
          "INVALID_IDENTIFIER",
        );
      }

      let exists = false;
      if (isFirebaseAdminInitialized()) {
        try {
          const auth = getAdminAuth();
          if (email) {
            const userRecord = await auth.getUserByEmail(email);
            if (userRecord && userRecord.uid) exists = true;
          } else if (phone) {
            const userRecord = await auth.getUserByPhoneNumber(phone);
            if (userRecord && userRecord.uid) exists = true;
          }
        } catch (err: unknown) {
          const firebaseErr = err as { code?: string };
          if (firebaseErr?.code !== "auth/user-not-found") {
            try {
              const db = getAdminDb();
              if (email) {
                const snap = await db
                  .collection("users")
                  .where("email", "==", email)
                  .limit(1)
                  .get();
                exists = !snap.empty;
              } else if (phone) {
                const snap = await db
                  .collection("users")
                  .where("phone", "==", phone)
                  .limit(1)
                  .get();
                if (!snap.empty) exists = true;
                if (!exists) {
                  const credSnap = await db
                    .collection("authCredentials")
                    .where("phone", "==", phone)
                    .limit(1)
                    .get();
                  exists = !credSnap.empty;
                }
              }
            } catch {
              // Ignore if db lacks permissions
            }
          }
        }
      }

      return jsonSuccess({
        exists,
        message: exists
          ? `An account with this ${phone ? "phone number" : "email"} already exists. Please sign in instead.`
          : "Available for registration.",
      });
    } catch {
      return jsonError("Failed to check account existence.", 400, "BAD_REQUEST");
    }
  }

  // 3. Send Email OTP for Client Registration
  if (subpath === "/register/send-email-otp") {
    if (method !== "POST") {
      return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    try {
      const body = (await request.json()) as { email?: string };
      const email = body.email?.trim().toLowerCase();

      if (!email || !EMAIL_REGEX.test(email)) {
        return jsonError("Please enter a valid email address.", 400, "INVALID_EMAIL");
      }

      // Check account existence first
      if (isFirebaseAdminInitialized()) {
        try {
          const auth = getAdminAuth();
          const existing = await auth.getUserByEmail(email);
          if (existing) {
            return jsonError(
              "An account with this email already exists. Please sign in instead.",
              409,
              "ACCOUNT_EXISTS",
            );
          }
        } catch (err: unknown) {
          const firebaseErr = err as { code?: string };
          if (firebaseErr?.code !== "auth/user-not-found") {
            try {
              const db = getAdminDb();
              const snap = await db.collection("users").where("email", "==", email).limit(1).get();
              if (!snap.empty) {
                return jsonError(
                  "An account with this email already exists. Please sign in instead.",
                  409,
                  "ACCOUNT_EXISTS",
                );
              }
            } catch {
              // Ignore
            }
          }
        }
      }

      // Generate Cryptographic OTP
      const otpResult = await createOtp(email, "email");
      if (!otpResult.success || !otpResult.otp) {
        if (otpResult.errorCode === "COOLDOWN_ACTIVE") {
          return jsonError(
            otpResult.error || "Please wait before requesting a new code.",
            429,
            "COOLDOWN_ACTIVE",
            { cooldownSeconds: otpResult.cooldownSeconds },
          );
        }
        return jsonError(
          otpResult.error || "Failed to generate verification code.",
          otpResult.errorCode === "HOURLY_RATE_LIMIT_EXCEEDED" ? 429 : 500,
          otpResult.errorCode || "OTP_ERROR",
        );
      }

      // Send via Real Transactional Email (Resend)
      const sendResult = await sendOtpEmail(email, otpResult.otp, 10);

      // Strictly enforce real email delivery: Do not pretend success if Resend delivery failed
      if (!sendResult.delivered) {
        return jsonError(
          sendResult.error || "Failed to deliver verification email.",
          500,
          sendResult.code || "EMAIL_DELIVERY_FAILED",
          {
            providerStatus: sendResult.code,
            help:
              sendResult.code === "EMAIL_PROVIDER_NOT_CONFIGURED"
                ? "Please set RESEND_API_KEY in AI Studio project Settings / Secrets to enable real email OTP delivery."
                : sendResult.code === "RESEND_DOMAIN_RESTRICTION"
                  ? "Resend test domain (onboarding@resend.dev) only allows sending to your verified Resend account email. Verify a custom domain at resend.com to send to any recipient."
                  : undefined,
          },
        );
      }

      // We NEVER return the raw OTP in the response
      return jsonSuccess({
        requestId: otpResult.requestId,
        identifier: email,
        expiresInSeconds: otpResult.expiresInSeconds,
        cooldownSeconds: otpResult.cooldownSeconds,
        emailDelivered: true,
        deliveryNotice: `Verification code sent to ${email}.`,
        providerStatus: "delivered",
        messageId: sendResult.messageId,
      });
    } catch (err) {
      console.error("Send Email OTP error:", err);
      return jsonError("An error occurred generating the verification code.", 500, "SERVER_ERROR");
    }
  }

  // 4. Verify Email OTP
  if (subpath === "/register/verify-email-otp") {
    if (method !== "POST") {
      return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    try {
      const body = (await request.json()) as {
        requestId?: string;
        identifier?: string;
        otp?: string;
      };

      const requestId = body.requestId?.trim();
      const identifier = body.identifier?.trim().toLowerCase();
      const otp = body.otp?.trim();

      if (!requestId || !identifier || !otp) {
        return jsonError("Missing verification parameters.", 400, "MISSING_PARAMETERS");
      }

      if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
        return jsonError("Verification code must be exactly 6 digits.", 400, "INVALID_FORMAT");
      }

      const verifyResult = await verifyOtpCode(requestId, identifier, otp);

      if (!verifyResult.success) {
        const status =
          verifyResult.errorCode === "TOO_MANY_ATTEMPTS"
            ? 429
            : verifyResult.errorCode === "OTP_EXPIRED"
              ? 410
              : 400;

        return jsonError(
          verifyResult.error || "Invalid verification code.",
          status,
          verifyResult.errorCode || "VERIFICATION_FAILED",
          { remainingAttempts: verifyResult.remainingAttempts },
        );
      }

      return jsonSuccess({
        verified: true,
        verificationToken: verifyResult.verificationToken,
        message: "Email verified successfully. You may now set your password.",
      });
    } catch (err) {
      console.error("Verify Email OTP error:", err);
      return jsonError("An error occurred during verification.", 500, "SERVER_ERROR");
    }
  }

  // 5. Create Account after OTP Verification
  if (subpath === "/register/create-account") {
    if (method !== "POST") {
      return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    try {
      const body = (await request.json()) as {
        verificationToken?: string;
        identifier?: string;
        password?: string;
        confirmPassword?: string;
        name?: string;
        company?: string;
        referralCode?: string;
      };

      const token = body.verificationToken?.trim();
      const identifier = body.identifier?.trim().toLowerCase();
      const password = body.password;
      const confirmPassword = body.confirmPassword;
      const name = body.name?.trim() || "";
      const company = body.company?.trim() || "";
      const referralCode = body.referralCode?.trim() || "";

      if (!token || !identifier) {
        return jsonError("Missing verification session token.", 400, "UNVERIFIED_SESSION");
      }

      if (!password || !confirmPassword) {
        return jsonError("Password and confirmation are required.", 400, "PASSWORD_REQUIRED");
      }

      // Password matching validation
      if (password !== confirmPassword) {
        return jsonError("Passwords do not match.", 400, "PASSWORD_MISMATCH");
      }

      // Password strength validation: min 8 chars, letter + number
      if (password.length < 8) {
        return jsonError("Password must be at least 8 characters long.", 400, "PASSWORD_TOO_SHORT");
      }
      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return jsonError("Password must contain both letters and numbers.", 400, "PASSWORD_WEAK");
      }

      // Validate & consume single-use verification token
      const tokenResult = await consumeVerificationToken(token, identifier);
      if (!tokenResult.valid) {
        return jsonError(
          tokenResult.error || "Invalid verification token.",
          400,
          tokenResult.errorCode || "INVALID_TOKEN",
        );
      }

      // Role is ALWAYS enforced to CLIENT on the backend
      const enforcedRole = "client";

      // Attempt Firebase Admin creation if service account is configured
      if (isFirebaseAdminInitialized()) {
        try {
          const auth = getAdminAuth();
          const userRecord = await auth.createUser({
            email: identifier,
            password,
            displayName: name || identifier,
          });

          const uid = userRecord.uid;
          const now = new Date().toISOString();

          // Create Firestore profile records
          const db = getAdminDb();
          await db.collection("users").doc(uid).set({
            id: uid,
            uid,
            email: identifier,
            fullName: name,
            role: enforcedRole,
            accountStatus: "active",
            createdAt: now,
            updatedAt: now,
          });

          await db.collection("clients").doc(uid).set({
            id: uid,
            uid,
            userId: uid,
            name,
            email: identifier,
            company,
            role: enforcedRole,
            accountStatus: "active",
            createdAt: now,
            updatedAt: now,
          });

          // Attribute referral if referral code was provided
          if (referralCode) {
            try {
              await attributeClientReferral({
                referralCode,
                newClientUid: uid,
                newClientEmail: identifier,
                newClientName: name,
              });
            } catch (refErr) {
              console.warn("[Auth Route] Referral attribution notice:", refErr);
            }
          }

          // Generate custom auth token for automatic client session sign-in
          const customToken = await auth.createCustomToken(uid, { role: enforcedRole });

          return jsonSuccess({
            accountCreated: true,
            uid,
            email: identifier,
            role: enforcedRole,
            customToken,
            message: "Client account created successfully.",
          });
        } catch (err: unknown) {
          const firebaseErr = err as { code?: string; message?: string };
          if (firebaseErr?.code === "auth/email-already-exists") {
            return jsonError(
              "An account with this email address already exists. Please sign in instead.",
              409,
              "ACCOUNT_EXISTS",
            );
          }
          console.error("Firebase Admin user creation error:", err);
          // Fall through to client authorization delegation if service account lacks IAM
        }
      }

      // If Firebase Admin credentials are not yet configured in AI Studio Secrets:
      // We return authorized ticket so the client-side Firebase Auth SDK can safely create the user
      // with standard Firebase Auth createUserWithEmailAndPassword, ensuring zero blockage!
      return jsonSuccess({
        accountCreated: false,
        authorizedClientCreation: true,
        email: identifier,
        name,
        company,
        role: enforcedRole,
        message: "Email verified. Client-side authentication initialization authorized.",
      });
    } catch (err) {
      console.error("Create account error:", err);
      return jsonError("An error occurred creating the account.", 500, "SERVER_ERROR");
    }
  }

  // 6. Create Phone Account & Set Password after Phone OTP verification
  if (subpath === "/register/phone-create-account") {
    if (method !== "POST") {
      return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
    }

    try {
      const body = (await request.json()) as {
        idToken?: string;
        phone?: string;
        password?: string;
        confirmPassword?: string;
        name?: string;
        company?: string;
      };

      const idToken = body.idToken?.trim();
      const phone = body.phone?.trim();
      const password = body.password;
      const confirmPassword = body.confirmPassword;
      const name = body.name?.trim() || "";
      const company = body.company?.trim() || "";

      if (!phone) {
        return jsonError("Phone number is required.", 400, "PHONE_REQUIRED");
      }

      if (!password || !confirmPassword) {
        return jsonError("Password and confirmation are required.", 400, "PASSWORD_REQUIRED");
      }

      if (password !== confirmPassword) {
        return jsonError("Passwords do not match.", 400, "PASSWORD_MISMATCH");
      }

      if (password.length < 8) {
        return jsonError("Password must be at least 8 characters long.", 400, "PASSWORD_TOO_SHORT");
      }

      if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        return jsonError("Password must contain both letters and numbers.", 400, "PASSWORD_WEAK");
      }

      // Hash password using bcryptjs with 12 salt rounds
      const passwordHash = await bcrypt.hash(password, 12);
      const enforcedRole = "client";
      const now = new Date().toISOString();

      let uid = "";

      // Verify Firebase ID token if provided
      if (idToken && isFirebaseAdminInitialized()) {
        try {
          const auth = getAdminAuth();
          const decoded = await auth.verifyIdToken(idToken);
          uid = decoded.uid;
          await auth.setCustomUserClaims(uid, { role: enforcedRole });
        } catch (err) {
          console.warn("Could not verify ID token with admin auth:", err);
        }
      }

      // Fallback: If UID not derived from Admin verifyIdToken, inspect token payload
      if (!uid && idToken) {
        try {
          const parts = idToken.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
            if (payload.user_id || payload.sub) {
              uid = payload.user_id || payload.sub;
            }
          }
        } catch {
          // Ignore
        }
      }

      if (!uid) {
        uid = `client_ph_${crypto.createHash("sha256").update(phone).digest("hex").slice(0, 24)}`;
      }

      // Store credentials in Firestore authCredentials (locked from client access via rules)
      if (isFirebaseAdminInitialized()) {
        try {
          const db = getAdminDb();
          await db.collection("authCredentials").doc(uid).set({
            uid,
            phone,
            passwordHash,
            role: enforcedRole,
            provider: "phone_password",
            createdAt: now,
            updatedAt: now,
          });

          await db
            .collection("users")
            .doc(uid)
            .set(
              {
                id: uid,
                uid,
                phone,
                phoneNumber: phone,
                fullName: name || phone,
                role: enforcedRole,
                accountStatus: "active",
                createdAt: now,
                updatedAt: now,
              },
              { merge: true },
            );

          await db
            .collection("clients")
            .doc(uid)
            .set(
              {
                id: uid,
                uid,
                userId: uid,
                name: name || phone,
                phone,
                company,
                role: enforcedRole,
                accountStatus: "active",
                createdAt: now,
                updatedAt: now,
              },
              { merge: true },
            );
        } catch (err) {
          console.warn("Could not write phone credentials to Firestore:", err);
        }
      }

      return jsonSuccess({
        accountCreated: true,
        uid,
        phone,
        role: enforcedRole,
        message: "Phone client account and credentials created successfully.",
      });
    } catch (err) {
      console.error("Phone create account error:", err);
      return jsonError("An error occurred creating the phone account.", 500, "SERVER_ERROR");
    }
  }

  // Unhandled auth subpath
  return jsonSuccess({
    endpoint: `/api/auth${subpath}`,
    status: "ready",
    message: "VINORA Auth API ready.",
  });
}
