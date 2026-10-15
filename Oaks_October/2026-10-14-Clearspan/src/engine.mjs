export async function makeEngine(bytes) {
  const { instance } = await WebAssembly.instantiate(bytes, {}),
    x = instance.exports;
  return function route(
    map,
    { position = map.base, budget = map.budget, visited = [] } = {},
  ) {
    const targets = map.targets.filter((t) => !visited.includes(t.id)),
      a = new Int32Array(x.memory.buffer, x.input_ptr(), 512);
    a.fill(0);
    a.set([map.width, map.height, position, map.base, budget, targets.length]);
    for (const cell of map.blocked) a[6 + cell] = 1;
    targets.forEach((t, i) =>
      a.set([t.cell, t.priority], 6 + map.width * map.height + 2 * i),
    );
    const started = performance.now(),
      status = x.solve(),
      ms = performance.now() - started;
    if (status === -2)
      throw Error(
        "Base is unreachable within the remaining budget. Pause and correct the exclusion map.",
      );
    if (status !== 1) throw Error("Route engine rejected invalid input.");
    const r = new Int32Array(x.memory.buffer, x.output_ptr(), 2048),
      steps = Array.from(r.slice(6, 6 + r[4])).map((v) => ({
        cell: v % 256,
        kind: v >= 256 ? "inspect" : "move",
      }));
    return {
      cost: r[1],
      priority: r[2],
      covered: targets.filter((_, i) => r[3] & (1 << i)).map((t) => t.id),
      steps,
      expanded: r[5],
      milliseconds: ms,
    };
  };
}
