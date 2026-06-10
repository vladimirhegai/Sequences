/**
 * Deterministic layout helpers: 12-column grid with title-safe margins.
 * Archetypes express boxes in grid terms; everything lands on the lattice.
 */
import type { Box } from "./schema.ts";

export const GRID_COLS = 12;
/** Title-safe inset as a fraction of width (5% — also the linter's rule). */
export const SAFE_MARGIN_FRAC = 0.05;

export interface GridSpec {
  /** First column, 0-based. */
  col: number;
  /** Number of columns spanned. */
  span: number;
  /** Top edge as a fraction of canvas height. */
  y: number;
  /** Height as a fraction of canvas height. */
  h: number;
  origin?: string;
}

export function gridBox(W: number, H: number, spec: GridSpec): Box {
  const margin = SAFE_MARGIN_FRAC * W;
  const gutter = 24 * (W / 1920);
  const colW = (W - 2 * margin - (GRID_COLS - 1) * gutter) / GRID_COLS;
  const x = margin + spec.col * (colW + gutter);
  const w = spec.span * colW + (spec.span - 1) * gutter;
  return {
    x: Math.round(x),
    y: Math.round(spec.y * H),
    w: Math.round(w),
    h: Math.round(spec.h * H),
    origin: spec.origin ?? "center center",
  };
}

export function fullBleed(W: number, H: number): Box {
  return { x: 0, y: 0, w: W, h: H, origin: "center center" };
}

export function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}
