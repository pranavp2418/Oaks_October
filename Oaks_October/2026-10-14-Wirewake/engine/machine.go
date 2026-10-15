package engine

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
)

type Edge struct {
	From   string `json:"from"`
	Input  string `json:"input"`
	To     string `json:"to"`
	Output string `json:"output"`
}
type Machine struct {
	States   []string `json:"states"`
	Alphabet []string `json:"alphabet"`
	Initial  string   `json:"initial"`
	Edges    []Edge   `json:"edges"`
}
type Pair struct {
	Spec      string `json:"spec"`
	Candidate string `json:"candidate"`
}
type TraceStep struct {
	Index    int    `json:"index"`
	Input    string `json:"input"`
	Before   Pair   `json:"before"`
	After    Pair   `json:"after"`
	Expected string `json:"expected"`
	Actual   string `json:"actual"`
	Mismatch bool   `json:"mismatch"`
}
type Analysis struct {
	Equivalent     bool        `json:"equivalent"`
	Witness        []string    `json:"witness"`
	Steps          []TraceStep `json:"steps"`
	ReachablePairs int         `json:"reachable_pairs"`
	Transitions    int         `json:"transitions"`
	Guarantee      string      `json:"guarantee"`
}

func validID(s string) bool {
	if len(s) < 1 || len(s) > 48 {
		return false
	}
	for _, r := range s {
		if !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '_' || r == '-') {
			return false
		}
	}
	return true
}
func strict(raw []byte, out any) error {
	if err := unambiguousJSON(raw); err != nil {
		return err
	}
	d := json.NewDecoder(strings.NewReader(string(raw)))
	d.DisallowUnknownFields()
	if err := d.Decode(out); err != nil {
		return errors.New("Invalid JSON shape: " + err.Error())
	}
	if d.More() {
		return errors.New("Trailing JSON")
	}
	return nil
}
func unambiguousJSON(raw []byte) error {
	text := strings.TrimSpace(string(raw))
	if len(text) < 2 || text[0] != '{' {
		return errors.New("JSON object required")
	}
	d := json.NewDecoder(strings.NewReader(text))
	d.UseNumber()
	var value func(int) error
	value = func(depth int) error {
		if depth > 64 {
			return errors.New("JSON nesting bound64 exceeded")
		}
		token, err := d.Token()
		if err != nil {
			return err
		}
		delimiter, ok := token.(json.Delim)
		if !ok {
			return nil
		}
		switch delimiter {
		case '{':
			keys := map[string]bool{}
			for d.More() {
				key, err := d.Token()
				if err != nil {
					return err
				}
				name, ok := key.(string)
				if !ok || keys[strings.ToLower(name)] {
					return errors.New("Duplicate or ambiguous JSON field")
				}
				keys[strings.ToLower(name)] = true
				if err = value(depth + 1); err != nil {
					return err
				}
			}
			end, err := d.Token()
			if err != nil || end != json.Delim('}') {
				return errors.New("Invalid object ending")
			}
		case '[':
			for d.More() {
				if err := value(depth + 1); err != nil {
					return err
				}
			}
			end, err := d.Token()
			if err != nil || end != json.Delim(']') {
				return errors.New("Invalid array ending")
			}
		default:
			return errors.New("Unexpected JSON delimiter")
		}
		return nil
	}
	if err := value(0); err != nil {
		return err
	}
	if _, err := d.Token(); err != io.EOF {
		return errors.New("Trailing JSON")
	}
	return nil
}
func ParseCommand(raw []byte) (Command, error) {
	var command Command
	err := strict(raw, &command)
	return command, err
}
func contains(xs []string, x string) bool {
	for _, s := range xs {
		if s == x {
			return true
		}
	}
	return false
}
func Compile(m Machine) (Machine, error) {
	if len(m.States) < 1 || len(m.States) > 12 || len(m.Alphabet) < 1 || len(m.Alphabet) > 8 || len(m.Edges) > 96 {
		return m, errors.New("Machine bound:1–12 states,1–8 symbols,0–96 edges")
	}
	for _, xs := range [][]string{m.States, m.Alphabet} {
		seen := map[string]bool{}
		for _, s := range xs {
			if !validID(s) || seen[s] {
				return m, errors.New("Identifiers must be unique bounded ASCII names")
			}
			seen[s] = true
		}
	}
	if !contains(m.States, m.Initial) {
		return m, errors.New("Unknown initial state")
	}
	seen := map[string]bool{}
	for _, e := range m.Edges {
		key := e.From + "\x00" + e.Input
		if !contains(m.States, e.From) || !contains(m.States, e.To) || !contains(m.Alphabet, e.Input) || !validID(e.Output) || seen[key] {
			return m, errors.New("Unknown reference, invalid output or nondeterministic duplicate edge")
		}
		seen[key] = true
	}
	m.States = append([]string{}, m.States...)
	m.Alphabet = append([]string{}, m.Alphabet...)
	m.Edges = append([]Edge{}, m.Edges...)
	sort.Strings(m.States)
	sort.Strings(m.Alphabet)
	sort.Slice(m.Edges, func(i, j int) bool {
		a, b := m.Edges[i], m.Edges[j]
		return a.From < b.From || a.From == b.From && a.Input < b.Input
	})
	return m, nil
}
func step(m Machine, state, input string) (string, string) {
	for _, e := range m.Edges {
		if e.From == state && e.Input == input {
			return e.To, e.Output
		}
	}
	return state, "REJECT"
}
func sameAlphabet(a, b Machine) error {
	if strings.Join(a.Alphabet, "\x00") != strings.Join(b.Alphabet, "\x00") {
		return errors.New("Both contracts require the same alphabet")
	}
	return nil
}
func Replay(a, b Machine, trace []string) ([]TraceStep, error) {
	if len(trace) > 128 {
		return nil, errors.New("Trace bound128 symbols")
	}
	if err := sameAlphabet(a, b); err != nil {
		return nil, err
	}
	at := Pair{a.Initial, b.Initial}
	out := []TraceStep{}
	for i, symbol := range trace {
		if !contains(a.Alphabet, symbol) {
			return nil, fmt.Errorf("Unknown trace symbol %q", symbol)
		}
		sa, oa := step(a, at.Spec, symbol)
		sb, ob := step(b, at.Candidate, symbol)
		next := Pair{sa, sb}
		out = append(out, TraceStep{i, symbol, at, next, oa, ob, oa != ob})
		at = next
	}
	return out, nil
}
func fails(a, b Machine, trace []string) bool {
	steps, err := Replay(a, b, trace)
	if err != nil {
		return false
	}
	for _, s := range steps {
		if s.Mismatch {
			return true
		}
	}
	return false
}
func Check(a, b Machine) (Analysis, error) {
	if err := sameAlphabet(a, b); err != nil {
		return Analysis{}, err
	}
	initial := Pair{a.Initial, b.Initial}
	q := []Pair{initial}
	seen := map[Pair]bool{initial: true}
	paths := map[Pair][]string{initial: {}}
	edges := 0
	for head := 0; head < len(q); head++ {
		at := q[head]
		for _, symbol := range a.Alphabet {
			edges++
			sa, oa := step(a, at.Spec, symbol)
			sb, ob := step(b, at.Candidate, symbol)
			path := append(append([]string{}, paths[at]...), symbol)
			if oa != ob {
				steps, _ := Replay(a, b, path)
				return Analysis{false, path, steps, len(q), edges, "Shortest distinguishing trace by breadth-first reachable-product exploration"}, nil
			}
			next := Pair{sa, sb}
			if !seen[next] {
				seen[next] = true
				q = append(q, next)
				paths[next] = path
			}
		}
	}
	return Analysis{true, []string{}, []TraceStep{}, len(q), edges, "All reachable product states exhausted under supplied finite Mealy semantics"}, nil
}

type Reduction struct {
	Original    []string    `json:"original"`
	Reduced     []string    `json:"reduced"`
	Steps       []TraceStep `json:"steps"`
	OracleCalls int         `json:"oracle_calls"`
	OneMinimal  bool        `json:"one_minimal"`
}

func Shrink(a, b Machine, trace []string) (Reduction, error) {
	if _, err := Replay(a, b, trace); err != nil {
		return Reduction{}, err
	}
	if !fails(a, b, trace) {
		return Reduction{}, errors.New("Trace does not reproduce an output disagreement")
	}
	original := append([]string{}, trace...)
	trace = append([]string{}, trace...)
	calls := 1
	n := 2
	for len(trace) >= 2 {
		chunk := (len(trace) + n - 1) / n
		reduced := false
		for start := 0; start < len(trace); start += chunk {
			end := start + chunk
			if end > len(trace) {
				end = len(trace)
			}
			candidate := append(append([]string{}, trace[:start]...), trace[end:]...)
			calls++
			if fails(a, b, candidate) {
				trace = candidate
				if n > 2 {
					n--
				}
				reduced = true
				break
			}
		}
		if !reduced {
			if n >= len(trace) {
				break
			}
			n *= 2
			if n > len(trace) {
				n = len(trace)
			}
		}
	}
	for changed := true; changed; {
		changed = false
		for i := range trace {
			candidate := append(append([]string{}, trace[:i]...), trace[i+1:]...)
			calls++
			if fails(a, b, candidate) {
				trace = candidate
				changed = true
				break
			}
		}
	}
	minimal := true
	for i := range trace {
		candidate := append(append([]string{}, trace[:i]...), trace[i+1:]...)
		calls++
		if fails(a, b, candidate) {
			minimal = false
		}
	}
	steps, _ := Replay(a, b, trace)
	return Reduction{original, trace, steps, calls, minimal}, nil
}

type Mutation struct {
	Edge       int      `json:"edge"`
	Kind       string   `json:"kind"`
	Equivalent bool     `json:"equivalent"`
	Witness    []string `json:"witness"`
}

func Campaign(spec Machine) ([]Mutation, error) {
	out := []Mutation{}
	for i, e := range spec.Edges {
		for _, kind := range []string{"output", "next_state"} {
			m := spec
			m.Edges = append([]Edge{}, spec.Edges...)
			if kind == "output" {
				m.Edges[i].Output = "MUTANT"
				if e.Output == "MUTANT" {
					m.Edges[i].Output = "MUTANT_ALT"
				}
			} else {
				if len(m.States) < 2 {
					continue
				}
				for _, s := range m.States {
					if s != e.To {
						m.Edges[i].To = s
						break
					}
				}
			}
			result, err := Check(spec, m)
			if err != nil {
				return nil, err
			}
			out = append(out, Mutation{i, kind, result.Equivalent, result.Witness})
		}
	}
	return out, nil
}
func SuggestedPatch(a, b Machine) (Edge, error) {
	check, err := Check(a, b)
	if err != nil {
		return Edge{}, err
	}
	if check.Equivalent {
		return Edge{}, errors.New("Contracts already equivalent")
	}
	last := check.Steps[len(check.Steps)-1]
	to, output := step(a, last.Before.Spec, last.Input)
	if !contains(b.States, to) {
		to = last.Before.Candidate
	}
	return Edge{last.Before.Candidate, last.Input, to, output}, nil
}
func patched(m Machine, e Edge) Machine {
	m.Edges = append([]Edge{}, m.Edges...)
	for i, x := range m.Edges {
		if x.From == e.From && x.Input == e.Input {
			m.Edges[i] = e
			return m
		}
	}
	m.Edges = append(m.Edges, e)
	return m
}
