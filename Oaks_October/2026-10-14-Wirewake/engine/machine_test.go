package engine

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"testing"
)

func sample() (Machine, Machine) {
	a := Machine{States: []string{"IDLE", "AUTH", "READY", "CLOSED"}, Alphabet: []string{"connect", "authenticate", "read", "close"}, Initial: "IDLE", Edges: []Edge{{"IDLE", "connect", "AUTH", "HELLO"}, {"AUTH", "authenticate", "READY", "OK"}, {"AUTH", "read", "AUTH", "DENY"}, {"READY", "read", "READY", "DATA"}, {"READY", "close", "CLOSED", "BYE"}, {"AUTH", "close", "CLOSED", "BYE"}}}
	a, _ = Compile(a)
	b := a
	b.Edges = append([]Edge{}, a.Edges...)
	for i, e := range b.Edges {
		if e.From == "AUTH" && e.Input == "read" {
			b.Edges[i].Output = "DATA"
		}
	}
	return a, b
}
func independent(m Machine, trace []string) []string {
	at := m.Initial
	out := []string{}
	for _, symbol := range trace {
		value := "REJECT"
		for _, e := range m.Edges {
			if e.From == at && e.Input == symbol {
				value = e.Output
				at = e.To
				break
			}
		}
		out = append(out, value)
	}
	return out
}
func equalStrings(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}
func TestIndependentBoundedEnumeration(t *testing.T) {
	r := rand.New(rand.NewSource(1424))
	for fixture := 0; fixture < 400; fixture++ {
		n := 1 + r.Intn(3)
		states := []string{}
		for i := 0; i < n; i++ {
			states = append(states, fmt.Sprintf("S%d", i))
		}
		a := Machine{States: states, Alphabet: []string{"a", "b"}, Initial: "S0"}
		b := a
		for _, s := range states {
			for _, symbol := range a.Alphabet {
				a.Edges = append(a.Edges, Edge{s, symbol, states[r.Intn(n)], fmt.Sprintf("O%d", r.Intn(2))})
				b.Edges = append(b.Edges, Edge{s, symbol, states[r.Intn(n)], fmt.Sprintf("O%d", r.Intn(2))})
			}
		}
		a, _ = Compile(a)
		b, _ = Compile(b)
		result, err := Check(a, b)
		if err != nil {
			t.Fatal(err)
		}
		shortest := -1
		var enumerate func([]string, int)
		enumerate = func(trace []string, left int) {
			if !equalStrings(independent(a, trace), independent(b, trace)) {
				if shortest < 0 || len(trace) < shortest {
					shortest = len(trace)
				}
				return
			}
			if left == 0 {
				return
			}
			for _, symbol := range a.Alphabet {
				enumerate(append(append([]string{}, trace...), symbol), left-1)
			}
		}
		enumerate(nil, n*n)
		if result.Equivalent != (shortest < 0) {
			t.Fatalf("fixture%d equivalence mismatch", fixture)
		}
		if shortest >= 0 && (len(result.Witness) != shortest || equalStrings(independent(a, result.Witness), independent(b, result.Witness))) {
			t.Fatalf("fixture%d shortest witness mismatch", fixture)
		}
	}
}
func TestReductionAndMutation(t *testing.T) {
	a, b := sample()
	trace := []string{"read", "close", "connect", "read", "read", "read", "authenticate", "close"}
	r, err := Shrink(a, b, trace)
	if err != nil {
		t.Fatal(err)
	}
	if !r.OneMinimal || !fails(a, b, r.Reduced) || len(r.Reduced) != 2 {
		t.Fatal(r)
	}
	for i := range r.Reduced {
		short := append(append([]string{}, r.Reduced[:i]...), r.Reduced[i+1:]...)
		if !equalStrings(independent(a, short), independent(b, short)) {
			t.Fatal("deletion not minimal")
		}
	}
	campaign, err := Campaign(a)
	if err != nil || len(campaign) != 2*len(a.Edges) {
		t.Fatal(err, campaign)
	}
	for _, m := range campaign {
		if !m.Equivalent && len(m.Witness) == 0 {
			t.Fatal("missing mutant witness")
		}
	}
}
func command(id, kind string, args any) Command {
	raw, _ := json.Marshal(args)
	return Command{id, kind, raw}
}
func imported(t *testing.T) State {
	t.Helper()
	a, b := sample()
	s, err := Apply(Empty(), command("import", "import", map[string]any{"spec": a, "candidate": b}))
	if err != nil {
		t.Fatal(err)
	}
	return s
}
func TestReviewPatchAtomicReplay(t *testing.T) {
	s := imported(t)
	for _, kind := range []string{"check", "propose_patch"} {
		var err error
		s, err = Apply(s, command(kind, kind, struct{}{}))
		if err != nil {
			t.Fatal(err)
		}
	}
	before := digest(s)
	if _, err := Apply(s, command("bad", "apply_patch", struct{}{})); err == nil {
		t.Fatal("unreviewed patch accepted")
	}
	if digest(s) != before {
		t.Fatal("failed command mutated input")
	}
	var err error
	s, err = Apply(s, command("review", "review_patch", map[string]string{"note": "Reviewed shortest witness and exact proof"}))
	if err != nil {
		t.Fatal(err)
	}
	apply := command("apply", "apply_patch", struct{}{})
	s, err = Apply(s, apply)
	if err != nil || !s.Analysis.Equivalent || s.Patch.Status != "APPLIED" {
		t.Fatal(err)
	}
	again, err := Apply(s, apply)
	if err != nil || digest(again) != digest(s) {
		t.Fatal("idempotency", err)
	}
	if _, err = Apply(s, command("apply", "check", struct{}{})); err == nil {
		t.Fatal("conflicting ID accepted")
	}
	replayed, err := Restore(s.Workspace)
	if err != nil || digest(replayed) != digest(s) {
		t.Fatal("replay mismatch", err)
	}
	bad := s.Workspace
	bad.Journal = append([]Entry{}, bad.Journal...)
	bad.Journal[0].Hash = "tampered"
	if _, err = Restore(bad); err == nil {
		t.Fatal("tamper accepted")
	}
}
func TestMalformedAndAdversarialChoices(t *testing.T) {
	a, b := sample()
	a.Edges = append(a.Edges, a.Edges[0])
	if _, err := Compile(a); err == nil {
		t.Fatal("nondeterministic accepted")
	}
	a, b = sample()
	if _, err := Replay(a, b, []string{"injected"}); err == nil {
		t.Fatal("unknown symbol accepted")
	}
	if _, err := Shrink(a, b, []string{"read"}); err == nil {
		t.Fatal("nonfailing shrink accepted")
	}
	s := imported(t)
	before := digest(s)
	for i := 0; i < 24; i++ {
		choice := Decision{"apply_patch", json.RawMessage(`{}`)}
		if i%2 == 1 {
			choice = Decision{"finish", json.RawMessage(`{"summary":"Invented result","citations":["E99"]}`)}
		}
		_, err := Apply(s, command(fmt.Sprintf("bad%d", i), "agent_start", map[string]any{"goal": "Inspect controlled protocol", "decision": Record{Choice: choice}}))
		if err == nil {
			t.Fatal("unsafe decision accepted")
		}
	}
	if digest(s) != before {
		t.Fatal("agent mutated original")
	}
	for _, raw := range []string{`{"workspace":{},"unknown":1}`, `{"command":{"id":"x","kind":"check","args":{"unknown":1}}}`, `[]`, `{`} {
		var response Response
		if json.Unmarshal(Process([]byte(raw)), &response) != nil || response.OK {
			t.Fatal("invalid request accepted", raw)
		}
	}
}
func TestAgentCheckpointResume(t *testing.T) {
	s := imported(t)
	record := Record{Choice: Decision{"check_equivalence", json.RawMessage(`{}`)}}
	s, err := Apply(s, command("agent", "agent_start", map[string]any{"goal": "Explain shortest mismatch", "decision": record}))
	if err != nil {
		t.Fatal(err)
	}
	s, err = Restore(s.Workspace)
	if err != nil || s.Agent.Phase != "CONTINUE" || s.Agent.Observations[0].ID != "E1" {
		t.Fatal(err)
	}
	finish := Record{Choice: Decision{"finish", json.RawMessage(`{"summary":"Exact witness requires review","citations":["E1"]}`)}}
	s, err = Apply(s, command("continue", "agent_continue", map[string]any{"decision": finish}))
	if err != nil {
		t.Fatal(err)
	}
	s, err = Apply(s, command("review", "agent_review", struct{}{}))
	if err != nil || s.Agent.Phase != "REVIEWED" {
		t.Fatal(err)
	}
	replay, err := Restore(s.Workspace)
	if err != nil || digest(replay) != digest(s) {
		t.Fatal(err)
	}
}
func TestFileLockConcurrencyAndStaleHead(t *testing.T) {
	path := filepath.Join(t.TempDir(), "workspace.json")
	a, b := sample()
	initial := command("import", "import", map[string]any{"spec": a, "candidate": b})
	if _, err := UpdateFile(path, "", &initial, nil); err != nil {
		t.Fatal(err)
	}
	c := command("same", "check", struct{}{})
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() { defer wg.Done(); _, err := UpdateFile(path, "", &c, nil); errs <- err }()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	s, err := UpdateFile(path, "", nil, nil)
	if err != nil || len(s.Workspace.Journal) != 2 {
		t.Fatal(err, s.Workspace)
	}
	if _, err = UpdateFile(path, "stale", &c, nil); err == nil {
		t.Fatal("stale head accepted")
	}
	raw, _ := os.ReadFile(path)
	var w Workspace
	if json.Unmarshal(raw, &w) != nil || w.Head != s.Workspace.Head {
		t.Fatal("durable snapshot invalid")
	}
}
func BenchmarkProductBFS(b *testing.B) {
	a, c := sample()
	for i := 0; i < b.N; i++ {
		Check(a, c)
	}
}

func TestCaseAliasAndDuplicateJSON(t *testing.T) {
	for _, raw := range []string{`{"id":"a","ID":"b","kind":"check","args":{}}`, `{"id":"a","kind":"check","args":{"spec":{},"ſpec":{}}}`, `{"id":"a","id":"b","kind":"check","args":{}}`, `null`, `{"id":"a","kind":"check","args":{}} {}`} {
		if _, err := ParseCommand([]byte(raw)); err == nil {
			t.Fatalf("Ambiguous JSON accepted: %s", raw)
		}
	}
}
func TestLargeNativeSnapshotReopens(t *testing.T) {
	m := Machine{Initial: "S0"}
	for i := 0; i < 12; i++ {
		m.States = append(m.States, fmt.Sprintf("S%d", i))
	}
	for j := 0; j < 8; j++ {
		m.Alphabet = append(m.Alphabet, fmt.Sprintf("A%d", j))
	}
	for _, s := range m.States {
		for _, a := range m.Alphabet {
			m.Edges = append(m.Edges, Edge{s, a, s, "OK"})
		}
	}
	path := filepath.Join(t.TempDir(), "large.json")
	var saved State
	for i := 0; i < 9; i++ {
		c := command(fmt.Sprintf("large%d", i), "import", map[string]any{"spec": m, "candidate": m})
		var err error
		saved, err = UpdateFile(path, "", &c, nil)
		if err != nil {
			t.Fatal(err)
		}
	}
	indented, _ := json.MarshalIndent(saved.Workspace, "", "  ")
	compact, _ := os.ReadFile(path)
	if len(indented) <= 262144 || len(compact) >= 262144 {
		t.Fatalf("Fixture failed size boundary: compact=%d indented=%d", len(compact), len(indented))
	}
	reopened, err := UpdateFile(path, "", nil, nil)
	if err != nil || reopened.Workspace.Head != saved.Workspace.Head {
		t.Fatal("Committed snapshot failed reopen", err)
	}
	t.Logf("compact=%d indented=%d", len(compact), len(indented))
}
