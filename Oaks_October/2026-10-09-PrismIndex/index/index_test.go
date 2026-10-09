package index

import (
	"fmt"
	"math"
	"math/rand"
	"reflect"
	"testing"
)

func points(n, d int) []Point {
	r := rand.New(rand.NewSource(109))
	p := make([]Point, n)
	for i := range p {
		x := make([]float64, d)
		for j := range x {
			x[j] = r.Float64() * 100
		}
		p[i] = Point{fmt.Sprintf("p%04d", i), x}
	}
	return p
}
func TestDifferential(t *testing.T) {
	for _, d := range []int{1, 2, 6, 16} {
		p := points(300, d)
		tree, _ := New(p)
		r := rand.New(rand.NewSource(37))
		for trial := 0; trial < 100; trial++ {
			q := make([]float64, d)
			for i := range q {
				q[i] = r.Float64() * 100
			}
			k := trial%20 + 1
			got, _, e := tree.KNN(q, k)
			if e != nil || !reflect.DeepEqual(got, Brute(p, q, k)) {
				t.Fatalf("differential d=%d trial=%d", d, trial)
			}
		}
	}
}
func TestTiesAndBoundaries(t *testing.T) {
	p := []Point{{"z", []float64{0, 0}}, {"a", []float64{0, 0}}, {"b", []float64{1, 0}}, {"c", []float64{-1, 0}}}
	tree, _ := New(p)
	for k := 1; k <= 4; k++ {
		got, _, _ := tree.KNN([]float64{0, 0}, k)
		if !reflect.DeepEqual(got, Brute(p, []float64{0, 0}, k)) {
			t.Fatal(got)
		}
	}
}
func TestValidationAndOwnership(t *testing.T) {
	p := points(3, 2)
	tree, _ := New(p)
	p[0].X[0] = 999
	got, _, _ := tree.KNN([]float64{0, 0}, 3)
	if reflect.DeepEqual(got, Brute(p, []float64{0, 0}, 3)) {
		t.Fatal("tree aliases caller")
	}
	if _, e := New([]Point{{"bad", []float64{math.NaN()}}}); e == nil {
		t.Fatal("accepted nan")
	}
	if _, _, e := tree.KNN([]float64{0}, 1); e == nil {
		t.Fatal("dimension")
	}
}
func TestRecoveryIdempotencyAndInvalidation(t *testing.T) {
	p := points(5, 2)
	e := Operation{ID: "review", Kind: "review", A: p[0].ID, B: p[1].ID, Decision: "duplicate", Note: "Reviewed synthetic descriptors"}
	_, rev, reviews, err := Replay(p, []Operation{e, e})
	if err != nil || rev != 1 || len(reviews) != 1 {
		t.Fatal(err, rev, reviews)
	}
	_, _, _, err = Replay(p, []Operation{e, {ID: "delete", Revision: 1, Kind: "delete", Target: p[0].ID}})
	if err != nil {
		t.Fatal(err)
	}
	_, _, r, _ := Replay(p, []Operation{e, {ID: "update", Revision: 1, Kind: "upsert", Point: &Point{p[0].ID, []float64{2, 3}}}})
	if len(r) != 0 {
		t.Fatal("stale reviews survive edit")
	}
	_, _, _, err = Replay(p, []Operation{e, {ID: "wrong", Revision: 0, Kind: "delete", Target: p[0].ID}})
	if err == nil {
		t.Fatal("stale revision accepted")
	}
}
func TestCanonicalAndSuggestionSeparation(t *testing.T) {
	p := []Point{{"a", []float64{0, 0}}, {"b", []float64{.1, 0}}, {"c", []float64{9, 9}}}
	r := Request{Seed: p, Query: []float64{0, 0}, K: 2, Radius: 1}
	o, _ := Compute(r)
	if len(o.Clusters) != 2 || len(o.Canonical) != 3 {
		t.Fatal("suggestion auto-deleted")
	}
	r.Events = []Operation{{ID: "r", Kind: "review", A: "a", B: "b", Decision: "duplicate", Note: "Reviewed duplicate"}}
	o, _ = Compute(r)
	if len(o.Canonical) != 2 || o.Canonical[0].ID != "a" {
		t.Fatal(o)
	}
}
func TestStructuralPartition(t *testing.T) {
	tree, _ := New(points(150, 4))
	var walk func(*Node)
	walk = func(n *Node) {
		if n == nil {
			return
		}
		var all func(*Node, bool)
		all = func(c *Node, inner bool) {
			if c == nil {
				return
			}
			d := Distance(n.P.X, c.P.X)
			if inner && d > n.Mu+1e-9 || !inner && d < n.Mu-1e-9 {
				t.Fatal("partition invariant")
			}
			all(c.Inner, inner)
			all(c.Outer, inner)
		}
		all(n.Inner, true)
		all(n.Outer, false)
		walk(n.Inner)
		walk(n.Outer)
	}
	walk(tree.Root)
}

func TestContradictoryReviewChain(t *testing.T) {
	p := []Point{{"a", []float64{0, 0}}, {"b", []float64{1, 0}}, {"c", []float64{2, 0}}}
	r := Request{Seed: p, Query: []float64{0, 0}, K: 1, Radius: 1, Events: []Operation{{ID: "r1", Kind: "review", A: "a", B: "c", Decision: "distinct", Note: "Different assets"}, {ID: "r2", Revision: 1, Kind: "review", A: "a", B: "b", Decision: "duplicate", Note: "Same asset"}, {ID: "r3", Revision: 2, Kind: "review", A: "b", B: "c", Decision: "duplicate", Note: "Same asset"}}}
	if _, e := Compute(r); e == nil {
		t.Fatal("contradictory duplicate chain accepted")
	}
}
