import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Minus, MoreVertical, Send, Mic, Bot, User, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { SuggestionChips, ActionResultCard, ErrorCard } from "./AssistantMessageCards";
import { apiRequest } from "@/lib/queryClient";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  type?: "text" | "confirmation_required" | "action_result" | "error" | "tool_result";
  toolCalled?: string;
  toolResult?: any;
  navigationTarget?: string;
  confirmationToken?: string;
  confirmed?: boolean;
}

function generateSessionId() {
  return "sess-" + crypto.randomUUID();
}

const SESSION_KEY = "companyhq-assistant-session";

function getOrCreateSessionId(): string {
  let sid = sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export default function AIAssistantPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showMenu, setShowMenu] = useState(false);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const sessionId = useRef(getOrCreateSessionId());

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    if (isOpen && !hasLoadedHistory) {
      loadHistory();
      loadSuggestions();
      setHasLoadedHistory(true);
    }
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const loadHistory = async () => {
    try {
      const res = await fetch(`/api/assistant/history?sessionId=${sessionId.current}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      }
    } catch (_) {}
  };

  const loadSuggestions = async () => {
    try {
      const res = await fetch("/api/assistant/suggestions", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions || []);
      }
    } catch (_) {}
  };

  const getCurrentModule = () => {
    const path = window.location.pathname;
    const parts = path.split("/").filter(Boolean);
    return parts[0] || "dashboard";
  };

  const sendMessage = useCallback(async (messageText: string, extra?: { confirmationGranted?: boolean; confirmationToken?: string }) => {
    if (isLoading) return;
    if (!extra && (!messageText.trim())) return;

    if (!extra) {
      const userMsg: ChatMessage = { role: "user", content: messageText };
      setMessages((prev) => [...prev, userMsg]);
    }
    setInput("");
    setIsLoading(true);
    setSuggestions([]);

    try {
      const conversationHistory = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const body: any = {
        message: extra ? (extra.confirmationGranted ? "[Confirmed]" : "[Cancelled]") : messageText,
        conversationHistory,
        currentModule: getCurrentModule(),
        sessionId: sessionId.current,
      };

      if (extra) {
        body.confirmationGranted = extra.confirmationGranted;
        body.confirmationToken = extra.confirmationToken;
      }

      const res = await apiRequest("POST", "/api/assistant/chat", body);
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data.response,
        type: data.type || "text",
        toolCalled: data.toolCalled,
        toolResult: data.toolResult,
        navigationTarget: data.navigationTarget,
        confirmationToken: data.confirmationToken,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      if (data.navigationTarget) {
        setTimeout(() => navigate(data.navigationTarget), 800);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, I encountered an error. Please try again.", type: "error" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, navigate]);

  const handleConfirm = (confirmationToken: string) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === prev.length - 1 && m.type === "confirmation_required"
          ? { ...m, confirmed: true }
          : m
      )
    );
    sendMessage("[Confirmed]", { confirmationGranted: true, confirmationToken });
  };

  const handleCancel = (confirmationToken: string) => {
    setMessages((prev) =>
      prev.map((m, i) =>
        i === prev.length - 1 && m.type === "confirmation_required"
          ? { ...m, confirmed: false }
          : m
      )
    );
    sendMessage("[Cancelled]", { confirmationGranted: false, confirmationToken });
  };

  const handleClearConversation = () => {
    setMessages([]);
    setSuggestions([]);
    setShowMenu(false);
    sessionId.current = generateSessionId();
    sessionStorage.setItem(SESSION_KEY, sessionId.current);
    setHasLoadedHistory(false);
    loadSuggestions();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!isOpen) {
    return (
      <div className="fixed bottom-6 right-6 z-50" style={{ bottom: "5.5rem" }}>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            size="icon"
            className="h-12 w-12 rounded-full shadow-lg bg-primary hover:bg-primary/90"
            onClick={() => setIsOpen(true)}
            data-testid="floating-assistant-btn"
          >
            <Sparkles className="h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="fixed bottom-0 right-0 z-50 flex flex-col bg-background border-l shadow-2xl
          w-full h-[100dvh] sm:w-[380px] sm:h-[600px] sm:bottom-6 sm:right-6 sm:rounded-xl sm:border"
        data-testid="assistant-panel"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b bg-primary/5 sm:rounded-t-xl">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">CompanyHQ Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="relative">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowMenu(!showMenu)} data-testid="assistant-menu-btn">
                <MoreVertical className="h-4 w-4" />
              </Button>
              {showMenu && (
                <>
                  <div className="fixed inset-0" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-8 bg-background border rounded-lg shadow-lg z-10 min-w-[160px]">
                    <button onClick={handleClearConversation} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors rounded-lg" data-testid="clear-conversation-btn">
                      Clear conversation
                    </button>
                  </div>
                </>
              )}
            </div>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsOpen(false)} data-testid="assistant-minimize-btn">
              <Minus className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 sm:hidden" onClick={() => setIsOpen(false)} data-testid="assistant-close-btn">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Bot className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">How can I help you?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Ask me anything about your tasks, equipment, schedule, or navigate the app.
                </p>
              </div>
              {suggestions.length > 0 && (
                <SuggestionChips suggestions={suggestions} onChipClick={(s) => sendMessage(s)} />
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`flex gap-2 max-w-[85%] ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center mt-1 ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                }`}>
                  {msg.role === "user" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                </div>
                <div className="space-y-2" data-testid={`chat-message-${msg.role}-${i}`}>
                  {msg.type === "confirmation_required" && msg.confirmationToken && msg.confirmed === undefined ? (
                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 space-y-2" data-testid="confirmation-card">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <span className="font-medium text-sm text-amber-800 dark:text-amber-200">Confirm Action</span>
                      </div>
                      <p className="text-sm text-amber-700 dark:text-amber-300 whitespace-pre-wrap">{msg.content}</p>
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => handleConfirm(msg.confirmationToken!)}
                          data-testid="confirm-action-btn"
                        >
                          <Check className="h-3 w-3 mr-1" /> Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs"
                          onClick={() => handleCancel(msg.confirmationToken!)}
                          data-testid="cancel-action-btn"
                        >
                          <X className="h-3 w-3 mr-1" /> Cancel
                        </Button>
                      </div>
                    </div>
                  ) : msg.type === "confirmation_required" && msg.confirmed !== undefined ? (
                    <div className={`rounded-lg px-3 py-2 text-sm ${msg.confirmed ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800" : "bg-muted"}`}>
                      <p className="text-xs opacity-75 mb-1 italic">{msg.confirmed ? "Confirmed" : "Cancelled"}</p>
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  ) : msg.type === "action_result" ? (
                    <ActionResultCard
                      title="Action Completed"
                      description={msg.content}
                      linkText={msg.navigationTarget ? "View record" : undefined}
                      onLinkClick={msg.navigationTarget ? () => navigate(msg.navigationTarget!) : undefined}
                    />
                  ) : msg.type === "error" ? (
                    <ErrorCard message={msg.content} />
                  ) : (
                    <div className={`rounded-lg px-3 py-2 text-sm ${
                      msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {msg.navigationTarget && (
                        <p className="text-xs opacity-75 mb-1 italic">Navigating to {msg.navigationTarget}...</p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="flex gap-2 max-w-[85%]">
                <div className="flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center mt-1 bg-muted">
                  <Bot className="h-3 w-3" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2" data-testid="typing-indicator">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="px-3 py-3 border-t">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything..."
                className="w-full bg-muted rounded-lg pl-3 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                disabled={isLoading}
                data-testid="assistant-input"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2" title="Voice coming soon">
                <Mic className="h-4 w-4 text-muted-foreground/30 cursor-not-allowed" />
              </div>
            </div>
            <Button
              size="icon"
              className="h-9 w-9 rounded-lg flex-shrink-0"
              disabled={!input.trim() || isLoading}
              onClick={() => sendMessage(input)}
              data-testid="assistant-send-btn"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
