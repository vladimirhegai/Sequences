import { performance } from "node:perf_hooks";
import {
  compile,
  createDefaultProject,
  percentile,
  ProjectStore,
} from "../packages/core/src/index.ts";

const project = createDefaultProject({ title: "Performance budget" });
const samples = [];
for (let index = 0; index < 100; index++) {
  const store = new ProjectStore(project);
  const started = performance.now();
  const outcome = store.apply({
    type: "SetSceneDuration",
    sceneId: "hook",
    durationFrames: 96 + (index % 4),
  });
  if (!outcome.ok) throw new Error("performance fixture command failed");
  compile(store.project);
  samples.push(performance.now() - started);
}
const p95 = percentile(samples, 0.95);
console.log(`command→compile p95 ${p95.toFixed(2)}ms (budget 300ms)`);
if (p95 >= 300) process.exitCode = 1;
