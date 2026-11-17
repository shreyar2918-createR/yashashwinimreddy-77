import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Fast fade + mask reveal on route change. Keyed by pathname so each page
 * enters cleanly without blocking navigation.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(false);
    const id = window.setTimeout(() => setShown(true), 20);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return (
    <div
      className={`transition-[opacity,transform,filter] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        shown ? "translate-y-0 opacity-100 blur-0" : "translate-y-2 opacity-0 blur-[2px]"
      }`}
    >
      {children}
    </div>
  );
}
