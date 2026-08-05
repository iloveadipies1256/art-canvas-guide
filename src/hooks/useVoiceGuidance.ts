import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "neon-canvas:voice-guidance";
const VOICE_KEY = "neon-canvas:voice-name";

/** Natural-sounding narrator voices available on the AI speech endpoint. */
export const VOICE_OPTIONS = [
  { id: "nova", label: "Nova — bright & friendly" },
  { id: "shimmer", label: "Shimmer — warm & calm" },
  { id: "alloy", label: "Alloy — neutral" },
  { id: "onyx", label: "Onyx — deep & steady" },
] as const;

/** Cache generated audio per (voice, text) so repeats are instant and free. */
const audioCache = new Map<string, string>();

export function useVoiceGuidance() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voiceName, setVoiceNameState] = useState<string>("nova");
  const lastTextRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const requestIdRef = useRef(0);
  const voiceRef = useRef("nova");

  useEffect(() => {
    setSupported(typeof window !== "undefined" && typeof window.Audio === "function");
    try {
      setEnabledState(window.localStorage.getItem(STORAGE_KEY) === "on");
      const v = window.localStorage.getItem(VOICE_KEY);
      if (v) {
        setVoiceNameState(v);
        voiceRef.current = v;
      }
    } catch {
      /* storage blocked - defaults */
    }
  }, []);

  const hardStop = useCallback(() => {
    requestIdRef.current += 1;
    const el = audioRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const stop = useCallback(() => {
    hardStop();
    setSpeaking(false);
    setPaused(false);
    setLoading(false);
  }, [hardStop]);

  /** Last-resort fallback if the AI voice endpoint is unreachable. */
  const speakFallback = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.05;
    u.onstart = () => { setSpeaking(true); setPaused(false); };
    u.onend = () => { setSpeaking(false); setPaused(false); };
    u.onerror = () => { setSpeaking(false); setPaused(false); };
    window.speechSynthesis.speak(u);
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (!text || !text.trim()) return;
      if (typeof window === "undefined") return;
      lastTextRef.current = text;
      hardStop();
      const id = requestIdRef.current;
      const voice = voiceRef.current;
      const cacheKey = `${voice}::${text}`;

      const play = (src: string) => {
        if (requestIdRef.current !== id) return;
        const el = audioRef.current ?? new Audio();
        audioRef.current = el;
        el.src = src;
        el.onplay = () => { setSpeaking(true); setPaused(false); };
        el.onended = () => { setSpeaking(false); setPaused(false); };
        el.onerror = () => { setSpeaking(false); setPaused(false); };
        void el.play().catch(() => { setSpeaking(false); setPaused(false); });
      };

      const cached = audioCache.get(cacheKey);
      if (cached) { play(cached); return; }

      setLoading(true);
      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        audioCache.set(cacheKey, url);
        if (requestIdRef.current !== id) return;
        play(url);
      } catch {
        if (requestIdRef.current === id) speakFallback(text);
      } finally {
        if (requestIdRef.current === id) setLoading(false);
      }
    },
    [hardStop, speakFallback],
  );

  const pause = useCallback(() => {
    audioRef.current?.pause();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    void audioRef.current?.play().catch(() => {});
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  const replay = useCallback(() => {
    if (lastTextRef.current) void speak(lastTextRef.current);
  }, [speak]);

  const setVoiceName = useCallback(
    (next: string) => {
      voiceRef.current = next;
      setVoiceNameState(next);
      try {
        window.localStorage.setItem(VOICE_KEY, next);
      } catch {
        /* ignore */
      }
      const last = lastTextRef.current;
      stop();
      if (last) void speak(last);
    },
    [speak, stop],
  );

  const setEnabled = useCallback(
    (next: boolean) => {
      setEnabledState(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
      } catch {
        /* ignore */
      }
      if (!next) stop();
    },
    [stop],
  );

  useEffect(() => () => { hardStop(); }, [hardStop]);

  return {
    supported, enabled, setEnabled, speaking, paused, loading,
    voiceName, setVoiceName, speak, stop, pause, resume, replay,
  };
}

export type VoiceGuidance = ReturnType<typeof useVoiceGuidance>;

/** Speaks `text` whenever it changes, while voice guidance is enabled. */
export function useAutoSpeakStep(voice: VoiceGuidance, text: string | null | undefined) {
  const { supported, enabled, speak, stop } = voice;
  useEffect(() => {
    if (!supported || !enabled) return;
    if (!text) {
      stop();
      return;
    }
    void speak(text);
  }, [text, enabled, supported, speak, stop]);
}
