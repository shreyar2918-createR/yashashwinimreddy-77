import { useState, useEffect, useRef, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Phone,
  RefreshCw,
  Mail,
  Lock,
} from "lucide-react";
import type { ConfirmationResult, RecaptchaVerifier } from "firebase/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  CountryCodeSelector,
  COUNTRIES,
  type CountryInfo,
} from "@/components/auth/CountryCodeSelector";
import {
  setupPhoneRecaptcha,
  clearPhoneRecaptcha,
  sendPhoneOtp,
  signInClientWithPhoneOtp,
  signInWithPassword,
  requestPasswordReset,
} from "@/services/auth";
import { firebaseConfig } from "@/lib/firebase";
import { cn } from "@/lib/utils";

interface ClientLoginCardProps {
  onSwitchToRegister: () => void;
}

export function ClientLoginCard({ onSwitchToRegister }: ClientLoginCardProps) {
  const navigate = useNavigate();

  // Login method toggle: "password" (Email & Password, active) or "phone" (Phone SMS OTP, paused)
  const [method, setMethod] = useState<"phone" | "password">("password");

  // Forgot password view state
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Phone OTP states
  const [phoneStep, setPhoneStep] = useState<1 | 2>(1);
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(COUNTRIES[0]!); // India (+91)
  const [phoneLocal, setPhoneLocal] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(600);

  // Email/Password states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Loading & error handling
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Cooldown timer
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("status") === "account_deleted") {
        setNoticeMessage(
          "Your VINORA client account and all associated profile records have been permanently deleted.",
        );
      }
    }
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Expiry countdown timer
  useEffect(() => {
    if (phoneStep !== 2 || expirySeconds <= 0) return;
    const timer = setInterval(() => {
      setExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [phoneStep, expirySeconds]);

  function formatTime(seconds: number) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  // -------------------------------------------------------------
  // PHONE OTP LOGIN: Send SMS
  // -------------------------------------------------------------
  async function handleSendPhoneOtp(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setNoticeMessage(null);

    const cleanDigits = phoneLocal.replace(/\D/g, "");
    if (!cleanDigits) {
      setErrorMessage("Please enter your registered mobile phone number.");
      return;
    }

    if (selectedCountry.validate && !selectedCountry.validate(cleanDigits)) {
      if (selectedCountry.code === "IN") {
        setErrorMessage("Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).");
      } else {
        setErrorMessage(`Please enter a valid mobile number for ${selectedCountry.name}.`);
      }
      return;
    } else if (
      cleanDigits.length < selectedCountry.minLength ||
      cleanDigits.length > selectedCountry.maxLength
    ) {
      setErrorMessage(
        `Phone number must be between ${selectedCountry.minLength} and ${selectedCountry.maxLength} digits.`,
      );
      return;
    }

    const fullE164 = `${selectedCountry.dialCode}${cleanDigits}`;
    setPhone(fullE164);

    setLoading(true);
    try {
      clearPhoneRecaptcha();
      recaptchaVerifierRef.current = setupPhoneRecaptcha("recaptcha-login-container");

      const confirmation = await sendPhoneOtp(fullE164, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setCooldown(60);
      setExpirySeconds(600);
      setNoticeMessage(`SMS verification code sent to ${fullE164}.`);
      setPhoneStep(2);
    } catch (err: unknown) {
      clearPhoneRecaptcha();
      recaptchaVerifierRef.current = null;
      const fbErr = err as { code?: string; message?: string };
      console.error("Firebase Phone OTP login error:", fbErr);

      if (fbErr?.code === "auth/operation-not-allowed") {
        setErrorMessage(
          `Firebase rejected the request with auth/operation-not-allowed for project "${firebaseConfig.projectId}". If your Firebase Console project has a different Project ID, the app configuration must be pointed to that project.`,
        );
      } else if (fbErr?.code === "auth/quota-exceeded") {
        setErrorMessage(
          "SMS quota exceeded for this Firebase project. Please try again later or sign in with your email and password.",
        );
      } else if (fbErr?.code === "auth/too-many-requests") {
        setErrorMessage("Too many SMS attempts. Please wait a few moments before trying again.");
      } else if (fbErr?.code === "auth/captcha-check-failed") {
        setErrorMessage("reCAPTCHA check failed. Please refresh the page and try again.");
      } else if (
        fbErr?.code === "auth/invalid-app-credential" ||
        fbErr?.code === "auth/unauthorized-domain"
      ) {
        setErrorMessage(
          `Firebase domain verification issue for "${typeof window !== "undefined" ? window.location.hostname : ""}". Please ensure the domain is added to Firebase Console > Authentication > Settings > Authorized domains for project "${firebaseConfig.projectId}".`,
        );
      } else {
        setErrorMessage(fbErr?.message || "Failed to send SMS code. Please check your number.");
      }
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // PHONE OTP LOGIN: Verify Code & Sign In
  // -------------------------------------------------------------
  async function handleVerifyPhoneOtp(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      setErrorMessage("Please enter the 6-digit SMS verification code.");
      return;
    }

    if (!confirmationResult) {
      setErrorMessage("SMS verification session expired. Please request a new code.");
      setPhoneStep(1);
      return;
    }

    setLoading(true);
    try {
      const result = await signInClientWithPhoneOtp(confirmationResult, cleanOtp);

      if (result.needsProfileCompletion) {
        // Switch to account completion flow
        onSwitchToRegister();
        return;
      }

      // Profile exists, open Client Portal or returned draft route
      const returnTo =
        typeof window !== "undefined" ? sessionStorage.getItem("vinora_auth_redirect") : null;
      if (returnTo) {
        sessionStorage.removeItem("vinora_auth_redirect");
        navigate({ to: returnTo });
      } else {
        navigate({ to: "/client" });
      }
    } catch (err: unknown) {
      const fbErr = err as { code?: string; message?: string };
      if (fbErr?.code === "auth/invalid-verification-code") {
        setErrorMessage("Incorrect verification code. Please check the SMS and try again.");
      } else if (fbErr?.code === "auth/code-expired") {
        setErrorMessage("SMS code has expired. Please request a new code.");
      } else {
        setErrorMessage(fbErr?.message || "Verification failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  // Resend SMS
  async function handleResendOtp() {
    if (cooldown > 0 || loading) return;
    setErrorMessage(null);
    setLoading(true);

    try {
      clearPhoneRecaptcha();
      recaptchaVerifierRef.current = setupPhoneRecaptcha("recaptcha-login-container");
      const confirmation = await sendPhoneOtp(phone, recaptchaVerifierRef.current);
      setConfirmationResult(confirmation);
      setCooldown(60);
      setExpirySeconds(600);
      setNoticeMessage(`New SMS verification code sent to ${phone}.`);
    } catch (err: unknown) {
      clearPhoneRecaptcha();
      recaptchaVerifierRef.current = null;
      const fbErr = err as { code?: string; message?: string };
      setErrorMessage(fbErr?.message || "Failed to resend SMS code.");
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // EMAIL & PASSWORD LOGIN
  // -------------------------------------------------------------
  async function handlePasswordLogin(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setNoticeMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address (e.g. alex@yourcompany.com).");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      await signInWithPassword(cleanEmail, password, "client");
      const returnTo =
        typeof window !== "undefined" ? sessionStorage.getItem("vinora_auth_redirect") : null;
      if (returnTo) {
        sessionStorage.removeItem("vinora_auth_redirect");
        navigate({ to: returnTo });
      } else {
        navigate({ to: "/client" });
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(
        error.message || "Unable to sign in. Please verify your credentials and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  // -------------------------------------------------------------
  // FORGOT PASSWORD (Firebase Auth Reset Email)
  // -------------------------------------------------------------
  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setResetSuccessMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanEmail) {
      setErrorMessage("Please enter your registered email address.");
      return;
    }
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address (e.g. alex@yourcompany.com).");
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(cleanEmail);
      setResetSuccessMessage(
        `A password reset link has been dispatched to ${cleanEmail}. Please check your inbox (and spam folder) and follow the instructions to reset your password.`,
      );
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMessage(error.message || "Unable to send password reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div suppressHydrationWarning className="w-full">
      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-login-container" />

      {/* VIEW A: FORGOT PASSWORD */}
      {isForgotPassword ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setErrorMessage(null);
                setResetSuccessMessage(null);
              }}
              className="inline-flex items-center gap-1.5 text-xs text-ink-foreground/60 hover:text-ink-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Sign In</span>
            </button>
            <span className="font-mono text-[0.65rem] uppercase tracking-wider text-ink-foreground/40">
              Password Recovery
            </span>
          </div>

          <div className="border border-ink-border bg-ink-foreground/[0.02] p-4 text-xs">
            <p className="text-ink-foreground/80 leading-relaxed">
              Enter your registered client email address. Firebase Authentication will send a secure
              password reset link to your inbox.
            </p>
          </div>

          <form onSubmit={handleForgotPassword} noValidate className="space-y-4">
            <div>
              <Label
                htmlFor="reset-email"
                className="text-xs tracking-[0.18em] text-ink-foreground/60 uppercase"
              >
                Registered Email Address
              </Label>
              <Input
                id="reset-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="e.g. alex@yourcompany.com"
                disabled={loading}
                className="mt-1.5 rounded-none border-ink-border bg-transparent text-ink-foreground placeholder:text-ink-foreground/30 focus-visible:border-ink-foreground/60"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="flex gap-2.5 border border-destructive/50 bg-destructive/10 p-3 text-xs text-ink-foreground"
              >
                <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {resetSuccessMessage && (
              <div
                role="status"
                className="flex gap-2.5 border border-emerald-500/50 bg-emerald-500/10 p-3.5 text-xs text-ink-foreground"
              >
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
                <span className="leading-relaxed">{resetSuccessMessage}</span>
              </div>
            )}

            <Button
              type="submit"
              className="cta-accent group w-full rounded-none mt-2"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" /> Sending Reset Link...
                </>
              ) : resetSuccessMessage ? (
                <>
                  Resend Password Reset Link
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                </>
              ) : (
                <>
                  Send Password Reset Link
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>

            {resetSuccessMessage && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsForgotPassword(false);
                  setErrorMessage(null);
                  setResetSuccessMessage(null);
                }}
                className="w-full rounded-none text-xs cursor-pointer"
                size="sm"
              >
                Return to Sign In Form
              </Button>
            )}
          </form>
        </div>
      ) : (
        /* VIEW B: SIGN IN (EMAIL & PASSWORD OR PHONE PAUSED) */
        <>
          {/* Sub-method switch: Email & Password (Active) vs Phone SMS OTP (Paused) */}
          <div className="mb-6 grid grid-cols-2 border border-ink-border bg-ink-foreground/[0.02]">
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => {
                setMethod("password");
                setErrorMessage(null);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold tracking-[0.14em] uppercase transition-colors cursor-pointer",
                method === "password"
                  ? "bg-ink-foreground/15 text-ink-foreground font-bold border-b-2 border-ink-foreground"
                  : "bg-transparent text-ink-foreground/50 hover:text-ink-foreground",
              )}
            >
              <Mail className="size-3.5" />
              Email & Password
            </button>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => {
                setMethod("phone");
                setErrorMessage(null);
              }}
              className={cn(
                "flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold tracking-[0.14em] uppercase transition-colors cursor-pointer",
                method === "phone"
                  ? "bg-ink-foreground/15 text-ink-foreground font-bold border-b-2 border-ink-foreground"
                  : "bg-transparent text-ink-foreground/50 hover:text-ink-foreground",
              )}
            >
              <Phone className="size-3.5" />
              <span>Phone SMS</span>
              <span className="ml-1 text-[0.6rem] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono tracking-normal">
                PAUSED
              </span>
            </button>
          </div>

          {/* METHOD A: Phone SMS OTP (PAUSED) */}
          {method === "phone" && (
            <div className="space-y-4 border border-ink-border bg-ink-foreground/[0.02] p-6 text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
                <Phone className="size-5" />
              </div>
              <h3 className="font-display text-lg text-ink-foreground">
                Phone Verification Paused
              </h3>
              <p className="text-xs text-ink-foreground/70 leading-relaxed max-w-sm mx-auto">
                Phone SMS OTP verification is temporarily paused while email verification is active.
                Please use your Email and Password to sign in or register a new client account.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                <Button
                  type="button"
                  onClick={() => setMethod("password")}
                  className="cta-accent rounded-none cursor-pointer text-xs"
                  size="sm"
                >
                  Sign In with Password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSwitchToRegister}
                  className="rounded-none cursor-pointer text-xs"
                  size="sm"
                >
                  Create Account with Email
                </Button>
              </div>
            </div>
          )}

          {/* METHOD B: Email & Password */}
          {method === "password" && (
            <form onSubmit={handlePasswordLogin} noValidate className="space-y-4">
              {noticeMessage && (
                <div
                  role="status"
                  className="flex gap-2.5 border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-ink-foreground"
                >
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                  <span>{noticeMessage}</span>
                </div>
              )}

              <div>
                <Label
                  htmlFor="login-email"
                  className="text-xs tracking-[0.18em] text-ink-foreground/60 uppercase"
                >
                  Email Address
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="e.g. alex@yourcompany.com"
                  disabled={loading}
                  className="mt-1.5 rounded-none border-ink-border bg-transparent text-ink-foreground placeholder:text-ink-foreground/30 focus-visible:border-ink-foreground/60"
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <Label
                    htmlFor="login-password"
                    className="text-xs tracking-[0.18em] text-ink-foreground/60 uppercase"
                  >
                    Password
                  </Label>
                  <button
                    suppressHydrationWarning
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setErrorMessage(null);
                      setResetSuccessMessage(null);
                    }}
                    className="text-[0.7rem] text-ink-foreground/50 underline underline-offset-4 hover:text-ink-foreground cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Enter your password"
                  disabled={loading}
                  className="mt-1.5 rounded-none border-ink-border bg-transparent text-ink-foreground placeholder:text-ink-foreground/30 focus-visible:border-ink-foreground/60"
                />
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="flex gap-2.5 border border-destructive/50 bg-destructive/10 p-3 text-xs text-ink-foreground"
                >
                  <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <Button
                type="submit"
                className="cta-accent group w-full rounded-none mt-2"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Signing In...
                  </>
                ) : (
                  <>
                    Sign In as Client
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Switch to Register */}
          <div className="mt-6 border-t border-ink-border pt-4 text-center text-xs text-ink-foreground/60">
            <span>Don't have an account yet? </span>
            <button
              suppressHydrationWarning
              type="button"
              onClick={onSwitchToRegister}
              className="text-ink-foreground underline underline-offset-4 font-semibold hover:text-white cursor-pointer"
            >
              Create client account
            </button>
          </div>
        </>
      )}
    </div>
  );
}
