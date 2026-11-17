import { useState, useEffect, useMemo } from "react";
import {
  Gift,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  Users,
  Award,
  Shield,
  CreditCard,
  Ban,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeAllReferrals, updateReferralStatus } from "@/services/referralService";
import type { Referral, CanonicalReferralStatus, RewardType } from "@/lib/types";
import type { AdminRecord } from "@/services/adminAuth";

interface AdminReferralsSectionProps {
  admin: AdminRecord;
}

export function AdminReferralsSection({ admin }: AdminReferralsSectionProps) {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Status Action Modal State
  const [selectedReferral, setSelectedReferral] = useState<Referral | null>(null);
  const [actionType, setActionType] = useState<"qualify" | "reward" | "cancel" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reward Customization Inputs
  const [rewardType, setRewardType] = useState<RewardType>("credit");
  const [rewardAmount, setRewardAmount] = useState<number>(250);
  const [rewardDescription, setRewardDescription] = useState<string>("");
  const [cancellationReason, setCancellationReason] = useState<string>("");

  // Real-time Firestore snapshot for all referrals
  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeAllReferrals(
      (data) => {
        setReferrals(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Admin referrals snapshot error:", err);
        setError("Unable to sync referral records from Firestore.");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // Filtered referrals list
  const filteredReferrals = useMemo(() => {
    return referrals.filter((r) => {
      // Status filter
      if (statusFilter !== "all") {
        if (r.status.toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const codeMatch = (r.referralCode || r.code || "").toLowerCase().includes(q);
        const refName = (r.referrerName || "").toLowerCase().includes(q);
        const refEmail = (r.referrerEmail || "").toLowerCase().includes(q);
        const targetName = (r.referredName || "").toLowerCase().includes(q);
        const targetEmail = (r.referredEmail || "").toLowerCase().includes(q);
        const refUid = (r.referrerUid || "").toLowerCase().includes(q);
        const targetUid = (r.referredClientUid || "").toLowerCase().includes(q);

        if (
          !codeMatch &&
          !refName &&
          !refEmail &&
          !targetName &&
          !targetEmail &&
          !refUid &&
          !targetUid
        ) {
          return false;
        }
      }

      return true;
    });
  }, [referrals, statusFilter, searchQuery]);

  // Financial & referral metrics
  const metrics = useMemo(() => {
    let registeredCount = 0;
    let qualifiedCount = 0;
    let rewardedCount = 0;
    let cancelledCount = 0;
    let totalCreditsDistributed = 0;

    for (const r of referrals) {
      const st = r.status.toLowerCase();
      if (st === "registered") registeredCount++;
      else if (st === "qualified") qualifiedCount++;
      else if (st === "rewarded") {
        rewardedCount++;
        totalCreditsDistributed += Number(r.rewardAmount || 250);
      } else if (st === "cancelled" || st === "rejected") {
        cancelledCount++;
      }
    }

    return {
      total: referrals.length,
      registeredCount,
      qualifiedCount,
      rewardedCount,
      cancelledCount,
      totalCreditsDistributed,
    };
  }, [referrals]);

  // Execute admin action
  const handleExecuteAction = async () => {
    if (!selectedReferral || !actionType) return;
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let targetStatus: "Qualified" | "Rewarded" | "Cancelled";
      if (actionType === "qualify") targetStatus = "Qualified";
      else if (actionType === "reward") targetStatus = "Rewarded";
      else targetStatus = "Cancelled";

      await updateReferralStatus({
        referralId: selectedReferral.id,
        status: targetStatus,
        rewardType: actionType === "reward" ? rewardType : undefined,
        rewardAmount: actionType === "reward" ? Number(rewardAmount) : undefined,
        rewardDescription:
          actionType === "reward" && rewardDescription.trim()
            ? rewardDescription.trim()
            : undefined,
        cancellationReason:
          actionType === "cancel" && cancellationReason.trim()
            ? cancellationReason.trim()
            : undefined,
      });

      setSuccessMessage(
        `Referral ${selectedReferral.referralCode} updated to "${targetStatus}" successfully.`,
      );
      setSelectedReferral(null);
      setActionType(null);
      setCancellationReason("");
      setTimeout(() => setSuccessMessage(null), 6000);
    } catch (err: unknown) {
      console.error("Referral status update failed:", err);
      const msg = err instanceof Error ? err.message : "Failed to update referral.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-normal tracking-tight">Client Referrals</h2>
            <span className="border border-border bg-card px-2.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              Step 18 Roster
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Manage the VINORA client invitation network, audit attribution links, qualify milestone
            scopes, and dispense architectural credits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="border border-border bg-card px-3 py-1 font-mono text-xs">
            Admin: <span className="font-semibold text-foreground">{admin.name}</span>
          </span>
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs font-mono text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-300"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 p-3 text-xs font-mono text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-destructive hover:text-destructive/80"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Inbound */}
        <div className="border border-border bg-card p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Total Referrals
          </span>
          <p className="font-display text-2xl font-normal text-foreground">{metrics.total}</p>
          <span className="text-[10px] font-mono text-muted-foreground">Inbound network</span>
        </div>

        {/* Registered */}
        <div className="border border-border bg-card p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Registered
          </span>
          <p className="font-display text-2xl font-normal text-blue-400">
            {metrics.registeredCount}
          </p>
          <span className="text-[10px] font-mono text-muted-foreground">Awaiting milestone</span>
        </div>

        {/* Qualified */}
        <div className="border border-border bg-card p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Qualified
          </span>
          <p className="font-display text-2xl font-normal text-amber-400">
            {metrics.qualifiedCount}
          </p>
          <span className="text-[10px] font-mono text-muted-foreground">Scope initiated</span>
        </div>

        {/* Rewarded */}
        <div className="border border-border bg-card p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Rewarded Credits
          </span>
          <p className="font-display text-2xl font-normal text-emerald-400">
            ${metrics.totalCreditsDistributed.toLocaleString()}
          </p>
          <span className="text-[10px] font-mono text-muted-foreground">
            {metrics.rewardedCount} granted
          </span>
        </div>

        {/* Cancelled */}
        <div className="border border-border bg-card p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Cancelled / Void
          </span>
          <p className="font-display text-2xl font-normal text-muted-foreground">
            {metrics.cancelledCount}
          </p>
          <span className="text-[10px] font-mono text-muted-foreground">Flagged / voided</span>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search by code, referrer, referred client, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 font-mono text-xs rounded-none bg-card border-border"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { label: "All", value: "all" },
            { label: "Registered", value: "registered" },
            { label: "Qualified", value: "qualified" },
            { label: "Rewarded", value: "rewarded" },
            { label: "Cancelled", value: "cancelled" },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3 py-1 font-mono text-xs border uppercase tracking-wider transition-colors cursor-pointer ${
                statusFilter === tab.value
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Referrals Table */}
      {isLoading ? (
        <div className="border border-border bg-card p-16 text-center">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-3 font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Synchronizing referral registry from Firestore...
          </p>
        </div>
      ) : filteredReferrals.length === 0 ? (
        <div className="border border-border bg-card p-16 text-center">
          <Gift className="size-10 mx-auto text-muted-foreground/30" />
          <h3 className="mt-4 font-display text-lg">No Referrals Matching Filter</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {searchQuery || statusFilter !== "all"
              ? "No referral records matched your search query."
              : "Referrals generated by clients and new account registrations will appear here."}
          </p>
        </div>
      ) : (
        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border bg-background font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3.5 sm:px-4">Date</th>
                <th className="p-3.5 sm:px-4">Code</th>
                <th className="p-3.5 sm:px-4">Referrer (Inviter)</th>
                <th className="p-3.5 sm:px-4">Referred Peer</th>
                <th className="p-3.5 sm:px-4 text-center">Status</th>
                <th className="p-3.5 sm:px-4 text-right">Reward</th>
                <th className="p-3.5 sm:px-4 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredReferrals.map((r) => {
                const st = r.status.toLowerCase();
                const isRewarded = st === "rewarded";
                const isQualified = st === "qualified";
                const isRegistered = st === "registered";
                const isCancelled = st === "cancelled" || st === "rejected";

                return (
                  <tr key={r.id} className="hover:bg-background/40 transition-colors">
                    <td className="p-3.5 sm:px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : "N/A"}
                    </td>

                    <td className="p-3.5 sm:px-4 font-bold text-foreground">
                      <span className="border border-border bg-background px-2 py-0.5">
                        {r.referralCode || r.code}
                      </span>
                    </td>

                    <td className="p-3.5 sm:px-4 font-sans">
                      <div className="font-medium text-foreground">
                        {r.referrerName || "Client"}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {r.referrerEmail || r.referrerUid}
                      </div>
                    </td>

                    <td className="p-3.5 sm:px-4 font-sans">
                      <div className="font-medium text-foreground">
                        {r.referredName || "New Client"}
                      </div>
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {r.referredEmail || r.referredClientUid || "Pending onboarding"}
                      </div>
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

                    <td className="p-3.5 sm:px-4 text-right font-mono">
                      {isRewarded ? (
                        <span className="text-emerald-400 font-semibold">
                          +${(r.rewardAmount || 250).toLocaleString()} Credit
                        </span>
                      ) : isQualified ? (
                        <span className="text-amber-400">
                          ${(r.rewardAmount || 250).toLocaleString()} (Eligible)
                        </span>
                      ) : isCancelled ? (
                        <span className="text-muted-foreground/60 line-through">Voided</span>
                      ) : (
                        <span className="text-muted-foreground">
                          ${(r.rewardAmount || 250).toLocaleString()} Pending
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 sm:px-4 text-right space-x-1 whitespace-nowrap">
                      {!isRewarded && !isCancelled && (
                        <>
                          {!isQualified && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedReferral(r);
                                setActionType("qualify");
                              }}
                              className="rounded-none font-mono text-[10px] h-7 px-2 cursor-pointer bg-amber-500 text-black hover:bg-amber-400"
                              title="Mark referral as Qualified (milestone scope initiated)"
                            >
                              Qualify
                            </Button>
                          )}

                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedReferral(r);
                              setActionType("reward");
                              setRewardAmount(r.rewardAmount || 250);
                              setRewardType(r.rewardType || "credit");
                            }}
                            className="rounded-none font-mono text-[10px] h-7 px-2 cursor-pointer bg-emerald-500 text-black hover:bg-emerald-400"
                            title="Release architectural credit/reward"
                          >
                            Reward
                          </Button>
                        </>
                      )}

                      {!isCancelled && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedReferral(r);
                            setActionType("cancel");
                            setCancellationReason("");
                          }}
                          className="rounded-none font-mono text-[10px] h-7 px-2 cursor-pointer border-border hover:border-destructive hover:text-destructive"
                          title="Cancel/Void referral"
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Action Dialog Modal */}
      {selectedReferral && actionType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg border border-border bg-card p-6 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <span className="eyebrow text-muted-foreground uppercase">
                  Referral Action: {actionType.toUpperCase()}
                </span>
                <h3 className="font-display text-lg font-medium text-foreground">
                  Update Referral {selectedReferral.referralCode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedReferral(null);
                  setActionType(null);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="border border-border bg-background p-3.5 space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Referrer Client:</span>
                  <span className="text-foreground font-semibold">
                    {selectedReferral.referrerName || selectedReferral.referrerUid}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Referred Peer:</span>
                  <span className="text-foreground font-semibold">
                    {selectedReferral.referredName ||
                      selectedReferral.referredEmail ||
                      "New Account"}
                  </span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Current Status:</span>
                  <span className="text-foreground">{selectedReferral.status}</span>
                </div>
              </div>

              {actionType === "qualify" && (
                <div className="space-y-2 text-muted-foreground leading-relaxed">
                  <p>
                    Marking this referral as{" "}
                    <span className="text-amber-400 font-bold">Qualified</span> verifies that the
                    referred client has successfully initiated an architecture project or scoping
                    consultation.
                  </p>
                  <p>The reward will become approved and eligible for final disbursement.</p>
                </div>
              )}

              {actionType === "reward" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-muted-foreground uppercase text-[10px] block mb-1">
                      Reward Type
                    </label>
                    <select
                      value={rewardType}
                      onChange={(e) => setRewardType(e.target.value as RewardType)}
                      className="w-full border border-border bg-background p-2 font-mono text-xs text-foreground focus:outline-none"
                    >
                      <option value="credit">Account Credit (USD)</option>
                      <option value="points">Referral Points</option>
                      <option value="discount">Invoice Discount (%)</option>
                      <option value="custom">Custom Engineering Incentive</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-muted-foreground uppercase text-[10px] block mb-1">
                      Reward Amount / Value
                    </label>
                    <Input
                      type="number"
                      value={rewardAmount}
                      onChange={(e) => setRewardAmount(Number(e.target.value))}
                      className="font-mono text-xs rounded-none bg-background border-border"
                      min={0}
                    />
                  </div>

                  <div>
                    <label className="text-muted-foreground uppercase text-[10px] block mb-1">
                      Reward Note / Ledger Description
                    </label>
                    <Input
                      placeholder="e.g. Q4 Milestone Scoping Release Credit"
                      value={rewardDescription}
                      onChange={(e) => setRewardDescription(e.target.value)}
                      className="font-mono text-xs rounded-none bg-background border-border"
                    />
                  </div>
                </div>
              )}

              {actionType === "cancel" && (
                <div className="space-y-3">
                  <p className="text-destructive leading-relaxed">
                    Voiding a referral prevents any reward distribution. A documented reason is
                    required for the studio audit trail.
                  </p>
                  <div>
                    <label className="text-muted-foreground uppercase text-[10px] block mb-1">
                      Cancellation / Void Reason *
                    </label>
                    <textarea
                      required
                      placeholder="e.g. Self-referral attempt via duplicate organization, or cancelled project proposal."
                      value={cancellationReason}
                      onChange={(e) => setCancellationReason(e.target.value)}
                      className="w-full border border-border bg-background p-2.5 font-mono text-xs text-foreground focus:outline-none min-h-[80px]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedReferral(null);
                  setActionType(null);
                }}
                className="rounded-none font-mono text-xs cursor-pointer"
                disabled={isSubmitting}
              >
                Cancel
              </Button>

              <Button
                size="sm"
                onClick={handleExecuteAction}
                disabled={
                  isSubmitting ||
                  (actionType === "cancel" && !cancellationReason.trim()) ||
                  (actionType === "reward" && rewardAmount <= 0)
                }
                className={`rounded-none font-mono text-xs cursor-pointer ${
                  actionType === "cancel"
                    ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    : actionType === "reward"
                      ? "bg-emerald-500 text-black hover:bg-emerald-400 font-semibold"
                      : "bg-amber-500 text-black hover:bg-amber-400 font-semibold"
                }`}
              >
                {isSubmitting && <Loader2 className="size-3 animate-spin mr-1.5" />}
                Confirm {actionType.toUpperCase()}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
