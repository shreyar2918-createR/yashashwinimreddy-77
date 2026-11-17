import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Loader2,
  Paperclip,
  RotateCcw,
  User,
  UserCheck,
} from "lucide-react";
import { useState, useEffect, type FormEvent } from "react";
import { z } from "zod";

import { PageHero, Section } from "@/components/common/Section";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SOLUTION_CATEGORIES } from "@/content/site";
import { submitProjectInquiry, type ProjectInquiryInput } from "@/services/inquiries";
import { subscribeToAuth, getClientDetailedProfile } from "@/services/auth";
import type { UserProfile, ProjectRequest } from "@/lib/types";

export const Route = createFileRoute("/start-project")({
  validateSearch: (search: Record<string, unknown>): { service?: string } => ({
    service: typeof search.service === "string" ? search.service : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Start Your Project — VINORA" },
      {
        name: "description",
        content:
          "Share your idea or requirement with VINORA. Tell us the outcome you want and we will structure the work, scope and next steps.",
      },
      { property: "og:title", content: "Start Your Project — VINORA" },
      {
        property: "og:description",
        content: "Submit your project requirement to VINORA.",
      },
    ],
  }),
  component: StartProjectPage,
});

const inquirySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  email: z.string().trim().email("Enter a valid email address").max(255),
  businessName: z.string().trim().max(120).optional(),
  serviceRequired: z.string().trim().min(1, "Select what you need"),
  projectDescription: z
    .string()
    .trim()
    .min(20, "Please describe the project in at least 20 characters")
    .max(4000),
  budget: z.string().trim().max(80).optional(),
  expectedCompletionDate: z.string().trim().max(40).optional(),
  referenceWebsites: z.string().trim().max(1000).optional(),
  preferredCommunication: z.string().trim().min(1, "Choose how we should reply"),
  additionalRequirements: z.string().trim().max(2000).optional(),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof inquirySchema>, string>>;

interface FormState {
  name: string;
  email: string;
  businessName: string;
  serviceRequired: string;
  projectDescription: string;
  budget: string;
  expectedCompletionDate: string;
  referenceWebsites: string;
  preferredCommunication: string;
  additionalRequirements: string;
}

const INITIAL_FORM_STATE: FormState = {
  name: "",
  email: "",
  businessName: "",
  serviceRequired: "",
  projectDescription: "",
  budget: "",
  expectedCompletionDate: "",
  referenceWebsites: "",
  preferredCommunication: "Email",
  additionalRequirements: "",
};

const SERVICE_OPTIONS = [
  "I'm not sure yet — help me decide",
  ...SOLUTION_CATEGORIES.flatMap((c) => c.items),
];

const COMMUNICATION_OPTIONS = ["Email", "Video call"];

const DRAFT_STORAGE_KEY = "vinora_project_draft";

function StartProjectPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();

  // Authentication & Client state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [detailedCompany, setDetailedCompany] = useState<string>("");
  const [authLoaded, setAuthLoaded] = useState(false);

  // Form State
  const [formData, setFormData] = useState<FormState>(() => ({
    ...INITIAL_FORM_STATE,
    serviceRequired: search.service ? search.service : "",
  }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [files, setFiles] = useState<File[]>([]);
  const [draftRestored, setDraftRestored] = useState(false);

  // Guest vs Account Modal
  const [showAuthChoiceModal, setShowAuthChoiceModal] = useState(false);
  const [pendingPayload, setPendingPayload] = useState<z.infer<typeof inquirySchema> | null>(null);
  const [guestChoiceConfirmed, setGuestChoiceConfirmed] = useState(false);

  // Copy state
  const [copiedId, setCopiedId] = useState(false);

  // Sync service from query param if changed
  useEffect(() => {
    if (search.service && !formData.serviceRequired) {
      setFormData((prev) => ({ ...prev, serviceRequired: search.service || prev.serviceRequired }));
    }
  }, [search.service, formData.serviceRequired]);

  // 1. Observe Authentication State
  useEffect(() => {
    const unsubscribe = subscribeToAuth(async (currentUserProfile) => {
      setProfile(currentUserProfile);
      setAuthLoaded(true);

      if (currentUserProfile) {
        try {
          const detailed = await getClientDetailedProfile(currentUserProfile.id);
          if (detailed?.companyName) {
            setDetailedCompany(detailed.companyName);
          }
        } catch {
          // Non-blocking
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Restore Draft from sessionStorage (if any) or pre-fill from authenticated profile
  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const saved = sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<FormState>;
        setFormData((prev) => ({
          ...prev,
          ...parsed,
        }));
        setDraftRestored(true);
        return;
      }
    } catch (err) {
      console.warn("Could not restore project draft from sessionStorage:", err);
    }

    // If no draft but user is logged in, auto-fill profile details
    if (profile) {
      setFormData((prev) => ({
        ...prev,
        name: prev.name || profile.fullName || "",
        email: prev.email || profile.email || "",
        businessName: prev.businessName || detailedCompany || "",
      }));
    }
  }, [profile, detailedCompany]);

  // Project Inquiry Mutation connected to Firebase
  const mutation = useMutation({
    mutationFn: (input: ProjectInquiryInput) => submitProjectInquiry(input),
    onSuccess: () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    },
  });

  // Handle Input Changes
  function handleChange(field: keyof FormState, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  // Save current form state to draft & redirect to Auth
  function handleRedirectToAuth(mode: "login" | "register") {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
      sessionStorage.setItem("vinora_auth_redirect", "/start-project");
    }
    navigate({
      to: "/login",
      search: { role: "client", mode },
    });
  }

  // Handle Form Submission
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (mutation.isPending) return;

    const parsed = inquirySchema.safeParse(formData);

    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      const firstField = Object.keys(next)[0];
      if (firstField) {
        document.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
      }
      return;
    }

    setErrors({});

    // If visitor is NOT logged in and hasn't yet chosen to continue as guest:
    if (!profile && !guestChoiceConfirmed) {
      setPendingPayload(parsed.data);
      setShowAuthChoiceModal(true);
      return;
    }

    // Logged in OR visitor confirmed guest submission:
    executeSubmission(parsed.data);
  }

  // Execute Firestore submission
  function executeSubmission(data: z.infer<typeof inquirySchema>) {
    mutation.mutate({
      name: data.name,
      email: data.email,
      businessName: data.businessName,
      serviceRequired: data.serviceRequired,
      projectDescription: data.projectDescription,
      budget: data.budget,
      expectedCompletionDate: data.expectedCompletionDate,
      referenceWebsites: data.referenceWebsites,
      preferredCommunication: data.preferredCommunication,
      additionalRequirements: data.additionalRequirements,
      files,
    });
  }

  // Proceed as Guest handler from modal
  function handleProceedAsGuest() {
    setGuestChoiceConfirmed(true);
    setShowAuthChoiceModal(false);
    if (pendingPayload) {
      executeSubmission(pendingPayload);
    }
  }

  // Reset form to submit another request
  function handleResetForm() {
    mutation.reset();
    setFormData({
      ...INITIAL_FORM_STATE,
      name: profile?.fullName || "",
      email: profile?.email || "",
      businessName: detailedCompany || "",
    });
    setFiles([]);
    setErrors({});
    setGuestChoiceConfirmed(false);
    setPendingPayload(null);
  }

  // Copy reference ID
  function handleCopyId(id: string) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    }
  }

  return (
    <SiteLayout>
      <PageHero
        eyebrow="Start your project"
        title="Tell us what you want to exist."
        copy="The more context you give, the more precise the proposal. If you don't know the answer to a field, leave it — we will work it out together."
      />

      <Section>
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)] lg:gap-20">
          <div className="min-w-0">
            {/* SUCCESS VIEW */}
            {mutation.isSuccess && mutation.data ? (
              <SuccessConfirmation
                request={mutation.data}
                copied={copiedId}
                onCopy={handleCopyId}
                onReset={handleResetForm}
                onNavigateClient={() => navigate({ to: "/client" })}
                onNavigateRegister={() => handleRedirectToAuth("register")}
              />
            ) : (
              /* FORM VIEW */
              <form onSubmit={handleSubmit} noValidate className="min-w-0">
                {/* 1. Account / Auth State Banner */}
                {authLoaded ? (
                  profile ? (
                    <div className="mb-10 border border-border bg-surface p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-start sm:items-center gap-3">
                        <div className="p-2 border border-border bg-background">
                          <UserCheck className="size-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Submitting as registered client:{" "}
                            <span className="text-primary font-semibold">
                              {profile.fullName || profile.email}
                            </span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Authenticated with {profile.email}. This project request will be
                            automatically linked to your client dashboard.
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className="rounded-none text-[11px] font-mono border-border shrink-0 self-start sm:self-center"
                      >
                        Client UID: {profile.id.slice(0, 8)}…
                      </Badge>
                    </div>
                  ) : (
                    <div className="mb-10 border border-border bg-surface/70 p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 text-foreground">
                            <User className="size-4 text-primary" />
                            <h3 className="text-sm font-medium">VINORA Client Account</h3>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-xl">
                            Have an existing account or want to track project milestones, proposals,
                            and deliverables in real time? Sign in or register. You can also proceed
                            below as a guest.
                          </p>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-none text-xs"
                            onClick={() => handleRedirectToAuth("login")}
                          >
                            Sign In
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-none text-xs"
                            onClick={() => handleRedirectToAuth("register")}
                          >
                            Create Client Account
                          </Button>
                        </div>
                      </div>
                      {draftRestored ? (
                        <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[11px] text-muted-foreground">
                          <span>Draft inputs restored from your previous session.</span>
                          <button
                            type="button"
                            onClick={() => {
                              sessionStorage.removeItem(DRAFT_STORAGE_KEY);
                              setFormData(INITIAL_FORM_STATE);
                              setDraftRestored(false);
                            }}
                            className="hover:text-foreground inline-flex items-center gap-1"
                          >
                            <RotateCcw className="size-3" /> Clear draft
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )
                ) : null}

                <Fieldset legend="About you">
                  <Field
                    label="Name"
                    name="name"
                    value={formData.name}
                    onChange={(val) => handleChange("name", val)}
                    required
                    error={errors.name}
                    autoComplete="name"
                  />
                  <Field
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(val) => handleChange("email", val)}
                    required
                    error={errors.email}
                    autoComplete="email"
                  />
                  <Field
                    label="Business name"
                    name="businessName"
                    value={formData.businessName}
                    onChange={(val) => handleChange("businessName", val)}
                    error={errors.businessName}
                    hint="Optional"
                  />
                </Fieldset>

                <Fieldset legend="About the project">
                  <SelectField
                    label="Service required"
                    name="serviceRequired"
                    value={formData.serviceRequired}
                    onChange={(val) => handleChange("serviceRequired", val)}
                    required
                    error={errors.serviceRequired}
                    options={SERVICE_OPTIONS}
                    placeholder="Select an option"
                    className="sm:col-span-2"
                  />
                  <div className="sm:col-span-2">
                    <Label htmlFor="projectDescription" className="text-sm">
                      Project description <span aria-hidden="true">*</span>
                    </Label>
                    <Textarea
                      id="projectDescription"
                      name="projectDescription"
                      value={formData.projectDescription}
                      onChange={(e) => handleChange("projectDescription", e.target.value)}
                      rows={6}
                      required
                      aria-invalid={Boolean(errors.projectDescription)}
                      aria-describedby={
                        errors.projectDescription ? "projectDescription-error" : undefined
                      }
                      className="mt-2 rounded-none"
                      placeholder="What are you trying to build, and what problem does it solve?"
                    />
                    <FieldError id="projectDescription-error" message={errors.projectDescription} />
                  </div>
                  <Field
                    label="Budget"
                    name="budget"
                    value={formData.budget}
                    onChange={(val) => handleChange("budget", val)}
                    error={errors.budget}
                    hint="Optional — a range is fine"
                  />
                  <Field
                    label="Expected completion date"
                    name="expectedCompletionDate"
                    type="date"
                    value={formData.expectedCompletionDate}
                    onChange={(val) => handleChange("expectedCompletionDate", val)}
                    error={errors.expectedCompletionDate}
                    hint="Optional"
                  />
                  <Field
                    label="Reference websites"
                    name="referenceWebsites"
                    value={formData.referenceWebsites}
                    onChange={(val) => handleChange("referenceWebsites", val)}
                    error={errors.referenceWebsites}
                    hint="Optional — separate multiple links with commas"
                    className="sm:col-span-2"
                  />
                  <SelectField
                    label="Preferred communication"
                    name="preferredCommunication"
                    value={formData.preferredCommunication}
                    onChange={(val) => handleChange("preferredCommunication", val)}
                    required
                    error={errors.preferredCommunication}
                    options={COMMUNICATION_OPTIONS}
                    placeholder="Select an option"
                  />
                  <div className="sm:col-span-2">
                    <Label htmlFor="additionalRequirements" className="text-sm">
                      Additional requirements
                    </Label>
                    <Textarea
                      id="additionalRequirements"
                      name="additionalRequirements"
                      value={formData.additionalRequirements}
                      onChange={(e) => handleChange("additionalRequirements", e.target.value)}
                      rows={4}
                      className="mt-2 rounded-none"
                      placeholder="Anything else we should know?"
                    />
                  </div>
                </Fieldset>

                <Fieldset legend="Attachments">
                  <div className="sm:col-span-2">
                    <Label htmlFor="attachments" className="text-sm">
                      File upload
                    </Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Briefs, logos, documents or references. Files are linked to your secure VINORA
                      project request record.
                    </p>
                    <label
                      htmlFor="attachments"
                      className="mt-3 flex cursor-pointer items-center gap-3 border border-dashed border-border p-5 text-sm transition-colors hover:bg-surface"
                    >
                      <Paperclip
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <span className="min-w-0 truncate text-foreground">
                        {files.length === 0 ? "Choose files" : files.map((f) => f.name).join(", ")}
                      </span>
                    </label>
                    <input
                      id="attachments"
                      name="attachments"
                      type="file"
                      multiple
                      className="sr-only"
                      onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                    />
                  </div>
                </Fieldset>

                {mutation.isError ? (
                  <div
                    role="alert"
                    className="mt-8 flex gap-3 border border-destructive/40 bg-destructive/10 p-5"
                  >
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                      aria-hidden="true"
                    />
                    <div className="text-sm">
                      <p className="font-medium text-destructive">
                        Your project enquiry could not be saved.
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {mutation.error instanceof Error
                          ? mutation.error.message
                          : "A database error occurred. Please verify your connection and try again."}
                      </p>
                    </div>
                  </div>
                ) : null}

                <div className="mt-10 flex flex-wrap items-center gap-4">
                  <Button
                    type="submit"
                    size="lg"
                    className="rounded-none px-8"
                    disabled={mutation.isPending}
                  >
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" /> Saving Requirement…
                      </>
                    ) : (
                      "Submit project enquiry"
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">Fields marked * are required.</p>
                </div>
              </form>
            )}
          </div>

          <aside className="lg:sticky lg:top-28 lg:self-start">
            <div className="border border-border bg-surface p-7">
              <h2 className="text-base font-medium">What happens next</h2>
              <ol className="mt-5 space-y-4 text-sm text-muted-foreground">
                <li>01 — VINORA reviews your requirement.</li>
                <li>02 — We contact you to clarify anything unclear.</li>
                <li>03 — You receive a proposal with scope, timeline and price.</li>
                <li>04 — Work begins after approval and the agreed payment.</li>
              </ol>
              <p className="mt-6 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">
                Submitting an enquiry costs nothing and commits you to nothing.
              </p>
            </div>
          </aside>
        </div>
      </Section>

      {/* Guest vs Account Submission Dialog */}
      <Dialog open={showAuthChoiceModal} onOpenChange={setShowAuthChoiceModal}>
        <DialogContent className="max-w-md rounded-none border-border bg-background p-6">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg font-light tracking-wide text-foreground">
              Submit Project Requirement
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              You are currently submitting as a visitor ({pendingPayload?.email}). Choose how you
              would like to submit:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            {/* Option A: Link with Client Account */}
            <div className="border border-border bg-surface p-4 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Recommended: Link to Client Account
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Sign in or register to track project status in real-time, approve proposals, and
                exchange assets directly from your client portal. Your form inputs are saved.
              </p>
              <div className="pt-2 flex flex-wrap gap-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-none text-xs"
                  onClick={() => handleRedirectToAuth("login")}
                >
                  Sign In
                </Button>
                <Button
                  size="sm"
                  className="rounded-none text-xs"
                  onClick={() => handleRedirectToAuth("register")}
                >
                  Create Client Account
                </Button>
              </div>
            </div>

            {/* Option B: Continue as Guest */}
            <div className="border border-border bg-background p-4 space-y-2.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Alternative: Continue as Guest
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Submit now without an account. VINORA will receive your requirements immediately and
                reply directly to <strong>{pendingPayload?.email}</strong>.
              </p>
              <Button
                size="sm"
                variant="secondary"
                className="w-full rounded-none text-xs"
                onClick={handleProceedAsGuest}
              >
                Continue &amp; Submit as Guest
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SiteLayout>
  );
}

// -------------------------------------------------------------
// Success Confirmation Component
// -------------------------------------------------------------
function SuccessConfirmation({
  request,
  copied,
  onCopy,
  onReset,
  onNavigateClient,
  onNavigateRegister,
  onNavigateLogin,
}: {
  request: ProjectRequest;
  copied: boolean;
  onCopy: (id: string) => void;
  onReset: () => void;
  onNavigateClient: () => void;
  onNavigateRegister: () => void;
  onNavigateLogin: () => void;
}) {
  return (
    <div className="border border-border bg-surface p-8 sm:p-10">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-7 text-foreground shrink-0" />
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Submission Confirmed
          </span>
          <h2 className="text-xl font-serif font-light text-foreground sm:text-2xl">
            Project Enquiry Submitted
          </h2>
        </div>
      </div>

      {/* Prominent success notification with exact requested message */}
      <div className="mt-6 border border-foreground/30 bg-background p-5 sm:p-6 shadow-xs">
        <p className="text-sm sm:text-base font-medium text-foreground leading-relaxed">
          Your project enquiry has been submitted successfully! Please create your account or log in
          to your existing account to view your project and follow the next steps.
        </p>
      </div>

      {/* Details Box */}
      <div className="mt-8 border border-border bg-background p-6 grid gap-5 sm:grid-cols-2">
        <div>
          <span className="text-xs text-muted-foreground">Inquiry Reference</span>
          <div className="mt-1.5 flex items-center gap-2">
            <code className="text-xs font-mono font-medium text-foreground bg-surface px-2.5 py-1 border border-border">
              {request.id}
            </code>
            <button
              type="button"
              onClick={() => onCopy(request.id)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 border border-border bg-surface px-2 py-1 transition-colors"
            >
              {copied ? <Check className="size-3 text-foreground" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div>
          <span className="text-xs text-muted-foreground">Initial Status</span>
          <div className="mt-1.5">
            <Badge
              variant="outline"
              className="rounded-none bg-foreground/10 text-foreground border-foreground/30 font-medium text-xs px-2.5 py-0.5"
            >
              {request.status}
            </Badge>
          </div>
        </div>

        <div>
          <span className="text-xs text-muted-foreground">Service Required</span>
          <p className="mt-1 text-sm font-medium text-foreground">{request.serviceRequired}</p>
        </div>

        <div>
          <span className="text-xs text-muted-foreground">Client Association</span>
          <p className="mt-1 text-sm font-medium text-foreground">
            {request.clientId ? (
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <UserCheck className="size-3.5" /> Linked to Client Account
              </span>
            ) : (
              <span className="text-muted-foreground">Visitor Request (Guest)</span>
            )}
          </p>
        </div>

        <div className="sm:col-span-2 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">Preferred Reply Method</span>
          <p className="mt-1 text-sm text-foreground">
            {request.preferredCommunication} to <strong>{request.email}</strong>
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-border pt-6">
        <h3 className="text-sm font-medium text-foreground">What happens next</h3>
        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
          A VINORA solutions architect will review your technical specifications, budget, and
          timeline. You will receive an initial response within 24 business hours.
        </p>
      </div>

      {/* Two dedicated functional buttons: Create Account & Client Login */}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Button onClick={onNavigateRegister} className="cta-accent rounded-none px-7 py-2.5">
          Create Account <ArrowRight className="ml-2 size-4" />
        </Button>

        <Button
          variant="outline"
          onClick={onNavigateLogin}
          className="rounded-none border-foreground/30 bg-background px-7 py-2.5 hover:bg-surface"
        >
          Client Login <ArrowRight className="ml-2 size-4" />
        </Button>

        {request.clientId ? (
          <Button variant="ghost" onClick={onNavigateClient} className="rounded-none px-4 text-xs">
            View Client Portal
          </Button>
        ) : null}

        <Button
          variant="ghost"
          onClick={onReset}
          className="rounded-none px-4 text-xs text-muted-foreground"
        >
          Submit Another Request
        </Button>
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Field Components (Preserving exact layout and styles)
// -------------------------------------------------------------
function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="mb-12 border-t border-border pt-8">
      <legend className="eyebrow pr-4 text-muted-foreground">{legend}</legend>
      <div className="mt-6 grid gap-6 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function FieldError({ id, message }: { id: string; message?: string | undefined }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-xs text-destructive">
      {message}
    </p>
  );
}

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  error,
  hint,
  autoComplete,
  className,
}: {
  label: string;
  name: string;
  value?: string;
  onChange?: (val: string) => void;
  type?: string;
  required?: boolean;
  error?: string | undefined;
  hint?: string | undefined;
  autoComplete?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name} className="text-sm">
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className="mt-2 rounded-none"
      />
      {hint && !error ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  error,
  className,
}: {
  label: string;
  name: string;
  value?: string;
  onChange?: (val: string) => void;
  options: readonly string[];
  placeholder: string;
  required?: boolean;
  error?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={className}>
      <Label htmlFor={name} className="text-sm">
        {label} {required ? <span aria-hidden="true">*</span> : null}
      </Label>
      <select
        id={name}
        name={name}
        required={required}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${name}-error` : undefined}
        className="mt-2 h-9 w-full border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <FieldError id={`${name}-error`} message={error} />
    </div>
  );
}
