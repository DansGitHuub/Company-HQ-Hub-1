import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  Plus,
  Trash2,
  ChevronLeft,
  Minimize2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Message {
  id?: number;
  role: string;
  content: string;
}

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
  messages?: Message[];
}

interface FloatingChatPopupProps {
  userRole: string;
  userName?: string;
}

export default function FloatingChatPopup({ userRole, userName }: FloatingChatPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConversations, setShowConversations] = useState(false);
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
    enabled: isOpen,
  });

  const { data: activeConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", activeConversationId],
    enabled: !!activeConversationId && isOpen,
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/conversations", { title: "New Chat" });
      return res.json();
    },
    onSuccess: (data) => {
      setActiveConversationId(data.id);
      setLocalMessages([]);
      setShowConversations(false);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  const deleteConversation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/conversations/${id}`);
    },
    onSuccess: () => {
      if (activeConversationId === deleteConversation.variables) {
        setActiveConversationId(null);
        setLocalMessages([]);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
  });

  useEffect(() => {
    if (activeConversation?.messages) {
      setLocalMessages(activeConversation.messages);
    }
  }, [activeConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [localMessages, streamingContent]);

  const getRoleBasedGreeting = () => {
    const greetings: Record<string, string> = {
      Customer: `Hello${userName ? ` ${userName}` : ""}! I'm your HQ Assistant. I can help you with:\n\n• Your service requests and job status\n• Property care tips and seasonal advice\n• Understanding your invoices\n• Scheduling questions\n\nHow can I assist you today?`,
      Crew: `Hey${userName ? ` ${userName}` : ""}! I'm here to help with your daily work. I can assist with:\n\n• Job instructions and SOP lookups\n• Equipment maintenance questions\n• Material usage guidelines\n• Safety procedures\n• Route and schedule info\n\nWhat do you need help with?`,
      Manager: `Hi${userName ? ` ${userName}` : ""}! I'm your operations assistant. I can help with:\n\n• Team scheduling and assignments\n• Job tracking and status updates\n• Inventory and materials management\n• Customer communications\n• Performance metrics\n• Hiring pipeline questions\n\nHow can I assist you today?`,
      Admin: `Hello${userName ? ` ${userName}` : ""}! I'm your full-access HQ Assistant. I can help with:\n\n• All system operations and settings\n• Financial and business analytics\n• Team and customer management\n• Integration and workflow setup\n• SOPs, forms, and documentation\n• Strategic planning questions\n\nWhat would you like to work on?`,
    };
    return greetings[userRole] || greetings.Customer;
  };

  const handleSend = async () => {
    if (!query.trim() || isStreaming) return;
    
    let conversationId = activeConversationId;
    
    if (!conversationId) {
      const res = await apiRequest("POST", "/api/conversations", { title: query.slice(0, 50) });
      const newConvo = await res.json();
      conversationId = newConvo.id;
      setActiveConversationId(conversationId);
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    }

    const userMessage: Message = { role: "user", content: query };
    setLocalMessages((prev) => [...prev, userMessage]);
    setQuery("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: query }),
      });

      if (!response.ok) throw new Error("Failed to send message");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.content) {
                  fullContent += data.content;
                  setStreamingContent(fullContent);
                }
                if (data.done) {
                  setLocalMessages((prev) => [...prev, { role: "assistant", content: fullContent }]);
                  setStreamingContent("");
                }
              } catch (e) {
                // Skip malformed JSON
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setLocalMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I encountered an error. Please try again." }]);
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversationId] });
    }
  };

  const displayMessages = localMessages.length > 0 ? localMessages : [
    { role: "assistant", content: getRoleBasedGreeting() }
  ];

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-20 right-4 z-50 w-[380px] h-[520px] bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            data-testid="floating-chat-popup"
          >
            <div className="flex items-center justify-between p-3 border-b bg-primary text-primary-foreground">
              <div className="flex items-center gap-2">
                {showConversations ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                    onClick={() => setShowConversations(false)}
                    data-testid="button-back-to-chat"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                    <Bot className="w-5 h-5" />
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-sm">HQ Assistant</h3>
                  <p className="text-xs opacity-80">{userRole} Access</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setShowConversations(!showConversations)}
                  data-testid="button-toggle-conversations"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
                  onClick={() => setIsOpen(false)}
                  data-testid="button-close-chat"
                >
                  <Minimize2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {showConversations ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <Button 
                  onClick={() => {
                    createConversation.mutate();
                  }} 
                  className="w-full mb-2" 
                  size="sm"
                  data-testid="button-new-conversation"
                >
                  <Plus className="w-4 h-4 mr-2" /> New Conversation
                </Button>
                {conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No conversations yet</p>
                ) : (
                  conversations.map((convo) => (
                    <div
                      key={convo.id}
                      className={`p-3 rounded-lg cursor-pointer flex items-center justify-between group transition-colors ${
                        activeConversationId === convo.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                      }`}
                      onClick={() => {
                        setActiveConversationId(convo.id);
                        setShowConversations(false);
                      }}
                      data-testid={`popup-conversation-${convo.id}`}
                    >
                      <span className="text-sm truncate flex-1">{convo.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity ${
                          activeConversationId === convo.id ? "hover:bg-primary-foreground/20" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation.mutate(convo.id);
                        }}
                        data-testid={`button-delete-popup-conversation-${convo.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  <AnimatePresence initial={false}>
                    {displayMessages.map((m, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`max-w-[85%] p-3 rounded-2xl ${
                          m.role === 'user' 
                            ? 'bg-primary text-primary-foreground rounded-tr-sm' 
                            : 'bg-muted rounded-tl-sm'
                        }`}>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        </div>
                      </motion.div>
                    ))}
                    {streamingContent && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <div className="max-w-[85%] p-3 rounded-2xl bg-muted rounded-tl-sm">
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{streamingContent}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {isStreaming && !streamingContent && (
                    <div className="flex justify-start">
                      <div className="bg-muted p-3 rounded-2xl rounded-tl-sm flex gap-1">
                        <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce" />
                        <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-1.5 h-1.5 bg-foreground/30 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t bg-muted/30">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Ask me anything..." 
                      className="bg-card text-sm"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      disabled={isStreaming}
                      data-testid="input-popup-chat-message"
                    />
                    <Button 
                      onClick={handleSend} 
                      disabled={isStreaming || !query.trim()} 
                      size="icon"
                      data-testid="button-popup-send-message"
                    >
                      <Send className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
        data-testid="button-open-chat"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>
    </>
  );
}
