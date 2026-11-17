import { useState, useEffect, useRef } from "react";
import {
  Send,
  Check,
  CheckCheck,
  MessageSquare,
  Search,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Clock,
  Sparkles,
  User,
  ShieldCheck,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  subscribeToConversations,
  subscribeToMessages,
  sendAdminReply,
  markConversationAsRead,
} from "@/services/messaging";
import type { Conversation, ConversationMessage } from "@/lib/types";
import type { AdminRecord } from "@/services/adminAuth";

interface WhatsAppAdminChatProps {
  admin: AdminRecord;
}

export function WhatsAppAdminChat({ admin }: WhatsAppAdminChatProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "unread">("all");
  const [replyText, setReplyText] = useState("");
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // 1. Subscribe to all conversations in real time
  useEffect(() => {
    setIsLoadingList(true);
    const unsub = subscribeToConversations(
      (convs) => {
        setConversations(convs);
        setIsLoadingList(false);

        // If no conversation currently selected and we have conversations, auto-select first one on desktop
        setSelectedConvId((current) => {
          if (current) return current;
          if (window.innerWidth >= 1024 && convs.length > 0) {
            return convs[0].id;
          }
          return null;
        });
      },
      (err) => {
        console.error("Error subscribing to admin conversations:", err);
        setError("Unable to load client conversations from Firestore.");
        setIsLoadingList(false);
      },
    );

    return () => unsub();
  }, []);

  // Selected conversation object
  const activeConversation = conversations.find((c) => c.id === selectedConvId) || null;

  // 2. Subscribe to messages of selected conversation
  useEffect(() => {
    if (!selectedConvId) {
      setMessages([]);
      return;
    }

    setIsLoadingMessages(true);
    const unsub = subscribeToMessages(
      selectedConvId,
      (msgs) => {
        setMessages(msgs);
        setIsLoadingMessages(false);
        setTimeout(() => scrollToBottom("auto"), 50);

        // Mark incoming client messages as read by admin
        if (msgs.some((m) => m.recipientRole === "admin" && !m.read)) {
          markConversationAsRead(selectedConvId, "admin");
        }
      },
      (err) => {
        console.error("Error subscribing to messages for", selectedConvId, err);
        setIsLoadingMessages(false);
      },
    );

    // Also mark conversation unread counter
    markConversationAsRead(selectedConvId, "admin");

    return () => unsub();
  }, [selectedConvId]);

  // Handle admin sending a reply
  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = replyText.trim();
    if (!text || !selectedConvId || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      await sendAdminReply({
        conversationId: selectedConvId,
        adminUid: admin.uid,
        adminName: admin.name || "VINORA Lead Architect",
        adminEmail: admin.email,
        text,
      });
      setReplyText("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      setTimeout(() => scrollToBottom("smooth"), 100);
    } catch (err: unknown) {
      console.error("Failed to send admin reply:", err);
      setError(err instanceof Error ? err.message : "Failed to deliver reply.");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const insertQuickSnippet = (snippet: string) => {
    setReplyText(snippet);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  // Filter conversations
  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.clientName.toLowerCase().includes(q) ||
      c.clientEmail.toLowerCase().includes(q) ||
      c.lastMessageText.toLowerCase().includes(q) ||
      c.clientId.toLowerCase().includes(q);

    if (filterTab === "unread") {
      return matchesSearch && c.unreadCountAdmin > 0;
    }
    return matchesSearch;
  });

  const totalUnread = conversations.reduce((acc, c) => acc + (c.unreadCountAdmin || 0), 0);

  // Time formatting
  const formatConvTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      const now = new Date();
      if (d.toDateString() === now.toDateString()) {
        return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
      }
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch {
      return "";
    }
  };

  const formatMessageTime = (isoString?: string) => {
    if (!isoString) return "";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
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

  const copyClientId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  return (
    <div className="border border-border bg-card shadow-sm h-[720px] max-h-[85vh] rounded-none overflow-hidden flex flex-col">
      {/* Top Banner */}
      <div className="border-b border-border bg-surface px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-full border border-border bg-foreground text-background flex items-center justify-center font-display font-bold text-xs">
            VA
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-display text-sm font-semibold tracking-tight">
                VINORA Studio Direct Messaging
              </h3>
              <span className="border border-border bg-card px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                ADMIN ACCESS
              </span>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <span>Audited Operator:</span>
              <span className="font-mono text-foreground font-medium">
                {admin.name || admin.email}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="border border-border bg-card px-2.5 py-1 flex items-center gap-2">
            <span className="text-muted-foreground">Total Threads:</span>
            <span className="font-bold text-foreground">{conversations.length}</span>
          </div>
          {totalUnread > 0 && (
            <div className="bg-foreground text-background px-2.5 py-1 font-bold flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{totalUnread} Unread</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Split Window */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN: Conversation List */}
        <div
          className={`w-full lg:w-80 xl:w-96 border-r border-border bg-surface/50 flex flex-col ${
            selectedConvId ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Search & Tabs */}
          <div className="p-3 border-b border-border space-y-2 bg-surface">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search clients or messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs rounded-none border-border bg-background focus-visible:ring-0 focus-visible:border-foreground"
              />
            </div>

            <div className="flex items-center gap-1 border-t border-border/50 pt-2">
              <button
                type="button"
                onClick={() => setFilterTab("all")}
                className={`flex-1 py-1 text-center font-mono text-xs cursor-pointer transition-colors ${
                  filterTab === "all"
                    ? "bg-foreground text-background font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({conversations.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("unread")}
                className={`flex-1 py-1 text-center font-mono text-xs cursor-pointer transition-colors flex items-center justify-center gap-1.5 ${
                  filterTab === "unread"
                    ? "bg-foreground text-background font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span>Unread</span>
                {totalUnread > 0 && (
                  <span
                    className={`px-1.5 py-0.2 text-[10px] ${
                      filterTab === "unread"
                        ? "bg-background text-foreground"
                        : "bg-foreground text-background"
                    }`}
                  >
                    {totalUnread}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Conversations Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {isLoadingList ? (
              <div className="p-8 text-center space-y-2">
                <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                <p className="font-mono text-xs text-muted-foreground">Loading threads...</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <MessageSquare className="size-8 mx-auto text-muted-foreground/40" />
                <p className="font-display text-sm font-medium">No conversations found</p>
                <p className="text-xs text-muted-foreground">
                  {searchQuery
                    ? "No clients match your search query."
                    : "When clients send messages from their portal, threads will appear here."}
                </p>
              </div>
            ) : (
              filteredConversations.map((conv) => {
                const isSelected = conv.id === selectedConvId;
                const hasUnread = conv.unreadCountAdmin > 0;
                const initials = (conv.clientName || conv.clientEmail || "CL")
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <button
                    key={conv.id}
                    type="button"
                    onClick={() => setSelectedConvId(conv.id)}
                    className={`w-full text-left p-3.5 transition-colors cursor-pointer flex items-start gap-3 ${
                      isSelected
                        ? "bg-background border-l-2 border-foreground"
                        : hasUnread
                          ? "bg-surface hover:bg-background/80"
                          : "hover:bg-surface"
                    }`}
                  >
                    {/* Avatar */}
                    <div className="relative shrink-0 mt-0.5">
                      <div className="size-9 rounded-full border border-border bg-card flex items-center justify-center font-display font-semibold text-xs text-foreground">
                        {initials}
                      </div>
                      {hasUnread && (
                        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4
                          className={`text-xs truncate ${
                            hasUnread ? "font-bold text-foreground" : "font-medium text-foreground"
                          }`}
                        >
                          {conv.clientName}
                        </h4>
                        <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                          {formatConvTime(conv.lastMessageTimestamp)}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground truncate">
                        {conv.clientEmail}
                      </p>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p
                          className={`text-xs truncate ${
                            hasUnread ? "font-medium text-foreground" : "text-muted-foreground"
                          }`}
                        >
                          {conv.lastSenderRole === "admin" && (
                            <span className="font-mono text-[10px] opacity-70 mr-1">You:</span>
                          )}
                          {conv.lastMessageText || "New conversation initiated"}
                        </p>

                        {hasUnread && (
                          <span className="shrink-0 px-1.5 py-0.2 font-mono text-[10px] font-bold bg-foreground text-background">
                            {conv.unreadCountAdmin}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Active Chat Thread */}
        <div
          className={`flex-1 flex flex-col bg-background ${
            !selectedConvId ? "hidden lg:flex" : "flex"
          }`}
        >
          {activeConversation ? (
            <>
              {/* Active Conversation Header */}
              <div className="border-b border-border bg-surface px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Mobile Back Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedConvId(null)}
                    className="lg:hidden rounded-none p-1.5 h-8 text-muted-foreground"
                  >
                    <ArrowLeft className="size-4" />
                  </Button>

                  <div className="size-9 rounded-full border border-border bg-card flex items-center justify-center font-display font-semibold text-xs">
                    {(activeConversation.clientName || "CL").slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-display text-sm font-semibold text-foreground">
                        {activeConversation.clientName}
                      </h4>
                      <span className="border border-border bg-card px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground">
                        CLIENT
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{activeConversation.clientEmail}</span>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => copyClientId(activeConversation.clientId)}
                        className="font-mono text-[11px] hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
                        title="Copy Client UID"
                      >
                        <span>UID: {activeConversation.clientId.slice(0, 8)}...</span>
                        <Copy className="size-3" />
                      </button>
                      {copiedId && (
                        <span className="text-[10px] font-mono text-emerald-500">Copied!</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] border border-border bg-card px-2 py-1">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    <span>Real-time Sync Active</span>
                  </div>
                </div>
              </div>

              {/* Error Banner */}
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

              {/* Messages Stream */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-background/50">
                {isLoadingMessages ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 py-16">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    <p className="font-mono text-xs text-muted-foreground">
                      Fetching encrypted messages...
                    </p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-3">
                    <MessageSquare className="size-8 mx-auto text-muted-foreground/40" />
                    <h5 className="font-display text-sm font-semibold">
                      No messages yet in this thread
                    </h5>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Send a message to greet {activeConversation.clientName} or provide an update
                      on their active projects.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((msg, index) => {
                      const isAdminMsg = msg.senderRole === "admin";
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

                          <div
                            className={`flex flex-col ${isAdminMsg ? "items-end" : "items-start"}`}
                          >
                            <div
                              className={`max-w-[85%] sm:max-w-[70%] rounded-none p-3.5 shadow-sm space-y-1.5 ${
                                isAdminMsg
                                  ? "bg-foreground text-background border border-foreground"
                                  : "bg-surface text-foreground border border-border"
                              }`}
                            >
                              {/* Header */}
                              <div className="flex items-center justify-between gap-3 text-[10px] font-mono opacity-70">
                                <span className="font-semibold uppercase tracking-wider">
                                  {isAdminMsg ? `You (${msg.senderName})` : msg.senderName}
                                </span>
                                <span className="border border-border px-1 py-0.2 bg-background/50 text-[9px]">
                                  {isAdminMsg ? "ADMIN" : "CLIENT"}
                                </span>
                              </div>

                              {/* Body */}
                              <p className="text-xs sm:text-sm font-sans whitespace-pre-wrap leading-relaxed break-words">
                                {msg.text}
                              </p>

                              {/* Timestamp and Read status */}
                              <div
                                className={`flex items-center justify-end gap-1.5 pt-1 text-[10px] font-mono ${
                                  isAdminMsg ? "text-background/70" : "text-muted-foreground"
                                }`}
                              >
                                <span>{formatMessageTime(msg.createdAt)}</span>
                                {isAdminMsg && (
                                  <span>
                                    {msg.read ? (
                                      <CheckCheck
                                        className="size-3.5 text-emerald-400 inline"
                                        title="Read by client"
                                      />
                                    ) : (
                                      <Check
                                        className="size-3.5 text-background/60 inline"
                                        title="Delivered to client portal"
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

              {/* Admin Reply Composer */}
              <div className="border-t border-border bg-surface p-3 sm:p-4">
                {/* Quick canned replies */}
                <div className="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar text-xs">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mr-1">
                    Quick:
                  </span>
                  {[
                    "Requirement acknowledged. Our lead architect is reviewing.",
                    "Project milestone completed. Review is now live in your portal.",
                    "Would you like to schedule a 15-minute technical review call?",
                    "Invoice generated and available under your Invoices tab.",
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => insertQuickSnippet(chip)}
                      className="px-2 py-0.5 border border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/40 whitespace-nowrap cursor-pointer transition-colors"
                    >
                      {chip.slice(0, 24)}...
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSendReply} className="flex items-end gap-2">
                  <div className="relative flex-1">
                    <textarea
                      ref={textareaRef}
                      value={replyText}
                      onChange={(e) => {
                        setReplyText(e.target.value);
                        e.target.style.height = "auto";
                        e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={`Reply to ${activeConversation.clientName} as ${admin.name || "VINORA Admin"}...`}
                      rows={1}
                      className="w-full resize-none border border-border bg-background px-3.5 py-2.5 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-hidden leading-relaxed max-h-[120px]"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={!replyText.trim() || isSending}
                    className="rounded-none h-[42px] px-4 cursor-pointer bg-foreground text-background hover:bg-foreground/90 shrink-0"
                  >
                    {isSending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                    <span className="hidden sm:inline ml-1.5 text-xs font-mono">Reply</span>
                  </Button>
                </form>

                <p className="mt-1.5 text-[10px] font-mono text-muted-foreground/70 hidden sm:block">
                  Replying as verified admin{" "}
                  <span className="font-semibold text-foreground">{admin.email}</span>. Press{" "}
                  <kbd className="border border-border px-1">Enter</kbd> to send.
                </p>
              </div>
            </>
          ) : (
            /* No conversation selected */
            <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4">
              <div className="size-14 rounded-full border border-border bg-surface flex items-center justify-center">
                <MessageSquare className="size-7 text-muted-foreground" />
              </div>
              <div className="max-w-md">
                <h4 className="font-display text-lg font-semibold">Select a Client Conversation</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Choose a client thread from the roster on the left to review incoming inquiries,
                  send project architectural directives, and manage milestone communications.
                </p>
              </div>
              {totalUnread > 0 && (
                <div className="border border-border bg-surface px-4 py-2 font-mono text-xs flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    You have <strong className="text-foreground">{totalUnread}</strong> unread
                    message{totalUnread > 1 ? "s" : ""} waiting for attention.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
