import { useMemo, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Calendar,
  CreditCard,
  FileText,
  FolderOpen,
  Inbox,
  Mail,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { resolveAdminNotificationSection } from "@/components/layout/AdminPortalLayout";
import type { Notification } from "@/lib/types";

interface AdminNotificationsSectionProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigateSection: (section: string) => void;
}

export function AdminNotificationsSection({
  notifications,
  onMarkRead,
  onMarkAllRead,
  onNavigateSection,
}: AdminNotificationsSectionProps) {
  const [filterMode, setFilterMode] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read && !n.readAt).length,
    [notifications],
  );

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const isUnread = !n.read && !n.readAt;
      if (filterMode === "unread" && !isUnread) return false;
      if (typeFilter === "all") return true;
      const t = (n.type || "").toLowerCase();
      return t.includes(typeFilter);
    });
  }, [notifications, filterMode, typeFilter]);

  function getNotifIcon(type: string) {
    const t = type.toLowerCase();
    if (t.includes("meeting")) return Calendar;
    if (t.includes("payment") || t.includes("invoice")) return CreditCard;
    if (t.includes("proposal")) return FileText;
    if (t.includes("project")) return FolderOpen;
    if (t.includes("message")) return MessageSquare;
    if (t.includes("request")) return Inbox;
    if (t.includes("contact")) return Mail;
    return Bell;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.1] pb-5">
        <div>
          <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white">
            Notifications Center
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-zinc-400">
            Real-time operational alerts for client bookings, Razorpay payments, project
            submissions, and messages.
          </p>
        </div>

        {unreadCount > 0 && (
          <Button
            onClick={onMarkAllRead}
            className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 cursor-pointer text-xs font-medium h-9 px-4 shrink-0"
          >
            <CheckCheck className="size-4 mr-1.5" />
            Mark All Read ({unreadCount})
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {(["all", "unread"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFilterMode(mode)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors cursor-pointer ${
                filterMode === mode
                  ? "bg-white text-zinc-950"
                  : "border border-white/[0.1] bg-[#0c0c11]/70 text-zinc-300 hover:text-white"
              }`}
            >
              {mode === "all" ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: "all", label: "All Topics" },
            { key: "meeting", label: "Meetings" },
            { key: "payment", label: "Payments" },
            { key: "proposal", label: "Proposals" },
            { key: "project", label: "Projects" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTypeFilter(item.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                typeFilter === item.key
                  ? "bg-zinc-800 text-white border border-white/20"
                  : "border border-white/[0.08] bg-[#0c0c11]/60 text-zinc-400 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md p-12 text-center">
          <Bell className="size-9 mx-auto text-zinc-500" />
          <h3 className="mt-3 font-display text-base font-medium text-white">
            {filterMode === "unread" ? "All caught up" : "No notifications yet"}
          </h3>
          <p className="mt-1 text-xs text-zinc-400 max-w-sm mx-auto">
            {filterMode === "unread"
              ? "Every alert in your studio feed has been reviewed."
              : "Notifications for new meeting requests, payment confirmations, and client milestones will appear here automatically."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.12] bg-[#0c0c11]/72 backdrop-blur-md divide-y divide-white/[0.07] overflow-hidden">
          {filtered.map((item) => {
            const isUnread = !item.read && !item.readAt;
            const Icon = getNotifIcon(item.type);
            const target = resolveAdminNotificationSection(item);

            return (
              <div
                key={item.id}
                className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                  isUnread ? "bg-white/[0.03]" : "hover:bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-zinc-200 mt-0.5">
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isUnread && <span className="size-2 rounded-full bg-white shrink-0" />}
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <span className="text-[11px] text-zinc-500 tabular-nums">
                        {new Date(item.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{item.body}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isUnread && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onMarkRead(item.id)}
                      className="rounded-lg h-8 text-xs border-white/15 bg-white/[0.03] hover:bg-white/[0.08] cursor-pointer"
                    >
                      <Check className="size-3.5 mr-1" />
                      Mark read
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isUnread) onMarkRead(item.id);
                      onNavigateSection(target);
                    }}
                    className="rounded-lg h-8 text-xs border-white/15 bg-white/[0.03] hover:bg-white hover:text-zinc-950 cursor-pointer"
                  >
                    Open {target === "Meeting Requests" ? "Meetings" : target}
                    <ChevronRight className="size-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
