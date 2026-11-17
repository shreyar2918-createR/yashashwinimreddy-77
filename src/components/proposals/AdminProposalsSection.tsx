import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Check,
  X,
  Calendar,
  DollarSign,
  Edit3,
  Trash2,
  User,
  Building2,
  ChevronRight,
  Eye,
  AlertTriangle,
  Receipt,
  Layers,
  Percent,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  subscribeAllProposals,
  createProposal,
  updateProposal,
  withdrawProposal,
  deleteProposal,
  type CreateProposalInput,
  type UpdateProposalInput,
} from "@/services/proposalService";
import { createInvoice, generateNextInvoiceNumber } from "@/services/invoiceService";
import { fetchAllClients, type AdminClientProfile } from "@/services/adminDashboard";
import type {
  Proposal,
  CanonicalProposalStatus,
  ProposalBudgetItem,
  ProposalMilestonePlanItem,
  PaymentPlanType,
  ProposalPaymentStatus,
  InvoiceLineItem,
} from "@/lib/types";
import type { AdminRecord } from "@/services/adminAuth";

interface AdminProposalsSectionProps {
  admin: AdminRecord;
}

export function AdminProposalsSection({ admin }: AdminProposalsSectionProps) {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [clients, setClients] = useState<AdminClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProposal, setEditingProposal] = useState<Proposal | null>(null);

  // Modal Form Inputs: Project Info
  const [targetClientId, setTargetClientId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [proposalTitle, setProposalTitle] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [scopeDetails, setScopeDetails] = useState("");
  const [deliverablesInput, setDeliverablesInput] = useState("");
  const [timelineInput, setTimelineInput] = useState("6-8 weeks sprint delivery");
  const [revisionsInput, setRevisionsInput] = useState(
    "Up to 3 architectural review iterations per milestone sprint",
  );
  const [currencyInput, setCurrencyInput] = useState("INR");
  const [validityDateInput, setValidityDateInput] = useState("");
  const [termsInput, setTermsInput] = useState(
    "Standard VINORA intellectual property transfer upon final milestone settlement. 30 days post-launch warranty.",
  );
  const [notesInput, setNotesInput] = useState("");

  // Modal Form Inputs: Dynamic Project Budget Breakdown
  const [budgetItems, setBudgetItems] = useState<ProposalBudgetItem[]>([
    { id: "bgt-1", description: "UI/UX Design & Prototyping", amount: 15000 },
    { id: "bgt-2", description: "Frontend Development & Interactive System", amount: 25000 },
    { id: "bgt-3", description: "Backend Architecture & API Gateway", amount: 20000 },
    { id: "bgt-4", description: "Testing, QA & Deployment Staging", amount: 20000 },
  ]);
  const [taxRateInput, setTaxRateInput] = useState<number>(0);
  const [discountInput, setDiscountInput] = useState<number>(0);

  // Modal Form Inputs: Payment Plan
  const [paymentPlanType, setPaymentPlanType] = useState<PaymentPlanType>("milestone");
  const [milestones, setMilestones] = useState<ProposalMilestonePlanItem[]>([
    {
      id: "ms-1",
      name: "Milestone 1: 30% Advance (Project Kickoff)",
      percentage: 30,
      amount: 24000,
      dueTrigger: "Upon proposal signing & kickoff",
      status: "Pending",
    },
    {
      id: "ms-2",
      name: "Milestone 2: 40% UI/UX & Frontend Complete",
      percentage: 40,
      amount: 32000,
      dueTrigger: "Upon design approval & staging review",
      status: "Pending",
    },
    {
      id: "ms-3",
      name: "Milestone 3: 30% Final Delivery & Deployment",
      percentage: 30,
      amount: 24000,
      dueTrigger: "Upon final acceptance & production launch",
      status: "Pending",
    },
  ]);

  // Invoice Generation Option
  const [autoCreateInvoice, setAutoCreateInvoice] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // View Proposal Detail Modal
  const [viewingProposal, setViewingProposal] = useState<Proposal | null>(null);

  // Withdraw Modal State
  const [withdrawingProposal, setWithdrawingProposal] = useState<Proposal | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  // Delete Confirmation State
  const [deletingProposal, setDeletingProposal] = useState<Proposal | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Budget calculations
  const calculatedSubtotal = useMemo(() => {
    return budgetItems.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);
  }, [budgetItems]);

  const calculatedTax = useMemo(() => {
    const rate = Math.max(0, Number(taxRateInput) || 0);
    return Number(((calculatedSubtotal * rate) / 100).toFixed(2));
  }, [calculatedSubtotal, taxRateInput]);

  const calculatedTotal = useMemo(() => {
    const discount = Math.max(0, Number(discountInput) || 0);
    return Math.max(0, Number((calculatedSubtotal + calculatedTax - discount).toFixed(2)));
  }, [calculatedSubtotal, calculatedTax, discountInput]);

  // Milestone sum metrics
  const milestonePercentageSum = useMemo(() => {
    return milestones.reduce((acc, m) => acc + (Number(m.percentage) || 0), 0);
  }, [milestones]);

  const milestoneAmountSum = useMemo(() => {
    return milestones.reduce((acc, m) => acc + (Number(m.amount) || 0), 0);
  }, [milestones]);

  // Default validity date to 30 days from now (YYYY-MM-DD)
  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    setValidityDateInput(`${yyyy}-${mm}-${dd}`);
  }, []);

  // Load clients list for proposal target selection
  useEffect(() => {
    fetchAllClients()
      .then((cls) => {
        setClients(cls);
        if (cls.length > 0) {
          setTargetClientId((prev) => prev || cls[0].uid || cls[0].id);
        }
      })
      .catch((err) => {
        console.warn("Failed fetching clients for proposals section:", err);
      });
  }, []);

  // Real-time subscription to all proposals
  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeAllProposals(
      (data) => {
        setProposals(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Admin proposals subscription error:", err);
        setError("Unable to sync proposals from Firestore.");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // Sync milestone amounts when calculatedTotal changes if percentages are valid
  const syncMilestonesWithTotal = (targetTotal: number, currentMilestones = milestones) => {
    return currentMilestones.map((m) => {
      const pct = typeof m.percentage === "number" ? m.percentage : 0;
      const amt = Math.round((targetTotal * pct) / 100);
      return { ...m, amount: amt };
    });
  };

  // Budget Item Actions
  const handleAddBudgetItem = () => {
    const newItem: ProposalBudgetItem = {
      id: `bgt-${Date.now()}`,
      description: "Additional Deliverable / Engineering Scope",
      amount: 10000,
    };
    const updated = [...budgetItems, newItem];
    setBudgetItems(updated);
    const newSubtotal = updated.reduce((acc, it) => acc + it.amount, 0);
    const newTotal = Math.max(
      0,
      newSubtotal +
        (newSubtotal * (Number(taxRateInput) || 0)) / 100 -
        (Number(discountInput) || 0),
    );
    setMilestones((prev) => syncMilestonesWithTotal(newTotal, prev));
  };

  const handleUpdateBudgetItem = (
    id: string | undefined,
    field: "description" | "amount",
    value: string | number,
  ) => {
    const updated = budgetItems.map((item) => {
      if (item.id === id) {
        return {
          ...item,
          [field]: field === "amount" ? Math.max(0, Number(value) || 0) : value,
        };
      }
      return item;
    });
    setBudgetItems(updated);
    const newSubtotal = updated.reduce((acc, it) => acc + it.amount, 0);
    const newTotal = Math.max(
      0,
      newSubtotal +
        (newSubtotal * (Number(taxRateInput) || 0)) / 100 -
        (Number(discountInput) || 0),
    );
    setMilestones((prev) => syncMilestonesWithTotal(newTotal, prev));
  };

  const handleRemoveBudgetItem = (id: string | undefined) => {
    if (budgetItems.length <= 1) {
      setFormError("At least one budget line item is required.");
      return;
    }
    const updated = budgetItems.filter((item) => item.id !== id);
    setBudgetItems(updated);
    const newSubtotal = updated.reduce((acc, it) => acc + it.amount, 0);
    const newTotal = Math.max(
      0,
      newSubtotal +
        (newSubtotal * (Number(taxRateInput) || 0)) / 100 -
        (Number(discountInput) || 0),
    );
    setMilestones((prev) => syncMilestonesWithTotal(newTotal, prev));
  };

  // Milestone Actions
  const handleAddMilestone = () => {
    const nextIdx = milestones.length + 1;
    const remainingPct = Math.max(0, 100 - milestonePercentageSum);
    const newMs: ProposalMilestonePlanItem = {
      id: `ms-${Date.now()}`,
      name: `Milestone ${nextIdx}: Sprint Deliverables`,
      percentage: remainingPct,
      amount: Math.round((calculatedTotal * remainingPct) / 100),
      dueTrigger: "Upon milestone sprint sign-off",
      status: "Pending",
    };
    setMilestones([...milestones, newMs]);
  };

  const handleUpdateMilestone = (
    id: string | undefined,
    field: "name" | "percentage" | "amount" | "dueTrigger",
    value: string | number,
  ) => {
    const updated = milestones.map((m) => {
      if (m.id === id) {
        if (field === "percentage") {
          const pct = Math.max(0, Math.min(100, Number(value) || 0));
          return {
            ...m,
            percentage: pct,
            amount: Math.round((calculatedTotal * pct) / 100),
          };
        } else if (field === "amount") {
          const amt = Math.max(0, Number(value) || 0);
          const pct = calculatedTotal > 0 ? Math.round((amt / calculatedTotal) * 100) : 0;
          return {
            ...m,
            amount: amt,
            percentage: pct,
          };
        } else {
          return {
            ...m,
            [field]: value,
          };
        }
      }
      return m;
    });
    setMilestones(updated);
  };

  const handleRemoveMilestone = (id: string | undefined) => {
    if (milestones.length <= 1) {
      setFormError("At least one milestone is required in milestone payment mode.");
      return;
    }
    setMilestones(milestones.filter((m) => m.id !== id));
  };

  const applyMilestonePreset = (preset: "30-40-30" | "50-50" | "even") => {
    if (preset === "30-40-30") {
      const ms: ProposalMilestonePlanItem[] = [
        {
          id: `ms-1`,
          name: "Milestone 1: 30% Advance (Project Kickoff)",
          percentage: 30,
          amount: Math.round(calculatedTotal * 0.3),
          dueTrigger: "Upon proposal signing & kickoff",
          status: "Pending",
        },
        {
          id: `ms-2`,
          name: "Milestone 2: 40% UI/UX & Frontend Complete",
          percentage: 40,
          amount: Math.round(calculatedTotal * 0.4),
          dueTrigger: "Upon design approval & staging review",
          status: "Pending",
        },
        {
          id: `ms-3`,
          name: "Milestone 3: 30% Final Delivery & Deployment",
          percentage: 30,
          amount: Math.round(calculatedTotal * 0.3),
          dueTrigger: "Upon final acceptance & production launch",
          status: "Pending",
        },
      ];
      setMilestones(ms);
    } else if (preset === "50-50") {
      const ms: ProposalMilestonePlanItem[] = [
        {
          id: `ms-1`,
          name: "Milestone 1: 50% Upfront Retainer",
          percentage: 50,
          amount: Math.round(calculatedTotal * 0.5),
          dueTrigger: "Upon contract execution & kickoff",
          status: "Pending",
        },
        {
          id: `ms-2`,
          name: "Milestone 2: 50% Final Release & Handover",
          percentage: 50,
          amount: Math.round(calculatedTotal * 0.5),
          dueTrigger: "Upon final project handover",
          status: "Pending",
        },
      ];
      setMilestones(ms);
    } else if (preset === "even") {
      const count = milestones.length || 3;
      const basePct = Math.floor(100 / count);
      const remainder = 100 - basePct * count;
      const updated = milestones.map((m, idx) => {
        const pct = idx === count - 1 ? basePct + remainder : basePct;
        return {
          ...m,
          percentage: pct,
          amount: Math.round((calculatedTotal * pct) / 100),
        };
      });
      setMilestones(updated);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setEditingProposal(null);
    setProposalTitle("");
    setProjectName("");
    setProjectDescription("");
    setScopeDetails(
      "Comprehensive architectural blueprinting, cloud infrastructure provisioning, and production application engineering.",
    );
    setDeliverablesInput(
      "UI/UX Design Systems & Interactive Prototypes\nNext.js & Vite High-Performance Frontend\nSecure API Gateway & Cloud Functions\nAutomated CI/CD Pipeline & Staging Environment",
    );
    setTimelineInput("6-8 weeks sprint delivery");
    setRevisionsInput("Up to 3 architectural review iterations per milestone sprint");
    setTermsInput(
      "Standard VINORA intellectual property transfer upon final milestone settlement. 30 days post-launch warranty.",
    );
    setNotesInput("");
    setCurrencyInput("INR");
    setTaxRateInput(0);
    setDiscountInput(0);
    setAutoCreateInvoice(true);

    const initialBudget: ProposalBudgetItem[] = [
      { id: "bgt-1", description: "UI/UX Design", amount: 15000 },
      { id: "bgt-2", description: "Frontend Development", amount: 25000 },
      { id: "bgt-3", description: "Backend Development", amount: 20000 },
      { id: "bgt-4", description: "Testing & Deployment", amount: 20000 },
    ];
    setBudgetItems(initialBudget);
    setPaymentPlanType("milestone");
    setMilestones([
      {
        id: "ms-1",
        name: "Milestone 1: 30% Advance (Project Kickoff)",
        percentage: 30,
        amount: 24000,
        dueTrigger: "Upon proposal signing & kickoff",
        status: "Pending",
      },
      {
        id: "ms-2",
        name: "Milestone 2: 40% UI/UX & Frontend Complete",
        percentage: 40,
        amount: 32000,
        dueTrigger: "Upon design approval & staging review",
        status: "Pending",
      },
      {
        id: "ms-3",
        name: "Milestone 3: 30% Final Delivery & Deployment",
        percentage: 30,
        amount: 24000,
        dueTrigger: "Upon final acceptance & production launch",
        status: "Pending",
      },
    ]);

    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (p: Proposal) => {
    setEditingProposal(p);
    setTargetClientId(p.clientId);
    setProposalTitle(p.title || "");
    setProjectName(p.projectName || p.projectTitle || "");
    setProjectDescription(p.description || "");
    setScopeDetails(p.scope || "");
    setDeliverablesInput((p.deliverables || []).join("\n"));
    setTimelineInput(p.timeline || "6-8 weeks sprint schedule");
    setRevisionsInput(
      p.revisions || "Up to 3 architectural review iterations per milestone sprint",
    );
    setValidityDateInput(p.validityDate || "");
    setTermsInput(p.terms || "");
    setNotesInput(p.notes || "");
    setCurrencyInput(p.currency || "INR");

    if (p.budgetItems && p.budgetItems.length > 0) {
      setBudgetItems(p.budgetItems);
    } else {
      setBudgetItems([
        {
          id: "bgt-1",
          description: p.title || "Full Project Architectural Scope",
          amount: p.totalPrice || 50000,
        },
      ]);
    }

    setTaxRateInput(p.taxRate || 0);
    setDiscountInput(p.discount || 0);
    setPaymentPlanType(p.paymentPlanType || "milestone");

    if (p.milestonePlan && p.milestonePlan.length > 0) {
      setMilestones(p.milestonePlan);
    } else {
      setMilestones([
        {
          id: "ms-1",
          name: "Milestone 1: Advance Retainer",
          percentage: 50,
          amount: p.advanceAmount || Math.round((p.totalPrice || 50000) * 0.5),
          dueTrigger: "Upon proposal signing",
          status: "Pending",
        },
        {
          id: "ms-2",
          name: "Milestone 2: Final Settlement",
          percentage: 50,
          amount:
            (p.totalPrice || 50000) -
            (p.advanceAmount || Math.round((p.totalPrice || 50000) * 0.5)),
          dueTrigger: "Upon project completion",
          status: "Pending",
        },
      ]);
    }

    setAutoCreateInvoice(!p.invoiceId);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Handle Form Submission (Create or Edit)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!proposalTitle.trim()) {
      setFormError("Please provide a proposal title.");
      return;
    }
    if (!scopeDetails.trim()) {
      setFormError("Please provide a scope description.");
      return;
    }
    if (calculatedTotal <= 0) {
      setFormError("Total project cost must be greater than zero.");
      return;
    }
    if (!validityDateInput) {
      setFormError("Please select an offer validity date.");
      return;
    }

    // Validate milestone plan if milestone type selected
    if (paymentPlanType === "milestone") {
      if (milestones.length === 0) {
        setFormError("Please specify at least one milestone in the payment plan.");
        return;
      }
      if (milestonePercentageSum !== 100) {
        setFormError(
          `Milestones must equal exactly 100% of the budget. Current total is ${milestonePercentageSum}%.`,
        );
        return;
      }
    }

    const deliverables = deliverablesInput
      .split("\n")
      .map((line) => line.replace(/^[-*•]\s*/, "").trim())
      .filter(Boolean);

    setIsSubmitting(true);

    try {
      const targetClient = clients.find((c) => c.uid === targetClientId || c.id === targetClientId);

      // Determine advance amount
      const advanceAmount =
        paymentPlanType === "milestone"
          ? milestones[0]?.amount || Math.round(calculatedTotal * 0.3)
          : calculatedTotal;

      let linkedInvoiceId = editingProposal?.invoiceId;
      let linkedInvoiceNumber = editingProposal?.invoiceNumber;

      // Automatically generate initial invoice in Firestore if requested
      if (autoCreateInvoice && (!editingProposal || !editingProposal.invoiceId)) {
        try {
          const invNum = await generateNextInvoiceNumber();
          const today = new Date().toISOString().split("T")[0];

          let invLineItems: InvoiceLineItem[] = [];
          if (paymentPlanType === "full") {
            invLineItems = budgetItems.map((b, i) => ({
              id: `item-${i + 1}`,
              description: b.description,
              quantity: 1,
              unitPrice: b.amount,
              amount: b.amount,
            }));
          } else {
            const m1 = milestones[0];
            invLineItems = [
              {
                id: "item-m1",
                description: `${m1.name} (${m1.percentage}%) • Trigger: ${m1.dueTrigger || "Upon signing"}`,
                quantity: 1,
                unitPrice: m1.amount,
                amount: m1.amount,
              },
            ];
          }

          const invSubtotal =
            paymentPlanType === "full" ? calculatedSubtotal : milestones[0].amount;
          const invTax = paymentPlanType === "full" ? calculatedTax : 0;
          const invTotal = paymentPlanType === "full" ? calculatedTotal : milestones[0].amount;

          const createdInvId = await createInvoice({
            invoiceNumber: invNum,
            clientId: targetClientId,
            clientName: targetClient?.name || undefined,
            clientEmail: targetClient?.email || undefined,
            projectName: projectName.trim() || proposalTitle.trim(),
            issueDate: today,
            dueDate: validityDateInput,
            lineItems: invLineItems,
            subtotal: invSubtotal,
            taxRate: paymentPlanType === "full" ? taxRateInput : 0,
            tax: invTax,
            discount: paymentPlanType === "full" ? discountInput : 0,
            totalAmount: invTotal,
            amountPaid: 0,
            balanceDue: invTotal,
            currency: currencyInput,
            status: "Sent",
            notes: `Generated for Proposal "${proposalTitle.trim()}". Initial required settlement: ${currencyInput} ${invTotal.toLocaleString()}.`,
            createdByAdminUid: admin.uid,
            createdByAdminName: admin.name || "VINORA Lead Architect",
            createdByAdminEmail: admin.email || "",
          });

          linkedInvoiceId = createdInvId;
          linkedInvoiceNumber = invNum;
        } catch (invErr) {
          console.warn("Failed to create linked invoice automatically:", invErr);
        }
      }

      if (editingProposal) {
        // Update existing proposal
        const updateInput: UpdateProposalInput = {
          proposalId: editingProposal.id,
          clientId: targetClientId || editingProposal.clientId,
          title: proposalTitle.trim(),
          description: projectDescription.trim() || undefined,
          scope: scopeDetails.trim(),
          deliverables,
          timeline: timelineInput.trim(),
          revisions: revisionsInput.trim() || undefined,
          totalPrice: calculatedTotal,
          currency: currencyInput,
          advanceAmount,
          validityDate: validityDateInput,
          terms: termsInput.trim(),
          notes: notesInput.trim() || undefined,
          updatedByAdminName: admin.name || "VINORA Lead Architect",
          budgetItems,
          subtotal: calculatedSubtotal,
          taxRate: taxRateInput,
          tax: calculatedTax,
          discount: discountInput,
          paymentPlanType,
          milestonePlan: milestones,
          paymentStatus: editingProposal.paymentStatus || "Unpaid",
          invoiceId: linkedInvoiceId,
          invoiceNumber: linkedInvoiceNumber,
        };

        await updateProposal(updateInput);
        setActionSuccess(`Proposal "${proposalTitle}" updated successfully.`);
      } else {
        // Create new proposal
        const createInput: CreateProposalInput = {
          clientId: targetClientId,
          clientName: targetClient?.name || undefined,
          clientEmail: targetClient?.email || undefined,
          clientCompany: targetClient?.companyName || undefined,
          projectName: projectName.trim() || undefined,
          title: proposalTitle.trim(),
          description: projectDescription.trim() || undefined,
          scope: scopeDetails.trim(),
          deliverables,
          timeline: timelineInput.trim(),
          revisions: revisionsInput.trim() || undefined,
          totalPrice: calculatedTotal,
          currency: currencyInput,
          advanceAmount,
          validityDate: validityDateInput,
          terms: termsInput.trim(),
          notes: notesInput.trim() || undefined,
          createdBy: admin.uid,
          createdByAdminName: admin.name || "VINORA Lead Architect",
          createdByAdminEmail: admin.email || "",
          budgetItems,
          subtotal: calculatedSubtotal,
          taxRate: taxRateInput,
          tax: calculatedTax,
          discount: discountInput,
          paymentPlanType,
          milestonePlan: milestones,
          paymentStatus: "Unpaid",
          invoiceId: linkedInvoiceId,
          invoiceNumber: linkedInvoiceNumber,
        };

        await createProposal(createInput);
        setActionSuccess(
          `Proposal "${proposalTitle}" created for client ${targetClient?.name || targetClientId}!`,
        );
      }

      setIsModalOpen(false);
      setEditingProposal(null);
    } catch (err: unknown) {
      console.error("Proposal submit error:", err);
      setFormError(err instanceof Error ? err.message : "Failed to save proposal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Withdraw Submission
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawingProposal) return;
    setIsWithdrawing(true);

    try {
      await withdrawProposal({
        proposalId: withdrawingProposal.id,
        withdrawnReason: withdrawReason.trim(),
        adminName: admin.name || "VINORA Lead Architect",
      });

      setActionSuccess(`Proposal "${withdrawingProposal.title}" has been withdrawn.`);
      setWithdrawingProposal(null);
      setWithdrawReason("");
    } catch (err: unknown) {
      console.error("Withdraw error:", err);
      setError(err instanceof Error ? err.message : "Failed to withdraw proposal.");
    } finally {
      setIsWithdrawing(false);
    }
  };

  // Handle Delete Confirmation
  const confirmDelete = async () => {
    if (!deletingProposal) return;
    setIsDeleting(true);

    try {
      await deleteProposal(deletingProposal.id);
      setActionSuccess(`Deleted proposal "${deletingProposal.title}".`);
      setDeletingProposal(null);
    } catch (err: unknown) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete proposal.");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredProposals = proposals.filter((p) => {
    if (statusFilter !== "all" && p.status.toLowerCase() !== statusFilter.toLowerCase()) {
      return false;
    }
    if (clientFilter !== "all" && p.clientId !== clientFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const titleMatch = (p.title || "").toLowerCase().includes(q);
      const projMatch = (p.projectName || p.projectTitle || "").toLowerCase().includes(q);
      const clientMatch = (p.clientName || "").toLowerCase().includes(q);
      const emailMatch = (p.clientEmail || "").toLowerCase().includes(q);
      if (!titleMatch && !projMatch && !clientMatch && !emailMatch) {
        return false;
      }
    }
    return true;
  });

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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="size-3" />
            Accepted
          </span>
        );
      case "Rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium bg-destructive/10 text-destructive border border-destructive/30">
            <X className="size-3" />
            Declined
          </span>
        );
      case "Withdrawn":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium bg-muted text-muted-foreground border border-border">
            <Clock className="size-3" />
            Withdrawn
          </span>
        );
      case "Expired":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium bg-amber-500/10 text-amber-500 border border-amber-500/30">
            <Clock className="size-3" />
            Expired
          </span>
        );
      case "Pending":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="size-3 animate-pulse" />
            Pending Review
          </span>
        );
    }
  };

  const getPaymentStatusBadge = (payStatus?: ProposalPaymentStatus | string) => {
    switch (payStatus) {
      case "Fully Paid":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <ShieldCheck className="size-3" />
            Fully Settled
          </span>
        );
      case "Advance Paid":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <Receipt className="size-3" />
            Advance Settled
          </span>
        );
      case "Partially Paid":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="size-3" />
            Partially Paid
          </span>
        );
      case "Unpaid":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono bg-surface text-muted-foreground border border-border">
            Unpaid
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-2xl font-medium tracking-tight">
              Project Proposals & Budgets
            </h2>
            <span className="font-mono text-xs border border-border bg-surface px-2.5 py-0.5 text-muted-foreground">
              {proposals.length} total
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Author commercial scopes, dynamic itemized budgets, and full/milestone payment plans.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={openCreateModal}
            className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs h-9 px-4"
          >
            <Plus className="size-3.5 mr-1.5" />
            Create Proposal & Budget
          </Button>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="font-mono text-[11px] underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.reload()}
            className="h-7 text-xs font-mono"
          >
            Retry
          </Button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="border border-border bg-surface p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by proposal title, client, or ref..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs font-mono rounded-none border-border bg-background h-9"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="h-9 border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden"
            >
              <option value="all">All Clients</option>
              {clients.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.name} ({c.email || c.uid.slice(0, 8)})
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden"
            >
              <option value="all">All Statuses</option>
              <option value="Pending">Pending Review</option>
              <option value="Accepted">Accepted</option>
              <option value="Rejected">Declined</option>
              <option value="Withdrawn">Withdrawn</option>
              <option value="Expired">Expired</option>
            </select>
          </div>
        </div>
      </div>

      {/* Proposals List Table */}
      {isLoading ? (
        <div className="border border-border bg-card p-12 text-center space-y-3">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Loading proposals from Firestore...
          </p>
        </div>
      ) : filteredProposals.length === 0 ? (
        <div className="border border-border bg-card p-12 text-center space-y-4">
          <FileText className="size-10 mx-auto text-muted-foreground/40" />
          <div>
            <h3 className="font-display text-sm font-semibold">No Proposals Found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {searchQuery || statusFilter !== "all" || clientFilter !== "all"
                ? "No proposal records match your filter criteria."
                : "Create your first formal commercial proposal with itemized budget and payment schedule."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={openCreateModal}
            className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs"
          >
            <Plus className="size-3.5 mr-1" />
            Create Proposal
          </Button>
        </div>
      ) : (
        <div className="border border-border bg-card divide-y divide-border">
          {filteredProposals.map((proposal) => {
            const isPending = proposal.status === "Pending";
            const isWithdrawn = proposal.status === "Withdrawn";

            return (
              <div
                key={proposal.id}
                className="p-5 space-y-4 hover:bg-surface/30 transition-colors"
              >
                {/* Header row: Title, client details, status badges */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-base font-semibold text-foreground">
                        {proposal.title}
                      </span>
                      {proposal.projectTitle && (
                        <span className="font-mono text-[10px] px-2 py-0.5 border border-border bg-surface text-muted-foreground">
                          Project: {proposal.projectTitle}
                        </span>
                      )}
                      <span className="font-mono text-[10px] px-2 py-0.5 border border-border bg-surface text-muted-foreground">
                        Plan:{" "}
                        {proposal.paymentPlanType === "milestone"
                          ? "Milestones"
                          : "100% Full Payment"}
                      </span>
                      {proposal.invoiceNumber && (
                        <span className="font-mono text-[10px] px-2 py-0.5 border border-sky-500/30 bg-sky-500/10 text-sky-400">
                          Invoice: {proposal.invoiceNumber}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                      <span className="font-semibold text-foreground flex items-center gap-1">
                        <User className="size-3" />
                        {proposal.clientName || "Client"}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[11px]">{proposal.clientEmail}</span>
                      {proposal.clientCompany && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Building2 className="size-3" />
                            {proposal.clientCompany}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    {getStatusBadge(proposal.status)}
                    {getPaymentStatusBadge(proposal.paymentStatus)}
                  </div>
                </div>

                {/* Scope Preview */}
                <p className="text-xs text-muted-foreground font-sans line-clamp-2 leading-relaxed">
                  {proposal.scope}
                </p>

                {/* Commercial Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="border border-border/70 bg-surface/50 p-2.5 space-y-0.5">
                    <span className="text-[10px] uppercase text-muted-foreground block">
                      Total Project Cost:
                    </span>
                    <span className="font-display text-sm font-bold text-foreground">
                      {proposal.currency === "INR" ? "₹" : proposal.currency}{" "}
                      {proposal.totalPrice.toLocaleString()}
                    </span>
                  </div>

                  <div className="border border-border/70 bg-surface/50 p-2.5 space-y-0.5">
                    <span className="text-[10px] uppercase text-muted-foreground block">
                      {proposal.paymentPlanType === "milestone"
                        ? "Milestone 1 Advance:"
                        : "Full Amount Due:"}
                    </span>
                    <span className="font-medium text-foreground">
                      {proposal.currency === "INR" ? "₹" : proposal.currency}{" "}
                      {(proposal.advanceAmount || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="border border-border/70 bg-surface/50 p-2.5 space-y-0.5">
                    <span className="text-[10px] uppercase text-muted-foreground block">
                      Valid Until:
                    </span>
                    <span className="font-medium text-foreground">
                      {formatDateDisplay(proposal.validityDate)}
                    </span>
                  </div>

                  <div className="border border-border/70 bg-surface/50 p-2.5 space-y-0.5">
                    <span className="text-[10px] uppercase text-muted-foreground block">
                      Budget Breakdown:
                    </span>
                    <span className="font-medium text-foreground">
                      {proposal.budgetItems?.length || 1} line item(s)
                    </span>
                  </div>
                </div>

                {/* Client Response note if accepted / rejected */}
                {proposal.clientResponse && (
                  <div className="text-xs border border-border bg-surface/40 p-2.5 space-y-0.5">
                    <span className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                      Client Feedback ({formatDateDisplay(proposal.responseAt)}):
                    </span>
                    <p className="text-foreground">{proposal.clientResponse}</p>
                  </div>
                )}

                {/* Withdrawn Notice */}
                {isWithdrawn && proposal.withdrawnReason && (
                  <div className="text-xs border border-muted bg-surface/50 p-2.5 space-y-0.5">
                    <span className="font-mono text-[10px] font-semibold uppercase text-muted-foreground">
                      Withdrawal Notice by {proposal.withdrawnBy}:
                    </span>
                    <p className="text-muted-foreground">{proposal.withdrawnReason}</p>
                  </div>
                )}

                {/* Footer Bar & Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-border/60">
                  <div className="text-[11px] font-mono text-muted-foreground">
                    UID: {proposal.clientId.slice(0, 8)}... • Ref: #{proposal.id.slice(0, 10)} •
                    Created: {formatDateDisplay(proposal.createdAt)}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setViewingProposal(proposal)}
                      className="rounded-none cursor-pointer font-mono text-xs h-8 px-3"
                    >
                      <Eye className="size-3 mr-1" />
                      View Full Details
                    </Button>

                    {isPending && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditModal(proposal)}
                        className="rounded-none cursor-pointer font-mono text-xs h-8 px-2.5"
                      >
                        <Edit3 className="size-3 mr-1" />
                        Edit
                      </Button>
                    )}

                    {isPending && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setWithdrawingProposal(proposal);
                          setWithdrawReason("Withdrawn due to project scope re-evaluation.");
                        }}
                        className="rounded-none cursor-pointer font-mono text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground"
                      >
                        <Clock className="size-3 mr-1" />
                        Withdraw
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingProposal(proposal)}
                      className="rounded-none cursor-pointer text-destructive hover:bg-destructive/10 h-8 px-2"
                      title="Delete proposal"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE / EDIT PROPOSAL MODAL (WITH BUDGET BREAKDOWN & MILESTONES) */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <div className="border border-border bg-card max-w-4xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-8 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground block">
                  VINORA Commercial Management
                </span>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {editingProposal
                    ? "Edit Proposal & Project Budget"
                    : "Author Project Budget & Commercial Proposal"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) setIsModalOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {formError && (
              <div className="border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-6 text-xs">
              {/* SECTION A: CLIENT & BASIC INFO */}
              <div className="space-y-3 border-b border-border pb-5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-bold block">
                  1. Project Identification & Client
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[10px]">
                      Target Client Account *
                    </label>
                    <select
                      required
                      disabled={!!editingProposal}
                      value={targetClientId}
                      onChange={(e) => setTargetClientId(e.target.value)}
                      className="w-full h-9 border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden disabled:opacity-60"
                    >
                      {clients.map((c) => (
                        <option key={c.uid} value={c.uid}>
                          {c.name} — {c.email} ({c.companyName || c.uid.slice(0, 8)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[10px]">
                      Project Name / Identifier *
                    </label>
                    <Input
                      type="text"
                      required
                      placeholder="e.g. Vinora Design Engine & API Gateway"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="rounded-none border-border bg-background text-xs h-9 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[10px]">
                    Proposal Title *
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="e.g. Full-Stack Enterprise Platform Architecture & MVP Sprint"
                    value={proposalTitle}
                    onChange={(e) => setProposalTitle(e.target.value)}
                    className="rounded-none border-border bg-background text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[10px]">
                    Project Description (High-Level Summary)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="High-level executive summary of this project engagement..."
                    value={projectDescription}
                    onChange={(e) => setProjectDescription(e.target.value)}
                    className="w-full border border-border bg-background p-2.5 text-xs text-foreground focus:outline-hidden"
                  />
                </div>
              </div>

              {/* SECTION B: SCOPE, DELIVERABLES, TIMELINE, REVISIONS */}
              <div className="space-y-3 border-b border-border pb-5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-bold block">
                  2. Scope of Work & Deliverables
                </span>

                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[10px]">
                    Scope of Work *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Detail the technical approach, architecture patterns, and engineering scope..."
                    value={scopeDetails}
                    onChange={(e) => setScopeDetails(e.target.value)}
                    className="w-full border border-border bg-background p-2.5 text-xs text-foreground focus:outline-hidden leading-relaxed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[10px]">
                    Committed Deliverables (One line per item)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="UI/UX High-Fidelity Interactive Prototypes&#10;Next.js & Vite Responsive Frontend Suite&#10;Backend API Gateway & Firestore Rules&#10;Automated Testing & Production Deployment"
                    value={deliverablesInput}
                    onChange={(e) => setDeliverablesInput(e.target.value)}
                    className="w-full border border-border bg-background p-2.5 text-xs font-mono text-foreground focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[10px]">
                      Estimated Timeline
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. 6-8 weeks sprint delivery"
                      value={timelineInput}
                      onChange={(e) => setTimelineInput(e.target.value)}
                      className="rounded-none border-border bg-background text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[10px]">
                      Revision Policy
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g. Up to 3 iterations per milestone"
                      value={revisionsInput}
                      onChange={(e) => setRevisionsInput(e.target.value)}
                      className="rounded-none border-border bg-background text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[10px]">
                      Validity Date *
                    </label>
                    <Input
                      type="date"
                      required
                      value={validityDateInput}
                      onChange={(e) => setValidityDateInput(e.target.value)}
                      className="rounded-none border-border bg-background text-xs font-mono h-9"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION C: DYNAMIC PROJECT BUDGET BREAKDOWN */}
              <div className="space-y-4 border-b border-border pb-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-bold block">
                      3. Project Budget Breakdown
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Dynamic line items specifying exact component pricing. Subtotal and total
                      calculate automatically.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="font-mono text-[11px] text-muted-foreground">Currency:</label>
                    <select
                      value={currencyInput}
                      onChange={(e) => setCurrencyInput(e.target.value)}
                      className="h-8 border border-border bg-background px-2.5 text-xs font-mono text-foreground focus:outline-hidden"
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>

                {/* Dynamic Line Items List */}
                <div className="border border-border bg-surface/40 divide-y divide-border">
                  <div className="p-2.5 bg-surface grid grid-cols-12 gap-2 text-[10px] font-mono uppercase text-muted-foreground font-semibold">
                    <div className="col-span-8">Description</div>
                    <div className="col-span-3 text-right">
                      Amount ({currencyInput === "INR" ? "₹" : currencyInput})
                    </div>
                    <div className="col-span-1 text-center">Action</div>
                  </div>

                  {budgetItems.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-2.5 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-8">
                        <Input
                          type="text"
                          required
                          placeholder="e.g. UI/UX Design & Prototyping"
                          value={item.description}
                          onChange={(e) =>
                            handleUpdateBudgetItem(item.id, "description", e.target.value)
                          }
                          className="h-8 text-xs rounded-none border-border bg-background"
                        />
                      </div>
                      <div className="col-span-3">
                        <Input
                          type="number"
                          min="0"
                          required
                          value={item.amount}
                          onChange={(e) =>
                            handleUpdateBudgetItem(item.id, "amount", e.target.value)
                          }
                          className="h-8 text-xs font-mono text-right rounded-none border-border bg-background"
                        />
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveBudgetItem(item.id)}
                          className="text-muted-foreground hover:text-destructive cursor-pointer p-1"
                          title="Remove line item"
                        >
                          <Trash2 className="size-3.5 mx-auto" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddBudgetItem}
                    className="rounded-none cursor-pointer h-8 text-xs font-mono"
                  >
                    <Plus className="size-3 mr-1" />
                    Add Budget Item
                  </Button>
                </div>

                {/* Subtotal, Tax, Discount, and Final Total Box */}
                <div className="border border-border bg-surface p-4 space-y-2.5 font-mono text-xs max-w-sm ml-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-semibold text-foreground">
                      {currencyInput === "INR" ? "₹" : currencyInput}{" "}
                      {calculatedSubtotal.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground flex items-center gap-1">
                      Tax Rate (%):
                    </span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={taxRateInput}
                        onChange={(e) => setTaxRateInput(Number(e.target.value) || 0)}
                        className="w-16 h-7 text-xs font-mono text-right rounded-none border-border bg-background"
                      />
                      <span className="text-muted-foreground text-[11px] w-20 text-right">
                        + {currencyInput === "INR" ? "₹" : currencyInput}{" "}
                        {calculatedTax.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">
                      Discount ({currencyInput === "INR" ? "₹" : currencyInput}):
                    </span>
                    <Input
                      type="number"
                      min="0"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(Number(e.target.value) || 0)}
                      className="w-24 h-7 text-xs font-mono text-right rounded-none border-border bg-background"
                    />
                  </div>

                  <div className="border-t border-border pt-2 flex items-center justify-between font-display text-sm font-bold text-foreground">
                    <span>TOTAL PROJECT COST:</span>
                    <span className="text-base text-foreground">
                      {currencyInput === "INR" ? "₹" : currencyInput}{" "}
                      {calculatedTotal.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION D: PAYMENT PLAN (FULL OR MILESTONES) */}
              <div className="space-y-4 border-b border-border pb-5">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-bold block">
                  4. Payment Plan
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Option A: Full Payment */}
                  <div
                    onClick={() => setPaymentPlanType("full")}
                    className={`border p-4 cursor-pointer transition-all ${
                      paymentPlanType === "full"
                        ? "border-foreground bg-foreground/5 shadow-xs"
                        : "border-border bg-surface/30 hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-display font-semibold text-foreground text-sm">
                        A. Full Payment
                      </span>
                      {paymentPlanType === "full" && (
                        <span className="font-mono text-[10px] bg-foreground text-background px-1.5 py-0.5">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      100% upfront settlement upon proposal signing.
                    </p>
                    <div className="font-mono text-xs border border-border bg-background p-2 flex justify-between">
                      <span className="text-muted-foreground">Amount Due:</span>
                      <strong className="text-foreground">
                        {currencyInput === "INR" ? "₹" : currencyInput}{" "}
                        {calculatedTotal.toLocaleString()}
                      </strong>
                    </div>
                  </div>

                  {/* Option B: Milestone Payment */}
                  <div
                    onClick={() => setPaymentPlanType("milestone")}
                    className={`border p-4 cursor-pointer transition-all ${
                      paymentPlanType === "milestone"
                        ? "border-foreground bg-foreground/5 shadow-xs"
                        : "border-border bg-surface/30 hover:border-border/80"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-display font-semibold text-foreground text-sm">
                        B. Milestone Payment
                      </span>
                      {paymentPlanType === "milestone" && (
                        <span className="font-mono text-[10px] bg-foreground text-background px-1.5 py-0.5">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Break down settlement into progress sprint milestones.
                    </p>
                    <div className="font-mono text-xs border border-border bg-background p-2 flex justify-between">
                      <span className="text-muted-foreground">Milestones:</span>
                      <strong className="text-foreground">
                        {milestones.length} staged deliverables
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Milestone Details when Milestone Payment is selected */}
                {paymentPlanType === "milestone" && (
                  <div className="border border-border bg-surface/50 p-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
                      <div>
                        <h4 className="font-display text-sm font-semibold text-foreground">
                          Milestone Allocation Schedule
                        </h4>
                        <p className="text-[11px] text-muted-foreground">
                          Define milestones with percentage or fixed amount and trigger conditions.
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-mono text-muted-foreground mr-1">
                          Presets:
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => applyMilestonePreset("30-40-30")}
                          className="h-6 text-[10px] font-mono px-2 rounded-none cursor-pointer"
                        >
                          30/40/30
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => applyMilestonePreset("50-50")}
                          className="h-6 text-[10px] font-mono px-2 rounded-none cursor-pointer"
                        >
                          50/50
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => applyMilestonePreset("even")}
                          className="h-6 text-[10px] font-mono px-2 rounded-none cursor-pointer"
                        >
                          Even Split
                        </Button>
                      </div>
                    </div>

                    {/* Milestones dynamic list */}
                    <div className="space-y-3">
                      {milestones.map((m, idx) => (
                        <div
                          key={m.id || idx}
                          className="border border-border bg-background p-3.5 space-y-3 transition-colors hover:border-foreground/30"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-[11px] font-bold text-foreground">
                              Milestone #{idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveMilestone(m.id)}
                              className="text-muted-foreground hover:text-destructive cursor-pointer text-xs"
                            >
                              <X className="size-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            <div className="sm:col-span-6 space-y-1">
                              <label className="font-mono text-[10px] uppercase text-muted-foreground">
                                Milestone Name
                              </label>
                              <Input
                                type="text"
                                required
                                value={m.name}
                                onChange={(e) =>
                                  handleUpdateMilestone(m.id, "name", e.target.value)
                                }
                                placeholder="e.g. Milestone 1: 30% Advance (Project Kickoff)"
                                className="h-8 text-xs rounded-none border-border"
                              />
                            </div>

                            <div className="sm:col-span-2 space-y-1">
                              <label className="font-mono text-[10px] uppercase text-muted-foreground">
                                Percentage (%)
                              </label>
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                required
                                value={m.percentage}
                                onChange={(e) =>
                                  handleUpdateMilestone(m.id, "percentage", e.target.value)
                                }
                                className="h-8 text-xs font-mono text-right rounded-none border-border"
                              />
                            </div>

                            <div className="sm:col-span-4 space-y-1">
                              <label className="font-mono text-[10px] uppercase text-muted-foreground">
                                Amount ({currencyInput === "INR" ? "₹" : currencyInput})
                              </label>
                              <Input
                                type="number"
                                min="0"
                                required
                                value={m.amount}
                                onChange={(e) =>
                                  handleUpdateMilestone(m.id, "amount", e.target.value)
                                }
                                className="h-8 text-xs font-mono text-right rounded-none border-border"
                              />
                            </div>

                            <div className="sm:col-span-12 space-y-1">
                              <label className="font-mono text-[10px] uppercase text-muted-foreground">
                                Due Trigger / Requirement
                              </label>
                              <Input
                                type="text"
                                value={m.dueTrigger || ""}
                                onChange={(e) =>
                                  handleUpdateMilestone(m.id, "dueTrigger", e.target.value)
                                }
                                placeholder="e.g. Upon proposal acceptance & kickoff"
                                className="h-8 text-xs rounded-none border-border"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddMilestone}
                        className="rounded-none cursor-pointer h-8 text-xs font-mono"
                      >
                        <Plus className="size-3 mr-1" />
                        Add Milestone
                      </Button>

                      {/* Validation status badge */}
                      <div className="flex items-center gap-2 text-xs font-mono">
                        <span>Total Allocated:</span>
                        <span
                          className={`font-bold px-2 py-0.5 border ${
                            milestonePercentageSum === 100
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : "bg-destructive/10 text-destructive border-destructive/30"
                          }`}
                        >
                          {milestonePercentageSum}% ({currencyInput === "INR" ? "₹" : currencyInput}{" "}
                          {milestoneAmountSum.toLocaleString()})
                        </span>
                        {milestonePercentageSum !== 100 && (
                          <span className="text-destructive text-[11px]">Must total 100%</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION E: TERMS, NOTES & AUTO-INVOICE GENERATION */}
              <div className="space-y-3">
                <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground font-bold block">
                  5. Contract Terms & Initial Settlement Invoice
                </span>

                <div className="space-y-1">
                  <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[10px]">
                    Terms and Conditions
                  </label>
                  <textarea
                    rows={2}
                    value={termsInput}
                    onChange={(e) => setTermsInput(e.target.value)}
                    className="w-full border border-border bg-background p-2.5 text-xs text-foreground focus:outline-hidden"
                  />
                </div>

                {/* Auto Invoice Generation Toggle */}
                <div className="border border-border bg-surface p-3 flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="autoCreateInvoiceCheck"
                    checked={autoCreateInvoice}
                    onChange={(e) => setAutoCreateInvoice(e.target.checked)}
                    className="mt-0.5 size-4 rounded-none border-border bg-background text-foreground cursor-pointer"
                  />
                  <label
                    htmlFor="autoCreateInvoiceCheck"
                    className="text-xs cursor-pointer select-none space-y-0.5"
                  >
                    <span className="font-mono font-semibold text-foreground block">
                      Generate Initial Settlement Invoice in Firestore
                    </span>
                    <p className="text-muted-foreground text-[11px] leading-relaxed">
                      Automatically issues a formal VINORA invoice in the client's billing ledger
                      for{" "}
                      <strong className="text-foreground">
                        {paymentPlanType === "milestone"
                          ? `Milestone 1 Advance: ${currencyInput === "INR" ? "₹" : currencyInput} ${(
                              milestones[0]?.amount || 0
                            ).toLocaleString()}`
                          : `Full Payment: ${currencyInput === "INR" ? "₹" : currencyInput} ${calculatedTotal.toLocaleString()}`}
                      </strong>
                      , enabling instantaneous one-click Razorpay settlement when accepted.
                    </p>
                  </label>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-none cursor-pointer h-9 text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="sm"
                  className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-9 px-5 text-xs font-mono"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      Saving Proposal...
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5 mr-1.5" />
                      {editingProposal ? "Update Proposal & Budget" : "Publish Proposal & Budget"}
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: VIEW FULL PROPOSAL & BUDGET BREAKDOWN MODAL                       */}
      {/* ========================================================================= */}
      {viewingProposal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-4">
          <div className="border border-border bg-card max-w-2xl w-full max-h-[88vh] overflow-y-auto p-6 sm:p-8 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div>
                <span className="font-mono text-[10px] uppercase text-muted-foreground">
                  VINORA Architectural Proposal Review
                </span>
                <h3 className="font-display text-lg font-semibold">{viewingProposal.title}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Client: {viewingProposal.clientName} ({viewingProposal.clientEmail})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewingProposal(null)}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="flex items-center justify-between border border-border bg-surface p-2.5 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span>Status:</span>
                {getStatusBadge(viewingProposal.status)}
                {getPaymentStatusBadge(viewingProposal.paymentStatus)}
              </div>
              <span>Valid Until: {formatDateDisplay(viewingProposal.validityDate)}</span>
            </div>

            {/* Scope */}
            <div className="space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Scope of Work:
              </span>
              <p className="border border-border bg-surface/50 p-3 text-xs leading-relaxed text-foreground whitespace-pre-line font-sans">
                {viewingProposal.scope}
              </p>
            </div>

            {/* Budget Breakdown Table */}
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Itemized Project Budget Breakdown:
              </span>
              <div className="border border-border bg-surface/50 divide-y divide-border text-xs font-mono">
                {(
                  viewingProposal.budgetItems || [
                    {
                      id: "1",
                      description: viewingProposal.title || "Full Project Scope",
                      amount: viewingProposal.totalPrice,
                    },
                  ]
                ).map((b, i) => (
                  <div key={b.id || i} className="p-2.5 flex items-center justify-between">
                    <span className="text-muted-foreground">{b.description}</span>
                    <span className="font-semibold text-foreground">
                      {viewingProposal.currency === "INR" ? "₹" : viewingProposal.currency}{" "}
                      {b.amount.toLocaleString()}
                    </span>
                  </div>
                ))}

                <div className="p-2.5 flex items-center justify-between bg-surface font-display text-sm font-bold text-foreground">
                  <span>TOTAL PROJECT COST</span>
                  <span>
                    {viewingProposal.currency === "INR" ? "₹" : viewingProposal.currency}{" "}
                    {viewingProposal.totalPrice.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Plan */}
            <div className="space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Payment Plan (
                {viewingProposal.paymentPlanType === "milestone"
                  ? "Milestone Schedule"
                  : "100% Full Payment"}
                ):
              </span>

              {viewingProposal.paymentPlanType === "milestone" && viewingProposal.milestonePlan && (
                <div className="border border-border bg-surface/30 divide-y divide-border text-xs font-mono">
                  {viewingProposal.milestonePlan.map((m, idx) => (
                    <div key={m.id || idx} className="p-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-foreground">{m.name}</div>
                        <div className="text-[10px] text-muted-foreground">
                          Trigger: {m.dueTrigger || "Sprint sign-off"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-foreground">
                          {viewingProposal.currency === "INR" ? "₹" : viewingProposal.currency}{" "}
                          {m.amount.toLocaleString()}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {m.percentage}% of budget
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Linked Invoice info */}
            {viewingProposal.invoiceNumber && (
              <div className="border border-sky-500/30 bg-sky-500/10 p-3 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="size-4 text-sky-400" />
                  <span className="font-mono text-sky-400">
                    Linked Invoice: #{viewingProposal.invoiceNumber}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-muted-foreground">
                  Ref: {viewingProposal.invoiceId}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewingProposal(null)}
                className="rounded-none cursor-pointer h-8 text-xs font-mono"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: WITHDRAW PROPOSAL MODAL                          */}
      {/* ========================================================= */}
      {withdrawingProposal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="border border-border bg-card max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-display text-base font-semibold">Withdraw Proposal</h3>
              <button
                type="button"
                onClick={() => {
                  if (!isWithdrawing) setWithdrawingProposal(null);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Withdrawing will revoke the proposal for{" "}
              <strong className="text-foreground">"{withdrawingProposal.title}"</strong>. The client
              will no longer be able to accept it.
            </p>

            <form onSubmit={handleWithdrawSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                  Reason for Withdrawal *
                </label>
                <textarea
                  rows={2}
                  required
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="w-full border border-border bg-background p-2 text-xs text-foreground focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isWithdrawing}
                  onClick={() => setWithdrawingProposal(null)}
                  className="rounded-none cursor-pointer h-8 text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isWithdrawing}
                  size="sm"
                  className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-8 text-xs font-mono"
                >
                  {isWithdrawing ? (
                    <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Check className="size-3.5 mr-1.5" />
                  )}
                  Confirm Withdrawal
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: CONFIRM DELETE PROPOSAL                          */}
      {/* ========================================================= */}
      {deletingProposal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="border border-border bg-card max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-destructive">
              <Trash2 className="size-5 shrink-0" />
              <h3 className="font-display text-base font-semibold">Delete Proposal?</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete proposal{" "}
              <strong className="text-foreground">"{deletingProposal.title}"</strong>? This will
              remove the record from Firestore completely.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setDeletingProposal(null)}
                className="rounded-none cursor-pointer h-8 text-xs font-mono"
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isDeleting}
                onClick={confirmDelete}
                size="sm"
                className="rounded-none cursor-pointer bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs font-mono"
              >
                {isDeleting ? (
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                ) : (
                  <Trash2 className="size-3.5 mr-1" />
                )}
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
