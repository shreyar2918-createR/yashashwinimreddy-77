import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  User,
  Mail,
  Building,
  Phone,
  Calendar,
  ShieldCheck,
  KeyRound,
  LogOut,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  EyeOff,
  Copy,
  Check,
  Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getClientDetailedProfile,
  updateClientProfile,
  changeClientPassword,
  deleteClientAccount,
  signOut,
  type ClientDetailedData,
} from "@/services/auth";
import type { UserProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ClientProfileSectionProps {
  initialProfile: UserProfile | null;
  onProfileUpdated?: (updated: UserProfile) => void;
}

const DELETION_REASONS = [
  "No longer need VINORA",
  "Project completed",
  "Not satisfied",
  "Moving to another service",
  "Other",
] as const;

export function ClientProfileSection({
  initialProfile,
  onProfileUpdated,
}: ClientProfileSectionProps) {
  const navigate = useNavigate();

  // Profile data
  const [clientData, setClientData] = useState<ClientDetailedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);

  // Edit profile state
  const [isEditing, setIsEditing] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Change password modal state
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Delete account modal state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState<string>(DELETION_REASONS[0]);
  const [deleteDetails, setDeleteDetails] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePass, setShowDeletePass] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Logout state
  const [logoutLoading, setLogoutLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadData() {
      setLoading(true);
      try {
        const data = await getClientDetailedProfile(initialProfile?.id);
        if (isMounted && data) {
          setClientData(data);
          setEditFullName(data.fullName);
          setEditCompany(data.companyName);
          setEditPhone(data.phone);
        }
      } catch (err) {
        console.warn("Error fetching client data:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      isMounted = false;
    };
  }, [initialProfile?.id]);

  // Handle Edit Profile Save
  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setEditError(null);
    setEditSuccess(null);

    const cleanName = editFullName.trim();
    if (!cleanName) {
      setEditError("Full name is required.");
      return;
    }

    setEditSaving(true);
    try {
      const updated = await updateClientProfile({
        fullName: cleanName,
        companyName: editCompany.trim(),
        phone: editPhone.trim(),
      });

      setClientData((prev) =>
        prev
          ? {
              ...prev,
              fullName: cleanName,
              companyName: editCompany.trim(),
              phone: editPhone.trim(),
              updatedAt: new Date().toISOString(),
            }
          : null,
      );

      setEditSuccess("Profile information updated successfully.");
      setIsEditing(false);
      onProfileUpdated?.(updated);
    } catch (err: unknown) {
      setEditError(
        err instanceof Error ? err.message : "Failed to update profile. Please try again.",
      );
    } finally {
      setEditSaving(false);
    }
  }

  // Handle Cancel Edit
  function handleCancelEdit() {
    if (clientData) {
      setEditFullName(clientData.fullName);
      setEditCompany(clientData.companyName);
      setEditPhone(clientData.phone);
    }
    setEditError(null);
    setIsEditing(false);
  }

  // Handle Change Password Save
  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setPasswordError("New password must contain both letters and numbers.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Confirmation password does not match the new password.");
      return;
    }

    setPasswordSaving(true);
    try {
      await changeClientPassword({
        currentPassword: currentPassword.trim() || undefined,
        newPassword,
      });

      setPasswordSuccess("Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        setIsPasswordModalOpen(false);
        setPasswordSuccess(null);
      }, 1500);
    } catch (err: unknown) {
      setPasswordError(
        err instanceof Error ? err.message : "Failed to change password. Please try again.",
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  // Handle Logout
  async function handleLogout() {
    setLogoutLoading(true);
    try {
      await signOut();
      navigate({ to: "/login", search: { role: "client", mode: "login" } });
    } catch (err) {
      console.error("Sign out error:", err);
      navigate({ to: "/login", search: { role: "client", mode: "login" } });
    } finally {
      setLogoutLoading(false);
    }
  }

  // Handle Permanent Account Deletion
  async function handlePermanentDelete(e: FormEvent) {
    e.preventDefault();
    setDeleteError(null);

    const trimmedConfirm = confirmDeleteText.trim();
    const isPhraseValid =
      trimmedConfirm === "Yes, permanently delete my account" ||
      trimmedConfirm.toUpperCase() === "DELETE";

    if (!isPhraseValid) {
      setDeleteError('Please type "DELETE" or "Yes, permanently delete my account" to confirm.');
      return;
    }

    if (!deleteReason) {
      setDeleteError("Please select a reason for deleting your account.");
      return;
    }

    if (deleteReason === "Other" && !deleteDetails.trim()) {
      setDeleteError("Please enter your reason in the additional details field.");
      return;
    }

    setDeleteLoading(true);
    try {
      await deleteClientAccount({
        password: deletePassword.trim() || undefined,
        reason: deleteReason,
        details: deleteDetails.trim() || undefined,
      });

      setIsDeleteModalOpen(false);
      window.location.href = "/login?role=client&status=account_deleted";
    } catch (err: unknown) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete account. Please try again.",
      );
      setDeleteLoading(false);
    }
  }

  function handleCopyUid() {
    if (clientData?.uid) {
      navigator.clipboard.writeText(clientData.uid);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return "N/A";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center border border-border bg-surface/30 p-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Loading client profile...
          </p>
        </div>
      </div>
    );
  }

  const profile = clientData || {
    uid: initialProfile?.id || "",
    email: initialProfile?.email || "",
    fullName: initialProfile?.fullName || "Client",
    companyName: "",
    phone: "",
    role: initialProfile?.role || "client",
    accountStatus: "active",
    createdAt: initialProfile?.createdAt || new Date().toISOString(),
  };

  return (
    <div className="space-y-10">
      {/* Global notifications */}
      {editSuccess && (
        <div className="flex items-center gap-3 border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-foreground">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
          <p>{editSuccess}</p>
        </div>
      )}

      {/* Main Profile Header Card */}
      <section className="border border-border bg-surface/40 p-6 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-none border border-border bg-foreground text-background font-display text-xl font-bold">
              {profile.fullName
                ? profile.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "CL"}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {profile.accountStatus || "Active"}
                </span>
                <span className="border border-border px-2 py-0.5 text-[0.7rem] font-medium uppercase tracking-wider text-muted-foreground">
                  Role: {profile.role}
                </span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-normal tracking-tight text-foreground sm:text-3xl">
                {profile.fullName}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:self-start">
            {!isEditing ? (
              <Button
                variant="outline"
                size="sm"
                className="rounded-none cursor-pointer"
                onClick={() => {
                  setEditSuccess(null);
                  setIsEditing(true);
                }}
              >
                <Edit3 className="mr-1.5 size-3.5" />
                Edit Profile
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-none cursor-pointer"
                onClick={handleCancelEdit}
              >
                Cancel
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              className="rounded-none cursor-pointer"
              onClick={() => setIsPasswordModalOpen(true)}
            >
              <KeyRound className="mr-1.5 size-3.5" />
              Change Password
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="rounded-none cursor-pointer text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleLogout}
              disabled={logoutLoading}
            >
              {logoutLoading ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <LogOut className="mr-1.5 size-3.5" />
              )}
              Logout
            </Button>
          </div>
        </div>

        {/* UID & Metadata Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Client Identifier:</span>
            <code className="bg-muted/50 px-2 py-0.5 font-mono text-[0.75rem] text-foreground">
              {profile.uid}
            </code>
            <button
              type="button"
              onClick={handleCopyUid}
              className="inline-flex cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
              title="Copy UID"
            >
              {copiedId ? (
                <Check className="size-3.5 text-emerald-500" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <Clock className="size-3.5" />
            <span>Member since: {formatDate(profile.createdAt)}</span>
          </div>
        </div>
      </section>

      {/* Edit Profile Form OR View Profile Grid */}
      {isEditing ? (
        <section className="border border-border bg-background p-6 sm:p-8">
          <div className="mb-6">
            <h3 className="font-display text-xl tracking-tight">Edit Client Profile</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Update your personal name and organization details. Your email address is linked to
              your authentication credentials.
            </p>
          </div>

          {editError && (
            <div className="mb-6 flex items-center gap-3 border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="size-5 shrink-0" />
              <p>{editError}</p>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div>
                <Label htmlFor="editFullName" className="text-xs uppercase tracking-wider">
                  Full Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="editFullName"
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="e.g. Eleanor Vance"
                  className="mt-2 rounded-none border-border"
                />
              </div>

              <div>
                <Label htmlFor="editEmail" className="text-xs uppercase tracking-wider">
                  Email Address
                </Label>
                <Input
                  id="editEmail"
                  type="email"
                  disabled
                  value={profile.email}
                  className="mt-2 rounded-none border-border bg-muted/40 opacity-70 cursor-not-allowed"
                />
                <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
                  Email is your verified login identifier. Contact support to change.
                </p>
              </div>

              <div>
                <Label htmlFor="editCompany" className="text-xs uppercase tracking-wider">
                  Company / Organization
                </Label>
                <Input
                  id="editCompany"
                  type="text"
                  value={editCompany}
                  onChange={(e) => setEditCompany(e.target.value)}
                  placeholder="e.g. Acme Innovations"
                  className="mt-2 rounded-none border-border"
                />
              </div>

              <div>
                <Label htmlFor="editPhone" className="text-xs uppercase tracking-wider">
                  Contact Phone
                </Label>
                <Input
                  id="editPhone"
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="e.g. +1 (555) 019-2834"
                  className="mt-2 rounded-none border-border"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
              <Button
                type="button"
                variant="outline"
                className="rounded-none cursor-pointer"
                onClick={handleCancelEdit}
                disabled={editSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90"
                disabled={editSaving}
              >
                {editSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Saving Changes...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </div>
          </form>
        </section>
      ) : (
        <section className="grid gap-6 sm:grid-cols-2">
          {/* Contact Details Card */}
          <div className="border border-border bg-background p-6">
            <h3 className="font-display text-lg tracking-tight">Contact Information</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Used for official project deliverables and communications.
            </p>

            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex items-start justify-between border-b border-border/60 pb-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <User className="size-4" /> Full Name
                </dt>
                <dd className="font-medium text-foreground text-right">{profile.fullName}</dd>
              </div>

              <div className="flex items-start justify-between border-b border-border/60 pb-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Mail className="size-4" /> Email Address
                </dt>
                <dd className="font-medium text-foreground text-right">{profile.email}</dd>
              </div>

              <div className="flex items-start justify-between border-b border-border/60 pb-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Building className="size-4" /> Organization
                </dt>
                <dd className="font-medium text-foreground text-right">
                  {profile.companyName || (
                    <span className="text-muted-foreground/60 italic">Not specified</span>
                  )}
                </dd>
              </div>

              <div className="flex items-start justify-between pb-1">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Phone className="size-4" /> Phone
                </dt>
                <dd className="font-medium text-foreground text-right">
                  {profile.phone || (
                    <span className="text-muted-foreground/60 italic">Not specified</span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Security & Access Card */}
          <div className="border border-border bg-background p-6">
            <h3 className="font-display text-lg tracking-tight">Security & Credentials</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Authentication state and access control credentials.
            </p>

            <dl className="mt-6 space-y-4 text-sm">
              <div className="flex items-start justify-between border-b border-border/60 pb-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <ShieldCheck className="size-4" /> Portal Role
                </dt>
                <dd className="font-medium uppercase tracking-wider text-foreground text-right">
                  {profile.role}
                </dd>
              </div>

              <div className="flex items-start justify-between border-b border-border/60 pb-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <KeyRound className="size-4" /> Password
                </dt>
                <dd className="font-medium text-foreground text-right">
                  <span className="tracking-widest">••••••••••••</span>
                </dd>
              </div>

              <div className="flex items-start justify-between border-b border-border/60 pb-3">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="size-4" /> Account Created
                </dt>
                <dd className="font-medium text-foreground text-right">
                  {formatDate(profile.createdAt)}
                </dd>
              </div>

              <div className="flex items-start justify-between pb-1">
                <dt className="text-muted-foreground flex items-center gap-2">
                  <Clock className="size-4" /> Last Updated
                </dt>
                <dd className="font-medium text-foreground text-right">
                  {profile.updatedAt ? formatDate(profile.updatedAt) : "Initial creation"}
                </dd>
              </div>
            </dl>

            <div className="mt-6 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                className="w-full rounded-none cursor-pointer"
                onClick={() => setIsPasswordModalOpen(true)}
              >
                Update Password
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Danger Zone: Account Deletion */}
      <section className="border border-destructive/30 bg-destructive/[0.02] p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-display text-lg text-destructive tracking-tight flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Permanent Account Deletion
            </h3>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Permanently delete your VINORA client account and all associated profile records. This
              action cannot be undone.
            </p>
          </div>

          <Button
            variant="destructive"
            className="rounded-none cursor-pointer shrink-0"
            onClick={() => {
              setDeleteError(null);
              setIsDeleteModalOpen(true);
            }}
          >
            <Trash2 className="mr-1.5 size-4" />
            Delete Account
          </Button>
        </div>
      </section>

      {/* ========================================================= */}
      {/* Change Password Modal */}
      {/* ========================================================= */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="rounded-none border border-border bg-background p-6 sm:p-8 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl tracking-tight">
              Change Account Password
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Enter your current password followed by your new password.
            </DialogDescription>
          </DialogHeader>

          {passwordSuccess && (
            <div className="flex items-center gap-3 border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm text-foreground">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
              <p>{passwordSuccess}</p>
            </div>
          )}

          {passwordError && (
            <div className="flex items-center gap-3 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <p>{passwordError}</p>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <Label htmlFor="currentPassword" className="text-xs uppercase tracking-wider">
                Current Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="currentPassword"
                  type={showCurrentPass ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                  className="rounded-none pr-10 border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showCurrentPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="newPassword" className="text-xs uppercase tracking-wider">
                New Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="newPassword"
                  type={showNewPass ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  className="rounded-none pr-10 border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showNewPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                <li
                  className={cn(
                    "flex items-center gap-1.5",
                    newPassword.length >= 8 ? "text-emerald-500" : "",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  At least 8 characters
                </li>
                <li
                  className={cn(
                    "flex items-center gap-1.5",
                    /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword)
                      ? "text-emerald-500"
                      : "",
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  Contains both letters and numbers
                </li>
              </ul>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-xs uppercase tracking-wider">
                Confirm New Password
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="confirmPassword"
                  type={showConfirmPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="rounded-none pr-10 border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showConfirmPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <DialogFooter className="mt-6 flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-none cursor-pointer"
                onClick={() => setIsPasswordModalOpen(false)}
                disabled={passwordSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-none cursor-pointer bg-foreground text-background hover:bg-foreground/90"
                disabled={passwordSaving}
              >
                {passwordSaving ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Updating...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* Permanent Account Deletion Modal */}
      {/* ========================================================= */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="rounded-none border border-destructive/50 bg-background p-6 sm:p-8 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl text-destructive tracking-tight flex items-center gap-2">
              <AlertTriangle className="size-5" />
              Permanently Delete Account
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              This action is permanent and irreversible. All your authenticated profile information,
              client portal privileges, and access records will be permanently removed.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <div className="flex items-center gap-3 border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              <p>{deleteError}</p>
            </div>
          )}

          <form onSubmit={handlePermanentDelete} className="space-y-5">
            {/* Reason selector */}
            <div>
              <Label htmlFor="deleteReason" className="text-xs uppercase tracking-wider">
                Please tell us why you are leaving <span className="text-destructive">*</span>
              </Label>
              <select
                id="deleteReason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="mt-1.5 w-full rounded-none border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground"
              >
                {DELETION_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {reason}
                  </option>
                ))}
              </select>
            </div>

            {/* Additional details */}
            <div>
              <Label htmlFor="deleteDetails" className="text-xs uppercase tracking-wider">
                {deleteReason === "Other" ? (
                  <>
                    Specify Reason <span className="text-destructive">*</span>
                  </>
                ) : (
                  "Additional details (optional)"
                )}
              </Label>
              <Textarea
                id="deleteDetails"
                value={deleteDetails}
                onChange={(e) => setDeleteDetails(e.target.value)}
                placeholder={
                  deleteReason === "Other"
                    ? "Please describe why you are deleting your account..."
                    : "Share any feedback to help us improve (optional)..."
                }
                rows={2}
                className="mt-1.5 rounded-none border-border resize-none"
              />
            </div>

            {/* Re-authentication password */}
            <div>
              <Label htmlFor="deletePassword" className="text-xs uppercase tracking-wider">
                Current Password{" "}
                <span className="text-muted-foreground font-normal lowercase">
                  (if password-protected)
                </span>
              </Label>
              <div className="relative mt-1.5">
                <Input
                  id="deletePassword"
                  type={showDeletePass ? "text" : "password"}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter current password if requested"
                  className="rounded-none pr-10 border-border"
                />
                <button
                  type="button"
                  onClick={() => setShowDeletePass(!showDeletePass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showDeletePass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <p className="mt-1 text-[0.7rem] text-muted-foreground">
                Firebase may require recent credentials to authorize permanent account deletion.
              </p>
            </div>

            {/* Type confirmation phrase */}
            <div className="border border-border/80 bg-muted/20 p-4">
              <Label
                htmlFor="confirmDeleteText"
                className="text-xs font-semibold uppercase tracking-wider"
              >
                To confirm, type: <span className="font-mono text-destructive">DELETE</span> or{" "}
                <span className="font-mono text-destructive">
                  Yes, permanently delete my account
                </span>
              </Label>
              <Input
                id="confirmDeleteText"
                type="text"
                value={confirmDeleteText}
                onChange={(e) => setConfirmDeleteText(e.target.value)}
                placeholder='Type "DELETE" or the exact phrase above'
                required
                className="mt-2 rounded-none border-border font-mono text-xs"
              />
            </div>

            <DialogFooter className="mt-6 flex gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="rounded-none cursor-pointer"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={deleteLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="rounded-none cursor-pointer"
                disabled={
                  deleteLoading ||
                  (confirmDeleteText.trim() !== "Yes, permanently delete my account" &&
                    confirmDeleteText.trim().toUpperCase() !== "DELETE")
                }
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Deleting Account...
                  </>
                ) : (
                  "Permanently Delete My Account"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
