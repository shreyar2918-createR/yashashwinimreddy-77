import { useState, useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  FolderGit2,
  FileText,
  CreditCard,
  Receipt,
  Calendar,
  Folder,
  MessageSquare,
  Megaphone,
  Bell,
  Inbox,
  Mail,
  Gift,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
  ExternalLink,
  Check,
} from "lucide-react";

import { LogoMark } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";
import { AUTHORIZED_ADMIN_ACCOUNTS } from "@/services/adminAuth";
import type { Notification } from "@/lib/types";
import adminStudioBackdropImg from "@/assets/images/admin_studio_backdrop_1794912043040.jpg";

export interface AdminPortalLayoutProps {
  activeSection: string;
  onSelectSection: (section: string) => void;
  onSignOut: () => void;
  adminName?: string;
  adminEmail?: string;
  unreadMessagesCount?: number;
  pendingProposalsCount?: number;
  pendingMeetingsCount?: number;
  pendingRequestsCount?: number;
  newEnquiriesCount?: number;
  notifications?: Notification[];
  onMarkNotificationRead?: (id: string) => void;
  onMarkAllNotificationsRead?: () => void;
  showStudioBackground?: boolean;
  children: ReactNode;
}

interface SidebarNavEntry {
  label: string;
  section: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

function getInitials(name?: string, email?: string): string {
  const source = (name || "").trim() || (email || "").split("@")[0] || "A";
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function getSectionDisplayLabel(activeSection: string): string {
  switch (activeSection) {
    case "Dashboard":
      return "Dashboard";
    case "Meeting Requests":
      return "Meetings";
    case "Admin Profile":
      return "Admin Profile";
    default:
      return activeSection;
  }
}

function formatNotificationDate(dateStr?: string): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

export function resolveAdminNotificationSection(notif: Notification): string {
  const link = (notif.link || "").toLowerCase();
  const type = (notif.type || "").toLowerCase();
  if (link.includes("meeting") || type.includes("meeting")) return "Meeting Requests";
  if (
    link.includes("payment") ||
    type.includes("payment_completed") ||
    type.includes("payment_failed")
  ) {
    return "Payments";
  }
  if (link.includes("invoice") || type.includes("invoice")) return "Invoices";
  if (link.includes("proposal") || type.includes("proposal")) return "Proposals";
  if (link.includes("request") || type.includes("request")) return "Project Requests";
  if (link.includes("enquir") || type.includes("contact")) return "Contact Enquiries";
  if (link.includes("document") || type.includes("document")) return "Documents";
  if (link.includes("message") || type.includes("message")) return "Messages";
  if (link.includes("project") || type.includes("project") || notif.projectId) return "Projects";
  if (link.includes("update") || type.includes("update")) return "Updates";
  return "Notifications";
}

export function AdminPortalLayout({
  activeSection,
  onSelectSection,
  onSignOut,
  adminName,
  adminEmail,
  unreadMessagesCount = 0,
  pendingProposalsCount = 0,
  pendingMeetingsCount = 0,
  pendingRequestsCount = 0,
  newEnquiriesCount = 0,
  notifications = [],
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  showStudioBackground = false,
  children,
}: AdminPortalLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const unreadNotificationsCount = notifications.filter((n) => !n.read && !n.readAt).length;

  const primaryNav: SidebarNavEntry[] = [
    { label: "Dashboard", section: "Dashboard", icon: LayoutDashboard },
    { label: "Clients", section: "Clients", icon: Users },
    { label: "Projects", section: "Projects", icon: FolderGit2 },
    {
      label: "Proposals",
      section: "Proposals",
      icon: FileText,
      badge: pendingProposalsCount > 0 ? pendingProposalsCount : undefined,
    },
    { label: "Payments", section: "Payments", icon: CreditCard },
    { label: "Invoices", section: "Invoices", icon: Receipt },
    {
      label: "Meetings",
      section: "Meeting Requests",
      icon: Calendar,
      badge: pendingMeetingsCount > 0 ? pendingMeetingsCount : undefined,
    },
    { label: "Documents", section: "Documents", icon: Folder },
    {
      label: "Messages",
      section: "Messages",
      icon: MessageSquare,
      badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
    },
    { label: "Updates", section: "Updates", icon: Megaphone },
    {
      label: "Notifications",
      section: "Notifications",
      icon: Bell,
      badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined,
    },
  ];

  const intakeNav: SidebarNavEntry[] = [
    {
      label: "Project Requests",
      section: "Project Requests",
      icon: Inbox,
      badge: pendingRequestsCount > 0 ? pendingRequestsCount : undefined,
    },
    {
      label: "Contact Enquiries",
      section: "Contact Enquiries",
      icon: Mail,
      badge: newEnquiriesCount > 0 ? newEnquiriesCount : undefined,
    },
    { label: "Referrals", section: "Referrals", icon: Gift },
  ];

  const accountNav: SidebarNavEntry[] = [
    { label: "Admin Profile", section: "Admin Profile", icon: User },
    { label: "Settings", section: "Settings", icon: Settings },
  ];

  // Close profile and notifications dropdowns on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setProfileMenuOpen(false);
        setNotificationsOpen(false);
        setMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const displayName =
    (adminName || "").trim() || (adminEmail ? adminEmail.split("@")[0] : "Administrator");
  const initials = getInitials(adminName, adminEmail);
  const activeDisplayLabel = getSectionDisplayLabel(activeSection);
  const rosterMatch = AUTHORIZED_ADMIN_ACCOUNTS.find(
    (acc) => acc.email.toLowerCase() === (adminEmail || "").toLowerCase(),
  );
  const roleTitle = rosterMatch?.title || "Authorized VINORA Administrator";

  function handleNavClick(section: string) {
    onSelectSection(section);
    setMobileMenuOpen(false);
  }

  function renderNavGroup(items: SidebarNavEntry[], title?: string) {
    return (
      <div className="space-y-1">
        {title && (
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            {title}
          </p>
        )}
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.section;
          return (
            <button
              key={item.section}
              type="button"
              onClick={() => handleNavClick(item.section)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "w-full flex items-center justify-between gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all cursor-pointer text-left",
                isActive
                  ? "bg-zinc-800/95 text-white border border-white/10 shadow-xs"
                  : "text-zinc-400 border border-transparent hover:bg-white/[0.04] hover:text-zinc-100",
              )}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-white" : "text-zinc-500",
                  )}
                />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[11px] font-medium tabular-nums shrink-0",
                    isActive
                      ? "bg-white text-zinc-950"
                      : "bg-zinc-800 text-zinc-200 border border-white/10",
                  )}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  function renderSidebarContent(isMobile = false) {
    return (
      <div className="flex h-full flex-col justify-between px-3.5 py-5 overflow-y-auto">
        <div className="space-y-5">
          {/* Top VINORA Branding */}
          <div className="flex items-center justify-between px-2.5">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 group focus-visible:outline-none"
              aria-label="VINORA home"
            >
              <LogoMark className="size-8 rounded-md bg-black border-white/15" />
              <div className="flex flex-col">
                <span className="font-brand-serif text-lg font-medium tracking-[0.26em] uppercase text-white select-none leading-none">
                  VINORA
                </span>
                <span className="mt-1 text-[9px] font-mono uppercase tracking-[0.22em] text-zinc-400">
                  Admin Studio
                </span>
              </div>
            </Link>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label="Close navigation menu"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          <nav aria-label="Admin portal navigation" className="space-y-5">
            {renderNavGroup(primaryNav)}
            {renderNavGroup(intakeNav, "Intake & Growth")}
            {renderNavGroup(accountNav, "Administration")}
          </nav>
        </div>

        {/* Sticky Bottom Logout */}
        <div className="border-t border-white/[0.08] pt-3 mt-5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onSignOut();
            }}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-rose-300 transition-colors cursor-pointer text-left"
          >
            <LogOut className="size-4 shrink-0 text-zinc-500" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "dark admin-portal-dark min-h-screen text-zinc-100 relative overflow-x-clip",
        showStudioBackground ? "bg-zinc-950" : "bg-[#08080a]",
      )}
    >
      {showStudioBackground ? (
        /* Full-screen authenticated Admin Dashboard architectural studio photograph */
        <div
          data-testid="admin-studio-backdrop"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
          aria-hidden="true"
          style={{
            backgroundImage: `url('${adminStudioBackdropImg}')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Subtle readability overlay preserving studio architecture, lighting, glass, and plants */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(8,8,11,0.58) 0%, rgba(10,10,14,0.38) 42%, rgba(7,7,10,0.66) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(88% 68% at 56% 42%, rgba(0,0,0,0.06) 0%, rgba(6,6,9,0.52) 100%)",
            }}
          />
        </div>
      ) : (
        /* Pre-auth / guard dark architectural backdrop matching Client Portal */
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(65% 50% at 75% 0%, rgba(255,255,255,0.035), transparent 70%), radial-gradient(50% 45% at 15% 100%, rgba(255,255,255,0.02), transparent 70%)",
            }}
          />
        </div>
      )}

      {/* Desktop Fixed Left Sidebar (240px wide) */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[240px] backdrop-blur-md border-r z-30",
          showStudioBackground
            ? "bg-[#0a0a0e]/78 border-white/[0.11]"
            : "bg-[#0c0c0f]/95 border-white/[0.08]",
        )}
      >
        {renderSidebarContent(false)}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-[264px] max-w-[82vw] h-full bg-[#0c0c0f]/92 backdrop-blur-md border-r border-white/10 z-10 shadow-2xl">
            {renderSidebarContent(true)}
          </aside>
        </div>
      )}

      {/* Main Content Area on Right */}
      <div className="lg:pl-[240px] flex min-h-screen flex-col relative z-10">
        {/* Top Frosted Header */}
        <header
          className={cn(
            "sticky top-0 z-20 h-16 border-b backdrop-blur-md px-4 sm:px-8 flex items-center justify-between gap-4",
            showStudioBackground
              ? "bg-[#0a0a0e]/58 border-white/[0.09]"
              : "bg-[#08080a]/85 border-white/[0.06]",
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg border border-white/10 bg-zinc-900/80 p-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
            >
              <Menu className="size-4" />
            </button>

            <div className="flex items-center gap-2 lg:hidden">
              <LogoMark className="size-7 rounded-md bg-black border-white/15 shrink-0" />
              <span className="hidden sm:inline font-brand-serif text-base tracking-[0.22em] uppercase text-white">
                VINORA
              </span>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-500">
              <span>Admin Portal</span>
              <span>/</span>
              <span className="text-zinc-200 font-medium">{activeDisplayLabel}</span>
            </div>
          </div>

          {/* Top-right Notification Bell + Admin Profile Dropdown */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((prev) => !prev);
                  setProfileMenuOpen(false);
                }}
                aria-expanded={notificationsOpen}
                aria-label={
                  unreadNotificationsCount > 0
                    ? `Admin notifications (${unreadNotificationsCount} unread)`
                    : "Admin notifications"
                }
                className="relative flex size-9 items-center justify-center rounded-full border border-white/[0.08] bg-zinc-900/75 hover:bg-zinc-800/90 text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <Bell className="size-4" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex min-w-[1.125rem] h-[1.125rem] items-center justify-center rounded-full bg-white text-zinc-950 px-1 text-[10px] font-semibold tabular-nums">
                    {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div
                  role="region"
                  aria-label="Admin notifications"
                  className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-white/10 bg-[#131317] shadow-2xl z-40 overflow-hidden"
                >
                  <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-white">
                        Studio Alerts
                      </span>
                      {unreadNotificationsCount > 0 && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-zinc-200 tabular-nums">
                          {unreadNotificationsCount} new
                        </span>
                      )}
                    </div>
                    {unreadNotificationsCount > 0 && onMarkAllNotificationsRead && (
                      <button
                        type="button"
                        onClick={() => onMarkAllNotificationsRead()}
                        className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <Check className="size-3" />
                        <span>Mark all read</span>
                      </button>
                    )}
                  </div>

                  {notifications.length > 0 ? (
                    <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.06]">
                      {notifications.slice(0, 8).map((item) => {
                        const isUnread = !item.read && !item.readAt;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              if (isUnread && onMarkNotificationRead) {
                                onMarkNotificationRead(item.id);
                              }
                              setNotificationsOpen(false);
                              onSelectSection(resolveAdminNotificationSection(item));
                            }}
                            className={cn(
                              "w-full text-left px-4 py-3 transition-colors hover:bg-white/[0.04] cursor-pointer flex items-start gap-2.5",
                              isUnread ? "bg-white/[0.03]" : "",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-1.5 size-1.5 rounded-full shrink-0",
                                isUnread ? "bg-white" : "bg-zinc-600",
                              )}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-2">
                                <p
                                  className={cn(
                                    "text-xs truncate",
                                    isUnread
                                      ? "font-semibold text-white"
                                      : "font-medium text-zinc-300",
                                  )}
                                >
                                  {item.title}
                                </p>
                                <span className="text-[10px] text-zinc-500 shrink-0 tabular-nums">
                                  {formatNotificationDate(item.createdAt)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                                {item.body}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <Bell className="mx-auto size-6 text-zinc-600" />
                      <p className="mt-2 text-xs font-medium text-zinc-300">
                        No unread studio alerts
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        Meeting requests, Razorpay payments, and client actions appear here.
                      </p>
                    </div>
                  )}

                  <div className="border-t border-white/[0.08] bg-white/[0.02] px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setNotificationsOpen(false);
                        onSelectSection("Notifications");
                      }}
                      className="w-full text-center text-[11px] font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    >
                      View all Notifications
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Dynamic Authenticated Admin Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen((prev) => !prev);
                  setNotificationsOpen(false);
                }}
                aria-expanded={profileMenuOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2.5 rounded-full border border-white/[0.08] bg-zinc-900/75 hover:bg-zinc-800/90 pl-1.5 pr-3 py-1.5 transition-colors cursor-pointer"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-zinc-800 border border-white/15 text-xs font-semibold text-white shrink-0">
                  {initials}
                </span>
                <span className="text-xs sm:text-sm font-medium text-zinc-100 truncate max-w-[115px] sm:max-w-[200px]">
                  {displayName}
                </span>
                <ChevronDown
                  className={cn(
                    "size-3.5 text-zinc-400 transition-transform duration-200 shrink-0",
                    profileMenuOpen && "rotate-180",
                  )}
                />
              </button>

              {profileMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 rounded-xl border border-white/10 bg-[#131317] p-1.5 shadow-2xl z-40"
                >
                  <div className="border-b border-white/[0.08] px-3 py-2.5 mb-1">
                    <p className="text-sm font-medium text-white truncate">{displayName}</p>
                    {adminEmail && (
                      <p className="text-xs text-zinc-400 truncate mt-0.5">{adminEmail}</p>
                    )}
                    <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 mt-1 truncate">
                      {roleTitle}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onSelectSection("Admin Profile");
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
                  >
                    <User className="size-3.5 text-zinc-400" />
                    <span>Admin Profile</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onSelectSection("Updates");
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
                  >
                    <Megaphone className="size-3.5 text-zinc-400" />
                    <span>Publish Update</span>
                  </button>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onSelectSection("Settings");
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.06] transition-colors cursor-pointer text-left"
                  >
                    <Settings className="size-3.5 text-zinc-400" />
                    <span>Security & Settings</span>
                  </button>

                  <Link
                    to="/"
                    role="menuitem"
                    onClick={() => setProfileMenuOpen(false)}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/[0.06] transition-colors"
                  >
                    <ExternalLink className="size-3.5 text-zinc-400" />
                    <span>Main Website</span>
                  </Link>

                  <div className="my-1 border-t border-white/[0.08]" />

                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onSignOut();
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="size-3.5" />
                    <span>Logout</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Dashboard Workspace */}
        <main className="flex-1 w-full max-w-[1380px] mx-auto px-4 py-6 sm:px-8 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
