import { Link, useRouterState } from "@tanstack/react-router";
import { ArrowRight, User, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LogoLockup } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MENU_LINKS = [
  { label: "Home", to: "/" },
  { label: "About", to: "/about" },
  { label: "Services", to: "/#services" },
  { label: "Our Work", to: "/projects" },
  { label: "Contact", to: "/contact" },
] as const;

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Routes whose first screen is the dark cinematic hero.
  const overDark = !scrolled && pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll when hamburger menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Close menu on click outside and escape
  useEffect(() => {
    if (!menuOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-[background-color,backdrop-filter,border-color] duration-500",
          scrolled
            ? "border-b border-border/60 bg-background/85 backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
          overDark && "text-ink-foreground",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          {/* Left: VINORA Logo */}
          <Link to="/" className="min-w-0 shrink-0" aria-label="VINORA home">
            <LogoLockup
              markClassName="size-8"
              className={cn("transition-colors", overDark ? "text-white" : "text-foreground")}
            />
          </Link>

          {/* Middle: Clean horizontal navigation links on desktop */}
          <nav className="hidden items-center gap-7 md:flex" aria-label="Main Navigation">
            {MENU_LINKS.map((link) => {
              const isServices = link.to === "/#services";
              if (isServices && pathname === "/") {
                return (
                  <a
                    key={link.to}
                    href="#services"
                    onClick={(e) => {
                      e.preventDefault();
                      const el = document.getElementById("services");
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth" });
                      }
                    }}
                    className={cn(
                      "text-sm font-medium transition-colors cursor-pointer",
                      overDark
                        ? "text-white/85 hover:text-white"
                        : "text-foreground/80 hover:text-foreground",
                    )}
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    overDark
                      ? "text-white/85 hover:text-white"
                      : "text-foreground/80 hover:text-foreground",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: Client Login + Three-line Hamburger menu */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            {/* Client Login Action (always clearly visible in header) */}
            <Link
              to="/login"
              search={{ role: "client" }}
              className={cn(
                "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-xs sm:text-sm font-medium transition-all shadow-xs hover:-translate-y-0.5 active:translate-y-0 cursor-pointer touch-manipulation",
                overDark
                  ? "bg-white text-black hover:bg-neutral-200"
                  : "bg-primary text-primary-foreground hover:bg-primary/90",
              )}
            >
              <User className="size-3.5 sm:size-4" />
              <span>Client Login</span>
            </Link>

            {/* Three-line Hamburger Menu Button (visible on desktop, tablet, and mobile) */}
            <button
              type="button"
              id="header-hamburger-menu-button"
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label={menuOpen ? "Close menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              aria-controls="vinora-fullscreen-menu"
              className={cn(
                "relative flex size-10 flex-col items-center justify-center gap-1.5 rounded-md border transition-all cursor-pointer touch-manipulation select-none",
                overDark
                  ? "border-white/30 bg-black/40 text-white backdrop-blur-xs hover:border-white/60 hover:bg-white/10"
                  : "border-border bg-card text-foreground hover:bg-muted shadow-xs",
                menuOpen &&
                  (overDark ? "bg-white/20 border-white/60" : "bg-muted ring-1 ring-foreground/20"),
              )}
            >
              <span
                className={cn(
                  "block h-[1.5px] w-5 bg-current transition-all duration-300",
                  menuOpen && "translate-y-[7.5px] rotate-45",
                )}
              />
              <span
                className={cn(
                  "block h-[1.5px] w-5 bg-current transition-all duration-300",
                  menuOpen && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "block h-[1.5px] w-5 bg-current transition-all duration-300",
                  menuOpen && "-translate-y-[7.5px] -rotate-45",
                )}
              />
            </button>
          </div>
        </div>
      </header>

      {/* Hamburger Navigation Menu Overlay & Drawer */}
      {menuOpen && (
        <div
          id="vinora-fullscreen-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="fixed inset-0 z-[100] flex justify-end"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-ink/75 backdrop-blur-md transition-opacity duration-300 cursor-pointer"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            ref={menuRef}
            className="relative flex h-full w-full max-w-sm sm:max-w-md flex-col justify-between overflow-y-auto border-l border-ink-border bg-ink p-6 sm:p-8 text-ink-foreground shadow-2xl transition-transform duration-300"
          >
            <div>
              {/* Drawer header */}
              <div className="flex items-center justify-between border-b border-ink-border pb-5">
                <Link to="/" onClick={() => setMenuOpen(false)} aria-label="VINORA home">
                  <LogoLockup markClassName="size-8" />
                </Link>
                <button
                  type="button"
                  id="menu-close-button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                  className="flex size-9 items-center justify-center rounded-md border border-ink-border text-ink-foreground/80 hover:bg-ink-foreground/10 hover:text-ink-foreground transition-colors cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Six Navigation Items in Exact Order */}
              <nav className="mt-6 flex flex-col space-y-1" aria-label="Menu Navigation">
                {[
                  { id: "01", label: "Home", to: "/", type: "home" },
                  { id: "02", label: "About", to: "/about", type: "route" },
                  { id: "03", label: "Services", to: "/#services", type: "services" },
                  { id: "04", label: "Our Work", to: "/projects", type: "route" },
                  { id: "05", label: "Contact", to: "/contact", type: "route" },
                  {
                    id: "06",
                    label: "Admin Login",
                    to: "/login",
                    search: { role: "admin" },
                    type: "admin",
                  },
                ].map((item) => {
                  const isServices = item.type === "services";
                  const isHome = item.type === "home";
                  const isAdmin = item.type === "admin";

                  const innerContent = (
                    <span className="flex items-baseline gap-3.5">
                      <span className="text-xs font-mono tracking-widest text-ink-muted">
                        {item.id}
                      </span>
                      <span
                        className={cn(
                          "transition-colors",
                          isAdmin
                            ? "text-white font-medium"
                            : "text-ink-foreground/90 group-hover:text-ink-foreground",
                        )}
                      >
                        {item.label}
                      </span>
                    </span>
                  );

                  if (isServices && pathname === "/") {
                    return (
                      <a
                        key={item.label}
                        href="#services"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuOpen(false);
                          setTimeout(() => {
                            const el = document.getElementById("services");
                            if (el) el.scrollIntoView({ behavior: "smooth" });
                          }, 150);
                        }}
                        className="group flex items-center justify-between py-3.5 text-base sm:text-lg font-display tracking-tight text-ink-foreground/85 transition-colors hover:text-ink-foreground hover:translate-x-1 cursor-pointer touch-manipulation"
                      >
                        {innerContent}
                        <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100 text-ink-foreground" />
                      </a>
                    );
                  }

                  if (isHome && pathname === "/") {
                    return (
                      <a
                        key={item.label}
                        href="/"
                        onClick={(e) => {
                          e.preventDefault();
                          setMenuOpen(false);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="group flex items-center justify-between py-3.5 text-base sm:text-lg font-display tracking-tight text-ink-foreground/85 transition-colors hover:text-ink-foreground hover:translate-x-1 cursor-pointer touch-manipulation"
                      >
                        {innerContent}
                        <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100 text-ink-foreground" />
                      </a>
                    );
                  }

                  if (isAdmin) {
                    return (
                      <Link
                        key={item.label}
                        to="/login"
                        search={{ role: "admin" }}
                        id="nav-admin-login-item"
                        onClick={() => setMenuOpen(false)}
                        className="group flex items-center justify-between py-3.5 text-base sm:text-lg font-display tracking-tight text-white transition-colors hover:translate-x-1 touch-manipulation"
                      >
                        {innerContent}
                        <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100 text-white" />
                      </Link>
                    );
                  }

                  return (
                    <Link
                      key={item.label}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className="group flex items-center justify-between py-3.5 text-base sm:text-lg font-display tracking-tight text-ink-foreground/85 transition-colors hover:text-ink-foreground hover:translate-x-1 touch-manipulation"
                    >
                      {innerContent}
                      <ArrowRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100 text-ink-foreground" />
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Bottom drawer CTA */}
            <div className="mt-8 border-t border-ink-border pt-6">
              <Button asChild size="lg" className="cta-accent w-full rounded-none">
                <Link to="/start-project" onClick={() => setMenuOpen(false)}>
                  Start a Project
                </Link>
              </Button>
              <p className="mt-4 text-xs text-ink-muted text-center tracking-wider">
                vinora.techofficial@gmail.com
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
