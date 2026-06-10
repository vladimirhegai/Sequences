/**
 * Event-sourced project store (T5). Wraps applyCommand with validation,
 * undo/redo stacks, and an append-only event stream. Persistence is the
 * host's job (the studio server writes entries to events.log as JSONL) —
 * core stays IO-free.
 *
 * The law: a command whose resulting project fails validation is REJECTED —
 * the store never holds an invalid project, so the compiler never sees one.
 */
import type { Project } from "./schema.ts";
import { applyCommand, CommandError, type Command } from "./commands.ts";
import { validateProject, type ValidationIssue } from "./validate.ts";

export interface EventEntry {
  seq: number;
  at: string; // ISO timestamp
  kind: "apply" | "undo" | "redo";
  command: Command;
  /** Who initiated it — "user" (UI), "agent", "autofix" (linter), "cli". */
  source: string;
}

export type ApplyOutcome =
  | { ok: true; project: Project }
  | { ok: false; errors: ValidationIssue[] };

export class ProjectStore {
  #project: Project;
  #undo: Command[] = [];
  #redo: Command[] = [];
  #seq = 0;
  #onEvent: ((entry: EventEntry) => void) | undefined;

  constructor(project: Project, onEvent?: (entry: EventEntry) => void) {
    const result = validateProject(project);
    if (!result.ok || !result.project) {
      throw new Error(
        `initial project invalid:\n${result.issues.map((i) => `  ${i.path}: ${i.message}`).join("\n")}`,
      );
    }
    this.#project = result.project;
    this.#onEvent = onEvent;
  }

  get project(): Project {
    return this.#project;
  }
  get canUndo(): boolean {
    return this.#undo.length > 0;
  }
  get canRedo(): boolean {
    return this.#redo.length > 0;
  }
  get eventCount(): number {
    return this.#seq;
  }

  apply(command: Command, source = "user"): ApplyOutcome {
    let next: Project;
    let inverse: Command;
    try {
      const result = applyCommand(this.#project, command);
      next = result.project;
      inverse = result.inverse;
    } catch (err) {
      if (err instanceof CommandError) {
        return { ok: false, errors: [{ path: "command", message: err.message }] };
      }
      throw err;
    }
    const validation = validateProject(next);
    if (!validation.ok || !validation.project) {
      return { ok: false, errors: validation.issues };
    }
    this.#project = validation.project;
    this.#undo.push(inverse);
    this.#redo = [];
    this.#emit("apply", command, source);
    return { ok: true, project: this.#project };
  }

  undo(source = "user"): boolean {
    const inverse = this.#undo.pop();
    if (!inverse) return false;
    const result = applyCommand(this.#project, inverse);
    this.#project = result.project;
    this.#redo.push(result.inverse);
    this.#emit("undo", inverse, source);
    return true;
  }

  redo(source = "user"): boolean {
    const command = this.#redo.pop();
    if (!command) return false;
    const result = applyCommand(this.#project, command);
    this.#project = result.project;
    this.#undo.push(result.inverse);
    this.#emit("redo", command, source);
    return true;
  }

  #emit(kind: EventEntry["kind"], command: Command, source: string): void {
    this.#seq += 1;
    this.#onEvent?.({ seq: this.#seq, at: new Date().toISOString(), kind, command, source });
  }
}
