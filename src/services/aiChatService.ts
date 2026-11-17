export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  suggestions?: string[];
}

export interface ChatApiResult {
  reply: string;
  suggestions?: string[];
  provider?: string;
}

/**
 * Sends a message to the VINORA AI Assistant API endpoint
 */
export async function sendChatMessage(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
): Promise<ChatApiResult> {
  const clean = message.trim();
  if (!clean) {
    throw new Error("Message cannot be empty.");
  }

  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: clean,
        history,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.data?.reply) {
      return {
        reply: data.data.reply,
        suggestions: data.data.suggestions || [],
        provider: data.data.provider,
      };
    }

    if (data.data?.reply) {
      return {
        reply: data.data.reply,
        suggestions: data.data.suggestions || [],
      };
    }

    throw new Error(data.error?.message || "Failed to receive AI response.");
  } catch (err: unknown) {
    console.warn("AI Chat dispatch error:", err);
    return {
      reply:
        "Our AI assistant is temporarily offline. You can reach our architecture team directly through our [Contact Page](/contact) or by submitting a new inquiry via [Start Project](/start-project).",
      suggestions: ["What services do you offer?", "I want to start a project", "Contact VINORA"],
      provider: "client-fallback",
    };
  }
}
