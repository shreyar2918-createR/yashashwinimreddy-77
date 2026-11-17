import { useState, useEffect } from "react";
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
  HardDrive,
  FileSpreadsheet,
  Image as ImageIcon,
  Archive,
  Layers,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  subscribeClientDocuments,
  resolveDocumentUrl,
  formatDocumentSize,
  type FileValidationResult,
} from "@/services/documentService";
import type { ClientDocument, UserProfile, ProjectRequest } from "@/lib/types";

interface ClientDocumentsSectionProps {
  profile: UserProfile;
  projectRequests?: ProjectRequest[];
}

export function ClientDocumentsSection({
  profile,
  projectRequests = [],
}: ClientDocumentsSectionProps) {
  const [documents, setDocuments] = useState<ClientDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Subscribe to documents in real time for this client UID
  useEffect(() => {
    if (!profile.id) return;
    setIsLoading(true);

    const unsub = subscribeClientDocuments(
      profile.id,
      (docs) => {
        setDocuments(docs);
        setIsLoading(false);
      },
      (err) => {
        console.error("Client documents subscription error:", err);
        setError("Unable to sync documents from cloud storage.");
        setIsLoading(false);
      },
    );

    return () => unsub();
  }, [profile.id]);

  // Handle document view or download
  const handleOpenDocument = async (docItem: ClientDocument, download = false) => {
    try {
      setDownloadingId(docItem.id);
      const url = await resolveDocumentUrl(docItem);

      if (download) {
        // Trigger browser download via dynamic anchor
        const a = document.createElement("a");
        a.href = url;
        a.download = docItem.fileName || docItem.name;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } else {
        window.open(url, "_blank", "noopener,noreferrer");
      }
    } catch (err: unknown) {
      console.error("Open document error:", err);
      alert(err instanceof Error ? err.message : "Failed to open document file.");
    } finally {
      setDownloadingId(null);
    }
  };

  // Derive inquiry submission files from projectRequests (for backward compatibility)
  const inquiryFiles = projectRequests.flatMap((req) => {
    const paths = Array.isArray(req.attachmentPaths) ? req.attachmentPaths : [];
    return paths.map((path, idx) => ({
      id: `${req.id}-${idx}`,
      name: path.split("/").pop() || `Attachment ${idx + 1}`,
      path,
      date: req.createdAt,
      requestId: req.id,
    }));
  });

  // Filter documents
  const filteredDocuments = documents.filter((docItem) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      docItem.name.toLowerCase().includes(q) ||
      (docItem.fileName && docItem.fileName.toLowerCase().includes(q)) ||
      (docItem.projectTitle && docItem.projectTitle.toLowerCase().includes(q));

    const matchesType =
      typeFilter === "all" ||
      docItem.fileType?.toUpperCase() === typeFilter.toUpperCase() ||
      docItem.contentType?.toLowerCase().includes(typeFilter.toLowerCase());

    return matchesSearch && matchesType;
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

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div>
          <h2 className="font-display text-2xl font-medium tracking-tight">
            Documents & Deliverables
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Architecture blueprints, production files, design tokens, and technical assets shared
            with your account.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-xs border border-border bg-card px-3 py-1 text-muted-foreground">
            Total Files: <strong className="text-foreground">{documents.length}</strong>
          </span>
        </div>
      </div>

      {/* Error Banner */}
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
            Retry
          </Button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="border border-border bg-surface p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search documents by name or project title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs rounded-none border-border bg-background"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 border border-border bg-background px-3 text-xs font-mono text-foreground focus:outline-hidden"
            >
              <option value="all">All File Types</option>
              <option value="PDF">PDF Documents</option>
              <option value="DOC">Word / Briefs</option>
              <option value="XLS">Excel / Sheets</option>
              <option value="IMAGE">Design Images</option>
              <option value="ZIP">Archives (ZIP)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Files Table */}
      {isLoading ? (
        <div className="border border-border bg-surface p-12 text-center space-y-3">
          <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Synchronizing files from Cloud Storage...
          </p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="border border-border bg-surface p-12 text-center space-y-3">
          <Folder className="size-10 mx-auto text-muted-foreground/40" />
          <h3 className="font-display text-base font-semibold">No Documents Shared Yet</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            {searchQuery || typeFilter !== "all"
              ? "No files match your current search or filter."
              : "As milestones and sprints are delivered, your VINORA architecture team will upload blueprints, component specs, and release packages here for download."}
          </p>
        </div>
      ) : (
        <div className="border border-border bg-card divide-y divide-border overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface/50 font-mono uppercase tracking-wider text-[0.65rem] text-muted-foreground">
              <tr>
                <th className="p-3.5 sm:px-4">Document Name</th>
                <th className="p-3.5 sm:px-4">Format</th>
                <th className="p-3.5 sm:px-4">Size</th>
                <th className="p-3.5 sm:px-4">Date Uploaded</th>
                <th className="p-3.5 sm:px-4">Uploaded By</th>
                <th className="p-3.5 sm:px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {filteredDocuments.map((docItem) => {
                const isOperating = downloadingId === docItem.id;

                return (
                  <tr key={docItem.id} className="hover:bg-surface/30 transition-colors">
                    {/* Document Name & Project Reference */}
                    <td className="p-3.5 sm:px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 border border-border bg-surface shrink-0">
                          {getFileIcon(docItem.fileType, docItem.contentType)}
                        </div>
                        <div className="space-y-0.5">
                          <span className="font-sans font-medium text-foreground text-xs block">
                            {docItem.name}
                          </span>
                          {docItem.projectTitle && (
                            <span className="text-[10px] text-muted-foreground font-mono block">
                              Project: {docItem.projectTitle}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Format Badge */}
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
                      {formatDateDisplay(docItem.uploadedAt || docItem.createdAt)}
                    </td>

                    {/* Uploaded By */}
                    <td className="p-3.5 sm:px-4 text-muted-foreground font-sans text-xs">
                      {docItem.uploadedBy || "VINORA Team"}
                    </td>

                    {/* Actions */}
                    <td className="p-3.5 sm:px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isOperating}
                          onClick={() => handleOpenDocument(docItem, false)}
                          className="rounded-none cursor-pointer h-7 text-[11px] font-mono px-2.5"
                          title="Open preview in new tab"
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
                          onClick={() => handleOpenDocument(docItem, true)}
                          className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90 h-7 text-[11px] font-mono px-2.5"
                          title="Download file to device"
                        >
                          {isOperating ? (
                            <Loader2 className="size-3 animate-spin mr-1" />
                          ) : (
                            <Download className="size-3 mr-1" />
                          )}
                          Download
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

      {/* Inquiry Submission Attachments (if client submitted files during onboarding) */}
      {inquiryFiles.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-border">
          <div>
            <h3 className="font-display text-base font-medium">Inquiry Submission Attachments</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Files and design specs you originally provided during project intake.
            </p>
          </div>

          <div className="border border-border divide-y divide-border bg-card">
            {inquiryFiles.map((f) => (
              <div
                key={f.id}
                className="flex flex-col gap-2 p-3.5 sm:flex-row sm:items-center sm:justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <File className="size-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="font-medium text-foreground">{f.name}</span>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      Attached: {formatDateDisplay(f.date)} • Ref: #{f.requestId.slice(0, 8)}
                    </span>
                  </div>
                </div>

                {f.path.startsWith("http") && (
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-none cursor-pointer h-7 text-xs font-mono"
                  >
                    <a href={f.path} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3 mr-1" />
                      View File
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
