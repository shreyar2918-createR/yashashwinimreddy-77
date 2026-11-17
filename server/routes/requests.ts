import { jsonSuccess, jsonError } from "../utils/response";
import { authenticateRequest } from "../middleware/auth";

export async function handleRequestsRoute(request: Request, subpath: string): Promise<Response> {
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonError("Authentication required for client requests", 401, "UNAUTHORIZED");
  }

  return jsonSuccess({
    endpoint: `/api/requests${subpath}`,
    status: "foundation_ready",
    userRole: user.role,
    message: "Client change requests API foundation established.",
  });
}
