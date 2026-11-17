import { useState, useEffect } from "react";
import { X, Loader2, FolderGit2, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PROJECT_CATEGORIES, ProjectThumbnailBox } from "@/lib/projectThumbnails";
import {
  createAdminProject,
  updateAdminProject,
  type AdminClientProfile,
} from "@/services/adminDashboard";
import type { AdminRecord } from "@/services/adminAuth";
import type { Project } from "@/lib/types";

const PROJECT_STATUS_OPTIONS = [
  "Planning",
  "Approved",
  "In Progress",
  "Design",
  "Development",
  "Testing",
  "Client Review",
  "On Hold",
  "Completed",
] as const;

interface AdminProjectModalProps {
  isOpen: boolean;
  editingProject: Project | null;
  initialClientId?: string;
  admin: AdminRecord;
  clients: AdminClientProfile[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

export function AdminProjectModal({
  isOpen,
  editingProject,
  initialClientId,
  admin,
  clients,
  onClose,
  onSaved,
}: AdminProjectModalProps) {
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>(PROJECT_CATEGORIES[0]);
  const [status, setStatus] = useState<string>("In Progress");
  const [progress, setProgress] = useState<number>(25);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueAt, setDueAt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingProject) {
      setClientId(editingProject.clientId || "");
      setTitle(editingProject.title || "");
      setCategory(
        editingProject.category || editingProject.serviceRequired || PROJECT_CATEGORIES[0],
      );
      setStatus(editingProject.status || "In Progress");
      setProgress(typeof editingProject.progress === "number" ? editingProject.progress : 0);
      setStartDate(
        (editingProject.startDate || editingProject.startedAt || "").slice(0, 10) ||
          new Date().toISOString().slice(0, 10),
      );
      setDueAt((editingProject.dueAt || editingProject.expectedCompletionDate || "").slice(0, 10));
      setImageUrl(editingProject.imageUrl || "");
      setDescription(editingProject.description || "");
    } else {
      setClientId(initialClientId || clients[0]?.uid || clients[0]?.id || "");
      setTitle("");
      setCategory(PROJECT_CATEGORIES[0]);
      setStatus("In Progress");
      setProgress(15);
      setStartDate(new Date().toISOString().slice(0, 10));
      setDueAt("");
      setImageUrl("");
      setDescription("");
    }
  }, [isOpen, editingProject, initialClientId, clients]);

  if (!isOpen) return null;

  const selectedClient = clients.find((c) => c.uid === clientId || c.id === clientId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError("Please select a client account to assign this project.");
      return;
    }
    if (!title.trim()) {
      setError("Please enter a project title.");
      return;
    }

    setIsSubmitting(true);
    try {
      const normalizedProgress = status.toLowerCase().includes("complete") ? 100 : progress;
      if (editingProject) {
        await updateAdminProject({
          projectId: editingProject.id,
          clientId,
          clientName: selectedClient?.name || editingProject.clientName || "Client",
          title: title.trim(),
          category,
          description: description.trim(),
          status,
          progress: normalizedProgress,
          startDate: startDate || undefined,
          dueAt: dueAt || undefined,
          imageUrl: imageUrl.trim(),
          assignedAdminId: admin.uid,
          assignedAdminName: admin.name,
        });
        onSaved(`Project "${title.trim()}" updated and synced to client portal.`);
      } else {
        await createAdminProject({
          clientId,
          clientName: selectedClient?.name || "Client",
          title: title.trim(),
          category,
          description:
            description.trim() || `${category} engagement managed by VINORA Engineering.`,
          status,
          progress: normalizedProgress,
          startDate: startDate || undefined,
          dueAt: dueAt || undefined,
          imageUrl: imageUrl.trim() || undefined,
          assignedAdminId: admin.uid,
          assignedAdminName: admin.name,
        });
        onSaved(`Created project "${title.trim()}" for ${selectedClient?.name || "client"}.`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save studio project.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={() => !isSubmitting && onClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#121217] shadow-2xl my-8 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-white/[0.02]">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06]">
              <FolderGit2 className="size-4 text-white" />
            </div>
            <div>
              <h3 className="font-display text-base sm:text-lg font-medium text-white">
                {editingProject ? "Edit Studio Project" : "Create Studio Project"}
              </h3>
              <p className="text-[11px] text-zinc-400">
                Changes sync immediately to Firestore and the Client Portal.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !isSubmitting && onClose()}
            className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 rounded-xl border border-rose-500/35 bg-rose-950/60 p-3 flex items-center gap-2 text-xs text-rose-200">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[80vh] overflow-y-auto text-xs"
        >
          {/* Live 16:9 Thumbnail Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                16:9 Project Card Preview
              </span>
              <span className="text-[11px] text-zinc-500">
                Uses custom URL or smart category artwork fallback
              </span>
            </div>
            <ProjectThumbnailBox
              item={{
                title: title || "New Studio Project",
                category,
                description,
                imageUrl,
              }}
              className="w-full max-w-md aspect-video rounded-xl border border-white/10 bg-zinc-900"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                Project Title *
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Enterprise Analytics Portal & AI Copilot"
                required
                className="rounded-xl border-white/15 bg-zinc-900/90 text-white h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                Assigned Client *
              </label>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
                className="w-full h-9 rounded-xl border border-white/15 bg-zinc-900/90 px-3 text-xs text-white focus:outline-none"
              >
                <option value="">-- Select Client --</option>
                {clients.map((c) => (
                  <option key={c.uid} value={c.uid}>
                    {c.name} ({c.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-9 rounded-xl border border-white/15 bg-zinc-900/90 px-3 text-xs text-white focus:outline-none"
              >
                {PROJECT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                Project Status *
              </label>
              <select
                value={status}
                onChange={(e) => {
                  const val = e.target.value;
                  setStatus(val);
                  if (val === "Completed") setProgress(100);
                }}
                className="w-full h-9 rounded-xl border border-white/15 bg-zinc-900/90 px-3 text-xs text-white focus:outline-none"
              >
                {PROJECT_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                  Progress (%)
                </label>
                <span className="font-mono text-xs font-semibold text-white tabular-nums">
                  {progress}%
                </span>
              </div>
              <div className="flex items-center gap-3 h-9">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value) || 0)}
                  className="flex-1 accent-white cursor-pointer"
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(e) =>
                    setProgress(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                  }
                  className="w-16 h-9 rounded-xl border border-white/15 bg-zinc-900/90 px-2 text-center font-mono text-xs text-white tabular-nums"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                Start Date
              </label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl border-white/15 bg-zinc-900/90 text-white h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                Target Deadline
              </label>
              <Input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="rounded-xl border-white/15 bg-zinc-900/90 text-white h-9"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                Custom Cover Image URL (Optional)
              </label>
              <Input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://... (leave blank to use category cover art)"
                className="rounded-xl border-white/15 bg-zinc-900/90 text-white h-9"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                Scope &amp; Deliverables Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Summarize architectural goals, milestones, and deliverables..."
                className="w-full rounded-xl border border-white/15 bg-zinc-900/90 p-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40 resize-y"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 border-t border-white/10 pt-4">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-xl border-white/15 text-xs cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : editingProject ? (
                "Save Project Changes"
              ) : (
                "Create Project"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
