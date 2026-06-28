/**
 * Small deterministic design helpers inspired by Tasteprint's strongest idea:
 * give the model measured, reproducible options, but keep them advisory.
 */
export interface PaletteCandidate {
  id: string;
  name: string;
  mode: "light" | "dark";
  tokens: {
    canvas: string;
    surface: string;
    ink: string;
    muted: string;
    accent: string;
    accentInk: string;
  };
  contrast: {
    inkOnCanvas: number;
    mutedOnCanvas: number;
    accentOnCanvas: number;
    accentInkOnAccent: number;
  };
}

export interface TypographyCandidate {
  id: string;
  name: string;
  display: string;
  body: string;
  mono?: string;
  scale: { display: number; heading: number; body: number; label: number };
  lineHeight: { display: number; body: number };
  measure: string;
  rationale: string;
}

export interface DesignFoundation {
  advisory: true;
  paletteCandidates: PaletteCandidate[];
  typographyCandidates: TypographyCandidate[];
}

const PALETTES = [
  { name: "Cobalt signal", mode: "light", canvas: "#F7F8FA", surface: "#FFFFFF", ink: "#15171A", muted: "#5E6470", accent: "#2457D6" },
  { name: "Copper ledger", mode: "light", canvas: "#F6F3EE", surface: "#FFFCF7", ink: "#1D1A17", muted: "#686058", accent: "#A54118" },
  { name: "Teal instrument", mode: "dark", canvas: "#0A1112", surface: "#111B1C", ink: "#F1F7F5", muted: "#A7B8B4", accent: "#4DD6B1" },
  { name: "Cherry terminal", mode: "dark", canvas: "#111014", surface: "#1A181E", ink: "#F8F4F7", muted: "#B9ADB6", accent: "#F05A86" },
  { name: "Lichen studio", mode: "light", canvas: "#F4F5EF", surface: "#FCFDF9", ink: "#171A15", muted: "#5F675A", accent: "#496E2D" },
  { name: "Ultramarine night", mode: "dark", canvas: "#0C1020", surface: "#151A2D", ink: "#F3F5FF", muted: "#ADB5D1", accent: "#8395FF" },
] as const;

const TYPOGRAPHY = [
  {
    name: "Product grotesk",
    display: '"Manrope", "Inter", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
    scale: { display: 56, heading: 30, body: 16, label: 13 },
    lineHeight: { display: 0.98, body: 1.5 },
    measure: "58-68ch",
    rationale: "Geometric display voice with a quieter, highly legible UI body.",
  },
  {
    name: "Editorial utility",
    display: '"Newsreader", Georgia, serif',
    body: '"DM Sans", system-ui, sans-serif',
    scale: { display: 62, heading: 32, body: 16, label: 13 },
    lineHeight: { display: 0.96, body: 1.55 },
    measure: "52-64ch",
    rationale: "Serif/sans contrast gives motion titles character without weakening controls.",
  },
  {
    name: "Technical humanist",
    display: '"Space Grotesk", "Arial", sans-serif',
    body: '"IBM Plex Sans", system-ui, sans-serif',
    mono: '"IBM Plex Mono", ui-monospace, monospace',
    scale: { display: 54, heading: 29, body: 15, label: 12 },
    lineHeight: { display: 1, body: 1.48 },
    measure: "56-68ch",
    rationale: "Crisp product hierarchy with a real mono role for data and changing values.",
  },
  {
    name: "Warm interface",
    display: '"DM Sans", system-ui, sans-serif',
    body: '"Source Sans 3", system-ui, sans-serif',
    scale: { display: 58, heading: 31, body: 16, label: 13 },
    lineHeight: { display: 0.98, body: 1.52 },
    measure: "58-70ch",
    rationale: "Friendly shapes and excellent small-size clarity for approachable SaaS scenes.",
  },
] as const;

function hash(value: string): number {
  let result = 2166136261;
  for (const char of value) {
    result ^= char.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

function rotate<T>(values: readonly T[], offset: number): T[] {
  const at = values.length ? offset % values.length : 0;
  return [...values.slice(at), ...values.slice(0, at)];
}

function normalizeHex(value: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  return match ? `#${match[1]!.toUpperCase()}` : "#000000";
}

function luminance(value: string): number {
  const hex = normalizeHex(value);
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255);
  const [r, g, b] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(first: string, second: string): number {
  const a = luminance(first);
  const b = luminance(second);
  return Math.round(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)) * 100) / 100;
}

function readableInk(background: string): string {
  return contrastRatio("#0B0B0D", background) >= contrastRatio("#FFFFFF", background) ? "#0B0B0D" : "#FFFFFF";
}

export function buildDesignFoundation(brief: string): DesignFoundation {
  const seed = hash(brief.trim().toLowerCase());
  const wantsDark = /\b(dark|night|black|terminal|cinematic)\b/i.test(brief);
  const orderedPalettes = rotate(PALETTES, seed).sort((a, b) =>
    Number(b.mode === (wantsDark ? "dark" : "light")) - Number(a.mode === (wantsDark ? "dark" : "light")),
  );
  const paletteCandidates = orderedPalettes.slice(0, 3).map((source, index): PaletteCandidate => {
    const accentInk = readableInk(source.accent);
    return {
      id: `palette-${index + 1}`,
      name: source.name,
      mode: source.mode,
      tokens: { ...source, accentInk },
      contrast: {
        inkOnCanvas: contrastRatio(source.ink, source.canvas),
        mutedOnCanvas: contrastRatio(source.muted, source.canvas),
        accentOnCanvas: contrastRatio(source.accent, source.canvas),
        accentInkOnAccent: contrastRatio(accentInk, source.accent),
      },
    };
  });
  const typographyCandidates = rotate(TYPOGRAPHY, seed >>> 8).slice(0, 3).map((source, index) => ({
    id: `type-${index + 1}`,
    ...source,
  }));
  return { advisory: true, paletteCandidates, typographyCandidates };
}

/** Conservative local estimator used to enforce prompt budgets without a model call. */
export function estimateTokens(text: string): number {
  const pieces = String(text).match(/[\p{L}\p{N}_'-]+|[^\s]/gu) ?? [];
  return Math.ceil(pieces.reduce((sum, piece) => sum + Math.max(1, Math.ceil(piece.length / 4)), 0) * 1.08);
}

