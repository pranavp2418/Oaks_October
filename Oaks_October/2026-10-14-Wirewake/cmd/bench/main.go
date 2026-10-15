package main

import (
	"encoding/json"
	"fmt"
	"os"
	"runtime"
	"sort"
	"time"
	"wirewake/engine"
)

func main() {
	a := engine.Machine{Initial: "S0", Alphabet: []string{"advance", "probe"}}
	for i := 0; i < 12; i++ {
		s := fmt.Sprintf("S%d", i)
		a.States = append(a.States, s)
		a.Edges = append(a.Edges, engine.Edge{s, "advance", fmt.Sprintf("S%d", (i+1)%12), "OK"}, engine.Edge{s, "probe", s, "OK"})
	}
	b := a
	b.Edges = append([]engine.Edge{}, a.Edges...)
	b.Edges[23].Output = "BAD"
	a, _ = engine.Compile(a)
	b, _ = engine.Compile(b)
	oracle := func() {
		var visit func([]string, int) bool
		visit = func(trace []string, left int) bool {
			if len(trace) > 0 {
				steps, _ := engine.Replay(a, b, trace)
				for _, s := range steps {
					if s.Mismatch {
						return true
					}
				}
			}
			if left == 0 {
				return false
			}
			for _, s := range a.Alphabet {
				if visit(append(append([]string{}, trace...), s), left-1) {
					return true
				}
			}
			return false
		}
		for depth := 1; depth <= 12; depth++ {
			if visit(nil, depth) {
				return
			}
		}
		panic("witness missing")
	}
	measure := func(f func()) map[string]any {
		for i := 0; i < 5; i++ {
			f()
		}
		samples := []float64{}
		var before, after runtime.MemStats
		runtime.GC()
		runtime.ReadMemStats(&before)
		for i := 0; i < 35; i++ {
			start := time.Now()
			f()
			samples = append(samples, float64(time.Since(start).Nanoseconds())/1e6)
		}
		runtime.ReadMemStats(&after)
		sort.Float64s(samples)
		return map[string]any{"p50_ms": samples[17], "p95_ms": samples[33], "min_ms": samples[0], "max_ms": samples[34], "allocated_bytes_per_call": (after.TotalAlloc - before.TotalAlloc) / 35}
	}
	result, _ := engine.Check(a, b)
	report := map[string]any{"runtime": runtime.Version(), "os": runtime.GOOS, "architecture": runtime.GOARCH, "logical_cpus": runtime.NumCPU(), "workload": "fixed12-state cycle;2 symbols; single output fault at S11/probe", "warmup": 5, "repetitions": 35, "method": "sequential wall-clock; nearest-rank p95; TotalAlloc delta, not peak memory; shared container", "shortest_witness_length": len(result.Witness), "product_bfs": measure(func() { engine.Check(a, b) }), "bounded_trace_enumeration": measure(oracle), "limits": "One finite synthetic model; not network throughput or external implementation verification"}
	json.NewEncoder(os.Stdout).Encode(report)
}
