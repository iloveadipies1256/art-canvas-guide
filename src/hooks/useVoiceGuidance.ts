import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "neon-canvas:voice-guidance";

export function useVoiceGuidance() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabledState] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const lastTextRef = useRef<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof window.SpeechSynthesisUtterance === "function";
    setSupported(ok);
    if (!ok) return;
    try {
      setEnabledState(window.localStorage.getItem(STORAGE_KEY) === "on");
    } catch {
      /* storage blocked - default off */
    }
  }, []);

  const stop = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!text || !text.trim()) return;
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    lastTextRef.current = text;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.98;
    u.pitch = 1;
    u.onstart = () => { setSpeaking(true); setPaused(false); };
    u.onend = () => { setSpeaking(false); setPaused(false); };
    u.onerror = () => { setSpeaking(false); setPaused(false); };
    window.speechSynthesis.speak(u);
  }, []);

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  const replay = useCallback(() => {
    if (lastTextRef.current) speak(lastTextRef.current);
  }, [speak]);

  const setEnabled = useCallback((next: boolean) => {
    setEnabledState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (!next) {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
      setSpeaking(false);
      setPaused(false);
    }
  }, []);

  useEffect(
    () => () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    },
    [],
  );

  return { supported, enabled, setEnabled, speaking, paused, speak, stop, pause, resume, replay };
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
    speak(text);
  }, [text, enabled, supported, speak, stop]);
}
