import { useState, useEffect, useRef } from "react";
import {
  Send,
  Check,
  CheckCheck,
  MessageSquare,
  ShieldCheck,
  Loader2,
  RefreshCw,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  subscribeToClientConversation,
  subscribeToMessages,
  sendClientMessage,
  markConversationAsRead,
} from "@/services/messaging";
import type { Conversation, ConversationMessage, UserProfile } from "@/lib/types";

interface WhatsAppClientChatProps {
  profile: UserProfile;
}

export function WhatsAppClientChat({ profile }: WhatsAppClientChatProps) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Subscribe to client's conversation document
  useEffect(() => {
    if (!profile.id) return;
    setIsLoading(true);

    const unsubConv = subscribeToClientConversation(
      profile.id,
      (conv) => {
        setConversation(conv);
        setIsLoading(false);
      },
      (err) => {
        console.error("Error subscribing to conversation:", err);
        setError("Unable to connect to live message channel.");
        setIsLoading(false);
      },
    );

    return () => unsubConv();
  }, [profile.id]);

  // 2. Subscribe to messages subcollection
  useEffect(() => {
    if (!profile.id) return;

    const unsubMsg = subscribeToMessages(
      profile.id,
      (msgs) => {
        setMessages(msgs);
        setTimeout(() => scrollToBottom("auto"), 50);

        // Mark incoming admin messages as read
        if (msgs.some((m) => m.recipientRole === "client" && !m.read)) {
          markConversationAsRead(profile.id, "client");
        }
      },
      (err) => {
        console.error("Error subscribing to messages:", err);
      },
    );

    return () => unsubMsg();
  }, [profile.id]);

  // 3. Mark as read when focusing window/tab
  useEffect(() => {
    if (profile.id && conversation && conversation.unreadCountClient > 0) {
      markConversationAsRead(profile.id, "client");
    }
  }, [profile.id, conversation]);

  // Handle message sending
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      await sendClientMessage({
        clientId: profile.id,
        clientName: profile.fullName || profile.email?.split("@")[0] || "Client",
        clientEmail: profile.email || "",
        text,
      });
      setInputText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      setTimeout(() => scrollToBottom("smooth"), 100);
    } catch (err: unknown) {
      console.error("Failed to send message:", err);
      setError(err instanceof Error ? err.message : "Failed to deliver message. Please retry.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const sendQuickPrompt = (promptText: string) => {
    setInputText(promptText);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Group messages by day
  const formatTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return "";
    }
  };

  const formatDateDivider = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      const today = new Date();
      if (d.toDateString() === today.toDateString()) return "Today";
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex flex-col border border-border bg-card shadow-sm h-[680px] max-h-[85vh] rounded-none overflow-hidden">
      {/* WhatsApp-Style Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="size-10 rounded-full border border-border bg-foreground text-background flex items-center justify-center font-display font-bold text-sm tracking-widest shadow-sm">
              V
            </div>
            <span
              className="absolute bottom-0 right-0 size-3 rounded-full bg-emerald-500 ring-2 ring-background"
              title="Direct Studio Channel Active"
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-semibold tracking-tight text-foreground">
                VINORA Architecture & Delivery Team
              </h3>
              <ShieldCheck className="size-3.5 text-foreground" title="Verified Studio Channel" />
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Direct Client Thread</span>
              <span className="text-muted-foreground/40">•</span>
              <span className="text-[11px] font-mono">Typically responds in &lt; 15m</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversation && conversation.unreadCountClient > 0 && (
            <span className="px-2 py-0.5 font-mono text-[11px] font-bold bg-foreground text-background">
              {conversation.unreadCountClient} unread
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => scrollToBottom("smooth")}
            className="rounded-none cursor-pointer text-xs h-8 px-2.5 text-muted-foreground hover:text-foreground"
            title="Scroll to latest"
          >
            <Clock className="size-3.5 mr-1" />
            Live
          </Button>
        </div>
      </div>

      {/* Error notification banner */}
      {error && (
        <div className="flex items-center justify-between border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="font-mono text-xs hover:underline cursor-pointer ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Messages Stream Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-background/50">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
              Connecting to secure thread...
            </p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto text-center py-10 space-y-4">
            <div className="size-12 rounded-full border border-border bg-surface flex items-center justify-center">
              <MessageSquare className="size-6 text-muted-foreground" />
            </div>
            <div>
              <h4 className="font-display text-base font-semibold text-foreground">
                Direct Communication with VINORA
              </h4>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                Send technical specifications, ask project delivery questions, or request milestone
                reviews. All messages are encrypted and audited by your dedicated lead architect.
              </p>
            </div>

            {/* Quick Prompt Suggestions */}
            <div className="w-full pt-2">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-2">
                Suggested Prompts
              </p>
              <div className="flex flex-col gap-2">
                {[
                  "Could you provide an update on our current project milestone?",
                  "We have updated design feedback for the architecture review.",
                  "Can we schedule a 15-minute technical sync this week?",
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => sendQuickPrompt(prompt)}
                    className="text-left text-xs p-2.5 border border-border bg-surface hover:bg-surface/80 hover:border-foreground/30 transition-all flex items-center gap-2 cursor-pointer group"
                  >
                    <Sparkles className="size-3 text-muted-foreground group-hover:text-foreground shrink-0" />
                    <span className="truncate">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, index) => {
              const isClient = msg.senderRole === "client" || msg.senderUid === profile.id;
              const prevMsg = messages[index - 1];
              const showDateDivider =
                !prevMsg ||
                formatDateDivider(prevMsg.createdAt) !== formatDateDivider(msg.createdAt);

              return (
                <div key={msg.id} className="space-y-3">
                  {showDateDivider && (
                    <div className="flex items-center justify-center my-4">
                      <span className="border border-border bg-surface px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground shadow-xs">
                        {formatDateDivider(msg.createdAt)}
                      </span>
                    </div>
                  )}

                  <div className={`flex flex-col ${isClient ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-none p-3.5 shadow-sm space-y-1.5 ${
                        isClient
                          ? "bg-foreground text-background border border-foreground"
                          : "bg-surface text-foreground border border-border"
                      }`}
                    >
                      {/* Sender label */}
                      <div className="flex items-center justify-between gap-3 text-[10px] font-mono opacity-70">
                        <span className="font-semibold uppercase tracking-wider">
                          {isClient ? "You" : msg.senderName || "VINORA Team"}
                        </span>
                        {!isClient && (
                          <span className="border border-border px-1 py-0.2 bg-background/50 text-[9px]">
                            VINORA LEAD
                          </span>
                        )}
                      </div>

                      {/* Message body */}
                      <p className="text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed break-words">
                        {msg.text}
                      </p>

                      {/* Footer: timestamp & read tick */}
                      <div
                        className={`flex items-center justify-end gap-1.5 pt-1 text-[10px] font-mono ${
                          isClient ? "text-background/70" : "text-muted-foreground"
                        }`}
                      >
                        <span>{formatTime(msg.createdAt)}</span>
                        {isClient && (
                          <span>
                            {msg.read ? (
                              <CheckCheck
                                className="size-3.5 text-emerald-400 inline"
                                title="Read by VINORA team"
                              />
                            ) : (
                              <Check
                                className="size-3.5 text-background/60 inline"
                                title="Delivered to VINORA studio"
                              />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Composer */}
      <div className="border-t border-border bg-surface p-3 sm:p-4">
        {/* Quick chip suggestions if message list isn't empty */}
        {messages.length > 0 && (
          <div className="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar text-xs">
            <button
              type="button"
              onClick={() => sendQuickPrompt("Requesting an update on current milestone.")}
              className="px-2 py-0.5 border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 whitespace-nowrap cursor-pointer transition-colors"
            >
              Milestone update?
            </button>
            <button
              type="button"
              onClick={() => sendQuickPrompt("Can we schedule a 15-minute architecture call?")}
              className="px-2 py-0.5 border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 whitespace-nowrap cursor-pointer transition-colors"
            >
              Schedule sync
            </button>
            <button
              type="button"
              onClick={() => sendQuickPrompt("Uploaded new documents in the Files portal.")}
              className="px-2 py-0.5 border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 whitespace-nowrap cursor-pointer transition-colors"
            >
              New files ready
            </button>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-end gap-2">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a message to VINORA team... (Press Enter to send)"
              rows={1}
              className="w-full resize-none border border-border bg-background px-3.5 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-hidden leading-relaxed max-h-[120px]"
            />
          </div>

          <Button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="rounded-none h-[42px] px-4 cursor-pointer bg-foreground text-background hover:bg-foreground/90 shrink-0"
          >
            {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            <span className="hidden sm:inline ml-1.5 text-xs font-mono">Send</span>
          </Button>
        </form>

        <p className="mt-1.5 text-[10px] font-mono text-muted-foreground/70 hidden sm:block">
          Press <kbd className="border border-border px-1">Enter</kbd> to send,{" "}
          <kbd className="border border-border px-1">Shift + Enter</kbd> for new line. End-to-end
          audited.
        </p>
      </div>
    </div>
  );
}
