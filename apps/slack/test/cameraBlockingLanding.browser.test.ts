import { describe, expect, it } from "vitest";
import type { DirectCompositionDraft, DirectScene } from "../src/engine/directComposition.ts";
import { auditCameraBlockingLandings } from "../src/engine/layoutInspector.ts";
import { launchHeadlessBrowser } from "../src/engine/browserLifecycle.ts";
import { findBrowserExecutable } from "../src/engine/render.ts";

/**
 * Regression for the motion-quality-verify-1 attempt burner: an ensemble
 * blocking phrase (declared framingTarget) whose runtime deliberately caps
 * zoom so the contextual station stays delivery-safe may hold a compact
 * subject below its SOLO occupancy floor. The audit must judge the ensemble
 * contract (framing station occupancy + subject readability), not charge the
 * author for the host's own framing decision. The ParcelPilot guard stays:
 * a framing station that collapses to the subject binds the subject's range.
 */

const blockingPlan = {
  version: 1,
  enabled: true,
  solver: {
    curve: "minimum-jerk-quintic",
    measuredDom: true,
    maxNormalizedVelocity: 1.9,
    maxNormalizedAcceleration: 5.8,
    maxNormalizedJerk: 60,
  },
  scenes: [
    {
      sceneId: "recovery-action",
      phrases: [{
        id: "recovery-action:03:blocking",
        sceneId: "recovery-action",
        phraseId: "recovery-action:03",
        role: "payoff",
        importance: "primary",
        startSec: 0.2,
        arrivalSec: 0.4,
        endSec: 2,
        target: { kind: "part", id: "recovery-cta", entityKind: "cta" },
        framingTarget: { kind: "region", id: "product-ui" },
        occupancy: { min: 0.018, preferred: 0.055, max: 0.14 },
        framingOccupancy: { min: 0.1, preferred: 0.22, max: 0.42 },
        arrivalPose: { anchor: { x: 0.5, y: 0.5, name: "center" }, lens: "detail", zoom: 1 },
        corridor: { from: { x: 0.5, y: 0.5, name: "center" }, to: { x: 0.5, y: 0.5, name: "center" }, padding: 0.08 },
        dwell: { startSec: 0.4, endSec: 1.4, readableSec: 1 },
      }],
    },
    {
      sceneId: "stat-scene",
      phrases: [{
        id: "stat-scene:01:blocking",
        sceneId: "stat-scene",
        phraseId: "stat-scene:01",
        role: "payoff",
        importance: "primary",
        startSec: 3.2,
        arrivalSec: 3.4,
        endSec: 5,
        target: { kind: "part", id: "big-stat", entityKind: "metric" },
        framingTarget: { kind: "region", id: "stat-station" },
        occupancy: { min: 0.03, preferred: 0.08, max: 0.14 },
        framingOccupancy: { min: 0.1, preferred: 0.22, max: 0.42 },
        arrivalPose: { anchor: { x: 0.5, y: 0.5, name: "center" }, lens: "detail", zoom: 1 },
        corridor: { from: { x: 0.5, y: 0.5, name: "center" }, to: { x: 0.5, y: 0.5, name: "center" }, padding: 0.08 },
        dwell: { startSec: 3.4, endSec: 4.4, readableSec: 1 },
      }],
    },
  ],
  summary: {
    phraseCount: 2,
    explicitTargetCount: 2,
    primaryPhraseCount: 2,
    primaryWithReadableLandingCount: 2,
  },
};

function fixtureHtml(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box;margin:0}
html,body{width:1920px;height:1080px;overflow:hidden;background:#0b1622}
#root{position:relative;width:1920px;height:1080px}
.scene{position:absolute;inset:0}
.station{position:absolute;inset:0}
.window{position:absolute;left:360px;top:200px;width:1100px;height:640px;background:#13283d;border:2px solid #2c4a68;border-radius:18px;color:#dce8f5;font:400 24px Arial;padding:32px}
.cta{position:absolute;left:820px;top:640px;width:190px;height:76px;background:#4be0b0;color:#04220f;font:700 26px Arial;border-radius:12px;display:grid;place-items:center}
.stat{position:absolute;left:570px;top:260px;width:780px;height:560px;background:#1d3247;border-radius:22px;color:#fff;font:700 120px Arial;display:grid;place-items:center}
</style></head><body>
<main id="root" data-composition-id="blocking-audit" data-width="1920" data-height="1080" data-duration="6">
  <section class="scene" data-scene="recovery-action">
    <div class="station" data-region="product-ui">
      <div class="window" data-component="app-window" data-part="product-shell">
        Recovery workflow — exception queue, filters, and resolution history.
        <div class="cta" data-component="button" data-part="recovery-cta">Run recovery</div>
      </div>
    </div>
  </section>
  <section class="scene" data-scene="stat-scene">
    <div class="station" data-region="stat-station">
      <div class="stat" data-component="stat-card" data-part="big-stat">99.4%</div>
    </div>
  </section>
</main>
<script type="application/json" id="sequences-camera-blocking">${JSON.stringify(blockingPlan)}</script>
</body></html>`;
}

const storyboard = [
  { id: "recovery-action", startSec: 0, durationSec: 3 },
  { id: "stat-scene", startSec: 3, durationSec: 3 },
] as unknown as DirectScene[];

describe("camera blocking landing audit — ensemble framing semantics", () => {
  it("accepts a compact subject below its solo floor inside a correctly framed ensemble, and still binds the subject range when the framing station collapses to the subject", async () => {
    const browserPath = findBrowserExecutable();
    expect(browserPath).toBeTruthy();
    const browser = await launchHeadlessBrowser({
      executablePath: browserPath!,
      headless: true,
      args: ["--hide-scrollbars", "--mute-audio", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage"],
    });
    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      await page.setContent(fixtureHtml(), { waitUntil: "load" });
      const draft = { html: fixtureHtml(), storyboard } as DirectCompositionDraft;
      const issues = await auditCameraBlockingLandings(page, draft, async (time) => {
        // The target enters after camera arrival but before its declared dwell
        // ends. QA must review the settled landing, not the first 80ms.
        await page.evaluate((at) => {
          const cta = document.querySelector<HTMLElement>('[data-part="recovery-cta"]');
          if (cta) cta.style.opacity = at >= 1 ? "1" : "0";
        }, time);
      });
      const landings = issues.filter((issue) => issue.code === "camera_blocking_landing");

      // recovery-cta: 190×76 ≈ 0.70% of frame — below its 1.8% solo floor —
      // but the product-ui framing union (the 1100×640 window ≈ 34%) is inside
      // its 10–42% ensemble contract. The verify-1 probe burned two paid
      // attempts on exactly this false positive.
      expect(landings.find((issue) => issue.part === "recovery-cta")).toBeUndefined();

      // big-stat: the station's only painted content IS the subject
      // (ParcelPilot class), so the subject's own 3–14% range binds; a 780×560
      // card ≈ 21% must still be reported.
      const statIssue = landings.find((issue) => issue.part === "big-stat");
      expect(statIssue).toBeDefined();
      expect(statIssue!.message).toContain("collapses to the subject");
    } finally {
      await browser.close();
    }
  }, 60_000);
});
