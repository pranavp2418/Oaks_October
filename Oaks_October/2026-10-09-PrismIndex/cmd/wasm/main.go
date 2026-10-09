//go:build js && wasm

package main

import (
	"encoding/json"
	"fmt"
	"prismindex/index"
	"syscall/js"
)

func main() {
	js.Global().Set("prismCompute", js.FuncOf(func(this js.Value, args []js.Value) any {
		if len(args) != 1 {
			return `{"error":"one JSON argument required"}`
		}
		var r index.Request
		err := json.Unmarshal([]byte(args[0].String()), &r)
		var out any
		if err == nil {
			out, err = index.Compute(r)
		}
		if err != nil {
			out = map[string]string{"error": fmt.Sprint(err)}
		}
		raw, _ := json.Marshal(out)
		return string(raw)
	}))
	select {}
}
