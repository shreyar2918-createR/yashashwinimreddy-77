import { useState, useEffect, useMemo } from "react";
import {
  Megaphone,
  Plus,
  Search,
  Pin,
  Archive,
  Trash2,
  Edit3,
  Globe,
  FolderGit2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  subscribeAllStudioUpdates,
  createStudioUpdate,
  updateStudioUpdate,
  deleteStudioUpdate,
  type StudioUpdateRecord,
  type AdminClientProfile,
} from "@/services/adminDashboard";
import type { AdminRecord } from "@/services/adminAuth";
import type { Project } from "@/lib/types";

interface AdminUpdatesSectionProps {
  admin: AdminRecord;
  projects: Project[];
  clients: AdminClientProfile[];
}

export function AdminUpdatesSection({ admin, projects, clients }: AdminUpdatesSectionProps) {
  const [updates, setUpdates] = useState<StudioUpdateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<StudioUpdateRecord | null>(null);
  const [titleInput, setTitleInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [categoryInput, setCategoryInput] = useState<
    "announcement" | "milestone" | "status" | "note"
  >("announcement");
  const [visibilityInput, setVisibilityInput] = useState<"all_clients" | "specific_client">(
    "all_clients",
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [pinnedInput, setPinnedInput] = useState(false);
  const [notifyClientsInput, setNotifyClientsInput] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  // Delete confirmation modal
  const [updateToDelete, setUpdateToDelete] = useState<StudioUpdateRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeAllStudioUpdates(
      (list) => {
        setUpdates(list);
        setIsLoading(false);
      },
      (err) => {
        console.error("Updates subscription failed:", err);
        setBannerError("Unable to synchronize studio updates from Firestore.");
        setIsLoading(false);
      },
    );
    return () => unsub();
  }, []);

  const filteredUpdates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return updates.filter((u) => {
      if (categoryFilter !== "all" && u.category.toLowerCase() !== categoryFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.title.toLowerCase().includes(q) ||
        u.description.toLowerCase().includes(q) ||
        (u.projectTitle && u.projectTitle.toLowerCase().includes(q)) ||
        (u.clientName && u.clientName.toLowerCase().includes(q))
      );
    });
  }, [updates, searchQuery, categoryFilter]);

  function openCreateModal() {
    setEditingUpdate(null);
    setTitleInput("");
    setDescriptionInput("");
    setCategoryInput("announcement");
    setVisibilityInput("all_clients");
    setSelectedProjectId(projects[0]?.id || "");
    setPinnedInput(false);
    setNotifyClientsInput(true);
    setFormError(null);
    setIsModalOpen(true);
  }

  function openEditModal(u: StudioUpdateRecord) {
    setEditingUpdate(u);
    setTitleInput(u.title);
    setDescriptionInput(u.description);
    const cat = (u.category || "announcement").toLowerCase();
    setCategoryInput(
      cat === "milestone" || cat === "status" || cat === "note" ? cat : "announcement",
    );
    setVisibilityInput(u.visibility === "specific_client" ? "specific_client" : "all_clients");
    setSelectedProjectId(u.projectId || projects[0]?.id || "");
    setPinnedInput(u.pinned);
    setFormError(null);
    setIsModalOpen(true);
  }

  async function handleSaveUpdate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!titleInput.trim()) {
      setFormError("Please enter an update title.");
      return;
    }
    if (!descriptionInput.trim()) {
      setFormError("Please provide update message details.");
      return;
    }
    if (visibilityInput === "specific_client" && !selectedProjectId) {
      setFormError("Please choose a target project for project-scoped updates.");
      return;
    }

    const targetProject = projects.find((p) => p.id === selectedProjectId);
    const targetClient = targetProject
      ? clients.find((c) => c.uid === targetProject.clientId || c.id === targetProject.clientId)
      : undefined;

    setIsSubmitting(true);
    try {
      if (editingUpdate) {
        await updateStudioUpdate(editingUpdate.id, {
          title: titleInput.trim(),
          description: descriptionInput.trim(),
          category: categoryInput,
          visibility: visibilityInput,
          projectId: visibilityInput === "specific_client" ? selectedProjectId : "",
          projectTitle: visibilityInput === "specific_client" ? targetProject?.title || "" : "",
          clientId: visibilityInput === "specific_client" ? targetProject?.clientId || "" : "",
          clientName:
            visibilityInput === "specific_client"
              ? targetProject?.clientName || targetClient?.name || ""
              : "",
          pinned: pinnedInput,
        });
        setBannerSuccess(`Updated "${titleInput.trim()}".`);
      } else {
        await createStudioUpdate({
          title: titleInput.trim(),
          description: descriptionInput.trim(),
          category: categoryInput,
          visibility: visibilityInput,
          projectId: visibilityInput === "specific_client" ? selectedProjectId : undefined,
          projectTitle: visibilityInput === "specific_client" ? targetProject?.title : undefined,
          clientId: visibilityInput === "specific_client" ? targetProject?.clientId : undefined,
          clientName:
            visibilityInput === "specific_client"
              ? targetProject?.clientName || targetClient?.name
              : undefined,
          pinned: pinnedInput,
          authorName: admin.name,
          authorEmail: admin.email,
          notifyClients: notifyClientsInput,
          allClientUids: clients.map((c) => c.uid).filter(Boolean),
        });
        setBannerSuccess(`Published "${titleInput.trim()}" to client portals.`);
      }
      setIsModalOpen(false);
      setTimeout(() => setBannerSuccess(null), 5000);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save update.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTogglePin(u: StudioUpdateRecord) {
    try {
      await updateStudioUpdate(u.id, { pinned: !u.pinned });
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "Failed to update pin status.");
    }
  }

  async function handleToggleArchive(u: StudioUpdateRecord) {
    try {
      await updateStudioUpdate(u.id, { archived: !u.archived });
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "Failed to archive update.");
    }
  }

  async function confirmDeleteUpdate() {
    if (!updateToDelete) return;
    setIsDeleting(true);
    try {
      await deleteStudioUpdate(updateToDelete.id);
      setBannerSuccess(`Deleted update "${updateToDelete.title}".`);
      setUpdateToDelete(null);
      setTimeout(() => setBannerSuccess(null), 5000);
    } catch (err) {
      setBannerError(err instanceof Error ? err.message : "Failed to delete update.");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.1] pb-5">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Updates &amp; Announcements
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Publish studio announcements, sprint milestones, and project progress notes directly to
            Client Portals.
          </p>
        </div>
        <Button
          onClick={openCreateModal}
          className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer text-xs font-medium h-9 px-4 shrink-0"
        >
          <Plus className="size-4 mr-1.5" />
          Publish Update
        </Button>
      </div>

      {bannerSuccess && (
        <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/60 backdrop-blur-md p-3.5 flex items-center justify-between gap-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{bannerSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerSuccess(null)}
            className="text-emerald-300 hover:text-white cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {bannerError && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-950/60 backdrop-blur-md p-3.5 flex items-center justify-between gap-3 text-xs text-rose-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{bannerError}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            className="text-rose-200 hover:text-white cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search updates, announcements, projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-white/[0.12] bg-[#0c0c11]/75 backdrop-blur-md pl-10 pr-4 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(["all", "announcement", "milestone", "status", "note"] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-2 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer shrink-0 ${
                categoryFilter === cat
                  ? "bg-white text-zinc-950"
                  : "border border-white/[0.1] bg-[#0c0c11]/70 text-zinc-300 hover:text-white hover:border-white/25"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Updates List */}
      {isLoading ? (
        <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
          <Loader2 className="size-6 animate-spin mx-auto text-zinc-400" />
          <p className="mt-3 text-xs text-zinc-400 uppercase tracking-widest">
            Syncing studio updates...
          </p>
        </div>
      ) : filteredUpdates.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
          <Megaphone className="size-9 mx-auto text-zinc-500" />
          <h3 className="mt-3 font-display text-base font-medium text-white">
            No updates published yet
          </h3>
          <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
            Create an announcement or project progress note to keep your clients informed in real
            time.
          </p>
          <Button
            onClick={openCreateModal}
            className="mt-5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer text-xs"
          >
            <Plus className="size-3.5 mr-1.5" />
            Create First Update
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredUpdates.map((upd) => (
            <article
              key={upd.id}
              className={`rounded-2xl border backdrop-blur-md p-5 transition-all ${
                upd.archived
                  ? "border-white/[0.06] bg-[#0c0c11]/45 opacity-70"
                  : "border-white/[0.12] bg-[#0c0c11]/72 hover:border-white/25"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {upd.pinned && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-white text-zinc-950 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                        <Pin className="size-2.5" />
                        Pinned
                      </span>
                    )}
                    <span className="rounded-md border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-200">
                      {upd.category}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-300">
                      {upd.visibility === "specific_client" ? (
                        <>
                          <FolderGit2 className="size-3 text-zinc-400" />
                          <span>{upd.projectTitle || "Project Specific"}</span>
                        </>
                      ) : (
                        <>
                          <Globe className="size-3 text-zinc-400" />
                          <span>All Clients</span>
                        </>
                      )}
                    </span>
                    {upd.archived && (
                      <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] text-zinc-400">
                        Archived
                      </span>
                    )}
                  </div>

                  <h3 className="font-display text-base sm:text-lg font-medium text-white">
                    {upd.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
                    {upd.description}
                  </p>

                  <div className="pt-1 flex flex-wrap items-center gap-3 text-[11px] text-zinc-500">
                    <span>
                      Published{" "}
                      {new Date(upd.publishedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    {upd.authorName && <span>• By {upd.authorName}</span>}
                    {upd.clientName && <span>• Client: {upd.clientName}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTogglePin(upd)}
                    title={upd.pinned ? "Unpin update" : "Pin update"}
                    className="rounded-lg h-8 px-2.5 text-xs border-white/15 bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer"
                  >
                    <Pin className={`size-3.5 ${upd.pinned ? "text-white" : "text-zinc-400"}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditModal(upd)}
                    className="rounded-lg h-8 px-2.5 text-xs border-white/15 bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer"
                  >
                    <Edit3 className="size-3.5 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleArchive(upd)}
                    title={upd.archived ? "Restore update" : "Archive update"}
                    className="rounded-lg h-8 px-2.5 text-xs border-white/15 bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer"
                  >
                    <Archive className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUpdateToDelete(upd)}
                    title="Delete update"
                    className="rounded-lg h-8 px-2.5 text-xs text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !isSubmitting && setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#121217] p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="font-display text-lg font-medium text-white">
                  {editingUpdate ? "Edit Studio Update" : "Publish Studio Update"}
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Visible immediately inside targeted Client Portal Updates feeds.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {formError && (
              <div className="rounded-xl border border-rose-500/35 bg-rose-950/60 p-3 text-xs text-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveUpdate} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                  Headline *
                </label>
                <Input
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  placeholder="e.g. Sprint 4 Production Milestone Completed"
                  className="rounded-xl border-white/15 bg-zinc-900/90 text-white h-9"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                    Category
                  </label>
                  <select
                    value={categoryInput}
                    onChange={(e) =>
                      setCategoryInput(
                        e.target.value as "announcement" | "milestone" | "status" | "note",
                      )
                    }
                    className="w-full h-9 rounded-xl border border-white/15 bg-zinc-900/90 px-3 text-xs text-white focus:outline-none"
                  >
                    <option value="announcement">Announcement</option>
                    <option value="milestone">Milestone</option>
                    <option value="status">Project Status</option>
                    <option value="note">Engineering Note</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                    Audience Visibility
                  </label>
                  <select
                    value={visibilityInput}
                    onChange={(e) =>
                      setVisibilityInput(e.target.value as "all_clients" | "specific_client")
                    }
                    className="w-full h-9 rounded-xl border border-white/15 bg-zinc-900/90 px-3 text-xs text-white focus:outline-none"
                  >
                    <option value="all_clients">All Clients (Studio-Wide)</option>
                    <option value="specific_client">Specific Project / Client</option>
                  </select>
                </div>
              </div>

              {visibilityInput === "specific_client" && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                    Target Project *
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    required
                    className="w-full h-9 rounded-xl border border-white/15 bg-zinc-900/90 px-3 text-xs text-white focus:outline-none"
                  >
                    {projects.length === 0 ? (
                      <option value="">No active studio projects found</option>
                    ) : (
                      projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} {p.clientName ? `(${p.clientName})` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
                  Message Content *
                </label>
                <textarea
                  rows={4}
                  value={descriptionInput}
                  onChange={(e) => setDescriptionInput(e.target.value)}
                  placeholder="Share deliverable summaries, release notes, timelines, or guidance..."
                  className="w-full rounded-xl border border-white/15 bg-zinc-900/90 p-3 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/40 resize-y leading-relaxed"
                  required
                />
              </div>

              <div className="flex flex-wrap items-center gap-5 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pinnedInput}
                    onChange={(e) => setPinnedInput(e.target.checked)}
                    className="rounded border-white/25 bg-zinc-900"
                  />
                  <span>Pin to top of Updates</span>
                </label>

                {!editingUpdate && (
                  <label className="inline-flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyClientsInput}
                      onChange={(e) => setNotifyClientsInput(e.target.checked)}
                      className="rounded border-white/25 bg-zinc-900"
                    />
                    <span>Send portal notification bell alert</span>
                  </label>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-white/10 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
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
                  ) : editingUpdate ? (
                    "Save Changes"
                  ) : (
                    "Publish Update"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {updateToDelete && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#121217] p-6 shadow-2xl space-y-4">
            <h3 className="font-display text-base font-semibold text-white">Delete Update?</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to permanently remove{" "}
              <strong className="text-white">&ldquo;{updateToDelete.title}&rdquo;</strong>? It will
              no longer appear in client updates.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setUpdateToDelete(null)}
                className="rounded-xl border-white/15 text-xs cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={isDeleting}
                onClick={confirmDeleteUpdate}
                className="rounded-xl bg-rose-600 text-white hover:bg-rose-500 text-xs cursor-pointer"
              >
                {isDeleting && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
                Delete Update
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
