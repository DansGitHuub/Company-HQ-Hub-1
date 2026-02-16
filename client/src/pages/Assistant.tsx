import React, { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Send, 
  Bot, 
  Lightbulb, 
  Wrench,
  Zap,
  CheckCircle2,
  Plus,
  Trash2,
  MessageSquare
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

export default function Assistant() {
  const [query, setQuery] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  const { data: activeConversation } = useQuery<Conversation>({
    queryKey: ["/api/conversations", activeConversationId],
    enabled: !!activeConversationId,
  });

  const createConversation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/conversations", { title: "New Chat" });
      return res.json();
    },
    onSuccess: (data) => {
      setActiveConversationId(data.id);
      setLocalMessages([]);
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

  const recommendations = [
    { title: "Equipment Tracker", desc: "Digital maintenance logs and QR code tracking for mowers & blowers.", icon: Wrench },
    { title: "Safety Inspector", desc: "Weekly safety meeting topics and OSHA compliance checklists.", icon: Zap },
    { title: "Material Calculator", desc: "Quickly calculate yardage for mulch, stone, and soil on-site.", icon: Lightbulb }
  ];

  const displayMessages = localMessages.length > 0 ? localMessages : [
    { role: "assistant", content: "Hello! I'm your HQ AI Assistant. I can help answer questions about landscaping, business operations, or anything else. How can I help you today?" }
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" /> AI Assistant
          </h1>
          <p className="text-muted-foreground text-sm">Your intelligent companion for landscape business questions.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Conversation List */}
        <div className="space-y-4">
          <Button onClick={() => createConversation.mutate()} className="w-full" data-testid="button-new-chat">
            <Plus className="w-4 h-4 mr-2" /> New Chat
          </Button>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {conversations.map((convo) => (
              <div
                key={convo.id}
                className={`p-3 rounded-lg cursor-pointer flex items-center justify-between group transition-colors ${
                  activeConversationId === convo.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/80"
                }`}
                onClick={() => setActiveConversationId(convo.id)}
                data-testid={`conversation-item-${convo.id}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <MessageSquare className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm truncate">{convo.title}</span>
                </div>
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
                  data-testid={`button-delete-conversation-${convo.id}`}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Interface */}
        <Card className="lg:col-span-2 flex flex-col h-[600px] shadow-lg border-primary/20">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Bot className="text-primary-foreground w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-base">HQ AI Assistant</CardTitle>
                <CardDescription>Powered by AI</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            <AnimatePresence initial={false}>
              {displayMessages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[80%] p-4 rounded-2xl ${
                    m.role === 'user' 
                      ? 'bg-primary text-primary-foreground rounded-tr-none' 
                      : 'bg-muted rounded-tl-none'
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
                  <div className="max-w-[80%] p-4 rounded-2xl bg-muted rounded-tl-none">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{streamingContent}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            {isStreaming && !streamingContent && (
              <div className="flex justify-start">
                <div className="bg-muted p-4 rounded-2xl rounded-tl-none flex gap-1">
                  <span className="w-1.5 h-1.5 bg-foreground/20 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-foreground/20 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-foreground/20 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </CardContent>
          <div className="p-4 border-t bg-muted/10">
            <div className="flex gap-2">
              <Input 
                placeholder="Ask me anything..." 
                className="bg-card"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={isStreaming}
                data-testid="input-chat-message"
              />
              <Button onClick={handleSend} disabled={isStreaming || !query.trim()} data-testid="button-send-message">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>

        {/* Recommendations & Roadmap */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-500" /> Recommended Additions
              </CardTitle>
              <CardDescription>Top requested landscape tools</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recommendations.map((rec, i) => (
                <div key={i} className="group p-4 rounded-lg border bg-card hover:border-primary transition-colors cursor-pointer">
                  <div className="flex gap-4">
                    <div className="p-2 rounded-md bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors h-fit">
                      <rec.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{rec.title}</h4>
                      <p className="text-xs text-muted-foreground mt-1 leading-tight">{rec.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-widest text-primary">In Development</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Route Optimization API",
                "Subcontractor Portal",
                "Photo Markup Tool"
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
