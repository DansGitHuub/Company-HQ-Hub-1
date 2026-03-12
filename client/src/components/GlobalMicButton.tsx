import { useVoice } from "@/hooks/use-voice";
import { useAuth } from "@/hooks/use-auth";
import { Mic, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function GlobalMicButton() {
  const { user } = useAuth();
  const { settings, isListening, isProcessing, startListening, stopListening, setOpenAssistantWithVoice } = useVoice();

  if (!user || !settings?.voiceEnabled) return null;

  const handleClick = () => {
    if (isListening) {
      stopListening();
      return;
    }
    setOpenAssistantWithVoice(true);
  };

  return (
    <div
      className="fixed z-40"
      style={{ bottom: "5.5rem", right: "4.5rem" }}
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={handleClick}
        className={`h-10 w-10 rounded-full shadow-lg flex items-center justify-center transition-colors ${
          isListening
            ? "bg-red-500 hover:bg-red-600"
            : isProcessing
            ? "bg-primary/80"
            : "bg-muted hover:bg-muted/80 border"
        }`}
        title={isListening ? "Listening..." : isProcessing ? "Processing..." : "Voice input"}
        data-testid="global-mic-button"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary-foreground" />
        ) : (
          <>
            <Mic className={`h-4 w-4 ${isListening ? "text-white" : "text-foreground"}`} />
            {isListening && (
              <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-40" />
            )}
          </>
        )}
      </motion.button>
    </div>
  );
}
