import http from "node:http";
import handler from "./api/workspace.mjs";
http
  .createServer(async (req, res) => {
    if (req.url !== "/api/workspace") {
      res.writeHead(404);
      res.end();
      return;
    }
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 262144) {
        res.writeHead(413);
        res.end("Request bound exceeded");
        return;
      }
      chunks.push(chunk);
    }
    try {
      req.body = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString())
        : null;
    } catch {
      res.writeHead(400);
      res.end('{"error":"Invalid JSON"}');
      return;
    }
    await handler(req, res);
  })
  .listen(8789, "0.0.0.0", () =>
    console.log("Wirewake API http://127.0.0.1:8789"),
  );
