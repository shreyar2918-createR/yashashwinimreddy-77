import { useState, useEffect } from "react";
import {
  ShieldCheck,
  User,
  Mail,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Save,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AUTHORIZED_ADMIN_ACCOUNTS,
  updateAdminProfileName,
  type AdminRecord,
} from "@/services/adminAuth";

interface AdminProfileSectionProps {
  admin: AdminRecord;
  onAdminUpdated: (updated: AdminRecord) => void;
  onNavigateSettings: () => void;
}

export function AdminProfileSection({
  admin,
  onAdminUpdated,
  onNavigateSettings,
}: AdminProfileSectionProps) {
  const [nameInput, setNameInput] = useState(admin.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(admin.name || "");
  }, [admin.name]);

  const rosterEntry = AUTHORIZED_ADMIN_ACCOUNTS.find(
    (acc) => acc.email.toLowerCase() === admin.email.toLowerCase(),
  );

  const initials = (admin.name || admin.email || "A")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    if (!nameInput.trim()) {
      setSaveError("Display name cannot be empty.");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateAdminProfileName(admin.uid, nameInput.trim());
      if (updated) {
        onAdminUpdated(updated);
      }
      setSaveSuccess("Administrator display name updated across your active session.");
      setTimeout(() => setSaveSuccess(null), 5000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update admin profile.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="border-b border-white/[0.1] pb-5">
        <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
          Admin Profile
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-zinc-400">
          Your authenticated VINORA leadership identity, role verification, and isolated session
          details.
        </p>
      </div>

      {/* Identity Overview Card */}
      <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl border border-white/15 bg-zinc-800/90 text-xl font-semibold text-white shrink-0">
            {initials || "AD"}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-xl font-semibold text-white">{admin.name}</h3>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                <ShieldCheck className="size-3" />
                Verified Admin
              </span>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-zinc-300">
              {rosterEntry?.title || "Authorized VINORA Studio Administrator"}
            </p>
            <p className="mt-0.5 text-xs text-zinc-400 font-mono">{admin.email}</p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onNavigateSettings}
          className="rounded-xl border-white/15 bg-white/[0.04] hover:bg-white/[0.09] text-xs cursor-pointer self-start sm:self-center"
        >
          View Security Roster
        </Button>
      </div>

      {/* Edit Display Name Form */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-6 space-y-5"
      >
        <div>
          <h3 className="font-display text-base font-medium text-white">Profile Settings</h3>
          <p className="mt-0.5 text-xs text-zinc-400">
            Changes update only your own{" "}
            <span className="font-mono text-zinc-200">/admins/{admin.uid.slice(0, 8)}…</span> record
            and Firebase Auth display name.
          </p>
        </div>

        {saveSuccess && (
          <div className="rounded-xl border border-emerald-500/35 bg-emerald-950/60 p-3 flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {saveError && (
          <div className="rounded-xl border border-rose-500/35 bg-rose-950/60 p-3 flex items-center gap-2 text-xs text-rose-200">
            <AlertCircle className="size-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium flex items-center gap-1.5">
              <User className="size-3.5" />
              Display Name
            </label>
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
              className="rounded-xl border-white/15 bg-zinc-900/85 text-white h-10"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] uppercase tracking-wider text-zinc-400 font-medium flex items-center gap-1.5">
              <Mail className="size-3.5" />
              Registered Admin Email
            </label>
            <Input
              value={admin.email}
              disabled
              className="rounded-xl border-white/10 bg-zinc-900/50 text-zinc-400 h-10 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-1">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
              Firebase Auth UID
            </span>
            <span className="font-mono text-zinc-200 break-all">{admin.uid}</span>
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5 space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 flex items-center gap-1">
              <KeyRound className="size-3" />
              Firestore Verification Record
            </span>
            <span className="font-mono text-zinc-200">/admins/{admin.uid} (Active)</span>
          </div>
        </div>

        <div className="flex justify-end border-t border-white/[0.08] pt-4">
          <Button
            type="submit"
            disabled={isSaving || nameInput.trim() === admin.name}
            className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-medium cursor-pointer h-9 px-4"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
                Saving...
              </>
            ) : (
              <>
                <Save className="size-3.5 mr-1.5" />
                Save Name
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
