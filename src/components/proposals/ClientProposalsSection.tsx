import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  X,
  Calendar,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  Loader2,
  FileCheck2,
  FileX2,
  ArrowRight,
  Layers,
  HelpCircle,
  ExternalLink,
  CreditCard,
  Receipt,
  Sparkles,
  Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { subscribeClientProposals, respondToProposal } from "@/services/proposalService";
import { subscribeClientInvoices, normalizeInvoiceDoc } from "@/services/invoiceService";
import { launchRazorpayCheckout } from "@/services/paymentService";
import type {
  Proposal,
  CanonicalProposalStatus,
  UserProfile,
  Invoice,
  ProposalBudgetItem,
  ProposalMilestonePlanItem,
} from "@/lib/types";

interface ClientProposalsSectionProps {
  profile: UserProfile;
}

export function ClientProposalsSection({ profile }: ClientProposalsSectionProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Detailed Proposal Modal
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);

  // Confirmation Modal State (Accept / Reject)
  const [confirmModal, setConfirmModal] = useState<{
    proposal: Proposal;
    action: "Accepted" | "Rejected";
  } | null>(null);
  const [clientNote, setClientNote] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [responseSuccess, setResponseSuccess] = useState<string | null>(null);
  const [responseError, setResponseError] = useState<string | null>(null);

  // Settlement & Razorpay Checkout Modal State
  const [settlementProposal, setSettlementProposal] = useState<Proposal | null>(null);
  const [isPayingRazorpay, setIsPayingRazorpay] = useState(false);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Subscribe to real-time proposals for this authenticated client
  useEffect(() => {
    if (!profile.id) return;
    setIsLoading(true);

    const unsub = subscribeClientProposals(
      profile.id,
      (data) => {
        setProposals(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Client proposals subscription error:", err);
        setError("Unable to sync project proposals from Firestore.");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [profile.id]);

  // Subscribe to real-time invoices for this client to link with proposals
  useEffect(() => {
    if (!profile.id) return;
    const unsub = subscribeClientInvoices(profile.id, (data) => {
      setInvoices(data);
    });
    return () => unsub();
  }, [profile.id]);

  // Handle Accept/Reject action
  const handleConfirmResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmModal) return;

    setIsResponding(true);
    setResponseError(null);

    try {
      const targetProp = confirmModal.proposal;
      const decision = confirmModal.action;

      await respondToProposal({
        proposalId: targetProp.id,
        clientUid: profile.id,
        decision,
        feedback: clientNote.trim() || undefined,
      });

      if (decision === "Accepted") {
        setResponseSuccess(
          `Proposal "${targetProp.title}" has been successfully Accepted! Proceed to complete the initial payment to commence sprint kickoff.`,
        );
        // Automatically prompt for settlement
        setSettlementProposal(targetProp);
      } else {
        setResponseSuccess(
          `Proposal "${targetProp.title}" was Declined. Our architecture team has been notified.`,
        );
      }

      // Close confirm and view modals
      setConfirmModal(null);
      setSelectedProposal(null);
      setClientNote("");
    } catch (err: unknown) {
      console.error("Proposal response error:", err);
      setResponseError(err instanceof Error ? err.message : "Failed to record your decision.");
    } finally {
      setIsResponding(false);
    }
  };

  // Triggers Razorpay Checkout for a proposal's initial settlement
  const handleInitiatePayment = async (proposal: Proposal) => {
    setPaymentError(null);
    setPaymentSuccessMessage(null);
    setIsPayingRazorpay(true);

    try {
      // Find matching invoice by invoiceId or client invoices
      let targetInvoice: Invoice | null = null;

      if (proposal.invoiceId) {
        // Find in loaded invoices or fetch directly
        targetInvoice = invoices.find((inv) => inv.id === proposal.invoiceId) || null;
        if (!targetInvoice) {
          const invSnap = await getDoc(doc(db, "invoices", proposal.invoiceId));
          if (invSnap.exists()) {
            targetInvoice = normalizeInvoiceDoc(invSnap.id, invSnap.data());
          }
        }
      }

      // Fallback: search client invoices by project or proposal title
      if (!targetInvoice) {
        targetInvoice =
          invoices.find(
            (inv) =>
              (proposal.projectName && inv.projectName === proposal.projectName) ||
              inv.notes?.includes(proposal.title || ""),
          ) || null;
      }

      // Fallback 2: first payable invoice for this client with balance
      if (!targetInvoice) {
        targetInvoice =
          invoices.find((inv) => inv.balanceDue > 0 && inv.status !== "Cancelled") || null;
      }

      if (!targetInvoice) {
        throw new Error(
          "Initial settlement invoice is being prepared by our studio team. Please check the Invoices section or contact your project lead.",
        );
      }

      // Launch Razorpay Checkout
      await launchRazorpayCheckout(
        targetInvoice,
        {
          uid: profile.id,
          name: profile.fullName,
          email: profile.email,
        },
        (result) => {
          setIsPayingRazorpay(false);
          setPaymentSuccessMessage(
            `Payment of ${targetInvoice?.currency || "INR"} ${result.amountPaid.toLocaleString()} verified successfully! (Ref: ${result.razorpayPaymentId}). Sprint kickoff has been initiated.`,
          );
          setSettlementProposal(null);
        },
        (payErr) => {
          setIsPayingRazorpay(false);
          setPaymentError(payErr.message || "Payment process could not be completed.");
        },
        () => {
          setIsPayingRazorpay(false);
        },
      );
    } catch (err: unknown) {
      setIsPayingRazorpay(false);
      setPaymentError(err instanceof Error ? err.message : "Failed to initialize payment gateway.");
    }
  };

  const filteredProposals = proposals.filter((p) => {
    if (statusFilter === "all") return true;
    return p.status.toLowerCase() === statusFilter.toLowerCase();
  });

  const pendingCount = proposals.filter((p) => p.status === "Pending").length;
  const acceptedCount = proposals.filter((p) => p.status === "Accepted").length;

  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime())
        ? dateStr
        : d.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: CanonicalProposalStatus | string) => {
    switch (status) {
      case "Accepted":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="size-3" />
            Accepted & Confirmed
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-destructive/10 text-destructive border border-destructive/30">
            <X className="size-3" />
            Declined
          </span>
        );
      case "Withdrawn":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-muted text-muted-foreground border border-border">
            <Clock className="size-3" />
            Withdrawn by Studio
          </span>
        );
      case "Expired":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-amber-500/10 text-amber-500 border border-amber-500/30">
            <Clock className="size-3" />
            Validity Expired
          </span>
        );
      case "Pending":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="size-3 animate-pulse" />
            Action Required
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (payStatus?: string) => {
    switch (payStatus) {
      case "Fully Paid":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="size-3" />
            Fully Settled
          </span>
        );
      case "Advance Paid":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Receipt className="size-3" />
            Advance Settled
          </span>
        );
      case "Partially Paid":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="size-3" />
            Partially Paid
          </span>
        );
      case "Unpaid":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono bg-surface text-muted-foreground border border-border">
            Settlement Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">
            Commercial Proposals & Project Budgets
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Review detailed technical specifications, itemized project budget breakdown, and staged
            milestone payment plans.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs border border-border bg-card px-3 py-1 text-muted-foreground">
            Total Proposals: <strong className="text-foreground">{proposals.length}</strong>
          </span>
        </div>
      </div>

      {/* Global Success Notification */}
      {responseSuccess && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-400 flex items-start gap-3">
          <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{responseSuccess}</p>
          </div>
          <button
            type="button"
            onClick={() => setResponseSuccess(null)}
            className="font-mono text-[11px] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Payment Success Notification */}
      {paymentSuccessMessage && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-400 flex items-start gap-3">
          <ShieldCheck className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">{paymentSuccessMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => setPaymentSuccessMessage(null)}
            className="font-mono text-[11px] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {(error || paymentError) && (
        <div className="border border-destructive/30 bg-destructive/10 p-4 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error || paymentError}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null);
              setPaymentError(null);
            }}
            className="h-7 text-xs font-mono"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/80 pb-3">
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "All Proposals", count: proposals.length },
            { id: "pending", label: "Action Required", count: pendingCount },
            { id: "accepted", label: "Accepted", count: acceptedCount },
            {
              id: "rejected",
              label: "Declined",
              count: proposals.filter((p) => p.status === "Rejected").length,
            },
            {
              id: "withdrawn",
              label: "Withdrawn / Expired",
              count: proposals.filter((p) => p.status === "Withdrawn" || p.status === "Expired")
                .length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id
                  ? "bg-foreground text-background font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 ${
                    statusFilter === tab.id
                      ? "bg-background text-foreground"
                      : "bg-surface border border-border"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="text-[11px] font-mono text-muted-foreground">
          Showing {filteredProposals.length} of {proposals.length} proposals
        </div>
      </div>

      {/* Proposals List */}
      {isLoading ? (
        <div className="border border-border bg-surface p-12 text-center space-y-3">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Loading proposals from Firestore...
          </p>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="border border-border bg-surface p-12 text-center space-y-3">
          <FileText className="size-10 mx-auto text-muted-foreground/40" />
          <h3 className="font-display text-base font-semibold">No Proposals Found</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            {statusFilter !== "all"
              ? `You currently have no proposals in "${statusFilter}" status.`
              : "When VINORA generates a tailored commercial proposal and itemized project budget for your engagement, it will be securely published here for your review and formal signature."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredProposals.map((proposal) => {
            const isPending = proposal.status === "Pending";
            const isAccepted = proposal.status === "Accepted";
            const currSymbol = proposal.currency === "INR" ? "₹" : proposal.currency;
            const isMilestonePlan = proposal.paymentPlanType === "milestone";

            return (
              <div
                key={proposal.id}
                className="border border-border bg-card p-5 sm:p-7 transition-all hover:border-foreground/30 space-y-5"
              >
                {/* Top Row: Title, Project tag, Plan tag, Status Badges */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-border/60 pb-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-display text-lg font-semibold text-foreground">
                        {proposal.title}
                      </h3>
                      {proposal.projectTitle && (
                        <span className="font-mono text-[10px] px-2 py-0.5 border border-border bg-surface text-muted-foreground">
                          Project: {proposal.projectTitle}
                        </span>
                      )}
                      <span className="font-mono text-[10px] px-2 py-0.5 border border-border bg-surface text-muted-foreground">
                        Plan: {isMilestonePlan ? "Milestone Schedule" : "100% Full Payment"}
                      </span>
                      {proposal.invoiceNumber && (
                        <span className="font-mono text-[10px] px-2 py-0.5 border border-sky-500/30 bg-sky-500/10 text-sky-400">
                          Invoice: #{proposal.invoiceNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-sans line-clamp-2 leading-relaxed">
                      {proposal.scope}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {getStatusBadge(proposal.status)}
                    {getPaymentStatusBadge(proposal.paymentStatus)}
                  </div>
                </div>

                {/* Key Financial & Schedule Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  {/* Total Amount */}
                  <div className="border border-border/70 bg-surface/50 p-3 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                      Total Project Cost
                    </span>
                    <span className="font-display text-base font-bold text-foreground">
                      {currSymbol} {proposal.totalPrice.toLocaleString()}
                    </span>
                  </div>

                  {/* Advance / Due */}
                  <div className="border border-border/70 bg-surface/50 p-3 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                      {isMilestonePlan ? "Milestone 1 Advance" : "Full Amount Due"}
                    </span>
                    <span className="font-medium text-foreground">
                      {currSymbol}{" "}
                      {(proposal.advanceAmount || proposal.totalPrice).toLocaleString()}
                    </span>
                  </div>

                  {/* Estimated Delivery */}
                  <div className="border border-border/70 bg-surface/50 p-3 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                      Target Schedule
                    </span>
                    <span className="font-medium text-foreground truncate block">
                      {proposal.timeline || "6-8 Week Sprint"}
                    </span>
                  </div>

                  {/* Validity Date */}
                  <div className="border border-border/70 bg-surface/50 p-3 space-y-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                      Valid Until
                    </span>
                    <span className="font-medium text-foreground flex items-center gap-1.5">
                      <Calendar className="size-3.5 text-muted-foreground" />
                      {formatDateDisplay(proposal.validityDate)}
                    </span>
                  </div>
                </div>

                {/* Read-Only Project Budget Breakdown Preview */}
                {proposal.budgetItems && proposal.budgetItems.length > 0 && (
                  <div className="border border-border bg-surface/30 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                        Project Budget Breakdown ({proposal.budgetItems.length} Line Items)
                      </span>
                      <span className="text-[10px] font-mono text-muted-foreground italic">
                        Budget is established by VINORA (Read-Only)
                      </span>
                    </div>

                    <div className="border border-border bg-background divide-y divide-border text-xs font-mono">
                      {proposal.budgetItems.map((item, idx) => (
                        <div
                          key={item.id || idx}
                          className="p-2.5 flex items-center justify-between"
                        >
                          <span className="text-foreground">{item.description}</span>
                          <span className="font-semibold text-foreground">
                            {currSymbol} {item.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}

                      <div className="p-2.5 flex items-center justify-between bg-surface font-display text-xs font-bold text-foreground">
                        <span>TOTAL PROJECT COST</span>
                        <span>
                          {currSymbol} {proposal.totalPrice.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Plan Milestone Preview */}
                {isMilestonePlan && proposal.milestonePlan && proposal.milestonePlan.length > 0 && (
                  <div className="border border-border bg-surface/30 p-4 space-y-2.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                      Staged Milestone Settlement Schedule
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {proposal.milestonePlan.map((m, idx) => (
                        <div
                          key={m.id || idx}
                          className="border border-border bg-background p-3 space-y-1.5 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-foreground truncate block">
                              {m.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {m.percentage}%
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-foreground">
                            {currSymbol} {m.amount.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            Trigger: {m.dueTrigger || "Sprint sign-off"}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Client Response feedback if completed */}
                {proposal.clientResponse && (
                  <div
                    className={`p-3 text-xs border ${
                      isAccepted
                        ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                        : "border-destructive/20 bg-destructive/5 text-destructive"
                    }`}
                  >
                    <span className="font-mono text-[10px] font-semibold uppercase block mb-0.5">
                      Client Recorded Decision ({formatDateDisplay(proposal.responseAt)}):
                    </span>
                    <p className="text-foreground">{proposal.clientResponse}</p>
                  </div>
                )}

                {/* Footer Bar & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2 text-xs">
                  <div className="text-[11px] font-mono text-muted-foreground">
                    Prepared by {proposal.createdByAdminName || "Lead Architect"} • Ref: #
                    {proposal.id.slice(0, 8)}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* View Full Scope & Budget Modal Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedProposal(proposal)}
                      className="rounded-none cursor-pointer font-mono text-xs h-8 px-3"
                    >
                      <FileText className="size-3.5 mr-1.5" />
                      Review Full Proposal & Budget
                    </Button>

                    {/* Action buttons if Pending */}
                    {isPending && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            setConfirmModal({ proposal, action: "Accepted" });
                            setClientNote("");
                            setResponseError(null);
                          }}
                          className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs h-8 px-3"
                        >
                          <Check className="size-3.5 mr-1.5" />
                          Accept Proposal
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setConfirmModal({ proposal, action: "Rejected" });
                            setClientNote("");
                            setResponseError(null);
                          }}
                          className="rounded-none cursor-pointer font-mono text-xs h-8 px-2.5 text-destructive hover:bg-destructive/10"
                        >
                          <X className="size-3.5 mr-1" />
                          Decline
                        </Button>
                      </>
                    )}

                    {/* Action button if Accepted and payment is pending */}
                    {isAccepted && proposal.paymentStatus !== "Fully Paid" && (
                      <Button
                        size="sm"
                        onClick={() => handleInitiatePayment(proposal)}
                        disabled={isPayingRazorpay}
                        className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs h-8 px-3.5 shadow-xs"
                      >
                        {isPayingRazorpay ? (
                          <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        ) : (
                          <CreditCard className="size-3.5 mr-1.5" />
                        )}
                        Pay {isMilestonePlan ? "Milestone 1 Advance" : "Full Settlement"} (
                        {currSymbol}{" "}
                        {(proposal.advanceAmount || proposal.totalPrice).toLocaleString()})
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: FULL PROPOSAL & BUDGET REVIEW MODAL                              */}
      {/* ========================================================================= */}
      {selectedProposal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <div className="border border-border bg-card max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                  VINORA Commercial Architecture Proposal
                </span>
                <h3 className="font-display text-xl font-semibold text-foreground mt-0.5">
                  {selectedProposal.title}
                </h3>
                <p className="font-mono text-xs text-muted-foreground mt-0.5">
                  Ref #{selectedProposal.id} • Issued{" "}
                  {formatDateDisplay(selectedProposal.createdAt)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedProposal(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Status & Validity */}
            <div className="flex items-center justify-between border border-border bg-surface p-3 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Status:</span>
                {getStatusBadge(selectedProposal.status)}
                {getPaymentStatusBadge(selectedProposal.paymentStatus)}
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="size-3.5" />
                <span>Valid Until: {formatDateDisplay(selectedProposal.validityDate)}</span>
              </div>
            </div>

            {/* Scope / Description */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Scope of Work & Architectural Strategy
              </h4>
              <div className="border border-border bg-surface/50 p-4 text-xs font-sans leading-relaxed text-foreground whitespace-pre-line">
                {selectedProposal.scope}
              </div>
            </div>

            {/* Deliverables List */}
            {selectedProposal.deliverables && selectedProposal.deliverables.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Committed Technical Deliverables
                </h4>
                <div className="border border-border bg-surface/50 p-4 space-y-2">
                  {selectedProposal.deliverables.map((del, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs text-foreground">
                      <Check className="size-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>{del}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ITEMISED PROJECT BUDGET BREAKDOWN (READ-ONLY) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Project Budget Breakdown
                </h4>
                <span className="text-[10px] font-mono text-muted-foreground italic">
                  Read-Only (Prepared by VINORA Studio)
                </span>
              </div>

              <div className="border border-border bg-surface/50 divide-y divide-border text-xs font-mono">
                {(
                  selectedProposal.budgetItems || [
                    {
                      id: "1",
                      description: selectedProposal.title || "Full Project Scope",
                      amount: selectedProposal.totalPrice,
                    },
                  ]
                ).map((item, idx) => (
                  <div key={item.id || idx} className="p-3 flex items-center justify-between">
                    <span className="text-foreground">{item.description}</span>
                    <span className="font-semibold text-foreground">
                      {selectedProposal.currency === "INR" ? "₹" : selectedProposal.currency}{" "}
                      {item.amount.toLocaleString()}
                    </span>
                  </div>
                ))}

                <div className="p-3 flex items-center justify-between bg-surface font-display text-sm font-bold text-foreground">
                  <span>TOTAL PROJECT COST</span>
                  <span>
                    {selectedProposal.currency === "INR" ? "₹" : selectedProposal.currency}{" "}
                    {selectedProposal.totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* PAYMENT PLAN */}
            <div className="space-y-2">
              <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                Payment Plan (
                {selectedProposal.paymentPlanType === "milestone"
                  ? "Milestone Schedule"
                  : "100% Full Payment"}
                )
              </h4>

              {selectedProposal.paymentPlanType === "milestone" &&
              selectedProposal.milestonePlan ? (
                <div className="border border-border bg-surface/50 divide-y divide-border text-xs font-mono">
                  {selectedProposal.milestonePlan.map((m, idx) => (
                    <div key={m.id || idx} className="p-3 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="font-medium text-foreground block">{m.name}</span>
                        <span className="text-[10px] text-muted-foreground block">
                          Due: {m.dueTrigger || "Sprint sign-off"}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-foreground block">
                          {selectedProposal.currency === "INR" ? "₹" : selectedProposal.currency}{" "}
                          {m.amount.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          {m.percentage}% allocation
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-border bg-surface/50 p-3.5 flex items-center justify-between text-xs font-mono">
                  <div>
                    <span className="font-medium text-foreground block">
                      100% Full Upfront Settlement
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      Payable upon contract signing
                    </span>
                  </div>
                  <span className="font-bold font-display text-sm text-foreground">
                    {selectedProposal.currency === "INR" ? "₹" : selectedProposal.currency}{" "}
                    {selectedProposal.totalPrice.toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* Revisions & Terms */}
            {selectedProposal.revisions && (
              <div className="space-y-1">
                <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Revision Information
                </h4>
                <p className="border border-border bg-surface/30 p-3 text-xs leading-relaxed text-muted-foreground font-sans">
                  {selectedProposal.revisions}
                </p>
              </div>
            )}

            {selectedProposal.terms && (
              <div className="space-y-1">
                <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  Terms of Agreement
                </h4>
                <p className="border border-border bg-surface/30 p-3 text-xs leading-relaxed text-muted-foreground font-sans">
                  {selectedProposal.terms}
                </p>
              </div>
            )}

            {/* Action Bar inside review modal */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedProposal(null)}
                className="rounded-none cursor-pointer h-9 text-xs font-mono"
              >
                Close
              </Button>

              {selectedProposal.status === "Pending" && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setConfirmModal({ proposal: selectedProposal, action: "Rejected" });
                    }}
                    className="rounded-none cursor-pointer text-destructive hover:bg-destructive/10 h-9 text-xs font-mono"
                  >
                    Decline
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setConfirmModal({ proposal: selectedProposal, action: "Accepted" });
                    }}
                    className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-9 text-xs font-mono px-4"
                  >
                    <Check className="size-3.5 mr-1.5" />
                    Accept Proposal
                  </Button>
                </>
              )}

              {selectedProposal.status === "Accepted" &&
                selectedProposal.paymentStatus !== "Fully Paid" && (
                  <Button
                    size="sm"
                    onClick={() => handleInitiatePayment(selectedProposal)}
                    disabled={isPayingRazorpay}
                    className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-9 text-xs font-mono px-4"
                  >
                    {isPayingRazorpay ? (
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                    ) : (
                      <CreditCard className="size-3.5 mr-1.5" />
                    )}
                    Pay via Razorpay
                  </Button>
                )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMATION MODAL (ACCEPT / REJECT)                             */}
      {/* ========================================================================= */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="border border-border bg-card max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                {confirmModal.action === "Accepted" ? (
                  <CheckCircle2 className="size-5 text-emerald-400" />
                ) : (
                  <X className="size-5 text-destructive" />
                )}
                <h3 className="font-display text-base font-semibold">
                  {confirmModal.action === "Accepted"
                    ? "Confirm Acceptance of Proposal"
                    : "Decline Proposal"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isResponding) setConfirmModal(null);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {responseError && (
              <div className="border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {responseError}
              </div>
            )}

            <form onSubmit={handleConfirmResponse} className="space-y-4 text-xs">
              <p className="text-muted-foreground leading-relaxed">
                {confirmModal.action === "Accepted" ? (
                  <>
                    You are formally accepting{" "}
                    <strong className="text-foreground">"{confirmModal.proposal.title}"</strong> for
                    a total project cost of{" "}
                    <strong className="text-foreground">
                      {confirmModal.proposal.currency === "INR"
                        ? "₹"
                        : confirmModal.proposal.currency}{" "}
                      {confirmModal.proposal.totalPrice.toLocaleString()}
                    </strong>
                    . Upon confirmation, you will be prompted to complete the initial payment (
                    <strong className="text-foreground">
                      {confirmModal.proposal.currency === "INR"
                        ? "₹"
                        : confirmModal.proposal.currency}{" "}
                      {(
                        confirmModal.proposal.advanceAmount || confirmModal.proposal.totalPrice
                      ).toLocaleString()}
                    </strong>
                    ) via Razorpay to initiate project sprint commencement.
                  </>
                ) : (
                  <>
                    Are you sure you wish to decline{" "}
                    <strong className="text-foreground">"{confirmModal.proposal.title}"</strong>?
                    Our engineering leads will be alerted to discuss scope adjustments or
                    alternative options.
                  </>
                )}
              </p>

              <div className="space-y-1.5">
                <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                  {confirmModal.action === "Accepted"
                    ? "Optional Confirmation Note / Kickoff Instructions"
                    : "Reason for Declining (Optional feedback for our architects)"}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    confirmModal.action === "Accepted"
                      ? "e.g. Approved. Let's aim to start sprint 1 next Monday."
                      : "e.g. Budget timeline shifted, or would like to revisit scope..."
                  }
                  value={clientNote}
                  onChange={(e) => setClientNote(e.target.value)}
                  className="w-full border border-border bg-background p-2.5 text-xs text-foreground focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isResponding}
                  onClick={() => setConfirmModal(null)}
                  className="rounded-none cursor-pointer h-8 text-xs font-mono"
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  disabled={isResponding}
                  size="sm"
                  className={`rounded-none cursor-pointer h-8 text-xs font-mono ${
                    confirmModal.action === "Accepted"
                      ? "bg-foreground text-background hover:bg-foreground/90"
                      : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  }`}
                >
                  {isResponding ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : confirmModal.action === "Accepted" ? (
                    <Check className="size-3.5 mr-1.5" />
                  ) : (
                    <X className="size-3.5 mr-1.5" />
                  )}
                  {confirmModal.action === "Accepted"
                    ? "Confirm & Accept Proposal"
                    : "Confirm Decline"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: SETTLEMENT & RAZORPAY KICKOFF PROMPT (POST-ACCEPTANCE)          */}
      {/* ========================================================================= */}
      {settlementProposal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="border border-emerald-500/40 bg-card max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <Sparkles className="size-5 shrink-0" />
                <h3 className="font-display text-base font-semibold">
                  Proposal Accepted — Sprint Kickoff
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSettlementProposal(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                <strong className="text-foreground">"{settlementProposal.title}"</strong> is now
                formally accepted. To activate the dedicated engineering team and begin Sprint 1,
                please settle the initial deposit:
              </p>

              <div className="border border-border bg-surface p-4 font-mono space-y-2">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Payment Plan:</span>
                  <span className="font-semibold text-foreground">
                    {settlementProposal.paymentPlanType === "milestone"
                      ? "Milestone 1 Advance"
                      : "100% Full Payment"}
                  </span>
                </div>
                <div className="flex justify-between items-center text-base border-t border-border/80 pt-2 font-display font-bold text-foreground">
                  <span>Amount Due Now:</span>
                  <span>
                    {settlementProposal.currency === "INR" ? "₹" : settlementProposal.currency}{" "}
                    {(
                      settlementProposal.advanceAmount || settlementProposal.totalPrice
                    ).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettlementProposal(null)}
                className="rounded-none cursor-pointer h-9 text-xs font-mono"
              >
                Pay Later
              </Button>
              <Button
                size="sm"
                onClick={() => handleInitiatePayment(settlementProposal)}
                disabled={isPayingRazorpay}
                className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-9 px-4 text-xs font-mono"
              >
                {isPayingRazorpay ? (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                ) : (
                  <CreditCard className="size-3.5 mr-1.5" />
                )}
                Pay Now via Razorpay
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
