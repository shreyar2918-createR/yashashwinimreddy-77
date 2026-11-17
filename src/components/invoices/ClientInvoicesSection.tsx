import { useState, useEffect, useMemo } from "react";
import {
  Receipt,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Printer,
  Calendar,
  DollarSign,
  AlertTriangle,
  Eye,
  FileText,
  Building2,
  CheckCircle2,
  CreditCard,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeClientInvoices } from "@/services/invoiceService";
import { launchRazorpayCheckout, getRazorpayPublicConfig } from "@/services/paymentService";
import { InvoiceModal } from "./InvoiceModal";
import { ClientPaymentHistory } from "./ClientPaymentHistory";
import type { Invoice, UserProfile, CanonicalInvoiceStatus } from "@/lib/types";

interface ClientInvoicesSectionProps {
  profile: UserProfile;
}

export function ClientInvoicesSection({ profile }: ClientInvoicesSectionProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"invoices" | "receipts">("invoices");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Detailed Printable Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  // Clean Razorpay Payment Interface Modal
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<{
    keyId: string;
    isConfigured: boolean;
    isTestMode: boolean;
  } | null>(null);
  const [isLoadingPaymentConfig, setIsLoadingPaymentConfig] = useState(false);
  const [paymentModalError, setPaymentModalError] = useState<string | null>(null);

  // Subscribe to real-time invoices for this authenticated client
  useEffect(() => {
    if (!profile.id) return;
    setIsLoading(true);

    const unsub = subscribeClientInvoices(
      profile.id,
      (data) => {
        setInvoices(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Client invoices subscription error:", err);
        setError("Unable to sync billing records from Firestore.");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [profile.id]);

  // Preload Razorpay gateway configuration status
  useEffect(() => {
    setIsLoadingPaymentConfig(true);
    getRazorpayPublicConfig()
      .then((cfg) => {
        setPaymentConfig({
          keyId: cfg.keyId,
          isConfigured: cfg.isConfigured,
          isTestMode: cfg.isTestMode,
        });
      })
      .finally(() => setIsLoadingPaymentConfig(false));
  }, []);

  // Open clean payment interface when client clicks "Pay Now"
  const handlePayNow = (inv: Invoice) => {
    setError(null);
    setPaymentSuccessMessage(null);
    setPaymentModalError(null);
    setPaymentModalInvoice(inv);
    setIsLoadingPaymentConfig(true);
    getRazorpayPublicConfig()
      .then((cfg) => {
        setPaymentConfig({
          keyId: cfg.keyId,
          isConfigured: cfg.isConfigured,
          isTestMode: cfg.isTestMode,
        });
      })
      .finally(() => setIsLoadingPaymentConfig(false));
  };

  // Trigger Razorpay Checkout from inside the payment interface
  const handlePayWithRazorpay = () => {
    if (!paymentModalInvoice) return;
    const inv = paymentModalInvoice;
    setPaymentModalError(null);

    if (paymentConfig && !paymentConfig.isConfigured) {
      setPaymentModalError(
        "Online payment is not configured yet. Please contact the administrator.",
      );
      return;
    }

    setIsProcessingPayment(inv.id);

    launchRazorpayCheckout(
      inv,
      {
        uid: profile.id,
        name: profile.fullName,
        email: profile.email,
      },
      (result) => {
        setIsProcessingPayment(null);
        setPaymentModalInvoice(null);
        setPaymentSuccessMessage(
          `Payment of ${inv.currency} ${result.amountPaid.toLocaleString()} verified successfully! (${result.receiptNumber ? `Receipt: ${result.receiptNumber} • ` : ""}Ref: ${result.razorpayPaymentId})`,
        );
        setTimeout(() => setPaymentSuccessMessage(null), 8000);
      },
      (payErr) => {
        setIsProcessingPayment(null);
        setPaymentModalError(payErr.message || "Payment process could not be completed.");
      },
      () => {
        setIsProcessingPayment(null);
      },
    );
  };

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Status filter
      if (statusFilter !== "all") {
        if (statusFilter === "overdue" && inv.status !== "Overdue") return false;
        if (statusFilter === "paid" && inv.status !== "Paid") return false;
        if (statusFilter === "unpaid" && (inv.status === "Paid" || inv.status === "Cancelled"))
          return false;
        if (statusFilter === "sent" && inv.status !== "Sent") return false;
        if (statusFilter === "draft" && inv.status !== "Draft") return false;
        if (statusFilter === "cancelled" && inv.status !== "Cancelled") return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = (inv.invoiceNumber || inv.number || "").toLowerCase().includes(q);
        const projMatch = (inv.projectName || "").toLowerCase().includes(q);
        const notesMatch = (inv.notes || "").toLowerCase().includes(q);
        const itemMatch = inv.lineItems.some((li) => li.description.toLowerCase().includes(q));
        if (!numMatch && !projMatch && !notesMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, statusFilter, searchQuery]);

  // Aggregate Metrics
  const metrics = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let outstanding = 0;
    let overdueCount = 0;
    let overdueAmount = 0;

    for (const inv of invoices) {
      if (inv.status === "Cancelled") continue;
      totalInvoiced += inv.totalAmount || 0;
      totalPaid += inv.amountPaid || 0;
      outstanding += inv.balanceDue || 0;

      if (inv.status === "Overdue" && (inv.balanceDue || 0) > 0) {
        overdueCount += 1;
        overdueAmount += inv.balanceDue || 0;
      }
    }

    return {
      totalInvoiced,
      totalPaid,
      outstanding,
      overdueCount,
      overdueAmount,
      totalCount: invoices.length,
    };
  }, [invoices]);

  const currencySymbol = invoices[0]?.currency || "USD";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-normal tracking-tight">
              Payments & Invoices
            </h2>
            <span className="border border-border bg-card px-2.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              Client Portal
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Real-time project billing statements, milestone receipts, outstanding balances, and
            printable tax invoices.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("invoices")}
            className={`px-3 py-1.5 font-mono text-xs cursor-pointer border uppercase tracking-wider transition-colors ${
              activeTab === "invoices"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            Invoices ({invoices.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("receipts")}
            className={`px-3 py-1.5 font-mono text-xs cursor-pointer border uppercase tracking-wider transition-colors ${
              activeTab === "receipts"
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            Payment Receipts
          </button>
        </div>
      </div>

      {activeTab === "receipts" ? (
        <ClientPaymentHistory profile={profile} />
      ) : (
        <>
          {/* Summary Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Invoiced */}
            <div className="border border-border bg-surface p-5 space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                Total Invoiced
              </span>
              <p className="font-display text-2xl font-normal text-foreground">
                {currencySymbol}{" "}
                {metrics.totalInvoiced.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                Across {metrics.totalCount} active statements
              </p>
            </div>

            {/* Total Settled / Paid */}
            <div className="border border-border bg-surface p-5 space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                Amount Paid
              </span>
              <p className="font-display text-2xl font-normal text-emerald-400">
                {currencySymbol}{" "}
                {metrics.totalPaid.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                Verified ledger receipts
              </p>
            </div>

            {/* Balance Due */}
            <div className="border border-border bg-surface p-5 space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                Outstanding Balance
              </span>
              <p
                className={`font-display text-2xl font-normal ${metrics.outstanding > 0 ? "text-foreground" : "text-emerald-400"}`}
              >
                {currencySymbol}{" "}
                {metrics.outstanding.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {metrics.outstanding > 0 ? "Pending milestone settlement" : "All accounts clear"}
              </p>
            </div>

            {/* Overdue Alert */}
            <div
              className={`border p-5 space-y-1 ${metrics.overdueCount > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-surface"}`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Overdue
                </span>
                {metrics.overdueCount > 0 && (
                  <span className="size-2 rounded-full bg-destructive animate-pulse" />
                )}
              </div>
              <p
                className={`font-display text-2xl font-normal ${metrics.overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {currencySymbol}{" "}
                {metrics.overdueAmount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
              <p
                className={`font-mono text-[10px] ${metrics.overdueCount > 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {metrics.overdueCount > 0
                  ? `${metrics.overdueCount} statement(s) past due`
                  : "Zero overdue invoices"}
              </p>
            </div>
          </div>

          {/* Success & Error state banners */}
          {paymentSuccessMessage && (
            <div className="border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center justify-between text-xs text-emerald-400 font-mono">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                <span>{paymentSuccessMessage}</span>
              </div>
              <button
                onClick={() => setPaymentSuccessMessage(null)}
                className="cursor-pointer text-emerald-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <div className="border border-destructive/40 bg-destructive/5 p-4 flex items-center justify-between text-xs text-destructive font-mono">
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="cursor-pointer hover:underline">
                Dismiss
              </button>
            </div>
          )}

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by invoice number, project name, or item description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 font-mono text-xs rounded-none border-border bg-surface text-foreground"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 font-mono text-xs shrink-0">
              {[
                { id: "all", label: "All" },
                { id: "unpaid", label: "Pending Payment" },
                { id: "overdue", label: "Overdue" },
                { id: "paid", label: "Paid" },
                { id: "sent", label: "Sent" },
                { id: "cancelled", label: "Cancelled" },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={`px-3 py-2 border uppercase tracking-wider text-[0.65rem] cursor-pointer transition-colors ${
                    statusFilter === st.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-surface text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Invoices List / Table */}
          {isLoading ? (
            <div className="border border-border bg-surface p-16 text-center">
              <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-3 font-mono text-xs text-muted-foreground uppercase tracking-widest">
                Synchronizing invoices from VINORA ledger...
              </p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="border border-border bg-surface p-16 text-center">
              <Receipt className="size-10 mx-auto text-muted-foreground/40" />
              <h3 className="mt-4 font-display text-lg">No Invoices Found</h3>
              <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {searchQuery || statusFilter !== "all"
                  ? "No billing records match your current search and filter criteria."
                  : "Invoices issued for your project milestones and retainer agreements will be documented here automatically in real time."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Desktop Table View */}
              <div className="border border-border bg-surface overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border bg-card font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="py-3 px-2.5 whitespace-nowrap">Invoice #</th>
                      <th className="py-3 px-2.5">Project</th>
                      <th className="py-3 px-2.5 whitespace-nowrap">Invoice Date</th>
                      <th className="py-3 px-2.5 whitespace-nowrap">Due Date</th>
                      <th className="py-3 px-2.5 text-right whitespace-nowrap">Total Amount</th>
                      <th className="py-3 px-2.5 text-right whitespace-nowrap">Amount Paid</th>
                      <th className="py-3 px-2.5 text-right whitespace-nowrap">Remaining</th>
                      <th className="py-3 px-2.5 text-center">Status</th>
                      <th className="py-3 px-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredInvoices.map((inv) => {
                      const isPaid = inv.status === "Paid";
                      const isPartiallyPaid = inv.status === "Partially Paid";
                      const isOverdue = inv.status === "Overdue";
                      const isCancelled = inv.status === "Cancelled";

                      return (
                        <tr key={inv.id} className="hover:bg-card/40 transition-colors">
                          <td className="py-3 px-2.5 font-mono font-medium text-foreground whitespace-nowrap">
                            {inv.invoiceNumber || inv.number}
                          </td>
                          <td className="py-3 px-2.5 max-w-[155px] truncate">
                            <div className="font-sans font-medium text-foreground truncate">
                              {inv.projectName || "Custom Architecture Scope"}
                            </div>
                            <div className="text-[10px] font-mono text-muted-foreground truncate">
                              {inv.lineItems.length} line item(s)
                            </div>
                          </td>
                          <td className="py-3 px-2.5 font-mono text-muted-foreground text-[11px] whitespace-nowrap">
                            {inv.issueDate || "N/A"}
                          </td>
                          <td className="py-3 px-2.5 font-mono text-[11px] whitespace-nowrap">
                            <span
                              className={
                                isOverdue
                                  ? "text-destructive font-semibold"
                                  : "text-muted-foreground"
                              }
                            >
                              {inv.dueDate || "Upon Receipt"}
                            </span>
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono text-foreground font-medium tabular-nums whitespace-nowrap">
                            {inv.currency}{" "}
                            {inv.totalAmount.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono text-emerald-400 tabular-nums whitespace-nowrap">
                            {inv.currency}{" "}
                            {(inv.amountPaid || 0).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                          <td className="py-3 px-2.5 text-right font-mono font-semibold tabular-nums whitespace-nowrap">
                            <span
                              className={
                                isOverdue
                                  ? "text-destructive"
                                  : inv.balanceDue <= 0
                                    ? "text-emerald-400"
                                    : "text-foreground"
                              }
                            >
                              {inv.currency}{" "}
                              {inv.balanceDue.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </td>
                          <td className="py-3 px-2.5 text-center whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-mono uppercase border ${
                                isPaid
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                                  : isPartiallyPaid
                                    ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                                    : isOverdue
                                      ? "border-destructive/40 bg-destructive/10 text-destructive font-semibold"
                                      : isCancelled
                                        ? "border-border bg-card text-muted-foreground line-through"
                                        : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                              }`}
                            >
                              <span
                                className={`size-1.5 rounded-full ${
                                  isPaid
                                    ? "bg-emerald-500"
                                    : isPartiallyPaid
                                      ? "bg-blue-500"
                                      : isOverdue
                                        ? "bg-destructive animate-pulse"
                                        : isCancelled
                                          ? "bg-muted-foreground"
                                          : "bg-amber-500"
                                }`}
                              />
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-2.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {!isPaid && !isCancelled && inv.balanceDue > 0 && (
                                <Button
                                  size="sm"
                                  disabled={isProcessingPayment === inv.id}
                                  onClick={() => handlePayNow(inv)}
                                  className="rounded-none font-mono text-[10px] h-7 px-2 cursor-pointer bg-emerald-500 text-black hover:bg-emerald-400 font-semibold"
                                  title={`Pay ${inv.currency} ${inv.balanceDue.toLocaleString()} via Razorpay`}
                                >
                                  {isProcessingPayment === inv.id ? (
                                    <Loader2 className="size-3 animate-spin mr-1" />
                                  ) : (
                                    <CreditCard className="size-3 mr-1" />
                                  )}
                                  Pay Now
                                </Button>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedInvoice(inv)}
                                title="View & Print Invoice"
                                className="rounded-none font-mono text-[10px] h-7 px-2 cursor-pointer border-border hover:border-foreground"
                              >
                                <Eye className="size-3 mr-1" />
                                View
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Printable Invoice Modal */}
          {selectedInvoice && (
            <InvoiceModal
              invoice={selectedInvoice}
              onClose={() => setSelectedInvoice(null)}
              userRole="client"
              onPayNow={handlePayNow}
            />
          )}

          {/* Razorpay Payment Checkout Interface Modal */}
          {paymentModalInvoice && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
              onClick={() => {
                if (!isProcessingPayment) setPaymentModalInvoice(null);
              }}
            >
              <div
                className="w-full max-w-md border border-border bg-card shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between border-b border-border pb-4">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                      Secure Payment Checkout
                    </span>
                    <h3 className="font-display text-lg font-medium text-foreground mt-0.5">
                      {paymentModalInvoice.invoiceNumber || paymentModalInvoice.number}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {paymentModalInvoice.projectName || "Custom Architecture Engagement"}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={Boolean(isProcessingPayment)}
                    onClick={() => setPaymentModalInvoice(null)}
                    aria-label="Close payment window"
                    className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                {/* Amount Breakdown */}
                <div className="border border-border bg-surface p-4 space-y-2.5 text-xs font-mono">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Total Invoice Amount</span>
                    <span className="text-foreground tabular-nums">
                      {paymentModalInvoice.currency}{" "}
                      {paymentModalInvoice.totalAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Amount Already Paid</span>
                    <span className="text-emerald-400 tabular-nums">
                      {paymentModalInvoice.currency}{" "}
                      {(paymentModalInvoice.amountPaid || 0).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2.5 flex items-center justify-between text-sm font-semibold text-foreground">
                    <span>Remaining Balance Due</span>
                    <span className="text-base tabular-nums">
                      {paymentModalInvoice.currency}{" "}
                      {paymentModalInvoice.balanceDue.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                {/* Payment Provider: Razorpay */}
                <div className="border border-border bg-surface/60 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="size-4 text-emerald-400" />
                      <span className="text-xs font-semibold text-foreground">
                        Payment Provider: Razorpay
                      </span>
                    </div>
                    <span className="font-mono text-[10px] uppercase border border-border bg-background px-2 py-0.5 text-muted-foreground">
                      {paymentConfig?.isConfigured
                        ? paymentConfig.isTestMode
                          ? "Test Mode"
                          : "Live Gateway"
                        : "Setup Pending"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Supports UPI, Credit/Debit Cards, Netbanking, and Wallets via encrypted Razorpay
                    Checkout.
                  </p>
                </div>

                {/* Configuration Pending or Error Notice */}
                {!isLoadingPaymentConfig && paymentConfig && !paymentConfig.isConfigured && (
                  <div className="border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-300 flex items-start gap-2.5">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-400" />
                    <p className="leading-relaxed">
                      Online payment is not configured yet. Please contact the administrator.
                    </p>
                  </div>
                )}

                {paymentModalError &&
                  !(
                    paymentConfig &&
                    !paymentConfig.isConfigured &&
                    paymentModalError ===
                      "Online payment is not configured yet. Please contact the administrator."
                  ) && (
                    <div className="border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2">
                      <AlertCircle className="size-4 shrink-0 mt-0.5" />
                      <span>{paymentModalError}</span>
                    </div>
                  )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={Boolean(isProcessingPayment)}
                    onClick={() => setPaymentModalInvoice(null)}
                    className="rounded-none font-mono text-xs h-9 px-4 cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      Boolean(isProcessingPayment) ||
                      isLoadingPaymentConfig ||
                      paymentModalInvoice.balanceDue <= 0
                    }
                    onClick={handlePayWithRazorpay}
                    className="rounded-none font-mono text-xs h-9 px-4 cursor-pointer bg-emerald-500 text-black hover:bg-emerald-400 font-semibold"
                  >
                    {isProcessingPayment === paymentModalInvoice.id || isLoadingPaymentConfig ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin mr-1.5" />
                        {isLoadingPaymentConfig ? "Checking Gateway..." : "Processing..."}
                      </>
                    ) : (
                      <>
                        <CreditCard className="size-3.5 mr-1.5" />
                        Pay with Razorpay
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
