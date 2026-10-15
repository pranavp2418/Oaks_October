import express from "express";
import { readFile } from "node:fs/promises";
import { makeEngine } from "../src/engine.mjs";
import {
  empty,
  restore,
  apply,
  portable,
  binding,
  note,
  ident,
  canonical,
} from "../src/workspace.mjs";
import { makeInvestigator, toolSchemas } from "../server/agent.mjs";
import { chooseLive, ProviderUnavailable } from "../server/provider.mjs";
let enginePromise;
export const engine = () =>
  (enginePromise ??= readFile(
    new URL("../public/route.wasm", import.meta.url),
  ).then(makeEngine));
export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "256kb", strict: true }));
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.get("/api/workspace", (req, res) =>
  res.json({
    service: "Clearspan",
    schema: 1,
    mode: "bounded synthetic mission, C++/WASM route core, single-user decision journal",
  }),
);
app.post("/api/workspace", async (req, res) => {
  try {
    const route = await engine(),
      investigate = makeInvestigator(route),
      adapters = { engine: route, investigate };
    let state = req.body.workspace
        ? await restore(req.body.workspace, adapters)
        : empty(),
      command = req.body.command;
    if (command) {
      command = JSON.parse(JSON.stringify(command));
      ident(command.id);
      if (["agent_start", "agent_continue"].includes(command.kind)) {
        const operatorCommand = (c) => ({
          ...c,
          args: Object.fromEntries(
            Object.entries(c.args ?? {}).filter(([key]) => key !== "decision"),
          ),
        });
        const previous = state.journal.find((r) => r.command.id === command.id);
        if (previous) {
          if (
            canonical(operatorCommand(previous.command)) !==
            canonical(operatorCommand(command))
          )
            throw Error("Duplicate command ID has conflicting content");
          res.json({
            workspace: portable(state),
            state,
            boundary: "Single-user saved decision replay; no new inference",
          });
          return;
        }
        if (req.body.provider_failure === true)
          throw new ProviderUnavailable(
            "Injected provider interruption; saved checkpoint unchanged",
          );
        const goal =
          command.kind === "agent_start"
            ? note(command.args?.goal)
            : state.agent?.goal;
        if (!goal || !state.map)
          throw Error(
            "Current imported mission and investigation goal required",
          );
        if (
          command.kind === "agent_continue" &&
          state.agent?.phase !== "CONTINUE"
        )
          throw Error("Checkpoint must await continuation");
        if (
          command.kind === "agent_continue" &&
          (state.agent.binding !== (await binding(state)) ||
            state.agent.version !== state.version)
        )
          throw Error("Investigation is stale; start against current mission");
        if (
          command.kind === "agent_start" &&
          state.agentHistory.length + (state.agent ? 1 : 0) >= 4
        )
          throw Error("Four investigation bound reached");
        const token =
          process.env.AI_GATEWAY_API_KEY ||
          req.headers["x-vercel-oidc-token"] ||
          process.env.VERCEL_OIDC_TOKEN;
        const decision = await chooseLive(
          {
            goal,
            observations:
              command.kind === "agent_start" ? [] : state.agent.observations,
            tools: toolSchemas,
          },
          token,
        );
        command.args = { ...command.args, decision };
      }
      state = await apply(state, command, {
        ...adapters,
        fail: req.body.fail === true,
      });
    }
    res.json({
      workspace: portable(state),
      state,
      boundary:
        "Single-user browser persistence; original synthetic simulation, not physical robot operation",
    });
  } catch (e) {
    const code = e instanceof ProviderUnavailable ? 503 : 400;
    res
      .status(code)
      .json({
        error: String(e.message).slice(0, 600),
        recoverable: code === 503,
        saved_workspace_unchanged: true,
      });
  }
});
app.use((error, req, res, next) =>
  res
    .status(400)
    .json({
      error:
        error.type === "entity.too.large"
          ? "Request exceeds256KiB"
          : "Invalid JSON request",
      saved_workspace_unchanged: true,
    }),
);
export default app;
