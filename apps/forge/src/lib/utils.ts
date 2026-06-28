import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * The canonical shadcn/ui `cn` helper.
 *
 * NOTE: this is a project-detection artifact for the official shadcn CLI/skill
 * (`shadcn info --json` reads `components.json`, which aliases `utils` here). The
 * Forge Stage *preview* does not import this — it ships a self-contained
 * `window.cn` via `src/static/vendor/forge-cn.js` so the no-bundler iframe stays
 * offline. Keep the two in conceptual sync.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
