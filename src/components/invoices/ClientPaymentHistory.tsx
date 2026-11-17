import { useState, useEffect } from "react";
import { CreditCard, ShieldCheck, Loader2, AlertCircle, Printer, Receipt, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPaymentReceipt, subscribeClientPayments } from "@/services/paymentService";
import type { Payment, UserProfile } from "@/lib/types";

interface ClientPaymentHistoryProps {
  profile: UserProfile;
}

export function ClientPaymentHistory({ profile }: ClientPaymentHistoryProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<Payment | null>(null);
  const [loadingReceiptId, setLoadingReceiptId] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.id) return;
    setIsLoading(true);

    const unsub = subscribeClientPayments(
      profile.id,
      (data) => {
        setPayments(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Client payments subscription error:", err);
        setError("Unable to sync payment receipts from Firestore.");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [profile.id]);

  const handleOpenReceipt = async (payment: Payment) => {
    setLoadingReceiptId(payment.id);
    try {
      const freshReceipt = await fetchPaymentReceipt(payment.id);
      setActiveReceipt(freshReceipt);
    } catch {
      setActiveReceipt(payment);
    } finally {
      setLoadingReceiptId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="border border-border bg-surface p-12 text-center">
        <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
        <p className="mt-3 font-mono text-xs text-muted-foreground uppercase tracking-widest">
          Loading verified receipts...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive/40 bg-destructive/5 p-4 text-xs font-mono text-destructive flex items-center gap-2">
        <AlertCircle className="size-4 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="border border-border bg-surface p-12 text-center">
        <CreditCard className="size-10 mx-auto text-muted-foreground/40" />
        <h3 className="mt-4 font-display text-lg">No Payment Receipts Yet</h3>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
          Completed payments settled through Razorpay will be archived here with official
          transaction references and verified timestamps.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border border-border bg-surface overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="border-b border-border bg-card font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="p-3.5 sm:px-4">Date</th>
              <th className="p-3.5 sm:px-4">Invoice / Receipt</th>
              <th className="p-3.5 sm:px-4">Razorpay Payment ID</th>
              <th className="p-3.5 sm:px-4 text-right">Amount</th>
              <th className="p-3.5 sm:px-4 text-center">Status</th>
              <th className="p-3.5 sm:px-4 text-right">Method</th>
              <th className="p-3.5 sm:px-4 text-right">Receipt</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {payments.map((p) => {
              const isPaid = p.status === "paid";
              const isFailed = p.status === "failed";
              const isCancelled = p.status === "cancelled";

              return (
                <tr key={p.id} className="hover:bg-card/40 transition-colors">
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
                  <td className="p-3.5 sm:px-4 whitespace-nowrap">
                    <div className="font-semibold text-foreground">
                      {p.invoiceNumber || p.invoiceId?.slice(0, 10) || "Statement"}
                    </div>
                    {p.receiptNumber && (
                      <div className="text-[10px] text-emerald-400">{p.receiptNumber}</div>
                    )}
                    {p.failureReason && !isPaid && (
                      <div className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                        {p.failureReason}
                      </div>
                    )}
                  </td>
                  <td className="p-3.5 sm:px-4 font-mono text-[11px] text-foreground font-medium whitespace-nowrap">
                    {p.razorpayPaymentId || p.razorpayOrderId || "—"}
                  </td>
                  <td
                    className={`p-3.5 sm:px-4 text-right font-medium whitespace-nowrap ${
                      isPaid
                        ? "text-emerald-400"
                        : isFailed
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }`}
                  >
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
                          : isFailed
                            ? "border-destructive/40 bg-destructive/10 text-destructive"
                            : isCancelled
                              ? "border-border bg-card text-muted-foreground"
                              : "border-amber-500/40 bg-amber-500/10 text-amber-400"
                      }`}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          isPaid
                            ? "bg-emerald-500"
                            : isFailed
                              ? "bg-destructive"
                              : isCancelled
                                ? "bg-muted-foreground"
                                : "bg-amber-500"
                        }`}
                      />
                      {p.status}
                    </span>
                  </td>
                  <td className="p-3.5 sm:px-4 text-right text-[11px] text-muted-foreground uppercase whitespace-nowrap">
                    {p.paymentMethod || "online"}
                  </td>
                  <td className="p-3.5 sm:px-4 text-right whitespace-nowrap">
                    {isPaid ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={loadingReceiptId === p.id}
                        onClick={() => handleOpenReceipt(p)}
                        className="rounded-none font-mono text-[10px] h-7 px-2.5 cursor-pointer border-border hover:border-foreground"
                      >
                        {loadingReceiptId === p.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <>
                            <Receipt className="size-3 mr-1" />
                            Receipt
                          </>
                        )}
                      </Button>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Printable Official Payment Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="border border-border bg-card max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-border pb-4">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-[10px] uppercase tracking-wider">
                  <ShieldCheck className="size-3.5" />
                  <span>Verified Payment Receipt</span>
                </div>
                <h3 className="font-display text-lg font-semibold mt-1">
                  {activeReceipt.receiptNumber ||
                    `RCPT-${activeReceipt.id.slice(-8).toUpperCase()}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono border border-border bg-surface p-4">
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Invoice Number:</span>
                <span className="font-semibold text-foreground">
                  {activeReceipt.invoiceNumber || activeReceipt.invoiceId || "Statement"}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Amount Settled:</span>
                <span className="font-semibold text-emerald-400">
                  {activeReceipt.currency}{" "}
                  {activeReceipt.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Gateway:</span>
                <span className="text-foreground">{activeReceipt.gateway || "Razorpay"}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Payment Method:</span>
                <span className="text-foreground uppercase">
                  {activeReceipt.paymentMethod || "online"}
                </span>
              </div>
              {activeReceipt.razorpayPaymentId && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Payment ID:</span>
                  <span className="text-foreground">{activeReceipt.razorpayPaymentId}</span>
                </div>
              )}
              {activeReceipt.razorpayOrderId && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Order ID:</span>
                  <span className="text-foreground">{activeReceipt.razorpayOrderId}</span>
                </div>
              )}
              <div className="flex justify-between gap-2">
                <span className="text-muted-foreground">Paid Timestamp:</span>
                <span className="text-foreground">
                  {new Date(activeReceipt.paidAt || activeReceipt.createdAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="rounded-none cursor-pointer font-mono text-xs h-8 px-3"
              >
                <Printer className="size-3.5 mr-1.5" />
                Print Receipt
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setActiveReceipt(null)}
                className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs h-8 px-4"
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
