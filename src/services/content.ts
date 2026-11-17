import { requireBackend } from "./backend";
import type { CaseStudy, Resource, VinoraUpdate } from "@/lib/types";

/** Public case studies, managed by admins. Backend pending. */
export async function listCaseStudies(): Promise<CaseStudy[]> {
  return requireBackend("Loading case studies");
}

/** Public resources library, managed by admins. Backend pending. */
export async function listResources(): Promise<Resource[]> {
  return requireBackend("Loading resources");
}

/** VINORA Updates visible to the signed-in client. Backend pending. */
export async function listVinoraUpdates(): Promise<VinoraUpdate[]> {
  return requireBackend("Loading VINORA Updates");
}
