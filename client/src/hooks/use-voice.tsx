import { createContext, useContext, useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { apiRequest } from "@/lib/queryClient";

interface VoiceSettings {
  voiceEnabled: boolean;
  voiceAutoSpeak: boolean;
  voiceSelection: string;
}

interface VoiceContextType {
  settings: VoiceSettings | null;
  isListening: boolean;
  isSpeaking: boolean;
  isProcessing: boolean;
  liveTranscript: string;
  sessionMicEnabled: boolean;
  sessionSpeakerEnabled: boolean;
  toggleSessionMic: () => void;
  toggleSessionSpeaker: () => void;
  startListening: (onResult: (text: string) => void) => void;
  stopListening: () => void;
  speakText: (text: string, voice?: string) => void;
  stopSpeaking: () => void;
  openAssistantWithVoice: boolean;
  setOpenAssistantWithVoice: (v: boolean) => void;
}

const VoiceContext = createContext<VoiceContextType | null>(null);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [sessionMicEnabled, setSessionMicEnabled] = useState(false);
  const [sessionSpeakerEnabled, setSessionSpeakerEnabled] = useState(false);
  const [openAssistantWithVoice, setOpenAssistantWithVoice] = useState(false);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const onResultRef = useRef<((text: string) => void) | null>(null);

  const { data: settings } = useQuery<VoiceSettings>({
    queryKey: ["/api/users/voice-settings"],
    queryFn: async () => {
      const res = await fetch("/api/users/voice-settings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch voice settings");
      return res.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (settings) {
      setSessionSpeakerEnabled(settings.voiceAutoSpeak);
    }
  }, [settings?.voiceAutoSpeak]);

  const startListening = useCallback((onResult: (text: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    onResultRef.current = onResult;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      setLiveTranscript("");
    };

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) {
        setLiveTranscript(final);
      } else {
        setLiveTranscript(interim);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      const transcript = liveTranscriptRef.current;
      if (transcript && onResultRef.current) {
        onResultRef.current(transcript);
      }
      setLiveTranscript("");
    };

    recognition.onerror = (event: any) => {
      console.error("[voice] Recognition error:", event.error);
      setIsListening(false);
      setLiveTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const liveTranscriptRef = useRef(liveTranscript);
  useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
  }, [liveTranscript]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const speakText = useCallback(async (text: string, voice?: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsSpeaking(true);
    try {
      const res = await fetch("/api/ai/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
        credentials: "include",
      });

      if (!res.ok) throw new Error("TTS failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      console.error("[voice] TTS playback error:", err);
      setIsSpeaking(false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const toggleSessionMic = useCallback(() => {
    setSessionMicEnabled(prev => !prev);
  }, []);

  const toggleSessionSpeaker = useCallback(() => {
    setSessionSpeakerEnabled(prev => !prev);
  }, []);

  return (
    <VoiceContext.Provider value={{
      settings: settings ?? null,
      isListening,
      isSpeaking,
      isProcessing,
      liveTranscript,
      sessionMicEnabled,
      sessionSpeakerEnabled,
      toggleSessionMic,
      toggleSessionSpeaker,
      startListening,
      stopListening,
      speakText,
      stopSpeaking,
      openAssistantWithVoice,
      setOpenAssistantWithVoice,
    }}>
      {children}
    </VoiceContext.Provider>
  );
}

export function useVoice() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoice must be used within VoiceProvider");
  return ctx;
}
