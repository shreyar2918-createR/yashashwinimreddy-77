import { useState, useEffect, useMemo } from "react";
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getClientReferralCode, subscribeClientReferrals } from "@/services/referralService";
import type { Referral, UserProfile } from "@/lib/types";

interface ClientReferralSectionProps {
  profile: UserProfile;
}

export function ClientReferralSection({ profile }: ClientReferralSectionProps) {
  const [referralCode, setReferralCode] = useState<string>("");
  const [referralLink, setReferralLink] = useState<string>("");
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [shareSuccess, setShareSuccess] = useState<string | null>(null);

  // Initialize or fetch the client's unique referral code
  useEffect(() => {
    if (!profile.id) return;

    getClientReferralCode(profile.id, profile.fullName, profile.email)
      .then((res) => {
        setReferralCode(res.referralCode);
        const origin =
          typeof window !== "undefined" ? window.location.origin : "https://vinora.studio";
        setReferralLink(`${origin}/signup?ref=${res.referralCode}`);
      })
      .catch((err) => {
        console.warn("Could not load referral code:", err);
      });
  }, [profile.id, profile.fullName, profile.email]);

  // Real-time Firestore subscription to this client's referrals
  useEffect(() => {
    if (!profile.id) return;
    setIsLoading(true);

    const unsub = subscribeClientReferrals(
      profile.id,
      (data) => {
        setReferrals(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Referrals subscription error:", err);
        setError("Unable to synchronize referral ledger from Firestore.");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [profile.id]);

  // Copy code to clipboard
  const handleCopyCode = async () => {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Copy full URL to clipboard
  const handleCopyLink = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  // Native share or copy fallback
  const handleShare = async () => {
    if (!referralLink) return;
    const shareData = {
      title: "VINORA Architecture & Engineering Referral",
      text: `Join VINORA using my client invitation code (${referralCode}) for project credits & milestone scoping:`,
      url: referralLink,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        setShareSuccess("Referral link shared successfully!");
        setTimeout(() => setShareSuccess(null), 3000);
        return;
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "AbortError") return;
      }
    }

    // Fallback: Copy to clipboard
    handleCopyLink();
    setShareSuccess("Link copied to clipboard for sharing.");
    setTimeout(() => setShareSuccess(null), 3000);
  };

  // Aggregated referral metrics
  const stats = useMemo(() => {
    let registeredCount = 0;
    let qualifiedCount = 0;
    let rewardedCount = 0;
    let totalCredits = 0;

    for (const r of referrals) {
      const st = (r.status || "").toLowerCase();
      if (st === "registered") registeredCount++;
      else if (st === "qualified") qualifiedCount++;
      else if (st === "rewarded") {
        rewardedCount++;
        totalCredits += Number(r.rewardAmount || 250);
      }
    }

    return {
      totalInvited: referrals.length,
      registeredCount,
      qualifiedCount,
      rewardedCount,
      totalCredits,
    };
  }, [referrals]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-normal tracking-tight">Refer & Earn</h2>
            <span className="border border-border bg-card px-2.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              Client Network
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Invite fellow founders and engineering peers to VINORA. Earn verified architectural
            credits and scoping rewards upon milestone activation.
          </p>
        </div>

        {shareSuccess && (
          <div className="border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="size-3.5" />
            <span>{shareSuccess}</span>
          </div>
        )}
      </div>

      {/* Main Referral Invitation Card */}
      <div className="border border-border bg-surface p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-foreground/[0.03] to-transparent pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Column: Code & Actions */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-2">
              <span className="eyebrow text-muted-foreground flex items-center gap-1.5">
                <Gift className="size-3.5 text-foreground" />
                Your Unique Client Invitation Code
              </span>
              <h3 className="font-display text-xl sm:text-2xl font-normal text-foreground">
                Expand the VINORA Engineering Guild
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every peer who registers with your code receives priority onboarding. Once their
                architecture scope or milestone is commissioned, you both unlock verified project
                credits.
              </p>
            </div>

            {/* Code Box */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 border border-border bg-card px-4 py-3 font-mono text-lg font-bold tracking-widest text-foreground flex items-center justify-between">
                <span>{referralCode || "GENERATING..."}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  disabled={!referralCode}
                  className="text-xs font-sans text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1 transition-colors ml-4"
                  title="Copy Referral Code"
                >
                  {copiedCode ? (
                    <>
                      <Check className="size-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span className="font-mono text-[11px]">Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              <Button
                onClick={handleShare}
                disabled={!referralLink}
                className="rounded-none font-mono text-xs cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-auto py-3 px-5 whitespace-nowrap"
              >
                <Share2 className="size-3.5 mr-2" />
                Share Link
              </Button>
            </div>

            {/* Referral Link Box */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground block">
                Direct Invitation URL
              </label>
              <div className="flex items-center border border-border bg-background px-3 py-2 text-xs font-mono text-muted-foreground">
                <span className="truncate flex-1 text-[11px]">
                  {referralLink || "https://vinora.studio/signup?ref=..."}
                </span>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  disabled={!referralLink}
                  className="ml-3 shrink-0 text-foreground hover:text-muted-foreground cursor-pointer flex items-center gap-1 text-[11px]"
                >
                  {copiedLink ? (
                    <span className="text-emerald-400">Copied</span>
                  ) : (
                    <>
                      <Copy className="size-3" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Reward Banner */}
          <div className="lg:col-span-5 border border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Reward Program
              </span>
              <span className="border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-400 uppercase">
                Active Tier
              </span>
            </div>

            <div className="space-y-1">
              <span className="font-mono text-3xl font-light text-foreground">$250</span>
              <span className="text-xs text-muted-foreground block">
                Architectural Credit per Qualified Client Scope
              </span>
            </div>

            <div className="space-y-2 text-xs text-muted-foreground border-t border-border/60 pt-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="size-3.5 shrink-0 text-emerald-400 mt-0.5" />
                <span>Credited to your VINORA ledger upon milestone initiation.</span>
              </div>
              <div className="flex items-start gap-2">
                <Check className="size-3.5 shrink-0 text-foreground mt-0.5" />
                <span>Applicable towards invoices, retainers, and new engineering sprints.</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Aggregate Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Referred */}
        <div className="border border-border bg-surface p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Total Inbound Peers
          </span>
          <p className="font-display text-2xl font-normal text-foreground">{stats.totalInvited}</p>
          <span className="text-[10px] font-mono text-muted-foreground block">
            Registered via your link
          </span>
        </div>

        {/* Registered */}
        <div className="border border-border bg-surface p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Registered Accounts
          </span>
          <p className="font-display text-2xl font-normal text-blue-400">{stats.registeredCount}</p>
          <span className="text-[10px] font-mono text-muted-foreground block">
            Awaiting project scoping
          </span>
        </div>

        {/* Qualified */}
        <div className="border border-border bg-surface p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Qualified Projects
          </span>
          <p className="font-display text-2xl font-normal text-amber-400">{stats.qualifiedCount}</p>
          <span className="text-[10px] font-mono text-muted-foreground block">
            Under active architecture
          </span>
        </div>

        {/* Rewarded Credits */}
        <div className="border border-border bg-surface p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Earned Credits
          </span>
          <p className="font-display text-2xl font-normal text-emerald-400">
            ${stats.totalCredits.toLocaleString()}
          </p>
          <span className="text-[10px] font-mono text-muted-foreground block">
            {stats.rewardedCount} rewarded milestone(s)
          </span>
        </div>
      </div>

      {/* How It Works Explainer */}
      <div className="border border-border bg-surface p-6 space-y-4">
        <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Attribution Protocol & Qualification Rules
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-muted-foreground">
          <div className="space-y-1.5 border-l border-border pl-4">
            <span className="font-mono text-foreground font-semibold block text-[11px]">
              01. Share Referral Link
            </span>
            <p className="leading-relaxed">
              Send your unique code or URL to peer founders. The referral code is preserved across
              email verification, OTP confirmation, and password creation.
            </p>
          </div>
          <div className="space-y-1.5 border-l border-border pl-4">
            <span className="font-mono text-foreground font-semibold block text-[11px]">
              02. Account Verification
            </span>
            <p className="leading-relaxed">
              When your peer registers, they are linked permanently to your account. Self-referrals
              and duplicate email attributions are blocked automatically.
            </p>
          </div>
          <div className="space-y-1.5 border-l border-border pl-4">
            <span className="font-mono text-foreground font-semibold block text-[11px]">
              03. Milestone Qualification
            </span>
            <p className="leading-relaxed">
              When their scope of work is approved and initial invoice is settled, the referral
              transitions to Qualified and rewards are credited to your profile.
            </p>
          </div>
        </div>
      </div>

      {/* Referral History Ledger */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-medium text-foreground">
            Referral Attribution Ledger
          </h3>
          <span className="font-mono text-xs text-muted-foreground">
            {referrals.length} Record{referrals.length === 1 ? "" : "s"}
          </span>
        </div>

        {error && (
          <div className="border border-destructive/40 bg-destructive/10 p-4 text-xs font-mono text-destructive flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="border border-border bg-surface p-12 text-center">
            <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
            <p className="mt-3 font-mono text-xs text-muted-foreground uppercase tracking-widest">
              Synchronizing referral ledger from Firestore...
            </p>
          </div>
        ) : referrals.length === 0 ? (
          <div className="border border-border bg-surface p-12 text-center">
            <Gift className="size-10 mx-auto text-muted-foreground/30" />
            <h4 className="mt-4 font-display text-lg">No Referrals Yet</h4>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Share your personal link ({referralCode}) with your network. Once colleagues register,
              their status and earned credits will be recorded here in real time.
            </p>
          </div>
        ) : (
          <div className="border border-border bg-surface overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="border-b border-border bg-card font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3.5 sm:px-4">Date</th>
                  <th className="p-3.5 sm:px-4">Referred Peer</th>
                  <th className="p-3.5 sm:px-4">Referral Code</th>
                  <th className="p-3.5 sm:px-4 text-center">Status</th>
                  <th className="p-3.5 sm:px-4 text-right">Reward</th>
                  <th className="p-3.5 sm:px-4 text-right">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {referrals.map((r) => {
                  const st = (r.status || "").toLowerCase();
                  const isRewarded = st === "rewarded";
                  const isQualified = st === "qualified";
                  const isRegistered = st === "registered";
                  const isCancelled = st === "cancelled" || st === "rejected";

                  return (
                    <tr key={r.id} className="hover:bg-card/40 transition-colors">
                      <td className="p-3.5 sm:px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                        {r.createdAt
                          ? new Date(r.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "N/A"}
                      </td>
                      <td className="p-3.5 sm:px-4 font-sans font-medium text-foreground">
                        <div>{r.referredName || "Verified Client"}</div>
                        <div className="font-mono text-[10px] text-muted-foreground">
                          {r.referredEmail
                            ? `${r.referredEmail.slice(0, 3)}***@${r.referredEmail.split("@")[1] || "client"}`
                            : "Private"}
                        </div>
                      </td>
                      <td className="p-3.5 sm:px-4 font-mono text-muted-foreground">
                        {r.referralCode || r.code}
                      </td>
                      <td className="p-3.5 sm:px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-mono uppercase border ${
                            isRewarded
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                              : isQualified
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                                : isRegistered
                                  ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                                  : isCancelled
                                    ? "border-destructive/40 bg-destructive/10 text-destructive line-through"
                                    : "border-border bg-card text-muted-foreground"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              isRewarded
                                ? "bg-emerald-500"
                                : isQualified
                                  ? "bg-amber-500 animate-pulse"
                                  : isRegistered
                                    ? "bg-blue-500"
                                    : isCancelled
                                      ? "bg-destructive"
                                      : "bg-muted-foreground"
                            }`}
                          />
                          {r.status}
                        </span>
                      </td>
                      <td className="p-3.5 sm:px-4 text-right font-mono text-foreground">
                        {isRewarded ? (
                          <span className="text-emerald-400 font-semibold">
                            +${(r.rewardAmount || 250).toLocaleString()} Credit
                          </span>
                        ) : isQualified ? (
                          <span className="text-amber-400">
                            ${(r.rewardAmount || 250).toLocaleString()} (Eligible)
                          </span>
                        ) : isCancelled ? (
                          <span className="text-muted-foreground/60 line-through">None</span>
                        ) : (
                          <span className="text-muted-foreground">
                            ${(r.rewardAmount || 250).toLocaleString()} Pending
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 sm:px-4 text-right text-muted-foreground text-[11px]">
                        {r.completedAt
                          ? new Date(r.completedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : isQualified
                            ? "Milestone In Progress"
                            : isRegistered
                              ? "Awaiting Proposal"
                              : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
