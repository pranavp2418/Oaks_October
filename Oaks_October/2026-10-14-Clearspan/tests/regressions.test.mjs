import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { makeEngine } from "../src/engine.mjs";
import { empty, apply, portable, sample } from "../src/workspace.mjs";
import { makeInvestigator } from "../server/agent.mjs";
import app from "../api/workspace.mjs";
const route = await makeEngine(
    await readFile(new URL("../public/route.wasm", import.meta.url)),
  ),
  investigate = makeInvestigator(route),
  adapters = { engine: route, investigate };
test("malformed array-valued tool name is rejected rather than property-coerced", async () => {
  await assert.rejects(
    () =>
      investigate(
        sample(),
        { position: 70, budget: 42, visited: [] },
        "Inspect map safely",
        [{ choice: { tool: ["inspect_map"], arguments: {} } }],
      ),
    /Invalid bounded/,
  );
});
test("actual HTTP duplicate agent command replays saved decision before provider/failure path", async () => {
  let state = await apply(
    empty(),
    { id: "i", kind: "import", args: { map: sample() } },
    adapters,
  );
  const operator = {
    id: "agent",
    kind: "agent_start",
    args: { goal: "Inspect map safely" },
  };
  state = await apply(
    state,
    {
      ...operator,
      args: {
        ...operator.args,
        decision: { choice: { tool: "inspect_map", arguments: {} } },
      },
    },
    adapters,
  );
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/workspace`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: portable(state),
          command: operator,
          provider_failure: true,
        }),
      },
    );
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).workspace, portable(state));
    const conflict = await fetch(
      `http://127.0.0.1:${server.address().port}/api/workspace`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace: portable(state),
          command: { ...operator, args: { goal: "Changed goal" } },
        }),
      },
    );
    assert.equal(conflict.status, 400);
    assert.match((await conflict.json()).error, /conflicting/);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
