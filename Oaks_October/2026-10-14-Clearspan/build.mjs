import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { build } from "vite";
mkdirSync("public", { recursive: true });
const zig = process.env.CLEARSPAN_ZIG;
if (zig) {
  const p = spawnSync(
    zig,
    [
      "c++",
      "-std=c++20",
      "-O3",
      "-target",
      "wasm32-freestanding",
      "-ffreestanding",
      "-fno-exceptions",
      "-fno-rtti",
      "-nostdlib",
      "core/route.cpp",
      "-Wl,--no-entry",
      "-Wl,--export-memory",
      "-Wl,--export=input_ptr",
      "-Wl,--export=output_ptr",
      "-Wl,--export=solve",
      "-o",
      "public/route.wasm",
    ],
    { stdio: "inherit" },
  );
  if (p.status !== 0) process.exit(p.status ?? 1);
  writeFileSync(
    "core/route.wasm.b64",
    readFileSync("public/route.wasm").toString("base64") + "\n",
  );
  writeFileSync(
    "core/route-build.json",
    JSON.stringify(
      {
        compiler: "Zig0.14.1 C++20 -O3 wasm32-freestanding",
        source_sha256: createHash("sha256")
          .update(readFileSync("core/route.cpp"))
          .digest("hex"),
        wasm_sha256: createHash("sha256")
          .update(readFileSync("public/route.wasm"))
          .digest("hex"),
      },
      null,
      2,
    ) + "\n",
  );
} else if (existsSync("core/route.wasm.b64"))
  writeFileSync(
    "public/route.wasm",
    Buffer.from(readFileSync("core/route.wasm.b64", "utf8"), "base64"),
  );
else throw Error("Set CLEARSPAN_ZIG to Zig 0.14.1 compiler on first build.");
const identity = createHash("sha256")
  .update(readFileSync("public/route.wasm"))
  .digest("hex");
const manifest = JSON.parse(readFileSync("core/route-build.json", "utf8"));
if (
  manifest.wasm_sha256 !== identity ||
  manifest.source_sha256 !==
    createHash("sha256").update(readFileSync("core/route.cpp")).digest("hex")
)
  throw Error(
    "Checked binary/source manifest mismatch: rebuild with pinned compiler",
  );
writeFileSync(
  "public/core-identity.json",
  JSON.stringify({
    sha256: identity,
    source_sha256: createHash("sha256")
      .update(readFileSync("core/route.cpp"))
      .digest("hex"),
  }),
);
if (!process.argv.includes("--core-only")) await build();
