import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/signup")({
  validateSearch: (search: Record<string, unknown>): { ref?: string } => ({
    ref: typeof search.ref === "string" ? search.ref : undefined,
  }),
  beforeLoad: ({ search }) => {
    // If ref is present in query, save to storage before redirecting
    if (typeof window !== "undefined" && search.ref) {
      try {
        const cleanRef = search.ref.trim().toUpperCase();
        sessionStorage.setItem("vinora_referral_code", cleanRef);
        localStorage.setItem("vinora_referral_code", cleanRef);
      } catch {
        // Safe fallback
      }
    }
    throw redirect({
      to: "/login",
      search: {
        role: "client",
        mode: "register",
        ...(search.ref ? { ref: search.ref } : {}),
      },
    });
  },
  component: () => null,
});
