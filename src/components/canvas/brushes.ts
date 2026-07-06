import type { BrushKind } from "./types";

export function applyBrushSettings(
  ctx: CanvasRenderingContext2D,
  brush: BrushKind,
  color: string,
  size: number,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalCompositeOperation = "source-over";
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  ctx.globalAlpha = 1;
  ctx.lineWidth = size;
  switch (brush) {
    case "pen":
      break;
    case "marker":
      ctx.globalAlpha = 0.5;
      ctx.lineCap = "square";
      break;
    case "airbrush":
      // handled per-dab
      break;
    case "pixel":
      ctx.lineCap = "square";
      ctx.lineJoin = "miter";
      break;
    case "calligraphy":
      ctx.lineCap = "butt";
      break;
    case "neon":
      ctx.globalCompositeOperation = "lighter";
      ctx.shadowBlur = size * 1.4;
      ctx.shadowColor = color;
      break;
    case "eraser":
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      break;
  }
}

export function drawStrokeSegment(
  ctx: CanvasRenderingContext2D,
  brush: BrushKind,
  color: string,
  size: number,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  if (brush === "airbrush") {
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const steps = Math.max(1, Math.floor(dist / 2));
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.06;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const cx = from.x + (to.x - from.x) * t;
      const cy = from.y + (to.y - from.y) * t;
      for (let j = 0; j < 6; j++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * size * 0.5;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    return;
  }
  if (brush === "calligraphy") {
    // angled ribbon
    const angle = Math.PI / 4;
    const half = size / 2;
    const dx = Math.cos(angle) * half;
    const dy = Math.sin(angle) * half;
    ctx.beginPath();
    ctx.moveTo(from.x - dx, from.y - dy);
    ctx.lineTo(from.x + dx, from.y + dy);
    ctx.lineTo(to.x + dx, to.y + dy);
    ctx.lineTo(to.x - dx, to.y - dy);
    ctx.closePath();
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
}