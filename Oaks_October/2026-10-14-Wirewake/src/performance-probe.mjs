export function observeInteractions(
  onSample,
  onDiscard,
  environment = {
    window,
    document,
    performance,
    requestAnimationFrame,
    cancelAnimationFrame,
  },
) {
  const {
      window: w,
      document: d,
      performance: p,
      requestAnimationFrame: raf,
      cancelAnimationFrame: cancel,
    } = environment,
    pending = new Map();
  let live = true;
  const record = (e) => {
    if (!e.isTrusted || d.visibilityState !== "visible") return;
    const start = e.timeStamp,
      dispatch = p.now() - start;
    let interrupted = false;
    const visibility = () => {
      if (d.visibilityState !== "visible") interrupted = true;
    };
    d.addEventListener("visibilitychange", visibility);
    const id = raf(() => {
      d.removeEventListener("visibilitychange", visibility);
      pending.delete(id);
      if (!live) return;
      if (interrupted || d.visibilityState !== "visible") {
        onDiscard();
        return;
      }
      onSample({
        event: e.type,
        dispatch_ms: Math.max(0, dispatch),
        next_frame_ms: Math.max(0, p.now() - start),
      });
    });
    pending.set(id, visibility);
  };
  w.addEventListener("click", record);
  w.addEventListener("keydown", record);
  return () => {
    live = false;
    w.removeEventListener("click", record);
    w.removeEventListener("keydown", record);
    for (const [id, visibility] of pending) {
      cancel(id);
      d.removeEventListener("visibilitychange", visibility);
    }
    pending.clear();
  };
}
