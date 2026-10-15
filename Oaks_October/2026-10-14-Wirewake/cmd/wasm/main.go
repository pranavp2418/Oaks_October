//go:build js && wasm

package main

import (
	"syscall/js"
	"wirewake/engine"
)

func main() {
	handler := js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 || args[0].Type() != js.TypeString {
			return `{"ok":false,"error":"One JSON string required","saved_workspace_unchanged":true}`
		}
		return string(engine.Process([]byte(args[0].String())))
	})
	js.Global().Set("wirewakeProcess", handler)
	select {}
}
