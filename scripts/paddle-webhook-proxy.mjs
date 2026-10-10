import { createServer } from "node:http";

// Tunnel this port only. No pages, account APIs, cookies or admin routes are forwarded.
const path = "/api/paddle/webhook";
const target = `http://127.0.0.1:3001${path}`;
const limit = 1_000_000;
const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== path) {
    response.writeHead(404).end();
    return;
  }
  if (Number(request.headers["content-length"] || 0) > limit) {
    response.writeHead(413).end();
    return;
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > limit) {
        response.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const signature = request.headers["paddle-signature"];
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Paddle-Signature": typeof signature === "string" ? signature : "",
      },
      body: Buffer.concat(chunks),
      signal: AbortSignal.timeout(20_000),
      redirect: "error",
    });
    response.writeHead(upstream.status, { "Content-Type": "application/json" });
    response.end(await upstream.text());
  } catch {
    if (!response.headersSent) response.writeHead(502);
    response.end();
  }
});
server.requestTimeout = 25_000;
server.headersTimeout = 10_000;
server.listen(3002, "127.0.0.1", () => {
  console.log("Local webhook proxy: POST http://127.0.0.1:3002/api/paddle/webhook");
  console.log(
    "All other paths and methods return 404. No public tunnel is started by this command.",
  );
});
