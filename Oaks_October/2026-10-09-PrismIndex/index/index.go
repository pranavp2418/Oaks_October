package index

import (
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"math"
	"sort"
)

type Point struct {
	ID string    `json:"id"`
	X  []float64 `json:"x"`
}
type Hit struct {
	ID       string  `json:"id"`
	Distance float64 `json:"distance"`
}
type Node struct {
	P            Point
	Mu           float64
	Inner, Outer *Node
}
type Tree struct {
	Root      *Node
	Count     int
	Dimension int
}

func Distance(a, b []float64) float64 {
	v := 0.0
	for i := range a {
		d := a[i] - b[i]
		v += d * d
	}
	return math.Sqrt(v)
}
func Validate(points []Point) error {
	if len(points) < 1 || len(points) > 2000 {
		return fmt.Errorf("expected 1–2000 points")
	}
	ids := map[string]bool{}
	dim := len(points[0].X)
	if dim < 1 || dim > 16 {
		return fmt.Errorf("dimension 1–16 required")
	}
	for _, p := range points {
		if len(p.ID) < 1 || len(p.ID) > 40 || ids[p.ID] {
			return fmt.Errorf("invalid or duplicate id")
		}
		ids[p.ID] = true
		if len(p.X) != dim {
			return fmt.Errorf("dimension mismatch")
		}
		for _, v := range p.X {
			if math.IsNaN(v) || math.IsInf(v, 0) || math.Abs(v) > 1e6 {
				return fmt.Errorf("finite bounded coordinates required")
			}
		}
	}
	return nil
}
func New(points []Point) (*Tree, error) {
	if e := Validate(points); e != nil {
		return nil, e
	}
	copyP := make([]Point, len(points))
	for i, p := range points {
		copyP[i] = Point{p.ID, append([]float64(nil), p.X...)}
	}
	sort.Slice(copyP, func(i, j int) bool { return copyP[i].ID < copyP[j].ID })
	return &Tree{build(copyP), len(points), len(points[0].X)}, nil
}
func build(p []Point) *Node {
	if len(p) == 0 {
		return nil
	}
	n := &Node{P: p[len(p)-1]}
	if len(p) == 1 {
		return n
	}
	rest := p[:len(p)-1]
	sort.Slice(rest, func(i, j int) bool {
		a, b := Distance(rest[i].X, n.P.X), Distance(rest[j].X, n.P.X)
		if a == b {
			return rest[i].ID < rest[j].ID
		}
		return a < b
	})
	mid := len(rest) / 2
	n.Mu = Distance(rest[mid].X, n.P.X)
	n.Inner = build(rest[:mid])
	n.Outer = build(rest[mid:])
	return n
}
func less(a, b Hit) bool {
	if a.Distance == b.Distance {
		return a.ID < b.ID
	}
	return a.Distance < b.Distance
}
func (t *Tree) KNN(q []float64, k int) ([]Hit, int, error) {
	if len(q) != t.Dimension || k < 1 || k > t.Count {
		return nil, 0, fmt.Errorf("invalid query dimension or k")
	}
	for _, x := range q {
		if math.IsNaN(x) || math.IsInf(x, 0) || math.Abs(x) > 1e6 {
			return nil, 0, fmt.Errorf("invalid query")
		}
	}
	hits := []Hit{}
	visited := 0
	tau := math.Inf(1)
	var search func(*Node)
	search = func(n *Node) {
		if n == nil {
			return
		}
		visited++
		d := Distance(q, n.P.X)
		h := Hit{n.P.ID, d}
		hits = append(hits, h)
		sort.Slice(hits, func(i, j int) bool { return less(hits[i], hits[j]) })
		if len(hits) > k {
			hits = hits[:k]
		}
		if len(hits) == k {
			tau = hits[k-1].Distance
		}
		// Conservative tolerance prevents floating-point pruning of a boundary tie.
		eps := 1e-9 * (1 + math.Abs(d) + math.Abs(tau))
		if d < n.Mu {
			if d-tau <= n.Mu+eps {
				search(n.Inner)
			}
			if d+tau >= n.Mu-eps {
				search(n.Outer)
			}
		} else {
			if d+tau >= n.Mu-eps {
				search(n.Outer)
			}
			if d-tau <= n.Mu+eps {
				search(n.Inner)
			}
		}
	}
	search(t.Root)
	return hits, visited, nil
}
func Brute(points []Point, q []float64, k int) []Hit {
	hits := make([]Hit, len(points))
	for i, p := range points {
		hits[i] = Hit{p.ID, Distance(p.X, q)}
	}
	sort.Slice(hits, func(i, j int) bool { return less(hits[i], hits[j]) })
	return hits[:k]
}

type Operation struct {
	ID       string `json:"id"`
	Revision int    `json:"revision"`
	Kind     string `json:"kind"`
	Point    *Point `json:"point,omitempty"`
	Target   string `json:"target,omitempty"`
	Note     string `json:"note,omitempty"`
	A        string `json:"a,omitempty"`
	B        string `json:"b,omitempty"`
	Decision string `json:"decision,omitempty"`
}
type Request struct {
	Seed   []Point     `json:"seed"`
	Events []Operation `json:"events"`
	Query  []float64   `json:"query"`
	K      int         `json:"k"`
	Radius float64     `json:"radius"`
}
type Review struct {
	A        string `json:"a"`
	B        string `json:"b"`
	Decision string `json:"decision"`
	Note     string `json:"note"`
}
type Output struct {
	Points    []Point    `json:"points"`
	Revision  int        `json:"revision"`
	Hits      []Hit      `json:"hits"`
	Visited   int        `json:"visited"`
	Clusters  [][]string `json:"clusters"`
	Reviews   []Review   `json:"reviews"`
	Hash      string     `json:"hash"`
	Canonical []Point    `json:"canonical"`
}

func Replay(seed []Point, events []Operation) ([]Point, int, []Review, error) {
	if e := Validate(seed); e != nil {
		return nil, 0, nil, e
	}
	if len(events) > 500 {
		return nil, 0, nil, fmt.Errorf("journal limit exceeded")
	}
	points := append([]Point(nil), seed...)
	seen := map[string]string{}
	rev := 0
	reviews := []Review{}
	for _, e := range events {
		if len(e.ID) < 1 || len(e.ID) > 80 {
			return nil, rev, nil, fmt.Errorf("operation id required")
		}
		raw, _ := json.Marshal(e)
		key := string(raw)
		if old, ok := seen[e.ID]; ok {
			if key != old {
				return nil, rev, nil, fmt.Errorf("conflicting operation id")
			}
			continue
		}
		if e.Revision != rev {
			return nil, rev, nil, fmt.Errorf("stale revision")
		}
		before := append([]Point(nil), points...)
		if e.Kind == "upsert" {
			if e.Point == nil {
				return nil, rev, nil, fmt.Errorf("point required")
			}
			idx := -1
			for i, p := range points {
				if p.ID == e.Point.ID {
					idx = i
				}
			}
			if idx < 0 {
				points = append(points, *e.Point)
			} else {
				points[idx] = *e.Point
			}
			if err := Validate(points); err != nil {
				return nil, rev, nil, err
			}
			reviews = []Review{}
		} else if e.Kind == "delete" {
			idx := -1
			for i, p := range points {
				if p.ID == e.Target {
					idx = i
				}
			}
			if idx < 0 {
				return nil, rev, nil, fmt.Errorf("unknown delete target")
			}
			points = append(points[:idx], points[idx+1:]...)
			if err := Validate(points); err != nil {
				return nil, rev, nil, err
			}
			reviews = []Review{}
		} else if e.Kind == "review" {
			if len(e.Note) < 3 || len(e.Note) > 300 || e.A == e.B || (e.Decision != "duplicate" && e.Decision != "distinct") {
				return nil, rev, nil, fmt.Errorf("invalid pair review")
			}
			exists := map[string]bool{}
			for _, p := range points {
				exists[p.ID] = true
			}
			if !exists[e.A] || !exists[e.B] {
				return nil, rev, nil, fmt.Errorf("unknown review pair")
			}
			a, b := e.A, e.B
			if a > b {
				a, b = b, a
			}
			for _, r := range reviews {
				if r.A == a && r.B == b {
					return nil, rev, nil, fmt.Errorf("pair already reviewed")
				}
			}
			reviews = append(reviews, Review{a, b, e.Decision, e.Note})
		} else {
			return before, rev, nil, fmt.Errorf("unknown operation")
		}
		rev++
		seen[e.ID] = key
	}
	return points, rev, reviews, nil
}

// Radius components are suggestions only. Canonical export uses reviewed duplicate edges.
func Components(points []Point, radius float64, edges [][2]string, metric bool) [][]string {
	parent := map[string]string{}
	for _, p := range points {
		parent[p.ID] = p.ID
	}
	var find func(string) string
	find = func(s string) string {
		if parent[s] != s {
			parent[s] = find(parent[s])
		}
		return parent[s]
	}
	union := func(a, b string) {
		a, b = find(a), find(b)
		if a > b {
			a, b = b, a
		}
		parent[b] = a
	}
	if metric {
		for i, a := range points {
			for _, b := range points[i+1:] {
				if Distance(a.X, b.X) <= radius {
					union(a.ID, b.ID)
				}
			}
		}
	} else {
		for _, e := range edges {
			union(e[0], e[1])
		}
	}
	groups := map[string][]string{}
	for _, p := range points {
		root := find(p.ID)
		groups[root] = append(groups[root], p.ID)
	}
	out := [][]string{}
	for _, g := range groups {
		sort.Strings(g)
		out = append(out, g)
	}
	sort.Slice(out, func(i, j int) bool { return out[i][0] < out[j][0] })
	return out
}
func Compute(r Request) (Output, error) {
	points, rev, reviews, e := Replay(r.Seed, r.Events)
	if e != nil {
		return Output{}, e
	}
	if math.IsNaN(r.Radius) || math.IsInf(r.Radius, 0) || r.Radius < 0 || r.Radius > 1e6 {
		return Output{}, fmt.Errorf("invalid radius")
	}
	t, e := New(points)
	if e != nil {
		return Output{}, e
	}
	hits, visited, e := t.KNN(r.Query, r.K)
	if e != nil {
		return Output{}, e
	}
	raw, _ := json.Marshal(points)
	h := sha256.Sum256(raw)
	edges := [][2]string{}
	for _, r := range reviews {
		if r.Decision == "duplicate" {
			edges = append(edges, [2]string{r.A, r.B})
		}
	}
	groups := Components(points, 0, edges, false)
	keep := map[string]bool{}
	for _, g := range groups {
		keep[g[0]] = true
	}
	component := map[string]string{}
	for _, group := range groups {
		for _, id := range group {
			component[id] = group[0]
		}
	}
	for _, review := range reviews {
		if review.Decision == "distinct" && component[review.A] == component[review.B] {
			return Output{}, fmt.Errorf("duplicate chain contradicts distinct review")
		}
	}
	canonical := []Point{}
	for _, p := range points {
		if keep[p.ID] {
			canonical = append(canonical, p)
		}
	}
	return Output{points, rev, hits, visited, Components(points, r.Radius, nil, true), reviews, fmt.Sprintf("%x", h), canonical}, nil
}
