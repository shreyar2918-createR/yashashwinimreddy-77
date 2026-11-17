import { useState, useEffect, useRef } from "react";
import {
  FileText,
  File,
  Download,
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  Folder,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Upload,
  Plus,
  FileSpreadsheet,
  Image as ImageIcon,
  Archive,
  User,
  Building2,
  X,
  Check,
  HardDrive,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  subscribeAllDocuments,
  uploadClientDocument,
  deleteClientDocument,
  resolveDocumentUrl,
  validateDocumentFile,
  formatDocumentSize,
  SUPPORTED_EXTENSIONS,
  type UploadDocumentInput,
} from "@/services/documentService";
import { fetchAllClients, type AdminClientProfile } from "@/services/adminDashboard";
import type { ClientDocument } from "@/lib/types";
import type { AdminRecord } from "@/services/adminAuth";

interface AdminDocumentsSectionProps {
  admin: AdminRecord;
}

export function AdminDocumentsSection({ admin }: AdminDocumentsSectionProps) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [clients, setClients] = useState<AdminClientProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [targetClientId, setTargetClientId] = useState<string>("");
  const [displayNameInput, setDisplayNameInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Delete Confirmation State
  const [documentToDelete, setDocumentToDelete] = useState<ClientDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [operatingDocId, setOperatingDocId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Load clients for target selection
  useEffect(() => {
    fetchAllClients()
      .then((cls) => {
        setClients(cls);
        if (cls.length > 0) {
          setTargetClientId((prev) => prev || cls[0].uid || cls[0].id);
        }
      })
      .catch((err) => {
        console.warn("Failed fetching clients for document manager:", err);
      });
  }, []);

  // 2. Subscribe to all documents in real-time
  useEffect(() => {
    setIsLoading(true);
    const unsub = subscribeAllDocuments(
      (docs) => {
        setDocuments(docs);
        setIsLoading(false);
      },
      (err) => {
        console.error("Admin documents subscription error:", err);
        setError("Unable to sync documents from Firestore.");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, []);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateDocumentFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid file format or size.");
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    if (!displayNameInput) {
      // Set friendly default name without extension
      const nameParts = file.name.split(".");
      if (nameParts.length > 1) nameParts.pop();
      setDisplayNameInput(nameParts.join("."));
    }
  };

  // Submit Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!selectedFile) {
      setUploadError("Please select a valid document file to upload.");
      return;
    }

    if (!targetClientId) {
      setUploadError("Please select a target client account.");
      return;
    }

    const targetClient = clients.find((c) => c.uid === targetClientId || c.id === targetClientId);

    setIsUploading(true);
    setUploadProgress(0);

    const input: UploadDocumentInput = {
      file: selectedFile,
      clientId: targetClientId,
      clientName: targetClient?.name || undefined,
      clientEmail: targetClient?.email || undefined,
      displayName: displayNameInput.trim() || selectedFile.name,
      visibility: "client",
      uploadedBy: admin.name || "VINORA Lead Architect",
      uploadedByEmail: admin.email || undefined,
    };

    try {
      await uploadClientDocument(input, (progress) => {
        setUploadProgress(progress);
      });

      setActionSuccess(
        `Successfully uploaded "${input.displayName}" for client ${targetClient?.name || targetClientId}!`,
      );
      // Reset upload modal form
      setSelectedFile(null);
      setDisplayNameInput("");
      setUploadProgress(null);
      setIsUploadModalOpen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: unknown) {
      console.error("Upload failed:", err);
      setUploadError(err instanceof Error ? err.message : "Failed to upload document.");
    } finally {
      setIsUploading(false);
    }
  };

  // Delete Document
  const confirmDelete = async () => {
    if (!documentToDelete) return;
    setIsDeleting(true);

    try {
      await deleteClientDocument(documentToDelete.id, documentToDelete.storagePath);
      setActionSuccess(`Deleted "${documentToDelete.name}" successfully.`);
      setDocumentToDelete(null);
    } catch (err: unknown) {
      console.error("Delete failed:", err);
      setError(err instanceof Error ? err.message : "Failed to delete document.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Open / Download Document
  const handleOpenDoc = async (docItem: ClientDocument, download = false) => {
    try {
      setError(null);
      setOperatingDocId(docItem.id);
      const url = await resolveDocumentUrl(docItem);

      const a = document.createElement("a");
      a.href = url;
      if (download) {
        a.download = docItem.fileName || docItem.name;
      }
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: unknown) {
      console.error("Failed opening document:", err);
      setError(err instanceof Error ? err.message : "Unable to retrieve document download link.");
    } finally {
      setOperatingDocId(null);
    }
  };

  // Metrics
  const totalSizeBytes = documents.reduce((acc, d) => acc + (d.sizeBytes || 0), 0);
  const uniqueClientsWithFiles = new Set(documents.map((d) => d.clientId)).size;

  // Filter documents
  const filteredDocuments = documents.filter((docItem) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      docItem.name.toLowerCase().includes(q) ||
      (docItem.fileName && docItem.fileName.toLowerCase().includes(q)) ||
      (docItem.clientName && docItem.clientName.toLowerCase().includes(q)) ||
      (docItem.clientEmail && docItem.clientEmail.toLowerCase().includes(q)) ||
      docItem.clientId.toLowerCase().includes(q);

    const matchesClient =
      selectedClientFilter === "all" || docItem.clientId === selectedClientFilter;

    const matchesType =
      typeFilter === "all" ||
      docItem.fileType?.toUpperCase() === typeFilter.toUpperCase() ||
      docItem.contentType?.toLowerCase().includes(typeFilter.toLowerCase());

    return matchesSearch && matchesClient && matchesType;
  });

  const getFileIcon = (fileType?: string, contentType?: string) => {
    const type = fileType?.toUpperCase() || "";
    if (type === "PDF" || contentType?.includes("pdf")) {
      return <FileText className="size-4 text-rose-400" />;
    }
    if (type === "XLS" || contentType?.includes("sheet") || contentType?.includes("excel")) {
      return <FileSpreadsheet className="size-4 text-emerald-400" />;
    }
    if (type === "IMAGE" || contentType?.startsWith("image/")) {
      return <ImageIcon className="size-4 text-sky-400" />;
    }
    if (type === "ZIP" || contentType?.includes("zip")) {
      return <Archive className="size-4 text-amber-400" />;
    }
    return <File className="size-4 text-muted-foreground" />;
  };

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="font-display text-xl font-medium tracking-tight">
            Client Documents & File Management
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload blueprints, sprint deliverables, and briefs to Firebase Storage. Files are scoped
            strictly to target client accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setIsUploadModalOpen(true);
              setUploadError(null);
            }}
            className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs h-9 px-4"
          >
            <Upload className="size-3.5 mr-1.5" />
            Upload Document for Client
          </Button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-border bg-card p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Total Uploaded Files
          </span>
          <div className="font-display text-2xl font-bold text-foreground">{documents.length}</div>
        </div>

        <div className="border border-border bg-card p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Storage Footprint
          </span>
          <div className="font-display text-2xl font-bold text-foreground">
            {formatDocumentSize(totalSizeBytes)}
          </div>
        </div>

        <div className="border border-border bg-card p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Client Accounts with Files
          </span>
          <div className="font-display text-2xl font-bold text-foreground">
            {uniqueClientsWithFiles}
          </div>
        </div>

        <div className="border border-border bg-card p-4 space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Storage Engine
          </span>
          <div className="font-mono text-xs font-semibold text-emerald-400 flex items-center gap-1.5 pt-1">
            <span className="size-2 rounded-full bg-emerald-500" />
            Firebase Storage
          </div>
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="font-mono text-[11px] underline cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Notification */}
      {error && (
        <div className="border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive flex items-center justify-between">
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
            Reload
          </Button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="border border-border bg-surface p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by file name, client name, email, or UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs rounded-none border-border bg-background"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Client */}
            <select
              value={selectedClientFilter}
              onChange={(e) => setSelectedClientFilter(e.target.value)}
              className="h-9 border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden"
            >
              <option value="all">All Clients ({documents.length})</option>
              {clients.map((c) => (
                <option key={c.uid} value={c.uid}>
                  {c.name} ({c.email || c.uid.slice(0, 8)})
                </option>
              ))}
            </select>

            {/* Filter by Type */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden"
            >
              <option value="all">All Formats</option>
              <option value="PDF">PDF</option>
              <option value="DOC">Word / DOC</option>
              <option value="XLS">Excel / Sheets</option>
              <option value="IMAGE">Images</option>
              <option value="ZIP">ZIP Archives</option>
            </select>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      {isLoading ? (
        <div className="border border-border bg-card p-12 text-center space-y-3">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Loading client documents from Firestore & Cloud Storage...
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="border border-border bg-card p-12 text-center space-y-4">
          <Folder className="size-10 mx-auto text-muted-foreground/40" />
          <div>
            <h3 className="font-display text-sm font-semibold">No Documents Found</h3>
            <p className="mt-1 text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {searchQuery || selectedClientFilter !== "all" || typeFilter !== "all"
                ? "No uploaded files match the applied filter criteria."
                : "No files have been shared with clients yet. Use the upload button above to deliver documents, blueprints, or asset archives."}
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setIsUploadModalOpen(true)}
            className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 font-mono text-xs"
          >
            <Upload className="size-3.5 mr-1" />
            Upload First File
          </Button>
        </div>
      ) : (
        <div className="border border-border bg-card overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface/50 font-mono uppercase tracking-wider text-[0.65rem] text-muted-foreground">
              <tr>
                <th className="p-3.5 sm:px-4">Document</th>
                <th className="p-3.5 sm:px-4">Target Client</th>
                <th className="p-3.5 sm:px-4">Type</th>
                <th className="p-3.5 sm:px-4">Size</th>
                <th className="p-3.5 sm:px-4">Date Uploaded</th>
                <th className="p-3.5 sm:px-4">Uploaded By</th>
                <th className="p-3.5 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {filteredDocuments.map((docItem) => {
                const isOperating = operatingDocId === docItem.id;

                return (
                  <tr key={docItem.id} className="hover:bg-surface/30 transition-colors">
                    {/* Document details */}
                    <td className="p-3.5 sm:px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 border border-border bg-surface shrink-0">
                          {getFileIcon(docItem.fileType, docItem.contentType)}
                        </div>
                        <div className="space-y-0.5">
                          <span className="font-sans font-medium text-foreground text-xs block truncate max-w-xs">
                            {docItem.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground block truncate max-w-xs">
                            {docItem.fileName}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Target Client */}
                    <td className="p-3.5 sm:px-4">
                      <div className="space-y-0.5 font-sans">
                        <span className="font-medium text-foreground text-xs block">
                          {docItem.clientName || "Client Account"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono block">
                          UID: {docItem.clientId.slice(0, 10)}...
                        </span>
                      </div>
                    </td>

                    {/* Format */}
                    <td className="p-3.5 sm:px-4">
                      <span className="border border-border bg-surface px-2 py-0.5 text-[10px] text-foreground">
                        {docItem.fileType || "DOC"}
                      </span>
                    </td>

                    {/* Size */}
                    <td className="p-3.5 sm:px-4 text-muted-foreground">
                      {formatDocumentSize(docItem.sizeBytes)}
                    </td>

                    {/* Date */}
                    <td className="p-3.5 sm:px-4 text-muted-foreground">
                      {docItem.uploadedAt
                        ? new Date(docItem.uploadedAt).toLocaleDateString()
                        : new Date(docItem.createdAt).toLocaleDateString()}
                    </td>

                    {/* Uploader */}
                    <td className="p-3.5 sm:px-4 text-muted-foreground font-sans">
                      {docItem.uploadedBy || "Admin"}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 sm:px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View / Download */}
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isOperating}
                          onClick={() => handleOpenDoc(docItem, false)}
                          className="rounded-none cursor-pointer h-7 text-[11px] font-mono px-2"
                          title="Open preview"
                        >
                          {isOperating ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : (
                            <ExternalLink className="size-3 mr-1" />
                          )}
                          View
                        </Button>

                        <Button
                          size="sm"
                          disabled={isOperating}
                          onClick={() => handleOpenDoc(docItem, true)}
                          className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-7 text-[11px] font-mono px-2"
                          title="Download file"
                        >
                          <Download className="size-3 mr-1" />
                          Save
                        </Button>

                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDocumentToDelete(docItem)}
                          className="rounded-none cursor-pointer text-destructive hover:bg-destructive/10 h-7 px-2"
                          title="Delete document"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: UPLOAD DOCUMENT FOR CLIENT                                      */}
      {/* ========================================================================= */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="border border-border bg-card max-w-lg w-full p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="font-display text-base font-semibold">
                  Upload Document to Firebase Storage
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Securely link file to client account and cloud storage bucket.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isUploading) setIsUploadModalOpen(false);
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {uploadError && (
              <div className="border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit} className="space-y-4 text-xs">
              {/* 1. Select Client */}
              <div className="space-y-1.5">
                <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                  Target Client Account *
                </label>
                <select
                  required
                  value={targetClientId}
                  onChange={(e) => setTargetClientId(e.target.value)}
                  className="w-full h-9 border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden"
                >
                  {clients.length === 0 && <option value="">No registered clients found</option>}
                  {clients.map((c) => (
                    <option key={c.uid} value={c.uid}>
                      {c.name} — {c.email} ({c.uid.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-muted-foreground font-mono">
                  The client will immediately be able to view and download this file in their Client
                  Portal.
                </span>
              </div>

              {/* 2. File Selector */}
              <div className="space-y-1.5">
                <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                  Select File * (Max 50 MB)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.webp,.zip"
                  className="w-full text-xs font-mono file:mr-4 file:py-2 file:px-4 file:border file:border-border file:bg-surface file:text-xs file:font-mono file:cursor-pointer hover:file:bg-surface/80"
                />
                <span className="text-[10px] text-muted-foreground font-mono block">
                  Supported formats: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, JPG, PNG, WEBP, ZIP
                </span>
              </div>

              {/* 3. Display Title */}
              <div className="space-y-1.5">
                <label className="font-mono uppercase tracking-wider text-muted-foreground block text-[11px]">
                  Document Display Title
                </label>
                <Input
                  type="text"
                  placeholder="e.g. Q4 Cloud Architecture Specification v1.2"
                  value={displayNameInput}
                  onChange={(e) => setDisplayNameInput(e.target.value)}
                  className="rounded-none border-border bg-background text-xs h-9"
                />
              </div>

              {/* Progress bar if uploading */}
              {isUploading && uploadProgress !== null && (
                <div className="space-y-1 pt-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-muted-foreground">Uploading to Firebase Storage...</span>
                    <span className="font-semibold text-foreground">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-border overflow-hidden">
                    <div
                      className="h-full bg-foreground transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  onClick={() => setIsUploadModalOpen(false)}
                  className="rounded-none cursor-pointer h-8 text-xs font-mono"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  size="sm"
                  className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-8 text-xs font-mono"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin mr-1.5" />
                      Uploading ({uploadProgress || 0}%)...
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5 mr-1.5" />
                      Confirm & Upload
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRM DELETE DOCUMENT                                         */}
      {/* ========================================================================= */}
      {documentToDelete && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="border border-border bg-card max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-destructive">
              <Trash2 className="size-5 shrink-0" />
              <h3 className="font-display text-base font-semibold">Delete Document?</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to permanently delete{" "}
              <strong className="text-foreground">"{documentToDelete.name}"</strong>? This will
              remove the physical file from Firebase Storage and purge metadata records. The client
              will no longer be able to access it.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                onClick={() => setDocumentToDelete(null)}
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
