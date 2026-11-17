import { jsonSuccess, jsonError } from "../utils/response";
import { authenticateRequest } from "../middleware/auth";

export async function handleDocumentsRoute(request: Request, subpath: string): Promise<Response> {
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonError("Authentication required for documents", 401, "UNAUTHORIZED");
  }

  return jsonSuccess({
    endpoint: `/api/documents${subpath}`,
    status: "foundation_ready",
    userRole: user.role,
    message: "Documents API foundation established.",
  });
}
