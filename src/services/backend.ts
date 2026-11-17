/**
 * Service layer boundary.
 *
 * Every data operation in the app goes through `src/services/*`. No component
 * talks to a database directly. Today no backend is connected, so the service
 * functions throw `BackendNotConnectedError` and the UI renders an honest
 * "not connected yet" state instead of a fabricated success.
 *
 * When Lovable Cloud (Supabase) is enabled, only the bodies of these functions
 * change — component code, types and routes stay as they are. The same layer is
 * reusable by the future VINORA mobile application.
 */

export class BackendNotConnectedError extends Error {
  readonly capability: string;

  constructor(capability: string) {
    super(`${capability} requires the VINORA backend, which is not connected yet.`);
    this.name = "BackendNotConnectedError";
    this.capability = capability;
  }
}

export const BACKEND_CONNECTED = false;

export function requireBackend(capability: string): never {
  throw new BackendNotConnectedError(capability);
}
