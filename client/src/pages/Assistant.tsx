import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, 
  Send, 
  Bot, 
  Lightbulb, 
  MessageSquare,
  Wrench,
  Zap,
  CheckCircle2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Assistant() {
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', text: "Hello! I'm your HQ Assistant. I can help you find SOPs, suggest new modules, or record feature requests. How can I help today?" }
  ]);

  const recommendations = [
    { title: "Equipment Tracker", desc: "Digital maintenance logs and QR code tracking for mowers & blowers.", icon: Wrench },
    { title: "Safety Inspector", desc: "Weekly safety meeting topics and OSHA compliance checklists.", icon: Zap },
    { title: "Material Calculator", desc: "Quickly calculate yardage for mulch, stone, and soil on-site.", icon: Lightbulb }
  ];

  const handleSend = () => {
    if (!query.trim()) return;
    
    const newMsg = { role: 'user', text: query };
    setMessages([...messages, newMsg]);
    setQuery("");
    setIsSubmitting(true);

    // Mock bot response
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        role: 'bot', 
        text: "I've logged your request: '" + query + "'. Our development team has been notified. Is there anything else you'd like to add?" 
      }]);
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-4xl font-heading font-bold text-foreground flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-primary" /> Assistant & Roadmap
          </h1>
          <p className="text-muted-foreground text-lg">Help us build the ultimate landscape management tool.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chat Interface */}
        <Card className="lg:col-span-2 flex flex-col h-[600px] shadow-lg border-primary/20">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <Bot className="text-primary-foreground w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-base">HQ AI Assistant</CardTitle>
                <CardDescription>Ask for updates or request features</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
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
                    <p className="text-sm leading-relaxed">{m.text}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isSubmitting && (
              <div className="flex justify-start">
                <div className="bg-muted p-4 rounded-2xl rounded-tl-none flex gap-1">
                  <span className="w-1.5 h-1.5 bg-foreground/20 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-foreground/20 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 bg-foreground/20 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </CardContent>
          <div className="p-4 border-t bg-muted/10">
            <div className="flex gap-2">
              <Input 
                placeholder="Type your feature request..." 
                className="bg-card"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <Button onClick={handleSend} disabled={isSubmitting}>
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
                      < rec.icon className="w-5 h-5" />
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
