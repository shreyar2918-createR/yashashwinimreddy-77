import {
  signInWithCustomToken,
  createUserWithEmailAndPassword,
  updateProfile,
  updatePassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  EmailAuthProvider,
  linkWithCredential,
  reauthenticateWithCredential,
  deleteUser,
  type ConfirmationResult,
  type User as FirebaseUser,
} from "firebase/auth";
import { doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "@/lib/firebase";
import type { UserProfile, UserRole } from "@/lib/types";

export const ADMIN_ROLES: UserRole[] = ["super_admin", "admin", "project_manager", "content_admin"];

let cachedProfile: UserProfile | null = null;
let profileListeners: Array<(profile: UserProfile | null) => void> = [];

function notifyListeners(profile: UserProfile | null) {
  cachedProfile = profile;
  for (const listener of profileListeners) {
    try {
      listener(profile);
    } catch (err) {
      console.error("Auth state listener error:", err);
    }
  }
}

// Subscribe to Firebase Auth state
if (typeof window !== "undefined") {
  onAuthStateChanged(auth, async (user: FirebaseUser | null) => {
    if (!user) {
      notifyListeners(null);
      return;
    }

    try {
      // Attempt to load Firestore user profile
      const userDocRef = doc(db, "users", user.uid);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const data = snap.data();
        const profile: UserProfile = {
          id: user.uid,
          email: user.email || data.email || "",
          fullName: data.fullName || data.name || user.displayName || "Client",
          role: (data.role as UserRole) || "client",
          avatarUrl: user.photoURL || undefined,
          createdAt: data.createdAt || new Date().toISOString(),
        };
        notifyListeners(profile);
      } else {
        // Construct standard client profile
        const profile: UserProfile = {
          id: user.uid,
          email: user.email || "",
          fullName: user.displayName || "Client",
          role: "client",
          avatarUrl: user.photoURL || undefined,
          createdAt: new Date().toISOString(),
        };
        notifyListeners(profile);
      }
    } catch {
      // Fallback to basic auth data
      const profile: UserProfile = {
        id: user.uid,
        email: user.email || "",
        fullName: user.displayName || "Client",
        role: "client",
        createdAt: new Date().toISOString(),
      };
      notifyListeners(profile);
    }
  });
}

export function subscribeToAuth(callback: (profile: UserProfile | null) => void): () => void {
  profileListeners.push(callback);
  callback(cachedProfile);
  return () => {
    profileListeners = profileListeners.filter((cb) => cb !== callback);
  };
}

export async function getCurrentProfile(): Promise<UserProfile | null> {
  return cachedProfile;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("vinora_verified_email");
      sessionStorage.removeItem("vinora_verification_token");
      sessionStorage.removeItem("vinora_registered_email");
      sessionStorage.removeItem("vinora_client_session");
      localStorage.removeItem("vinora_auth_token");
    } catch {
      // Ignore
    }
  }
  cachedProfile = null;
  notifyListeners(null);
}

// -------------------------------------------------------------
// Safe JSON API Fetch Helper
// -------------------------------------------------------------

interface ApiSuccessPayload<T> {
  success: true;
  data: T;
  meta?: { timestamp?: string };
}

interface ApiErrorPayload {
  success: false;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
  meta?: { timestamp?: string };
}

type ApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; code: string; details?: Record<string, unknown>; status: number };

async function safeApiPost<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Network request failed. Please check your internet connection.",
      code: "NETWORK_ERROR",
      status: 0,
    };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const rawText = await res.text().catch(() => "");
    let friendlyMessage = "Server returned an unexpected response format.";
    if (
      res.status === 502 ||
      res.status === 503 ||
      res.status === 504 ||
      rawText.includes("<!doctype")
    ) {
      friendlyMessage =
        "The authentication service is temporarily unavailable or warming up. Please retry in a few moments.";
    } else if (res.status === 404) {
      friendlyMessage = "Requested authentication endpoint was not found.";
    } else if (res.status >= 500) {
      friendlyMessage = "Server error occurred while processing authentication. Please try again.";
    }

    return {
      ok: false,
      error: friendlyMessage,
      code: "NON_JSON_RESPONSE",
      status: res.status,
    };
  }

  let json: ApiSuccessPayload<T> | ApiErrorPayload;
  try {
    json = (await res.json()) as ApiSuccessPayload<T> | ApiErrorPayload;
  } catch {
    return {
      ok: false,
      error: "Unable to process server response. Please try again.",
      code: "INVALID_JSON",
      status: res.status,
    };
  }

  if (!res.ok || !json.success) {
    const errPayload = json as ApiErrorPayload;
    return {
      ok: false,
      error: errPayload.error?.message || `Server request failed (HTTP ${res.status}).`,
      code: errPayload.error?.code || "REQUEST_FAILED",
      details: errPayload.error?.details,
      status: res.status,
    };
  }

  return {
    ok: true,
    data: (json as ApiSuccessPayload<T>).data,
    status: res.status,
  };
}

// -------------------------------------------------------------
// Step 2: Email Registration Flow (OTP-verified)
// -------------------------------------------------------------

export interface SendEmailOtpResponse {
  success: boolean;
  requestId?: string;
  identifier?: string;
  expiresInSeconds?: number;
  cooldownSeconds?: number;
  emailDelivered?: boolean;
  deliveryNotice?: string;
  providerStatus?: string;
  error?: string;
  code?: string;
}

export async function sendRegistrationEmailOtp(email: string): Promise<SendEmailOtpResponse> {
  const result = await safeApiPost<{
    requestId: string;
    identifier: string;
    expiresInSeconds: number;
    cooldownSeconds: number;
    emailDelivered: boolean;
    deliveryNotice: string;
    providerStatus: string;
  }>("/api/auth/register/send-email-otp", { email });

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
      code: result.code,
      cooldownSeconds: result.details?.cooldownSeconds as number | undefined,
    };
  }

  return {
    success: true,
    requestId: result.data.requestId,
    identifier: result.data.identifier,
    expiresInSeconds: result.data.expiresInSeconds,
    cooldownSeconds: result.data.cooldownSeconds,
    emailDelivered: result.data.emailDelivered,
    deliveryNotice: result.data.deliveryNotice,
    providerStatus: result.data.providerStatus,
  };
}

export interface VerifyEmailOtpResponse {
  success: boolean;
  verificationToken?: string;
  remainingAttempts?: number;
  error?: string;
  code?: string;
}

export async function verifyRegistrationEmailOtp(
  requestId: string,
  email: string,
  otp: string,
): Promise<VerifyEmailOtpResponse> {
  const result = await safeApiPost<{
    verificationToken: string;
  }>("/api/auth/register/verify-email-otp", {
    requestId,
    identifier: email,
    otp,
  });

  if (!result.ok) {
    return {
      success: false,
      error: result.error,
      code: result.code,
      remainingAttempts: result.details?.remainingAttempts as number | undefined,
    };
  }

  return {
    success: true,
    verificationToken: result.data.verificationToken,
  };
}

export interface CreateClientAccountParams {
  verificationToken: string;
  email: string;
  password: string;
  confirmPassword: string;
  name: string;
  company?: string;
  referralCode?: string;
}

export async function createClientAccount(params: CreateClientAccountParams): Promise<UserProfile> {
  const cleanEmail = params.email.trim().toLowerCase();

  // Call server to consume/validate verification token, passwords and attribute referral
  const result = await safeApiPost<{
    accountCreated?: boolean;
    customToken?: string;
  }>("/api/auth/register/create-account", {
    verificationToken: params.verificationToken,
    identifier: cleanEmail,
    password: params.password,
    confirmPassword: params.confirmPassword,
    name: params.name?.trim() || "",
    company: params.company?.trim() || "",
    referralCode: params.referralCode?.trim() || "",
  });

  if (!result.ok) {
    throw new Error(result.error || "Verification session invalid. Please retry.");
  }

  const data = result.data;

  // Case A: Server Admin created/updated the user and returned customToken
  if (data.customToken) {
    const cred = await signInWithCustomToken(auth, data.customToken);
    const user = cred.user;
    const now = new Date().toISOString();
    const displayName = params.name?.trim() || user.displayName || cleanEmail;

    if (params.name) {
      try {
        await updateProfile(user, { displayName });
      } catch {
        // Non-blocking
      }
    }

    // Ensure Firestore profile exists (Requirement 4: only after authentication succeeds)
    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          id: user.uid,
          uid: user.uid,
          email: cleanEmail,
          fullName: displayName,
          role: "client",
          accountStatus: "active",
          updatedAt: now,
        },
        { merge: true },
      );
      await setDoc(
        doc(db, "clients", user.uid),
        {
          id: user.uid,
          uid: user.uid,
          userId: user.uid,
          name: displayName,
          email: cleanEmail,
          company: params.company?.trim() || "",
          role: "client",
          accountStatus: "active",
          updatedAt: now,
        },
        { merge: true },
      );
    } catch (err) {
      console.warn("Firestore profile sync notice:", err);
    }

    const profile: UserProfile = {
      id: user.uid,
      email: cleanEmail,
      fullName: displayName,
      role: "client",
      createdAt: now,
    };
    notifyListeners(profile);
    return profile;
  }

  // Case B: Client-side Firebase Auth creation authorized by verified server token
  let user: FirebaseUser;
  try {
    const cred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
    user = cred.user;
  } catch (err: unknown) {
    const fbErr = err as { code?: string; message?: string };

    // Handle duplicate accounts clearly & user-friendly without exposing Firebase internals
    if (fbErr?.code === "auth/email-already-in-use") {
      throw new Error("An account with this email address already exists. Please sign in instead.");
    } else if (fbErr?.code === "auth/operation-not-allowed") {
      throw new Error(
        "Email/Password authentication is not enabled yet in your Firebase project (vinora-fe3a3). Please open Firebase Console > Authentication > Sign-in method and enable 'Email/Password'.",
      );
    } else if (fbErr?.code === "auth/weak-password") {
      throw new Error(
        "Password must be at least 8 characters long and contain both letters and numbers.",
      );
    } else if (fbErr?.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address.");
    } else if (fbErr?.code === "auth/network-request-failed") {
      throw new Error("Network connection error. Please check your internet connection.");
    } else if (fbErr?.code === "auth/too-many-requests") {
      throw new Error("Too many attempts. Please wait a moment and try again.");
    } else {
      throw new Error("Failed to create authentication account. Please try again.");
    }
  }

  const uid = user.uid;
  const now = new Date().toISOString();
  const displayName = params.name?.trim() || user.displayName || cleanEmail;

  // Update auth display name
  if (params.name) {
    try {
      await updateProfile(user, { displayName });
    } catch {
      // Non-blocking
    }
  }

  // Create corresponding client profile in Firestore only after authentication succeeds
  try {
    await setDoc(
      doc(db, "users", uid),
      {
        id: uid,
        uid,
        email: cleanEmail,
        fullName: displayName,
        name: displayName,
        role: "client",
        accountStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    await setDoc(
      doc(db, "clients", uid),
      {
        id: uid,
        uid,
        userId: uid,
        name: displayName,
        fullName: displayName,
        companyName: params.company?.trim() || "",
        company: params.company?.trim() || "",
        contactEmail: cleanEmail,
        email: cleanEmail,
        role: "client",
        status: "active",
        accountStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    // Attribute referral if referral code was provided
    if (params.referralCode?.trim()) {
      try {
        const { attributeReferral } = await import("@/services/referralService");
        await attributeReferral({
          referralCode: params.referralCode.trim(),
          newClientUid: uid,
          newClientEmail: cleanEmail,
          newClientName: displayName,
        });
      } catch (refErr) {
        console.warn("Client fallback referral attribution notice:", refErr);
      }
    }
  } catch (err) {
    console.error("Firestore client profile creation failed:", err);
    throw new Error(
      "Account created, but client profile setup encountered an issue. Please sign in to verify your access.",
    );
  }

  // Ensure active client session
  if (!auth.currentUser) {
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, params.password);
    } catch {
      // Non-blocking
    }
  }

  const profile: UserProfile = {
    id: uid,
    email: cleanEmail,
    fullName: displayName,
    role: "client",
    createdAt: now,
  };

  cachedProfile = profile;
  notifyListeners(profile);
  return profile;
}

// -------------------------------------------------------------
// Step 2: Phone Authentication Flow (Firebase Phone Auth + reCAPTCHA)
// -------------------------------------------------------------

let recaptchaVerifierInstance: RecaptchaVerifier | null = null;

export function clearPhoneRecaptcha(): void {
  if (recaptchaVerifierInstance) {
    try {
      recaptchaVerifierInstance.clear();
    } catch {
      // Ignore
    }
    recaptchaVerifierInstance = null;
  }
}

export function setupPhoneRecaptcha(containerId: string): RecaptchaVerifier {
  if (typeof window === "undefined") {
    throw new Error("reCAPTCHA can only be initialized in the browser.");
  }

  // Clear previous instance to avoid container reuse errors
  clearPhoneRecaptcha();

  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = "";
  }

  recaptchaVerifierInstance = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
  });

  return recaptchaVerifierInstance;
}

export async function sendPhoneOtp(
  phoneNumber: string,
  verifier: RecaptchaVerifier,
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneNumber, verifier);
}

export async function verifyPhoneOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string,
): Promise<FirebaseUser> {
  const cred = await confirmationResult.confirm(otpCode);
  return cred.user;
}

/**
 * Links email and password credential to the verified Phone User,
 * saves client profile to Firestore with role: 'client',
 * and updates authenticated session.
 */
export async function linkEmailPasswordToPhoneAccount(params: {
  email: string;
  password: string;
  name?: string;
  company?: string;
}): Promise<UserProfile> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No verified phone session found. Please verify your phone number first.");
  }

  const cleanEmail = params.email.trim().toLowerCase();
  const credential = EmailAuthProvider.credential(cleanEmail, params.password);

  // Link Email & Password credential to the verified phone user
  try {
    await linkWithCredential(user, credential);
  } catch (err: unknown) {
    const fbErr = err as { code?: string; message?: string };
    if (fbErr?.code === "auth/email-already-in-use") {
      throw new Error(
        "This email address is already registered to another account. Please choose a different email or sign in with that account.",
      );
    } else if (fbErr?.code === "auth/provider-already-linked") {
      // Already linked, update password
      try {
        await updatePassword(user, params.password);
      } catch {
        // Continue
      }
    } else if (fbErr?.code === "auth/weak-password") {
      throw new Error(
        "Password must be at least 8 characters long and contain letters and numbers.",
      );
    } else {
      throw new Error(
        fbErr?.message || "Failed to link email and password to your verified phone account.",
      );
    }
  }

  const displayName = params.name?.trim() || user.displayName || "Client";
  if (params.name) {
    try {
      await updateProfile(user, { displayName });
    } catch {
      // Non-blocking
    }
  }

  const uid = user.uid;
  const phoneNumber = user.phoneNumber || "";
  const now = new Date().toISOString();

  // Save the client profile in Firestore and assign the CLIENT role
  try {
    await setDoc(
      doc(db, "users", uid),
      {
        id: uid,
        uid,
        phone: phoneNumber,
        email: cleanEmail,
        fullName: displayName,
        role: "client",
        accountStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    await setDoc(
      doc(db, "clients", uid),
      {
        id: uid,
        uid,
        userId: uid,
        name: displayName,
        email: cleanEmail,
        phone: phoneNumber,
        company: params.company?.trim() || "",
        role: "client",
        accountStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  } catch (err) {
    console.error("Firestore client profile sync error:", err);
    handleFirestoreError(err, OperationType.WRITE, `users/${uid}`);
  }

  const profile: UserProfile = {
    id: uid,
    email: cleanEmail,
    fullName: displayName,
    role: "client",
    createdAt: now,
  };

  notifyListeners(profile);
  return profile;
}

/**
 * Signs in a client with Phone OTP verification.
 * If returning client already has an email & profile, signs in directly.
 * If user needs email/password setup, signals needsProfileCompletion: true.
 */
export async function signInClientWithPhoneOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string,
): Promise<{ profile: UserProfile; needsProfileCompletion: boolean }> {
  const cred = await confirmationResult.confirm(otpCode);
  const user = cred.user;
  const uid = user.uid;

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data();
      const profile: UserProfile = {
        id: uid,
        email: user.email || data.email || "",
        fullName: data.fullName || data.name || user.displayName || "Client",
        role: (data.role as UserRole) || "client",
        avatarUrl: user.photoURL || undefined,
        createdAt: data.createdAt || new Date().toISOString(),
      };
      if (profile.email) {
        notifyListeners(profile);
        return { profile, needsProfileCompletion: false };
      }
    }
  } catch (err) {
    console.warn("Could not check client Firestore document:", err);
  }

  const profile: UserProfile = {
    id: uid,
    email: user.email || "",
    fullName: user.displayName || "Client",
    role: "client",
    createdAt: new Date().toISOString(),
  };
  return { profile, needsProfileCompletion: true };
}

export async function verifyPhoneOtpAndCreateAccount(
  confirmationResult: ConfirmationResult,
  otpCode: string,
  password: string,
  confirmPassword: string,
  name: string,
  company?: string,
  email?: string,
): Promise<UserProfile> {
  const cleanOtp = otpCode.trim();
  const cred = await confirmationResult.confirm(cleanOtp);
  const user = cred.user;

  if (email && email.includes("@")) {
    return linkEmailPasswordToPhoneAccount({
      email,
      password,
      name,
      company,
    });
  }

  // Fallback if no email provided
  const uid = user.uid;
  const phoneNumber = user.phoneNumber || "";
  const now = new Date().toISOString();
  const displayName = name?.trim() || user.displayName || phoneNumber || "Client";

  try {
    await setDoc(
      doc(db, "users", uid),
      {
        id: uid,
        uid,
        phone: phoneNumber,
        email: user.email || "",
        fullName: displayName,
        role: "client",
        accountStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    await setDoc(
      doc(db, "clients", uid),
      {
        id: uid,
        uid,
        userId: uid,
        name: displayName,
        phone: phoneNumber,
        company: company?.trim() || "",
        role: "client",
        accountStatus: "active",
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  } catch (err) {
    console.warn("Firestore phone profile sync notice:", err);
  }

  const profile: UserProfile = {
    id: uid,
    email: user.email || "",
    fullName: displayName,
    role: "client",
    createdAt: now,
  };

  notifyListeners(profile);
  return profile;
}

// -------------------------------------------------------------
// Account Login (Email & Password)
// -------------------------------------------------------------
export async function signInWithPassword(
  email: string,
  password: string,
  requiredRole: "client" | "admin" = "client",
): Promise<UserProfile> {
  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!cleanEmail) {
    throw new Error("Please enter your registered email address.");
  }
  if (!emailRegex.test(cleanEmail)) {
    throw new Error("Please enter a valid email address (e.g. alex@yourcompany.com).");
  }
  if (!password) {
    throw new Error("Please enter your password.");
  }

  let cred;
  try {
    cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  } catch (err: unknown) {
    const fbErr = err as { code?: string; message?: string };
    if (fbErr?.code === "auth/operation-not-allowed") {
      throw new Error(
        "Email/Password sign-in is not enabled yet in your Firebase project (vinora-fe3a3). Please visit Firebase Console > Authentication > Sign-in method and enable 'Email/Password'.",
      );
    }
    if (fbErr?.code === "auth/user-not-found") {
      throw new Error(
        "No account found with this email address. Please check your email or create a new client account.",
      );
    }
    if (fbErr?.code === "auth/invalid-credential" || fbErr?.code === "auth/wrong-password") {
      throw new Error("Incorrect email or password. Please verify your credentials and try again.");
    }
    if (fbErr?.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address.");
    }
    if (fbErr?.code === "auth/user-disabled") {
      throw new Error("This account has been disabled. Please contact VINORA support.");
    }
    if (fbErr?.code === "auth/too-many-requests") {
      throw new Error(
        "Access temporarily suspended due to repeated failed attempts. Please try again later or reset your password.",
      );
    }
    if (fbErr?.code === "auth/network-request-failed") {
      throw new Error(
        "Network connection error. Please check your internet connection and try again.",
      );
    }
    throw new Error("Unable to sign in. Please verify your credentials and try again.");
  }

  const user = cred.user;
  const uid = user.uid;

  let role: UserRole = "client";
  let fullName = user.displayName || "Client";
  let createdAt = new Date().toISOString();

  // Load client's existing profile from Firestore
  try {
    const userDocRef = doc(db, "users", uid);
    const snap = await getDoc(userDocRef);
    if (snap.exists()) {
      const data = snap.data();
      role = (data.role as UserRole) || role;
      fullName = data.fullName || data.name || user.displayName || fullName;
      if (data.createdAt) {
        createdAt = data.createdAt as string;
      }
    }

    const clientDocRef = doc(db, "clients", uid);
    const clientSnap = await getDoc(clientDocRef);
    if (clientSnap.exists()) {
      const clientData = clientSnap.data();
      if (!fullName || fullName === "Client") {
        fullName = clientData.name || clientData.fullName || fullName;
      }
      if (clientData.createdAt && !snap.exists()) {
        createdAt = clientData.createdAt as string;
      }
    }
  } catch (err) {
    console.warn("Firestore client profile loading notice:", err);
  }

  // Requirement: On successful login, verify that the authenticated user's role is "client"
  if (requiredRole === "client") {
    if (role !== "client" && ADMIN_ROLES.includes(role)) {
      await firebaseSignOut(auth);
      notifyListeners(null);
      throw new Error(
        "Access restricted: This account has administrative privileges. Please use the Admin Login portal.",
      );
    }
    if (role && role !== "client") {
      await firebaseSignOut(auth);
      notifyListeners(null);
      throw new Error("Access restricted: This account does not have client portal permissions.");
    }
  } else if (requiredRole === "admin") {
    const isAdminUser = ADMIN_ROLES.includes(role) || cleanEmail === "shreyar2918@gmail.com";

    if (!isAdminUser) {
      const adminSnap = await getDoc(doc(db, "admins", uid));
      if (!adminSnap.exists()) {
        await firebaseSignOut(auth);
        notifyListeners(null);
        throw new Error(
          "Access restricted: This account does not have administrative privileges for the VINORA console.",
        );
      }
      role = "admin";
    }
  }

  const profile: UserProfile = {
    id: uid,
    email: user.email || cleanEmail,
    fullName,
    role,
    createdAt,
  };

  notifyListeners(profile);
  return profile;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!cleanEmail) {
    throw new Error("Please enter your registered email address.");
  }
  if (!emailRegex.test(cleanEmail)) {
    throw new Error("Please enter a valid email address (e.g. alex@yourcompany.com).");
  }

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (err: unknown) {
    const fbErr = err as { code?: string; message?: string };
    if (fbErr?.code === "auth/user-not-found") {
      throw new Error(
        "No account found with this email address. Please check your email or register a client account.",
      );
    }
    if (fbErr?.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address.");
    }
    if (fbErr?.code === "auth/too-many-requests") {
      throw new Error(
        "Too many password reset requests. Please wait a few minutes before trying again.",
      );
    }
    if (fbErr?.code === "auth/network-request-failed") {
      throw new Error(
        "Network connection error. Please check your internet connection and try again.",
      );
    }
    if (fbErr?.code === "auth/operation-not-allowed") {
      throw new Error(
        "Password reset is not enabled yet in your Firebase project. Please enable Email/Password provider in the Firebase Console.",
      );
    }
    throw new Error("Unable to send password reset email at this time. Please try again later.");
  }
}

// -------------------------------------------------------------
// Step 4: Client Profile & Account Management
// -------------------------------------------------------------

export interface ClientDetailedData {
  uid: string;
  email: string;
  fullName: string;
  companyName: string;
  phone: string;
  role: string;
  accountStatus: string;
  createdAt: string;
  updatedAt?: string;
  billingAddress?: string;
}

/**
 * Loads the client profile using the currently authenticated Firebase user's UID.
 * Reads both users/{uid} and clients/{uid} from Firestore.
 */
export async function getClientDetailedProfile(uid?: string): Promise<ClientDetailedData | null> {
  const user = auth.currentUser;
  if (!user) return null;

  // Strict Client Isolation: A non-admin client cannot access another client's profile
  let targetUid = user.uid;
  if (uid && uid !== user.uid) {
    if (cachedProfile?.role === "admin") {
      targetUid = uid;
    } else {
      // Reject cross-client profile access attempts
      console.warn(
        "Unauthorized profile access attempt prevented: clients cannot access other client profiles.",
      );
      targetUid = user.uid;
    }
  }

  let email = user?.email || "";
  let fullName = user?.displayName || "";
  let companyName = "";
  let phone = user?.phoneNumber || "";
  let role = "client";
  let accountStatus = "active";
  let createdAt = new Date().toISOString();
  let updatedAt: string | undefined = undefined;
  let billingAddress = "";

  try {
    const userSnap = await getDoc(doc(db, "users", targetUid));
    if (userSnap.exists()) {
      const uData = userSnap.data();
      if (uData.email) email = uData.email;
      if (uData.fullName || uData.name) fullName = uData.fullName || uData.name;
      if (uData.phone || uData.phoneNumber) phone = uData.phone || uData.phoneNumber;
      if (uData.role) role = uData.role;
      if (uData.accountStatus) accountStatus = uData.accountStatus;
      if (uData.createdAt) createdAt = uData.createdAt;
      if (uData.updatedAt) updatedAt = uData.updatedAt;
    }

    const clientSnap = await getDoc(doc(db, "clients", targetUid));
    if (clientSnap.exists()) {
      const cData = clientSnap.data();
      if (!email && (cData.email || cData.contactEmail)) email = cData.email || cData.contactEmail;
      if (!fullName && (cData.name || cData.fullName)) fullName = cData.name || cData.fullName;
      if (cData.company || cData.companyName) companyName = cData.company || cData.companyName;
      if (!phone && cData.phone) phone = cData.phone;
      if (cData.billingAddress) billingAddress = cData.billingAddress;
      if (cData.status || cData.accountStatus) accountStatus = cData.status || cData.accountStatus;
      if (!createdAt && cData.createdAt) createdAt = cData.createdAt;
      if (cData.updatedAt) updatedAt = cData.updatedAt;
    }
  } catch (err) {
    console.warn("Could not fetch detailed client profile from Firestore:", err);
  }

  return {
    uid: targetUid,
    email,
    fullName: fullName || "Client",
    companyName,
    phone,
    role,
    accountStatus,
    createdAt,
    updatedAt,
    billingAddress,
  };
}

/**
 * Updates editable profile information (Full Name, Company, Phone) for the authenticated client.
 * Synchronizes users/{uid} and clients/{uid} in Firestore, and updates Firebase Auth displayName.
 */
export async function updateClientProfile(params: {
  fullName: string;
  companyName?: string;
  phone?: string;
}): Promise<UserProfile> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("You must be authenticated to update your profile.");
  }

  const cleanName = params.fullName.trim();
  if (!cleanName) {
    throw new Error("Full name is required.");
  }

  const cleanCompany = params.companyName?.trim() || "";
  const cleanPhone = params.phone?.trim() || "";
  const uid = user.uid;
  const now = new Date().toISOString();

  // 1. Update Firebase Auth displayName
  try {
    await updateProfile(user, { displayName: cleanName });
  } catch (err) {
    console.warn("Auth displayName update notice:", err);
  }

  // 2. Update users/{uid}
  try {
    await setDoc(
      doc(db, "users", uid),
      {
        fullName: cleanName,
        name: cleanName,
        ...(cleanPhone ? { phone: cleanPhone, phoneNumber: cleanPhone } : {}),
        updatedAt: now,
      },
      { merge: true },
    );
  } catch (err) {
    console.error("Failed to update users document:", err);
    throw new Error("Failed to save user profile changes. Please try again.");
  }

  // 3. Update clients/{uid}
  try {
    await setDoc(
      doc(db, "clients", uid),
      {
        name: cleanName,
        fullName: cleanName,
        companyName: cleanCompany,
        company: cleanCompany,
        phone: cleanPhone,
        updatedAt: now,
      },
      { merge: true },
    );
  } catch (err) {
    console.error("Failed to update clients document:", err);
    throw new Error("Failed to save client organization details. Please try again.");
  }

  // 4. Update cachedProfile and notify listeners
  const updatedProfile: UserProfile = {
    ...(cachedProfile || {
      id: uid,
      email: user.email || "",
      role: "client",
      createdAt: now,
    }),
    fullName: cleanName,
  };

  cachedProfile = updatedProfile;
  notifyListeners(updatedProfile);

  return updatedProfile;
}

/**
 * Changes client password using Firebase Authentication.
 * Handles re-authentication gracefully when current password is provided or required.
 * Never stores passwords in Firestore.
 */
export async function changeClientPassword(params: {
  currentPassword?: string;
  newPassword: string;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("Active authenticated session required to change password.");
  }

  const newPass = params.newPassword.trim();
  if (newPass.length < 8) {
    throw new Error("New password must be at least 8 characters long.");
  }
  if (!/[A-Za-z]/.test(newPass) || !/[0-9]/.test(newPass)) {
    throw new Error("New password must contain both letters and numbers.");
  }

  // If current password is provided, re-authenticate first to establish fresh credentials
  if (params.currentPassword) {
    try {
      const cred = EmailAuthProvider.credential(user.email, params.currentPassword);
      await reauthenticateWithCredential(user, cred);
    } catch (err: unknown) {
      const fbErr = err as { code?: string; message?: string };
      if (fbErr?.code === "auth/invalid-credential" || fbErr?.code === "auth/wrong-password") {
        throw new Error(
          "Current password is incorrect. Please verify your password and try again.",
        );
      }
      if (fbErr?.code === "auth/too-many-requests") {
        throw new Error("Too many failed attempts. Please wait a moment and try again.");
      }
      throw new Error("Current password verification failed. Please try again.");
    }
  }

  try {
    await updatePassword(user, newPass);
  } catch (err: unknown) {
    const fbErr = err as { code?: string; message?: string };
    if (fbErr?.code === "auth/requires-recent-login") {
      throw new Error(
        "REAUTH_REQUIRED: For security, please enter your current password to confirm your identity before updating your password.",
      );
    }
    if (fbErr?.code === "auth/weak-password") {
      throw new Error("Password must be at least 8 characters and include letters and numbers.");
    }
    throw new Error("Failed to update password. Please try again.");
  }
}

export interface DeleteAccountParams {
  password?: string;
  reason: string;
  details?: string;
}

/**
 * Permanently deletes the client's account:
 * 1. Re-authenticates if password provided
 * 2. Deletes users/{uid} document
 * 3. Deletes clients/{uid} document
 * 4. Deletes Firebase Authentication account
 * 5. Clears all client session data and signs out
 */
export async function deleteClientAccount(params: DeleteAccountParams): Promise<void> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No authenticated client session found.");
  }

  const uid = user.uid;
  const userEmail = user.email;

  // 1. Re-authenticate if password is provided
  if (params.password && userEmail) {
    try {
      const cred = EmailAuthProvider.credential(userEmail, params.password);
      await reauthenticateWithCredential(user, cred);
    } catch (err: unknown) {
      const fbErr = err as { code?: string; message?: string };
      if (fbErr?.code === "auth/invalid-credential" || fbErr?.code === "auth/wrong-password") {
        throw new Error("The password you entered is incorrect. Please check your password.");
      }
      if (fbErr?.code === "auth/too-many-requests") {
        throw new Error("Too many failed attempts. Please try again later.");
      }
      throw new Error("Identity verification failed. Please verify your current password.");
    }
  }

  // 2. Delete users/{uid} document in Firestore
  try {
    await deleteDoc(doc(db, "users", uid));
  } catch (err) {
    console.warn("Notice: users/{uid} document delete skipped or already removed:", err);
  }

  // 3. Delete clients/{uid} document in Firestore
  try {
    await deleteDoc(doc(db, "clients", uid));
  } catch (err) {
    console.warn("Notice: clients/{uid} document delete skipped or already removed:", err);
  }

  // 4. Delete the Firebase Authentication account
  try {
    await deleteUser(user);
  } catch (err: unknown) {
    const fbErr = err as { code?: string; message?: string };
    if (fbErr?.code === "auth/requires-recent-login") {
      throw new Error(
        "REAUTH_REQUIRED: Recent sign-in required. Please enter your current password to proceed with deletion.",
      );
    }
    throw new Error("Failed to delete authentication account. Please try again.");
  }

  // 5. Clear all client storage & session state
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("vinora_verified_email");
      sessionStorage.removeItem("vinora_verification_token");
      sessionStorage.removeItem("vinora_registered_email");
      sessionStorage.removeItem("vinora_client_session");
      localStorage.removeItem("vinora_auth_token");
    } catch {
      // Ignore
    }
  }

  cachedProfile = null;
  notifyListeners(null);
}
