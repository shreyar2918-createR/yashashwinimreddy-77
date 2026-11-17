import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Instagram,
  Linkedin,
  Loader2,
  Mail,
  RotateCcw,
  Send,
  UserCheck,
} from "lucide-react";
import { useState, useEffect, type FormEvent } from "react";
import { z } from "zod";

import { PageHero, Section, SectionHeading } from "@/components/common/Section";
import { SiteLayout } from "@/components/layout/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CONTACT_DETAILS } from "@/content/site";
import { subscribeToAuth } from "@/services/auth";
import { submitContactMessage, type ContactMessageInput } from "@/services/contact";
import type { UserProfile, ContactSubmission } from "@/lib/types";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact VINORA" },
      {
        name: "description",
        content:
          "Get in touch with VINORA about a project, a partnership or a general business enquiry.",
      },
      { property: "og:title", content: "Contact VINORA" },
      {
        property: "og:description",
        content: "Business enquiries and project conversations start here.",
      },
    ],
  }),
  component: ContactPage,
});

const contactSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(120),
  email: z.string().trim().email("Please enter a valid email address").max(254),
  subject: z.string().trim().max(200).optional(),
  message: z
    .string()
    .trim()
    .min(10, "Please enter a message of at least 10 characters")
    .max(4000, "Message cannot exceed 4000 characters"),
});

type FieldErrors = Partial<Record<keyof z.infer<typeof contactSchema>, string>>;

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

const INITIAL_FORM: FormState = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

const SUBJECT_OPTIONS = [
  "General Inquiry",
  "Business & Partnerships",
  "Specialist Network Application",
  "Press & Media",
  "Technical Consultation",
  "Other",
];

function ContactPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [copiedId, setCopiedId] = useState(false);

  // 1. Observe Authentication State & pre-fill if available
  useEffect(() => {
    const unsubscribe = subscribeToAuth((currentUserProfile) => {
      setProfile(currentUserProfile);
      if (currentUserProfile) {
        setFormData((prev) => ({
          ...prev,
          name: prev.name || currentUserProfile.fullName || "",
          email: prev.email || currentUserProfile.email || "",
        }));
      }
    });

    return () => unsubscribe();
  }, []);

  // 2. Mutation for submitting contact message to Firestore
  const mutation = useMutation({
    mutationFn: (input: ContactMessageInput) => submitContactMessage(input),
  });

  function handleChange(field: keyof FormState, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mutation.isPending) return;

    const parsed = contactSchema.safeParse(formData);

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setErrors(nextErrors);
      const firstField = Object.keys(nextErrors)[0];
      if (firstField) {
        document.querySelector<HTMLElement>(`[name="${firstField}"]`)?.focus();
      }
      return;
    }

    setErrors({});
    mutation.mutate({
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject || "General Inquiry",
      message: parsed.data.message,
    });
  }

  function handleReset() {
    mutation.reset();
    setFormData({
      name: profile?.fullName || "",
      email: profile?.email || "",
      subject: "",
      message: "",
    });
    setErrors({});
  }

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
        eyebrow="Contact"
        title="Talk to VINORA."
        copy="Whether you have a defined brief or a rough idea, the conversation starts the same way — tell us what you want to exist."
      />

      {/* SECTION 1: DIRECT CHANNELS & QUICK ACCESS CARDS */}
      <Section>
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="Direct channels"
              title="Official communication"
              copy="Reach out to the VINORA team directly through our verified channels."
            />
            <dl className="mt-10 divide-y divide-border border-y border-border">
              <div className="grid gap-1 py-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-baseline">
                <dt className="eyebrow text-muted-foreground">Email</dt>
                <dd className="text-sm">
                  <a
                    className="inline-flex items-center gap-2 underline underline-offset-4 hover:text-foreground font-medium"
                    href={`mailto:${CONTACT_DETAILS.email}`}
                  >
                    <Mail className="size-4 text-muted-foreground" />
                    {CONTACT_DETAILS.email}
                  </a>
                </dd>
              </div>

              <div className="grid gap-1 py-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-baseline">
                <dt className="eyebrow text-muted-foreground">LinkedIn</dt>
                <dd className="text-sm">
                  <a
                    className="inline-flex items-center gap-2 underline underline-offset-4 hover:text-foreground font-medium"
                    href="https://www.linkedin.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Linkedin className="size-4 text-muted-foreground" />
                    VINORA
                  </a>
                </dd>
              </div>

              <div className="grid gap-1 py-5 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-baseline">
                <dt className="eyebrow text-muted-foreground">Instagram</dt>
                <dd className="text-sm">
                  <a
                    className="inline-flex items-center gap-2 underline underline-offset-4 hover:text-foreground font-medium"
                    href="https://www.instagram.com/vinora.tech"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Instagram className="size-4 text-muted-foreground" />
                    @vinora.tech
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <div className="grid gap-px self-start border border-border bg-border">
            <article className="bg-background p-9">
              <h2 className="text-xl font-medium">Start a project</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                The fastest route. Submit your requirement through the project enquiry form and
                VINORA will review it and respond with the next step.
              </p>
              <Button asChild className="mt-7 rounded-none px-6">
                <Link to="/start-project">Start Your Project</Link>
              </Button>
            </article>
            <article className="bg-surface p-9">
              <h2 className="text-xl font-medium">Business enquiry</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Partnerships, collaboration, specialist network applications or anything that is not
                a client project. Send your message through our direct contact form below.
              </p>
              <Button asChild variant="outline" className="mt-7 rounded-none px-6">
                <a href="#contact-form">Write a message</a>
              </Button>
            </article>
          </div>
        </div>
      </Section>

      {/* SECTION 2: INTERACTIVE VINORA CONTACT FORM */}
      <Section id="contact-form" className="border-t border-border">
        <div className="grid gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <div>
            <SectionHeading
              eyebrow="Send a message"
              title="Direct contact form"
              copy="Whether you have an enquiry, partnership proposal, or general question, write to us directly. We review and acknowledge every communication."
            />

            <div className="mt-8 border border-border bg-surface p-6 text-xs text-muted-foreground space-y-3">
              <p className="font-medium text-foreground text-sm">Response Standards</p>
              <p className="leading-relaxed">
                • General enquiries receive personal review within 24 business hours.
              </p>
              <p className="leading-relaxed">
                • All business conversations are held in strict commercial confidence.
              </p>
              <p className="leading-relaxed">
                • If you are an active client, your message will automatically associate with your
                registered client account.
              </p>
            </div>
          </div>

          <div>
            {/* SUCCESS VIEW */}
            {mutation.isSuccess && mutation.data ? (
              <SuccessContactCard
                submission={mutation.data}
                copied={copiedId}
                onCopy={handleCopyId}
                onReset={handleReset}
              />
            ) : (
              /* FORM VIEW */
              <form
                onSubmit={handleSubmit}
                noValidate
                className="border border-border bg-surface p-7 sm:p-9"
              >
                {/* Account Status Indicator */}
                {profile ? (
                  <div className="mb-6 border border-border bg-background p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <UserCheck className="size-4 text-primary shrink-0" />
                      <div className="text-xs">
                        <span className="text-muted-foreground">Authenticated: </span>
                        <span className="font-semibold text-foreground">
                          {profile.fullName || profile.email}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-none text-[10px] font-mono border-border shrink-0"
                    >
                      Client ID: {profile.id.slice(0, 8)}…
                    </Badge>
                  </div>
                ) : (
                  <div className="mb-6 flex items-center justify-between border-b border-border pb-4 text-xs text-muted-foreground">
                    <span>Submitting as visitor (Guest)</span>
                    <Link
                      to="/login"
                      search={{ role: "client", mode: "login" }}
                      className="text-primary underline underline-offset-4 hover:text-primary/80"
                    >
                      Sign in with client account
                    </Link>
                  </div>
                )}

                <div className="space-y-6">
                  {/* Name */}
                  <div>
                    <Label htmlFor="contact-name" className="text-sm">
                      Name <span aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="contact-name"
                      name="name"
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange("name", e.target.value)}
                      required
                      autoComplete="name"
                      aria-invalid={Boolean(errors.name)}
                      aria-describedby={errors.name ? "name-error" : undefined}
                      className="mt-2 rounded-none"
                      placeholder="Your name"
                    />
                    {errors.name ? (
                      <p id="name-error" role="alert" className="mt-1.5 text-xs text-destructive">
                        {errors.name}
                      </p>
                    ) : null}
                  </div>

                  {/* Email */}
                  <div>
                    <Label htmlFor="contact-email" className="text-sm">
                      Email address <span aria-hidden="true">*</span>
                    </Label>
                    <Input
                      id="contact-email"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      required
                      autoComplete="email"
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "email-error" : undefined}
                      className="mt-2 rounded-none"
                      placeholder="name@organization.com"
                    />
                    {errors.email ? (
                      <p id="email-error" role="alert" className="mt-1.5 text-xs text-destructive">
                        {errors.email}
                      </p>
                    ) : null}
                  </div>

                  {/* Subject */}
                  <div>
                    <Label htmlFor="contact-subject" className="text-sm">
                      Subject
                    </Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <select
                        id="contact-subject-preset"
                        aria-label="Subject category"
                        value={
                          SUBJECT_OPTIONS.includes(formData.subject) ? formData.subject : "Other"
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          handleChange("subject", val === "Other" ? "" : val);
                        }}
                        className="h-9 w-full border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring"
                      >
                        <option value="" disabled>
                          Select topic
                        </option>
                        {SUBJECT_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                      <Input
                        id="contact-subject"
                        name="subject"
                        type="text"
                        value={formData.subject}
                        onChange={(e) => handleChange("subject", e.target.value)}
                        placeholder="Or custom subject..."
                        className="rounded-none"
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <Label htmlFor="contact-message" className="text-sm">
                      Message <span aria-hidden="true">*</span>
                    </Label>
                    <Textarea
                      id="contact-message"
                      name="message"
                      rows={5}
                      value={formData.message}
                      onChange={(e) => handleChange("message", e.target.value)}
                      required
                      aria-invalid={Boolean(errors.message)}
                      aria-describedby={errors.message ? "message-error" : undefined}
                      className="mt-2 rounded-none"
                      placeholder="Tell us what is on your mind..."
                    />
                    {errors.message ? (
                      <p
                        id="message-error"
                        role="alert"
                        className="mt-1.5 text-xs text-destructive"
                      >
                        {errors.message}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Error Banner */}
                {mutation.isError ? (
                  <div
                    role="alert"
                    className="mt-6 flex gap-3 border border-destructive/40 bg-destructive/10 p-4"
                  >
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-destructive"
                      aria-hidden="true"
                    />
                    <div className="text-xs">
                      <p className="font-medium text-destructive">Submission Failed</p>
                      <p className="mt-1 text-muted-foreground">
                        {mutation.error instanceof Error
                          ? mutation.error.message
                          : "Could not record your message to the database. Please try again."}
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Submit button with duplicate prevention */}
                <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
                  <Button type="submit" className="rounded-none px-7" disabled={mutation.isPending}>
                    {mutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Sending message…
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 size-4" />
                        Send message
                      </>
                    )}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Fields marked * are required
                  </span>
                </div>
              </form>
            )}
          </div>
        </div>
      </Section>
    </SiteLayout>
  );
}

// -------------------------------------------------------------
// Success Confirmation Card
// -------------------------------------------------------------
function SuccessContactCard({
  submission,
  copied,
  onCopy,
  onReset,
}: {
  submission: ContactSubmission;
  copied: boolean;
  onCopy: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="border border-border bg-surface p-7 sm:p-9">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="size-6 text-primary shrink-0" />
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Message Delivered
          </span>
          <h3 className="text-xl font-serif font-light text-foreground">
            Thank you for reaching out
          </h3>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
        Your communication has been saved to the VINORA contact records. Our team will review your
        message and reply to <strong className="text-foreground">{submission.email}</strong>.
      </p>

      <div className="mt-6 border border-border bg-background p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
          <span className="text-xs text-muted-foreground">Submission Reference</span>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono font-medium text-foreground bg-surface px-2 py-0.5 border border-border">
              {submission.id}
            </code>
            <button
              type="button"
              onClick={() => onCopy(submission.id)}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 border border-border bg-surface px-2 py-0.5 transition-colors"
            >
              {copied ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Initial Status</span>
          <Badge
            variant="outline"
            className="rounded-none bg-primary/10 text-primary border-primary/30 font-medium text-[11px] px-2 py-0.5"
          >
            {submission.status}
          </Badge>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Subject</span>
          <span className="font-medium text-foreground">
            {submission.subject || "General Inquiry"}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Account Link</span>
          {submission.userId ? (
            <span className="text-primary font-medium inline-flex items-center gap-1">
              <UserCheck className="size-3.5" /> Client Account Associated
            </span>
          ) : (
            <span className="text-muted-foreground">Guest Submission</span>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={onReset} className="rounded-none text-xs">
          <RotateCcw className="mr-2 size-3.5" />
          Send another message
        </Button>
        <Button asChild className="rounded-none text-xs">
          <Link to="/start-project">
            Start a project instead <ArrowRight className="ml-2 size-3.5" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
