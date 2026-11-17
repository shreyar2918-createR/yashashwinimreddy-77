import { jsonSuccess, jsonError } from "../utils/response";
import { authenticateRequest } from "../middleware/auth";

export async function handleProposalsRoute(request: Request, subpath: string): Promise<Response> {
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonError("Authentication required for proposals", 401, "UNAUTHORIZED");
  }

  return jsonSuccess({
    endpoint: `/api/proposals${subpath}`,
    status: "foundation_ready",
    userRole: user.role,
    message: "Proposals API foundation established.",
  });
}
