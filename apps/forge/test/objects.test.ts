import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { moveForgeObjectToFolder, readObjectLibrary, upsertForgeObject } from "../src/objects.ts";

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "forge-objects-"));
}

describe("Forge object library", () => {
  it("persists Stage contract values and image media bindings", () => {
    const dir = tmp();
    const object = upsertForgeObject(dir, {
      name: "Restaurant results",
      html: `<section data-forge-component="card"><img data-forge-var="photo" alt=""></section>`,
      css: `
        /* @forge-var query type=text default="Restaurants near me" label="Search query" */
        /* @forge-var photo type=image default="" label="Restaurant image" */
      `,
      js: "",
      react: {
        rootId: "forge-react-root",
        tsx: `function App(){ return <section data-forge-component="react-card" />; }`,
      },
      capabilities: { react: true, gsap: true },
      values: {
        query: "Best sushi near me",
        photo: "/forge-assets/assets%2Fsushi.png",
        unknown: "ignored",
      },
      mediaBindings: [
        {
          knob: "photo",
          assetId: "asset-sushi",
          href: "/forge-assets/assets%2Fsushi.png",
          path: "assets/sushi.png",
          kind: "image",
          label: "sushi.png",
        },
      ],
    });

    expect(object.contract.parts).toEqual(["card", "react-card"]);
    expect(object.react?.tsx).toContain("function App");
    expect(object.capabilities).toMatchObject({ react: true, gsap: true });
    expect(object.values.query).toBe("Best sushi near me");
    expect(object.values.photo).toBe("/forge-assets/assets%2Fsushi.png");
    expect(object.values.unknown).toBeUndefined();
    expect(object.mediaBindings).toHaveLength(1);

    const [roundTrip] = readObjectLibrary(dir);
    expect(roundTrip!.variables.map((knob) => knob.type)).toContain("image");
    expect(roundTrip!.mediaBindings[0]).toMatchObject({ knob: "photo", assetId: "asset-sushi" });
    expect(roundTrip!.react?.rootId).toBe("forge-react-root");
    expect(roundTrip!.capabilities).toMatchObject({ react: true, gsap: true });
  });

  it("persists or infers the tailwind capability so saved shadcn assets stay styled", () => {
    const dir = tmp();
    const object = upsertForgeObject(dir, {
      name: "shadcn card",
      html: '<div data-forge-component="card" class="rounded-xl border bg-card p-6">Hi</div>',
      css: "",
      js: "",
    });
    expect(object.capabilities).toMatchObject({ tailwind: true });
    const [roundTrip] = readObjectLibrary(dir);
    expect(roundTrip!.capabilities).toMatchObject({ tailwind: true });
  });

  it("keeps component bins when saving edits and can move components between bins", () => {
    const dir = tmp();
    const object = upsertForgeObject(dir, {
      name: "Metric card",
      folder: "dashboards",
      html: `<section data-forge-component="card">42%</section>`,
      css: "",
      js: "",
    });

    expect(object.folder).toBe("dashboards");
    moveForgeObjectToFolder(dir, object.id, "stage/generated");
    expect(readObjectLibrary(dir)[0]!.folder).toBe("stage/generated");

    upsertForgeObject(dir, {
      id: object.id,
      name: "Metric card v2",
      html: `<section data-forge-component="card">43%</section>`,
      css: "",
      js: "",
    });
    expect(readObjectLibrary(dir)[0]!.folder).toBe("stage/generated");
  });
});
