export function sample() {
  const spec = {
      states: ["IDLE", "AUTH", "READY", "CLOSED"],
      alphabet: ["connect", "authenticate", "read", "close"],
      initial: "IDLE",
      edges: [
        { from: "IDLE", input: "connect", to: "AUTH", output: "HELLO" },
        { from: "AUTH", input: "authenticate", to: "READY", output: "OK" },
        { from: "AUTH", input: "read", to: "AUTH", output: "DENY" },
        { from: "READY", input: "read", to: "READY", output: "DATA" },
        { from: "READY", input: "close", to: "CLOSED", output: "BYE" },
        { from: "AUTH", input: "close", to: "CLOSED", output: "BYE" },
      ],
    },
    candidate = JSON.parse(JSON.stringify(spec));
  candidate.edges.find((e) => e.from === "AUTH" && e.input === "read").output =
    "DATA";
  return { spec, candidate };
}
