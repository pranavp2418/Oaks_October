import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig, motion, useReducedMotion } from "motion/react";
import { TransitionPanel } from "./transition-panel";
import { openStore, read, save, empty } from "./journal.mjs";
import { sample } from "./sample";
import { resolveSku } from "./selection.mjs";
import { PerformanceEvidence } from "./performance-evidence";
import type { Result, Workspace } from "./types";
import "./style.css";

const tabs = [
  "Allocation desk",
  "Agent notebook",
  "Stock & exceptions",
  "Evidence room",
];
const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 12)}`;
const pretty = (x: unknown) => JSON.stringify(x, null, 2);
function download(name: string, data: unknown) {
  const u = URL.createObjectURL(
    new Blob([pretty(data)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
}
async function request(
  workspace: Workspace,
  command?: any,
  scenario?: any,
): Promise<Result> {
  const r = await fetch("/api/workspace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspace,
      ...(command ? { command } : {}),
      ...(scenario ? { scenario } : {}),
    }),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error ?? `Request failed (${r.status})`);
  return data;
}
function App() {
  const [record, setRecord] = useState<any>(empty()),
    [result, setResult] = useState<Result | null>(null),
    [tab, setTab] = useState(0),
    [busy, setBusy] = useState("Opening saved desk…"),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [note, setNote] = useState(""),
    [goal, setGoal] = useState(
      "Which orders are short, and what replenishment would reduce the shortage?",
    ),
    [runId, setRunId] = useState(""),
    [planId, setPlanId] = useState(""),
    [exclude, setExclude] = useState(""),
    [demand, setDemand] = useState(100),
    [scenario, setScenario] = useState<any>(null),
    [failure, setFailure] = useState(false),
    [recallLot, setRecallLot] = useState(""),
    [reason, setReason] = useState(""),
    [sku, setSku] = useState("APPLE"),
    [quantity, setQuantity] = useState(8),
    [arrival, setArrival] = useState(1),
    [expiry, setExpiry] = useState(7),
    [location, setLocation] = useState(0),
    [editor, setEditor] = useState<"dataset" | "workspace" | null>(null),
    [input, setInput] = useState(""),
    [storageAvailable, setStorageAvailable] = useState(false),
    [manualReducedMotion, setManualReducedMotion] = useState(false);
  const db = useRef<any>(null),
    locked = useRef(false),
    file = useRef<HTMLInputElement>(null),
    editorRef = useRef<HTMLDialogElement>(null),
    preferredReducedMotion = useReducedMotion();
  const reduceMotion = manualReducedMotion || preferredReducedMotion;
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        db.current = await openStore();
        const saved = await read(db.current);
        const res = await request(saved.workspace);
        if (live) {
          setRecord(saved);
          setResult(res);
          setStorageAvailable(true);
        }
      } catch (e) {
        if (live) setError(String((e as Error).message));
      } finally {
        if (live) setBusy("");
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (editor) editorRef.current?.showModal();
    else editorRef.current?.close();
  }, [editor]);
  const selectedSku = resolveSku(result?.state.orders ?? [], sku);
  const state = result?.state,
    solution = scenario ?? result?.solution,
    plan = state?.plans.find((p) => p.id === planId) ?? state?.plans[0],
    agent = result?.agents.find((a) => a.id === runId) ?? result?.agents.at(-1),
    disabled = !!busy || !storageAvailable;
  async function act(kind: string, args: any, extras: any = {}) {
    if (locked.current) return;
    locked.current = true;
    setBusy(
      kind.startsWith("agent")
        ? "Waiting for a bounded agent step…"
        : "Checking inventory and saving…",
    );
    setError("");
    setMessage("");
    try {
      const command = { id: id("op"), kind, args, ...extras };
      const res = await request(record.workspace, command);
      const next = await save(db.current, record.revision, res.workspace);
      setRecord(next);
      setResult(res);
      setScenario(null);
      setMessage(
        `${kind.replaceAll("_", " ")} saved · receipt ${res.state.receipts} · local revision ${next.revision}`,
      );
      if (kind === "agent_start") setRunId(args.run_id);
      if (kind === "plan") setPlanId(args.plan_id);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy("");
      locked.current = false;
    }
  }
  async function reload() {
    if (locked.current) return;
    locked.current = true;
    setBusy("Reopening saved journal…");
    setError("");
    try {
      const saved = await read(db.current);
      const res = await request(saved.workspace);
      setRecord(saved);
      setResult(res);
      setScenario(null);
      setMessage(
        "Saved operations and recorded agent decisions restored. No model was called.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      locked.current = false;
    }
  }
  async function preview() {
    if (locked.current) return;
    locked.current = true;
    setBusy("Solving scenario…");
    setError("");
    try {
      const res = await request(record.workspace, undefined, {
        ...(exclude ? { exclude_lot: exclude } : {}),
        demand_percent: demand,
      });
      setScenario(res.solution);
      setMessage("Scenario only. No inventory or plans changed.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      locked.current = false;
    }
  }
  async function restore() {
    if (locked.current) return;
    locked.current = true;
    setBusy("Validating imported journal…");
    setError("");
    try {
      if (input.length > 262144) throw Error("Import exceeds 256 KiB.");
      const imported = JSON.parse(input);
      if (editor === "dataset") {
        locked.current = false;
        if (await act("import", { data: imported })) setEditor(null);
        return;
      }
      const res = await request(imported);
      const next = await save(db.current, record.revision, res.workspace);
      setRecord(next);
      setResult(res);
      setScenario(null);
      setMessage(
        "Portable workspace validated and restored. Provider metadata is not a signed attestation.",
      );
      setEditor(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
      locked.current = false;
    }
  }
  const total = state?.lots.reduce((s, l) => s + l.quantity, 0) ?? 0,
    reserved = state?.lots.reduce((s, l) => s + l.reserved, 0) ?? 0,
    picked = state?.lots.reduce((s, l) => s + l.picked, 0) ?? 0,
    free = total - reserved - picked,
    short =
      solution?.shortages.reduce((s: number, o: any) => s + o.quantity, 0) ?? 0;
  const operations =
    state?.allocations.filter((a) => a.plan === plan?.id) ?? [];
  const badge = (s: string) => (
    <span className={`badge ${/BLOCK|RECALL|SHORT/.test(s) ? "bad" : ""}`}>
      {s.replaceAll("_", " ")}
    </span>
  );
  function openEditor(mode: "dataset" | "workspace") {
    setInput(mode === "dataset" ? pretty(sample()) : "");
    setEditor(mode);
  }
  return (
    <MotionConfig reducedMotion={reduceMotion ? "always" : "user"}>
      <div className="shell">
        <aside className="rail">
          <a
            className="brand"
            href="#workbench"
            aria-label="MorrowStock workbench"
          >
            <span className="brandmark" aria-hidden="true">
              m.
            </span>
            <span>
              Morrow<span className="brandstock">Stock</span>
            </span>
          </a>
          <p className="rail-kicker">THE INVENTORY DESK</p>
          <nav aria-label="Workbench sections">
            {tabs.map((t, i) => (
              <button
                key={t}
                aria-current={tab === i ? "page" : undefined}
                onClick={() => setTab(i)}
              >
                <span aria-hidden="true">0{i + 1}</span>
                {t}
                {i === 1 && agent ? (
                  <i aria-label="Agent checkpoint saved" />
                ) : null}
              </button>
            ))}
          </nav>
          <div className="rail-bottom">
            <p>
              Synthetic cases.
              <br />
              Real constraints.
            </p>
            <small>Single-user journal · no external stock movements</small>
            <a
              href="https://github.com/pranavp2418/Oaks_October/tree/main/Oaks_October/2026-10-14-MorrowStock"
              target="_blank"
              rel="noreferrer"
            >
              Source & operating guide ↗
            </a>
          </div>
        </aside>
        <main id="workbench">
          <header className="topbar">
            <span className="status-dot" /> <span>LOCAL WORKSPACE</span>
            <span className="topbar-right">
              Revision {record.revision} · inventory v
              {state?.inventory_version ?? 0}
            </span>
            <button className="quiet" onClick={reload} disabled={disabled}>
              Reopen saved
            </button>
            <button className="quiet" onClick={() => openEditor("workspace")} disabled={disabled}>
              Restore workspace
            </button>
            <button
              className="quiet"
              onClick={() =>
                download("morrowstock-workspace.json", record.workspace)
              }
              disabled={!result || !!busy}
            >
              Export workspace ↓
            </button>
          </header>
          <div className="page-heading">
            <div>
              <p className="eyebrow">
                {
                  [
                    "MAKE EVERY CASE COUNT",
                    "FOLLOW THE EVIDENCE",
                    "HANDLE THE EXCEPTION",
                    "LEAVE A CLEAR TRAIL",
                  ][tab]
                }
              </p>
              <h1>{tabs[tab]}</h1>
              <p>
                {
                  [
                    "Allocate dated stock. Review the tradeoffs. Pick with a traceable receipt.",
                    "A read-only investigator. One model decision, one checkpoint, your review.",
                    "Lot exposure and replenishment, connected to the same inventory ledger.",
                    "Inspect receipts, invariants and the exact inputs behind each decision.",
                  ][tab]
                }
              </p>
            </div>
            <div className="workspace-stamp">
              <strong>{String(state?.receipts ?? 0).padStart(2, "0")}</strong>
              <span>stock receipts</span>
            </div>
          </div>
          <div className="feedback" aria-live="polite" aria-atomic="true">
            {busy ? (
              <p className="working">
                <span className="spinner" />
                {busy}
              </p>
            ) : message ? (
              <p className="success">✓ {message}</p>
            ) : (
              <p>
                Saved locally in this browser. Export before moving devices.
              </p>
            )}
          </div>
          {error && (
            <div className="error" role="alert">
              <strong>Operation not saved.</strong> {error}
              <button className="quiet" onClick={() => setError("")}>
                Dismiss
              </button>
            </div>
          )}
          {!state?.lots.length && (
            <section className="empty">
              <span className="crate-symbol" aria-hidden="true">
                ▤
              </span>
              <h2>A fresh desk, ready for stock.</h2>
              <p>
                Load 12 synthetic lots and 12 dated orders, or validate your own
                bounded case dataset. Days are planning offsets, not calendar
                dates.
              </p>
              <div className="actions">
                <button
                  className="primary"
                  disabled={disabled}
                  onClick={() => act("import", { data: sample() })}
                >
                  Load synthetic workspace
                </button>
                <button
                  disabled={disabled}
                  onClick={() => openEditor("dataset")}
                >
                  Import dataset JSON
                </button>
                <button
                  disabled={disabled}
                  onClick={() => openEditor("workspace")}
                >
                  Restore workspace
                </button>
              </div>
            </section>
          )}
          {!!state?.lots.length && (
            <>
              <section
                className="quantity-ribbon"
                aria-label="Inventory conservation"
              >
                <div className="quantity-copy">
                  <span>CASES ON THE LEDGER</span>
                  <strong>{total}</strong>
                  <p>
                    {free} free + {reserved} reserved + {picked} picked ={" "}
                    {total}
                  </p>
                </div>
                <div className="ribbon-detail">
                  <div
                    className="stackbar"
                    role="img"
                    aria-label={`${free} free, ${reserved} reserved, ${picked} picked of ${total} cases`}
                  >
                    <span
                      className="free"
                      style={{ width: `${(free / total) * 100}%` }}
                    />
                    <span
                      className="reserved"
                      style={{ width: `${(reserved / total) * 100}%` }}
                    />
                    <span
                      className="picked"
                      style={{ width: `${(picked / total) * 100}%` }}
                    />
                  </div>
                  <div className="legend">
                    <span>
                      <i className="free" />
                      Free {free}
                    </span>
                    <span>
                      <i className="reserved" />
                      Reserved {reserved}
                    </span>
                    <span>
                      <i className="picked" />
                      Picked {picked}
                    </span>
                    <span className="shortage">Unfilled {short}</span>
                  </div>
                </div>
              </section>
              <TransitionPanel
                activeIndex={tab}
                transition={{
                  duration: reduceMotion ? 0 : 0.18,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
                variants={{
                  enter: { opacity: 0, y: reduceMotion ? 0 : 8 },
                  center: { opacity: 1, y: 0 },
                  exit: { opacity: 0, y: reduceMotion ? 0 : -4 },
                }}
              >
                <section aria-label="Allocation workflow">
                  <div className="split">
                    <div>
                      <div className="section-head">
                        <div>
                          <p className="eyebrow">01 / CHECK THE PLAN</p>
                          <h2>
                            {scenario
                              ? "Scenario allocation"
                              : "Current allocation"}
                          </h2>
                        </div>
                        <span className="metric">
                          {solution?.served ?? 0} cases served
                        </span>
                      </div>
                      <p className="muted">
                        Exact integral flow: arrival ≤ due ≤ expiry. Distance +
                        holding cost, with priority-weighted shortages.
                      </p>
                      <div className="scenario">
                        <label>
                          Exclude lot
                          <select
                            value={exclude}
                            onChange={(e) => setExclude(e.target.value)}
                          >
                            <option value="">None · all active lots</option>
                            {state.lots.map((l) => (
                              <option key={l.id}>{l.id}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Demand %
                          <input
                            type="number"
                            min="50"
                            max="150"
                            value={demand}
                            onChange={(e) => setDemand(Number(e.target.value))}
                          />
                        </label>
                        <button onClick={preview} disabled={disabled}>
                          Compare scenario
                        </button>
                        {scenario && (
                          <button
                            className="quiet"
                            onClick={() => setScenario(null)}
                          >
                            Return to baseline
                          </button>
                        )}
                      </div>
                      <div className="table-wrap">
                        <table>
                          <caption className="sr-only">
                            Proposed allocation, not yet reserved
                          </caption>
                          <thead>
                            <tr>
                              <th>Lot → order</th>
                              <th>Cases</th>
                              <th>Unit cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {solution?.allocations.map((a: any, i: number) => (
                              <tr key={i}>
                                <td>
                                  <strong>{a.lot}</strong>
                                  <span className="arrow">→</span>
                                  {a.order}
                                </td>
                                <td>{a.quantity}</td>
                                <td>{a.unit_cost}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {!!solution?.shortages.length && (
                        <div className="shortage-box">
                          <h3>Shortages need a decision</h3>
                          {solution.shortages.map((s: any) => (
                            <p key={s.order}>
                              <strong>{s.order}</strong> · {s.sku} ·{" "}
                              {s.quantity} cases unfilled · priority{" "}
                              {s.priority}
                            </p>
                          ))}
                        </div>
                      )}
                      <div className="solver-stats">
                        <span>
                          Objective {solution?.objective?.toLocaleString()}
                        </span>
                        <span>
                          {solution?.metrics?.augmentations} augmentations
                        </span>
                        <span>
                          {solution?.metrics?.elapsed_ms?.toFixed(2)} ms · this
                          request, not a benchmark
                        </span>
                      </div>
                    </div>
                    <aside className="review-sheet">
                      <p className="eyebrow">02 / OPERATOR SIGN-OFF</p>
                      <h2>Review, then reserve.</h2>
                      <p>
                        Agent text cannot approve stock operations. A draft is
                        bound to its inventory version and digest.
                      </p>
                      <button
                        className="primary full"
                        disabled={disabled}
                        onClick={() =>
                          act("plan", {
                            plan_id: id("plan"),
                            expected_version: state.inventory_version,
                          })
                        }
                      >
                        Create baseline draft
                      </button>
                      {state.plans.length > 0 && (
                        <label className="plan-selector">
                          Saved plans
                          <select
                            value={plan?.id ?? ""}
                            onChange={(e) => setPlanId(e.target.value)}
                          >
                            {state.plans.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.id} · {p.status}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {plan && (
                        <>
                          <div className="plan-summary">
                            <strong>{plan.id}</strong>
                            {badge(plan.status)}
                            <code>SHA256 {plan.digest.slice(0, 16)}…</code>
                            <span>Source inventory v{plan.version}</span>
                          </div>
                          <label>
                            Review / exception note
                            <textarea
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              maxLength={500}
                              placeholder="Explain the allocation or exception (8+ characters)."
                            />
                          </label>
                          <div className="actions vertical">
                            <button
                              disabled={
                                disabled ||
                                plan.status !== "DRAFT" ||
                                note.trim().length < 8
                              }
                              onClick={() =>
                                act("review", {
                                  plan_id: plan.id,
                                  plan_digest: plan.digest,
                                  note,
                                })
                              }
                            >
                              Record review
                            </button>
                            <label className="checkbox">
                              <input
                                type="checkbox"
                                checked={failure}
                                onChange={(e) => setFailure(e.target.checked)}
                              />
                              Inject precommit interruption
                            </label>
                            <button
                              className="primary"
                              disabled={disabled || plan.status !== "REVIEWED"}
                              onClick={() =>
                                act(
                                  "reserve",
                                  {
                                    plan_id: plan.id,
                                    plan_digest: plan.digest,
                                  },
                                  failure ? { fail_before_commit: true } : {},
                                )
                              }
                            >
                              Reserve reviewed stock
                            </button>
                            <button
                              disabled={
                                disabled ||
                                !["RESERVED", "PICKING", "BLOCKED"].includes(
                                  plan.status,
                                ) ||
                                note.trim().length < 8
                              }
                              onClick={() =>
                                act("release", { plan_id: plan.id, note })
                              }
                            >
                              Release unpicked reservations
                            </button>
                          </div>
                          <h3>Pick queue</h3>
                          {!operations.length ? (
                            <p className="muted">
                              Reserve this draft to create pick lines.
                            </p>
                          ) : (
                            <ul className="pick-list">
                              {operations.map((a) => (
                                <li key={a.line}>
                                  <div>
                                    <strong>
                                      {a.lot} → {a.order_id}
                                    </strong>
                                    <span>
                                      {a.quantity} cases ·{" "}
                                      {a.status.toLowerCase()}
                                    </span>
                                  </div>
                                  <button
                                    disabled={
                                      disabled ||
                                      a.status !== "RESERVED" ||
                                      !["RESERVED", "PICKING"].includes(
                                        plan.status,
                                      )
                                    }
                                    onClick={() =>
                                      act("pick", {
                                        plan_id: plan.id,
                                        line: a.line,
                                      })
                                    }
                                  >
                                    Pick line {a.line + 1}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </aside>
                  </div>
                </section>
                <section aria-label="Agent investigation">
                  <div className="split">
                    <div>
                      <div className="section-head">
                        <div>
                          <p className="eyebrow">READ-ONLY BY CONSTRUCTION</p>
                          <h2>Ask. Inspect. Continue.</h2>
                        </div>
                        <span className="badge">4 decisions maximum</span>
                      </div>
                      <div className="notice">
                        <strong>Only synthetic inventory is sent.</strong> The
                        zero-priced provider may retain prompts and responses.
                        No paid fallback. All model suggestions require your
                        review; citations prove observation membership, not
                        prose truth.
                      </div>
                      <label>
                        Investigation goal
                        <textarea
                          value={goal}
                          onChange={(e) => setGoal(e.target.value)}
                          maxLength={600}
                        />
                      </label>
                      <button
                        className="primary"
                        disabled={
                          disabled ||
                          goal.trim().length < 8 ||
                          result!.agents.length >= 8
                        }
                        onClick={() =>
                          act("agent_start", { run_id: id("run"), goal })
                        }
                      >
                        Start bounded investigation
                      </button>
                      <div className="run-select">
                        <label>
                          Saved investigations
                          <select
                            value={agent?.id ?? ""}
                            onChange={(e) => setRunId(e.target.value)}
                          >
                            <option value="" disabled>
                              Choose a saved investigation
                            </option>
                            {result!.agents.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.id} · {a.status}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      {agent && (
                        <>
                          <div className="agent-heading">
                            <h3>{agent.goal}</h3>
                            {badge(agent.status)}
                          </div>
                          <ol className="evidence-list">
                            {agent.observations.map((o: any) => (
                              <li key={o.id}>
                                <div className="evidence-id">{o.id}</div>
                                <div>
                                  <h3>{o.tool.replaceAll("_", " ")}</h3>
                                  <code>
                                    Inventory v{o.inventory_version} ·{" "}
                                    {o.result_digest.slice(0, 16)}…
                                  </code>
                                  <details>
                                    <summary>Inspect exact observation</summary>
                                    <pre>{pretty(o.result)}</pre>
                                  </details>
                                </div>
                              </li>
                            ))}
                          </ol>
                          {agent.summary && (
                            <div className="agent-summary">
                              <p className="eyebrow">
                                MODEL PROPOSAL · NOT AN APPROVAL
                              </p>
                              <p>{agent.summary.summary}</p>
                              <span>
                                Citations: {agent.summary.citations.join(", ")}
                              </span>
                            </div>
                          )}
                          <div className="actions">
                            <button
                              disabled={
                                disabled ||
                                !agent.checkpoint_pending.length ||
                                agent.pending?.tool === "finish"
                              }
                              onClick={() =>
                                act("agent_continue", { run_id: agent.id })
                              }
                            >
                              Continue one decision
                            </button>
                            <button
                              disabled={
                                disabled || !agent.checkpoint_pending.length
                              }
                              onClick={() =>
                                act("agent_review", { run_id: agent.id })
                              }
                            >
                              Close as reviewed evidence
                            </button>
                            <button
                              className="quiet"
                              disabled={
                                disabled ||
                                !agent.checkpoint_pending.length ||
                                agent.pending?.tool === "finish"
                              }
                              onClick={() =>
                                act(
                                  "agent_continue",
                                  { run_id: agent.id },
                                  { inject_failure: true },
                                )
                              }
                            >
                              Test interruption
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <aside className="notebook-side">
                      <p className="eyebrow">TOOLS, NOT A BLANK CHEQUE</p>
                      <h2>Five ways to investigate.</h2>
                      <ol>
                        <li>Inspect conserved inventory</li>
                        <li>Optimize allocation</li>
                        <li>Stress a missing lot / demand</li>
                        <li>Trace lot exposure</li>
                        <li>Propose replenishment</li>
                      </ol>
                      <p>
                        LangChain validates tool arguments. LangGraph
                        checkpoints each step. Reservation, recall, picking and
                        receiving are excluded from the agent’s toolset.
                      </p>
                      <h3>Provider receipts</h3>
                      {agent?.decisions.map((d: any, i: number) => (
                        <details key={i}>
                          <summary>
                            Decision {i + 1} · {d.choice.tool}
                          </summary>
                          <pre>{pretty(d.provider)}</pre>
                        </details>
                      ))}
                      <p className="fine">
                        A restored JSON journal is user-editable. Its provider
                        metadata is not a signed attestation. A lost network
                        response may repeat a model request on retry; saved
                        decisions are never re-requested on replay.
                      </p>
                    </aside>
                  </div>
                </section>
                <section aria-label="Inventory exceptions">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">01 / FOLLOW THE LOT</p>
                      <h2>Stock ledger</h2>
                    </div>
                    <button
                      disabled={disabled}
                      onClick={() => openEditor("workspace")}
                    >
                      Restore portable workspace
                    </button>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <caption className="sr-only">
                        Stock quantities and planning windows
                      </caption>
                      <thead>
                        <tr>
                          <th>Lot / SKU</th>
                          <th>Window</th>
                          <th>Free / held / picked</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.lots.map((l) => (
                          <tr key={l.id}>
                            <td>
                              <strong>{l.id}</strong>
                              <small>
                                {l.sku} · location {l.location}
                              </small>
                            </td>
                            <td>
                              Day {l.arrival}–{l.expiry}
                            </td>
                            <td>
                              {l.free} / {l.reserved} / {l.picked}
                            </td>
                            <td>{badge(l.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="split exception-split">
                    <section className="recall">
                      <p className="eyebrow">02 / CONTAIN AN EXCEPTION</p>
                      <h2>Recall a synthetic lot</h2>
                      <p>
                        Blocks unpicked work on affected plans. Already picked
                        cases remain in the trace; recall does not erase their
                        history.
                      </p>
                      <label>
                        Lot to recall
                        <select
                          value={recallLot}
                          onChange={(e) => setRecallLot(e.target.value)}
                        >
                          <option value="">Select a lot</option>
                          {state.lots
                            .filter((l) => l.status === "ACTIVE")
                            .map((l) => (
                              <option key={l.id}>{l.id}</option>
                            ))}
                        </select>
                      </label>
                      <label>
                        Recall reason
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          maxLength={500}
                          placeholder="Explain this synthetic exception (8+ characters)."
                        />
                      </label>
                      <button
                        className="danger"
                        disabled={
                          disabled || !recallLot || reason.trim().length < 8
                        }
                        onClick={() =>
                          act("recall", { lot_id: recallLot, reason })
                        }
                      >
                        Record recall & block exposure
                      </button>
                      {state.lots
                        .filter((l) => l.status === "RECALLED")
                        .map((l) => (
                          <details key={l.id}>
                            <summary>{l.id} · inspect exposure</summary>
                            <pre>
                              {pretty(
                                state.allocations.filter(
                                  (a) =>
                                    a.lot === l.id && a.status !== "RELEASED",
                                ),
                              )}
                            </pre>
                          </details>
                        ))}
                    </section>
                    <section className="replenishment">
                      <p className="eyebrow">03 / CLOSE THE SHORTAGE LOOP</p>
                      <h2>Propose replenishment</h2>
                      <p>
                        A proposal is not an external order. Review it, then
                        receive a synthetic lot into the same ledger.
                      </p>
                      <div className="form-grid">
                        <label>
                          SKU
                          <select
                            value={selectedSku}
                            onChange={(e) => setSku(e.target.value)}
                          >
                            {[
                              ...new Set(
                                state.orders.map((o) => String(o.sku)),
                              ),
                            ].map((s) => (
                              <option key={s}>{s}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Cases
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={quantity}
                            onChange={(e) =>
                              setQuantity(Number(e.target.value))
                            }
                          />
                        </label>
                        <label>
                          Arrival day
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={arrival}
                            onChange={(e) => setArrival(Number(e.target.value))}
                          />
                        </label>
                        <label>
                          Expiry day
                          <input
                            type="number"
                            min={arrival}
                            max="30"
                            value={expiry}
                            onChange={(e) => setExpiry(Number(e.target.value))}
                          />
                        </label>
                        <label>
                          Location
                          <input
                            type="number"
                            min="0"
                            max="20"
                            value={location}
                            onChange={(e) =>
                              setLocation(Number(e.target.value))
                            }
                          />
                        </label>
                      </div>
                      <button
                        disabled={disabled}
                        onClick={() =>
                          act("purchase", {
                            purchase_id: id("purchase"),
                            sku: selectedSku,
                            quantity,
                            arrival,
                            expiry,
                            location,
                          })
                        }
                      >
                        Create proposal
                      </button>
                      <label>
                        Purchase review note
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          maxLength={500}
                          placeholder="Explain the replenishment choice (8+ characters)."
                        />
                      </label>
                      {state.purchases.map((p) => (
                        <div className="purchase" key={p.id}>
                          <strong>
                            {p.body.quantity} × {p.body.sku}
                          </strong>
                          {badge(p.status)}
                          <small>
                            {p.id} · days {p.body.arrival}–{p.body.expiry}
                          </small>
                          <div className="actions">
                            <button
                              disabled={
                                disabled ||
                                p.status !== "PROPOSED" ||
                                note.trim().length < 8
                              }
                              onClick={async () => {
                                const b = record.workspace.journal.find(
                                  (j: any) =>
                                    j.kind === "purchase" &&
                                    j.args.purchase_id === p.id,
                                );
                                if (!b) return;
                                const body = {
                                  sku: p.body.sku,
                                  quantity: p.body.quantity,
                                  arrival: p.body.arrival,
                                  expiry: p.body.expiry,
                                  location: p.body.location,
                                };
                                const bytes = new TextEncoder().encode(
                                  JSON.stringify(
                                    body,
                                    Object.keys(body).sort(),
                                  ),
                                );
                                const hash = Array.from(
                                  new Uint8Array(
                                    await crypto.subtle.digest(
                                      "SHA-256",
                                      bytes,
                                    ),
                                  ),
                                )
                                  .map((v) => v.toString(16).padStart(2, "0"))
                                  .join("");
                                await act("review_purchase", {
                                  purchase_id: p.id,
                                  purchase_digest: hash,
                                  note,
                                });
                              }}
                            >
                              Review proposal
                            </button>
                            <button
                              className="primary"
                              disabled={disabled || p.status !== "REVIEWED"}
                              onClick={() =>
                                act("receive", {
                                  purchase_id: p.id,
                                  lot_id: id("received"),
                                })
                              }
                            >
                              Receive lot
                            </button>
                          </div>
                        </div>
                      ))}
                    </section>
                  </div>
                </section>
                <section aria-label="Audit evidence">
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">REPLAYABLE, NOT INFALLIBLE</p>
                      <h2>The operational record</h2>
                    </div>
                    <button
                      className="primary"
                      disabled={disabled}
                      onClick={() =>
                        download("morrowstock-evidence.json", {
                          workspace: record.workspace,
                          state,
                          agents: result!.agents,
                          solution: result!.solution,
                          boundary: result!.boundary,
                        })
                      }
                    >
                      Export evidence dossier ↓
                    </button>
                  </div>
                  <div className="audit-summary">
                    <div>
                      <span>Stock conservation</span>
                      <strong>
                        {total === free + reserved + picked ? "PASS" : "CHECK"}
                      </strong>
                    </div>
                    <div>
                      <span>Persisted operations</span>
                      <strong>{record.workspace.journal.length} / 80</strong>
                    </div>
                    <div>
                      <span>Agent investigations</span>
                      <strong>{result!.agents.length} / 8</strong>
                    </div>
                    <div>
                      <span>Storage boundary</span>
                      <strong>This browser</strong>
                    </div>
                  </div>
                  <p className="muted">
                    SQLite foreign keys and transaction checks run for every
                    replay. The hash chain detects inconsistent edits; it is not
                    externally anchored, immutable or a compliance certificate.
                  </p>
                  <div className="hash-line">
                    <span>AUDIT HEAD</span>
                    <code>{state.audit_head}</code>
                  </div>
                  <ol className="audit-list">
                    {[...state.audit].reverse().map((a) => {
                      const body = JSON.parse(a.body);
                      return (
                        <li key={a.seq}>
                          <span className="seq">
                            {String(a.seq).padStart(2, "0")}
                          </span>
                          <div>
                            <h3>{body.kind.replaceAll("_", " ")}</h3>
                            <code>{body.operation}</code>
                            <details>
                              <summary>Inspect operation and receipt</summary>
                              <pre>{pretty(body)}</pre>
                            </details>
                          </div>
                          <span className="audit-check">Chain checked ✓</span>
                        </li>
                      );
                    })}
                  </ol>
                  <details>
                    <summary>Inspect demand priorities</summary>
                    <pre>{pretty(state.orders)}</pre>
                  </details>
                  <details>
                    <summary>
                      Inspect complete portable operation journal
                    </summary>
                    <pre>{pretty(record.workspace)}</pre>
                  </details>
                  <p className="fine">
                    No real people, customers, purchases or supply-chain events.
                    Planning costs are integer synthetic units. Browser data can
                    be cleared; exports are your backup. No shared database,
                    identity, tenant isolation or production-scale claims.
                  </p>
                </section>
              </TransitionPanel>
            </>
          )}
          <label className="check"><input type="checkbox" checked={manualReducedMotion} onChange={e=>setManualReducedMotion(e.target.checked)}/>Reduce motion</label>
          <PerformanceEvidence/>
          <footer>
            <span>MorrowStock / synthetic inventory workbench</span>
            <span>
              Exact allocation. Explicit approvals. Inspectable evidence.
            </span>
          </footer>
        </main>
        <dialog
          ref={editorRef}
          onCancel={() => setEditor(null)}
          aria-labelledby="import-title"
        >
          <div className="dialog-head">
            <h2 id="import-title">
              {editor === "dataset"
                ? "Import case dataset"
                : "Restore workspace journal"}
            </h2>
            <button
              aria-label="Close import dialog"
              onClick={() => setEditor(null)}
            >
              ×
            </button>
          </div>
          <p>
            {editor === "dataset"
              ? "Exactly lots and orders; up to 32 rows and 400 cases per collection. Empty workspace only."
              : "Restores schema-1 operation JSON, not an opaque database. Revalidates every state transition without calling a model. Replaces this browser’s current workspace after validation."}
          </p>
          {error && (
            <div className="error" role="alert">
              <strong>Import not saved.</strong> {error}
            </div>
          )}
          <label>
            JSON content
            <textarea
              className="json-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={262144}
            />
          </label>
          <input
            ref={file}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 262144) {
                setError("File exceeds 256 KiB.");
                return;
              }
              setInput(await f.text());
            }}
          />
          <div className="actions">
            <button disabled={disabled} onClick={() => file.current?.click()}>
              Choose JSON file
            </button>
            <button
              className="primary"
              disabled={disabled || !input.trim()}
              onClick={restore}
            >
              Validate & {editor === "dataset" ? "import" : "restore"}
            </button>
            <button onClick={() => setEditor(null)}>Cancel</button>
          </div>
        </dialog>
      </div>
    </MotionConfig>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
