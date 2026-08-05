import { Volume2, VolumeX, Pause, Play, RotateCcw, Loader2 } from "lucide-react";
import { VOICE_OPTIONS, type VoiceGuidance } from "@/hooks/useVoiceGuidance";

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
        {voice.loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : voice.enabled ? (
          <Volume2 className="w-3.5 h-3.5" />
        ) : (
          <VolumeX className="w-3.5 h-3.5" />
        )}
        {compact ? "Voice" : voice.enabled ? "Voice guidance on" : "Voice guidance off"}
      </button>

      {voice.enabled && (
        <>
          <select
            value={voice.voiceName}
            onChange={(e) => voice.setVoiceName(e.target.value)}
            aria-label="Narrator voice"
            title="Narrator voice"
            className="h-8 rounded-md border border-border bg-background px-2 font-mono text-[11px] text-muted-foreground hover:text-foreground hover:border-primary focus:outline-none focus:border-primary"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {compact ? v.label.split(" — ")[0] : v.label}
              </option>
            ))}
          </select>
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
