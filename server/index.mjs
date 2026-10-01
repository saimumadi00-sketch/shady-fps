// Built-in HTTP streaming avoids a runtime networking dependency.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { RoomService } from "./rooms.mjs";
const TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
export function createMultiplayerServer({
  root = resolve("dist"),
  realtime = true,
  service = new RoomService(),
} = {}) {
  root = resolve(root);
  const json = (res, status, data) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify(data));
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        // No CORS: a page from a different origin cannot control a private session.
        if (
          req.headers.origin &&
          new URL(req.headers.origin).host !== req.headers.host
        )
          return json(res, 403, { error: "Use the same game server origin." });
        const token = req.headers.authorization?.replace(/^Bearer /, "");
        const client = service.sessions.get(token);
        if (url.pathname === "/api/events" && req.method === "GET") {
          if (!client)
            return json(res, 401, {
              error: "Session expired. Rejoin the room.",
            });
          if (client.stream)
            return json(res, 409, { error: "Session already connected." });
          res.writeHead(200, {
            "Content-Type": "application/x-ndjson",
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
          });
          res.flushHeaders();
          req.socket.setNoDelay(true);
          client.stream = res;
          res.write(JSON.stringify(service.snapshot(client)) + "\n");
          res.on("close", () => service.leave(client));
          return;
        }
        if (req.method !== "POST")
          return json(res, 405, { error: "POST required." });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return json(res, 415, { error: "JSON required." });
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4096) {
            json(res, 413, { error: "Request too large." });
            return;
          }
          chunks.push(chunk);
        }
        let data;
        try {
          data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          return json(res, 400, { error: "Invalid JSON." });
        }
        if (!data || typeof data !== "object" || Array.isArray(data))
          return json(res, 400, { error: "JSON object required." });
        if (["/api/create", "/api/join"].includes(url.pathname)) {
          const joined = service.join(data, url.pathname === "/api/create");
          return json(res, 200, {
            token: joined.token,
            code: joined.room.code,
            mode: joined.room.game.mode,
          });
        }
        if (!client)
          return json(res, 401, { error: "Session expired. Rejoin the room." });
        if (url.pathname === "/api/input") service.input(client, data);
        else if (url.pathname === "/api/start") service.start(client);
        else if (url.pathname === "/api/leave") service.leave(client);
        else return json(res, 404, { error: "Unknown command." });
        return json(res, 200, { ok: true });
      }
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      let path = resolve(root, "." + decodeURIComponent(url.pathname));
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
      const body = await readFile(path);
      res.writeHead(200, {
        "Content-Type": TYPES[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (error) {
      if (!res.headersSent)
        json(res, 400, {
          error: error.code === "ENOENT" ? "Not found" : error.message,
        });
      else res.destroy();
    }
  });
  server.requestTimeout = 10000;
  let last = performance.now(),
    accumulator = 0,
    snapshots = 0;
  const timer = realtime
    ? setInterval(() => {
        const now = performance.now();
        accumulator += Math.min((now - last) / 1000, 0.25);
        last = now;
        while (accumulator >= 1 / 60) {
          service.tick(1 / 60);
          accumulator -= 1 / 60;
        }
        snapshots++;
        if (snapshots % 3 === 0)
          for (const client of service.sessions.values()) {
            const stream = client.stream;
            if (!stream || stream.destroyed) continue;
            // Drop intermediate snapshots while a slow receiver drains; never grow an unbounded queue.
            if (stream.writableLength > 128 * 1024) {
              stream.destroy();
              continue;
            }
            if (!stream.writableNeedDrain)
              stream.write(JSON.stringify(service.snapshot(client)) + "\n");
          }
      }, 1000 / 60)
    : null;
  server.on("close", () => {
    clearInterval(timer);
    for (const c of service.sessions.values()) service.leave(c);
  });
  return {
    server,
    service,
    close: () => {
      clearInterval(timer);
      for (const c of service.sessions.values()) service.leave(c);
      server.close();
      server.closeAllConnections();
    },
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const { server, close } = createMultiplayerServer({
    service: new RoomService({
      idleTimeoutMs: Number(process.env.IDLE_TIMEOUT_MS || 5 * 60 * 1000),
    }),
  });
  const port = Number(process.env.PORT || 8080);
  server.listen(port, process.env.HOST || "0.0.0.0", () => {
    console.log(
      `Multiplayer: http://localhost:${port}/arena.html?online=1&mode=conquest`,
    );
    try {
      for (const list of Object.values(networkInterfaces()))
        for (const address of list || [])
          if (address.family === "IPv4" && !address.internal)
            console.log(
              `Friends on your Wi-Fi: http://${address.address}:${port}/`,
            );
    } catch {
      console.log(
        `Friends can connect using this computer's LAN IP and port ${port}.`,
      );
    }
  });
  for (const signal of ["SIGINT", "SIGTERM"])
    process.on(signal, () => {
      close();
    });
}
