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
  PanelLeft,
  PanelRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers as LayersIcon,
  Radar,
} from "lucide-react";
import type { BrushKind, Layer, ShapeKind, Tool } from "./types";
import { applyBrushSettings, drawStrokeSegment } from "./brushes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CANVAS_W = 1400;
const CANVAS_H = 900;
const UNDO_LIMIT = 60;
const AUTOSAVE_MS = 30_000;
const DRAFT_PREFIX = "neon-canvas:draft:";

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
  return { id: crypto.randomUUID(), name, visible: true, opacity: 1, canvas: c };
}

type HistoryEntry = { layerId: string; before: ImageData; after: ImageData };

interface DraftLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  dataUrl: string;
}
interface Draft {
  title: string;
  canvasBg: string;
  layers: DraftLayer[];
  updatedAt: number;
}

function draftKey(artworkId: string | undefined) {
  return DRAFT_PREFIX + (artworkId ?? "studio");
}

export interface StudioProps {
  title: string;
  onTitleChange?: (t: string) => void;
  initialImageUrl?: string | null;
  artworkId?: string;
  /** Reference image mounted under the artwork as a dimmable tracing underlay. */
  ghostImageUrl?: string | null;
  /** 0-1 starting opacity for the ghost layer (lower as skill rises). */
  ghostDefaultOpacity?: number;
  onGhostClear?: () => void;
  /** Mid-drawing coaching: receives a flattened snapshot of the work in progress. */
  onLiveCheck?: (imageDataUrl: string) => void;
  liveChecking?: boolean;
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
  const [canvasBg, setCanvasBg] = useState("#0B0B12");
  const [ghostOpacity, setGhostOpacity] = useState(props.ghostDefaultOpacity ?? 0.35);
  const [ghostVisible, setGhostVisible] = useState(true);
  const ghostImgRef = useRef<HTMLImageElement | null>(null);
  const [title, setTitle] = useState(props.title);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [lastPressure, setLastPressure] = useState(0.5);
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [pendingDeleteLayerId, setPendingDeleteLayerId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [draftAvailable, setDraftAvailable] = useState<Draft | null>(null);
  const [, setTick] = useState(0);

  const historyRef = useRef<{
    undo: HistoryEntry[];
    redo: HistoryEntry[];
    capturing: { layerId: string; before: ImageData } | null;
  }>({ undo: [], redo: [], capturing: null });

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef<{
    startDist: number;
    startZoom: number;
    startMid: { x: number; y: number };
    startPan: { x: number; y: number };
  } | null>(null);

  const drawingRef = useRef<{
    from: { x: number; y: number } | null;
    shapeStart: { x: number; y: number } | null;
    shapeSnapshot: ImageData | null;
    activePointerId: number | null;
  }>({ from: null, shapeStart: null, shapeSnapshot: null, activePointerId: null });

  useEffect(() => setTitle(props.title), [props.title]);

  useEffect(() => {
    if (!activeId && layers[0]) setActiveId(layers[0].id);
  }, [layers, activeId]);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey(props.artworkId));
      if (!raw) return;
      const d = JSON.parse(raw) as Draft;
      if (d && Array.isArray(d.layers) && d.layers.length) setDraftAvailable(d);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeId) ?? layers[0],
    [layers, activeId],
  );

  const renderComposite = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = canvasBg;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const ghost = ghostImgRef.current;
    if (ghost && ghostVisible && ghost.complete && ghost.naturalWidth > 0) {
      // Contain the reference inside the canvas so proportions stay honest.
      const scale = Math.min(CANVAS_W / ghost.naturalWidth, CANVAS_H / ghost.naturalHeight);
      const w = ghost.naturalWidth * scale;
      const h = ghost.naturalHeight * scale;
      ctx.globalAlpha = ghostOpacity;
      ctx.drawImage(ghost, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
      ctx.globalAlpha = 1;
    }
    for (const l of layers) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity;
      ctx.drawImage(l.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
  }, [layers, canvasBg, ghostOpacity, ghostVisible]);

  // Load / swap the ghost reference image.
  useEffect(() => {
    if (!props.ghostImageUrl) {
      ghostImgRef.current = null;
      renderComposite();
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ghostImgRef.current = img;
      setGhostVisible(true);
      renderComposite();
    };
    img.src = props.ghostImageUrl;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.ghostImageUrl]);

  useEffect(() => {
    if (props.ghostDefaultOpacity !== undefined) setGhostOpacity(props.ghostDefaultOpacity);
  }, [props.ghostDefaultOpacity]);

  useEffect(() => {
    renderComposite();
  }, [renderComposite]);

  function beginHistoryCapture(layer: Layer) {
    const ctx = layer.canvas.getContext("2d")!;
    historyRef.current.capturing = {
      layerId: layer.id,
      before: ctx.getImageData(0, 0, CANVAS_W, CANVAS_H),
    };
  }

  function commitHistoryCapture(layer: Layer) {
    const cap = historyRef.current.capturing;
    historyRef.current.capturing = null;
    if (!cap || cap.layerId !== layer.id) return;
    const ctx = layer.canvas.getContext("2d")!;
    const after = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    historyRef.current.undo.push({ layerId: layer.id, before: cap.before, after });
    if (historyRef.current.undo.length > UNDO_LIMIT) historyRef.current.undo.shift();
    historyRef.current.redo = [];
    setTick((t) => t + 1);
    setDirty(true);
  }

  function undo() {
    const entry = historyRef.current.undo.pop();
    if (!entry) return;
    const layer = layers.find((l) => l.id === entry.layerId);
    if (!layer) return;
    layer.canvas.getContext("2d")!.putImageData(entry.before, 0, 0);
    historyRef.current.redo.push(entry);
    if (activeId !== entry.layerId) setActiveId(entry.layerId);
    renderComposite();
    setTick((t) => t + 1);
    setDirty(true);
  }

  function redo() {
    const entry = historyRef.current.redo.pop();
    if (!entry) return;
    const layer = layers.find((l) => l.id === entry.layerId);
    if (!layer) return;
    layer.canvas.getContext("2d")!.putImageData(entry.after, 0, 0);
    historyRef.current.undo.push(entry);
    if (activeId !== entry.layerId) setActiveId(entry.layerId);
    renderComposite();
    setTick((t) => t + 1);
    setDirty(true);
  }

  function toCanvasPoint(clientX: number, clientY: number) {
    const overlay = overlayRef.current!;
    const rect = overlay.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_W,
      y: ((clientY - rect.top) / rect.height) * CANVAS_H,
    };
  }

  function onPointerDown(e: React.PointerEvent) {
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size >= 2) {
      // Cancel any in-flight stroke and begin a pinch/pan gesture.
      historyRef.current.capturing = null;
      drawingRef.current.from = null;
      drawingRef.current.shapeStart = null;
      drawingRef.current.shapeSnapshot = null;
      drawingRef.current.activePointerId = null;
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy) || 1;
      gestureRef.current = {
        startDist: dist,
        startZoom: zoom,
        startMid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
        startPan: { ...pan },
      };
      return;
    }
    if (!activeLayer) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current.activePointerId = e.pointerId;
    beginHistoryCapture(activeLayer);
    const p = toCanvasPoint(e.clientX, e.clientY);
    if (e.pressure) setLastPressure(e.pressure);
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
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pointersRef.current.size >= 2 && gestureRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy) || 1;
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const newZoom = Math.max(
        0.25,
        Math.min(6, gestureRef.current.startZoom * (dist / gestureRef.current.startDist)),
      );
      const dxMid = mid.x - gestureRef.current.startMid.x;
      const dyMid = mid.y - gestureRef.current.startMid.y;
      setZoom(newZoom);
      setPan({ x: gestureRef.current.startPan.x + dxMid, y: gestureRef.current.startPan.y + dyMid });
      return;
    }
    if (drawingRef.current.activePointerId !== e.pointerId || !activeLayer) return;
    if (e.pressure) setLastPressure(e.pressure);
    const p = toCanvasPoint(e.clientX, e.clientY);
    const ctx = activeLayer.canvas.getContext("2d")!;
    if (tool.kind === "brush" && drawingRef.current.from) {
      applyBrushSettings(ctx, tool.brush, color, size);
      for (const ev of e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]) {
        const to = toCanvasPoint(ev.clientX, ev.clientY);
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

  function endPointer(e: React.PointerEvent) {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) gestureRef.current = null;
    if (drawingRef.current.activePointerId === e.pointerId) {
      if (activeLayer) commitHistoryCapture(activeLayer);
      drawingRef.current.from = null;
      drawingRef.current.shapeStart = null;
      drawingRef.current.shapeSnapshot = null;
      drawingRef.current.activePointerId = null;
    }
  }

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
  }, [layers, activeId]);

  function serializeDraft(): Draft {
    return {
      title,
      canvasBg,
      layers: layers.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        dataUrl: l.canvas.toDataURL("image/png"),
      })),
      updatedAt: Date.now(),
    };
  }

  const persistDraft = useCallback(() => {
    if (!dirty) return;
    try {
      localStorage.setItem(draftKey(props.artworkId), JSON.stringify(serializeDraft()));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, layers, title, canvasBg, props.artworkId]);

  useEffect(() => {
    const id = setInterval(persistDraft, AUTOSAVE_MS);
    return () => clearInterval(id);
  }, [persistDraft]);

  useEffect(() => {
    if (!dirty) return;
    function beforeUnload(e: BeforeUnloadEvent) {
      persistDraft();
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, persistDraft]);

  function restoreDraft(d: Draft) {
    Promise.all(
      d.layers.map(
        (dl) =>
          new Promise<Layer>((resolve) => {
            const c = document.createElement("canvas");
            c.width = CANVAS_W;
            c.height = CANVAS_H;
            const img = new Image();
            img.onload = () => {
              c.getContext("2d")!.drawImage(img, 0, 0, CANVAS_W, CANVAS_H);
              resolve({ id: dl.id, name: dl.name, visible: dl.visible, opacity: dl.opacity, canvas: c });
            };
            img.onerror = () =>
              resolve({ id: dl.id, name: dl.name, visible: dl.visible, opacity: dl.opacity, canvas: c });
            img.src = dl.dataUrl;
          }),
      ),
    ).then((newLayers) => {
      setLayers(newLayers);
      setActiveId(newLayers[0].id);
      setCanvasBg(d.canvasBg);
      setTitle(d.title);
      props.onTitleChange?.(d.title);
      historyRef.current = { undo: [], redo: [], capturing: null };
      setDraftAvailable(null);
      setDirty(true);
      toast.success("Draft restored");
    });
  }

  function discardDraft() {
    try { localStorage.removeItem(draftKey(props.artworkId)); } catch {}
    setDraftAvailable(null);
  }

  function flatten(): HTMLCanvasElement {
    const out = document.createElement("canvas");
    out.width = CANVAS_W;
    out.height = CANVAS_H;
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = canvasBg;
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
      setDirty(false);
      try { localStorage.removeItem(draftKey(props.artworkId)); } catch {}
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  function addLayer() {
    const l = makeLayer(`Layer ${layers.length + 1}`);
    setLayers((ls) => [...ls, l]);
    setActiveId(l.id);
    setDirty(true);
  }

  function requestRemoveLayer(id: string) {
    if (layers.length === 1) { toast.error("Cannot delete the only layer"); return; }
    setPendingDeleteLayerId(id);
  }

  function confirmRemoveLayer() {
    const id = pendingDeleteLayerId;
    if (!id) return;
    setLayers((ls) => {
      if (ls.length === 1) return ls;
      const next = ls.filter((l) => l.id !== id);
      if (activeId === id) setActiveId(next[0].id);
      return next;
    });
    historyRef.current.undo = historyRef.current.undo.filter((e) => e.layerId !== id);
    historyRef.current.redo = historyRef.current.redo.filter((e) => e.layerId !== id);
    setPendingDeleteLayerId(null);
    setDirty(true);
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
    setDirty(true);
  }

  const canUndo = historyRef.current.undo.length > 0;
  const canRedo = historyRef.current.redo.length > 0;

  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)] bg-background overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 sm:px-4 h-12 border-b border-border/60 glass">
        <button
          onClick={() => setLeftOpen((v) => !v)}
          className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
          aria-label="Toggle tools"
        >
          <PanelLeft className="w-4 h-4" />
        </button>
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); props.onTitleChange?.(e.target.value); setDirty(true); }}
          className="bg-transparent text-sm font-display font-medium focus:outline-none border-b border-transparent focus:border-primary px-1 w-28 sm:w-48"
          placeholder="Untitled"
        />
        <div className="flex items-center gap-1 ml-1">
          <IconBtn onClick={undo} disabled={!canUndo} title="Undo (⌘Z)"><Undo2 className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)"><Redo2 className="w-4 h-4" /></IconBtn>
        </div>
        <PressureDot pressure={lastPressure} />
        <div className="flex-1" />
        <div className="hidden sm:flex items-center gap-1">
          <IconBtn onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} title="Zoom out"><ZoomOut className="w-4 h-4" /></IconBtn>
          <span className="text-[10px] font-mono w-10 text-center text-foreground/80">{Math.round(zoom * 100)}%</span>
          <IconBtn onClick={() => setZoom((z) => Math.min(6, z + 0.25))} title="Zoom in"><ZoomIn className="w-4 h-4" /></IconBtn>
          <IconBtn onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Fit"><Maximize2 className="w-4 h-4" /></IconBtn>
        </div>
        {props.onRequestCoach && (
          <button
            onClick={() => props.onRequestCoach!(flatten().toDataURL("image/png"))}
            className="hidden sm:flex px-3 py-1.5 rounded-md border border-accent/40 text-neon-cyan text-xs font-mono uppercase tracking-wider hover:bg-accent/10 items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" /> Ask coach
          </button>
        )}
        {props.onLiveCheck && (
          <button
            onClick={() => props.onLiveCheck!(flatten().toDataURL("image/png"))}
            disabled={props.liveChecking}
            title="Coach checks your work in progress"
            className="hidden sm:flex px-3 py-1.5 rounded-md border border-primary/50 text-neon-violet text-xs font-mono uppercase tracking-wider hover:bg-primary/10 disabled:opacity-50 items-center gap-1.5"
          >
            <Radar className={`w-3.5 h-3.5 ${props.liveChecking ? "animate-spin" : ""}`} />
            {props.liveChecking ? "Watching…" : "Live check"}
          </button>
        )}
        <IconBtn onClick={exportPng} title="Export PNG"><Download className="w-4 h-4" /></IconBtn>
        {props.onSave && (
          <button
            onClick={save}
            disabled={props.saving}
            className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-mono uppercase tracking-wider glow-violet disabled:opacity-50 flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{props.saveLabel ?? (props.saving ? "Saving…" : "Save")}</span>
          </button>
        )}
        <button
          onClick={() => setRightOpen((v) => !v)}
          className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
          aria-label="Toggle panels"
        >
          <PanelRight className="w-4 h-4" />
        </button>
      </div>

      {draftAvailable && (
        <div className="glass border-b border-border/60 px-4 py-2 flex flex-wrap items-center gap-3">
          <p className="text-xs">
            Unsaved draft from {new Date(draftAvailable.updatedAt).toLocaleString()}.
          </p>
          <button onClick={() => restoreDraft(draftAvailable)} className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-mono uppercase">Restore</button>
          <button onClick={discardDraft} className="px-2.5 py-1 rounded-md border border-border text-[11px] font-mono uppercase text-foreground/80 hover:text-foreground">Discard</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <aside
          className={`${leftOpen ? "flex" : "hidden"} md:flex absolute md:relative z-30 md:z-auto inset-y-0 left-0 w-14 border-r border-border/60 flex-col items-center py-3 gap-1 glass`}
        >
          {BRUSHES.map((b) => (
            <IconBtn
              key={b.kind}
              active={tool.kind === "brush" && tool.brush === b.kind}
              onClick={() => { setTool({ kind: "brush", brush: b.kind }); setLeftOpen(false); }}
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
              onClick={() => { setTool({ kind: "shape", shape: s.kind }); setLeftOpen(false); }}
              title={s.label}
            >
              {s.icon}
            </IconBtn>
          ))}
        </aside>

        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden flex items-center justify-center p-2 sm:p-6"
          style={{ background: "radial-gradient(ellipse at center, oklch(0.20 0.04 285), oklch(0.11 0.02 280))" }}
        >
          <div
            className="relative shadow-2xl glow-violet rounded-lg overflow-hidden touch-none select-none"
            style={{
              aspectRatio: `${CANVAS_W}/${CANVAS_H}`,
              width: "min(100%, 1200px)",
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
            }}
          >
            <canvas
              ref={overlayRef}
              width={CANVAS_W}
              height={CANVAS_H}
              className="block w-full h-full touch-none cursor-crosshair"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endPointer}
              onPointerCancel={endPointer}
            />
          </div>
        </div>

        <aside
          className={`${rightOpen ? "flex" : "hidden"} md:flex absolute md:relative z-30 md:z-auto inset-y-0 right-0 w-72 md:w-64 border-l border-border/60 flex-col glass overflow-hidden`}
        >
          <div className="p-3 border-b border-border/60">
            <label className="text-[10px] font-mono uppercase tracking-widest text-foreground/80">Color</label>
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
            <label className="text-[10px] font-mono uppercase tracking-widest text-foreground/80 mt-3 block">
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
            <label className="text-[10px] font-mono uppercase tracking-widest text-foreground/80 mt-3 block">
              Canvas
            </label>
            <div className="flex items-center gap-2 mt-1.5">
              <input
                type="color"
                value={canvasBg}
                onChange={(e) => { setCanvasBg(e.target.value); setDirty(true); }}
                className="w-10 h-8 rounded-md bg-transparent border border-border cursor-pointer"
                aria-label="Canvas background color"
              />
              <div className="grid grid-cols-5 gap-1 flex-1">
                {["#0B0B12", "#FFFFFF", "#F5F3FF", "#1E1B4B", "#0F172A"].map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCanvasBg(c); setDirty(true); }}
                    className={`aspect-square rounded-md border ${canvasBg === c ? "border-primary" : "border-border"}`}
                    style={{ background: c }}
                    aria-label={`Canvas ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="p-3 flex items-center justify-between border-b border-border/60">
            <span className="text-[10px] font-mono uppercase tracking-widest text-foreground/80">Layers</span>

          {ghostImgRef.current && (
            <></>
          )}
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
                    onClick={() => { setLayers((ls) => ls.map((x) => x.id === l.id ? { ...x, visible: !x.visible } : x)); setDirty(true); }}
                    className="text-foreground/70 hover:text-foreground"
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
                  <button onClick={() => moveLayer(l.id, 1)} className="md:opacity-0 md:group-hover:opacity-100 text-foreground/70 hover:text-foreground" aria-label="Move up"><ChevronUp className="w-3 h-3" /></button>
                  <button onClick={() => moveLayer(l.id, -1)} className="md:opacity-0 md:group-hover:opacity-100 text-foreground/70 hover:text-foreground" aria-label="Move down"><ChevronDown className="w-3 h-3" /></button>
                  <button onClick={() => requestRemoveLayer(l.id)} className="md:opacity-0 md:group-hover:opacity-100 text-foreground/70 hover:text-destructive" aria-label="Delete"><Trash2 className="w-3 h-3" /></button>
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
                    setDirty(true);
                  }}
                  className="w-full accent-primary mt-1"
                />
              </div>
            ))}
          </div>
        </aside>
      </div>

      <AlertDialog open={!!pendingDeleteLayerId} onOpenChange={(o) => !o && setPendingDeleteLayerId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this layer?</AlertDialogTitle>
            <AlertDialogDescription>
              The layer and every stroke on it will be removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemoveLayer} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete layer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function PressureDot({ pressure }: { pressure: number }) {
  const p = Math.max(0.05, Math.min(1, pressure || 0.05));
  const d = 6 + p * 18;
  return (
    <div
      className="hidden sm:flex items-center justify-center w-8 h-8 rounded-md border border-border/60 ml-1"
      title={`Pressure ${Math.round(p * 100)}%`}
      aria-label={`Pointer pressure ${Math.round(p * 100)} percent`}
    >
      <span
        className="rounded-full bg-primary transition-all"
        style={{ width: `${d}px`, height: `${d}px`, boxShadow: `0 0 ${p * 12}px oklch(0.63 0.24 300 / 0.7)` }}
      />
    </div>
  );
}

function IconBtn({ children, active, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...rest}
      className={`p-2 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${active ? "bg-primary text-primary-foreground glow-violet" : "text-foreground/80 hover:text-foreground hover:bg-secondary"}`}
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