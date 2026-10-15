//go:build linux

package engine

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"syscall"
	"time"
)

// UpdateFile holds a kernel-managed advisory lock across read/validate/replace.
// Kernel release on process death avoids stale PID/lease lock-file races.
func UpdateFile(path string, expectedHead string, c *Command, prepared func()) (State, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return Empty(), err
	}
	lock, err := os.OpenFile(path+".lock", os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return Empty(), err
	}
	defer lock.Close()
	locked := false
	for i := 0; i < 100; i++ {
		err = syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB)
		if err == nil {
			locked = true
			break
		}
		if !errors.Is(err, syscall.EWOULDBLOCK) {
			return Empty(), err
		}
		time.Sleep(5 * time.Millisecond)
	}
	if !locked {
		return Empty(), errors.New("Workspace busy; retry without changing command ID")
	}
	defer syscall.Flock(int(lock.Fd()), syscall.LOCK_UN)
	state := Empty()
	raw, err := os.ReadFile(path)
	if err == nil {
		var w Workspace
		if len(raw) > 262144 {
			return state, errors.New("Stored workspace oversized")
		}
		if err = strict(raw, &w); err != nil {
			return state, err
		}
		state, err = Restore(w)
		if err != nil {
			return state, err
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return state, err
	}
	if expectedHead != "" && expectedHead != state.Workspace.Head {
		return state, errors.New("Stale workspace head; reopen before retrying")
	}
	if c == nil {
		return state, nil
	}
	state, err = Apply(state, *c)
	if err != nil {
		return Empty(), err
	}
	bytes, err := json.Marshal(state.Workspace)
	if err != nil {
		return Empty(), err
	}
	if len(bytes) > 262144 {
		return Empty(), errors.New("Stored workspace oversized")
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".wirewake-write-*")
	if err != nil {
		return Empty(), err
	}
	name := file.Name()
	defer os.Remove(name)
	if err = file.Chmod(0600); err != nil {
		file.Close()
		return Empty(), err
	}
	if _, err = file.Write(bytes); err != nil {
		file.Close()
		return Empty(), err
	}
	if err = file.Sync(); err != nil {
		file.Close()
		return Empty(), err
	}
	if err = file.Close(); err != nil {
		return Empty(), err
	}
	if prepared != nil {
		prepared()
	}
	if err = os.Rename(name, path); err != nil {
		return Empty(), err
	}
	dir, err := os.Open(filepath.Dir(path))
	if err != nil {
		return Empty(), err
	}
	defer dir.Close()
	if err = dir.Sync(); err != nil {
		return Empty(), err
	}
	return state, nil
}
