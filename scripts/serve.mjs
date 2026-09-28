// Dependency-free local static server for source development or production preview.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
// Use separate default ports to isolate development from the production service-worker origin.
const root = resolve(process.argv[2] || "."),
  port = Number(process.env.PORT || (process.argv[2] ? 8080 : 5173));
// Send executable assets with browser-compatible MIME types.
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};
http
  .createServer(async (req, res) => {
    try {
      // Decode and resolve the request beneath the selected document root.
      const pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      let path = resolve(root, "." + pathname);
      // Reject normalized paths outside the root rather than exposing parent directories.
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      // Redirect directory URLs to preserve the correct base for relative asset requests.
      if ((await stat(path)).isDirectory()) {
        const url = new URL(req.url, "http://localhost");
        if (!url.pathname.endsWith("/")) {
          res.writeHead(308, { Location: url.pathname + "/" + url.search });
          res.end();
          return;
        }
        path = resolve(path, "index.html");
      }
      // Serve fresh local bytes so browser HTTP caching does not hide edits.
      const body = await readFile(path);
      res.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
      // Return a simple missing-resource response for invalid paths and filesystem read failures.
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  })
  .listen(port, "0.0.0.0", () =>
    console.log(`Crosscurrent: http://localhost:${port} (${root})`),
  );
