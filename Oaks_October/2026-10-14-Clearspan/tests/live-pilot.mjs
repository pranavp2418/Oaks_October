import assert from "node:assert/strict";
import { sample, canonical } from "../src/workspace.mjs";
const base = process.argv[2];
if (!base?.startsWith("https://"))
  throw Error("Explicit hosted HTTPS base URL required");
const failedAttempts = [];
async function once(body) {
  const start = performance.now(),
    response = await fetch(base.replace(/\/$/, "") + "/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    }),
    value = await response.json();
  return { status: response.status, value, ms: performance.now() - start };
}
async function post(body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await once(body);
    const agent = ["agent_start","agent_continue"].includes(body.command?.kind);
    if (agent && !body.provider_failure && !body.fail && [400,503].includes(result.status)) {
      failedAttempts.push({command:body.command.id,attempt:attempt+1,status:result.status,error:result.value.error,saved_unchanged:result.value.saved_workspace_unchanged});
      if (attempt < 2) continue;
    }
    return result;
  }
}
const cases = [
    {
      name: "constrained_coverage",
      required: "plan_route",
      goal: "Use plan_route to compute maximum-priority coverage at the current budget. Explain omissions and return-to-base cost, then finish with exact evidence citations.",
      budget: 28,
    },
    {
      name: "budget_comparison",
      required: "compare_budgets",
      goal: "Call compare_budgets with budgets equal to [20,42] (an array of integers, never a string). Explain the coverage tradeoff, then finish with exact evidence citations.",
      budget: 42,
    },
    {
      name: "exclusion_audit",
      required: "inspect_map",
      goal: "Use inspect_map to explain supplied exclusions, current position and remaining budget. Finish with evidence citations. Do not approve, move or change anything.",
      budget: 42,
    },
  ],
  report = {
    recorded_at: new Date().toISOString(),
    passed: false,
    cases: [],
    failed_attempts: failedAttempts,
    scope:
      "visible development integration pilot; no held-out generalization claim",
  };
try {
  for (const c of cases.filter(c => !process.env.CASE_FILTER || c.name.includes(process.env.CASE_FILTER))) {
    let response = await post({
      command: {
        id: "import",
        kind: "import",
        args: { map: { ...sample(), budget: c.budget } },
      },
    });
    assert.equal(response.status, 200);
    let { workspace, state } = response.value;
    const initial = canonical({ map: state.map, mission: state.mission }),
      start = { id: "agent", kind: "agent_start", args: { goal: c.goal } },
      timings = [];
    response = await post({ workspace, command: start });
    assert.equal(response.status, 200, response.value.error);
    workspace = response.value.workspace;
    state = response.value.state;
    timings.push(response.ms);
    const duplicate = await post({
      workspace,
      command: start,
      provider_failure: true,
    });
    assert.equal(duplicate.status, 200, duplicate.value.error);
    assert.equal(canonical(duplicate.value.workspace), canonical(workspace));
    const injected = await post({
      workspace,
      command: { id: "not-saved", kind: "agent_continue", args: {} },
      provider_failure: true,
    });
    assert.equal(injected.status, 503);
    while (state.agent.phase === "CONTINUE") {
      response = await post({
        workspace,
        command: {
          id: "continue" + state.agent.decisions.length,
          kind: "agent_continue",
          args: {},
        },
      });
      assert.equal(response.status, 200, response.value.error);
      workspace = response.value.workspace;
      state = response.value.state;
      timings.push(response.ms);
    }
    assert.equal(state.agent.phase, "REVIEW");
    assert(state.agent.decisions.length <= 4);
    assert(state.agent.observations.some((o) => o.tool === c.required));
    assert.equal(
      canonical({ map: state.map, mission: state.mission }),
      initial,
    );
    const observation = state.agent.observations.find(
      (o) => o.tool === c.required,
    );
    if (c.required === "plan_route") {
      assert(observation.result.cost <= 28);
      assert.equal(observation.result.steps.length, observation.result.cost);
    }
    if (c.required === "compare_budgets") {
      const r = observation.result.sort((a, b) => a.budget - b.budget);
      assert(r.some((x) => x.budget === 20) && r.some((x) => x.budget === 42));
      assert(r[0].priority <= r.at(-1).priority);
    }
    if (c.required === "inspect_map") {
      assert(observation.result.exclusions.includes(13));
      assert.equal(observation.result.remaining, 42);
    }
    const receipts = state.agent.decisions.map((d) => d.provider);
    for (const receipt of receipts) {
      assert(receipt.generation_id && receipt.model);
      assert(receipt.usage?.total_tokens > 0);
      if (receipt.usage.cost !== undefined)
        assert.equal(Number(receipt.usage.cost), 0);
    }
    response = await post({
      workspace,
      command: { id: "review", kind: "agent_review", args: {} },
    });
    assert.equal(response.status, 200, response.value.error);
    workspace = response.value.workspace;
    state = response.value.state;
    assert.equal(state.agent.phase, "REVIEWED");
    const replay = await post({ workspace });
    assert.equal(replay.status, 200);
    assert.equal(canonical(replay.value.state), canonical(state));
    report.cases.push({
      name: c.name,
      passed: true,
      tool: c.required,
      decisions: receipts.length,
      receipts,
      citations: state.agent.citations,
      checkpoint: state.agent.checkpoint,
      mission_mutated: false,
      replay_equal: true,
      duplicate_no_inference: true,
      injected_provider_recovery: true,
      request_ms: timings,
      exact_observation: observation,
    });
  }
  report.passed = true;
} finally {
  console.log(JSON.stringify(report, null, 2));
}
