package engine

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

type Command struct {
	ID   string          `json:"id"`
	Kind string          `json:"kind"`
	Args json.RawMessage `json:"args"`
}
type Entry struct {
	Command  Command `json:"command"`
	Previous string  `json:"previous"`
	Hash     string  `json:"hash"`
}
type Workspace struct {
	Schema  int     `json:"schema"`
	Journal []Entry `json:"journal"`
	Head    string  `json:"head"`
}
type Observation struct {
	ID        string          `json:"id"`
	Tool      string          `json:"tool"`
	Arguments json.RawMessage `json:"arguments"`
	Result    any             `json:"result"`
}
type Decision struct {
	Tool      string          `json:"tool"`
	Arguments json.RawMessage `json:"arguments"`
}
type Provider struct {
	GenerationID string          `json:"generation_id"`
	Model        string          `json:"model"`
	Usage        json.RawMessage `json:"usage"`
	Cost         string          `json:"cost"`
}
type Record struct {
	Choice   Decision  `json:"choice"`
	Provider *Provider `json:"provider,omitempty"`
}
type Agent struct {
	Goal         string        `json:"goal"`
	Binding      string        `json:"binding"`
	Phase        string        `json:"phase"`
	Decisions    []Record      `json:"decisions"`
	Observations []Observation `json:"observations"`
	Summary      string        `json:"summary"`
	Citations    []string      `json:"citations"`
}
type Patch struct {
	Edge    Edge     `json:"edge"`
	Binding string   `json:"binding"`
	Status  string   `json:"status"`
	Note    string   `json:"note"`
	Proof   Analysis `json:"proof"`
}
type State struct {
	Spec         *Machine    `json:"spec"`
	Candidate    *Machine    `json:"candidate"`
	Version      int         `json:"version"`
	Analysis     *Analysis   `json:"analysis"`
	Trace        []TraceStep `json:"trace"`
	Reduction    *Reduction  `json:"reduction"`
	Campaign     []Mutation  `json:"campaign"`
	Patch        *Patch      `json:"patch"`
	Agent        *Agent      `json:"agent"`
	AgentHistory []Agent     `json:"agent_history"`
	Workspace    Workspace   `json:"workspace"`
}

func canon(v any) []byte {
	b, _ := json.Marshal(v)
	var x any
	if json.Unmarshal(b, &x) != nil {
		return b
	}
	b, _ = json.Marshal(x)
	return b
}
func digest(v any) string { sum := sha256.Sum256(canon(v)); return hex.EncodeToString(sum[:]) }
func Empty() State {
	return State{Trace: []TraceStep{}, Campaign: []Mutation{}, AgentHistory: []Agent{}, Workspace: Workspace{1, []Entry{}, strings.Repeat("0", 64)}}
}
func Binding(s State) string {
	return digest(struct {
		Spec      *Machine
		Candidate *Machine
		Version   int
	}{s.Spec, s.Candidate, s.Version})
}
func validNote(n string) error {
	if len(strings.TrimSpace(n)) < 3 || len(n) > 500 {
		return errors.New("Review/goal note requires3–500 characters")
	}
	return nil
}
func decodeArgs[T any](raw json.RawMessage) (T, error) {
	var a T
	if len(raw) == 0 {
		raw = json.RawMessage(`{}`)
	}
	err := strict(raw, &a)
	return a, err
}
func Apply(s State, c Command) (State, error) {
	if !validID(c.ID) {
		return s, errors.New("Invalid command ID")
	}
	if len(c.Args) == 0 {
		c.Args = json.RawMessage(`{}`)
	}
	if len(canon(c)) > 32768 {
		return s, errors.New("Command bound32KiB")
	}
	for _, e := range s.Workspace.Journal {
		if e.Command.ID == c.ID {
			if digest(e.Command) != digest(c) {
				return s, errors.New("Duplicate command ID has conflicting content")
			}
			return s, nil
		}
	}
	if len(s.Workspace.Journal) >= 80 {
		return s, errors.New("Workspace operation bound80 reached")
	}
	raw, _ := json.Marshal(s)
	var next State
	json.Unmarshal(raw, &next)
	err := applyAction(&next, c)
	if err != nil {
		return s, err
	}
	entry := Entry{c, next.Workspace.Head, ""}
	entry.Hash = digest(struct {
		Command  Command `json:"command"`
		Previous string  `json:"previous"`
	}{c, entry.Previous})
	next.Workspace.Journal = append(next.Workspace.Journal, entry)
	next.Workspace.Head = entry.Hash
	if len(canon(next.Workspace)) > 262144 {
		return s, errors.New("Portable workspace bound256KiB reached")
	}
	return next, nil
}
func applyAction(s *State, c Command) error {
	if c.Kind == "import" {
		args, err := decodeArgs[struct {
			Spec      Machine `json:"spec"`
			Candidate Machine `json:"candidate"`
		}](c.Args)
		if err != nil {
			return err
		}
		a, err := Compile(args.Spec)
		if err != nil {
			return err
		}
		b, err := Compile(args.Candidate)
		if err != nil {
			return err
		}
		if err = sameAlphabet(a, b); err != nil {
			return err
		}
		s.Spec = &a
		s.Candidate = &b
		s.Version++
		s.Analysis = nil
		s.Patch = nil
		s.Reduction = nil
		s.Trace = []TraceStep{}
		s.Campaign = []Mutation{}
		if s.Agent != nil {
			s.Agent.Phase = "STALE"
		}
		return nil
	}
	if s.Spec == nil || s.Candidate == nil {
		return errors.New("Import compiled contracts first")
	}
	a, b := *s.Spec, *s.Candidate
	switch c.Kind {
	case "check":
		if _, err := decodeArgs[struct{}](c.Args); err != nil {
			return err
		}
		r, err := Check(a, b)
		if err != nil {
			return err
		}
		s.Analysis = &r
	case "trace":
		args, err := decodeArgs[struct {
			Symbols []string `json:"symbols"`
		}](c.Args)
		if err != nil {
			return err
		}
		r, err := Replay(a, b, args.Symbols)
		if err != nil {
			return err
		}
		s.Trace = r
	case "shrink":
		args, err := decodeArgs[struct {
			Symbols []string `json:"symbols"`
		}](c.Args)
		if err != nil {
			return err
		}
		r, err := Shrink(a, b, args.Symbols)
		if err != nil {
			return err
		}
		s.Reduction = &r
	case "campaign":
		if _, err := decodeArgs[struct{}](c.Args); err != nil {
			return err
		}
		r, err := Campaign(a)
		if err != nil {
			return err
		}
		s.Campaign = r
	case "propose_patch":
		if _, err := decodeArgs[struct{}](c.Args); err != nil {
			return err
		}
		e, err := SuggestedPatch(a, b)
		if err != nil {
			return err
		}
		candidate, err := Compile(patched(b, e))
		if err != nil {
			return err
		}
		proof, err := Check(a, candidate)
		if err != nil {
			return err
		}
		s.Patch = &Patch{e, Binding(*s), "PROPOSED", "", proof}
	case "review_patch":
		args, err := decodeArgs[struct {
			Note string `json:"note"`
		}](c.Args)
		if err != nil {
			return err
		}
		if err = validNote(args.Note); err != nil {
			return err
		}
		p := s.Patch
		if p == nil || p.Status != "PROPOSED" || p.Binding != Binding(*s) {
			return errors.New("Current proposed patch required")
		}
		if !p.Proof.Equivalent {
			return errors.New("Proposed patch still fails exact conformance; cannot approve")
		}
		p.Note = args.Note
		p.Status = "REVIEWED"
	case "apply_patch":
		if _, err := decodeArgs[struct{}](c.Args); err != nil {
			return err
		}
		p := s.Patch
		if p == nil || p.Status != "REVIEWED" || p.Binding != Binding(*s) {
			return errors.New("Exact current patch must be reviewed first")
		}
		candidate, err := Compile(patched(b, p.Edge))
		if err != nil {
			return err
		}
		proof, err := Check(a, candidate)
		if err != nil {
			return err
		}
		if !proof.Equivalent {
			return errors.New("Patch failed exact post-check; original candidate retained")
		}
		s.Candidate = &candidate
		s.Version++
		p.Status = "APPLIED"
		p.Proof = proof
		s.Analysis = &proof
		if s.Agent != nil {
			s.Agent.Phase = "STALE"
		}
	case "agent_start":
		args, err := decodeArgs[struct {
			Goal     string `json:"goal"`
			Decision Record `json:"decision"`
		}](c.Args)
		if err != nil {
			return err
		}
		if err = validNote(args.Goal); err != nil {
			return err
		}
		if len(s.AgentHistory)+boolInt(s.Agent != nil) >= 4 {
			return errors.New("Four investigation bound reached")
		}
		if s.Agent != nil {
			s.AgentHistory = append(s.AgentHistory, *s.Agent)
		}
		s.Agent = &Agent{Goal: args.Goal, Binding: Binding(*s), Phase: "CONTINUE", Decisions: []Record{}, Observations: []Observation{}, Citations: []string{}}
		return decide(s, args.Decision)
	case "agent_continue":
		args, err := decodeArgs[struct {
			Decision Record `json:"decision"`
		}](c.Args)
		if err != nil {
			return err
		}
		if s.Agent == nil || s.Agent.Phase != "CONTINUE" || s.Agent.Binding != Binding(*s) {
			return errors.New("Current recoverable checkpoint required")
		}
		return decide(s, args.Decision)
	case "agent_review":
		if _, err := decodeArgs[struct{}](c.Args); err != nil {
			return err
		}
		if s.Agent == nil || s.Agent.Phase != "REVIEW" || s.Agent.Binding != Binding(*s) {
			return errors.New("Current cited evidence required")
		}
		s.Agent.Phase = "REVIEWED"
	default:
		return errors.New("Unknown command")
	}
	return nil
}
func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
func decide(s *State, record Record) error {
	agent := s.Agent
	if len(agent.Decisions) >= 4 {
		return errors.New("Four decision bound reached")
	}
	choice := record.Choice
	if len(choice.Arguments) == 0 {
		choice.Arguments = json.RawMessage(`{}`)
	}
	if len(canon(choice)) > 12000 {
		return errors.New("Decision bound exceeded")
	}
	a, b := *s.Spec, *s.Candidate
	var result any
	switch choice.Tool {
	case "inspect_contract":
		if _, err := decodeArgs[struct{}](choice.Arguments); err != nil {
			return err
		}
		result = struct {
			Spec      Machine `json:"spec"`
			Candidate Machine `json:"candidate"`
		}{a, b}
	case "check_equivalence":
		if _, err := decodeArgs[struct{}](choice.Arguments); err != nil {
			return err
		}
		r, err := Check(a, b)
		if err != nil {
			return err
		}
		result = r
	case "minimize_trace":
		args, err := decodeArgs[struct {
			Symbols []string `json:"symbols"`
		}](choice.Arguments)
		if err != nil {
			return err
		}
		r, err := Shrink(a, b, args.Symbols)
		if err != nil {
			return err
		}
		result = r
	case "suggest_patch":
		if _, err := decodeArgs[struct{}](choice.Arguments); err != nil {
			return err
		}
		edge, err := SuggestedPatch(a, b)
		if err != nil {
			return err
		}
		candidate, err := Compile(patched(b, edge))
		if err != nil {
			return err
		}
		proof, err := Check(a, candidate)
		if err != nil {
			return err
		}
		result = struct {
			Edge  Edge     `json:"edge"`
			Proof Analysis `json:"proof"`
		}{edge, proof}
	case "finish":
		args, err := decodeArgs[struct {
			Summary   string   `json:"summary"`
			Citations []string `json:"citations"`
		}](choice.Arguments)
		if err != nil {
			return err
		}
		if len(args.Summary) < 3 || len(args.Summary) > 2000 || len(args.Citations) < 1 || len(args.Citations) > 4 {
			return errors.New("Bounded summary and existing citations required")
		}
		for _, id := range args.Citations {
			found := false
			for _, o := range agent.Observations {
				if o.ID == id {
					found = true
				}
			}
			if !found {
				return errors.New("Unknown evidence citation")
			}
		}
		agent.Summary = args.Summary
		agent.Citations = args.Citations
		agent.Phase = "REVIEW"
		agent.Decisions = append(agent.Decisions, record)
		return nil
	default:
		return errors.New("Unknown or unauthorized tool; no repair applied")
	}
	agent.Observations = append(agent.Observations, Observation{fmt.Sprintf("E%d", len(agent.Observations)+1), choice.Tool, choice.Arguments, result})
	agent.Decisions = append(agent.Decisions, record)
	if len(agent.Decisions) == 4 {
		agent.Phase = "REVIEW"
		agent.Summary = "Decision bound reached; review exact observations."
		for _, o := range agent.Observations {
			agent.Citations = append(agent.Citations, o.ID)
		}
	}
	return nil
}
func Restore(w Workspace) (State, error) {
	if w.Schema != 1 || len(w.Journal) > 80 || len(canon(w)) > 262144 {
		return Empty(), errors.New("Schema1 bounded workspace required")
	}
	s := Empty()
	for _, e := range w.Journal {
		if e.Previous != s.Workspace.Head || e.Hash != digest(struct {
			Command  Command `json:"command"`
			Previous string  `json:"previous"`
		}{e.Command, e.Previous}) {
			return Empty(), errors.New("Journal integrity mismatch")
		}
		next, err := Apply(s, e.Command)
		if err != nil {
			return Empty(), err
		}
		s = next
	}
	if w.Head != s.Workspace.Head {
		return Empty(), errors.New("Workspace head mismatch")
	}
	return s, nil
}

type Request struct {
	Workspace *Workspace `json:"workspace"`
	Command   *Command   `json:"command"`
	Fail      bool       `json:"fail"`
}
type Response struct {
	OK             bool       `json:"ok"`
	State          *State     `json:"state,omitempty"`
	Workspace      *Workspace `json:"workspace,omitempty"`
	Error          string     `json:"error,omitempty"`
	SavedUnchanged bool       `json:"saved_workspace_unchanged,omitempty"`
}

func Process(raw []byte) []byte {
	fail := func(err error) []byte {
		out, _ := json.Marshal(Response{OK: false, Error: err.Error(), SavedUnchanged: true})
		return out
	}
	if len(raw) > 262144 {
		return fail(errors.New("Request bound256KiB"))
	}
	var request Request
	if err := strict(raw, &request); err != nil {
		return fail(err)
	}
	s := Empty()
	var err error
	if request.Workspace != nil {
		s, err = Restore(*request.Workspace)
		if err != nil {
			return fail(err)
		}
	}
	if request.Command != nil {
		s, err = Apply(s, *request.Command)
		if err != nil {
			return fail(err)
		}
		if request.Fail {
			return fail(errors.New("Injected precommit interruption; saved workspace unchanged"))
		}
	}
	out, _ := json.Marshal(Response{OK: true, State: &s, Workspace: &s.Workspace})
	return out
}
