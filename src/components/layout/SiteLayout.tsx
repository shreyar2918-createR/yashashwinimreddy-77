import type { ReactNode } from "react";

import { CustomCursor } from "@/components/experience/CustomCursor";
import { IntroCurtain } from "@/components/experience/IntroCurtain";
import { PageTransition } from "@/components/experience/PageTransition";
import { ScrollProgress } from "@/components/experience/ScrollProgress";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <IntroCurtain />
      <ScrollProgress />
      <CustomCursor />
      <SiteHeader />
      <main id="main" className="flex-1">
        <PageTransition>{children}</PageTransition>
      </main>
      <SiteFooter />
    </div>
  );
}
