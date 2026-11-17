import { jsonSuccess, jsonError } from "../utils/response";
import { requireAdminAuth } from "../middleware/auth";

export async function handleAdminRoute(request: Request, subpath: string): Promise<Response> {
  const admin = await requireAdminAuth(request);
  if (!admin) {
    return jsonError("Admin privileges required", 403, "FORBIDDEN");
  }

  return jsonSuccess({
    endpoint: `/api/admin${subpath}`,
    status: "foundation_ready",
    adminUid: admin.uid,
    message: "Admin API route foundation established.",
  });
}
