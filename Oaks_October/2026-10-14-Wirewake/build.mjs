import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  existsSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { build } from "vite";
const version = "1.27.2",
  expected = "ecbadb99091a3f46e31f5f934b068b1864eafa7995211b39eaddf76996045fe5";
let go = process.env.WIREWAKE_GO;
if (!go) {
  mkdirSync(".toolchain", { recursive: true });
  go = process.cwd() + "/.toolchain/go/bin/go";
  if (!existsSync(go)) {
    const r = await fetch(`https://go.dev/dl/go${version}.linux-amd64.tar.gz`);
    if (!r.ok) throw Error("Official Go toolchain download failed");
    const bytes = Buffer.from(await r.arrayBuffer());
    if (createHash("sha256").update(bytes).digest("hex") !== expected)
      throw Error("Official Go archive checksum mismatch");
    writeFileSync(".toolchain/go.tar.gz", bytes);
    const p = spawnSync(
      "tar",
      ["-xzf", ".toolchain/go.tar.gz", "-C", ".toolchain"],
      { stdio: "inherit" },
    );
    if (p.status !== 0) throw Error("Go extraction failed");
  }
}
const actual = spawnSync(go, ["version"], { encoding: "utf8" });
if (actual.status !== 0 || !actual.stdout.includes("go" + version + " "))
  throw Error("Pinned Go1.27.2 required");
mkdirSync("public", { recursive: true });
const p = spawnSync(
  go,
  [
    "build",
    "-trimpath",
    "-buildvcs=false",
    "-ldflags=-s -w",
    "-o",
    "public/engine.wasm",
    "./cmd/wasm",
  ],
  {
    env: { ...process.env, GOOS: "js", GOARCH: "wasm", CGO_ENABLED: "0" },
    stdio: "inherit",
  },
);
if (p.status !== 0) process.exit(p.status ?? 1);
const goroot = spawnSync(go, ["env", "GOROOT"], {
  encoding: "utf8",
}).stdout.trim();
copyFileSync(goroot + "/lib/wasm/wasm_exec.js", "public/wasm_exec.js");
copyFileSync(goroot + "/LICENSE", "GO_RUNTIME_LICENSE.txt");
copyFileSync(goroot + "/LICENSE", "public/GO_RUNTIME_LICENSE.txt");
writeFileSync(
  "public/core-identity.json",
  JSON.stringify({
    go: version,
    sha256: createHash("sha256")
      .update(readFileSync("public/engine.wasm"))
      .digest("hex"),
    machine_source_sha256: createHash("sha256")
      .update(readFileSync("engine/machine.go"))
      .digest("hex"),
    state_source_sha256: createHash("sha256")
      .update(readFileSync("engine/workspace.go"))
      .digest("hex"),
  }),
);
if (!process.argv.includes("--core-only")) {
  const ts = spawnSync(
    process.execPath,
    ["node_modules/typescript/bin/tsc", "--noEmit"],
    { stdio: "inherit" },
  );
  if (ts.status !== 0) process.exit(ts.status ?? 1);
  await build();
}
