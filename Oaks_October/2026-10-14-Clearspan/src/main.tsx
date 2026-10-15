import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig, useReducedMotion } from "motion/react";
import { TransitionPanel } from "./transition-panel";
import { empty, sample, portable, context } from "./workspace.mjs";
import { openStore, read, save } from "./store.mjs";
import "./style.css";
import { PerformanceEvidence } from "./performance-evidence";
type Any = any;
function download(name: string, value: Any) {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function App() {
  const [state, setState] = useState<Any>(empty()),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("Opening saved mission…"),
    [tab, setTab] = useState(0),
    [selected, setSelected] = useState(0),
    [review, setReview] = useState(
      "Checked exclusion boundaries, priorities and return reserve.",
    ),
    [result, setResult] = useState("PASS"),
    [inspection, setInspection] = useState(
      "Synthetic inspection recorded by operator.",
    ),
    [goal, setGoal] = useState(
      "Compute a safe inspection route and explain which checkpoints are missed. Use plan_route, then finish with evidence citations.",
    ),
    [failure, setFailure] = useState(false),
    [providerFailure, setProviderFailure] = useState(false),
    [modal, setModal] = useState(""),
    [text, setText] = useState(""),
    [dialogError, setDialogError] = useState("");
  const db = useRef<Any>(null),
    lastFailure = useRef(""),
    dialog = useRef<HTMLDialogElement>(null),
    cells = useRef<(HTMLButtonElement | null)[]>([]),
    reduced = useReducedMotion();
  async function request(body: Any) {
    const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      v = await r.json();
    if (!r.ok) throw Error(v.error ?? "Mission request failed");
    return v;
  }
  async function reopen() {
    setBusy(true);
    setError("");
    try {
      db.current ??= await openStore();
      const record = await read(db.current);
      const v = await request({ workspace: record.workspace });
      setRevision(record.revision);
      setState(v.state);
      setNotice(
        record.workspace
          ? "Saved mission reopened without new inference."
          : "Ready for an original synthetic mission.",
      );
    } catch (e: Any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    reopen();
  }, []);
  useEffect(() => {
    if (modal) {
      setDialogError("");
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [modal]);
  async function run(kind: string, args: Any = {}) {
    setBusy(true);
    setError("");
    setNotice(
      kind.startsWith("agent_")
        ? "Investigating with bounded tools…"
        : "Checking and committing mission command…",
    );
    try {
      const v = await request({
          workspace: portable(state),
          command: { id: crypto.randomUUID(), kind, args },
          fail: failure,
          provider_failure: providerFailure,
        }),
        record = await save(db.current, revision, v.workspace);
      setState(v.state);
      setRevision(record.revision);
      setNotice(
        "Saved · " +
          kind.replaceAll("_", " ") +
          " · revision " +
          record.revision,
      );
      return true;
    } catch (e: Any) {
      lastFailure.current = e.message;
      setError(e.message);
      setNotice(
        "Saved mission retained. Correct the issue or reopen before retrying.",
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  function open(which: string) {
    setText(which === "map" ? JSON.stringify(sample(), null, 2) : "");
    setModal(which);
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDialogError("");
    try {
      const value = JSON.parse(text);
      if (modal === "map") {
        if (await run("import", { map: value })) setModal("");
        else setDialogError(lastFailure.current);
      } else {
        if (
          value?.schema !== 1 ||
          !Array.isArray(value.journal) ||
          typeof value.head !== "string"
        )
          throw Error("Schema1 exported workspace required");
        setBusy(true);
        const v = await request({ workspace: value }),
          record = await save(db.current, revision, v.workspace);
        setState(v.state);
        setRevision(record.revision);
        setNotice("Validated workspace restored without inference.");
        setModal("");
      }
    } catch (e: Any) {
      setDialogError(e.message);
    } finally {
      setBusy(false);
    }
  }
  const map = state.map,
    m = state.mission,
    a = state.agent,
    ctx = map ? context(state) : { position: 0, budget: 0, visited: [] },
    next = m?.route.steps[m.cursor],
    routeCells = m
      ? [m.route.start, ...m.route.steps.map((s: Any) => s.cell)]
      : [],
    point = (cell: number) =>
      `${(cell % map.width) * 40 + 20},${Math.floor(cell / map.width) * 40 + 20}`;
  const operation = (
    kind: string,
    args: Any = {},
    label?: string,
    disabled = false,
  ) => (
    <button disabled={busy || disabled} onClick={() => run(kind, args)}>
      {label ?? kind}
    </button>
  );
  return (
    <MotionConfig reducedMotion="user">
      <div className="shell" aria-busy={busy}>
        <a className="skip" href="#workbench">
          Skip to mission workbench
        </a>
        <header>
          <a className="brand" href="/" aria-label="Clearspan home">
            <span className="brandmark">C↗</span>
            <span>
              CLEARSPAN<small>INSPECTION OPERATIONS</small>
            </span>
          </a>
          <div className="header-actions">
            <span className="synthetic">SYNTHETIC MISSION</span>
            <button onClick={() => open("map")} disabled={busy}>
              Import map
            </button>
            <button onClick={() => open("restore")} disabled={busy}>
              Restore
            </button>
            <button
              disabled={busy || !map}
              onClick={() =>
                download("clearspan-workspace.json", portable(state))
              }
            >
              Export workspace
            </button>
          </div>
        </header>
        <section className="intro">
          <div>
            <p className="eyebrow">A CLEAR PATH. A REVIEWED DECISION.</p>
            <h1>
              Inspect what matters.
              <br />
              <span>Make it back safely.</span>
            </h1>
            <p>
              Plan priority coverage around exclusions, review every mission,
              and retain the evidence behind each decision.
            </p>
          </div>
          <div className="coordinate">
            <span>MISSION CONTROL</span>
            <strong>{m?.status ?? "AWAITING MAP"}</strong>
            <small>
              Local revision {revision} · map version {state.version}
            </small>
            <small>Single-user simulation · no physical equipment</small>
          </div>
        </section>
        <nav aria-label="Workbench sections">
          {["Mission planner", "Planning agent", "Findings & proof"].map(
            (name, i) => (
              <button
                key={name}
                aria-current={tab === i ? "page" : undefined}
                onClick={() => setTab(i)}
              >
                <span>0{i + 1}</span>
                {name}
              </button>
            ),
          )}
        </nav>
        <div className="feedback" role="status">
          {busy && <span className="loading" aria-hidden="true" />}
          {notice}
        </div>
        {error && (
          <div className="error" role="alert">
            {error}
            <button disabled={busy} onClick={reopen}>
              Reopen saved workspace
            </button>
          </div>
        )}
        <main id="workbench">
          <TransitionPanel
            activeIndex={tab}
            transition={{
              duration: reduced ? 0 : 0.16,
              ease: [0.22, 0.61, 0.36, 1],
            }}
            variants={{
              enter: { opacity: 0, y: reduced ? 0 : 6 },
              center: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: reduced ? 0 : -6 },
            }}
          >
            {[
              <section key="planner" className="planner">
                <aside className="rail">
                  <p className="eyebrow">MISSION BRIEF</p>
                  <h2>Coverage with a return reserve.</h2>
                  <p>
                    One energy unit per cell movement or inspection. Excluded
                    cells are never traversed.
                  </p>
                  {!map ? (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => run("import", { map: sample() })}
                    >
                      Load synthetic mission
                    </button>
                  ) : (
                    <>
                      <div className="metrics">
                        <div>
                          <strong>{m?.remaining ?? map.budget}</strong>
                          <span>energy remaining</span>
                        </div>
                        <div>
                          <strong>
                            {m?.inspected.length ?? 0}/{map.targets.length}
                          </strong>
                          <span>checkpoints inspected</span>
                        </div>
                        <div>
                          <strong>{m?.route.priority ?? "—"}</strong>
                          <span>planned priority covered</span>
                        </div>
                      </div>
                      {operation(
                        "plan",
                        {},
                        m ? "Replan remaining coverage" : "Compute exact route",
                        ![
                          "PAUSED",
                          "DRAFT",
                          "REVIEWED",
                          "RETURNED",
                          undefined,
                        ].includes(m?.status),
                      )}
                      <p className="fine">
                        The C++ core evaluates reachable checkpoint subsets and
                        reconstructs a cell-by-cell route.
                      </p>
                      <label>
                        Selected cell
                        <input
                          type="number"
                          min="0"
                          max={map.width * map.height - 1}
                          value={selected}
                          onChange={(e) => setSelected(Number(e.target.value))}
                        />
                      </label>
                      {operation(
                        "exclude",
                        {
                          cell: selected,
                          blocked: !map.blocked.includes(selected),
                        },
                        map.blocked.includes(selected)
                          ? "Remove exclusion"
                          : "Add exclusion",
                        !!m &&
                          !["PAUSED", "DRAFT", "REVIEWED"].includes(m.status),
                      )}
                      <p className="fine">
                        Pause a running mission before changing exclusions. Any
                        old route approval is invalidated.
                      </p>
                    </>
                  )}
                </aside>
                <div className="map-section">
                  <div className="section-title">
                    <h2>Inspection field</h2>
                    <span>
                      ORTHOGONAL GRID /{" "}
                      {map ? `${map.width} × ${map.height}` : "NO MAP"}
                    </span>
                  </div>
                  {map ? (
                    <>
                      <div className="map-scroll">
                        <div
                          className="map"
                          style={{
                            width: `${map.width * 40}px`,
                            height: `${map.height * 40}px`,
                          }}
                        >
                          <div
                            className="cell-grid"
                            style={{
                              gridTemplateColumns: `repeat(${map.width},40px)`,
                            }}
                            role="group"
                            aria-label="Inspection map. Arrow keys move cell focus."
                          >
                            {Array.from(
                              { length: map.width * map.height },
                              (_, cell) => {
                                const t = map.targets.find(
                                    (t: Any) => t.cell === cell,
                                  ),
                                  blocked = map.blocked.includes(cell),
                                  here = cell === ctx.position,
                                  done = m?.inspected.some(
                                    (t: Any) => t.cell === cell,
                                  );
                                return (
                                  <button
                                    ref={(el) => {
                                      cells.current[cell] = el;
                                    }}
                                    key={cell}
                                    tabIndex={selected === cell ? 0 : -1}
                                    onKeyDown={(e) => {
                                      const shift = (
                                        {
                                          ArrowLeft: -1,
                                          ArrowRight: 1,
                                          ArrowUp: -map.width,
                                          ArrowDown: map.width,
                                        } as Any
                                      )[e.key];
                                      if (shift) {
                                        e.preventDefault();
                                        const n = Math.max(
                                          0,
                                          Math.min(
                                            map.width * map.height - 1,
                                            cell + shift,
                                          ),
                                        );
                                        setSelected(n);
                                        cells.current[n]?.focus();
                                      }
                                    }}
                                    onClick={() => setSelected(cell)}
                                    aria-label={`Cell ${cell}${cell === map.base ? ", base" : ""}${blocked ? ", excluded" : ""}${t ? ", checkpoint " + t.id : ""}${here ? ", current position" : ""}`}
                                    aria-pressed={selected === cell}
                                    className={[
                                      blocked ? "blocked" : "",
                                      here ? "here" : "",
                                      t ? "target" : "",
                                      done ? "inspected" : "",
                                      selected === cell ? "selected" : "",
                                    ].join(" ")}
                                  >
                                    <span>
                                      {cell === map.base
                                        ? "⌂"
                                        : here
                                          ? "●"
                                          : blocked
                                            ? "×"
                                            : t
                                              ? String(t.priority)
                                              : "·"}
                                    </span>
                                    {t && <small>{t.id.slice(0, 3)}</small>}
                                  </button>
                                );
                              },
                            )}
                          </div>
                          {m && (
                            <svg
                              className="route"
                              viewBox={`0 0 ${map.width * 40} ${map.height * 40}`}
                              aria-hidden="true"
                            >
                              <polyline
                                points={routeCells.map(point).join(" ")}
                                fill="none"
                                stroke="#0b6c9e"
                                strokeWidth="3"
                                strokeDasharray="5 4"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                      <div className="legend">
                        <span>⌂ base</span>
                        <span>● current position</span>
                        <span>number = priority</span>
                        <span>× exclusion</span>
                        <span>✓ inspected</span>
                      </div>
                      <div className="targets">
                        {map.targets.map((t: Any) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setSelected(t.cell);
                              cells.current[t.cell]?.focus();
                            }}
                          >
                            <strong>{t.id}</strong>
                            <small>
                              cell {t.cell} · priority {t.priority}
                            </small>
                            <span>
                              {m?.inspected.some((i: Any) => i.id === t.id)
                                ? "INSPECTED"
                                : m?.route.covered.includes(t.id)
                                  ? "PLANNED"
                                  : "UNVISITED"}
                            </span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="empty-map">
                      <span>＋</span>
                      <h3>The field is ready when you are.</h3>
                      <p>
                        Load the reproducible synthetic mission, or import your
                        own bounded synthetic map.
                      </p>
                      <button
                        disabled={busy}
                        onClick={() => run("import", { map: sample() })}
                      >
                        Load synthetic mission
                      </button>
                    </div>
                  )}
                </div>
                <aside className="dispatch">
                  <p className="eyebrow">DISPATCH & RECOVERY</p>
                  <h2>
                    {m
                      ? "Review, then move."
                      : "Every mission begins with a plan."}
                  </h2>
                  {m ? (
                    <>
                      <div className="route-summary">
                        <strong>{m.route.cost} energy</strong>
                        <span>
                          {m.route.covered.length} checkpoints ·{" "}
                          {m.route.priority} priority · return included
                        </span>
                      </div>
                      <label>
                        Operator review note
                        <textarea
                          value={review}
                          maxLength={500}
                          onChange={(e) => setReview(e.target.value)}
                        />
                      </label>
                      {operation(
                        "review",
                        { note: review },
                        "Review current route",
                        m.status !== "DRAFT",
                      )}
                      {operation(
                        "start",
                        {},
                        "Start reviewed mission",
                        m.status !== "REVIEWED",
                      )}
                      {m.review && (
                        <p className="success">
                          ✓ Review bound to this exact map and mission position.
                        </p>
                      )}
                      <hr />
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={failure}
                          onChange={(e) => setFailure(e.target.checked)}
                        />
                        Inject precommit interruption
                      </label>
                      {m.status === "RUNNING" && (
                        <>
                          <p className="next">
                            NEXT:{" "}
                            {next?.kind === "inspect"
                              ? "Inspect checkpoint at cell " + next.cell
                              : "Travel toward cell " + next?.cell}
                          </p>
                          {next?.kind === "inspect" ? (
                            <>
                              <label>
                                Inspection outcome
                                <select
                                  value={result}
                                  onChange={(e) => setResult(e.target.value)}
                                >
                                  <option>PASS</option>
                                  <option>ISSUE</option>
                                </select>
                              </label>
                              <label>
                                Inspection evidence
                                <textarea
                                  value={inspection}
                                  onChange={(e) =>
                                    setInspection(e.target.value)
                                  }
                                  maxLength={500}
                                />
                              </label>
                              {operation(
                                "step",
                                { result, note: inspection },
                                "Record inspection",
                              )}
                            </>
                          ) : (
                            operation("travel", {}, "Travel to next checkpoint")
                          )}
                          {operation("pause", {}, "Pause mission")}
                        </>
                      )}
                      {m.status === "PAUSED" && (
                        <p className="warning">
                          Mission paused. Change exclusions, replan from cell{" "}
                          {m.position}, review and resume with {m.remaining}{" "}
                          energy.
                        </p>
                      )}
                      {m.status === "RETURNED" && (
                        <>
                          {operation(
                            "close",
                            { note: review },
                            "Close returned mission",
                          )}
                          <p>
                            Resolve all open inspection findings before closure.
                          </p>
                        </>
                      )}
                      {m.status === "CLOSED" && (
                        <p className="success">
                          Mission closed at base. Evidence is ready to export.
                        </p>
                      )}
                      <details>
                        <summary>Exact route and coverage gaps</summary>
                        <p>
                          Uncovered:{" "}
                          {m.route.uncovered
                            .map((t: Any) => `${t.id} (${t.reason})`)
                            .join(", ") || "none"}
                        </p>
                        <ol className="steps">
                          {m.route.steps.map((s: Any, i: number) => (
                            <li key={i} className={i < m.cursor ? "done" : ""}>
                              {s.kind} cell {s.cell}
                              {i === m.cursor ? " ← next" : ""}
                            </li>
                          ))}
                        </ol>
                      </details>
                    </>
                  ) : (
                    <p>
                      Compute an exact route to inspect its budget, omitted
                      checkpoints and cell-by-cell path before approval.
                    </p>
                  )}
                </aside>
              </section>,
              <section key="agent" className="agent-layout">
                <div className="agent-brief">
                  <p className="eyebrow">BOUNDED PLANNING INTELLIGENCE</p>
                  <h2>
                    A route explanation.
                    <br />
                    An inspectable chain of evidence.
                  </h2>
                  <p>
                    The agent can inspect, optimize and compare budgets. It
                    cannot approve a mission, move, inspect a physical asset or
                    change an exclusion.
                  </p>
                  <label>
                    Investigation goal
                    <textarea
                      rows={5}
                      value={goal}
                      maxLength={500}
                      onChange={(e) => setGoal(e.target.value)}
                    />
                  </label>
                  {operation(
                    "agent_start",
                    { goal },
                    "Start planning investigation",
                    !map,
                  )}
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={providerFailure}
                      onChange={(e) => setProviderFailure(e.target.checked)}
                    />
                    Test provider interruption
                  </label>
                  <p className="fine">
                    Four decisions per investigation. Current exact-zero-price
                    model only; failures retain the saved checkpoint.
                    Free-provider prompts may be retained: synthetic data only.
                  </p>
                  {a && (
                    <>
                      <p className="phase">{a.phase}</p>
                      {operation(
                        "agent_continue",
                        {},
                        "Continue investigation",
                        a.phase !== "CONTINUE",
                      )}
                      {operation(
                        "agent_review",
                        {},
                        "Close as reviewed evidence",
                        a.phase !== "REVIEW",
                      )}
                      <p>
                        {a.decisions.length}/4 decisions · map version{" "}
                        {a.version}
                      </p>
                    </>
                  )}
                </div>
                <div className="evidence-chain">
                  <div className="section-title">
                    <h2>Tool observations</h2>
                    <span>MODEL PROSE IS UNTRUSTED</span>
                  </div>
                  {!a ? (
                    <div className="quiet">
                      Start an investigation after importing a map. Exact tool
                      observations appear here before any model summary is
                      reviewed.
                    </div>
                  ) : (
                    <>
                      {a.observations.map((o: Any) => (
                        <article className="observation" key={o.id}>
                          <span className="eid">{o.id}</span>
                          <div>
                            <h3>{o.tool.replaceAll("_", " ")}</h3>
                            <details open>
                              <summary>
                                Inspect exact tool input / output
                              </summary>
                              <pre>
                                {JSON.stringify(
                                  { arguments: o.arguments, result: o.result },
                                  null,
                                  2,
                                )}
                              </pre>
                            </details>
                          </div>
                        </article>
                      ))}
                      {a.summary && (
                        <article className="summary">
                          <p className="eyebrow">
                            SUGGESTED SUMMARY · REQUIRES REVIEW
                          </p>
                          <p>{a.summary}</p>
                          <p>Evidence references: {a.citations.join(", ")}</p>
                        </article>
                      )}
                      <details>
                        <summary>
                          Model receipts and checkpoint boundary
                        </summary>
                        <pre>
                          {JSON.stringify(
                            {
                              checkpoint: a.checkpoint,
                              providers: a.decisions.map(
                                (d: Any) => d.provider,
                              ),
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    </>
                  )}
                </div>
              </section>,
              <section key="proof" className="proof-layout">
                <div>
                  <p className="eyebrow">FINDINGS & CLOSURE</p>
                  <h2>Nothing disappears at handoff.</h2>
                  <p>
                    Inspection issues need an explicit resolution. Completed
                    movement, energy usage and reviewed evidence remain
                    reproducible in the saved journal.
                  </p>
                  {m?.issues.length ? (
                    m.issues.map((issue: Any) => (
                      <article className="issue" key={issue.id}>
                        <h3>
                          {issue.id} · {issue.status}
                        </h3>
                        <p>{issue.note}</p>
                        {issue.resolution ? (
                          <p>{issue.resolution}</p>
                        ) : (
                          <>
                            <label>
                              Resolution review note
                              <textarea
                                value={review}
                                onChange={(e) => setReview(e.target.value)}
                              />
                            </label>
                            {operation(
                              "resolve",
                              { target: issue.id, note: review },
                              "Resolve " + issue.id,
                            )}
                          </>
                        )}
                      </article>
                    ))
                  ) : (
                    <div className="quiet">
                      No recorded issues. This is an empty result, not a claim
                      that a physical asset passed inspection.
                    </div>
                  )}
                </div>
                <div>
                  <div className="section-title">
                    <h2>Mission dossier</h2>
                    <button
                      disabled={busy || !map}
                      onClick={() =>
                        download("clearspan-dossier.json", {
                          schema: 1,
                          workspace: portable(state),
                          mission: m,
                          agent: a,
                          history: state.agentHistory,
                          limits:
                            "Synthetic single-user software simulation. User-editable exports are not signed attestations.",
                        })
                      }
                    >
                      Export evidence dossier
                    </button>
                  </div>
                  <dl className="facts">
                    <div>
                      <dt>Command receipts</dt>
                      <dd>{state.journal.length}/120</dd>
                    </div>
                    <div>
                      <dt>Energy conservation</dt>
                      <dd>
                        {m
                          ? `${m.spent} spent + ${m.remaining} remaining = ${map.budget}`
                          : "No mission"}
                      </dd>
                    </div>
                    <div>
                      <dt>Journal SHA256 head</dt>
                      <dd className="hash">{state.head}</dd>
                    </div>
                  </dl>
                  <details>
                    <summary>Saved command history</summary>
                    <ol>
                      {state.journal.map((r: Any) => (
                        <li key={r.command.id}>
                          {r.command.kind} <small>{r.command.id}</small>
                        </li>
                      ))}
                    </ol>
                  </details>
                  <button onClick={reopen} disabled={busy}>
                    Reopen saved workspace
                  </button>
                  <p className="fine">
                    IndexedDB atomic revisions fence stale tabs. Browser
                    deletion loses local data; export is backup. No shared
                    hosted database or multiuser operations are claimed.
                  </p>
                </div>
              </section>,
            ]}
          </TransitionPanel>
        </main>
        <footer>
          <span>CLEARSPAN / REVIEWED INSPECTION MISSIONS</span>
          <span>
            Original synthetic data · C++ route core · no physical control
          </span>
        </footer>
        <dialog
          ref={dialog}
          onCancel={() => setModal("")}
          onClose={() => setModal("")}
        >
          <form onSubmit={submit}>
            <div className="section-title">
              <h2>
                {modal === "map"
                  ? "Import synthetic map"
                  : "Restore portable workspace"}
              </h2>
              <button
                type="button"
                onClick={() => setModal("")}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>
            <p>
              {modal === "map"
                ? "At most16×16 cells and10 weighted checkpoints. Base cannot be excluded."
                : "Paste an exported schema1 operation journal. Restore validates every command and hash without calling a model."}
            </p>
            <label>
              JSON
              <textarea
                autoFocus
                rows={12}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={262144}
              />
            </label>
            {dialogError && (
              <p role="alert" className="error">
                {dialogError}
              </p>
            )}
            <div className="actions">
              <button type="button" onClick={() => setModal("")}>
                Cancel
              </button>
              <button className="primary" disabled={busy} type="submit">
                {modal === "map"
                  ? "Validate and import"
                  : "Validate and restore"}
              </button>
            </div>
          </form>
        </dialog>
        <PerformanceEvidence />
      </div>
    </MotionConfig>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
