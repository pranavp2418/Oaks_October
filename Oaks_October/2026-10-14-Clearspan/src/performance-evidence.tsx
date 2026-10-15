import { useEffect, useState } from "react";
import { observeInteractions } from "./performance-probe.mjs";
type Sample = { event: string; dispatch_ms: number; next_frame_ms: number };
export function PerformanceEvidence() {
  const [samples, setSamples] = useState<Sample[]>([]),
    [discarded, setDiscarded] = useState(0);
  useEffect(
    () =>
      observeInteractions(
        (sample: Sample) =>
          setSamples((previous) => [...previous, sample].slice(-32)),
        () => setDiscarded((n) => n + 1),
      ),
    [],
  );
  const distribution = (key: "dispatch_ms" | "next_frame_ms") => {
    const values = samples.map((s) => s[key]).sort((a, b) => a - b);
    return values.length
      ? {
          p50_ms: +values[Math.ceil(values.length * 0.5) - 1].toFixed(2),
          p95_ms: +values[Math.ceil(values.length * 0.95) - 1].toFixed(2),
          max_ms: +values.at(-1)!.toFixed(2),
        }
      : null;
  };
  return (
    <details className="performance-evidence">
      <summary>Measured interaction response</summary>
      <p>
        Last32 trusted clicks/keys in this visible product. Dispatch measures
        event timestamp to the window bubble listener after application
        handlers; next frame measures its first animation-frame callback. These
        include browser scheduling, exclude network completion, and are not INP,
        physical-device or production FPS claims. Hidden interruptions are
        discarded, visible slow samples are retained.
      </p>
      <output aria-live="off">
        <pre>
          {JSON.stringify(
            {
              samples: samples.length,
              discarded_hidden: discarded,
              dispatch: distribution("dispatch_ms"),
              next_frame: distribution("next_frame_ms"),
              recent: samples
                .slice(-8)
                .map((s) => ({
                  ...s,
                  dispatch_ms: +s.dispatch_ms.toFixed(2),
                  next_frame_ms: +s.next_frame_ms.toFixed(2),
                })),
            },
            null,
            2,
          )}
        </pre>
      </output>
    </details>
  );
}
