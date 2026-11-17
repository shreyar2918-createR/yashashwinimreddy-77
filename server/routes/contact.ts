import { jsonSuccess } from "../utils/response";

export async function handleContactRoute(request: Request, subpath: string): Promise<Response> {
  return jsonSuccess({
    endpoint: `/api/contact${subpath}`,
    status: "foundation_ready",
    message: "Contact enquiries API route foundation established.",
  });
}
