import { useState } from "react";
import {
  Printer,
  X,
  Building2,
  Calendar,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  FileText,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Invoice } from "@/lib/types";

interface InvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  userRole?: "admin" | "client";
  onPayNow?: (invoice: Invoice) => void;
}

export function InvoiceModal({ invoice, onClose, userRole, onPayNow }: InvoiceModalProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  if (!invoice) return null;

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 150);
  };

  const isPaid = invoice.status === "Paid";
  const isPartiallyPaid = invoice.status === "Partially Paid";
  const isOverdue = invoice.status === "Overdue";
  const isCancelled = invoice.status === "Cancelled";
  const isSent =
    invoice.status === "Sent" || invoice.status === "issued" || invoice.status === "sent";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-surface border border-border shadow-2xl text-foreground my-auto overflow-hidden print:border-none print:shadow-none print:w-full print:max-w-none print:p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Actions (Hidden in Print) */}
        <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
              Official Tax Statement
            </span>
            <span className="size-1 rounded-full bg-border" />
            <span className="font-mono text-xs font-semibold text-foreground">
              {invoice.invoiceNumber || invoice.number}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={isPrinting}
              className="rounded-none font-mono text-xs cursor-pointer border-border hover:border-foreground"
            >
              <Printer className="size-3.5 mr-1.5" />
              Print / Save PDF
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="rounded-none size-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Printable Invoice Document Body */}
        <div id="vinora-printable-invoice" className="p-6 sm:p-10 space-y-8 bg-surface print:p-8">
          {/* Header Brand & Status */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-border pb-8">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif text-2xl tracking-[0.2em] font-semibold text-foreground">
                  VINORA
                </span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground border border-border px-1.5 py-0.5">
                  Studio Operations
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-sm">
                High-Performance Digital Architecture, Software Engineering & Systems Design.
              </p>
              <p className="font-mono text-[10px] text-muted-foreground mt-1">
                contact@vinora.studio • www.vinora.studio
              </p>
            </div>

            <div className="sm:text-right space-y-2">
              <div className="inline-block">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 font-mono text-xs font-semibold tracking-wider uppercase border ${
                    isPaid
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : isPartiallyPaid
                        ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                        : isOverdue
                          ? "border-destructive/40 bg-destructive/10 text-destructive"
                          : isCancelled
                            ? "border-border bg-card text-muted-foreground line-through"
                            : isSent
                              ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                              : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
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
                  {invoice.status.toUpperCase()}
                </span>
              </div>

              <div className="font-mono text-xs text-muted-foreground space-y-0.5">
                <div>
                  Invoice #:{" "}
                  <span className="font-semibold text-foreground">
                    {invoice.invoiceNumber || invoice.number}
                  </span>
                </div>
                <div>
                  Issue Date: <span className="text-foreground">{invoice.issueDate || "N/A"}</span>
                </div>
                <div>
                  Due Date:{" "}
                  <span
                    className={`font-semibold ${isOverdue ? "text-destructive" : "text-foreground"}`}
                  >
                    {invoice.dueDate || "Due Upon Receipt"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Billing & Client Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div className="border border-border p-4 bg-card/40 space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">
                Billed To
              </span>
              <p className="font-sans font-semibold text-sm text-foreground">
                {invoice.clientName || "Valued Client"}
              </p>
              {invoice.clientEmail && (
                <p className="font-mono text-muted-foreground">{invoice.clientEmail}</p>
              )}
              <p className="font-mono text-[11px] text-muted-foreground">
                Client ID: {invoice.clientId || invoice.clientUid}
              </p>
              {invoice.projectName && (
                <div className="mt-3 pt-2 border-t border-border font-mono text-[11px]">
                  <span className="text-muted-foreground">Project: </span>
                  <span className="text-foreground font-medium">{invoice.projectName}</span>
                </div>
              )}
            </div>

            <div className="border border-border p-4 bg-card/40 space-y-1.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block mb-2">
                Issuer / Remittance Details
              </span>
              <p className="font-sans font-semibold text-sm text-foreground">
                VINORA Engineering & Design Studio
              </p>
              <p className="font-mono text-muted-foreground">
                Authorized By: {invoice.createdByAdminName || "Studio Principal"}
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                Routing: Corporate Direct Settlement / Wire Ledger
              </p>
              <div className="mt-3 pt-2 border-t border-border font-mono text-[11px] flex items-center justify-between">
                <span className="text-muted-foreground">Settlement Currency:</span>
                <span className="text-foreground font-semibold uppercase">{invoice.currency}</span>
              </div>
            </div>
          </div>

          {/* Cancellation Notice if applicable */}
          {isCancelled && (
            <div className="border border-destructive/30 bg-destructive/5 p-4 text-xs font-mono">
              <div className="flex items-center gap-2 text-destructive font-semibold">
                <AlertTriangle className="size-4 shrink-0" />
                <span>INVOICE VOIDED & CANCELLED</span>
              </div>
              <p className="mt-1 text-muted-foreground">
                Reason: {invoice.cancellationReason || "Cancelled by administrator."}
              </p>
              {invoice.cancelledBy && (
                <p className="text-[10px] text-muted-foreground/80 mt-0.5">
                  Logged by: {invoice.cancelledBy} on{" "}
                  {invoice.cancelledAt ? new Date(invoice.cancelledAt).toLocaleDateString() : ""}
                </p>
              )}
            </div>
          )}

          {/* Line Items Table */}
          <div className="border border-border bg-card/20 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-card font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 sm:px-4">#</th>
                  <th className="p-3 sm:px-4">Description</th>
                  <th className="p-3 sm:px-4 text-center">Qty</th>
                  <th className="p-3 sm:px-4 text-right">Unit Price ({invoice.currency})</th>
                  <th className="p-3 sm:px-4 text-right">Amount ({invoice.currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-mono">
                {invoice.lineItems.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-surface/30">
                    <td className="p-3 sm:px-4 text-muted-foreground w-10 text-[11px]">
                      {idx + 1}
                    </td>
                    <td className="p-3 sm:px-4 font-sans text-xs text-foreground font-medium">
                      {item.description}
                    </td>
                    <td className="p-3 sm:px-4 text-center text-muted-foreground">
                      {item.quantity}
                    </td>
                    <td className="p-3 sm:px-4 text-right text-muted-foreground">
                      {item.unitPrice.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3 sm:px-4 text-right font-medium text-foreground">
                      {item.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Financial Calculation Breakdown */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t border-border pt-6">
            <div className="space-y-3 max-w-sm text-xs">
              {invoice.notes && (
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Notes & Special Instructions
                  </span>
                  <p className="mt-1 text-muted-foreground leading-relaxed text-[11px] whitespace-pre-line">
                    {invoice.notes}
                  </p>
                </div>
              )}
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Payment Terms
                </span>
                <p className="mt-1 text-muted-foreground text-[11px] leading-relaxed">
                  {invoice.terms ||
                    "Net 15 days upon receipt. Remittance via official corporate wire or portal gateway."}
                </p>
              </div>
            </div>

            <div className="w-full sm:w-72 border border-border p-4 bg-card/40 space-y-2 font-mono text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal:</span>
                <span className="text-foreground">
                  {invoice.currency}{" "}
                  {invoice.subtotal.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              {(invoice.taxRate ?? 0) > 0 || (invoice.tax ?? 0) > 0 ? (
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({invoice.taxRate || 0}%):</span>
                  <span className="text-foreground">
                    + {invoice.currency}{" "}
                    {(invoice.tax || invoice.taxAmount || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ) : null}

              {(invoice.discount ?? 0) > 0 ? (
                <div className="flex justify-between text-emerald-400">
                  <span>Discount:</span>
                  <span>
                    - {invoice.currency}{" "}
                    {invoice.discount?.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              ) : null}

              <div className="border-t border-border pt-2 flex justify-between font-sans text-sm font-semibold text-foreground">
                <span>Total Amount:</span>
                <span className="font-mono">
                  {invoice.currency}{" "}
                  {invoice.totalAmount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/50 text-[11px]">
                <span>Amount Paid:</span>
                <span className="text-emerald-400 font-semibold">
                  {invoice.currency}{" "}
                  {invoice.amountPaid.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>

              <div className="flex justify-between items-center pt-2 border-t-2 border-foreground font-sans text-base font-bold text-foreground">
                <span className={isOverdue ? "text-destructive" : ""}>Balance Due:</span>
                <span
                  className={`font-mono text-lg ${isOverdue ? "text-destructive" : invoice.balanceDue <= 0 ? "text-emerald-400" : "text-foreground"}`}
                >
                  {invoice.currency}{" "}
                  {invoice.balanceDue.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Footer Legal & Security */}
          <div className="border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="size-3.5 text-muted-foreground/60" />
              <span>Cryptographically tracked ledger entry in VINORA Firestore Core</span>
            </div>
            <div>
              Generated on{" "}
              {new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </div>

        {/* Bottom Actions Footer (Hidden in Print) */}
        <div className="flex items-center justify-between border-t border-border bg-card px-6 py-4 print:hidden">
          <p className="font-mono text-xs text-muted-foreground">
            {isPaid
              ? "Full settlement verified."
              : invoice.balanceDue > 0
                ? `Outstanding balance: ${invoice.currency} ${invoice.balanceDue.toLocaleString()}`
                : "Settlement current."}
          </p>
          <div className="flex items-center gap-3">
            {userRole === "client" &&
              onPayNow &&
              !isPaid &&
              !isCancelled &&
              invoice.balanceDue > 0 && (
                <Button
                  size="sm"
                  onClick={() => {
                    onClose();
                    onPayNow(invoice);
                  }}
                  className="rounded-none font-mono text-xs cursor-pointer bg-emerald-500 text-black hover:bg-emerald-400 font-semibold"
                >
                  <CreditCard className="size-3.5 mr-1.5" />
                  Pay Now ({invoice.currency} {invoice.balanceDue.toLocaleString()})
                </Button>
              )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="rounded-none font-mono text-xs cursor-pointer"
            >
              <Download className="size-3.5 mr-1.5" />
              Download / Print Statement
            </Button>
            <Button
              size="sm"
              onClick={onClose}
              className="rounded-none font-mono text-xs cursor-pointer bg-foreground text-background hover:bg-foreground/90"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
