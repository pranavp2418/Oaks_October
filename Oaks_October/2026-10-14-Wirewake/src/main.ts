import { parseStrict } from "./strict-json.mjs";
import { sample } from "./sample.mjs";
import { openStore, read, save } from "./store.mjs";
import { observeInteractions } from "./performance-probe.mjs";
import "./style.css";
type Any = any;
const root = document.querySelector<HTMLDivElement>("#app")!,
  worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  }),
  pending = new Map<
    number,
    {
      resolve: (v: Any) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
let seq = 0;
worker.onmessage = (event) => {
  const entry = pending.get(event.data.id);
  if (entry) {
    clearTimeout(entry.timer);
    pending.delete(event.data.id);
    event.data.result.ok
      ? entry.resolve(event.data.result)
      : entry.reject(Error(event.data.result.error));
  }
};
worker.onerror = () => {
  for (const item of pending.values()) {
    clearTimeout(item.timer);
    item.reject(
      Error("Go worker failed. Saved workspace retained; reload to retry."),
    );
  }
  pending.clear();
};
function core(request: Any): Promise<Any> {
  return new Promise((resolve, reject) => {
    const id = ++seq,
      timer = setTimeout(() => {
        pending.delete(id);
        reject(
          Error(
            "Go engine timed out. Saved workspace retained; reopen before retrying.",
          ),
        );
      }, 30000);
    pending.set(id, { resolve, reject, timer });
    worker.postMessage({ id, request });
  });
}
const fixture = sample();
let state: Any = null,
  workspace: Any = null,
  revision = 0,
  db: Any = null,
  busy = true,
  error = "",
  notice = "Initializing the actual Go engine in a background worker…",
  tab = 0,
  editSpec = JSON.stringify(fixture.spec, null, 2),
  editCandidate = JSON.stringify(fixture.candidate, null, 2),
  traceText = "read, close, connect, read, read, authenticate, close",
  reviewNote = "Reviewed shortest witness and complete finite-state proof.",
  goal =
    "Use check_equivalence to find the shortest disagreement, then suggest_patch to explain a repair. Finish with exact evidence citations.",
  fail = false,
  providerFail = false,
  reduce = false;
const escape = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const pretty = (value: Any) => escape(JSON.stringify(value, null, 2));
const button = (action: string, label: string, disabled = false, cls = "") =>
  `<button data-action="${action}" ${busy || disabled ? "disabled" : ""} class="${cls}">${label}</button>`;
const pre = (value: Any) => `<pre>${pretty(value)}</pre>`;
function capture() {
  const spec = document.querySelector<HTMLTextAreaElement>("#spec"),
    candidate = document.querySelector<HTMLTextAreaElement>("#candidate");
  if (spec) editSpec = spec.value;
  if (candidate) editCandidate = candidate.value;
  const trace = document.querySelector<HTMLInputElement>("#trace");
  if (trace) traceText = trace.value;
  const note = document.querySelector<HTMLTextAreaElement>("#review-note");
  if (note) reviewNote = note.value;
  const g = document.querySelector<HTMLTextAreaElement>("#goal");
  if (g) goal = g.value;
}
function table(steps: Any[]) {
  return steps?.length
    ? `<div class="table-scroll"><table><caption>Exact observed state/output trace</caption><thead><tr><th>Input</th><th>Contract state → next</th><th>Candidate state → next</th><th>Expected / actual</th></tr></thead><tbody>${steps.map((s) => `<tr class="${s.mismatch ? "mismatch" : ""}"><td>${escape(s.input)}</td><td>${escape(s.before.spec)} → ${escape(s.after.spec)}</td><td>${escape(s.before.candidate)} → ${escape(s.after.candidate)}</td><td>${escape(s.expected)} / <strong>${escape(s.actual)}</strong>${s.mismatch ? " <span>DISAGREEMENT</span>" : ""}</td></tr>`).join("")}</tbody></table></div>`
    : '<div class="empty">No trace computed. Run conformance or replay an input sequence.</div>';
}
function signal(analysis: Any) {
  if (!analysis?.steps?.length) return "";
  const steps = analysis.steps,
    width = Math.max(660, steps.length * 230 + 100);
  return `<div class="signal-scroll"><svg viewBox="0 0 ${width} 180" aria-hidden="true"><path d="M40 56 H${width - 30} M40 132 H${width - 30}" stroke="#36505d" stroke-width="2"/>${steps
    .map((s: Any, i: number) => {
      const x = 80 + i * 230;
      return `<text x="${x}" y="20" fill="#a8c3cf" font-size="12">${escape(s.input)}</text><rect x="${x}" y="34" width="150" height="44" rx="4" fill="#183d43" stroke="#60ddd0"/><text x="${x + 12}" y="61" fill="#ecf6f6" font-size="13">${escape(s.expected)}</text><rect x="${x}" y="110" width="150" height="44" rx="4" fill="${s.mismatch ? "#543720" : "#243943"}" stroke="${s.mismatch ? "#ffb75a" : "#809ba7"}"/><text x="${x + 12}" y="137" fill="#f5f4ef" font-size="13">${escape(s.actual)}</text>`;
    })
    .join("")}</svg></div>`;
}
function render() {
  const active = document.activeElement as HTMLInputElement | null,
    focused = active?.id,
    selection = active?.selectionStart;
  const a = state?.agent,
    analysis = state?.analysis,
    p = state?.patch,
    loaded = !!state?.spec,
    names = [
      "Contracts",
      "Counterexamples",
      "Repair review",
      "Agent desk",
      "Evidence",
    ];
  root.innerHTML = `<a class="skip" href="#workbench">Skip to protocol workbench</a><header><a class="brand" href="/">W∿ <span>WIREWAKE<small>PROTOCOL CONFORMANCE LAB</small></span></a><div class="header-controls"><span class="badge">CONTROLLED SYNTHETIC CONTRACTS</span>${button("reopen", "Reopen saved")}${button("restore", "Restore")}${button("export", "Export workspace", !loaded)}</div></header>
 <div class="instrument-bar"><span><i class="led"></i>${loaded ? "CONTRACTS COMPILED" : "ENGINE / READYING"}</span><span>GO / WASM · WORKER ISOLATED</span><span>REV ${revision} · CANDIDATE v${state?.version ?? 0}</span></div>
 <div class="workspace"><aside class="sidebar"><p class="kicker">ANALYSIS MODES</p><nav aria-label="Protocol workbench">${names.map((name, i) => `<button data-tab="${i}" ${tab === i ? 'aria-current="page"' : ""}><span>0${i + 1}</span>${name}</button>`).join("")}</nav><div class="sidebar-note"><span>THE BOUNDARY</span><p>Analyze finite contracts. Prove the supplied model. Keep real systems outside the experiment.</p><dl><dt>Machine bound</dt><dd>12 states / 8 symbols</dd><dt>Journal bound</dt><dd>${workspace?.journal.length ?? 0} / 80 commands</dd><dt>Persistence</dt><dd>This browser, one user</dd></dl></div></aside>
 <main id="workbench"><div class="page-title"><div><p class="kicker">${escape(names[tab].toUpperCase())}</p><h1>${["Make disagreements<br/>reproducible.", "Find the smallest<br/>observable difference.", "A repair needs<br/>more than a suggestion.", "Ask for a diagnosis.<br/>Inspect the exact proof.", "A complete trail,<br/>ready for replay."][tab]}</h1></div><div class="proof-status ${analysis?.equivalent ? "good" : analysis ? "warn" : ""}"><span>EXACT CHECK</span><strong>${analysis ? (analysis.equivalent ? "EQUIVALENT" : "MISMATCH") : "NOT RUN"}</strong><small>${analysis ? `${analysis.reachable_pairs} reachable pairs discovered` : "No invented proof or score"}</small></div></div>
 <div class="notice" role="status">${busy ? '<span class="loading">WORKING</span> ' : ""}${escape(notice)}</div>${error ? `<div class="error" role="alert">${escape(error)} ${button("reopen", "Reopen saved workspace")}</div>` : ""}
 <section class="panel" data-current-view="${tab}">
 ${tab === 0 ? `<div class="toolbar"><p>Declare observable behavior, then compare the implementation model. Missing edges output <code>REJECT</code> and retain state.</p>${button("sample", "Load synthetic handshake", false, "primary")}${button("compile", "Compile edited contracts")}</div><div class="editors"><label>Reference contract<textarea id="spec" spellcheck="false" rows="20">${escape(editSpec)}</textarea></label><label>Candidate implementation model<textarea id="candidate" spellcheck="false" rows="20">${escape(editCandidate)}</textarea></label></div><div class="bottom-rail"><span>STRICT JSON · UNIQUE STATE / INPUT EDGES · BOUNDED INPUT</span>${button("check", "Run exact conformance", !loaded, "primary")}</div><details><summary>Contract schema and semantics</summary><p>Each machine has states, alphabet, initial and edges. Each edge has from, input, to and output. Both machines share the same alphabet. Output disagreement is the observable failure; state names may differ. Equality exhausts reachable pairs and proves only the supplied finite models.</p></details>` : ""}
 ${tab === 1 ? `<div class="toolbar">${button("check", "Find shortest counterexample", !loaded, "primary")}${button("campaign", "Run transition mutation campaign", !loaded)}<span>FINITE PRODUCT BFS / EXACT</span></div>${analysis ? `<div class="result-line"><strong>${analysis.equivalent ? "No observable disagreement." : analysis.witness.map((x: string) => escape(x)).join(" → ")}</strong><p>${escape(analysis.guarantee)}</p><small>${analysis.transitions} transition comparisons · ${analysis.reachable_pairs} reachable pairs discovered</small></div>${signal(analysis)}${table(analysis.steps)}` : '<div class="empty">Run the exact checker. A shortest witness or complete reachable-product result will appear here.</div>'}<div class="trace-tools"><h2>Replay and reduce a noisy trace</h2><label>Input symbols, separated by commas<input id="trace" value="${escape(traceText)}" maxlength="7000"/></label><div class="actions">${button("trace", "Replay input sequence", !loaded)}${button("shrink", "Minimize failing trace", !loaded)}</div>${state?.reduction ? `<div class="reduction"><span>ONE-DELETION-MINIMAL / ${state.reduction.oracle_calls} ORACLE CALLS</span><strong>${state.reduction.reduced.map((x: string) => escape(x)).join(" → ")}</strong><p>Every single-symbol deletion was rechecked. This reduction is not a global-shortest claim; use BFS for that.</p>${table(state.reduction.steps)}</div>` : state?.trace.length ? table(state.trace) : ""}</div>${state?.campaign.length ? `<div class="campaign"><h2>Transition mutation campaign</h2><p>${state.campaign.filter((m: Any) => !m.equivalent).length} witnessed / ${state.campaign.length} total single-transition mutants. Equivalent mutants may be unreachable or observationally equivalent; they are not labelled detected.</p><details><summary>Inspect each mutant and witness</summary>${pre(state.campaign)}</details></div>` : ""}` : ""}
 ${tab === 2 ? `<div class="repair-grid"><div><h2>Contract-derived proposal</h2><p>Suggest a transition repair from the exact mismatch. The Go engine checks the full reachable product before review, and again before apply.</p>${button("propose_patch", "Propose transition repair", !loaded, "primary")}${p ? `<div class="patch"><span>${escape(p.status)}</span><h3>${escape(p.edge.from)} / ${escape(p.edge.input)}</h3><p>→ ${escape(p.edge.to)} · output <strong>${escape(p.edge.output)}</strong></p><p>Post-patch proof: ${p.proof.equivalent ? "EQUIVALENT" : "STILL FAILS — REVIEW BLOCKED"}</p><code>${escape(p.binding)}</code></div>` : '<div class="empty">No proposal. Compute a mismatch and request a contract-derived candidate.</div>'}</div><div class="approval"><p class="kicker">EXPLICIT OPERATOR CONTROL</p><h2>Review the version.<br/>Then apply the repair.</h2><label>Repair review note<textarea id="review-note" rows="4" maxlength="500">${escape(reviewNote)}</textarea></label>${button("review_patch", "Review exact repair", !p || p.status !== "PROPOSED" || !p.proof.equivalent)}${button("apply_patch", "Apply reviewed repair", !p || p.status !== "REVIEWED", "primary")}<label class="checkbox"><input id="fail" type="checkbox" ${fail ? "checked" : ""}/>Inject precommit interruption</label><p class="fine">A failed or stale proposal retains the saved candidate. Agent tools cannot approve or apply a patch.</p>${p?.status === "APPLIED" ? '<p class="success">Repair applied and full finite conformance rechecked. Original commands remain in the journal.</p>' : ""}</div></div>` : ""}
 ${tab === 3 ? `<div class="agent-grid"><div><p class="kicker">BOUNDED DIAGNOSTIC AGENT</p><h2>Tools that return proof,<br/>not permission.</h2><label>Investigation goal<textarea id="goal" rows="5" maxlength="500">${escape(goal)}</textarea></label>${button("agent_start", "Start protocol investigation", !loaded, "primary")}<label class="checkbox"><input id="provider-fail" type="checkbox" ${providerFail ? "checked" : ""}/>Test provider interruption</label><p class="fine">Only the current exact-zero-price model is allowed. Four decisions maximum. Synthetic prompts may be retained by the free provider. No paid fallback.</p>${a ? `<div class="agent-phase">${escape(a.phase)} · ${a.decisions.length}/4 decisions</div>${button("agent_continue", "Continue one decision", a.phase !== "CONTINUE")}${button("agent_review", "Close as reviewed evidence", a.phase !== "REVIEW")}` : ""}</div><div>${a ? a.observations.map((o: Any) => `<article class="observation"><span>${escape(o.id)}</span><div><h3>${escape(o.tool.replaceAll("_", " "))}</h3><details open><summary>Exact tool input and result</summary>${pre({ arguments: o.arguments, result: o.result })}</details></div></article>`).join("") : '<div class="empty">A diagnosis begins with real tools against your compiled contract. Recorded decisions replay without new inference.</div>'}${a?.summary ? `<article class="model-summary"><p class="kicker">MODEL PROSE / VERIFY AGAINST EXACT OBSERVATIONS</p><p>${escape(a.summary)}</p><span>Citations: ${a.citations.map((x: string) => escape(x)).join(", ")}</span></article>` : ""}${a ? `<details><summary>Provider receipts and checkpoint</summary>${pre({ phase: a.phase, binding: a.binding, providers: a.decisions.map((d: Any) => d.provider), boundary: "Saved decisions are user-editable metadata, not signed provider attestations" })}</details>` : ""}</div></div>` : ""}
 ${tab === 4 ? `<div class="toolbar"><p>Portable, hash-linked operations reconstruct the compiler, proof, repair and agent checkpoints without fresh inference.</p>${button("dossier", "Export proof dossier", !loaded, "primary")}${button("traces", "Export regression traces", !loaded)}</div><div class="proof-facts"><div><span>REPLAYABLE COMMANDS</span><strong>${workspace?.journal.length ?? 0}</strong></div><div><span>CANDIDATE VERSION</span><strong>${state?.version ?? 0}</strong></div><div><span>EXACT CHECK</span><strong>${analysis ? (analysis.equivalent ? "PASS" : "FAIL") : "NOT RUN"}</strong></div></div><p class="hash-label">SHA256 JOURNAL HEAD</p><code class="hash">${escape(workspace?.head ?? "No journal")}</code><details><summary>Inspect complete command receipts</summary>${pre(workspace?.journal ?? [])}</details><details><summary>Inspect current finite-state proof and mutation coverage</summary>${pre({ analysis: state?.analysis, campaign: state?.campaign, patch: state?.patch })}</details><p class="fine">Single-user browser storage, not shared hosted state. Browser deletion loses local work; export is backup. No external protocol endpoint is contacted. Finite-model equivalence does not establish implementation security or physical production behavior.</p>` : ""}
 </section><details class="performance"><summary>Measured interaction response</summary><p>Trusted visible click/key dispatch and next-frame times. Includes browser scheduling, excludes worker/network completion. Not INP, production FPS or physical-mobile measurements. Slow visible events retained.</p><pre id="perf">No trusted input sample yet.</pre></details><label class="checkbox reduced"><input id="reduce" type="checkbox" ${reduce ? "checked" : ""}/>Reduce motion</label><footer>WIREWAKE / FINITE MODELS. EXACT WITNESSES. REVIEWED REPAIRS.<span>Original synthetic data · Go compiler and conformance core</span></footer></main></div>
 <dialog id="restore-dialog" aria-labelledby="restore-title"><form id="restore-form"><div class="dialog-title"><h2 id="restore-title">Restore proof workspace</h2><button type="button" data-action="close-dialog" aria-label="Close restore dialog">×</button></div><p>Paste a schema1 journal. The Go engine validates every transition and hash; saved agent decisions replay without model calls.</p><label>Workspace JSON<textarea id="restore-json" rows="12" maxlength="262144" required></textarea></label><p id="restore-error" role="alert"></p><div class="actions"><button type="button" data-action="close-dialog">Cancel</button><button class="primary" type="submit">Validate and restore</button></div></form></dialog>`;
  if (focused) {
    const el = document.getElementById(focused) as HTMLInputElement | null;
    if (el) {
      el.focus();
      if (
        selection !== null &&
        selection !== undefined &&
        el.setSelectionRange &&
        ["text", "textarea"].includes(el.type)
      )
        el.setSelectionRange(selection, selection);
    }
  }
  const output = document.querySelector("#perf");
  if (output) output.textContent = performanceText;
}
let performanceText = "No trusted input sample yet.";
const metrics: Any[] = [];
let discarded = 0;
observeInteractions(
  (sample: Any) => {
    metrics.push(sample);
    if (metrics.length > 32) metrics.shift();
    const dist = (key: string) => {
      const values = metrics.map((x) => x[key]).sort((a, b) => a - b);
      return {
        p50_ms: +values[Math.ceil(values.length * 0.5) - 1].toFixed(2),
        p95_ms: +values[Math.ceil(values.length * 0.95) - 1].toFixed(2),
        max_ms: +values.at(-1).toFixed(2),
      };
    };
    performanceText = JSON.stringify(
      {
        samples: metrics.length,
        discarded_hidden: discarded,
        dispatch: dist("dispatch_ms"),
        next_frame: dist("next_frame_ms"),
      },
      null,
      2,
    );
    const output = document.querySelector("#perf");
    if (output) output.textContent = performanceText;
  },
  () => discarded++,
);
async function commit(response: Any, refreshEditors: boolean, expectedRevision: number) {
  const saved = await save(db, expectedRevision, response.workspace);
  workspace = response.workspace;
  state = response.state;
  revision = saved.revision;
  if (refreshEditors && state.spec) {
    editSpec = JSON.stringify(state.spec, null, 2);
    editCandidate = JSON.stringify(state.candidate, null, 2);
  }
}
async function action(kind: string, args: Any = {}, online = false) {
  if (busy) return;
  const expectedRevision = revision;
  capture();
  busy = true;
  error = "";
  notice = online
    ? "Running one bounded real model decision…"
    : "Validating and executing in the actual Go core…";
  render();
  try {
    const command = { id: crypto.randomUUID(), kind, args };
    let response;
    if (online) {
      const r = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace,
          command,
          provider_failure: providerFail,
          fail,
        }),
      });
      response = await r.json();
      if (!r.ok || !response.ok)
        throw Error(response.error ?? "Provider decision failed");
    } else response = await core({ workspace, command, fail });
    await commit(response, ["import", "apply_patch"].includes(kind), expectedRevision);
    notice = `Saved ${kind.replaceAll("_", " ")} · local revision ${revision}`;
  } catch (e) {
    error = (e as Error).message;
    notice =
      "Saved state retained. Correct the issue or reopen before retrying.";
  } finally {
    busy = false;
    render();
  }
}
async function reopen() {
  busy = true;
  error = "";
  render();
  try {
    db ??= await openStore();
    const saved = await read(db),
      response = await core({ workspace: saved.workspace });
    workspace = response.workspace;
    state = response.state;
    revision = saved.revision;
    if (state.spec) {
      editSpec = JSON.stringify(state.spec, null, 2);
      editCandidate = JSON.stringify(state.candidate, null, 2);
    }
    notice = saved.workspace
      ? "Saved proof reconstructed without new inference."
      : "Go engine ready. Load the original synthetic handshake or compile your contracts.";
  } catch (e) {
    error = (e as Error).message;
  } finally {
    busy = false;
    render();
  }
}
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
root.addEventListener("keydown", (event) => {
  if (event.key !== "Tab") return;
  const dialog = root.querySelector<HTMLDialogElement>("#restore-dialog[open]");
  if (!dialog) return;
  const controls = Array.from(dialog.querySelectorAll<HTMLElement>(
    'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex="0"]',
  ));
  const first = controls[0], last = controls.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
});

root.addEventListener("click", async (event) => {
  const target = (event.target as Element).closest<HTMLElement>(
    "[data-tab],[data-action]",
  );
  if (!target || busy) return;
  if (target.dataset.tab !== undefined) {
    capture();
    tab = Number(target.dataset.tab);
    render();
    document
      .querySelector<HTMLElement>(".page-title h1")
      ?.setAttribute("tabindex", "-1");
    document.querySelector<HTMLElement>(".page-title h1")?.focus();
    return;
  }
  const name = target.dataset.action;
  if (!name) return;
  if (name === "restore") {
    (
      document.querySelector("#restore-dialog") as HTMLDialogElement
    ).showModal();
    return;
  }
  if (name === "close-dialog") {
    (document.querySelector("#restore-dialog") as HTMLDialogElement).close();
    return;
  }
  if (name === "reopen") {
    await reopen();
    return;
  }
  if (name === "export") {
    download("wirewake-workspace.json", workspace);
    return;
  }
  if (name === "dossier") {
    download("wirewake-proof-dossier.json", {
      workspace,
      state,
      semantics:
        "Partial deterministic Mealy machines; missing edge returns REJECT and retains state; supplied models only, not external implementation proof.",
    });
    return;
  }
  if (name === "traces") {
    download("wirewake-regression-traces.json", {
      alphabet: state.spec.alphabet,
      witness: state.analysis?.witness ?? [],
      reduced: state.reduction?.reduced ?? [],
      mutation_witnesses: state.campaign
        .filter((x: Any) => !x.equivalent)
        .map((x: Any) => ({ edge: x.edge, kind: x.kind, input: x.witness })),
    });
    return;
  }
  capture();
  try {
    if (name === "sample") {
      await action("import", sample());
      return;
    }
    if (name === "compile") {
      await action("import", {
        spec: parseStrict(editSpec),
        candidate: parseStrict(editCandidate),
      });
      return;
    }
    if (name === "trace" || name === "shrink") {
      await action(name, {
        symbols: traceText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      return;
    }
    if (name === "review_patch") {
      await action(name, { note: reviewNote });
      return;
    }
    if (name === "agent_start") {
      await action(name, { goal }, true);
      return;
    }
    await action(
      name,
      {},
      name === "agent_continue" || name === "agent_review",
    );
  } catch (e) {
    error = (e as Error).message;
    render();
  }
});
root.addEventListener("change", (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === "fail") fail = target.checked;
  if (target.id === "provider-fail") providerFail = target.checked;
  if (target.id === "reduce") {
    reduce = target.checked;
    document.documentElement.dataset.motion = reduce ? "reduce" : "normal";
  }
});
root.addEventListener("submit", async (event) => {
  if ((event.target as HTMLElement).id !== "restore-form") return;
  event.preventDefault();
  if (busy) return;
  const expectedRevision = revision;
  const text = (document.querySelector("#restore-json") as HTMLTextAreaElement).value;
  const errorElement = document.querySelector("#restore-error")!;
  const buttons = Array.from((event.target as HTMLFormElement).querySelectorAll<HTMLButtonElement>("button"));
  busy = true;
  buttons.forEach(button => button.disabled = true);
  try {
    const imported = parseStrict(text);
    if (!imported || imported.schema !== 1 || !Array.isArray(imported.journal) || typeof imported.head !== "string") throw Error("Workspace schema1 journal required");
    const response = await core({ workspace: imported });
    await commit(response, true, expectedRevision);
    (document.querySelector("#restore-dialog") as HTMLDialogElement).close();
    notice = "Validated proof restored without fresh inference.";
    error = "";
    busy = false;
    render();
  } catch (e) {
    errorElement.textContent = (e as Error).message;
  } finally {
    busy = false;
    buttons.forEach(button => button.disabled = false);
  }
});
render();
reopen();
