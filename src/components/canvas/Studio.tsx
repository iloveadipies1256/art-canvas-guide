import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Pencil,
  Highlighter,
  SprayCan,
  Grid3x3,
  PenTool,
  Zap,
  Eraser,
  Square,
  Circle,
  Minus,
  MoveUpRight,
  Undo2,
  Redo2,
  Download,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { BrushKind, Layer, ShapeKind, Tool } from "./types";
import { applyBrushSettings, drawStrokeSegment } from "./brushes";

const CANVAS_W = 1400;
const CANVAS_H = 900;
const UNDO_LIMIT = 30;

const BRUSHES: { kind: BrushKind; label: string; icon: React.ReactNode }[] = [
  { kind: "pen", label: "Pen", icon: <Pencil className="w-4 h-4" /> },
  { kind: "marker", label: "Marker", icon: <Highlighter className="w-4 h-4" /> },
  { kind: "airbrush", label: "Airbrush", icon: <SprayCan className="w-4 h-4" /> },
  { kind: "pixel", label: "Pixel", icon: <Grid3x3 className="w-4 h-4" /> },
  { kind: "calligraphy", label: "Calligraphy", icon: <PenTool className="w-4 h-4" /> },
  { kind: "neon", label: "Neon glow", icon: <Zap className="w-4 h-4" /> },
  { kind: "eraser", label: "Eraser", icon: <Eraser className="w-4 h-4" /> },
];

const SHAPES: { kind: ShapeKind; label: string; icon: React.ReactNode }[] = [
  { kind: "rect", label: "Rectangle", icon: <Square className="w-4 h-4" /> },
  { kind: "ellipse", label: "Ellipse", icon: <Circle className="w-4 h-4" /> },
  { kind: "line", label: "Line", icon: <Minus className="w-4 h-4" /> },
  { kind: "arrow", label: "Arrow", icon: <MoveUpRight className="w-4 h-4" /> },
];

const SWATCHES = [
  "#F5F3FF", "#0B0B12", "#7C3AED", "#22D3EE", "#F472B6",
  "#F59E0B", "#22C55E", "#EF4444", "#3B82F6", "#A855F7",
];

function makeLayer(name: string): Layer {
  const c = document.createElement("canvas");
  c.width = CANVAS_W;
  c.height = CANVAS_H;
  return {
    id: crypto.randomUUID(),
    name,
    visible: true,
    opacity: 1,
    canvas: c,
  };
}

export interface StudioProps {
  title: string;
  onTitleChange?: (t: string) => void;
  initialImageUrl?: string | null;
  onSave?: (payload: {
    imageDataUrl: string;
    thumbDataUrl: string;
    width: number;
    height: number;
  }) => Promise<void>;
  onRequestCoach?: (imageDataUrl: string) => void;
  saveLabel?: string;
  saving?: boolean;
}

export function Studio(props: StudioProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [layers, setLayers] = useState<Layer[]>(() => [makeLayer("Layer 1")]);
  const [activeId, setActiveId] = useState<string>("");
  const [tool, setTool] = useState<Tool>({ kind: "brush", brush: "pen" });
  const [color, setColor] = useState("#F5F3FF");
  const [size, setSize] = useState(6);
  const [title, setTitle] = useState(props.title);
  const undoRef = useRef<Map<string, ImageData[]>>(new Map());
  const redoRef = useRef<Map<string, ImageData[]>>(new Map());
  const [, setUndoTick] = useState(0);
  const drawingRef = useRef<{
    from: { x: number; y: number } | null;
    shapeStart: { x: number; y: number } | null;
    shapeSnapshot: ImageData | null;
  }>({ from: null, shapeStart: null, shapeSnapshot: null });

  useEffect(() => setTitle(props.title), [props.title]);

  // ensure active id
  useEffect(() => {
    if (!activeId && layers[0]) setActiveId(layers[0].id);
  }, [layers, activeId]);

  // Load initial image into first layer once
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current || !props.initialImageUrl || layers.length === 0) return;
    loadedRef.current = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const ctx = layers[0].canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
      renderComposite();
    };
    img.src = props.initialImageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.initialImageUrl]);

  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeId) ?? layers[0],
    [layers, activeId],
  );

  const renderComposite = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    // paper background
    ctx.fillStyle = "#0B0B12";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const l of layers) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
  }, [layers]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  function pushUndo(layer: Layer) {
    const stack = undoRef.current.get(layer.id) ?? [];
    const ctx = layer.canvas.getContext("2d")!;
    stack.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
    if (stack.length > UNDO_LIMIT) stack.shift();
    undoRef.current.set(layer.id, stack);
    redoRef.current.set(layer.id, []);
    setUndoTick((t) => t + 1);
  }

  function undo() {
    if (!activeLayer) return;
    const stack = undoRef.current.get(activeLayer.id) ?? [];
    const prev = stack.pop();
    if (!prev) return;
    const ctx = activeLayer.canvas.getContext("2d")!;
    const redo = redoRef.current.get(activeLayer.id) ?? [];
    redo.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
    redoRef.current.set(activeLayer.id, redo);
    ctx.putImageData(prev, 0, 0);
    undoRef.current.set(activeLayer.id, stack);
    renderComposite();
    setUndoTick((t) => t + 1);
  }

  function redo() {
    if (!activeLayer) return;
    const redo = redoRef.current.get(activeLayer.id) ?? [];
    const next = redo.pop();
    if (!next) return;
    const ctx = activeLayer.canvas.getContext("2d")!;
    const stack = undoRef.current.get(activeLayer.id) ?? [];
    stack.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
    undoRef.current.set(activeLayer.id, stack);
    ctx.putImageData(next, 0, 0);
    redoRef.current.set(activeLayer.id, redo);
    renderComposite();
    setUndoTick((t) => t + 1);
  }

  function toCanvasPoint(e: React.PointerEvent) {
    const overlay = overlayRef.current!;
    const rect = overlay.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!activeLayer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pushUndo(activeLayer);
    const p = toCanvasPoint(e);
    const ctx = activeLayer.canvas.getContext("2d")!;
    if (tool.kind === "brush") {
      applyBrushSettings(ctx, tool.brush, color, size);
      drawStrokeSegment(ctx, tool.brush, color, size, p, { x: p.x + 0.01, y: p.y + 0.01 });
      drawingRef.current.from = p;
      renderComposite();
    } else {
      drawingRef.current.shapeStart = p;
      drawingRef.current.shapeSnapshot = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!activeLayer) return;
    const p = toCanvasPoint(e);
    const ctx = activeLayer.canvas.getContext("2d")!;
    if (tool.kind === "brush" && drawingRef.current.from) {
      applyBrushSettings(ctx, tool.brush, color, size);
      for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) {
        const rect = overlayRef.current!.getBoundingClientRect();
        const to = {
          x: ((ev.clientX - rect.left) / rect.width) * CANVAS_W,
          y: ((ev.clientY - rect.top) / rect.height) * CANVAS_H,
        };
        drawStrokeSegment(ctx, tool.brush, color, size, drawingRef.current.from, to);
        drawingRef.current.from = to;
      }
      renderComposite();
    } else if (tool.kind === "shape" && drawingRef.current.shapeStart) {
      ctx.putImageData(drawingRef.current.shapeSnapshot!, 0, 0);
      drawShape(ctx, tool.shape, drawingRef.current.shapeStart, p, color, size, e.shiftKey);
      renderComposite();
    }
  }

  function onPointerUp() {
    drawingRef.current.from = null;
    drawingRef.current.shapeStart = null;
    drawingRef.current.shapeSnapshot = null;
  }

  // keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      else if (e.key === "b") setTool({ kind: "brush", brush: "pen" });
      else if (e.key === "e") setTool({ kind: "brush", brush: "eraser" });
      else if (e.key === "n") setTool({ kind: "brush", brush: "neon" });
      else if (e.key === "[") setSize((s) => Math.max(1, s - 2));
      else if (e.key === "]") setSize((s) => Math.min(120, s + 2));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeLayer]);

  function flatten(): HTMLCanvasElement {
    const out = document.createElement("canvas");
    out.width = CANVAS_W;
    out.height = CANVAS_H;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#0B0B12";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    for (const l of layers) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l.canvas, 0, 0);
    }
    return out;
  }

  function exportPng() {
    const url = flatten().toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "neon-canvas"}.png`;
    a.click();
  }

  async function save() {
    if (!props.onSave) return;
    const full = flatten();
    const thumb = document.createElement("canvas");
    const scale = 512 / CANVAS_W;
    thumb.width = 512;
    thumb.height = Math.round(CANVAS_H * scale);
    thumb.getContext("2d")!.drawImage(full, 0, 0, thumb.width, thumb.height);
    try {
      await props.onSave({
        imageDataUrl: full.toDataURL("image/png"),
        thumbDataUrl: thumb.toDataURL("image/png"),
        width: CANVAS_W,
        height: CANVAS_H,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  function addLayer() {
    setLayers((ls) => [...ls, makeLayer(`Layer ${ls.length + 1}`)]);
  }

  function removeLayer(id: string) {
    setLayers((ls) => {
      if (ls.length === 1) return ls;
      const next = ls.filter((l) => l.id !== id);
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
  }

  function moveLayer(id: string, dir: -1 | 1) {
    setLayers((ls) => {
      const i = ls.findIndex((l) => l.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ls.length) return ls;
      const next = ls.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 h-12 border-b border-border/60 glass">
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); props.onTitleChange?.(e.target.value); }}
          className="bg-transparent text-sm font-display font-medium focus:outline-none border-b border-transparent focus:border-primary px-1 max-w-64"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-1 ml-2">
          <IconBtn onClick={undo} title="Undo (⌘Z)"><Undo2 className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={redo} title="Redo (⌘⇧Z)"><Redo2 className="w-4 h-4" /></IconBtn>
        </div>
        <div className="flex-1" />
        {props.onRequestCoach && (
          <button
            onClick={() => props.onRequestCoach!(flatten().toDataURL("image/png"))}
            className="px-3 py-1.5 rounded-md border border-accent/40 text-neon-cyan text-xs font-mono uppercase tracking-wider hover:bg-accent/10 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Ask coach
          </button>
        )}
        <IconBtn onClick={exportPng} title="Export PNG"><Download className="w-4 h-4" /></IconBtn>
        {props.onSave && (
          <button
            onClick={save}
            disabled={props.saving}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider glow-violet disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> {props.saveLabel ?? (props.saving ? "Saving…" : "Save")}
          </button>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left tools */}
        <aside className="w-14 border-r border-border/60 flex flex-col items-center py-3 gap-1 glass">
          {BRUSHES.map((b) => (
            <IconBtn
              key={b.kind}
              active={tool.kind === "brush" && tool.brush === b.kind}
              onClick={() => setTool({ kind: "brush", brush: b.kind })}
              title={b.label}
            >
              {b.icon}
            </IconBtn>
          ))}
          <div className="h-px w-6 bg-border my-2" />
          {SHAPES.map((s) => (
            <IconBtn
              key={s.kind}
              active={tool.kind === "shape" && tool.shape === s.kind}
              onClick={() => setTool({ kind: "shape", shape: s.kind })}
              title={s.label}
            >
              {s.icon}
            </IconBtn>
          ))}
        </aside>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative overflow-auto flex items-center justify-center p-6" style={{ background: "radial-gradient(ellipse at center, oklch(0.20 0.04 285), oklch(0.11 0.02 280))" }}>
          <div className="relative shadow-2xl glow-violet rounded-lg overflow-hidden" style={{ aspectRatio: `${CANVAS_W}/${CANVAS_H}`, width: "min(100%, 1200px)" }}>
            <canvas
              ref={overlayRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="block w-full h-full touch-none cursor-crosshair"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>
        </div>

        {/* Right panels */}
        <aside className="w-64 border-l border-border/60 flex flex-col glass overflow-hidden">
          <div className="p-3 border-b border-border/60">
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Color</label>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded-md bg-transparent border border-border cursor-pointer"
              />
              <div className="grid grid-cols-5 gap-1 flex-1">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="aspect-square rounded-md border border-border"
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
            <label className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-3 block">
              Size <span className="text-foreground ml-1">{size}px</span>
            </label>
            <input
              type="range"
              min={1}
              max={120}
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          <div className="p-3 flex items-center justify-between border-b border-border/60">
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Layers</span>
            <button onClick={addLayer} className="text-neon-violet hover:opacity-80" aria-label="Add layer">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-2 space-y-1">
            {layers.slice().reverse().map((l) => (
              <div
                key={l.id}
                className={`group rounded-md p-2 border ${activeId === l.id ? "border-primary/60 bg-primary/10" : "border-border/40 hover:bg-secondary/50"}`}
              >
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLayers((ls) => ls.map((x) => x.id === l.id ? { ...x, visible: !x.visible } : x))}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Toggle visibility"
                  >
                    {l.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => setActiveId(l.id)}
                    className="flex-1 text-left text-xs truncate font-medium"
                  >
                    {l.name}
                  </button>
                  <button onClick={() => moveLayer(l.id, 1)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" aria-label="Move up"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={() => moveLayer(l.id, -1)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground" aria-label="Move down"><ChevronDown className="w-3 h-3" /></button>
                  <button onClick={() => removeLayer(l.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" aria-label="Delete"><Trash2 className="w-3 h-3" /></button>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={l.opacity}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setLayers((ls) => ls.map((x) => x.id === l.id ? { ...x, opacity: v } : x));
                  }}
                  className="w-full accent-primary mt-1"
                />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function IconBtn({ children, active, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={`p-2 rounded-md transition-colors ${active ? "bg-primary text-primary-foreground glow-violet" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
    >
      {children}
    </button>
  );
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: ShapeKind,
  from: { x: number; y: number },
  to: { x: number; y: number },
  color: string,
  size: number,
  constrain: boolean,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalCompositeOperation = "source-over";
  let x2 = to.x;
  let y2 = to.y;
  if (constrain) {
    const dx = Math.abs(x2 - from.x);
    const dy = Math.abs(y2 - from.y);
    const m = Math.max(dx, dy);
    x2 = from.x + Math.sign(x2 - from.x) * m;
    y2 = from.y + Math.sign(y2 - from.y) * m;
  }
  if (shape === "rect") {
    ctx.strokeRect(from.x, from.y, x2 - from.x, y2 - from.y);
  } else if (shape === "ellipse") {
    const cx = (from.x + x2) / 2;
    const cy = (from.y + y2) / 2;
    const rx = Math.abs(x2 - from.x) / 2;
    const ry = Math.abs(y2 - from.y) / 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === "line") {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  } else if (shape === "arrow") {
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    const angle = Math.atan2(y2 - from.y, x2 - from.x);
    const head = Math.max(10, size * 2.5);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - head * Math.cos(angle - Math.PI / 6), y2 - head * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - head * Math.cos(angle + Math.PI / 6), y2 - head * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}