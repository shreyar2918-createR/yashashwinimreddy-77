import { useState, useEffect, useMemo } from "react";
import {
  Receipt,
  Plus,
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
  Send,
  Trash2,
  Edit3,
  CreditCard,
  Ban,
  X,
  PlusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  subscribeAllInvoices,
  createInvoice,
  updateInvoice,
  sendInvoice,
  recordInvoicePayment,
  cancelInvoice,
  deleteInvoice,
  generateNextInvoiceNumber,
  calculateInvoiceTotals,
  type CreateInvoiceInput,
  type UpdateInvoiceInput,
} from "@/services/invoiceService";
import { fetchAllClients, type AdminClientProfile } from "@/services/adminDashboard";
import { InvoiceModal } from "./InvoiceModal";
import type { Invoice, InvoiceLineItem, InvoiceStatus } from "@/lib/types";
import type { AdminRecord } from "@/services/adminAuth";

interface AdminInvoicesSectionProps {
  admin: AdminRecord;
}

export function AdminInvoicesSection({ admin }: AdminInvoicesSectionProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<AdminClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  // Modals
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [cancelModalInvoice, setCancelModalInvoice] = useState<Invoice | null>(null);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);
  const [deleteModalInvoice, setDeleteModalInvoice] = useState<Invoice | null>(null);

  // Creation/Edit Form State
  const [targetClientId, setTargetClientId] = useState("");
  const [invoiceNumberInput, setInvoiceNumberInput] = useState("");
  const [projectNameInput, setProjectNameInput] = useState("");
  const [issueDateInput, setIssueDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [dueDateInput, setDueDateInput] = useState("");
  const [currencyInput, setCurrencyInput] = useState("USD");
  const [taxRateInput, setTaxRateInput] = useState<number>(0);
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [notesInput, setNotesInput] = useState("");
  const [termsInput, setTermsInput] = useState(
    "Net 15 days upon receipt. Remittance via official corporate wire or portal gateway.",
  );
  const [statusInput, setStatusInput] = useState<InvoiceStatus>("Draft");

  // Line items state
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    {
      id: "1",
      description: "Architectural Design Sprint - Phase 1",
      quantity: 1,
      unitPrice: 12000,
      amount: 12000,
    },
  ]);

  // Operational states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Cancel Modal Form State
  const [cancellationReasonInput, setCancellationReasonInput] = useState("");

  // Payment Recording Form State
  const [paymentAmountInput, setPaymentAmountInput] = useState<number>(0);

  // Subscribe to real-time invoices
  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeAllInvoices(
      (data) => {
        setInvoices(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Admin invoices subscription error:", err);
        setError("Unable to sync invoices from Firestore.");
        setIsLoading(false);
      },
    );

    // Fetch verified clients
    fetchAllClients()
      .then((cls) => setClients(cls))
      .catch((e) => console.warn("Failed to load clients roster:", e));

    return () => unsub();
  }, []);

  // Compute live calculations for create/edit form
  const formCalculations = useMemo(() => {
    return calculateInvoiceTotals(lineItems, taxRateInput, discountInput, 0);
  }, [lineItems, taxRateInput, discountInput]);

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

      // Client filter
      if (clientFilter !== "all") {
        if (inv.clientId !== clientFilter && inv.clientUid !== clientFilter) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const numMatch = (inv.invoiceNumber || inv.number || "").toLowerCase().includes(q);
        const clientMatch = (inv.clientName || inv.clientEmail || "").toLowerCase().includes(q);
        const projMatch = (inv.projectName || "").toLowerCase().includes(q);
        const notesMatch = (inv.notes || "").toLowerCase().includes(q);
        const itemMatch = inv.lineItems.some((li) => li.description.toLowerCase().includes(q));
        if (!numMatch && !clientMatch && !projMatch && !notesMatch && !itemMatch) {
          return false;
        }
      }

      return true;
    });
  }, [invoices, statusFilter, clientFilter, searchQuery]);

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

  // Open Create Modal
  const handleOpenCreateModal = async () => {
    setEditingInvoice(null);
    setFormError(null);
    const generated = await generateNextInvoiceNumber();
    setInvoiceNumberInput(generated);
    setTargetClientId(clients[0]?.uid || clients[0]?.id || "");
    setProjectNameInput("");
    setIssueDateInput(new Date().toISOString().split("T")[0]);

    // Default due date: +15 days
    const defaultDue = new Date();
    defaultDue.setDate(defaultDue.getDate() + 15);
    setDueDateInput(defaultDue.toISOString().split("T")[0]);

    setCurrencyInput("USD");
    setTaxRateInput(0);
    setDiscountInput(0);
    setStatusInput("Draft");
    setNotesInput("");
    setTermsInput(
      "Net 15 days upon receipt. Remittance via official corporate wire or portal gateway.",
    );
    setLineItems([
      {
        id: "1",
        description: "Custom Software Architecture & Systems Design",
        quantity: 1,
        unitPrice: 12000,
        amount: 12000,
      },
    ]);
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (inv: Invoice) => {
    setEditingInvoice(inv);
    setFormError(null);
    setTargetClientId(inv.clientId || inv.clientUid || "");
    setInvoiceNumberInput(inv.invoiceNumber || inv.number);
    setProjectNameInput(inv.projectName || "");
    setIssueDateInput(inv.issueDate || new Date().toISOString().split("T")[0]);
    setDueDateInput(inv.dueDate || "");
    setCurrencyInput(inv.currency || "USD");
    setTaxRateInput(inv.taxRate || 0);
    setDiscountInput(inv.discount || 0);
    setStatusInput(inv.status || "Draft");
    setNotesInput(inv.notes || "");
    setTermsInput(inv.terms || "");
    setLineItems(
      inv.lineItems && inv.lineItems.length > 0
        ? inv.lineItems.map((li, i) => ({ ...li, id: li.id || `item-${i + 1}` }))
        : [
            {
              id: "1",
              description: "Design & Development Scope",
              quantity: 1,
              unitPrice: 5000,
              amount: 5000,
            },
          ],
    );
    setIsCreateModalOpen(true);
  };

  // Add line item
  const handleAddLineItem = () => {
    setLineItems((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        description: "",
        quantity: 1,
        unitPrice: 1000,
        amount: 1000,
      },
    ]);
  };

  // Update line item
  const handleUpdateLineItem = (
    index: number,
    field: keyof InvoiceLineItem,
    value: string | number,
  ) => {
    setLineItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index] };

      if (field === "description") {
        target.description = String(value);
      } else if (field === "quantity") {
        target.quantity = Math.max(1, Number(value) || 1);
        target.amount = target.quantity * target.unitPrice;
      } else if (field === "unitPrice") {
        target.unitPrice = Math.max(0, Number(value) || 0);
        target.amount = target.quantity * target.unitPrice;
      }

      copy[index] = target;
      return copy;
    });
  };

  // Remove line item
  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length <= 1) {
      setFormError("At least one line item is required.");
      return;
    }
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Create / Edit Invoice
  const handleSubmitInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validation
    if (!targetClientId) {
      setFormError("Please select a verified client account.");
      return;
    }
    if (!invoiceNumberInput.trim()) {
      setFormError("Invoice number is required.");
      return;
    }
    if (!lineItems || lineItems.length === 0) {
      setFormError("Please include at least one valid line item.");
      return;
    }
    for (const li of lineItems) {
      if (!li.description.trim()) {
        setFormError("All line items must have a clear description.");
        return;
      }
      if (li.quantity <= 0) {
        setFormError("Line item quantity must be greater than zero.");
        return;
      }
      if (li.unitPrice < 0) {
        setFormError("Line item unit price cannot be negative.");
        return;
      }
    }

    // Check duplicate invoice number if creating new
    if (!editingInvoice) {
      const isDuplicate = invoices.some(
        (inv) =>
          (inv.invoiceNumber || inv.number).toLowerCase().trim() ===
          invoiceNumberInput.toLowerCase().trim(),
      );
      if (isDuplicate) {
        setFormError(
          `Invoice number "${invoiceNumberInput}" already exists. Please choose a unique number.`,
        );
        return;
      }
    }

    const selectedClient = clients.find((c) => c.uid === targetClientId || c.id === targetClientId);

    setIsSubmitting(true);
    try {
      if (editingInvoice) {
        // Update existing invoice
        const updatePayload: UpdateInvoiceInput = {
          invoiceId: editingInvoice.id,
          invoiceNumber: invoiceNumberInput.trim(),
          projectName: projectNameInput.trim() || undefined,
          issueDate: issueDateInput,
          dueDate: dueDateInput,
          lineItems,
          taxRate: taxRateInput,
          discount: discountInput,
          currency: currencyInput,
          status: statusInput,
          notes: notesInput.trim(),
          terms: termsInput.trim(),
          updatedByAdminName: admin.name,
        };
        await updateInvoice(updatePayload);
        setSuccessBanner(`Invoice ${invoiceNumberInput} updated successfully.`);
      } else {
        // Create new invoice
        const createPayload: CreateInvoiceInput = {
          invoiceNumber: invoiceNumberInput.trim(),
          clientId: targetClientId,
          clientUid: targetClientId,
          clientName: selectedClient?.name || "Client",
          clientEmail: selectedClient?.email || "",
          projectName: projectNameInput.trim() || "Architecture & Systems Engineering",
          issueDate: issueDateInput,
          dueDate: dueDateInput,
          lineItems,
          taxRate: taxRateInput,
          discount: discountInput,
          currency: currencyInput,
          status: statusInput,
          notes: notesInput.trim(),
          terms: termsInput.trim(),
          createdByAdminUid: admin.uid,
          createdByAdminName: admin.name,
          createdByAdminEmail: admin.email,
        };
        await createInvoice(createPayload);
        setSuccessBanner(`Invoice ${invoiceNumberInput} created successfully.`);
      }

      setIsCreateModalOpen(false);
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: unknown) {
      console.error("Failed to save invoice:", err);
      setFormError(err instanceof Error ? err.message : "Failed to persist invoice to Firestore.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dispatch / Mark as Sent
  const handleSendInvoice = async (inv: Invoice) => {
    try {
      await sendInvoice(inv.id, admin.name);
      setSuccessBanner(`Invoice ${inv.invoiceNumber || inv.number} marked as officially sent.`);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to mark invoice as sent.");
    }
  };

  // Record Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModalInvoice) return;
    if (paymentAmountInput <= 0) {
      setFormError("Payment amount must be greater than zero.");
      return;
    }
    if (paymentAmountInput > paymentModalInvoice.balanceDue) {
      setFormError(
        `Payment amount cannot exceed the remaining balance due (${paymentModalInvoice.currency} ${paymentModalInvoice.balanceDue}).`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      await recordInvoicePayment(paymentModalInvoice, paymentAmountInput, admin.name);
      setSuccessBanner(
        `Payment of ${paymentModalInvoice.currency} ${paymentAmountInput} recorded for ${paymentModalInvoice.invoiceNumber || paymentModalInvoice.number}.`,
      );
      setPaymentModalInvoice(null);
      setPaymentAmountInput(0);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Invoice
  const handleCancelInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelModalInvoice) return;
    if (!cancellationReasonInput.trim()) {
      setFormError("A recorded reason is strictly required to void/cancel an invoice.");
      return;
    }

    setIsSubmitting(true);
    try {
      await cancelInvoice({
        invoiceId: cancelModalInvoice.id,
        cancellationReason: cancellationReasonInput.trim(),
        cancelledBy: `${admin.name} (${admin.email})`,
      });
      setSuccessBanner(
        `Invoice ${cancelModalInvoice.invoiceNumber || cancelModalInvoice.number} has been cancelled.`,
      );
      setCancelModalInvoice(null);
      setCancellationReasonInput("");
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Failed to cancel invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete invoice (draft only)
  const confirmDeleteInvoice = async () => {
    if (!deleteModalInvoice) return;
    setIsSubmitting(true);
    try {
      await deleteInvoice(deleteModalInvoice.id);
      setSuccessBanner(
        `Invoice ${deleteModalInvoice.invoiceNumber || deleteModalInvoice.number} deleted.`,
      );
      setDeleteModalInvoice(null);
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete invoice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Banner Alerts */}
      {successBanner && (
        <div className="border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center justify-between text-xs text-emerald-400 font-mono">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
            <span>{successBanner}</span>
          </div>
          <button
            onClick={() => setSuccessBanner(null)}
            className="cursor-pointer text-emerald-400 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-medium tracking-tight">Invoice Management</h2>
            <span className="border border-border bg-card px-2.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              Billing Ledger
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            Create, issue, track, and record payments for client project invoices and engineering
            retainers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleOpenCreateModal}
            className="rounded-none font-mono text-xs cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-8 px-3"
          >
            <Plus className="size-3.5 mr-1.5" />
            New Invoice
          </Button>
        </div>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced */}
        <div className="border border-border bg-card p-5 space-y-1">
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
            Gross ledger value ({metrics.totalCount} statements)
          </p>
        </div>

        {/* Total Settled / Paid */}
        <div className="border border-border bg-card p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Total Paid
          </span>
          <p className="font-display text-2xl font-normal text-emerald-400">
            {currencySymbol}{" "}
            {metrics.totalPaid.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="font-mono text-[10px] text-muted-foreground">
            Received & settled collections
          </p>
        </div>

        {/* Outstanding Balance */}
        <div className="border border-border bg-card p-5 space-y-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
            Outstanding
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
            Unsettled milestone balances
          </p>
        </div>

        {/* Overdue Alert */}
        <div
          className={`border p-5 space-y-1 ${metrics.overdueCount > 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"}`}
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
              : "All accounts on schedule"}
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by invoice #, client name, email, project or item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 font-mono text-xs rounded-none border-border bg-card text-foreground"
          />
        </div>

        {/* Client Account Filter */}
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:outline-none cursor-pointer"
        >
          <option value="all">All Clients ({clients.length})</option>
          {clients.map((c) => (
            <option key={c.uid || c.id} value={c.uid || c.id}>
              {c.name} ({c.email || c.companyName || "Client"})
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 font-mono text-xs shrink-0">
          {[
            { id: "all", label: "All" },
            { id: "draft", label: "Draft" },
            { id: "sent", label: "Sent" },
            { id: "unpaid", label: "Unpaid" },
            { id: "overdue", label: "Overdue" },
            { id: "paid", label: "Paid" },
            { id: "cancelled", label: "Cancelled" },
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

      {/* Invoices Table */}
      {isLoading ? (
        <div className="border border-border bg-card p-16 text-center">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-3 font-mono text-xs text-muted-foreground uppercase tracking-widest">
            Loading billing records from Firestore...
          </p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="border border-border bg-card p-16 text-center">
          <Receipt className="size-10 mx-auto text-muted-foreground/40" />
          <h3 className="mt-4 font-display text-lg">No Invoices Found</h3>
          <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
            {searchQuery || statusFilter !== "all" || clientFilter !== "all"
              ? "No billing records match your current filters."
              : "Generate project billing statements, milestone invoices, and retainer records using the 'New Invoice' button above."}
          </p>
        </div>
      ) : (
        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="border-b border-border bg-surface/50 font-mono uppercase tracking-wider text-[10px] text-muted-foreground">
              <tr>
                <th className="p-3.5 sm:px-4">Invoice #</th>
                <th className="p-3.5 sm:px-4">Client</th>
                <th className="p-3.5 sm:px-4">Project</th>
                <th className="p-3.5 sm:px-4">Issue Date</th>
                <th className="p-3.5 sm:px-4">Due Date</th>
                <th className="p-3.5 sm:px-4 text-right">Total</th>
                <th className="p-3.5 sm:px-4 text-right">Balance Due</th>
                <th className="p-3.5 sm:px-4 text-center">Status</th>
                <th className="p-3.5 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredInvoices.map((inv) => {
                const isPaid = inv.status === "Paid";
                const isPartiallyPaid = inv.status === "Partially Paid";
                const isOverdue = inv.status === "Overdue";
                const isCancelled = inv.status === "Cancelled";
                const isDraft = inv.status === "Draft";

                return (
                  <tr key={inv.id} className="hover:bg-surface/30 transition-colors">
                    <td className="p-3.5 sm:px-4 font-semibold text-foreground">
                      {inv.invoiceNumber || inv.number}
                    </td>
                    <td className="p-3.5 sm:px-4 max-w-[180px] truncate">
                      <div className="font-sans font-medium text-foreground truncate">
                        {inv.clientName || "Client"}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {inv.clientEmail || inv.clientId?.slice(0, 10)}
                      </div>
                    </td>
                    <td className="p-3.5 sm:px-4 max-w-[180px] truncate">
                      <span className="font-sans text-muted-foreground">
                        {inv.projectName || "Custom Architecture"}
                      </span>
                    </td>
                    <td className="p-3.5 sm:px-4 text-muted-foreground text-[11px]">
                      {inv.issueDate || "N/A"}
                    </td>
                    <td className="p-3.5 sm:px-4 text-[11px]">
                      <span
                        className={
                          isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"
                        }
                      >
                        {inv.dueDate || "Upon Receipt"}
                      </span>
                    </td>
                    <td className="p-3.5 sm:px-4 text-right font-medium text-foreground">
                      {inv.currency}{" "}
                      {inv.totalAmount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="p-3.5 sm:px-4 text-right font-semibold">
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
                    <td className="p-3.5 sm:px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] uppercase border ${
                          isPaid
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                            : isPartiallyPaid
                              ? "border-blue-500/40 bg-blue-500/10 text-blue-400"
                              : isOverdue
                                ? "border-destructive/40 bg-destructive/10 text-destructive font-semibold"
                                : isCancelled
                                  ? "border-border bg-card text-muted-foreground line-through"
                                  : isDraft
                                    ? "border-border bg-background text-muted-foreground"
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
                    <td className="p-3.5 sm:px-4 text-right space-x-1 whitespace-nowrap">
                      {/* View / Print modal */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewInvoice(inv)}
                        className="rounded-none text-[11px] h-7 px-2 cursor-pointer text-muted-foreground hover:text-foreground"
                        title="View printable invoice"
                      >
                        <Eye className="size-3.5" />
                      </Button>

                      {/* Edit (allowed for draft or unpaid) */}
                      {!isCancelled && !isPaid && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(inv)}
                          className="rounded-none text-[11px] h-7 px-2 cursor-pointer text-muted-foreground hover:text-foreground"
                          title="Edit invoice"
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                      )}

                      {/* Send / Dispatch */}
                      {isDraft && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendInvoice(inv)}
                          className="rounded-none text-[10px] h-7 px-2 cursor-pointer border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                          title="Mark as officially sent to client"
                        >
                          <Send className="size-3 mr-1" />
                          Send
                        </Button>
                      )}

                      {/* Record payment */}
                      {!isCancelled && !isPaid && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setFormError(null);
                            setPaymentModalInvoice(inv);
                            setPaymentAmountInput(inv.balanceDue);
                          }}
                          className="rounded-none text-[10px] h-7 px-2 cursor-pointer border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                          title="Record payment"
                        >
                          <CreditCard className="size-3 mr-1" />
                          Payment
                        </Button>
                      )}

                      {/* Cancel */}
                      {!isCancelled && !isPaid && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFormError(null);
                            setCancelModalInvoice(inv);
                            setCancellationReasonInput("");
                          }}
                          className="rounded-none text-[10px] h-7 px-2 cursor-pointer text-muted-foreground hover:text-destructive"
                          title="Cancel / void invoice"
                        >
                          <Ban className="size-3 mr-1" />
                          Cancel
                        </Button>
                      )}

                      {/* Delete Draft only */}
                      {isDraft && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteModalInvoice(inv)}
                          className="rounded-none text-[11px] h-7 px-2 cursor-pointer text-muted-foreground hover:text-destructive"
                          title="Delete draft invoice"
                        >
                          <Trash2 className="size-3.5" />
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

      {/* Printable Modal View */}
      {viewInvoice && (
        <InvoiceModal invoice={viewInvoice} onClose={() => setViewInvoice(null)} userRole="admin" />
      )}

      {/* CREATE / EDIT INVOICE MODAL */}
      {isCreateModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => !isSubmitting && setIsCreateModalOpen(false)}
        >
          <div
            className="relative w-full max-w-3xl bg-surface border border-border shadow-2xl text-foreground my-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <h3 className="font-display text-lg font-medium">
                  {editingInvoice
                    ? `Edit Invoice: ${editingInvoice.invoiceNumber || editingInvoice.number}`
                    : "Create New Invoice"}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                  VINORA Billing Statement Generator
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={() => setIsCreateModalOpen(false)}
                className="rounded-none size-8 p-0 cursor-pointer text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </Button>
            </div>

            {/* Form Error Banner */}
            {formError && (
              <div className="border-b border-destructive/40 bg-destructive/10 px-6 py-3 text-xs text-destructive font-mono flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Form Body */}
            <form
              onSubmit={handleSubmitInvoice}
              className="p-6 space-y-6 max-h-[75vh] overflow-y-auto"
            >
              {/* Client & Invoice Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                {/* Client Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Target Client Account *
                  </label>
                  <select
                    value={targetClientId}
                    disabled={isSubmitting || !!editingInvoice}
                    onChange={(e) => setTargetClientId(e.target.value)}
                    required
                    className="w-full border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-foreground"
                  >
                    <option value="">-- Select Verified Client --</option>
                    {clients.map((c) => (
                      <option key={c.uid || c.id} value={c.uid || c.id}>
                        {c.name} — {c.email || c.companyName || "Client"}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Invoice Number */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Invoice Number *
                  </label>
                  <Input
                    value={invoiceNumberInput}
                    disabled={isSubmitting}
                    onChange={(e) => setInvoiceNumberInput(e.target.value)}
                    required
                    placeholder="e.g. VIN-2026-0001"
                    className="rounded-none font-mono text-xs border-border bg-card text-foreground"
                  />
                </div>

                {/* Project Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Project / Engagement Name
                  </label>
                  <Input
                    value={projectNameInput}
                    disabled={isSubmitting}
                    onChange={(e) => setProjectNameInput(e.target.value)}
                    placeholder="e.g. Platform Architecture & Core Implementation"
                    className="rounded-none font-mono text-xs border-border bg-card text-foreground"
                  />
                </div>

                {/* Currency */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Currency *
                  </label>
                  <select
                    value={currencyInput}
                    disabled={isSubmitting}
                    onChange={(e) => setCurrencyInput(e.target.value)}
                    className="w-full border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-foreground"
                  >
                    <option value="USD">USD ($) — United States Dollar</option>
                    <option value="EUR">EUR (€) — Euro</option>
                    <option value="GBP">GBP (£) — British Pound</option>
                    <option value="INR">INR (₹) — Indian Rupee</option>
                    <option value="SGD">SGD ($) — Singapore Dollar</option>
                    <option value="AED">AED (د.إ) — UAE Dirham</option>
                  </select>
                </div>

                {/* Issue Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Issue Date *
                  </label>
                  <Input
                    type="date"
                    value={issueDateInput}
                    disabled={isSubmitting}
                    onChange={(e) => setIssueDateInput(e.target.value)}
                    required
                    className="rounded-none font-mono text-xs border-border bg-card text-foreground"
                  />
                </div>

                {/* Due Date */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Due Date *
                  </label>
                  <Input
                    type="date"
                    value={dueDateInput}
                    disabled={isSubmitting}
                    onChange={(e) => setDueDateInput(e.target.value)}
                    required
                    className="rounded-none font-mono text-xs border-border bg-card text-foreground"
                  />
                </div>
              </div>

              {/* Line Items Builder */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs uppercase tracking-wider text-foreground font-semibold">
                    Itemized Line Items
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddLineItem}
                    disabled={isSubmitting}
                    className="rounded-none font-mono text-[10px] h-7 px-2.5 cursor-pointer border-border hover:border-foreground"
                  >
                    <PlusCircle className="size-3 mr-1" />
                    Add Item
                  </Button>
                </div>

                <div className="border border-border bg-card divide-y divide-border">
                  {lineItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 grid grid-cols-12 gap-3 items-center text-xs font-mono"
                    >
                      <div className="col-span-12 sm:col-span-6 space-y-1">
                        <label className="text-[9px] uppercase tracking-wider text-muted-foreground">
                          Description
                        </label>
                        <Input
                          value={item.description}
                          disabled={isSubmitting}
                          onChange={(e) => handleUpdateLineItem(idx, "description", e.target.value)}
                          placeholder="Deliverable / Milestone description..."
                          required
                          className="rounded-none font-mono text-xs border-border bg-background text-foreground h-8"
                        />
                      </div>

                      <div className="col-span-4 sm:col-span-2 space-y-1">
                        <label className="text-[9px] uppercase tracking-wider text-muted-foreground">
                          Quantity
                        </label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          disabled={isSubmitting}
                          onChange={(e) => handleUpdateLineItem(idx, "quantity", e.target.value)}
                          required
                          className="rounded-none font-mono text-xs border-border bg-background text-foreground h-8"
                        />
                      </div>

                      <div className="col-span-5 sm:col-span-3 space-y-1">
                        <label className="text-[9px] uppercase tracking-wider text-muted-foreground">
                          Unit Price ({currencyInput})
                        </label>
                        <Input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unitPrice}
                          disabled={isSubmitting}
                          onChange={(e) => handleUpdateLineItem(idx, "unitPrice", e.target.value)}
                          required
                          className="rounded-none font-mono text-xs border-border bg-background text-foreground h-8"
                        />
                      </div>

                      <div className="col-span-3 sm:col-span-1 flex items-end justify-end pt-5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={isSubmitting || lineItems.length <= 1}
                          onClick={() => handleRemoveLineItem(idx)}
                          className="rounded-none size-8 p-0 cursor-pointer text-muted-foreground hover:text-destructive"
                          title="Remove item"
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax & Discount Adjustments */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border text-xs font-mono">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Tax Rate (%)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={taxRateInput}
                    disabled={isSubmitting}
                    onChange={(e) => setTaxRateInput(Number(e.target.value) || 0)}
                    placeholder="e.g. 18 for 18% GST/VAT"
                    className="rounded-none font-mono text-xs border-border bg-card text-foreground"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Discount Amount ({currencyInput})
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    value={discountInput}
                    disabled={isSubmitting}
                    onChange={(e) => setDiscountInput(Number(e.target.value) || 0)}
                    placeholder="e.g. 500"
                    className="rounded-none font-mono text-xs border-border bg-card text-foreground"
                  />
                </div>
              </div>

              {/* Live Totals Summary Card */}
              <div className="border border-border p-4 bg-card/60 space-y-2 font-mono text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="text-foreground">
                    {currencyInput}{" "}
                    {formCalculations.subtotal.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {formCalculations.tax > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({formCalculations.taxRate}%):</span>
                    <span className="text-foreground">
                      + {currencyInput}{" "}
                      {formCalculations.tax.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                {formCalculations.discount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Discount:</span>
                    <span>
                      - {currencyInput}{" "}
                      {formCalculations.discount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
                <div className="border-t border-border pt-2 flex justify-between font-sans text-sm font-semibold text-foreground">
                  <span>Total Amount:</span>
                  <span className="font-mono text-base">
                    {currencyInput}{" "}
                    {formCalculations.totalAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              {/* Status & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Initial Status
                  </label>
                  <select
                    value={statusInput}
                    disabled={isSubmitting}
                    onChange={(e) => setStatusInput(e.target.value as InvoiceStatus)}
                    className="w-full border border-border bg-card px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-foreground"
                  >
                    <option value="Draft">Draft (Internal review, client cannot pay yet)</option>
                    <option value="Sent">Sent (Issued to client portal)</option>
                    <option value="Paid">Paid (Pre-settled via wire)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                    Payment Terms
                  </label>
                  <Input
                    value={termsInput}
                    disabled={isSubmitting}
                    onChange={(e) => setTermsInput(e.target.value)}
                    placeholder="e.g. Net 15 days upon receipt."
                    className="rounded-none font-mono text-xs border-border bg-card text-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-xs font-mono">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Notes & Special Instructions (Visible on Invoice)
                </label>
                <textarea
                  rows={2}
                  value={notesInput}
                  disabled={isSubmitting}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="e.g. Phase 1 milestone deliverables completed and reviewed. Wire details attached."
                  className="w-full border border-border bg-card p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground"
                />
              </div>

              {/* Modal Footer */}
              <div className="border-t border-border pt-4 flex items-center justify-end gap-3 font-mono text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-none cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-semibold"
                >
                  {isSubmitting ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle2 className="size-3.5 mr-1.5" />
                  )}
                  {editingInvoice ? "Save Changes" : "Create Invoice"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {paymentModalInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => !isSubmitting && setPaymentModalInvoice(null)}
        >
          <div
            className="relative w-full max-w-md bg-surface border border-border shadow-2xl text-foreground my-8 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-semibold">Record Payment</h3>
                <p className="text-[11px] font-mono text-muted-foreground">
                  {paymentModalInvoice.invoiceNumber || paymentModalInvoice.number} •{" "}
                  {paymentModalInvoice.clientName}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPaymentModalInvoice(null)}
                className="rounded-none size-7 p-0 cursor-pointer"
              >
                <X className="size-4" />
              </Button>
            </div>

            {formError && (
              <div className="p-3 border border-destructive/40 bg-destructive/10 text-xs font-mono text-destructive">
                {formError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4 text-xs font-mono">
              <div className="border border-border p-3 bg-card space-y-1">
                <div className="flex justify-between text-muted-foreground">
                  <span>Total Invoiced:</span>
                  <span>
                    {paymentModalInvoice.currency}{" "}
                    {paymentModalInvoice.totalAmount.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Already Paid:</span>
                  <span>
                    {paymentModalInvoice.currency} {paymentModalInvoice.amountPaid.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-foreground font-semibold pt-1 border-t border-border">
                  <span>Remaining Balance:</span>
                  <span>
                    {paymentModalInvoice.currency} {paymentModalInvoice.balanceDue.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Payment Amount to Record ({paymentModalInvoice.currency}) *
                </label>
                <Input
                  type="number"
                  min="0.01"
                  max={paymentModalInvoice.balanceDue}
                  step="any"
                  value={paymentAmountInput}
                  disabled={isSubmitting}
                  onChange={(e) => setPaymentAmountInput(Number(e.target.value) || 0)}
                  required
                  className="rounded-none font-mono text-xs border-border bg-card text-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setPaymentModalInvoice(null)}
                  className="rounded-none cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="rounded-none cursor-pointer bg-emerald-500 text-black hover:bg-emerald-400 font-semibold"
                >
                  {isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                  Confirm Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CANCEL INVOICE MODAL */}
      {cancelModalInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={() => !isSubmitting && setCancelModalInvoice(null)}
        >
          <div
            className="relative w-full max-w-md bg-surface border border-destructive/40 shadow-2xl text-foreground my-8 p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5 shrink-0" />
                <h3 className="font-display text-base font-semibold">Cancel Invoice</h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCancelModalInvoice(null)}
                className="rounded-none size-7 p-0 cursor-pointer"
              >
                <X className="size-4" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Cancelling{" "}
              <span className="font-semibold font-mono text-foreground">
                {cancelModalInvoice.invoiceNumber || cancelModalInvoice.number}
              </span>{" "}
              will void this statement on the client ledger. A cancellation reason must be recorded
              for compliance.
            </p>

            {formError && (
              <div className="p-3 border border-destructive/40 bg-destructive/10 text-xs font-mono text-destructive">
                {formError}
              </div>
            )}

            <form onSubmit={handleCancelInvoice} className="space-y-4 text-xs font-mono">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground block">
                  Cancellation Reason *
                </label>
                <textarea
                  rows={3}
                  value={cancellationReasonInput}
                  disabled={isSubmitting}
                  onChange={(e) => setCancellationReasonInput(e.target.value)}
                  placeholder="e.g. Scope was consolidated into a subsequent statement or cancelled by mutual agreement."
                  required
                  className="w-full border border-border bg-card p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-destructive"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setCancelModalInvoice(null)}
                  className="rounded-none cursor-pointer"
                >
                  Go Back
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="rounded-none cursor-pointer bg-destructive text-white hover:bg-destructive/90 font-semibold"
                >
                  {isSubmitting ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                  Confirm Cancellation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE DRAFT INVOICE MODAL */}
      {deleteModalInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => !isSubmitting && setDeleteModalInvoice(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-destructive/40 bg-card p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5 shrink-0" />
              <h3 className="font-display text-base font-semibold">Delete Draft Invoice?</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Permanently delete draft invoice{" "}
              <span className="font-mono font-semibold text-foreground">
                {deleteModalInvoice.invoiceNumber || deleteModalInvoice.number}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSubmitting}
                onClick={() => setDeleteModalInvoice(null)}
                className="rounded-lg cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting}
                onClick={confirmDeleteInvoice}
                className="rounded-lg cursor-pointer bg-destructive text-white hover:bg-destructive/90"
              >
                {isSubmitting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                Delete Draft
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
