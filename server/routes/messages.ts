import { jsonSuccess, jsonError } from "../utils/response";
import { authenticateRequest } from "../middleware/auth";

export async function handleMessagesRoute(request: Request, subpath: string): Promise<Response> {
  const user = await authenticateRequest(request);
  if (!user) {
    return jsonError("Authentication required for messages", 401, "UNAUTHORIZED");
  }

  return jsonSuccess({
    endpoint: `/api/messages${subpath}`,
    status: "foundation_ready",
    userRole: user.role,
    message: "Real-time messages API foundation established.",
  });
}
