import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
  ArrowRight,
  Maximize2,
  Minimize2,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  Layers,
  CreditCard,
  UserCheck,
  Mail,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { sendChatMessage, type ChatMessage } from "@/services/aiChatService";

export interface QuickActionItem {
  label: string;
  query: string;
  icon?: typeof Sparkles;
  category?: string;
}

const PRIMARY_QUICK_ACTIONS: QuickActionItem[] = [
  { label: "Start a Project", query: "Start a Project", icon: Sparkles },
  { label: "Our Services", query: "Our Services", icon: Layers },
  { label: "How It Works", query: "How It Works", icon: ArrowRight },
  { label: "Payment & Budget", query: "Payment & Budget", icon: CreditCard },
  { label: "Client Portal", query: "Client Portal", icon: UserCheck },
  { label: "Contact VINORA", query: "Contact VINORA", icon: Mail },
];

const INITIAL_SUGGESTIONS = [
  "Start a Project",
  "Our Services",
  "How It Works",
  "Payment & Budget",
  "Client Portal",
  "Contact VINORA",
];

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome-msg",
  role: "assistant",
  content:
    "Welcome to **VINORA**. I am the studio AI Assistant.\n\n" +
    "I can assist you with our engineering services, UI/UX design systems, development methodology, proposals, payment plans (full vs. milestone), project tracking, and Client Portal access.\n\n" +
    "Select a quick action below or ask any question to begin.",
  timestamp: new Date().toISOString(),
  suggestions: INITIAL_SUGGESTIONS,
};

/**
 * Parses markdown-like bold text, bullet points, and relative links into safe JSX
 */
function renderMessageContent(content: string) {
  const lines = content.split("\n");

  return (
    <div className="space-y-2 text-xs leading-relaxed break-words font-sans">
      {lines.map((line, lineIdx) => {
        if (!line.trim()) return <div key={lineIdx} className="h-1" />;

        // Check for bullet point
        const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");
        const cleanLine = isBullet ? line.trim().replace(/^[•-]\s*/, "") : line;

        // Parse inline [text](url) and **bold**
        const parts: (
          string | { type: "link"; text: string; url: string } | { type: "bold"; text: string }
        )[] = [];
        let cursor = 0;

        const combinedRegex = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*)/g;
        let match: RegExpExecArray | null;

        while ((match = combinedRegex.exec(cleanLine)) !== null) {
          if (match.index > cursor) {
            parts.push(cleanLine.substring(cursor, match.index));
          }

          if (match[2] && match[3]) {
            // It's a markdown link [text](url)
            parts.push({ type: "link", text: match[2], url: match[3] });
          } else if (match[4]) {
            // It's bold **text**
            parts.push({ type: "bold", text: match[4] });
          }

          cursor = match.index + match[0].length;
        }

        if (cursor < cleanLine.length) {
          parts.push(cleanLine.substring(cursor));
        }

        const renderedLine = parts.map((part, pIdx) => {
          if (typeof part === "string") {
            return <span key={pIdx}>{part}</span>;
          }
          if (part.type === "link") {
            const isInternal = part.url.startsWith("/");
            if (isInternal) {
              return (
                <Link
                  key={pIdx}
                  to={part.url}
                  className="font-medium underline text-foreground hover:text-muted-foreground transition-colors inline-flex items-center gap-0.5 mx-0.5"
                >
                  <span>{part.text}</span>
                  <ArrowRight className="size-2.5 inline" />
                </Link>
              );
            }
            return (
              <a
                key={pIdx}
                href={part.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline text-foreground hover:text-muted-foreground transition-colors inline-flex items-center gap-0.5 mx-0.5"
              >
                <span>{part.text}</span>
                <ArrowRight className="size-2.5 inline" />
              </a>
            );
          }
          if (part.type === "bold") {
            return (
              <strong key={pIdx} className="font-semibold text-foreground">
                {part.text}
              </strong>
            );
          }
          return null;
        });

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1">
              <span className="text-muted-foreground select-none">•</span>
              <div className="flex-1">{renderedLine}</div>
            </div>
          );
        }

        return <div key={lineIdx}>{renderedLine}</div>;
      })}
    </div>
  );
}

export function VinoraChatbot() {
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);

  const navigate = useNavigate();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of messages container
  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
        block: "end",
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
      // Auto-focus input on open
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized, messages, scrollToBottom]);

  // Handle ESC key to close chatbot
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Reset conversation to initial state
  const handleResetChat = () => {
    setMessages([
      {
        ...WELCOME_MESSAGE,
        id: `welcome-${Date.now()}`,
        timestamp: new Date().toISOString(),
      },
    ]);
    setInput("");
    setShowQuickActions(true);
  };

  // Dispatch a message (from input or quick action click)
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toISOString(),
    };

    // Update state with user message
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    try {
      // Build lightweight conversation history for the backend
      const historyPayload = updatedMessages
        .filter((m) => m.id !== "welcome-msg")
        .slice(-6)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const res = await sendChatMessage(query, historyPayload);

      const aiMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: res.reply,
        suggestions: res.suggestions && res.suggestions.length > 0 ? res.suggestions : undefined,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content:
          "I encountered an unexpected issue connecting to the architecture engine. Please submit your inquiry through our [Contact Page](/contact) or try asking again.",
        suggestions: INITIAL_SUGGESTIONS,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isMounted) {
    return null;
  }

  return (
    <>
      {/* ======================================================== */}
      {/* 1. FLOATING CHAT TRIGGER BUTTON                          */}
      {/* ======================================================== */}
      {!isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in zoom-in duration-200">
          <button
            type="button"
            suppressHydrationWarning
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            aria-label="Open VINORA AI Assistant"
            className="group relative flex items-center gap-3 border border-border bg-foreground text-background px-4 py-3 shadow-2xl hover:bg-foreground/90 transition-all duration-200 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <div className="relative">
              <Sparkles className="size-4 text-background group-hover:rotate-12 transition-transform duration-300" />
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-emerald-400 ring-2 ring-foreground animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-mono text-[10px] uppercase tracking-wider text-background/70 font-semibold leading-none">
                VINORA
              </span>
              <span className="font-display text-xs font-medium tracking-tight text-background leading-tight">
                AI Assistant
              </span>
            </div>
            <div className="ml-1 border-l border-background/20 pl-2">
              <MessageSquare className="size-3.5 text-background/80" />
            </div>
          </button>
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. CHATBOT MODAL / PANEL                                 */}
      {/* ======================================================== */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="VINORA AI Assistant"
          className={`fixed z-50 transition-all duration-200 ease-out shadow-2xl border border-border bg-background flex flex-col ${
            isMinimized
              ? "bottom-6 right-6 w-72 sm:w-80 h-14"
              : "bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-2rem)] sm:w-[440px] max-w-[440px] h-[600px] max-h-[calc(100vh-3rem)]"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-card px-4 py-3 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="size-7 border border-border bg-foreground text-background flex items-center justify-center font-display text-xs font-bold">
                V
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-display text-xs font-semibold text-foreground tracking-tight">
                    VINORA
                  </span>
                  <span className="border border-border bg-surface px-1.5 py-0.2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    AI Studio
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Online • Strategy & Architecture
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!isMinimized && (
                <button
                  type="button"
                  onClick={handleResetChat}
                  title="Reset Conversation"
                  aria-label="Reset Conversation"
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
                >
                  <RotateCcw className="size-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Expand Assistant" : "Minimize Assistant"}
                aria-label={isMinimized ? "Expand Assistant" : "Minimize Assistant"}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              >
                {isMinimized ? (
                  <Maximize2 className="size-3.5" />
                ) : (
                  <Minimize2 className="size-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close Assistant"
                aria-label="Close Assistant"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface transition-colors cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Body Content (Visible when not minimized) */}
          {!isMinimized && (
            <>
              {/* Message Scroll Area */}
              <div
                className="flex-1 overflow-y-auto p-4 space-y-4 font-sans bg-surface/30 text-foreground"
                aria-live="polite"
              >
                {/* Security and Scope Notice Banner */}
                <div className="border border-border/80 bg-card/60 p-2.5 text-[10px] font-mono text-muted-foreground flex items-start gap-2">
                  <ShieldCheck className="size-3.5 shrink-0 text-foreground/80 mt-0.5" />
                  <p className="leading-relaxed">
                    Public studio assistant for services, scoping, budgets, and process. Personal
                    project progress, invoices, and documents are secured in the{" "}
                    <Link
                      to="/login"
                      search={{ role: "client", mode: "login" }}
                      className="underline font-semibold text-foreground hover:text-muted-foreground"
                    >
                      Client Portal
                    </Link>
                    .
                  </p>
                </div>

                {/* Messages List */}
                {messages.map((msg) => {
                  const isUser = msg.role === "user";
                  const isAssistant = msg.role === "assistant";

                  // Check if this message mentions starting a project or client portal for action shortcuts
                  const mentionsStartProject =
                    isAssistant &&
                    (msg.content.toLowerCase().includes("start project") ||
                      msg.content.toLowerCase().includes("submit your brief") ||
                      msg.content.toLowerCase().includes("/start-project"));

                  const mentionsClientPortal =
                    isAssistant &&
                    (msg.content.toLowerCase().includes("client portal") ||
                      msg.content.toLowerCase().includes("/login?role=client") ||
                      msg.content.toLowerCase().includes("active deliverables"));

                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isUser ? "items-end" : "items-start"} space-y-1.5`}
                    >
                      <div className="flex items-center gap-1.5 text-[9px] font-mono text-muted-foreground px-1">
                        <span>{isUser ? "You" : "VINORA AI"}</span>
                        <span>•</span>
                        <span>
                          {new Date(msg.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div
                        className={`max-w-[85%] sm:max-w-[88%] p-3.5 rounded-none text-xs leading-relaxed transition-all ${
                          isUser
                            ? "bg-foreground text-background font-mono selection:bg-background selection:text-foreground"
                            : "bg-card border border-border text-foreground shadow-sm"
                        }`}
                      >
                        {isUser ? (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        ) : (
                          renderMessageContent(msg.content)
                        )}
                      </div>

                      {/* Direct Action Connection Buttons when relevant */}
                      {isAssistant && (mentionsStartProject || mentionsClientPortal) && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {mentionsStartProject && (
                            <Link
                              to="/start-project"
                              className="inline-flex items-center gap-1.5 border border-foreground bg-foreground text-background px-3 py-1.5 text-[11px] font-mono uppercase tracking-wider hover:bg-foreground/90 transition-colors"
                            >
                              <span>Open Start Project Brief</span>
                              <ChevronRight className="size-3" />
                            </Link>
                          )}
                          {mentionsClientPortal && (
                            <Link
                              to="/login"
                              search={{ role: "client", mode: "login" }}
                              className="inline-flex items-center gap-1.5 border border-border bg-card px-3 py-1.5 text-[11px] font-mono text-foreground hover:bg-surface transition-colors"
                            >
                              <span>Enter Client Portal</span>
                              <ExternalLink className="size-3" />
                            </Link>
                          )}
                        </div>
                      )}

                      {/* Quick-action Suggestions attached to assistant messages */}
                      {!isUser && msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1.5 max-w-[95%]">
                          {msg.suggestions.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              type="button"
                              onClick={() => handleSendMessage(sug)}
                              disabled={isLoading}
                              className="border border-border bg-card px-2.5 py-1 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors cursor-pointer text-left disabled:opacity-50"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Loading / Typing Indicator */}
                {isLoading && (
                  <div className="flex flex-col items-start space-y-1.5 animate-in fade-in">
                    <span className="text-[9px] font-mono text-muted-foreground px-1">
                      VINORA AI is formulating response...
                    </span>
                    <div className="border border-border bg-card px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className="size-3.5 animate-spin text-foreground" />
                      <span className="font-mono text-[11px]">
                        Querying studio knowledge engine...
                      </span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Actions Strip (Always visible or toggleable) */}
              <div className="border-t border-border/60 bg-card/40 px-3 py-2 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Quick Inquiries
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuickActions(!showQuickActions)}
                    className="text-[9px] font-mono text-muted-foreground/70 hover:text-foreground underline cursor-pointer"
                  >
                    {showQuickActions ? "Collapse" : "Show All"}
                  </button>
                </div>

                {showQuickActions && (
                  <div className="flex flex-wrap gap-1.5">
                    {PRIMARY_QUICK_ACTIONS.map((action, idx) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(action.query)}
                          disabled={isLoading}
                          className="inline-flex items-center gap-1.5 text-[10px] font-mono border border-border px-2 py-1 text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors bg-background cursor-pointer disabled:opacity-50"
                        >
                          {Icon && <Icon className="size-2.5 text-foreground/70" />}
                          <span>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Input Form */}
              <form
                onSubmit={handleSubmit}
                className="border-t border-border bg-card p-3 flex items-center gap-2 shrink-0"
              >
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about services, proposals, payments, or client portal..."
                    disabled={isLoading}
                    aria-label="Type your message to VINORA AI Assistant"
                    className="w-full bg-background border border-border px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-foreground/80 font-sans disabled:opacity-50"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isLoading || !input.trim()}
                  aria-label="Send message"
                  className="rounded-none bg-foreground text-background hover:bg-foreground/90 h-[38px] px-3.5 font-mono text-xs cursor-pointer disabled:opacity-40"
                >
                  {isLoading ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Send className="size-3.5" />
                  )}
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
