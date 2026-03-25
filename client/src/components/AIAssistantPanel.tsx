import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, X, Minus, MoreVertical, Send, Mic, MicOff, Bot, User, Check, AlertTriangle, Loader2, Volume2, VolumeX, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { SuggestionChips, ActionResultCard, ErrorCard } from "./AssistantMessageCards";
import { apiRequest } from "@/lib/queryClient";
import { useVoice } from "@/hooks/use-voice";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speakingMessageIdx, setSpeakingMessageIdx] = useState<number | null>(null);
  const [silenceCountdown, setSilenceCountdown] = useState<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceAudioCtxRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, navigate] = useLocation();
  const sessionId = useRef(getOrCreateSessionId());

  const voice = useVoice();

  useEffect(() => {
    if (voice.openAssistantWithVoice && !isOpen) {
      setIsOpen(true);
      voice.setOpenAssistantWithVoice(false);
      setTimeout(() => {
        voice.startListening((text) => {
          if (text.trim()) {
            sendMessage(text);
          }
        });
      }, 500);
    }
  }, [voice.openAssistantWithVoice]);

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

      setMessages((prev) => {
        const newMessages = [...prev, assistantMsg];
        if (voice.settings?.voiceEnabled && voice.sessionSpeakerEnabled && data.response && data.type !== "error") {
          setTimeout(() => {
            setSpeakingMessageIdx(newMessages.length - 1);
            voice.speakText(data.response);
          }, 200);
        }
        return newMessages;
      });

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
  }, [isLoading, messages, navigate, voice.settings?.voiceEnabled, voice.sessionSpeakerEnabled]);

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

  const startRecording = useCallback(async () => {
    if (voice.settings?.voiceEnabled) {
      voice.startListening((text) => {
        if (text.trim()) {
          setInput(text);
          setTimeout(() => sendMessage(text), 100);
        }
      });
      setIsRecording(true);
      return;
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error("Microphone access denied:", err);
      setMessages((prev) => [...prev, { role: "assistant", content: "Microphone access was denied. Please allow microphone permissions and try again.", type: "error" }]);
      return;
    }

    try {
      audioChunksRef.current = [];

      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (!MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "";
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      const activeMime = recorder.mimeType;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream!.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: activeMime });
        if (audioBlob.size === 0) return;

        setIsTranscribing(true);
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.split(",")[1]);
            };
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          let format: string = "webm";
          if (activeMime.includes("mp4") || activeMime.includes("m4a")) format = "mp3";
          else if (activeMime.includes("wav")) format = "wav";

          const res = await apiRequest("POST", "/api/assistant/transcribe", { audio: base64, format });
          const data = await res.json();

          if (data.transcript && data.transcript.trim()) {
            setInput((prev) => (prev ? prev + " " + data.transcript.trim() : data.transcript.trim()));
            setTimeout(() => inputRef.current?.focus(), 100);
          } else if (data.error) {
            setMessages((prev) => [...prev, { role: "assistant", content: `Transcription failed: ${data.error}`, type: "error" }]);
          }
        } catch (err) {
          console.error("Transcription failed:", err);
          setMessages((prev) => [...prev, { role: "assistant", content: "Failed to transcribe audio. Please try again or type your message.", type: "error" }]);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setIsRecording(true);

      // ── Silence detection (auto-stop after ~2s of quiet) ──
      const clearSilenceDetection = () => {
        if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
        if (maxDurationTimerRef.current) { clearTimeout(maxDurationTimerRef.current); maxDurationTimerRef.current = null; }
        if (silenceAudioCtxRef.current) { silenceAudioCtxRef.current.close().catch(() => {}); silenceAudioCtxRef.current = null; }
        setSilenceCountdown(null);
      };

      const doStop = () => {
        clearSilenceDetection();
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
          mediaRecorderRef.current = null;
        }
        setIsRecording(false);
      };

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);
        silenceAudioCtxRef.current = audioCtx;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const SILENCE_THRESHOLD = 8;
        const SILENCE_FRAMES_NEEDED = 20; // 20 × 100ms = 2s
        const COUNTDOWN_START_FRAME = 10; // show countdown after 1s of silence
        let silentFrames = 0;

        silenceIntervalRef.current = setInterval(() => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
            clearSilenceDetection();
            return;
          }
          analyser.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
          if (avg < SILENCE_THRESHOLD) {
            silentFrames++;
            if (silentFrames >= COUNTDOWN_START_FRAME) {
              const remaining = Math.ceil((SILENCE_FRAMES_NEEDED - silentFrames) / 10);
              setSilenceCountdown(Math.max(remaining, 1));
            }
            if (silentFrames >= SILENCE_FRAMES_NEEDED) {
              doStop();
            }
          } else {
            silentFrames = 0;
            setSilenceCountdown(null);
          }
        }, 100);
      } catch {
        // If AudioContext isn't available, silence detection is skipped — hard cap still applies
      }

      // ── 45-second hard cap ──
      maxDurationTimerRef.current = setTimeout(() => {
        doStop();
      }, 45000);

    } catch (err) {
      console.error("MediaRecorder setup failed:", err);
      stream.getTracks().forEach((t) => t.stop());
      setMessages((prev) => [...prev, { role: "assistant", content: "Voice recording is not supported in this browser.", type: "error" }]);
    }
  }, [voice.settings?.voiceEnabled]);

  const clearSilenceDetectionRefs = useCallback(() => {
    if (silenceIntervalRef.current) { clearInterval(silenceIntervalRef.current); silenceIntervalRef.current = null; }
    if (maxDurationTimerRef.current) { clearTimeout(maxDurationTimerRef.current); maxDurationTimerRef.current = null; }
    if (silenceAudioCtxRef.current) { silenceAudioCtxRef.current.close().catch(() => {}); silenceAudioCtxRef.current = null; }
    setSilenceCountdown(null);
  }, []);

  const stopRecording = useCallback(() => {
    clearSilenceDetectionRefs();
    if (voice.settings?.voiceEnabled && voice.isListening) {
      voice.stopListening();
      setIsRecording(false);
      return;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, [voice.settings?.voiceEnabled, voice.isListening, clearSilenceDetectionRefs]);

  const toggleRecording = useCallback(() => {
    if (isRecording || voice.isListening) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, voice.isListening, startRecording, stopRecording]);

  useEffect(() => {
    if (!isOpen && isRecording) {
      stopRecording();
    }
  }, [isOpen, isRecording, stopRecording]);

  useEffect(() => {
    return () => {
      if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current);
      if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
      if (silenceAudioCtxRef.current) silenceAudioCtxRef.current.close().catch(() => {});
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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

  const handleSpeakMessage = (msgContent: string, msgIndex: number) => {
    if (voice.isSpeaking && speakingMessageIdx === msgIndex) {
      voice.stopSpeaking();
      setSpeakingMessageIdx(null);
      return;
    }
    voice.stopSpeaking();
    setSpeakingMessageIdx(msgIndex);
    voice.speakText(msgContent);
  };

  useEffect(() => {
    if (!voice.isSpeaking) {
      setSpeakingMessageIdx(null);
    }
  }, [voice.isSpeaking]);

  const activeListening = isRecording || voice.isListening;

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
            {voice.settings?.voiceEnabled && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-7 w-7 ${voice.sessionMicEnabled || voice.isListening ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                      onClick={voice.toggleSessionMic}
                      data-testid="assistant-voice-mic-toggle"
                    >
                      {voice.sessionMicEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Voice input {voice.sessionMicEnabled ? "on" : "off"}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-7 w-7 ${voice.sessionSpeakerEnabled ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                      onClick={voice.toggleSessionSpeaker}
                      data-testid="assistant-voice-speaker-toggle"
                    >
                      {voice.sessionSpeakerEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Auto-speak {voice.sessionSpeakerEnabled ? "on" : "off"}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
                  {msg.role === "assistant" && msg.type !== "error" && voice.settings?.voiceEnabled && (
                    <button
                      onClick={() => handleSpeakMessage(msg.content, i)}
                      className={`flex items-center gap-1 text-xs transition-colors ${
                        speakingMessageIdx === i && voice.isSpeaking
                          ? "text-primary"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={speakingMessageIdx === i && voice.isSpeaking ? "Stop speaking" : "Read aloud"}
                      data-testid={`speak-message-${i}`}
                    >
                      {speakingMessageIdx === i && voice.isSpeaking ? (
                        <>
                          <SoundWaveIcon />
                          <span>Speaking...</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3 w-3" />
                          <span>Listen</span>
                        </>
                      )}
                    </button>
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
          {(activeListening || voice.isListening) && voice.settings?.voiceEnabled && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <VoiceWaveform />
              <span className="text-xs text-red-600 dark:text-red-400 font-medium">Listening...</span>
              {voice.liveTranscript && (
                <span className="text-xs text-muted-foreground italic truncate flex-1">{voice.liveTranscript}</span>
              )}
            </div>
          )}
          {voice.isSpeaking && voice.settings?.voiceEnabled && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <SoundWaveIcon />
              <span className="text-xs text-primary font-medium">Speaking...</span>
              <button
                onClick={() => voice.stopSpeaking()}
                className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                data-testid="stop-speaking-btn"
              >
                <Square className="h-3 w-3" />
              </button>
            </div>
          )}
          {!voice.settings?.voiceEnabled && isRecording && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              {silenceCountdown !== null ? (
                <span className="text-xs text-orange-500 dark:text-orange-400 font-medium">
                  Finishing in {silenceCountdown}s...
                </span>
              ) : (
                <span className="text-xs text-red-600 dark:text-red-400 font-medium">Recording... tap mic to stop</span>
              )}
            </div>
          )}
          {isTranscribing && (
            <div className="flex items-center gap-2 mb-2 px-1">
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground">Transcribing audio...</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={voice.isListening && voice.liveTranscript ? voice.liveTranscript : input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={activeListening ? "Listening..." : isTranscribing ? "Transcribing..." : "Ask me anything..."}
                className={`w-full bg-muted rounded-lg pl-3 pr-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 ${
                  voice.isListening && voice.liveTranscript ? "italic text-muted-foreground" : ""
                }`}
                disabled={isLoading || isTranscribing || voice.isListening}
                data-testid="assistant-input"
              />
              <button
                type="button"
                onClick={toggleRecording}
                disabled={isLoading || isTranscribing}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full transition-colors ${
                  activeListening
                    ? "text-red-500 hover:text-red-600"
                    : "text-muted-foreground hover:text-primary"
                } ${isLoading || isTranscribing ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
                title={activeListening ? "Stop recording" : "Start voice input"}
                data-testid="assistant-mic-btn"
              >
                {activeListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
            </div>
            <Button
              size="icon"
              className="h-9 w-9 rounded-lg flex-shrink-0"
              disabled={!input.trim() || isLoading || activeListening}
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

function VoiceWaveform() {
  return (
    <div className="flex items-center gap-0.5 h-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <motion.div
          key={i}
          className="w-0.5 bg-red-500 rounded-full"
          animate={{
            height: [4, 12, 6, 14, 4],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function SoundWaveIcon() {
  return (
    <div className="flex items-center gap-0.5 h-3">
      {[1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="w-0.5 bg-primary rounded-full"
          animate={{
            height: [3, 8, 3],
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
