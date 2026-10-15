import { readFile } from "node:fs/promises";
import os from "node:os";
import { makeEngine } from "../src/engine.mjs";
import { sample } from "../src/workspace.mjs";
const engine = await makeEngine(
    await readFile(new URL("../public/route.wasm", import.meta.url)),
  ),
  map = sample();
function distance(a, b) {
  const q = [[a, 0]],
    seen = new Set([a]);
  for (let i = 0; i < q.length; i++) {
    const [v, d] = q[i];
    if (v === b) return d;
    for (const t of [v - map.width, v + 1, v + map.width, v - 1])
      if (
        t >= 0 &&
        t < map.width * map.height &&
        Math.abs((t % map.width) - (v % map.width)) +
          Math.abs(Math.floor(t / map.width) - Math.floor(v / map.width)) ===
          1 &&
        !map.blocked.includes(t) &&
        !seen.has(t)
      ) {
        seen.add(t);
        q.push([t, d + 1]);
      }
  }
  return Infinity;
}
function greedy() {
  let at = map.base,
    spent = 0,
    priority = 0,
    left = [...map.targets];
  while (left.length) {
    const feasible = left
      .map((t) => ({ t, d: distance(at, t.cell) }))
      .filter(
        ({ t, d }) => spent + d + 1 + distance(t.cell, map.base) <= map.budget,
      )
      .sort((a, b) => b.t.priority / (b.d + 1) - a.t.priority / (a.d + 1));
    if (!feasible.length) break;
    const { t, d } = feasible[0];
    spent += d + 1;
    priority += t.priority;
    at = t.cell;
    left = left.filter((x) => x !== t);
  }
  return { priority, cost: spent + distance(at, map.base) };
}
function measure(fn) {
  for (let i = 0; i < 5; i++) fn();
  const values = [];
  let result;
  for (let i = 0; i < 50; i++) {
    const start = performance.now();
    result = fn();
    values.push(performance.now() - start);
  }
  values.sort((a, b) => a - b);
  return {
    p50_ms: values[24],
    p95_ms: values[47],
    min_ms: values[0],
    max_ms: values[49],
    priority: result.priority,
    cost: result.cost,
  };
}
console.log(
  JSON.stringify(
    {
      environment: {
        os: os.platform(),
        release: os.release(),
        architecture: os.arch(),
        logical_cpu_count: os.cpus().length,
        node: process.version,
        compiler: "Zig0.14.1 C++20 -O3 wasm32-freestanding",
      },
      workload: {
        source: "original fixed synthetic sample v1",
        seed: "deterministic fixture, no random generator",
        width: map.width,
        height: map.height,
        targets: map.targets.length,
        budget: map.budget,
        warmup: 5,
        repetitions: 50,
        method:
          "sequential performance.now wall clock; nearest-rank p95; shared container",
      },
      exact_wasm: measure(() => engine(map)),
      greedy_javascript: measure(greedy),
      limits:
        "One small workload. Different languages/algorithms; baseline illustrates quality/latency tradeoffs, not an apples-to-apples speedup or optimality proof. No production throughput extrapolation.",
    },
    null,
    2,
  ),
);
