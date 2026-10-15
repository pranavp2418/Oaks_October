import { processCore } from "../server/engine.mjs";
import { chooseLive, ProviderUnavailable } from "../server/provider.mjs";
const canonical = (x) =>
    JSON.stringify(x, (_, v) =>
      v && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, v[k]]),
          )
        : v,
    ),
  operator = (c) => ({
    ...c,
    args: Object.fromEntries(
      Object.entries(c.args ?? {}).filter(([key]) => key !== "decision"),
    ),
  });
export async function execute(body, token) {
  const original = await processCore({ workspace: body.workspace ?? null });
  if (!original.ok) return { status: 400, body: original };
  let command = body.command;
  if (command && ["agent_start", "agent_continue"].includes(command.kind)) {
    const previous = original.workspace.journal.find(
      (e) => e.command.id === command.id,
    );
    if (previous) {
      if (
        canonical(operator(previous.command)) !== canonical(operator(command))
      )
        return {
          status: 400,
          body: {
            ok: false,
            error: "Duplicate command ID has conflicting content",
            saved_workspace_unchanged: true,
          },
        };
      return { status: 200, body: original };
    }
    const preflight = await processCore({
      workspace: original.workspace,
      command: {
        ...command,
        args: {
          ...command.args,
          decision: { choice: { tool: "inspect_contract", arguments: {} } },
        },
      },
    });
    if (!preflight.ok) return { status: 400, body: preflight };
    if (body.provider_failure === true)
      throw new ProviderUnavailable(
        "Injected provider interruption; saved checkpoint unchanged",
      );
    const state = original.state,
      goal =
        command.kind === "agent_start" ? command.args.goal : state.agent.goal,
      observations =
        command.kind === "agent_start" ? [] : state.agent.observations;
    const raw = await chooseLive(
      {
        goal,
        observations,
        tools: [
          { name: "inspect_contract", arguments: {} },
          { name: "check_equivalence", arguments: {} },
          {
            name: "minimize_trace",
            arguments: {
              symbols: "array of existing alphabet symbols, maximum128",
            },
          },
          { name: "suggest_patch", arguments: {} },
          {
            name: "finish",
            arguments: {
              summary: "3..2000 characters",
              citations: "existing E IDs",
            },
          },
        ],
      },
      token,
    );
    const record = {
      choice: raw.choice,
      provider: {
        generation_id: raw.provider.generation_id,
        model: raw.provider.model,
        usage: raw.provider.usage,
        cost: String(raw.provider.usage?.cost ?? "not_reported"),
      },
    };
    command = { ...command, args: { ...command.args, decision: record } };
  }
  const response = await processCore({
    workspace: original.workspace,
    command: command ?? null,
    fail: body.fail === true,
  });
  return { status: response.ok ? 200 : 400, body: response };
}
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    res.statusCode = 200;
    res.end(
      JSON.stringify({
        service: "Wirewake",
        core: "actual Go/WASM",
        mode: "single-user controlled finite protocol analysis",
      }),
    );
    return;
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "POST required" }));
    return;
  }
  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);
    if (
      !body ||
      Array.isArray(body) ||
      Buffer.byteLength(JSON.stringify(body)) > 262144
    )
      throw Error("Bounded JSON object required");
    const token =
        process.env.AI_GATEWAY_API_KEY ||
        req.headers["x-vercel-oidc-token"] ||
        process.env.VERCEL_OIDC_TOKEN,
      result = await execute(body, token);
    res.statusCode = result.status;
    res.end(JSON.stringify(result.body));
  } catch (e) {
    res.statusCode = e instanceof ProviderUnavailable ? 503 : 400;
    res.end(
      JSON.stringify({
        ok: false,
        error: String(e.message).slice(0, 600),
        saved_workspace_unchanged: true,
        recoverable: res.statusCode === 503,
      }),
    );
  }
}
