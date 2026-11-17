import { Link } from "@tanstack/react-router";
import { useState, useEffect, type ReactNode } from "react";
import {
  LayoutDashboard,
  Users,
  FolderGit2,
  Bell,
  ScrollText,
  Files,
  Receipt,
  CreditCard,
  MessageSquare,
  Calendar,
  Gift,
  Sparkles,
  Inbox,
  User,
  Settings,
  HelpCircle,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LogOut,
  ShieldCheck,
  Building2,
  Mail,
  Compass,
  ArrowUpRight,
  ChevronDown,
} from "lucide-react";

import { LogoLockup } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { subscribeToAuth, signOut } from "@/services/auth";
import type { UserProfile } from "@/lib/types";

export interface PortalNavItem {
  label: string;
  description: string;
  badge?: number | string;
  icon?: ReactNode;
}

/**
 * Returns an appropriate, refined Lucide icon for each section
 */
function getSectionIcon(label: string) {
  const s = label.toLowerCase().trim();
  if (s.includes("overview") || s.includes("dashboard")) return LayoutDashboard;
  if (s.includes("client")) return Users;
  if (s.includes("project request") || s.includes("request")) return Inbox;
  if (s.includes("project")) return FolderGit2;
  if (s.includes("update") || s.includes("announcement")) return Bell;
  if (s.includes("proposal")) return ScrollText;
  if (s.includes("document") || s.includes("file")) return Files;
  if (s.includes("invoice")) return Receipt;
  if (s.includes("payment")) return CreditCard;
  if (s.includes("message") || s.includes("chat")) return MessageSquare;
  if (s.includes("meeting") || s.includes("consultation")) return Calendar;
  if (s.includes("refer")) return Gift;
  if (s.includes("showcase")) return Sparkles;
  if (s.includes("contact") || s.includes("enquir")) return Mail;
  if (s.includes("profile")) return User;
  if (s.includes("setting") || s.includes("security")) return Settings;
  if (s.includes("support")) return HelpCircle;
  return Compass;
}

export function PortalLayout({
  portal,
  title,
  intro,
  nav,
  activeLabel,
  onSelectNav,
  userProfile,
  onSignOut,
  children,
}: {
  portal: string;
  title: string;
  intro: string;
  nav: PortalNavItem[];
  activeLabel: string;
  onSelectNav?: (label: string) => void;
  userProfile?: UserProfile | null;
  onSignOut?: () => Promise<void> | void;
  children: ReactNode;
}) {
  const [profile, setProfile] = useState<UserProfile | null>(userProfile ?? null);
  // Collapsible desktop sidebar state (saved in localStorage for client preference)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vinora_sidebar_collapsed") === "true";
    }
    return false;
  });
  // Mobile drawer slide-in state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    if (userProfile !== undefined) {
      setProfile(userProfile);
      return;
    }
    return subscribeToAuth((user) => {
      setProfile(user);
    });
  }, [userProfile]);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("vinora_sidebar_collapsed", String(next));
      }
      return next;
    });
  };

  async function handleSignOut() {
    if (onSignOut) {
      await onSignOut();
      return;
    }
    await signOut();
    window.location.href = "/login?role=client&mode=login";
  }

  const handleNavClick = (label: string) => {
    if (onSelectNav) {
      onSelectNav(label);
    }
    setIsMobileOpen(false);
  };

  const activeIndex = nav.findIndex((item) => item.label === activeLabel);
  const activeNumber = activeIndex >= 0 ? String(activeIndex + 1).padStart(2, "0") : "01";

  const userInitial = (profile?.fullName?.[0] || profile?.email?.[0] || "V").toUpperCase();
  const userName = profile?.fullName || profile?.email?.split("@")[0] || "Client";
  const userSub = profile?.email || (profile?.id ? `ID: ${profile.id.slice(0, 8)}` : "");
  const roleName = (
    profile?.role || (portal.toLowerCase().includes("admin") ? "Admin" : "Client")
  ).toUpperCase();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans selection:bg-foreground selection:text-background">
      {/* ======================================================== */}
      {/* 1. TOP HEADER BAR (Deep Ink Architectural Master Header)  */}
      {/* ======================================================== */}
      <header className="sticky top-0 z-40 border-b border-ink-border bg-ink text-ink-foreground shadow-md backdrop-blur-md">
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 relative overflow-hidden">
          <div
            className="noise-layer pointer-events-none absolute inset-0 opacity-20"
            aria-hidden
          />
          <div className="hero-grid pointer-events-none absolute inset-0 opacity-25" aria-hidden />

          {/* Left: Mobile Hamburger & Breadcrumb */}
          <div className="relative z-10 flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-ink-foreground hover:bg-white/10 transition-colors cursor-pointer border border-ink-border"
            >
              <Menu className="size-5" />
            </button>

            <Link to="/" className="flex items-center gap-2 transition-opacity hover:opacity-90">
              <LogoLockup />
            </Link>

            <div className="hidden sm:flex items-center gap-2 pl-4 border-l border-ink-border text-xs font-mono">
              <span className="uppercase tracking-widest text-ink-foreground/60">{portal}</span>
              <span className="text-ink-foreground/30">/</span>
              <span className="font-medium text-white tracking-tight uppercase">{activeLabel}</span>
            </div>
          </div>

          {/* Right: Quick actions & Link to main site */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 border border-ink-border bg-white/5 px-2.5 py-1 text-ink-foreground/70 font-mono text-[10px]">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>STUDIO SECURE</span>
            </div>

            <Link
              to="/"
              className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-foreground/70 hover:text-white transition-colors uppercase tracking-wider px-2 py-1 border border-ink-border hover:bg-white/5"
              title="Return to VINORA homepage"
            >
              <span>Main Site</span>
              <ArrowUpRight className="size-3" />
            </Link>

            {/* User Avatar shortcut on header (useful on mobile/tablet) */}
            {profile && (
              <button
                type="button"
                onClick={() => onSelectNav?.("Profile")}
                title="Account Settings"
                className="flex items-center gap-2 border border-ink-border bg-white/10 p-1 hover:bg-white/20 transition-colors cursor-pointer"
              >
                <div className="size-7 flex items-center justify-center font-display text-xs font-bold text-white bg-black">
                  {userInitial}
                </div>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ======================================================== */}
      {/* 2. MAIN WORKSPACE: SIDEBAR + ACTIVE CONTENT AREA          */}
      {/* ======================================================== */}
      <div className="flex-1 flex min-h-[calc(100vh-4rem)]">
        {/* ====================================================== */}
        {/* 2A. DESKTOP COLLAPSIBLE SIDEBAR                        */}
        {/* ====================================================== */}
        <aside
          aria-label={`${portal} navigation`}
          className={`hidden lg:flex flex-col border-r border-ink-border bg-ink text-ink-foreground shrink-0 transition-all duration-300 ease-in-out select-none relative z-20 ${
            isCollapsed ? "w-20" : "w-64"
          }`}
        >
          <div
            className="noise-layer pointer-events-none absolute inset-0 opacity-20"
            aria-hidden
          />

          {/* Sidebar Top: Logo Lockup & Collapse Trigger */}
          <div className="p-4 border-b border-ink-border/80 flex items-center justify-between relative z-10">
            {!isCollapsed ? (
              <>
                <Link
                  to="/"
                  className="flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                  <LogoLockup />
                </Link>
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Collapse sidebar"
                  title="Collapse sidebar to icon view"
                  className="p-1.5 font-mono text-[10px] text-ink-foreground/70 hover:text-white border border-ink-border hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expand sidebar"
                title="Expand sidebar navigation"
                className="w-full flex items-center justify-center p-2 text-ink-foreground/70 hover:text-white border border-ink-border hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>

          {/* Sidebar User Identity Profile Card (Requirement 2) */}
          <div className="p-3 border-b border-ink-border/80 bg-white/[0.02] relative z-10">
            {profile ? (
              <div
                onClick={() => onSelectNav?.("Profile")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onSelectNav?.("Profile");
                  }
                }}
                title={
                  isCollapsed
                    ? `${userName} (${roleName}) — View Profile`
                    : "Manage Profile Settings"
                }
                className={`group flex items-center gap-3 p-2 transition-colors cursor-pointer border border-transparent hover:border-ink-border hover:bg-white/5 ${
                  isCollapsed ? "justify-center" : ""
                }`}
              >
                <div className="relative shrink-0">
                  <div className="size-9 border border-white/20 bg-white/10 flex items-center justify-center font-display text-xs font-bold text-white group-hover:border-white transition-colors">
                    {userInitial}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-400 ring-2 ring-black" />
                </div>

                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-white truncate group-hover:underline">
                        {userName}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.2 bg-white/10 text-white/80 border border-white/15">
                        {roleName}
                      </span>
                    </div>
                    <span className="block text-[10px] font-mono text-ink-foreground/60 truncate mt-0.5">
                      {userSub}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className={isCollapsed ? "text-center py-2" : "p-2"}>
                <Link
                  to="/login"
                  className="font-mono text-[11px] text-white underline hover:text-white/80"
                >
                  {!isCollapsed ? "Sign in to account" : "Sign in"}
                </Link>
              </div>
            )}
          </div>

          {/* Sidebar Nav Items List */}
          <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1 relative z-10">
            {nav.map((item, index) => {
              const active = item.label === activeLabel;
              const IconComponent = getSectionIcon(item.label);
              const itemNumber = String(index + 1).padStart(2, "0");

              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNavClick(item.label)}
                  title={isCollapsed ? `${item.label} — ${item.description}` : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`w-full text-left rounded-none transition-all duration-150 cursor-pointer flex items-center relative group ${
                    isCollapsed ? "justify-center p-3" : "px-3 py-2.5 gap-3"
                  } ${
                    active
                      ? "bg-white text-black font-semibold shadow-md"
                      : "text-ink-foreground/75 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {/* Active highlight marker */}
                  {active && !isCollapsed && (
                    <span className="absolute left-0 top-0 bottom-0 w-1 bg-black" />
                  )}

                  {/* Icon */}
                  <IconComponent
                    className={`size-4 shrink-0 transition-transform group-hover:scale-105 ${
                      active ? "text-black" : "text-ink-foreground/70 group-hover:text-white"
                    }`}
                  />

                  {!isCollapsed && (
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 truncate">
                          <span
                            className={`font-mono text-[10px] ${
                              active ? "text-black/60 font-normal" : "text-ink-foreground/40"
                            }`}
                          >
                            {itemNumber}
                          </span>
                          <span className="text-xs tracking-tight truncate font-sans">
                            {item.label}
                          </span>
                        </div>
                        {item.badge !== undefined && Number(item.badge) > 0 && (
                          <span
                            className={`inline-flex items-center justify-center px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                              active ? "bg-black text-white" : "bg-white text-black"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <span
                        className={`block text-[10px] truncate leading-tight mt-0.5 ${
                          active ? "text-black/75" : "text-ink-foreground/60"
                        }`}
                      >
                        {item.description}
                      </span>
                    </div>
                  )}

                  {/* Badge dot when collapsed */}
                  {isCollapsed && item.badge !== undefined && Number(item.badge) > 0 && (
                    <span className="absolute top-2 right-2 size-2 rounded-full bg-emerald-400 ring-2 ring-black" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Bottom: Logout & Platform Info (Requirement 2) */}
          <div className="p-3 border-t border-ink-border/80 bg-ink relative z-10 space-y-2">
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign out of active session"
              className={`w-full flex items-center transition-colors cursor-pointer border border-ink-border hover:bg-white/10 hover:text-white text-ink-foreground/70 ${
                isCollapsed ? "justify-center p-2.5" : "px-3 py-2 gap-2 text-xs font-mono"
              }`}
            >
              <LogOut className="size-3.5 shrink-0" />
              {!isCollapsed && <span>Logout</span>}
            </button>

            {!isCollapsed ? (
              <div className="px-1 pt-1 font-mono text-[9px] text-ink-foreground/60">
                <div className="flex items-center gap-1.5 text-white font-semibold">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>VINORA PLATFORM</span>
                </div>
                <p className="tracking-widest uppercase opacity-75 text-[8px] mt-0.5">
                  IDEAS TODAY. IMPACT TOMORROW.
                </p>
              </div>
            ) : (
              <div className="flex justify-center" title="VINORA Architecture Platform">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            )}
          </div>
        </aside>

        {/* ====================================================== */}
        {/* 2B. MOBILE SLIDE-IN SIDEBAR DRAWER                     */}
        {/* ====================================================== */}
        {isMobileOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${portal} Mobile Navigation`}
            className="fixed inset-0 z-50 lg:hidden flex animate-in fade-in duration-200"
          >
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsMobileOpen(false)}
            />

            {/* Slide-out Drawer Panel */}
            <div className="relative w-4/5 max-w-xs bg-ink text-ink-foreground border-r border-ink-border h-full flex flex-col z-10 animate-in slide-in-from-left duration-300 shadow-2xl">
              <div
                className="noise-layer pointer-events-none absolute inset-0 opacity-20"
                aria-hidden
              />

              {/* Drawer Header: Logo Lockup + Close button */}
              <div className="p-4 border-b border-ink-border flex items-center justify-between relative z-10">
                <div>
                  <LogoLockup />
                  <span className="block mt-1 font-mono text-[10px] uppercase text-ink-foreground/60 tracking-wider">
                    {portal}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileOpen(false)}
                  aria-label="Close navigation"
                  className="p-1.5 text-ink-foreground/70 hover:text-white border border-ink-border cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Drawer User Card */}
              {profile && (
                <div
                  onClick={() => {
                    handleNavClick("Profile");
                  }}
                  className="p-3 border-b border-ink-border/80 bg-white/5 flex items-center gap-3 cursor-pointer relative z-10"
                >
                  <div className="size-8 border border-white/20 bg-white/10 flex items-center justify-center font-display text-xs font-bold text-white">
                    {userInitial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-white truncate">
                      {userName}
                    </span>
                    <span className="block text-[10px] font-mono text-ink-foreground/60 truncate">
                      {roleName} · {userSub}
                    </span>
                  </div>
                </div>
              )}

              {/* Drawer Navigation List */}
              <nav className="flex-1 overflow-y-auto p-3 space-y-1 relative z-10">
                {nav.map((item, index) => {
                  const active = item.label === activeLabel;
                  const IconComponent = getSectionIcon(item.label);
                  const itemNumber = String(index + 1).padStart(2, "0");

                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleNavClick(item.label)}
                      className={`w-full text-left p-2.5 flex items-center gap-3 transition-colors cursor-pointer border ${
                        active
                          ? "border-white bg-white text-black font-semibold"
                          : "border-ink-border bg-white/5 text-ink-foreground/80 hover:text-white hover:bg-white/10"
                      }`}
                    >
                      <IconComponent
                        className={`size-4 shrink-0 ${active ? "text-black" : "text-ink-foreground/70"}`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className={`font-mono text-[10px] ${
                                active ? "text-black/60 font-normal" : "text-ink-foreground/50"
                              }`}
                            >
                              {itemNumber}
                            </span>
                            <span className="text-xs font-sans tracking-tight">{item.label}</span>
                          </div>
                          {item.badge !== undefined && Number(item.badge) > 0 && (
                            <span
                              className={`px-1.5 py-0.2 font-mono text-[10px] font-bold ${
                                active ? "bg-black text-white" : "bg-white text-black"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <span
                          className={`block text-[10px] truncate mt-0.5 ${
                            active ? "text-black/75" : "text-ink-foreground/60"
                          }`}
                        >
                          {item.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </nav>

              {/* Drawer Footer: Logout */}
              <div className="p-3 border-t border-ink-border bg-ink relative z-10">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="w-full rounded-none font-mono text-xs justify-center cursor-pointer border-ink-border bg-transparent text-ink-foreground hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="size-3.5 mr-2" />
                  Logout of {portal}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================== */}
        {/* 2C. MAIN CONTENT AREA                                  */}
        {/* ====================================================== */}
        <main className="flex-1 min-w-0 bg-background overflow-y-auto">
          {/* Executive VINORA Masthead */}
          <section className="relative overflow-hidden bg-ink text-ink-foreground border-b border-ink-border px-5 py-8 sm:px-8 sm:py-10">
            <div
              className="noise-layer pointer-events-none absolute inset-0 opacity-20"
              aria-hidden
            />
            <div
              className="hero-grid pointer-events-none absolute inset-0 opacity-30"
              aria-hidden
            />

            <div className="relative z-10 max-w-7xl mx-auto flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div className="space-y-3 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow inline-flex items-center gap-2 border border-ink-border px-2.5 py-1 text-ink-foreground/80 font-mono text-[10px]">
                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {portal.toUpperCase()} · SECTION {activeNumber}
                  </span>
                  <span className="border border-ink-border bg-white/5 px-2 py-0.5 font-mono text-[10px] text-ink-foreground/70 uppercase">
                    {activeLabel}
                  </span>
                </div>

                <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-white leading-[1.08]">
                  {title}
                </h1>

                <p className="text-xs sm:text-sm text-ink-foreground/80 leading-relaxed font-sans max-w-2xl">
                  {intro}
                </p>
              </div>

              {/* Operational System Badge */}
              <div className="flex flex-wrap items-center gap-2.5 md:self-end">
                <div className="border border-ink-border bg-white/5 px-3 py-2 text-right hidden sm:block">
                  <p className="font-mono text-[10px] uppercase text-ink-foreground/60 tracking-wider">
                    OPERATIONAL SYSTEM
                  </p>
                  <p className="font-mono text-xs font-semibold text-white tracking-wide">
                    CONNECTED
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section Body */}
          <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-10 space-y-8 animate-in fade-in duration-200">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
