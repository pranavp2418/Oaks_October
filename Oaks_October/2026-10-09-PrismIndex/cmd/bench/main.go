package main

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"prismindex/index"
	"reflect"
	"runtime"
	"sort"
	"time"
)

func main() {
	r := rand.New(rand.NewSource(109))
	p := make([]index.Point, 1000)
	for i := range p {
		p[i] = index.Point{ID: fmt.Sprintf("p%04d", i), X: []float64{r.Float64() * 100, r.Float64() * 100, r.Float64() * 100}}
	}
	t, _ := index.New(p)
	q := []float64{42, 37, 19}
	for i := 0; i < 20; i++ {
		t.KNN(q, 10)
		index.Brute(p, q, 10)
	}
	a, b := []int64{}, []int64{}
	vis := 0
	for i := 0; i < 100; i++ {
		start := time.Now()
		got, v, _ := t.KNN(q, 10)
		a = append(a, time.Since(start).Nanoseconds())
		start = time.Now()
		oracle := index.Brute(p, q, 10)
		b = append(b, time.Since(start).Nanoseconds())
		if !reflect.DeepEqual(got, oracle) {
			panic("oracle mismatch")
		}
		vis = v
	}
	sort.Slice(a, func(i, j int) bool { return a[i] < a[j] })
	sort.Slice(b, func(i, j int) bool { return b[i] < b[j] })
	out := map[string]any{"runtime": runtime.Version(), "os": runtime.GOOS, "arch": runtime.GOARCH, "cpu_count": runtime.NumCPU(), "seed": 109, "points": 1000, "dimensions": 3, "k": 10, "warmup": 20, "repetitions": 100, "method": "single-process native wall-clock query only; build excluded; fixed query", "vp_p50_ns": a[50], "vp_p95_ns": a[95], "scan_p50_ns": b[50], "scan_p95_ns": b[95], "visited": vis, "oracle_equal": true}
	json.NewEncoder(os.Stdout).Encode(out)
}
