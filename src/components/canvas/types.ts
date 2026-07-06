export type BrushKind =
  | "pen"
  | "marker"
  | "airbrush"
  | "pixel"
  | "calligraphy"
  | "neon"
  | "eraser";

export type ShapeKind = "rect" | "ellipse" | "line" | "arrow";

export type Tool =
  | { kind: "brush"; brush: BrushKind }
  | { kind: "shape"; shape: ShapeKind };

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  canvas: HTMLCanvasElement;
}

export interface StudioSettings {
  color: string;
  size: number;
}