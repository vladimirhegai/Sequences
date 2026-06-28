import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ForgeDocument } from "../src/document.ts";
import { addDoc } from "../src/docs.ts";
import { saveScratchImage } from "../src/scratch.ts";
import { resolveStageReferences, runStageChat } from "../src/stageRunner.ts";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "forge-stage-"));
}

const KNOWLEDGE = path.resolve(import.meta.dirname, "..", "knowledge");

describe("Stage runner — reference resolution", () => {
  it("resolves doc text and scratch image paths", () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const docEntry = addDoc(dir, "design.md", "# Brand\nUse teal.");
    const scratch = saveScratchImage(doc.dir, "paste.png", Buffer.from("img-bytes"));

    const { media, docs } = resolveStageReferences(doc, dir, [
      { kind: "doc", id: docEntry.id, label: "@design.md" },
      { kind: "scratch", id: scratch.id, label: "pasted image" },
      { kind: "doc", id: "missing", label: "@gone" },
    ]);

    expect(docs).toHaveLength(1);
    expect(docs[0]!.text).toContain("Use teal.");
    expect(media).toHaveLength(1);
    expect(media[0]!.kind).toBe("image");
    expect(fs.existsSync(media[0]!.path)).toBe(true);
  });
});

describe("Stage runner — the turn", () => {
  it("builds an asset + contract from a well-formed model response", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const reply = JSON.stringify({
      reply: "Built a search bar.",
      asset: {
        name: "Search bar",
        html: '<div data-forge-component="bar"><button data-forge-action="focus-search">Go</button></div>',
        css: '/* @forge-var accent type=color default=#5e6ad2 label="Accent" */',
        js: "",
      },
    });
    let sawPrompt = "";
    const result = await runStageChat({
      message: "make a search bar",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async (prompt) => {
        sawPrompt = prompt;
        return "Here you go:\n" + reply;
      },
    });

    expect(result.ok).toBe(true);
    expect(result.asset!.name).toBe("Search bar");
    expect(result.asset!.contract.parts).toContain("bar");
    expect(result.asset!.contract.knobs.map((k) => k.name)).toContain("accent");
    expect(result.asset!.contract.actions.map((a) => a.name)).toContain("focus-search");
    // the prompt carries the contract spec + design bar (token-light, on-disk deep dives)
    expect(sawPrompt).toContain("THE FORGE CONTRACT");
    expect(sawPrompt).toContain("DESIGN BAR");
    expect(sawPrompt).toContain("type=image");
    expect(sawPrompt).toContain("vertical scroll is allowed");
    expect(sawPrompt).toContain("CREATE/HYPERFRAMES HANDOFF");
    expect(sawPrompt).toContain("REACT/JSX OPTION");
    expect(sawPrompt).toContain("GSAP OPTION");
    expect(sawPrompt).toContain("SHADCN / TAILWIND OPTION");
    expect(sawPrompt).toContain("RETRIEVED CONTEXT");
    expect(sawPrompt).toContain("Official GSAP AI skills");
    expect(sawPrompt).toContain("FINAL OUTPUT CHECK");
    expect(sawPrompt).toContain("Do not flatten name/html/css/js at the top level");
    expect(sawPrompt).toContain("Match the requested scope exactly");
    expect(sawPrompt).toContain("under 12,000 characters");
    // a fresh build does not advertise the small-edit ops path
    expect(sawPrompt).not.toContain("SMALL-EDIT OPS");
  });

  it("normalizes flattened and nested asset envelopes from API models", async () => {
    const variants = [
      {
        reply: "Built a flattened card.",
        name: "Flattened card",
        html: '<article data-forge-component="card">Flat</article>',
        css: ".card{display:grid}",
        js: "",
      },
      {
        response: {
          reply: "Built a nested card.",
          asset: {
            name: "Nested card",
            html: '<article data-forge-component="card">Nested</article>',
            css: ".card{display:grid}",
            js: "",
          },
        },
      },
    ];

    for (const variant of variants) {
      const dir = tmp();
      const doc = ForgeDocument.createBlank(dir);
      const result = await runStageChat({
        message: "make a card",
        doc,
        docDir: dir,
        knowledgeDir: KNOWLEDGE,
        complete: async () => JSON.stringify(variant),
      });
      expect(result.ok).toBe(true);
      expect(result.asset!.contract.parts).toContain("card");
    }
  });

  it("repairs literal newlines and unescaped markup quotes in model JSON", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const malformed = `{
      "reply": "Built a repaired card.",
      "asset": {
        "name": "Repaired card",
        "html": "<article class="card" data-forge-component="card">Fixed</article>",
        "css": ".card {
          display: grid;
          color: red;
        }",
        "js": ""
      }
    }`;
    const result = await runStageChat({
      message: "make a card",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () => malformed,
    });

    expect(result.ok).toBe(true);
    expect(result.asset!.html).toContain('class="card"');
    expect(result.asset!.css).toContain("display: grid");
    expect(result.asset!.contract.parts).toContain("card");
  });

  it("retries a response that was truncated mid-code with a compact recovery prompt", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const prompts: string[] = [];
    const result = await runStageChat({
      message: "make an Apple-style search bar with text",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async (prompt) => {
        prompts.push(prompt);
        if (prompts.length === 1) {
          return '{"reply":"Built it","asset":{"name":"Search","html":"<div data-forge-component=\\"search-bar\\">Search';
        }
        return JSON.stringify({
          reply: "Built a compact search bar.",
          asset: {
            name: "Search bar",
            html: '<label data-forge-component="search-bar"><input placeholder="Search" /></label>',
            css: ".search-bar{display:flex}",
            js: "",
          },
        });
      },
    });

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain("previous response was cut off");
    expect(prompts[1]).toContain("under 12,000 characters");
    expect(result.ok).toBe(true);
    expect(result.asset?.contract.parts).toContain("search-bar");
  });

  it("applies a small-edit op-list to the current asset without a full re-emit", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const current = {
      name: "Hero",
      html: '<h1 data-forge-component="hero-title">Old</h1><a data-forge-component="cta">Buy</a>',
      css: '/* @forge-var radius type=range default=8 min=0 max=24 label="Radius" */',
      js: "",
    };
    let sawPrompt = "";
    const result = await runStageChat({
      message: "rename the cta to primary-cta, set radius to 12, and retitle the hero",
      current,
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async (prompt) => {
        sawPrompt = prompt;
        return JSON.stringify({
          reply: "Tweaked the hero.",
          ops: [
            { op: "rename-part", from: "cta", to: "primary-cta" },
            { op: "set-knob", name: "radius", value: 12 },
            { op: "set-text", part: "hero-title", text: "Welcome" },
          ],
        });
      },
    });

    expect(sawPrompt).toContain("SMALL-EDIT OPS");
    expect(result.ok).toBe(true);
    expect(result.asset!.html).toContain('data-forge-component="primary-cta"');
    expect(result.asset!.html).toContain("Welcome");
    expect(result.asset!.css).toContain("default=12");
    expect(result.asset!.contract.parts).toContain("primary-cta");
    expect(result.reply).toContain("renamed part");
  });

  it("keeps the tailwind capability and runs the deterministic polish pass", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const reply = JSON.stringify({
      reply: "Built a shadcn card.",
      asset: {
        name: "Settings card",
        html: '<div data-forge-component="settings-card" class="rounded-xl border bg-card p-6">Profile</div>',
        // a leaked code fence + an animation with no reduced-motion guard
        css: "```css\n.btn{transition:background-color .2s}\n```",
        js: "",
        capabilities: { tailwind: true },
      },
    });
    const result = await runStageChat({
      message: "make a shadcn settings card",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () => reply,
    });

    expect(result.ok).toBe(true);
    expect(result.asset!.capabilities).toMatchObject({ tailwind: true });
    expect(result.asset!.css).not.toContain("```");
    expect(result.asset!.css).toContain("prefers-reduced-motion");
    expect(result.asset!.contract.parts).toContain("settings-card");
  });

  it("infers Tailwind capability from shadcn utility classes when the model forgets it", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const result = await runStageChat({
      message: "make a shadcn settings card",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () =>
        JSON.stringify({
          reply: "Built a card.",
          asset: {
            name: "Settings card",
            html: '<section data-forge-component="settings-card" class="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">Settings</section>',
            css: "",
            js: "",
          },
        }),
    });

    expect(result.ok).toBe(true);
    expect(result.asset!.capabilities).toMatchObject({ tailwind: true });
  });

  it("compiles React TSX, preserves source, and extracts the contract", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const reply = JSON.stringify({
      reply: "Built a React dashboard shell.",
      asset: {
        name: "React dashboard",
        html: "",
        css: `
          /* @forge-var accent type=color default=#5e6ad2 label="Accent" */
          /* @forge-action open-drawer label="Open drawer" affects="drawer" */
        `,
        react: {
          rootId: "forge-react-root",
          tsx: `
            function App() {
              const root = React.useRef(null);
              React.useEffect(() => {
                gsap.to(root.current, { autoAlpha: 1, duration: 0.2 });
              }, []);
              return <main ref={root} data-forge-component="root">
                <button data-forge-action="open-drawer" data-forge-affects="drawer">Open</button>
                <aside data-forge-component="drawer">Filters</aside>
              </main>;
            }
          `,
        },
        js: "",
        capabilities: { react: true, gsap: true },
      },
    });

    const result = await runStageChat({
      message: "make a React dashboard with a drawer and GSAP polish",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () => reply,
    });

    expect(result.ok).toBe(true);
    expect(result.asset!.html).toContain('id="forge-react-root"');
    expect(result.asset!.js).toContain("ForgeReact.render(App");
    expect(result.asset!.react && typeof result.asset!.react === "object" ? result.asset!.react.tsx : "").toContain("function App");
    expect(result.asset!.capabilities).toMatchObject({ react: true, gsap: true });
    expect(result.asset!.contract.parts).toEqual(["drawer", "root"]);
    expect(result.asset!.contract.actions[0]).toMatchObject({ name: "open-drawer", affects: "drawer" });
  });

  it("fails gracefully when the model returns non-JSON", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const result = await runStageChat({
      message: "x",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () => "sorry, here is some prose with no json",
    });
    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toMatch(/json/i);
  });

  it("fails when the response has no asset body", async () => {
    const dir = tmp();
    const doc = ForgeDocument.createBlank(dir);
    const result = await runStageChat({
      message: "x",
      doc,
      docDir: dir,
      knowledgeDir: KNOWLEDGE,
      complete: async () => JSON.stringify({ reply: "hmm" }),
    });
    expect(result.ok).toBe(false);
    expect(result.errors?.[0]).toContain("received: reply");
  });
});
