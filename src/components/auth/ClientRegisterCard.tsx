import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  User,
  Building,
  Gift,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  sendRegistrationEmailOtp,
  verifyRegistrationEmailOtp,
  createClientAccount,
} from "@/services/auth";
import { validateReferralCode } from "@/services/referralService";

interface ClientRegisterCardProps {
  onSwitchToLogin: () => void;
}

export function ClientRegisterCard({ onSwitchToLogin }: ClientRegisterCardProps) {
  const navigate = useNavigate();

  // Multi-step onboarding flow:
  // Step 1: Enter Name, Company (optional), Email -> Send Email OTP
  // Step 2: Enter & Verify 6-digit Email OTP -> Generates Verification Token
  // Step 3: Set Password -> Create Firebase Auth account & Firestore Client Profile -> Open Portal
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 Fields
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");

  // Step 2 Fields
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState("");
  const [verificationToken, setVerificationToken] = useState("");

  // Step 3 Fields
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Referral Program Integration (Step 18)
  const [referralCode, setReferralCode] = useState("");
  const [referralInfo, setReferralInfo] = useState<{
    valid: boolean;
    referrerName?: string;
    code: string;
  } | null>(null);
  const [showReferralInput, setShowReferralInput] = useState(false);

  // Timers & Cooldowns
  const [cooldown, setCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(600); // 10 minutes

  // UI status & messages
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  // Cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Capture, preserve and validate referral code across all onboarding stages
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const queryRef = urlParams.get("ref") || "";
      const storedRef =
        sessionStorage.getItem("vinora_referral_code") ||
        localStorage.getItem("vinora_referral_code") ||
        "";
      const activeRef = (queryRef || storedRef).trim().toUpperCase();

      if (activeRef) {
        setReferralCode(activeRef);
        sessionStorage.setItem("vinora_referral_code", activeRef);
        localStorage.setItem("vinora_referral_code", activeRef);
        validateReferralCode(activeRef).then((res) => {
          if (res.valid) {
            setReferralInfo({
              valid: true,
              referrerName: res.referrerName,
              code: activeRef,
            });
          }
        });
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // OTP expiration countdown (active during Step 2)
  useEffect(() => {
    if (step !== 2 || expirySeconds <= 0) return;
    const timer = setInterval(() => {
      setExpirySeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, expirySeconds]);

  // Password validation rules
  const isLengthValid = password.length >= 8;
  const hasLetterAndNumber = /[A-Za-z]/.test(password) && /[0-9]/.test(password);
  const doPasswordsMatch = password.length > 0 && password === confirmPassword;
  const isPasswordValid = isLengthValid && hasLetterAndNumber && doPasswordsMatch;

  // Restore preserved verification state if present in sessionStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedToken = sessionStorage.getItem("vinora_verification_token");
      const storedEmail = sessionStorage.getItem("vinora_verified_email");
      const storedName = sessionStorage.getItem("vinora_verified_name");
      const storedCompany = sessionStorage.getItem("vinora_verified_company");

      if (storedToken && storedEmail) {
        setVerificationToken(storedToken);
        setEmail(storedEmail);
        if (storedName) setName(storedName);
        if (storedCompany) setCompany(storedCompany);
        setStep(3);
        setNoticeMessage(
          "Email verification active. Please set your password to complete registration.",
        );
      }
    } catch {
      // Non-blocking
    }
  }, []);

  // Format remaining expiration time mm:ss
  const formatExpiry = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // -------------------------------------------------------------
  // Step 1: Send Email Verification Code
  // -------------------------------------------------------------
  const handleSendOtp = async (
    e?: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setErrorMessage(null);
    setNoticeMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName) {
      setErrorMessage("Please enter your full name.");
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await sendRegistrationEmailOtp(cleanEmail);

      if (!res.success || !res.requestId) {
        setErrorMessage(res.error || "Failed to send verification code. Please try again.");
        return;
      }

      setRequestId(res.requestId);
      setCooldown(res.cooldownSeconds || 60);
      setExpirySeconds(res.expiresInSeconds || 600);
      setNoticeMessage(res.deliveryNotice || `Verification code sent to ${cleanEmail}.`);
      setStep(2);
      setOtp("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send verification code.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Step 2: Verify 6-digit Email OTP
  // -------------------------------------------------------------
  const handleVerifyOtp = async (
    e?: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setErrorMessage(null);
    setNoticeMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    const cleanOtp = otp.trim();

    if (!requestId) {
      setErrorMessage("Verification session missing. Please request a new code.");
      setStep(1);
      return;
    }

    if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
      setErrorMessage("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);
    try {
      const res = await verifyRegistrationEmailOtp(requestId, cleanEmail, cleanOtp);

      if (!res.success || !res.verificationToken) {
        const attemptsNotice =
          res.remainingAttempts !== undefined
            ? ` (${res.remainingAttempts} attempts remaining)`
            : "";
        setErrorMessage((res.error || "Invalid verification code.") + attemptsNotice);
        return;
      }

      setVerificationToken(res.verificationToken);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("vinora_verification_token", res.verificationToken);
        sessionStorage.setItem("vinora_verified_email", cleanEmail);
        sessionStorage.setItem("vinora_verified_name", cleanName);
        sessionStorage.setItem("vinora_verified_company", company.trim());
      }
      setNoticeMessage("Email verified successfully. Please set your account password.");
      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed. Please try again.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Step 3: Set Password & Create Authenticated Client Account
  // -------------------------------------------------------------
  const handleSetPasswordAndCreateAccount = async (
    e?: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setErrorMessage(null);
    setNoticeMessage(null);

    // Retrieve verified credentials with sessionStorage fallback so verification is NEVER lost
    let cleanEmail = email.trim().toLowerCase();
    let cleanName = name.trim();
    let cleanCompany = company.trim();
    let token = verificationToken?.trim();

    if (typeof window !== "undefined") {
      if (!token) {
        token = sessionStorage.getItem("vinora_verification_token") || "";
        if (token) setVerificationToken(token);
      }
      if (!cleanEmail) {
        cleanEmail = (sessionStorage.getItem("vinora_verified_email") || "").trim().toLowerCase();
        if (cleanEmail) setEmail(cleanEmail);
      }
      if (!cleanName) {
        cleanName = (sessionStorage.getItem("vinora_verified_name") || "").trim();
        if (cleanName) setName(cleanName);
      }
      if (!cleanCompany) {
        cleanCompany = (sessionStorage.getItem("vinora_verified_company") || "").trim();
        if (cleanCompany) setCompany(cleanCompany);
      }
    }

    if (!token) {
      setErrorMessage("Verification session token is missing. Please verify your email again.");
      setStep(1);
      return;
    }

    if (!cleanEmail) {
      setErrorMessage("Verified email is missing. Please verify your email again.");
      setStep(1);
      return;
    }

    // Explicit and helpful validation checks so the button never fails silently
    if (!password) {
      setErrorMessage("Please create a password for your account.");
      return;
    }

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setErrorMessage("Password must contain both letters and numbers.");
      return;
    }

    if (!confirmPassword) {
      setErrorMessage("Please confirm your password.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please ensure both passwords match exactly.");
      return;
    }

    setLoading(true);
    try {
      const activeRef =
        referralCode.trim() ||
        (typeof window !== "undefined"
          ? sessionStorage.getItem("vinora_referral_code") ||
            localStorage.getItem("vinora_referral_code") ||
            ""
          : "");

      await createClientAccount({
        verificationToken: token,
        email: cleanEmail,
        password,
        confirmPassword,
        name: cleanName,
        company: cleanCompany,
        referralCode: activeRef.trim().toUpperCase() || undefined,
      });

      if (typeof window !== "undefined") {
        sessionStorage.removeItem("vinora_verification_token");
        sessionStorage.removeItem("vinora_verified_email");
        sessionStorage.removeItem("vinora_verified_name");
        sessionStorage.removeItem("vinora_verified_company");
        sessionStorage.removeItem("vinora_referral_code");
        localStorage.removeItem("vinora_referral_code");
      }

      setNoticeMessage("Account created successfully! Opening your Client Portal...");

      // Redirect immediately to verified Client Portal or returned draft route
      const returnTo =
        typeof window !== "undefined" ? sessionStorage.getItem("vinora_auth_redirect") : null;
      if (returnTo) {
        sessionStorage.removeItem("vinora_auth_redirect");
        navigate({ to: returnTo });
      } else {
        navigate({ to: "/client" });
      }
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to create account. Please try again.";
      setErrorMessage(errorMsg);
    } finally {
      // GUARANTEED: Loading state is always reset to false so the UI never gets stuck!
      setLoading(false);
    }
  };

  return (
    <div
      id="client-register-card"
      className="border border-ink-border bg-ink-foreground/[0.03] p-6 sm:p-8"
    >
      {/* Visual Stepper Indicator */}
      <div className="mb-6 flex items-center justify-between border-b border-ink-border pb-4">
        <div className="flex items-center gap-2">
          <div
            className={`flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              step >= 1
                ? "bg-ink-foreground text-ink font-bold"
                : "bg-ink-border text-ink-foreground/40"
            }`}
          >
            {step > 1 ? <CheckCircle2 className="size-4 text-emerald-400" /> : "1"}
          </div>
          <span
            className={`text-xs uppercase tracking-wider ${
              step === 1 ? "font-bold text-ink-foreground" : "text-ink-foreground/50"
            }`}
          >
            Details
          </span>
        </div>

        <div className="h-px w-6 bg-ink-border sm:w-12" />

        <div className="flex items-center gap-2">
          <div
            className={`flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              step >= 2
                ? "bg-ink-foreground text-ink font-bold"
                : "bg-ink-border text-ink-foreground/40"
            }`}
          >
            {step > 2 ? <CheckCircle2 className="size-4 text-emerald-400" /> : "2"}
          </div>
          <span
            className={`text-xs uppercase tracking-wider ${
              step === 2 ? "font-bold text-ink-foreground" : "text-ink-foreground/50"
            }`}
          >
            Email OTP
          </span>
        </div>

        <div className="h-px w-6 bg-ink-border sm:w-12" />

        <div className="flex items-center gap-2">
          <div
            className={`flex size-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
              step === 3
                ? "bg-ink-foreground text-ink font-bold"
                : "bg-ink-border text-ink-foreground/40"
            }`}
          >
            3
          </div>
          <span
            className={`text-xs uppercase tracking-wider ${
              step === 3 ? "font-bold text-ink-foreground" : "text-ink-foreground/50"
            }`}
          >
            Set Password
          </span>
        </div>
      </div>

      {/* Notice Banner */}
      {noticeMessage && (
        <div
          role="status"
          className="mb-6 flex gap-2.5 border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-ink-foreground"
        >
          <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
          <span>{noticeMessage}</span>
        </div>
      )}

      {/* Referral Attribution Banner (Step 18) */}
      {referralCode && (
        <div className="mb-6 flex items-center justify-between border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-ink-foreground">
          <div className="flex items-center gap-2">
            <Gift className="size-4 shrink-0 text-emerald-400" />
            <div>
              <span className="font-mono font-semibold text-emerald-300">{referralCode}</span>
              <span className="ml-1 text-ink-foreground/80">
                {referralInfo?.referrerName
                  ? `(Referred by ${referralInfo.referrerName})`
                  : "Referral applied"}
              </span>
            </div>
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-400 font-semibold border border-emerald-500/30 px-1.5 py-0.5 bg-emerald-500/10">
            Credit Eligible
          </span>
        </div>
      )}

      {/* Global Error Alert */}
      {errorMessage && (
        <div
          role="alert"
          className="mb-6 flex gap-2.5 border border-destructive/50 bg-destructive/10 p-3.5 text-xs text-ink-foreground"
        >
          <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
          <div className="flex-1">
            <span>{errorMessage}</span>
            {errorMessage.toLowerCase().includes("sign in") && (
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="mt-1.5 block text-xs underline font-semibold text-ink-foreground hover:text-white cursor-pointer"
              >
                Go to Sign In tab &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* STEP 1: Enter Profile & Email -> Send Code                   */}
      {/* ============================================================ */}
      {step === 1 && (
        <form noValidate onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <Label htmlFor="reg-name" className="text-xs uppercase tracking-wider">
              Full Name *
            </Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-foreground/40" />
              <Input
                id="reg-name"
                type="text"
                placeholder="e.g. Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reg-company" className="text-xs uppercase tracking-wider">
              Company or Organization (Optional)
            </Label>
            <div className="relative mt-1">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-foreground/40" />
              <Input
                id="reg-company"
                type="text"
                placeholder="e.g. Acorn Ventures"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                className="pl-10"
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="reg-email" className="text-xs uppercase tracking-wider">
              Work or Personal Email *
            </Label>
            <div className="relative mt-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-foreground/40" />
              <Input
                id="reg-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10"
                disabled={loading}
              />
            </div>
            <p className="mt-1.5 text-[0.75rem] text-ink-foreground/50">
              We will send a 6-digit verification code to this address.
            </p>
          </div>

          {/* Referral Code Entry */}
          {!referralInfo?.valid && (
            <div>
              {!showReferralInput ? (
                <button
                  type="button"
                  onClick={() => setShowReferralInput(true)}
                  className="text-[11px] font-mono text-ink-foreground/60 hover:text-ink-foreground underline cursor-pointer"
                >
                  + Have a VINORA referral code?
                </button>
              ) : (
                <div className="space-y-1 pt-1">
                  <Label htmlFor="reg-ref" className="text-xs uppercase tracking-wider">
                    Referral Code (Optional)
                  </Label>
                  <div className="relative mt-1">
                    <Gift className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-foreground/40" />
                    <Input
                      id="reg-ref"
                      type="text"
                      placeholder="e.g. VINORA-7K9M2P"
                      value={referralCode}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase().trim();
                        setReferralCode(val);
                        if (typeof window !== "undefined") {
                          if (val) {
                            sessionStorage.setItem("vinora_referral_code", val);
                            localStorage.setItem("vinora_referral_code", val);
                          } else {
                            sessionStorage.removeItem("vinora_referral_code");
                            localStorage.removeItem("vinora_referral_code");
                          }
                        }
                      }}
                      className="pl-10 font-mono text-xs uppercase"
                      disabled={loading}
                    />
                  </div>
                  <p className="text-[10px] text-ink-foreground/50 font-mono">
                    Referral attribution links you with your referring peer for engineering rewards.
                  </p>
                </div>
              )}
            </div>
          )}

          <Button
            id="btn-send-verification-code"
            type="submit"
            onClick={handleSendOtp}
            className="cta-accent group w-full rounded-none mt-2 cursor-pointer"
            size="lg"
            disabled={loading || !email.trim() || !name.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                <span>Sending Verification Code...</span>
              </>
            ) : (
              <>
                <span>Send Verification Code</span>
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </form>
      )}

      {/* ============================================================ */}
      {/* STEP 2: Verify 6-digit OTP                                   */}
      {/* ============================================================ */}
      {step === 2 && (
        <form noValidate onSubmit={handleVerifyOtp} className="space-y-5">
          <div className="flex items-center justify-between border-b border-ink-border pb-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-ink-foreground/60">
                Verification code sent to:
              </p>
              <p className="text-sm font-semibold text-ink-foreground mt-0.5">{email}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setErrorMessage(null);
              }}
              className="text-xs underline text-ink-foreground/70 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="size-3" />
              Edit
            </button>
          </div>

          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wider block text-center">
              Enter 6-Digit Code
            </Label>
            <div className="flex justify-center py-2">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(value) => setOtp(value)}
                disabled={loading}
              >
                <InputOTPGroup className="gap-2">
                  <InputOTPSlot
                    index={0}
                    className="size-11 sm:size-12 text-lg font-mono border-ink-border bg-ink-foreground/[0.04]"
                  />
                  <InputOTPSlot
                    index={1}
                    className="size-11 sm:size-12 text-lg font-mono border-ink-border bg-ink-foreground/[0.04]"
                  />
                  <InputOTPSlot
                    index={2}
                    className="size-11 sm:size-12 text-lg font-mono border-ink-border bg-ink-foreground/[0.04]"
                  />
                  <InputOTPSlot
                    index={3}
                    className="size-11 sm:size-12 text-lg font-mono border-ink-border bg-ink-foreground/[0.04]"
                  />
                  <InputOTPSlot
                    index={4}
                    className="size-11 sm:size-12 text-lg font-mono border-ink-border bg-ink-foreground/[0.04]"
                  />
                  <InputOTPSlot
                    index={5}
                    className="size-11 sm:size-12 text-lg font-mono border-ink-border bg-ink-foreground/[0.04]"
                  />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <div className="flex items-center justify-between pt-1 text-xs text-ink-foreground/60">
              <span>
                Code expires in:{" "}
                <strong className="font-mono text-ink-foreground">
                  {formatExpiry(expirySeconds)}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => handleSendOtp()}
                disabled={cooldown > 0 || loading}
                className="text-xs underline text-ink-foreground/80 hover:text-white disabled:opacity-40 disabled:no-underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
              </button>
            </div>
          </div>

          <Button
            id="btn-verify-otp-code"
            type="submit"
            onClick={handleVerifyOtp}
            className="cta-accent group w-full rounded-none mt-2 cursor-pointer"
            size="lg"
            disabled={loading || otp.length !== 6}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                <span>Verifying Code...</span>
              </>
            ) : (
              <>
                <span>Verify Code & Continue</span>
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </form>
      )}

      {/* ============================================================ */}
      {/* STEP 3: Set Password & Create Account                        */}
      {/* ============================================================ */}
      {step === 3 && (
        <form noValidate onSubmit={handleSetPasswordAndCreateAccount} className="space-y-4">
          <div className="flex items-center justify-between border border-emerald-500/30 bg-emerald-500/[0.06] p-3">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <div>
                <span className="font-medium text-ink-foreground">{email}</span>
                <span className="ml-2 text-emerald-400 font-semibold uppercase tracking-wider text-[0.65rem]">
                  Verified
                </span>
              </div>
            </div>
            <span className="text-[0.7rem] text-ink-foreground/50">Client Role</span>
          </div>

          <div>
            <Label htmlFor="reg-password" className="text-xs uppercase tracking-wider">
              Create Password *
            </Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-foreground/40" />
              <Input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                placeholder="Min 8 chars with letters & numbers"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="pl-10 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-foreground/40 hover:text-ink-foreground cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label htmlFor="reg-confirm-password" className="text-xs uppercase tracking-wider">
              Confirm Password *
            </Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-ink-foreground/40" />
              <Input
                id="reg-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="pl-10 pr-10"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-foreground/40 hover:text-ink-foreground cursor-pointer"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {/* Password Validation Requirements */}
          <div className="space-y-1.5 border border-ink-border/70 bg-ink-foreground/[0.02] p-3 text-[0.75rem]">
            <div
              className={`flex items-center gap-2 ${
                isLengthValid ? "text-emerald-400" : "text-ink-foreground/50"
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>At least 8 characters</span>
            </div>
            <div
              className={`flex items-center gap-2 ${
                hasLetterAndNumber ? "text-emerald-400" : "text-ink-foreground/50"
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>Contains both letters and numbers</span>
            </div>
            <div
              className={`flex items-center gap-2 ${
                doPasswordsMatch ? "text-emerald-400" : "text-ink-foreground/50"
              }`}
            >
              <ShieldCheck className="size-3.5" />
              <span>Passwords match</span>
            </div>
          </div>

          {/* Step 3 Error Alert directly above action button */}
          {errorMessage && (
            <div
              role="alert"
              className="flex gap-2.5 border border-destructive/50 bg-destructive/10 p-3.5 text-xs text-ink-foreground"
            >
              <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
                {errorMessage.toLowerCase().includes("sign in") && (
                  <button
                    type="button"
                    onClick={onSwitchToLogin}
                    className="mt-1.5 block text-xs underline font-semibold text-ink-foreground hover:text-white cursor-pointer"
                  >
                    Go to Sign In tab &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

          <Button
            id="btn-complete-registration"
            type="submit"
            onClick={handleSetPasswordAndCreateAccount}
            className="cta-accent group w-full rounded-none mt-2 cursor-pointer"
            size="lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                <span>Completing Registration...</span>
              </>
            ) : (
              <>
                <span>Complete Registration & Access Portal</span>
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </Button>
        </form>
      )}

      {/* Switch back to Login */}
      <div className="mt-6 border-t border-ink-border pt-4 text-center text-xs text-ink-foreground/60">
        <span>Already have an account? </span>
        <button
          suppressHydrationWarning
          type="button"
          onClick={onSwitchToLogin}
          className="text-ink-foreground underline underline-offset-4 font-semibold hover:text-white cursor-pointer"
        >
          Sign in here
        </button>
      </div>
    </div>
  );
}
