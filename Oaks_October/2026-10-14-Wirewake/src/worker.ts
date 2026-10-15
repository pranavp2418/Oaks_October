let ready: Promise<void> | undefined;
async function start() {
  const runtime = "/wasm_exec.js";
  await import(/* @vite-ignore */ runtime);
  const go = new (globalThis as any).Go(),
    bytes = await (await fetch("/engine.wasm")).arrayBuffer(),
    { instance } = await WebAssembly.instantiate(bytes, go.importObject);
  go.run(instance).catch(() => {});
  if (typeof (globalThis as any).wirewakeProcess !== "function")
    throw Error("Go engine initialization failed");
}
self.onmessage = async (event) => {
  const { id, request } = event.data;
  try {
    await (ready ??= start());
    const result = JSON.parse(
      (globalThis as any).wirewakeProcess(JSON.stringify(request)),
    );
    self.postMessage({ id, result });
  } catch (e) {
    self.postMessage({
      id,
      result: {
        ok: false,
        error: String((e as Error).message),
        saved_workspace_unchanged: true,
      },
    });
  }
};
