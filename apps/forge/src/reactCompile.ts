import ts from "typescript";

export interface StageReactSource {
  /** TSX source for a function-component tree. No imports; Forge supplies React globals. */
  tsx: string;
  /** Existing mount element id in `html`. Defaults to `forge-react-root`. */
  rootId?: string;
}

export interface StageAssetCapabilities {
  react?: boolean;
  gsap?: boolean;
  /** Tailwind v4 (in-browser) + the shadcn token layer are injected into the preview. */
  tailwind?: boolean;
}

export interface CompileReactResult {
  ok: boolean;
  rootId: string;
  js?: string;
  errors?: string[];
  warnings?: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function cleanRootId(input: unknown): string {
  const raw = typeof input === "string" ? input.trim() : "";
  const id = raw || "forge-react-root";
  return /^[A-Za-z][\w:-]{0,63}$/.test(id) ? id : "forge-react-root";
}

export function normalizeReactSource(value: unknown): StageReactSource | undefined {
  if (typeof value === "string") {
    const tsx = value.trim();
    return tsx ? { tsx } : undefined;
  }
  const raw = asRecord(value);
  if (!raw) return undefined;
  const tsx =
    typeof raw.tsx === "string"
      ? raw.tsx.trim()
      : typeof raw.component === "string"
        ? raw.component.trim()
        : typeof raw.source === "string"
          ? raw.source.trim()
          : "";
  if (!tsx) return undefined;
  return { tsx, rootId: cleanRootId(raw.rootId) };
}

export function normalizeCapabilities(value: unknown): StageAssetCapabilities {
  const raw = asRecord(value);
  if (!raw) return {};
  return {
    ...(raw.react === true ? { react: true } : {}),
    ...(raw.gsap === true ? { gsap: true } : {}),
    ...(raw.tailwind === true || raw.shadcn === true ? { tailwind: true } : {}),
  };
}

export function sourceUsesGsap(source: string): boolean {
  return /\bgsap\s*\./.test(source) || /\bgsap\s*\(/.test(source) || /\bGSAP\b/.test(source);
}

export function sourceUsesTailwind(source: string): boolean {
  return /\b(?:class|className)\s*=\s*["'`][^"'`]*(?:bg-card|bg-background|text-muted-foreground|text-primary-foreground|border-input|ring-ring|rounded-(?:sm|md|lg|xl|2xl)|shadow-sm|h-9|inline-flex|grid-cols-|data-\[[^\]]+\]:)[^"'`]*["'`]/.test(
    source,
  );
}

function diagnosticsToStrings(diagnostics: readonly ts.Diagnostic[] | undefined): string[] {
  return (diagnostics ?? []).map((diagnostic) => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    if (!diagnostic.file || diagnostic.start == null) return message;
    const pos = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
    return `${diagnostic.file.fileName}:${pos.line + 1}:${pos.character + 1} ${message}`;
  });
}

function hasUnsupportedImports(sourceFile: ts.SourceFile): string[] {
  const errors: string[] = [];
  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) || ts.isImportEqualsDeclaration(statement)) {
      errors.push("React Stage source must be self-contained; remove import declarations.");
    }
  }
  return errors;
}

function normalizeExports(source: string): { source: string; rootName?: string; errors: string[] } {
  const errors: string[] = [];
  let rootName: string | undefined;
  let next = source;

  const defaultNamed = /\bexport\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/.exec(next);
  if (defaultNamed) {
    rootName = defaultNamed[1];
    next = next.replace(/\bexport\s+default\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/, "function $1(");
  } else {
    next = next.replace(/\bexport\s+default\s+function\s*\(/, () => {
      rootName = "App";
      return "function App(";
    });
  }

  const defaultRef = /\bexport\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?/.exec(next);
  if (defaultRef) {
    rootName = defaultRef[1];
    next = next.replace(/\bexport\s+default\s+([A-Z][A-Za-z0-9_]*)\s*;?/, "");
  }

  next = next.replace(/\bexport\s+\{\s*([A-Z][A-Za-z0-9_]*)\s*\}\s*;?/g, (_all, name: string) => {
    rootName = rootName ?? name;
    return "";
  });

  if (/\bexport\s+default\s+class\b/.test(next) || /\bclass\s+[A-Z][A-Za-z0-9_]*\s+extends\b/.test(next)) {
    errors.push("React Stage source supports function components, not class components.");
  }

  next = next.replace(/\bexport\s+(?=(function|const|let|var)\s+[A-Z])/g, "");

  rootName =
    rootName ??
    /\bfunction\s+([A-Z][A-Za-z0-9_]*)\s*\(/.exec(next)?.[1] ??
    /\b(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*=/.exec(next)?.[1];

  if (!rootName) {
    errors.push("React Stage source must define a capitalized root component, e.g. function App() { ... }.");
  }
  return { source: next, rootName, errors };
}

export function compileReactStageSource(source: StageReactSource): CompileReactResult {
  const rootId = cleanRootId(source.rootId);
  const tsx = source.tsx.trim();
  if (!tsx) return { ok: false, rootId, errors: ["React source is empty."] };

  const sourceFile = ts.createSourceFile("stage-react.tsx", tsx, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const importErrors = hasUnsupportedImports(sourceFile);
  const normalized = normalizeExports(tsx);
  const errors = [...importErrors, ...normalized.errors];
  if (errors.length || !normalized.rootName) return { ok: false, rootId, errors };

  const transpiled = ts.transpileModule(normalized.source, {
    fileName: "stage-react.tsx",
    reportDiagnostics: true,
    compilerOptions: {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.None,
      jsx: ts.JsxEmit.React,
      jsxFactory: "React.createElement",
      jsxFragmentFactory: "React.Fragment",
      removeComments: false,
    },
  });
  const diagnostics = diagnosticsToStrings(transpiled.diagnostics);
  if (diagnostics.length) return { ok: false, rootId, errors: diagnostics };

  return {
    ok: true,
    rootId,
    js: [
      "(function () {",
      "  const React = window.React;",
      "  const ReactDOM = window.ReactDOM;",
      "  const ForgeReact = window.ForgeReact;",
      "  if (!React || !ReactDOM || !ForgeReact) throw new Error('Forge React runtime missing');",
      transpiled.outputText.trim(),
      `  ForgeReact.render(${normalized.rootName}, ${JSON.stringify(rootId)});`,
      "})();",
    ].join("\n"),
  };
}
