import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function voiceChat(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav",
  outputFormat: "wav" | "mp3" = "mp3"
): Promise<{ transcript: string; audioResponse: Buffer }> {
  const audioBase64 = audioBuffer.toString("base64");
  const response = await openai.chat.completions.create({
    model: "gpt-audio-mini",
    modalities: ["text", "audio"],
    audio: { voice, format: outputFormat },
    messages: [{
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
      ],
    }],
  });
  const message = response.choices[0]?.message as any;
  const transcript = message?.audio?.transcript || message?.content || "";
  const audioData = message?.audio?.data ?? "";
  return {
    transcript,
    audioResponse: Buffer.from(audioData, "base64"),
  };
}

export async function voiceChatStream(
  audioBuffer: Buffer,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  inputFormat: "wav" | "mp3" = "wav"
): Promise<AsyncIterable<{ type: "transcript" | "audio"; data: string }>> {
  const audioBase64 = audioBuffer.toString("base64");
  const stream = await openai.chat.completions.create({
    model: "gpt-audio-mini",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [{
      role: "user",
      content: [
        { type: "input_audio", input_audio: { data: audioBase64, format: inputFormat } },
      ],
    }],
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      if (!delta) continue;
      if (delta?.audio?.transcript) {
        yield { type: "transcript", data: delta.audio.transcript };
      }
      if (delta?.audio?.data) {
        yield { type: "audio", data: delta.audio.data };
      }
    }
  })();
}

export async function textToSpeech(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy",
  format: "wav" | "mp3" | "flac" | "opus" | "pcm16" = "wav"
): Promise<Buffer> {
  const response = await openai.chat.completions.create({
    model: "gpt-audio-mini",
    modalities: ["text", "audio"],
    audio: { voice, format },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
  });
  const audioData = (response.choices[0]?.message as any)?.audio?.data ?? "";
  return Buffer.from(audioData, "base64");
}

export async function textToSpeechStream(
  text: string,
  voice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer" = "alloy"
): Promise<AsyncIterable<string>> {
  const stream = await openai.chat.completions.create({
    model: "gpt-audio-mini",
    modalities: ["text", "audio"],
    audio: { voice, format: "pcm16" },
    messages: [
      { role: "system", content: "You are an assistant that performs text-to-speech." },
      { role: "user", content: `Repeat the following text verbatim: ${text}` },
    ],
    stream: true,
  });

  return (async function* () {
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta as any;
      if (!delta) continue;
      if (delta?.audio?.data) {
        yield delta.audio.data;
      }
    }
  })();
}

export async function speechToText(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<string> {
  const file = await toFile(audioBuffer, `audio.${format}`);
  const response = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
  });
  return response.text;
}

export async function speechToTextStream(
  audioBuffer: Buffer,
  format: "wav" | "mp3" | "webm" = "wav"
): Promise<AsyncIterable<string>> {
  const file = await toFile(audioBuffer, `audio.${format}`);
  const stream = await openai.audio.transcriptions.create({
    file,
    model: "gpt-4o-mini-transcribe",
    stream: true,
  });

  return (async function* () {
    for await (const event of stream) {
      if (event.type === "transcript.text.delta") {
        yield event.delta;
      }
    }
  })();
}

export class SentenceParser {
  private buffer = "";
  private seq = 0;
  private segmenter: Intl.Segmenter;

  constructor(locale = "en") {
    this.segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
  }

  feed(token: string): Array<{ seq: number; text: string }> {
    this.buffer += token;
    const sentences: Array<{ seq: number; text: string }> = [];

    const segments = Array.from(this.segmenter.segment(this.buffer));

    for (let i = 0; i < segments.length - 1; i++) {
      const text = segments[i].segment.trim();
      if (text) {
        sentences.push({ seq: this.seq++, text });
      }
    }

    if (segments.length > 0) {
      this.buffer = segments[segments.length - 1].segment;
    }

    return sentences;
  }

  flush(): { seq: number; text: string } | null {
    const text = this.buffer.trim();
    this.buffer = "";
    return text ? { seq: this.seq++, text } : null;
  }

  reset() {
    this.buffer = "";
    this.seq = 0;
  }
}

export interface VoiceChatStreamEvent {
  type: "user_transcript" | "sentence" | "audio" | "transcript" | "done" | "error";
  seq?: number;
  data?: string;
  text?: string;
  error?: string;
}

interface TTSStream {
  seq: number;
  iterator: AsyncIterator<string>;
  done: boolean;
}

export async function* voiceChatWithTextModel(
  audioBuffer: Buffer,
  options: {
    voice?: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
    inputFormat?: "wav" | "mp3";
    systemPrompt?: string;
    chatHistory?: Array<{ role: "user" | "assistant"; content: string }>;
    textModel?: string;
    locale?: string;
  } = {}
): AsyncGenerator<VoiceChatStreamEvent> {
  const {
    voice = "alloy",
    inputFormat = "wav",
    systemPrompt = "You are a helpful assistant.",
    chatHistory = [],
    textModel = "gpt-4o-mini",
    locale = "en",
  } = options;

  const userText = await speechToText(audioBuffer, inputFormat);
  yield { type: "user_transcript", data: userText };

  const messages = [
    { role: "system" as const, content: systemPrompt },
    ...chatHistory,
    { role: "user" as const, content: userText },
  ];

  const textStream = await openai.chat.completions.create({
    model: textModel,
    messages,
    stream: true,
  });

  const parser = new SentenceParser(locale);
  const activeStreams: TTSStream[] = [];
  let nextSeqToYield = 0;
  let fullTranscript = "";

  const startTTS = async (sentence: { seq: number; text: string }) => {
    const stream = await textToSpeechStream(sentence.text, voice);
    activeStreams.push({
      seq: sentence.seq,
      iterator: stream[Symbol.asyncIterator](),
      done: false,
    });
  };

  async function* drainAudioInOrder(): AsyncGenerator<VoiceChatStreamEvent> {
    while (activeStreams.length > 0) {
      const currentStream = activeStreams.find((s) => s.seq === nextSeqToYield);

      if (!currentStream) {
        return;
      }

      if (currentStream.done) {
        activeStreams.splice(activeStreams.indexOf(currentStream), 1);
        nextSeqToYield++;
        continue;
      }

      const { value, done } = await currentStream.iterator.next();

      if (done) {
        currentStream.done = true;
        activeStreams.splice(activeStreams.indexOf(currentStream), 1);
        nextSeqToYield++;
      } else {
        yield { type: "audio", seq: currentStream.seq, data: value };
      }
    }
  }

  for await (const chunk of textStream) {
    const token = chunk.choices[0]?.delta?.content || "";
    if (!token) continue;

    fullTranscript += token;

    const sentences = parser.feed(token);
    for (const sentence of sentences) {
      yield { type: "sentence", seq: sentence.seq, text: sentence.text };
      await startTTS(sentence);
    }

    for await (const event of drainAudioInOrder()) {
      yield event;
    }
  }

  const finalSentence = parser.flush();
  if (finalSentence) {
    yield { type: "sentence", seq: finalSentence.seq, text: finalSentence.text };
    await startTTS(finalSentence);
  }

  while (activeStreams.length > 0) {
    for await (const event of drainAudioInOrder()) {
      yield event;
    }
    if (activeStreams.length > 0 && !activeStreams.find((s) => s.seq === nextSeqToYield)) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  yield { type: "transcript", data: fullTranscript };
  yield { type: "done" };
}
