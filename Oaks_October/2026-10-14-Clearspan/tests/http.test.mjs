import { test } from "node:test";
import assert from "node:assert/strict";
import app from "../api/workspace.mjs";
test("real HTTP mission segments, atomic failure, evidence review/closure and replay", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const url = `http://127.0.0.1:${server.address().port}/api/workspace`;
  let workspace,
    sequence = 0;
  async function send(kind, args = {}, extra = {}) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspace,
        command: kind ? { id: "http" + ++sequence, kind, args } : null,
        ...extra,
      }),
    });
    const v = await r.json();
    if (r.ok) workspace = v.workspace;
    return { status: r.status, ...v };
  }
  try {
    assert.equal(
      (
        await send("import", {
          map: {
            width: 3,
            height: 2,
            base: 0,
            budget: 9,
            blocked: [],
            targets: [{ id: "SEAL", cell: 2, priority: 7 }],
          },
        })
      ).status,
      200,
    );
    await send("plan");
    await send("review", { note: "Inspection path and return reviewed" });
    await send("start");
    const before = JSON.stringify(workspace),
      failure = await send("travel", {}, { fail: true });
    assert.equal(failure.status, 400);
    assert.equal(JSON.stringify(workspace), before);
    let result = await send("travel");
    assert.equal(result.state.mission.position, 2);
    assert.equal(result.state.mission.cursor, 2);
    result = await send("step", {
      result: "ISSUE",
      note: "Synthetic seal issue requires review",
    });
    assert.equal(result.state.mission.inspected.length, 1);
    result = await send("travel");
    assert.equal(result.state.mission.status, "RETURNED");
    assert.equal(result.state.mission.position, 0);
    assert.equal((await send("close", { note: "All returned" })).status, 400);
    await send("resolve", {
      target: "SEAL",
      note: "Second inspection accepted by reviewer",
    });
    result = await send("close", {
      note: "Returned and all findings resolved",
    });
    assert.equal(result.state.mission.status, "CLOSED");
    const saved = JSON.stringify(workspace);
    result = await send(null);
    assert.equal(result.state.mission.remaining, 4);
    assert.equal(JSON.stringify(workspace), saved);
    const invalid = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(invalid.status, 400);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
