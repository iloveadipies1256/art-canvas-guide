import { useEffect, useState } from "react";
import { Download, Share } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppButton({ className = "" }: { className?: string }) {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setPromptEvent(null));

    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|Chrome/.test(ua);
    if (isIos && isSafari) setIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!promptEvent && !iosHint) return null;

  return (
    <>
      <button
        onClick={async () => {
          if (promptEvent) {
            await promptEvent.prompt();
            await promptEvent.userChoice;
            setPromptEvent(null);
          } else {
            setShowIosSheet(true);
          }
        }}
        className={`inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 font-mono text-xs uppercase tracking-wider hover:bg-secondary ${className}`}
      >
        <Download className="w-4 h-4" /> Install app
      </button>

      {showIosSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-4 sm:items-center"
          onClick={() => setShowIosSheet(false)}
        >
          <div className="glass max-w-sm rounded-2xl p-6 text-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold mb-2">Add Neon Canvas to your home screen</h2>
            <p className="text-muted-foreground">
              Tap the <Share className="inline w-4 h-4 align-text-bottom" /> Share button in Safari, then choose
              “Add to Home Screen”.
            </p>
            <button
              onClick={() => setShowIosSheet(false)}
              className="mt-5 w-full rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-wider text-primary-foreground"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
