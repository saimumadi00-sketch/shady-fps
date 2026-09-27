import { mkdir, readFile, writeFile, rm, readdir } from "node:fs/promises";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { createHash } from "node:crypto";
import { build, transform } from "esbuild";

// esbuild is a development tool. The deployed game has no runtime dependencies.
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
const css = await transform(await readFile("style.css", "utf8"), {
  loader: "css",
  minify: true,
});
await writeFile("dist/style.css", css.code);
const html = (await readFile("index.html", "utf8")).replace(
  "./src/main.js",
  "./game.js",
);
await writeFile("dist/index.html", html);
const files = ["index.html", "game.js", "style.css"];
const hash = createHash("sha256");
for (const file of files) hash.update(await readFile("dist/" + file));
const version = hash.digest("hex").slice(0, 12);
let sw = await readFile("sw.js", "utf8");
sw = sw
  .replace(/const CACHE = .*?;/, `const CACHE = "crosscurrent-${version}";`)
  .replace(
    /const FILES = \[[\s\S]*?\];/,
    `const FILES = ["./", "./index.html", "./game.js", "./style.css"];`,
  );
await writeFile(
  "dist/sw.js",
  (await transform(sw, { minify: true, target: "es2020" })).code,
);
files.push("sw.js");
let total = 0,
  gzip = 0,
  brotli = 0;
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
