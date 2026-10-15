package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"wirewake/engine"
)

func main() {
	path := flag.String("workspace", "wirewake.json", "Durable single-user workspace path (Linux CLI)")
	expected := flag.String("expected-head", "", "Optional expected SHA256 head for stale-writer fencing")
	pause := flag.Bool("pause-before-rename", false, "Test-only: emit PREPARED and wait for one stdin byte before atomic rename")
	flag.Parse()
	var command *engine.Command
	if flag.NArg() > 0 {
		raw, err := os.ReadFile(flag.Arg(0))
		if err != nil {
			die(err)
		}
		if len(raw) > 32768 {
			die(fmt.Errorf("Command exceeds32KiB"))
		}
		c, parseError := engine.ParseCommand(raw)
		if parseError != nil {
			die(parseError)
		}
		command = &c
	}
	var prepared func()
	if *pause {
		prepared = func() {
			fmt.Fprintln(os.Stderr, "PREPARED")
			var b [1]byte
			if _, err := io.ReadFull(os.Stdin, b[:]); err != nil {
				die(err)
			}
		}
	}
	state, err := engine.UpdateFile(*path, *expected, command, prepared)
	if err != nil {
		die(err)
	}
	out, _ := json.MarshalIndent(state, "", "  ")
	fmt.Println(string(out))
}
func die(err error) { fmt.Fprintln(os.Stderr, err); os.Exit(1) }
