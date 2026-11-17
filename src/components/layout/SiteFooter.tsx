import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Instagram, Linkedin, Mail } from "lucide-react";

import { LogoLockup } from "@/components/brand/Logo";
import { BRAND, CONTACT_DETAILS, NAV_LINKS } from "@/content/site";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink text-ink-foreground border-t border-ink-border">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))]">
          <div className="min-w-0">
            <LogoLockup markClassName="size-11" showTagline />
            <p className="mt-6 max-w-sm text-sm leading-relaxed text-ink-muted">
              {BRAND.positioning}
            </p>
            <div className="mt-8">
              <Link
                to="/start-project"
                className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase underline underline-offset-4 text-ink-foreground hover:opacity-80"
              >
                <span>Start Your Project</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <nav aria-label="Footer">
            <h2 className="eyebrow text-ink-muted">Navigation</h2>
            <ul className="mt-5 space-y-3">
              {NAV_LINKS.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-sm text-ink-foreground/80 transition-colors hover:text-ink-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="eyebrow text-ink-muted">Contact</h2>
            <ul className="mt-5 space-y-3.5 text-sm text-ink-foreground/80">
              <li>
                <a
                  className="inline-flex items-center gap-2.5 transition-colors hover:text-ink-foreground"
                  href={`mailto:${CONTACT_DETAILS.email}`}
                >
                  <Mail className="size-4 shrink-0 text-ink-muted" />
                  <span>{CONTACT_DETAILS.email}</span>
                </a>
              </li>
              <li>
                <a
                  className="inline-flex items-center gap-2.5 transition-colors hover:text-ink-foreground"
                  href="https://www.linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Linkedin className="size-4 shrink-0 text-ink-muted" />
                  <span>LinkedIn: VINORA</span>
                </a>
              </li>
              <li>
                <a
                  className="inline-flex items-center gap-2.5 transition-colors hover:text-ink-foreground"
                  href="https://www.instagram.com/vinora.tech"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Instagram className="size-4 shrink-0 text-ink-muted" />
                  <span>Instagram: @vinora.tech</span>
                </a>
              </li>
            </ul>

            <div className="mt-8 border-t border-ink-border pt-5 flex flex-col gap-2.5">
              <span className="eyebrow text-xs text-ink-muted">Access Portals</span>
              <div className="flex items-center gap-4 text-xs font-medium">
                <Link
                  to="/login"
                  search={{ role: "client" }}
                  className="underline underline-offset-4 text-ink-foreground/80 hover:text-ink-foreground"
                >
                  Client Login
                </Link>
                <span className="text-ink-border">|</span>
                <Link
                  to="/login"
                  search={{ role: "admin" }}
                  className="underline underline-offset-4 text-ink-foreground/80 hover:text-ink-foreground"
                >
                  Admin Login
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-ink-border pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} VINORA. All rights reserved.</p>
          <p className="tracking-[0.18em] uppercase">Ideas today. Impact tomorrow.</p>
        </div>
      </div>
    </footer>
  );
}
