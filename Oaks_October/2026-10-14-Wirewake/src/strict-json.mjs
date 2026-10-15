// Validate raw object keys before JSON.parse can discard repeated fields.
export function parseStrict(text) {
  const result = JSON.parse(text);
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|[{}\[\]:,]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/g) ?? [];
  let at = 0;
  function value(depth) {
    if (depth > 64) throw Error("JSON nesting bound64 exceeded");
    const token = tokens[at++];
    if (token === "{") {
      const seen = new Set();
      while (tokens[at] !== "}") {
        const key = JSON.parse(tokens[at++]).toLowerCase();
        if (seen.has(key)) throw Error("Duplicate or ambiguous JSON field");
        seen.add(key); at++; value(depth + 1);
        if (tokens[at] !== ",") break;
        at++;
      }
      at++;
    } else if (token === "[") {
      while (tokens[at] !== "]") {
        value(depth + 1);
        if (tokens[at] !== ",") break;
        at++;
      }
      at++;
    }
  }
  value(0);
  return result;
}
