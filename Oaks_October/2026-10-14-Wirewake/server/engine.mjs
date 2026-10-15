import { readFile } from "node:fs/promises";
let initialized;
async function initialize() {
  await import("../public/wasm_exec.js");
  const go = new globalThis.Go(),
    bytes = await readFile(new URL("../public/engine.wasm", import.meta.url)),
    { instance } = await WebAssembly.instantiate(bytes, go.importObject);
  go.run(instance).catch(() => console.error("Go engine terminated"));
  if (typeof globalThis.wirewakeProcess !== "function")
    throw Error("Go core did not initialize");
}
export async function processCore(request) {
  await (initialized ??= initialize());
  return JSON.parse(globalThis.wirewakeProcess(JSON.stringify(request)));
}
