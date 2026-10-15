import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeEngine } from "../src/engine.mjs";
import {
  validateMap,
  empty,
  apply,
  restore,
  portable,
  sample,
  canonical,
} from "../src/workspace.mjs";
import { makeInvestigator } from "../server/agent.mjs";
const engine = await makeEngine(
    await readFile(new URL("../public/route.wasm", import.meta.url)),
  ),
  adapters = { engine, investigate: makeInvestigator(engine) };
function distance(map, a, b) {
  const seen = new Set([a]),
    q = [[a, 0]];
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
function oracle(map) {
  let best = { priority: 0, cost: 0 };
  function go(at, left, cost, priority) {
    const total = cost + distance(map, at, map.base);
    if (
      total <= map.budget &&
      (priority > best.priority ||
        (priority === best.priority && total < best.cost))
    )
      best = { priority, cost: total };
    for (const t of left) {
      const c = cost + distance(map, at, t.cell) + 1;
      if (c <= map.budget)
        go(
          t.cell,
          left.filter((x) => x !== t),
          c,
          priority + t.priority,
        );
    }
  }
  go(map.base, map.targets, 0, 0);
  return best;
}
test("360 independent exhaustive route oracles, path/budget invariants", () => {
  let seed = 1423;
  const rand = (n) => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed % n;
  };
  for (let i = 0; i < 360; i++) {
    const cells = 16,
      blocked = Array.from({ length: cells }, (_, x) => x).filter(
        (x) => x !== 0 && rand(7) === 0,
      ),
      available = Array.from({ length: cells }, (_, x) => x).filter(
        (x) => !blocked.includes(x),
      );
    const targets = [];
    while (targets.length < Math.min(5, available.length)) {
      const c = available[rand(available.length)];
      if (!targets.some((t) => t.cell === c))
        targets.push({
          id: "T" + targets.length,
          cell: c,
          priority: 1 + rand(9),
        });
    }
    const map = validateMap({
        width: 4,
        height: 4,
        base: 0,
        budget: 1 + rand(23),
        blocked,
        targets,
      }),
      actual = engine(map),
      expected = oracle(map);
    assert.equal(actual.priority, expected.priority, "reward " + i);
    assert.equal(actual.cost, expected.cost, "cost " + i);
    assert.equal(actual.steps.length, actual.cost);
    let at = map.base,
      visited = new Set();
    for (const step of actual.steps) {
      assert(!blocked.includes(step.cell));
      if (step.kind === "move")
        assert.equal(distance({ ...map, blocked: [] }, at, step.cell), 1);
      else {
        assert.equal(at, step.cell);
        assert(!visited.has(at));
        visited.add(at);
      }
      at = step.cell;
    }
    assert.equal(at, map.base);
    assert(actual.cost <= map.budget);
  }
});
test("transactional lifecycle, duplicate/failure/replay, review and issue closure", async () => {
  let s = empty(),
    i = 0;
  const op = async (kind, args = {}) =>
    (s = await apply(s, { id: "c" + ++i, kind, args }, adapters));
  await op("import", {
    map: {
      width: 3,
      height: 2,
      base: 0,
      budget: 9,
      blocked: [],
      targets: [{ id: "A", cell: 2, priority: 5 }],
    },
  });
  await op("plan");
  await assert.rejects(() => op("start"), /Review/);
  await op("review", { note: "Exact route checked" });
  const before = canonical(s),
    cmd = { id: "start", kind: "start", args: {} };
  await assert.rejects(
    () => apply(s, cmd, { ...adapters, fail: true }),
    /Injected/,
  );
  assert.equal(canonical(s), before);
  s = await apply(s, cmd, adapters);
  assert.equal(await apply(s, cmd, adapters), s);
  await assert.rejects(
    () => apply(s, { ...cmd, args: { x: 1 } }, adapters),
    /conflicting/,
  );
  while (s.mission.status === "RUNNING")
    await op("step", { result: "ISSUE", note: "Synthetic seal inspection" });
  assert.equal(s.mission.position, 0);
  await assert.rejects(
    () => op("close", { note: "Reviewed route" }),
    /resolve/,
  );
  await op("resolve", {
    target: "A",
    note: "Reinspection accepted by reviewer",
  });
  await op("close", { note: "All findings reviewed and returned" });
  assert.equal(s.mission.status, "CLOSED");
  assert.equal(canonical(await restore(portable(s), adapters)), canonical(s));
  const bad = portable(s);
  bad.journal[0].command.args.map.width = 4;
  await assert.rejects(() => restore(bad, adapters), /integrity/);
});
test("pause/new exclusion invalidates review; replan starts from actual position", async () => {
  let s = await apply(
    empty(),
    { id: "i", kind: "import", args: { map: sample() } },
    adapters,
  );
  for (const kind of ["plan", "review", "start", "step", "pause"])
    s = await apply(
      s,
      { id: kind, kind, args: { note: "Verified map and route" } },
      adapters,
    );
  const position = s.mission.position,
    remaining = s.mission.remaining;
  s = await apply(
    s,
    { id: "block", kind: "exclude", args: { cell: 42, blocked: true } },
    adapters,
  );
  await assert.rejects(
    () => apply(s, { id: "bad", kind: "start" }, adapters),
    /Review/,
  );
  s = await apply(s, { id: "replan", kind: "plan" }, adapters);
  assert.equal(s.mission.position, position);
  assert.equal(s.mission.remaining, remaining);
  assert(!s.mission.route.steps.some((x) => x.cell === 42));
});
test("strict bounded input, return infeasibility and no mutation from24 bad choices", async () => {
  assert.throws(() => validateMap({ ...sample(), budget: true }));
  assert.throws(() => validateMap({ ...sample(), width: 17 }));
  assert.throws(() => validateMap({ ...sample(), base: 13 }));
  assert.throws(
    () =>
      engine(
        {
          width: 2,
          height: 2,
          base: 0,
          budget: 4,
          blocked: [1, 2],
          targets: [],
        },
        { position: 3, budget: 4, visited: [] },
      ),
    /unreachable/,
  );
  const s = await apply(
      empty(),
      { id: "i", kind: "import", args: { map: sample() } },
      adapters,
    ),
    before = canonical(s);
  for (let i = 0; i < 24; i++)
    await assert.rejects(() =>
      apply(
        s,
        {
          id: "a" + i,
          kind: "agent_start",
          args: {
            goal: "Inspect map safely",
            decision: {
              choice:
                i % 2
                  ? { tool: "move", arguments: {} }
                  : {
                      tool: "finish",
                      arguments: {
                        summary: "Invented answer",
                        citations: ["E99"],
                      },
                    },
            },
          },
        },
        adapters,
      ),
    );
  assert.equal(canonical(s), before);
});
test("real LangGraph human interrupt reconstructs checkpoints without inference", async () => {
  let s = await apply(
    empty(),
    { id: "i", kind: "import", args: { map: sample() } },
    adapters,
  );
  s = await apply(
    s,
    {
      id: "a",
      kind: "agent_start",
      args: {
        goal: "Explain achievable coverage",
        decision: { choice: { tool: "plan_route", arguments: {} } },
      },
    },
    adapters,
  );
  assert.equal(s.agent.phase, "CONTINUE");
  assert.equal(s.agent.observations[0].id, "E1");
  s = await restore(portable(s), adapters);
  s = await apply(
    s,
    {
      id: "b",
      kind: "agent_continue",
      args: {
        decision: {
          choice: {
            tool: "finish",
            arguments: {
              summary: "Review exact route evidence",
              citations: ["E1"],
            },
          },
        },
      },
    },
    adapters,
  );
  assert.equal(s.agent.phase, "REVIEW");
  s = await apply(s, { id: "r", kind: "agent_review", args: {} }, adapters);
  assert.equal(s.agent.phase, "REVIEWED");
  assert.deepEqual(s.agent.checkpoint.nodes, []);
  assert.equal(canonical(await restore(portable(s), adapters)), canonical(s));
});
