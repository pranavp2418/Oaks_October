export const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, v[k]]),
        )
      : v,
  );
export async function hash(value) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical(value)),
      ),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
const copy = (x) => JSON.parse(JSON.stringify(x));
export function integer(x, min, max, label) {
  if (!Number.isSafeInteger(x) || x < min || x > max)
    throw Error(`${label} must be an integer ${min}–${max}`);
  return x;
}
export function ident(x) {
  if (typeof x !== "string" || !/^[-A-Za-z0-9_]{1,48}$/.test(x))
    throw Error(
      "Identifier must contain 1–48 letters, digits, hyphens or underscores",
    );
  return x;
}
export function note(x) {
  if (typeof x !== "string" || x.trim().length < 3 || x.length > 500)
    throw Error("Review/evidence note requires 3–500 characters");
  return x.trim();
}
export function validateMap(x) {
  if (!x || typeof x !== "object" || Array.isArray(x))
    throw Error("Map object required");
  const width = integer(x.width, 2, 16, "Width"),
    height = integer(x.height, 2, 16, "Height"),
    cells = width * height,
    base = integer(x.base, 0, cells - 1, "Base"),
    budget = integer(x.budget, 1, 512, "Budget");
  if (
    !Array.isArray(x.blocked) ||
    x.blocked.length > cells ||
    !Array.isArray(x.targets) ||
    x.targets.length > 10
  )
    throw Error("Bounded blocked cells and at most10 targets required");
  const blocked = [
    ...new Set(x.blocked.map((c) => integer(c, 0, cells - 1, "Exclusion"))),
  ].sort((a, b) => a - b);
  if (blocked.includes(base)) throw Error("Base cannot be excluded");
  const targets = x.targets.map((t) => ({
    id: ident(t.id),
    cell: integer(t.cell, 0, cells - 1, "Checkpoint"),
    priority: integer(t.priority, 1, 100, "Priority"),
  }));
  if (
    new Set(targets.map((t) => t.id)).size !== targets.length ||
    new Set(targets.map((t) => t.cell)).size !== targets.length
  )
    throw Error("Checkpoint IDs and cells must be unique");
  return { width, height, base, budget, blocked, targets };
}
export const empty = () => ({
  schema: 1,
  map: null,
  version: 0,
  mission: null,
  agent: null,
  agentHistory: [],
  journal: [],
  head: "0".repeat(64),
});
export const context = (s) => ({
  position: s.mission?.position ?? s.map.base,
  budget: s.mission?.remaining ?? s.map.budget,
  visited: s.mission?.inspected.map((x) => x.id) ?? [],
});
export async function binding(s) {
  return hash({ map: s.map, version: s.version, context: context(s) });
}
export function usableRoute(engine, map, ctx) {
  const usable = {
    ...map,
    targets: map.targets.filter((t) => !map.blocked.includes(t.cell)),
  };
  const r = engine(usable, ctx);
  return {
    ...r,
    uncovered: map.targets
      .filter((t) => !ctx.visited.includes(t.id) && !r.covered.includes(t.id))
      .map((t) => ({
        id: t.id,
        reason: map.blocked.includes(t.cell)
          ? "excluded"
          : "budget or disconnected",
      })),
  };
}
export async function apply(
  current,
  command,
  { engine, investigate, fail = false } = {},
) {
  if (!command || typeof command !== "object")
    throw Error("Command object required");
  const { id, kind, args = {} } = command;
  ident(id);
  const fingerprint = await hash(command),
    previous = current.journal.find((r) => r.command.id === id);
  if (previous) {
    if (previous.fingerprint !== fingerprint)
      throw Error("Duplicate command ID has conflicting content");
    return current;
  }
  if (current.journal.length >= 120)
    throw Error(
      "120-operation bound reached; export evidence and start a separate workspace",
    );
  const s = copy(current),
    m = s.mission;
  if (kind === "import") {
    if (m && !["CLOSED", "CANCELLED"].includes(m.status))
      throw Error("Close or cancel active mission before replacing map");
    s.map = validateMap(args.map);
    s.version++;
    s.mission = null;
    s.agent = null;
  } else {
    if (!s.map) throw Error("Import a map first");
    if (kind === "plan") {
      if (m && ["RUNNING", "CLOSED", "CANCELLED"].includes(m.status))
        throw Error("Pause before replanning, or import a new mission map");
      const ctx = context(s),
        route = usableRoute(engine, s.map, ctx);
      delete route.milliseconds;
      route.start = ctx.position;
      s.mission = {
        ...(m ?? {
          position: s.map.base,
          remaining: s.map.budget,
          spent: 0,
          inspected: [],
          issues: [],
        }),
        status: "DRAFT",
        route,
        cursor: 0,
        review: null,
        binding: await binding(s),
      };
    } else if (kind === "review") {
      if (!m || m.status !== "DRAFT" || m.binding !== (await binding(s)))
        throw Error("Current draft and matching map/mission version required");
      m.review = { note: note(args.note), binding: m.binding };
      m.status = "REVIEWED";
    } else if (kind === "start") {
      if (
        !m ||
        m.status !== "REVIEWED" ||
        m.review?.binding !== (await binding(s))
      )
        throw Error("Review the current route before starting");
      m.status = m.route.steps.length ? "RUNNING" : "RETURNED";
    } else if (kind === "step") {
      if (!m || m.status !== "RUNNING") throw Error("Mission must be RUNNING");
      const step = m.route.steps[m.cursor];
      if (!step || m.remaining < 1 || s.map.blocked.includes(step.cell))
        throw Error("Step is blocked or budget exhausted; pause and replan");
      if (step.kind === "move") {
        const a = m.position,
          b = step.cell;
        if (
          Math.abs((a % s.map.width) - (b % s.map.width)) +
            Math.abs(
              Math.floor(a / s.map.width) - Math.floor(b / s.map.width),
            ) !==
          1
        )
          throw Error("Route move must be adjacent");
        m.position = b;
      } else {
        const target = s.map.targets.find((t) => t.cell === m.position);
        if (
          !target ||
          step.cell !== m.position ||
          m.inspected.some((t) => t.id === target.id)
        )
          throw Error("Inspection must be at a new checkpoint");
        if (!["PASS", "ISSUE"].includes(args.result))
          throw Error("Inspection result must be PASS or ISSUE");
        const entry = {
          id: target.id,
          cell: target.cell,
          result: args.result,
          note: note(args.note),
        };
        m.inspected.push(entry);
        if (args.result === "ISSUE")
          m.issues.push({ ...entry, status: "OPEN", resolution: null });
      }
      m.spent++;
      m.remaining--;
      m.cursor++;
      if (m.cursor === m.route.steps.length) m.status = "RETURNED";
    } else if (kind === "travel") {
      if (
        !m ||
        m.status !== "RUNNING" ||
        m.route.steps[m.cursor]?.kind !== "move"
      )
        throw Error(
          "Running movement segment required; record the inspection at this checkpoint first",
        );
      while (
        m.cursor < m.route.steps.length &&
        m.route.steps[m.cursor].kind === "move"
      ) {
        const b = m.route.steps[m.cursor].cell,
          a = m.position;
        if (
          s.map.blocked.includes(b) ||
          m.remaining < 1 ||
          Math.abs((a % s.map.width) - (b % s.map.width)) +
            Math.abs(
              Math.floor(a / s.map.width) - Math.floor(b / s.map.width),
            ) !==
            1
        )
          throw Error("Movement segment invalid; pause and replan");
        m.position = b;
        m.spent++;
        m.remaining--;
        m.cursor++;
      }
      if (m.cursor === m.route.steps.length) m.status = "RETURNED";
    } else if (kind === "pause") {
      if (!m || m.status !== "RUNNING")
        throw Error("Only a running mission can pause");
      m.status = "PAUSED";
    } else if (kind === "exclude") {
      if (m && !["PAUSED", "DRAFT", "REVIEWED"].includes(m.status))
        throw Error("Pause the mission before changing exclusions");
      const cell = integer(
        args.cell,
        0,
        s.map.width * s.map.height - 1,
        "Cell",
      );
      if (cell === s.map.base || cell === (m?.position ?? s.map.base))
        throw Error("Cannot exclude base or current position");
      if (typeof args.blocked !== "boolean")
        throw Error("Exclusion status must be boolean");
      s.map.blocked = args.blocked
        ? [...new Set([...s.map.blocked, cell])].sort((a, b) => a - b)
        : s.map.blocked.filter((c) => c !== cell);
      s.version++;
      if (m) {
        m.status = "PAUSED";
        m.review = null;
      }
      if (s.agent) s.agent.phase = "STALE";
    } else if (kind === "resolve") {
      const issue = m?.issues.find((i) => i.id === args.target);
      if (!issue || issue.status !== "OPEN")
        throw Error("Open inspection issue required");
      issue.resolution = note(args.note);
      issue.status = "RESOLVED";
    } else if (kind === "close") {
      if (
        !m ||
        m.status !== "RETURNED" ||
        m.position !== s.map.base ||
        m.issues.some((i) => i.status !== "RESOLVED")
      )
        throw Error("Return to base and resolve open issues before closure");
      m.closure = note(args.note);
      m.status = "CLOSED";
    } else if (kind === "cancel") {
      if (!m || ["CLOSED", "CANCELLED"].includes(m.status))
        throw Error("Active mission required");
      m.cancellation = note(args.note);
      m.status = "CANCELLED";
    } else if (
      kind === "agent_start" ||
      kind === "agent_continue" ||
      kind === "agent_review"
    ) {
      if (!investigate) throw Error("Agent execution adapter unavailable");
      if (kind === "agent_start") {
        if (s.agentHistory.length + (s.agent ? 1 : 0) >= 4)
          throw Error("Four investigation bound reached");
        if (s.agent) s.agentHistory.push(s.agent);
        s.agent = {
          goal: note(args.goal),
          version: s.version,
          binding: await binding(s),
          decisions: [],
          phase: "START",
          context: context(s),
        };
      }
      const a = s.agent;
      if (!a || a.version !== s.version || a.binding !== (await binding(s)))
        throw Error("Investigation is stale; start against current mission");
      if (kind === "agent_continue" && a.phase !== "CONTINUE")
        throw Error("Only interrupted investigations can continue");
      if (kind === "agent_review" && a.phase !== "REVIEW")
        throw Error("Cited final evidence required before review");
      const decisions =
        kind === "agent_review" ? a.decisions : [...a.decisions, args.decision];
      if (decisions.some((d) => !d?.choice))
        throw Error("Recorded model choice required");
      const checked = await investigate(
        s.map,
        a.context,
        a.goal,
        decisions,
        kind === "agent_review",
      );
      s.agent = { ...a, ...checked, decisions };
    } else throw Error("Unknown command");
  }
  if (s.mission) {
    const x = s.mission;
    if (x.remaining + x.spent !== s.map.budget || x.remaining < 0)
      throw Error("Budget conservation failed");
    if (x.status === "CLOSED" && x.position !== s.map.base)
      throw Error("Closed mission must be at base");
  }
  if (
    s.agent &&
    !kind.startsWith("agent_") &&
    s.agent.binding !== (await binding(s))
  )
    s.agent.phase = "STALE";
  if (fail)
    throw Error(
      "Injected precommit interruption. Saved workspace is unchanged; retry the same command.",
    );
  const entry = { command: copy(command), fingerprint, previous: s.head };
  entry.hash = await hash(entry);
  s.journal.push(entry);
  s.head = entry.hash;
  if (new TextEncoder().encode(JSON.stringify(portable(s))).length > 262144)
    throw Error(
      "Workspace256KiB bound reached; export before creating a separate workspace",
    );
  return s;
}
export async function restore(value, adapters) {
  if (
    value?.schema !== 1 ||
    !Array.isArray(value.journal) ||
    value.journal.length > 120 ||
    new TextEncoder().encode(JSON.stringify(value)).length > 262144
  )
    throw Error("Schema1 workspace with at most120 entries/256KiB required");
  let s = empty();
  for (const entry of value.journal) {
    if (
      entry.previous !== s.head ||
      entry.fingerprint !== (await hash(entry.command)) ||
      entry.hash !==
        (await hash({
          command: entry.command,
          fingerprint: entry.fingerprint,
          previous: entry.previous,
        }))
    )
      throw Error("Journal integrity mismatch");
    s = await apply(s, entry.command, adapters);
  }
  if (value.head !== s.head) throw Error("Workspace head mismatch");
  return s;
}
export function portable(s) {
  return { schema: 1, journal: s.journal, head: s.head };
}
export const sample = () => ({
  width: 10,
  height: 8,
  base: 70,
  budget: 42,
  blocked: [13, 23, 33, 43, 53, 55, 56, 57, 58, 25, 35],
  targets: [
    { id: "PUMP", cell: 11, priority: 8 },
    { id: "VALVE", cell: 18, priority: 5 },
    { id: "SEAL", cell: 41, priority: 9 },
    { id: "GAUGE", cell: 67, priority: 6 },
    { id: "JOINT", cell: 76, priority: 4 },
    { id: "PANEL", cell: 6, priority: 3 },
  ],
});
