import { describe, expect, it } from "vitest";
import { extractContract, foregroundAnalysis, parseActions, parseKnobs, parseParts } from "../src/stageContract.ts";

describe("Stage contract — parts", () => {
  it("collects data-forge-component and data-forge-part, unique + sorted", () => {
    const html = `<main data-forge-part="root"><h1 data-forge-component="title"></h1>
      <button data-forge-component="cta"></button><div data-forge-component="title"></div></main>`;
    expect(parseParts(html)).toEqual(["cta", "root", "title"]);
  });
});

describe("Stage contract — knobs", () => {
  it("parses every knob type with options / min / max", () => {
    const css = `
      /* @forge-var accent type=color default=#5e6ad2 label="Accent" */
      /* @forge-var radius type=range default=16 min=0 max=40 step=2 label="Radius" */
      /* @forge-var theme type=select default=dark options="dark,light,auto" label="Theme" */
      /* @forge-var size type=choice options="sm,md,lg" default=md label="Size" */
      /* @forge-var dark type=boolean default=true label="Dark" */
      /* @forge-var title type=text default="Hello there" label="Title" */
      /* @forge-var count type=number default=12 min=1 max=99 */
      /* @forge-var photo type=image default="" label="Photo" */
    `;
    const knobs = parseKnobs(css);
    const by = Object.fromEntries(knobs.map((k) => [k.name, k]));

    expect(by.accent).toMatchObject({ type: "color", default: "#5e6ad2", label: "Accent" });
    expect(by.radius).toMatchObject({ type: "range", default: 16, min: 0, max: 40, step: 2 });
    expect(by.theme).toMatchObject({ type: "select", default: "dark", options: ["dark", "light", "auto"] });
    expect(by.size).toMatchObject({ type: "choice", default: "md", options: ["sm", "md", "lg"] });
    expect(by.dark).toMatchObject({ type: "boolean", default: true });
    expect(by.title).toMatchObject({ type: "text", default: "Hello there" });
    expect(by.count).toMatchObject({ type: "number", default: 12, min: 1, max: 99 });
    expect(by.photo).toMatchObject({ type: "image", default: "", label: "Photo" });
  });

  it("aliases legacy/loose type names and dedupes by name", () => {
    const src = `/* @forge-var x type=string default=a */ /* @forge-var x type=text default=b */
      /* @forge-var flag type=toggle default=false */ /* @forge-var pick type=dropdown options="a,b" default=a */`;
    const knobs = parseKnobs(src);
    expect(knobs.filter((k) => k.name === "x")).toHaveLength(1);
    expect(knobs.find((k) => k.name === "x")!.type).toBe("text");
    expect(knobs.find((k) => k.name === "flag")!.type).toBe("boolean");
    expect(knobs.find((k) => k.name === "pick")!.type).toBe("select");
  });

  it("aliases image-ish knob types", () => {
    const knobs = parseKnobs(`/* @forge-var avatar type=photo default="" */`);
    expect(knobs[0]).toMatchObject({ name: "avatar", type: "image" });
  });
});

describe("Stage contract — actions", () => {
  it("merges declared actions with attribute-discovered ones", () => {
    const html = `<button data-forge-action="open-menu" data-forge-affects="drawer">Menu</button>
      <button data-forge-action="dismiss">x</button>`;
    const css = `/* @forge-action open-menu label="Open the menu" affects="drawer" */`;
    const actions = parseActions(html, css);
    const by = Object.fromEntries(actions.map((a) => [a.name, a]));
    expect(by["open-menu"]).toMatchObject({ label: "Open the menu", affects: "drawer" });
    // discovered from the attribute only → title-cased label, no affects
    expect(by.dismiss).toMatchObject({ name: "dismiss", label: "Dismiss" });
  });
});

describe("Stage contract — extractContract", () => {
  it("produces a full contract from a real-ish asset", () => {
    const contract = extractContract({
      html: `<section data-forge-component="card"><button data-forge-action="flip">Flip</button></section>`,
      css: `/* @forge-var accent type=color default=#10b981 label="Accent" */`,
      js: "",
    });
    expect(contract.parts).toContain("card");
    expect(contract.knobs.map((k) => k.name)).toContain("accent");
    expect(contract.actions.map((a) => a.name)).toContain("flip");
  });

  it("extracts parts and actions from React TSX source", () => {
    const contract = extractContract({
      html: `<div id="forge-react-root"></div>`,
      css: `/* @forge-action open-drawer label="Open drawer" affects="drawer" */`,
      react: `
        function App() {
          return <main data-forge-component="root">
            <button data-forge-action="open-drawer" data-forge-affects="drawer">Open</button>
            <aside data-forge-component="drawer" />
          </main>;
        }
      `,
    });
    expect(contract.parts).toEqual(["drawer", "root"]);
    expect(contract.actions[0]).toMatchObject({ name: "open-drawer", affects: "drawer" });
  });

  it("records explicit motion layers and independently movable objects", () => {
    const contract = extractContract({
      html: `<main data-forge-component="canvas" data-forge-layer="backdrop">
        <article data-forge-component="card-a" data-forge-object="card-a" data-forge-layer="subject"></article>
        <article data-forge-component="card-b" data-forge-object="card-b" data-forge-layer="subject"></article>
      </main>`,
    });
    expect(contract.objects).toEqual(["card-a", "card-b"]);
    expect(contract.layers).toContainEqual({ part: "canvas", role: "backdrop" });
    expect(foregroundAnalysis(contract.parts, contract.layers)).toMatchObject({
      foregroundParts: ["card-a", "card-b"],
      backdropParts: ["canvas"],
      separated: true,
    });
  });
});
