import { useState, useEffect, useMemo } from "react";
import {
  CreditCard,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
  Calendar,
  DollarSign,
  AlertTriangle,
  Eye,
  FileText,
  Building2,
  CheckCircle2,
  ShieldCheck,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { subscribeAllPayments } from "@/services/paymentService";
import type { Payment } from "@/lib/types";
import type { AdminRecord } from "@/services/adminAuth";

interface AdminPaymentsSectionProps {
  admin: AdminRecord;
}

export function AdminPaymentsSection({ admin }: AdminPaymentsSectionProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);

  // Real-time Firestore subscription to /payments
  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeAllPayments(
      (data) => {
        setPayments(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Admin payments subscription error:", err);
        setError("Unable to sync payments from Firestore.");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // Filtered payments list
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const invoiceMatch = (p.invoiceNumber || p.invoiceId || "").toLowerCase().includes(q);
        const clientMatch = (p.clientName || p.clientEmail || p.clientId || "")
          .toLowerCase()
          .includes(q);
        const orderMatch = (p.razorpayOrderId || "").toLowerCase().includes(q);
        const payIdMatch = (p.razorpayPaymentId || "").toLowerCase().includes(q);
        const projMatch = (p.projectName || "").toLowerCase().includes(q);

        if (!invoiceMatch && !clientMatch && !orderMatch && !payIdMatch && !projMatch) {
          return false;
        }
      }

      return true;
    });
  }, [payments, statusFilter, searchQuery]);

  // Financial aggregates
  const metrics = useMemo(() => {
    let totalCollected = 0;
    let successfulCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    for (const p of payments) {
      if (p.status === "paid") {
        totalCollected += p.amount || 0;
        successfulCount += 1;
      } else if (p.status === "pending" || p.status === "processing") {
        pendingCount += 1;
      } else if (p.status === "failed") {
        failedCount += 1;
      }
    }

    return {
      totalCollected,
      successfulCount,
      pendingCount,
      failedCount,
      totalTransactions: payments.length,
    };
  }, [payments]);

  const currencySymbol = payments[0]?.currency || "INR";

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-medium tracking-tight">
              Payments & Transactions
            </h2>
            <span className="border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase text-emerald-400">
              Razorpay Verified
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Real-time ledger of Razorpay transactions, order IDs, payment IDs, and cryptographic
            verification statuses.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs border border-border bg-card px-3 py-1.5 text-muted-foreground">
          <span>Active Ledger: </span>
          <span className="font-semibold text-foreground">{payments.length} Records</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        <div className="border border-border bg-card p-5 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
            Total Verified Collections
          </span>
          <p className="font-display text-2xl font-normal text-emerald-400 font-sans">
            {currencySymbol}{" "}
            {metrics.totalCollected.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="text-[10px] text-muted-foreground">
            From {metrics.successfulCount} successful transactions
          </p>
        </div>

        <div className="border border-border bg-card p-5 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
            Successful Transactions
          </span>
          <p className="font-display text-2xl font-normal text-foreground font-sans">
            {metrics.successfulCount}
          </p>
          <p className="text-[10px] text-muted-foreground">100% cryptographically verified</p>
        </div>

        <div className="border border-border bg-card p-5 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
            Pending / Intents
          </span>
          <p className="font-display text-2xl font-normal text-amber-400 font-sans">
            {metrics.pendingCount}
          </p>
          <p className="text-[10px] text-muted-foreground">Awaiting checkout completion</p>
        </div>

        <div className="border border-border bg-card p-5 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">
            Security Guarantee
          </span>
          <p className="font-display text-base font-medium text-foreground font-sans flex items-center gap-1.5 pt-1">
            <ShieldCheck className="size-4 text-emerald-400" />
            Zero Client Manual Override
          </p>
          <p className="text-[10px] text-muted-foreground">
            Verified strictly via Razorpay HMAC-SHA256
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="border border-destructive/40 bg-destructive/10 p-4 flex items-center justify-between text-xs text-destructive font-mono">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="cursor-pointer hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by invoice #, client, Razorpay order ID or payment ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 font-mono text-xs rounded-none border-border bg-card text-foreground"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 font-mono text-xs shrink-0">
          {[
            { id: "all", label: "All" },
            { id: "paid", label: "Paid" },
            { id: "pending", label: "Pending" },
            { id: "failed", label: "Failed" },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-2 border uppercase tracking-wider text-[0.65rem] cursor-pointer transition-colors ${
                statusFilter === st.id
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table */}
      {isLoading ? (
        <div className="border border-border bg-card p-16 text-center">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-3 font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Synchronizing payments ledger from Firestore...
          </p>
        </div>
      ) : filteredPayments.length === 0 ? (
        <div className="border border-border bg-card p-16 text-center">
          <CreditCard className="size-10 mx-auto text-muted-foreground/40" />
          <h3 className="mt-4 font-display text-lg">No Payment Records Found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {searchQuery || statusFilter !== "all"
              ? "No transactions match your current search and filter criteria."
              : "Transactions initiated through Razorpay Checkout will be logged here automatically with cryptographic verification proofs."}
          </p>
        </div>
      ) : (
        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border bg-surface/50 font-mono uppercase tracking-wider text-[10px] text-muted-foreground">
              <tr>
                <th className="p-3.5 sm:px-4">Payment Date</th>
                <th className="p-3.5 sm:px-4">Invoice #</th>
                <th className="p-3.5 sm:px-4">Client</th>
                <th className="p-3.5 sm:px-4">Razorpay Order ID</th>
                <th className="p-3.5 sm:px-4">Razorpay Payment ID</th>
                <th className="p-3.5 sm:px-4 text-right">Amount</th>
                <th className="p-3.5 sm:px-4 text-center">Status</th>
                <th className="p-3.5 sm:px-4 text-right">Method</th>
                <th className="p-3.5 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredPayments.map((p) => {
                const isPaid = p.status === "paid";
                const isPending = p.status === "pending" || p.status === "processing";
                const isFailed = p.status === "failed";

                return (
                  <tr key={p.id} className="hover:bg-surface/30 transition-colors">
                    <td className="p-3.5 sm:px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                      {p.paidAt
                        ? new Date(p.paidAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })
                        : p.createdAt
                          ? new Date(p.createdAt).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })
                          : "N/A"}
                    </td>
                    <td className="p-3.5 sm:px-4 font-semibold text-foreground whitespace-nowrap">
                      {p.invoiceNumber || p.invoiceId?.slice(0, 10) || "Invoice"}
                    </td>
                    <td className="p-3.5 sm:px-4 max-w-[160px] truncate">
                      <div className="font-sans font-medium text-foreground truncate">
                        {p.clientName || "Client"}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {p.clientEmail || p.clientId?.slice(0, 8)}
                      </div>
                    </td>
                    <td className="p-3.5 sm:px-4 font-mono text-[11px] text-muted-foreground max-w-[140px] truncate">
                      {p.razorpayOrderId || "—"}
                    </td>
                    <td className="p-3.5 sm:px-4 font-mono text-[11px] text-foreground font-medium max-w-[140px] truncate">
                      {p.razorpayPaymentId || "—"}
                    </td>
                    <td className="p-3.5 sm:px-4 text-right font-medium text-foreground whitespace-nowrap">
                      {p.currency}{" "}
                      {p.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3.5 sm:px-4 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] uppercase border ${
                          isPaid
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : isPending
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                              : "border-destructive/40 bg-destructive/10 text-destructive"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            isPaid
                              ? "bg-emerald-500"
                              : isPending
                                ? "bg-amber-500"
                                : "bg-destructive"
                          }`}
                        />
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3.5 sm:px-4 text-right text-[11px] text-muted-foreground uppercase whitespace-nowrap">
                      {p.paymentMethod || "online"}
                    </td>
                    <td className="p-3.5 sm:px-4 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPayment(p)}
                        className="rounded-none font-mono text-[10px] h-7 px-2 cursor-pointer text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="size-3 mr-1" />
                        Details
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Payment Details Drawer / Modal */}
      {selectedPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setSelectedPayment(null)}
        >
          <div
            className="relative w-full max-w-lg bg-surface border border-border shadow-2xl text-foreground my-8 p-6 space-y-5 font-mono text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-emerald-400" />
                <h3 className="font-display text-base font-semibold text-foreground">
                  Transaction Receipt Details
                </h3>
              </div>
              <button
                onClick={() => setSelectedPayment(null)}
                className="cursor-pointer text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <div className="border border-border p-4 bg-card space-y-3">
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Transaction Status:</span>
                <span
                  className={`font-semibold uppercase ${selectedPayment.status === "paid" ? "text-emerald-400" : "text-amber-400"}`}
                >
                  {selectedPayment.status}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Settlement Amount:</span>
                <span className="text-foreground font-bold font-sans text-sm">
                  {selectedPayment.currency}{" "}
                  {selectedPayment.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Invoice Reference:</span>
                <span className="text-foreground font-semibold">
                  {selectedPayment.invoiceNumber || selectedPayment.invoiceId}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Client Name:</span>
                <span className="text-foreground">{selectedPayment.clientName || "Client"}</span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Client UID:</span>
                <span className="text-muted-foreground break-all">
                  {selectedPayment.clientId || selectedPayment.clientUid}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Razorpay Order ID:</span>
                <span className="text-foreground font-semibold">
                  {selectedPayment.razorpayOrderId || "—"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Razorpay Payment ID:</span>
                <span className="text-emerald-400 font-semibold">
                  {selectedPayment.razorpayPaymentId || "—"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Payment Method:</span>
                <span className="text-foreground uppercase">
                  {selectedPayment.paymentMethod || "online"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/60 pb-2">
                <span className="text-muted-foreground">Verification Timestamp:</span>
                <span className="text-muted-foreground">
                  {selectedPayment.verifiedAt ||
                    selectedPayment.paidAt ||
                    selectedPayment.createdAt}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Gateway Engine:</span>
                <span className="text-foreground">Razorpay Standard</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-border">
              <Button
                size="sm"
                onClick={() => setSelectedPayment(null)}
                className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
