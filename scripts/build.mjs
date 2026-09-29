// Builds the self-contained deployment directory; run from the repository root.
import { mkdir, readFile, writeFile, rm, cp } from "node:fs/promises";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { createHash } from "node:crypto";
import { build, transform } from "esbuild";

// esbuild is a development tool. The deployed game has no runtime dependencies.
// Replace prior output so removed assets cannot remain in a new deployment.
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: true,
  target: ["chrome90", "firefox90", "safari15"],
  format: "esm",
  outfile: "dist/game.js",
  legalComments: "none",
});
// Minify CSS separately from the bundled JavaScript entry point.
const css = await transform(await readFile("style.css", "utf8"), {
  loader: "css",
  minify: true,
});
await writeFile("dist/style.css", css.code);
// Point production HTML at the bundle while preserving relative subdirectory-safe URLs.
const html = (await readFile("arena.html", "utf8")).replace(
  "./src/main.js",
  "./game.js",
);
await writeFile("dist/arena.html", html);
// Bundle the interactive lobby, keeping every runtime asset local for offline deployments.
await build({
  entryPoints: ["src/lobby.js"],
  bundle: true,
  minify: true,
  target: ["chrome90", "firefox90", "safari15"],
  format: "esm",
  outfile: "dist/lobby.js",
  legalComments: "none",
});
await writeFile(
  "dist/lobby.css",
  (
    await transform(await readFile("lobby.css", "utf8"), {
      loader: "css",
      minify: true,
    })
  ).code,
);
await writeFile(
  "dist/index.html",
  (await readFile("index.html", "utf8"))
    .replace("./src/lobby.js", "./lobby.js")
    .replace(/[ \t]*<script type="importmap">[\s\S]*?<\/script>\s*\n/, ""),
);
await cp("assets", "dist/assets", { recursive: true });
await cp("THIRD_PARTY_NOTICES.md", "dist/THIRD_PARTY_NOTICES.md");
const files = [
  "index.html",
  "arena.html",
  "game.js",
  "style.css",
  "lobby.js",
  "lobby.css",
  "assets/orbital-hangar.png",
];
// Version the cache from deployed assets and worker source so logic-only worker changes invalidate it.
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile("dist/" + file));
hash.update(await readFile("sw.js", "utf8"));
const version = hash.digest("hex").slice(0, 12);
// Replace development cache settings and module paths with production equivalents.
let sw = await readFile("sw.js", "utf8");
sw = sw
  .replace(/const CACHE = .*?;/, `const CACHE = "crosscurrent-${version}";`)
  .replace("const VERSIONED = false;", "const VERSIONED = true;")
  .replace(
    /const FILES = \[[\s\S]*?\];/,
    `const FILES = ${JSON.stringify(["./", ...files.map((file) => "./" + file)])};`,
  );
await writeFile(
  "dist/sw.js",
  (await transform(sw, { minify: true, target: "es2020" })).code,
);
files.push("sw.js");
let total = 0,
  gzip = 0,
  brotli = 0;
// Emit gzip/Brotli sidecars for hosts that negotiate precompressed responses.
for (const file of files) {
  const content = await readFile("dist/" + file),
    gz = gzipSync(content, { level: 9 }),
    br = brotliCompressSync(content);
  await writeFile("dist/" + file + ".gz", gz);
  await writeFile("dist/" + file + ".br", br);
  total += content.length;
  gzip += gz.length;
  brotli += br.length;
}
// Record exact payload sizes so validation reports can reference generated metadata.
const manifest = {
  version,
  files,
  rawBytes: total,
  gzipBytes: gzip,
  brotliBytes: brotli,
};
await writeFile(
  "dist/build-info.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `Production build: ${total} bytes raw / ${gzip} gzip / ${brotli} Brotli. Static output: dist/`,
);
