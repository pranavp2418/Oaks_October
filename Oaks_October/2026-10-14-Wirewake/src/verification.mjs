import { openStore, read, save } from "./store.mjs";
const style = document.createElement("style");
style.textContent =
  "body{margin:24px;color:#f0f3ef;background:#12191e;font:16px system-ui}main{max-width:1200px;margin:auto}button{padding:12px;margin:4px;background:#203137;color:#f0f3ef;border:1px solid #60ddd0;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere}iframe{display:block;max-width:100%;border:1px solid #60ddd0;background:#12191e}";
document.head.append(style);
const result = document.querySelector("#result"),
  frame = document.querySelector("#product");
document.querySelector("#mobile").onclick = () => (frame.width = "390");
document.querySelector("#desktop").onclick = () => (frame.width = "1150");
document.querySelector("#storage").onclick = async () => {
  const name = "wirewake-qa-" + crypto.randomUUID(),
    connections = [];
  try {
    for (let i = 0; i < 8; i++) connections.push(await openStore(name));
    const races = await Promise.allSettled(
      connections.map((db) => save(db, 0, { schema: 1, journal: [] })),
    );
    connections.forEach((db) => db.close());
    connections.length = 0;
    const db = await openStore(name);
    connections.push(db);
    const record = await read(db),
      successes = races.filter((r) => r.status === "fulfilled").length,
      conflicts = races.filter(
        (r) =>
          r.status === "rejected" && r.reason.message.startsWith("A newer tab"),
      ).length;
    if (successes !== 1 || conflicts !== 7 || record.revision !== 1)
      throw Error("Atomic save invariant failed");
    result.textContent = JSON.stringify(
      {
        passed: true,
        writers: 8,
        successes,
        conflicts,
        reopened_revision: record.revision,
        scope: "Own disposable verification DB; product data untouched",
      },
      null,
      2,
    );
  } catch (e) {
    result.textContent = JSON.stringify({ passed: false, error: e.message });
  } finally {
    connections.forEach((db) => db.close());
    indexedDB.deleteDatabase(name);
  }
};
