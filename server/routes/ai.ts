import { jsonSuccess, jsonError } from "../utils/response";
import { processAiChatMessage, type ChatMessage } from "../services/aiChat";

export async function handleAiRoute(request: Request, subpath: string): Promise<Response> {
  const method = request.method;

  // 1. Health check: GET /api/ai/health
  if (subpath === "/health" || subpath === "/health/") {
    const hasKey = Boolean(process.env.GEMINI_API_KEY?.trim());
    return jsonSuccess({
      status: "operational",
      provider: hasKey ? "gemini-3.8-flash" : "knowledge-engine",
      hasKey,
      timestamp: new Date().toISOString(),
    });
  }

  // 2. Chat endpoint: POST /api/ai/chat
  if (subpath === "/chat" || subpath === "/chat/" || subpath === "" || subpath === "/") {
    if (method !== "POST") {
      return jsonError("Method Not Allowed. Use POST.", 405, "METHOD_NOT_ALLOWED");
    }

    try {
      const body = (await request.json()) as {
        message?: string;
        history?: ChatMessage[];
      };

      const userMessage = body.message?.trim();
      if (!userMessage) {
        return jsonError("Message content cannot be empty.", 400, "EMPTY_MESSAGE");
      }

      const history = Array.isArray(body.history) ? body.history : [];

      const result = await processAiChatMessage(userMessage, history);
      return jsonSuccess(result, 200);
    } catch (err: unknown) {
      console.error("[AI Route Error]:", err);
      // Graceful fallback response so the user UI never breaks
      return jsonSuccess(
        {
          reply:
            "I apologize, but our assistant is temporarily recalibrating. For immediate assistance with scoping or questions, please contact our team at contact@vinora.com or visit /contact.",
          provider: "fallback",
          suggestions: [
            "What services do you offer?",
            "I want to start a project",
            "Contact VINORA",
          ],
        },
        200,
      );
    }
  }

  return jsonError(`AI Endpoint /api/ai${subpath} not found.`, 404, "NOT_FOUND");
}
