import app from "./api/workspace.mjs";
app.listen(8788, "0.0.0.0", () =>
  console.log("Clearspan local API http://127.0.0.1:8788"),
);
