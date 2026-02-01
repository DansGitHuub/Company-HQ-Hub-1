import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, HelpCircle, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

interface FloatingAssistantButtonProps {
  onChatClick: () => void;
  isChatOpen: boolean;
}

export default function FloatingAssistantButton({ onChatClick, isChatOpen }: FloatingAssistantButtonProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [, navigate] = useLocation();

  const handleHelpClick = () => {
    setIsMenuOpen(false);
    navigate("/help");
  };

  const handleChatClick = () => {
    setIsMenuOpen(false);
    onChatClick();
  };

  if (isChatOpen) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0"
              onClick={() => setIsMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              className="absolute bottom-16 right-0 bg-background border rounded-xl shadow-xl overflow-hidden min-w-[180px]"
              data-testid="assistant-menu"
            >
              <button
                onClick={handleChatClick}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted transition-colors text-left"
                data-testid="menu-chat"
              >
                <span className="p-2 rounded-lg bg-primary/10 text-primary">
                  <MessageCircle className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium text-sm">AI Assistant</p>
                  <p className="text-xs text-muted-foreground">Chat with AI</p>
                </div>
              </button>
              <button
                onClick={handleHelpClick}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted transition-colors text-left border-t"
                data-testid="menu-help"
              >
                <span className="p-2 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300">
                  <HelpCircle className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-medium text-sm">Help Center</p>
                  <p className="text-xs text-muted-foreground">Browse articles</p>
                </div>
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
        <Button
          size="lg"
          className="h-14 w-14 rounded-full shadow-lg"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          data-testid="floating-assistant-btn"
        >
          <AnimatePresence mode="wait">
            {isMenuOpen ? (
              <motion.div
                key="close"
                initial={{ rotate: -90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: 90, opacity: 0 }}
              >
                <X className="h-6 w-6" />
              </motion.div>
            ) : (
              <motion.div
                key="sparkles"
                initial={{ rotate: 90, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                exit={{ rotate: -90, opacity: 0 }}
              >
                <Sparkles className="h-6 w-6" />
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </motion.div>
    </div>
  );
}
