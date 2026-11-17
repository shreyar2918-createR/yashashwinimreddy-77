import { useState } from "react";
import {
  X,
  FolderGit2,
  FileText,
  Receipt,
  Calendar,
  Folder,
  Plus,
  CheckCircle2,
  Ban,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProjectThumbnailBox } from "@/lib/projectThumbnails";
import type { AdminClientProfile } from "@/services/adminDashboard";
import type {
  Project,
  Proposal,
  Invoice,
  Payment,
  MeetingRequest,
  ClientDocument,
} from "@/lib/types";

interface AdminClientDossierModalProps {
  client: AdminClientProfile | null;
  projects: Project[];
  proposals: Proposal[];
  invoices: Invoice[];
  payments: Payment[];
  meetings: MeetingRequest[];
  documents: ClientDocument[];
  isUpdating: boolean;
  onClose: () => void;
  onUpdateStatus: (clientId: string, status: "active" | "suspended") => void;
  onCreateProjectForClient: (clientId: string) => void;
  onNavigateSection: (section: string) => void;
}

type DossierTab = "projects" | "proposals" | "billing" | "meetings" | "documents";

export function AdminClientDossierModal({
  client,
  projects,
  proposals,
  invoices,
  payments,
  meetings,
  documents,
  isUpdating,
  onClose,
  onUpdateStatus,
  onCreateProjectForClient,
  onNavigateSection,
}: AdminClientDossierModalProps) {
  const [tab, setTab] = useState<DossierTab>("projects");

  if (!client) return null;

  const clientProjects = projects.filter((p) => p.clientId === client.uid);
  const clientProposals = proposals.filter(
    (p) => p.clientId === client.uid || p.clientUid === client.uid,
  );
  const clientInvoices = invoices.filter(
    (i) => i.clientId === client.uid || i.clientUid === client.uid,
  );
  const clientPayments = payments.filter(
    (p) => p.clientId === client.uid || p.clientUid === client.uid,
  );
  const clientMeetings = meetings.filter((m) => m.clientId === client.uid);
  const clientDocuments = documents.filter(
    (d) => d.clientId === client.uid || d.clientUid === client.uid,
  );

  const outstandingBalance = clientInvoices
    .filter((inv) => inv.status !== "Cancelled")
    .reduce((sum, inv) => sum + (Number(inv.balanceDue) || 0), 0);
  const paidTotal = clientPayments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const isActive = client.accountStatus.toLowerCase() === "active";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#121217] shadow-2xl my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6 bg-white/[0.02]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-semibold text-white">{client.name}</h3>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium border ${
                  isActive
                    ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                    : "border-amber-500/35 bg-amber-500/15 text-amber-300"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-amber-400"}`}
                />
                {client.accountStatus}
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-300">
              {client.email}
              {client.companyName ? ` • ${client.companyName}` : ""}
              {client.phone ? ` • ${client.phone}` : ""}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
              UID: {client.uid} • Registered{" "}
              {new Date(client.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 border-b border-white/10 divide-y sm:divide-y-0 sm:divide-x divide-white/10 bg-white/[0.015] text-xs">
          <div className="p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
              Projects
            </span>
            <span className="mt-1 text-base font-semibold text-white tabular-nums">
              {clientProjects.length}
            </span>
          </div>
          <div className="p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
              Proposals
            </span>
            <span className="mt-1 text-base font-semibold text-white tabular-nums">
              {clientProposals.length}
            </span>
          </div>
          <div className="p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
              Paid Revenue
            </span>
            <span className="mt-1 text-base font-semibold text-emerald-300 tabular-nums">
              {paidTotal.toLocaleString()}
            </span>
          </div>
          <div className="p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
              Balance Due
            </span>
            <span className="mt-1 text-base font-semibold text-white tabular-nums">
              {outstandingBalance.toLocaleString()}
            </span>
          </div>
          <div className="p-3.5">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
              Documents
            </span>
            <span className="mt-1 text-base font-semibold text-white tabular-nums">
              {clientDocuments.length}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-b border-white/10 px-6 pt-3 overflow-x-auto text-xs">
          {(
            [
              { id: "projects", label: `Projects (${clientProjects.length})`, icon: FolderGit2 },
              { id: "proposals", label: `Proposals (${clientProposals.length})`, icon: FileText },
              {
                id: "billing",
                label: `Invoices & Payments (${clientInvoices.length})`,
                icon: Receipt,
              },
              { id: "meetings", label: `Meetings (${clientMeetings.length})`, icon: Calendar },
              { id: "documents", label: `Documents (${clientDocuments.length})`, icon: Folder },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  tab === item.id
                    ? "border-white text-white"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                <Icon className="size-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="p-6 max-h-[45vh] overflow-y-auto space-y-3 text-xs">
          {tab === "projects" &&
            (clientProjects.length === 0 ? (
              <p className="text-center py-6 text-zinc-400">
                No active studio projects linked to this client yet.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {clientProjects.map((proj) => (
                  <div
                    key={proj.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
                  >
                    <ProjectThumbnailBox
                      item={proj}
                      className="w-full aspect-video border-b border-white/10 bg-zinc-900"
                    />
                    <div className="p-3.5 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-white truncate">{proj.title}</p>
                        <span className="text-[10px] rounded-full border border-white/15 px-2 py-0.5 text-zinc-200 shrink-0">
                          {proj.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400">
                        {proj.category || proj.serviceRequired || "Digital Engineering"} •{" "}
                        <span className="tabular-nums">{proj.progress}%</span>
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ))}

          {tab === "proposals" &&
            (clientProposals.length === 0 ? (
              <p className="text-center py-6 text-zinc-400">No proposals issued yet.</p>
            ) : (
              clientProposals.map((p) => (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-white">
                      {p.title || p.projectName || "Scope Proposal"}
                    </p>
                    <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                      {p.currency} {p.totalPrice.toLocaleString()} • Created{" "}
                      {new Date(p.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-zinc-200">
                    {p.status}
                  </span>
                </div>
              ))
            ))}

          {tab === "billing" &&
            (clientInvoices.length === 0 && clientPayments.length === 0 ? (
              <p className="text-center py-6 text-zinc-400">
                No invoices or verified payments recorded for this client.
              </p>
            ) : (
              <div className="space-y-2.5">
                {clientInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {inv.invoiceNumber || inv.number} — {inv.projectName || "Studio Retainer"}
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5 tabular-nums">
                        Total: {inv.currency} {inv.totalAmount.toLocaleString()} • Balance:{" "}
                        {inv.currency} {inv.balanceDue.toLocaleString()}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-zinc-200">
                      {inv.status}
                    </span>
                  </div>
                ))}
              </div>
            ))}

          {tab === "meetings" &&
            (clientMeetings.length === 0 ? (
              <p className="text-center py-6 text-zinc-400">No consultation requests yet.</p>
            ) : (
              clientMeetings.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-white">{m.title}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {m.platform || m.meetingType} • {m.preferredDate} at {m.preferredTime}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/15 px-2.5 py-0.5 text-[11px] text-zinc-200">
                    {m.status}
                  </span>
                </div>
              ))
            ))}

          {tab === "documents" &&
            (clientDocuments.length === 0 ? (
              <p className="text-center py-6 text-zinc-400">
                No documents uploaded to Firebase Storage for this client yet.
              </p>
            ) : (
              clientDocuments.map((d) => (
                <div
                  key={d.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] p-3.5 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-medium text-white">{d.name}</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      {d.fileName} • {d.fileType || "FILE"}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onClose();
                      onNavigateSection("Documents");
                    }}
                    className="rounded-lg h-7 text-[11px] border-white/15 cursor-pointer"
                  >
                    Open Library
                  </Button>
                </div>
              ))
            ))}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 bg-white/[0.02]">
          <Button
            size="sm"
            onClick={() => {
              onClose();
              onCreateProjectForClient(client.uid);
            }}
            className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium cursor-pointer"
          >
            <Plus className="size-3.5 mr-1.5" />
            New Project for Client
          </Button>

          <div className="flex items-center gap-2">
            {isActive ? (
              <Button
                variant="outline"
                size="sm"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(client.uid, "suspended")}
                className="rounded-xl border-white/15 text-xs text-amber-300 hover:bg-amber-500/10 cursor-pointer"
              >
                <Ban className="size-3.5 mr-1.5" />
                Suspend Account
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled={isUpdating}
                onClick={() => onUpdateStatus(client.uid, "active")}
                className="rounded-xl border-emerald-500/35 text-xs text-emerald-300 hover:bg-emerald-500/10 cursor-pointer"
              >
                <CheckCircle2 className="size-3.5 mr-1.5" />
                Activate Account
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
