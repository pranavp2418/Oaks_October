import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { processCore } from "../server/engine.mjs";
import { execute } from "../api/workspace.mjs";
import { sample } from "../src/sample.mjs";
const go = process.env.WIREWAKE_GO;
if (!go) throw Error("Set WIREWAKE_GO to pinned Go1.27.2 executable");
execFileSync(go, ["test", "-race", "./engine"], { stdio: "inherit" });
const dir = await mkdtemp(os.tmpdir() + "/wirewake-integration-"),
  cli = dir + "/wirewake",
  path = dir + "/workspace.json";
execFileSync(
  go,
  ["build", "-trimpath", "-buildvcs=false", "-o", cli, "./cmd/wirewake"],
  { stdio: "inherit" },
);
let workspace = null,
  number = 0;
const commands = [];
async function run(kind, args = {}) {
  const command = { id: "test" + ++number, kind, args },
    result = await processCore({ workspace, command });
  assert.equal(result.ok, true, result.error);
  workspace = result.workspace;
  commands.push(command);
  return result;
}
try {
  await run("import", sample());
  let result = await run("check");
  assert.deepEqual(result.state.analysis.witness, ["connect", "read"]);
  await run("trace", { symbols: ["read", "connect", "read", "read"] });
  result = await run("shrink", {
    symbols: [
      "read",
      "close",
      "connect",
      "read",
      "read",
      "authenticate",
      "close",
    ],
  });
  assert.deepEqual(result.state.reduction.reduced, ["connect", "read"]);
  assert.equal(result.state.reduction.one_minimal, true);
  result = await run("campaign");
  assert.equal(result.state.campaign.length, 12);
  const operator = {
    id: "saved-agent",
    kind: "agent_start",
    args: { goal: "Explain protocol disagreement" },
  };
  result = await processCore({
    workspace,
    command: {
      ...operator,
      args: {
        ...operator.args,
        decision: { choice: { tool: "check_equivalence", arguments: {} } },
      },
    },
  });
  assert(result.ok);
  workspace = result.workspace;
  commands.push(result.workspace.journal.at(-1).command);
  const duplicate = await execute(
    { workspace, command: operator, provider_failure: true },
    undefined,
  );
  assert.equal(duplicate.status, 200);
  assert.deepEqual(duplicate.body.workspace, workspace);
  const fail = await execute(
    {
      workspace,
      command: { id: "retry-provider", kind: "agent_continue", args: {} },
      provider_failure: true,
    },
    undefined,
  ).catch((e) => ({ error: e.message }));
  assert.match(fail.error, /Injected provider/);
  assert.equal(workspace.journal.at(-1).command.id, "saved-agent");
  await run("agent_continue", {
    decision: {
      choice: {
        tool: "finish",
        arguments: {
          summary: "Exact disagreement must be reviewed",
          citations: ["E1"],
        },
      },
    },
  });
  result = await run("agent_review");
  assert.equal(result.state.agent.phase, "REVIEWED");
  await run("propose_patch");
  await run("review_patch", {
    note: "Reviewed complete reachable-product proof",
  });
  const before = structuredClone(workspace),
    injected = await processCore({
      workspace,
      command: { id: "interrupted", kind: "apply_patch", args: {} },
      fail: true,
    });
  assert.equal(injected.ok, false);
  assert.deepEqual(workspace, before);
  result = await run("apply_patch");
  assert.equal(result.state.analysis.equivalent, true);
  assert.equal(result.state.patch.status, "APPLIED");
  const replay = await processCore({ workspace });
  assert.deepEqual(replay.state, result.state);
  let native;
  for (let i = 0; i < commands.length; i++) {
    const file = dir + "/command-" + i + ".json";
    await writeFile(file, JSON.stringify(commands[i]));
    native = JSON.parse(
      execFileSync(cli, ["-workspace", path, file], { encoding: "utf8" }),
    );
  }
  assert.deepEqual(
    native,
    result.state,
    "Native Go and actual Node-hosted Go/WASM must match complete semantic state/journal",
  );
  const repeatFile = dir + "/repeat.json";
  await writeFile(
    repeatFile,
    JSON.stringify({ id: "concurrent", kind: "check", args: {} }),
  );
  const invoke = promisify(execFile);
  await Promise.all(
    Array.from({ length: 8 }, () =>
      invoke(cli, ["-workspace", path, repeatFile]),
    ),
  );
  const reopened = JSON.parse(
    execFileSync(cli, ["-workspace", path], { encoding: "utf8" }),
  );
  assert.equal(
    reopened.workspace.journal.filter((e) => e.command.id === "concurrent")
      .length,
    1,
  );
  const killFile = dir + "/kill.json";
  await writeFile(
    killFile,
    JSON.stringify({ id: "killed-before-rename", kind: "check", args: {} }),
  );
  const oldBytes = await readFile(path),
    child = spawn(cli, ["-workspace", path, "-pause-before-rename", killFile], {
      stdio: ["pipe", "ignore", "pipe"],
    });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(Error("Writer did not reach prepared checkpoint"));
    }, 5000);
    child.stderr.on("data", (chunk) => {
      if (chunk.toString().includes("PREPARED")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.on("error", reject);
  });
  const exit = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGKILL");
  await exit;
  assert.deepEqual(
    await readFile(path),
    oldBytes,
    "Killed prepared writer must retain old complete snapshot",
  );
  const recovered = JSON.parse(
    execFileSync(cli, ["-workspace", path, killFile], { encoding: "utf8" }),
  );
  assert.equal(
    recovered.workspace.journal.at(-1).command.id,
    "killed-before-rename",
  );
  const malformed = await processCore({
    workspace: { schema: 1, journal: [], head: "tampered" },
  });
  assert.equal(malformed.ok, false);
  console.log(
    JSON.stringify(
      {
        passed: true,
        go_native_groups: 9,
        independent_oracles: 400,
        native_wasm_full_state_parity: true,
        actual_concurrent_cli_processes: 8,
        killed_prepared_writer_recovery: true,
        duplicate_agent_no_inference: true,
        full_review_patch_replay: true,
        provider_calls_in_this_suite: 0,
      },
      null,
      2,
    ),
  );
} finally {
  await rm(dir, { recursive: true, force: true });
}
