import { Volume2, VolumeX, Pause, Play, RotateCcw } from "lucide-react";
import type { VoiceGuidance } from "@/hooks/useVoiceGuidance";

export function VoiceGuidanceControls({
  voice,
  compact = false,
  className = "",
}: {
  voice: VoiceGuidance;
  compact?: boolean;
  className?: string;
}) {
  if (!voice.supported) {
    return (
      <p
        className={`text-[10px] font-mono uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 ${className}`}
      >
        <VolumeX className="w-3.5 h-3.5" /> Voice guidance unavailable in this browser
      </p>
    );
  }

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <button
        type="button"
        onClick={() => voice.setEnabled(!voice.enabled)}
        aria-pressed={voice.enabled}
        title="Read each step aloud as it becomes active"
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border font-mono text-[11px] uppercase tracking-wider transition-colors ${
          voice.enabled
            ? "border-accent/50 bg-accent/10 text-neon-cyan"
            : "border-border text-muted-foreground hover:text-foreground hover:border-primary"
        }`}
      >
        {voice.enabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
        {compact ? "Voice" : voice.enabled ? "Voice guidance on" : "Voice guidance off"}
      </button>

      {voice.enabled && (
        <>
          <button
            type="button"
            onClick={() => (voice.paused ? voice.resume() : voice.pause())}
            disabled={!voice.speaking && !voice.paused}
            title={voice.paused ? "Resume" : "Pause"}
            className="w-8 h-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary disabled:opacity-40"
          >
            {voice.paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={voice.replay}
            title="Replay this step"
            className="w-8 h-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
