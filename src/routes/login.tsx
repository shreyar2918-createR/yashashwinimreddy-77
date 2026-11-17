import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Loader2, UserPlus, LogIn } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";

import { LogoLockup } from "@/components/brand/Logo";
import { HeroCanvas } from "@/components/brand/HeroCanvas";
import { SplitText } from "@/components/experience/SplitText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPassword } from "@/services/auth";
import { signInAdmin, sendAdminPasswordReset } from "@/services/adminAuth";
import { ClientRegisterCard } from "@/components/auth/ClientRegisterCard";
import { ClientLoginCard } from "@/components/auth/ClientLoginCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/login")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { role: "client" | "admin"; mode?: "login" | "register"; status?: string; ref?: string } => ({
    role: search.role === "admin" ? "admin" : "client",
    mode: search.ref || search.mode === "register" ? "register" : "login",
    status: typeof search.status === "string" ? search.status : undefined,
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — VINORA" },
      {
        name: "description",
        content:
          "Sign in to the VINORA portal to access your projects, proposals, files and invoices.",
      },
      { property: "og:title", content: "Sign in — VINORA" },
      {
        property: "og:description",
        content: "Client Login and Admin Login access to the VINORA platform.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

function LoginPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<"client" | "admin">(search.role);
  const [activeMode, setActiveMode] = useState<"login" | "register">(
    search.role === "client" && search.mode === "register" ? "register" : "login",
  );
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [resetError, setResetError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof schema>) => signInAdmin(values.email, values.password),
    onSuccess: () => {
      navigate({ to: "/admin" });
    },
  });

  async function handleSendResetEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resetEmail.trim()) {
      setResetError("Please enter your registered admin email address.");
      return;
    }
    setResetStatus("sending");
    setResetError(null);
    try {
      await sendAdminPasswordReset(resetEmail);
      setResetStatus("success");
    } catch (err: unknown) {
      setResetStatus("error");
      setResetError(
        err instanceof Error
          ? err.message
          : "Unable to dispatch password reset email. Please try again.",
      );
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<
      string,
      string
    >;
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      const next: { email?: string; password?: string } = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as "email" | "password";
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    mutation.mutate(parsed.data);
  }

  const isClient = activeRole === "client";

  return (
    <main
      suppressHydrationWarning
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden bg-ink px-5 py-16 text-ink-foreground sm:px-8"
    >
      <HeroCanvas />
      <div className="light-rays pointer-events-none absolute inset-0" aria-hidden />
      <div className="noise-layer pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative grid w-full max-w-5xl gap-14 lg:grid-cols-2 lg:items-center">
        <div className="hidden lg:block">
          <Link to="/" className="inline-flex">
            <LogoLockup className="text-ink-foreground" markClassName="size-11" showTagline />
          </Link>
          <SplitText
            as="p"
            start="mount"
            text={
              isClient
                ? "Every project, proposal, file and invoice in one place."
                : "Internal operations for managing projects, clients and delivery."
            }
            className="mt-12 max-w-md font-display text-3xl leading-tight tracking-tight"
          />
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink-foreground/60">
            {isClient
              ? "The VINORA client portal gives you clear visibility of your project progress, deliverables, proposals, invoices and direct messages."
              : "The VINORA admin dashboard gives the internal team a unified console to manage clients, proposals, files, invoices, messages and project status."}
          </p>

          <div className="mt-8">
            <Link
              to={isClient ? "/client" : "/admin"}
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase underline underline-offset-4 text-ink-foreground/75 hover:text-ink-foreground"
            >
              <span>
                {isClient ? "Preview Client Portal layout" : "Preview Admin Dashboard layout"}
              </span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <div
          suppressHydrationWarning
          className="w-full max-w-md justify-self-center border border-ink-border bg-ink-foreground/[0.06] p-8 backdrop-blur-xl sm:p-10"
        >
          <Link to="/" className="inline-flex lg:hidden">
            <LogoLockup className="text-ink-foreground" />
          </Link>

          {search.status === "account_deleted" && (
            <div className="mt-4 border border-ink-border bg-ink-foreground/[0.04] p-3 text-xs text-ink-foreground/80 leading-relaxed">
              Your VINORA client account and associated profile records have been permanently
              deleted.
            </div>
          )}

          {search.status === "admin_signed_out" && (
            <div className="mt-4 border border-ink-border bg-ink-foreground/[0.04] p-3 text-xs text-ink-foreground/90 leading-relaxed">
              You have been securely signed out of the VINORA Admin Console.
            </div>
          )}

          {search.status === "unauthorized" && (
            <div className="mt-4 border border-destructive/40 bg-destructive/10 p-3 text-xs text-ink-foreground leading-relaxed flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
              <span>
                Admin access required: Please sign in with an authorized VINORA administrator
                account to access the Admin Portal.
              </span>
            </div>
          )}

          {/* Role selector tabs */}
          <div className="mt-6 flex border border-ink-border lg:mt-0">
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => {
                setActiveRole("client");
                setErrors({});
              }}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors cursor-pointer",
                isClient
                  ? "bg-ink-foreground text-ink font-bold"
                  : "bg-transparent text-ink-foreground/60 hover:text-ink-foreground",
              )}
            >
              Client Portal
            </button>
            <button
              suppressHydrationWarning
              type="button"
              onClick={() => {
                setActiveRole("admin");
                setActiveMode("login");
                setErrors({});
              }}
              className={cn(
                "flex-1 py-2.5 text-xs font-semibold tracking-[0.18em] uppercase transition-colors cursor-pointer",
                !isClient
                  ? "bg-ink-foreground text-ink font-bold"
                  : "bg-transparent text-ink-foreground/60 hover:text-ink-foreground",
              )}
            >
              Admin Login
            </button>
          </div>

          {/* Client mode toggle: Sign In vs Create Account */}
          {isClient && (
            <div className="mt-4 flex border border-ink-border/70 bg-ink-foreground/[0.02]">
              <button
                suppressHydrationWarning
                type="button"
                onClick={() => {
                  setActiveMode("login");
                  setErrors({});
                }}
                className={cn(
                  "flex-1 py-2 text-xs font-semibold tracking-[0.16em] uppercase transition-colors cursor-pointer flex items-center justify-center gap-1.5",
                  activeMode === "login"
                    ? "bg-ink-foreground/15 text-ink-foreground font-bold border-b-2 border-ink-foreground"
                    : "bg-transparent text-ink-foreground/50 hover:text-ink-foreground",
                )}
              >
                <LogIn className="size-3.5" />
                Sign In
              </button>
              <button
                suppressHydrationWarning
                type="button"
                onClick={() => {
                  setActiveMode("register");
                  setErrors({});
                }}
                className={cn(
                  "flex-1 py-2 text-xs font-semibold tracking-[0.16em] uppercase transition-colors cursor-pointer flex items-center justify-center gap-1.5",
                  activeMode === "register"
                    ? "bg-ink-foreground/15 text-ink-foreground font-bold border-b-2 border-ink-foreground"
                    : "bg-transparent text-ink-foreground/50 hover:text-ink-foreground",
                )}
              >
                <UserPlus className="size-3.5" />
                Create Account
              </button>
            </div>
          )}

          <h1 className="mt-6 font-display text-3xl tracking-tight">
            {isClient
              ? activeMode === "register"
                ? "Create Client Account"
                : "Client Login"
              : "Admin Login"}
          </h1>
          <p className="mt-2 text-sm text-ink-foreground/60">
            {isClient
              ? activeMode === "register"
                ? "Verify your email with a secure verification code to set up your VINORA portal profile."
                : "Access your project progress, proposals, files and invoices."
              : "Internal control for managing clients, projects and operations."}
          </p>

          {isClient ? (
            <div className="mt-6">
              {activeMode === "register" ? (
                <ClientRegisterCard onSwitchToLogin={() => setActiveMode("login")} />
              ) : (
                <ClientLoginCard onSwitchToRegister={() => setActiveMode("register")} />
              )}
            </div>
          ) : isForgotPassword ? (
            <form
              suppressHydrationWarning
              onSubmit={handleSendResetEmail}
              noValidate
              className="mt-8 space-y-5"
            >
              <div>
                <h3 className="text-xs font-semibold tracking-[0.18em] uppercase text-ink-foreground">
                  Reset Administrator Password
                </h3>
                <p className="mt-2 text-xs text-ink-foreground/60 leading-relaxed">
                  Enter your registered admin email address. A secure Firebase password reset link
                  will be sent directly to your inbox.
                </p>
              </div>

              <div className="group">
                <Label
                  htmlFor="reset-email"
                  className="text-xs tracking-[0.18em] text-ink-foreground/60 uppercase"
                >
                  Admin Email Address
                </Label>
                <Input
                  id="reset-email"
                  name="reset-email"
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  autoComplete="email"
                  required
                  placeholder="name@vinora.io"
                  className="mt-2 rounded-none border-ink-border bg-transparent text-ink-foreground transition-colors placeholder:text-ink-foreground/30 focus-visible:border-ink-foreground/60"
                />
              </div>

              {resetStatus === "success" && (
                <div className="border border-ink-border bg-ink-foreground/[0.04] p-3 text-xs text-ink-foreground/90 leading-relaxed">
                  Password reset email sent to{" "}
                  <span className="font-semibold text-ink-foreground">{resetEmail}</span>. Please
                  check your inbox and spam folder to complete the reset process.
                </div>
              )}

              {resetStatus === "error" && resetError && (
                <div
                  role="alert"
                  className="flex gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-ink-foreground"
                >
                  <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <Button
                  type="submit"
                  className="cta-accent group w-full rounded-none"
                  size="lg"
                  disabled={resetStatus === "sending"}
                >
                  {resetStatus === "sending" ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" /> Dispatching Link...
                    </>
                  ) : (
                    <>
                      Send Password Reset Link
                      <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-none text-xs tracking-wider uppercase cursor-pointer"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setResetStatus("idle");
                    setResetError(null);
                  }}
                >
                  Back to Admin Sign In
                </Button>
              </div>
            </form>
          ) : (
            <form
              suppressHydrationWarning
              onSubmit={handleSubmit}
              noValidate
              className="mt-8 space-y-5"
            >
              <div className="group">
                <Label
                  htmlFor="email"
                  className="text-xs tracking-[0.18em] text-ink-foreground/60 uppercase"
                >
                  Admin Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  aria-invalid={Boolean(errors.email)}
                  className="mt-2 rounded-none border-ink-border bg-transparent text-ink-foreground transition-colors placeholder:text-ink-foreground/30 focus-visible:border-ink-foreground/60"
                />
                {errors.email ? (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {errors.email}
                  </p>
                ) : null}
              </div>

              <div>
                <div className="flex items-baseline justify-between">
                  <Label
                    htmlFor="password"
                    className="text-xs tracking-[0.18em] text-ink-foreground/60 uppercase"
                  >
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotPassword(true);
                      setResetStatus("idle");
                      setResetError(null);
                    }}
                    className="text-[0.7rem] text-ink-foreground/50 underline underline-offset-4 hover:text-ink-foreground cursor-pointer"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  aria-invalid={Boolean(errors.password)}
                  className="mt-2 rounded-none border-ink-border bg-transparent text-ink-foreground transition-colors focus-visible:border-ink-foreground/60"
                />
                {errors.password ? (
                  <p role="alert" className="mt-2 text-xs text-destructive">
                    {errors.password}
                  </p>
                ) : null}
              </div>

              {mutation.isError ? (
                <div
                  role="alert"
                  className="flex gap-3 border border-ink-border bg-ink-foreground/5 p-4 text-sm"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <p className="text-ink-foreground/80">{mutation.error.message}</p>
                </div>
              ) : null}

              <Button
                type="submit"
                className="cta-accent group w-full rounded-none"
                size="lg"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Authenticating...
                  </>
                ) : (
                  <>
                    Sign In to Admin Console
                    <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Quick links to preview frontend layout */}
          <div className="mt-6 border-t border-ink-border pt-4 text-xs text-ink-foreground/60">
            <p>
              Prepared interface structure:{" "}
              <Link
                to={isClient ? "/client" : "/admin"}
                className="text-ink-foreground underline underline-offset-4 font-medium"
              >
                {isClient ? "Explore Client Portal" : "Explore Admin Dashboard"}
              </Link>
            </p>
          </div>

          {!isClient && (
            <p className="mt-6 text-sm text-ink-foreground/60">
              Admin access is restricted to authorized VINORA operations team members.
            </p>
          )}
          <p className="mt-4 text-xs text-ink-foreground/45">
            <Link to="/" className="underline underline-offset-4">
              Back to VINORA
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
