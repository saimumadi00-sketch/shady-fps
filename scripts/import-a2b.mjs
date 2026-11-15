// Rebuild src/a2b-models.js from the Project A2B pre-release weapon pack (free for personal
// and commercial use; see THIRD_PARTY_NOTICES.md). Usage:
//   node scripts/import-a2b.mjs <path to A2B_PreRelease_v1>
// Each OBJ part becomes a flat-coloured triangle list: every triangle takes the average of a
// few atlas samples inside its UV footprint, which suits this engine's vertex-coloured
// renderer. Positions stay in the pack's model space (metres, +Y up, +Z forward), quantized to
// 16 bits; src/a2b-guns.js places them in the viewmodel's frame at runtime.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

const root = process.argv[2];
if (!root)
  throw new Error("usage: node scripts/import-a2b.mjs <A2B_PreRelease_v1>");
// Guns: assault rifle, SMG, pistol, marksman rifle, LMG. Optics: reflex, scope, DMR scope.
const MODELS = [
  "carbine_m4",
  "smg_mp5",
  "demo_pistol",
  "br_scar_h",
  "lmg_m60",
  "att_red_dot_t2",
  "att_acog_scope",
  "att_lpvo_scope",
];
// Glass is left out so sight pictures stay open (the renderer draws the reticle dot).
const SKIP = /lens/;
const Q = 20000; // quantization steps per metre (0.05 mm)

// Minimal decoder for the pack's 8-bit RGBA, non-interlaced PNG atlases.
function readPng(file) {
  const b = readFileSync(file);
  let o = 8,
    w = 0,
    h = 0;
  const idat = [];
  while (o < b.length) {
    const len = b.readUInt32BE(o),
      type = b.toString("ascii", o + 4, o + 8),
      data = b.subarray(o + 8, o + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0)
        throw new Error(file + ": expected 8-bit RGBA, non-interlaced");
    } else if (type === "IDAT") idat.push(data);
    o += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)),
    px = Buffer.alloc(w * h * 4),
    stride = w * 4;
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)],
      line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0,
        up = y ? px[(y - 1) * stride + x] : 0,
        c = x >= 4 && y ? px[(y - 1) * stride + x - 4] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) {
        const p = a + up - c,
          pa = Math.abs(p - a),
          pb = Math.abs(p - up),
          pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, px };
}

function convert(name) {
  const dir = join(root, "exports", name),
    meta = JSON.parse(readFileSync(join(dir, name + ".mesh.json"), "utf8")),
    atlas = readPng(join(dir, meta.atlas)),
    obj = readFileSync(join(dir, name + ".obj"), "utf8").split(/\r?\n/);
  const v = [],
    vt = [],
    parts = [];
  let part = null;
  for (const line of obj) {
    const [k, ...a] = line.trim().split(/\s+/);
    if (k === "v") v.push(a.map(Number));
    else if (k === "vt") vt.push(a.map(Number));
    else if (k === "o") parts.push((part = { name: a[0], faces: [] }));
    else if (k === "f") {
      const c = a.map((s) => s.split("/").map((n) => Number(n) - 1));
      for (let i = 1; i < c.length - 1; i++)
        part.faces.push([c[0], c[i], c[i + 1]]);
    }
  }
  const sample = (u, t) => {
    const x = Math.min(atlas.w - 1, Math.max(0, Math.floor(u * atlas.w))),
      y = Math.min(atlas.h - 1, Math.max(0, Math.floor((1 - t) * atlas.h))),
      i = (y * atlas.w + x) * 4;
    return [atlas.px[i], atlas.px[i + 1], atlas.px[i + 2]];
  };
  const pos = [],
    idx = [],
    col = [],
    out = [];
  for (const p of parts) {
    if (SKIP.test(p.name) || !p.faces.length) continue;
    const local = new Map(),
      v0 = pos.length / 3,
      t0 = idx.length / 3;
    for (const face of p.faces) {
      for (const [vi] of face) {
        if (!local.has(vi)) {
          local.set(vi, pos.length / 3 - v0);
          pos.push(...v[vi].map((n) => Math.round(n * Q)));
        }
        idx.push(v0 + local.get(vi));
      }
      // Centroid plus three points part-way to each corner, averaged.
      const uv = face.map(([, ti]) => vt[ti]),
        cu = (uv[0][0] + uv[1][0] + uv[2][0]) / 3,
        cv = (uv[0][1] + uv[1][1] + uv[2][1]) / 3,
        sum = [0, 0, 0],
        pts = [
          [cu, cv],
          ...uv.map(([a, b]) => [cu + (a - cu) * 0.6, cv + (b - cv) * 0.6]),
        ];
      for (const [a, b] of pts) sample(a, b).forEach((n, i) => (sum[i] += n));
      col.push(...sum.map((n) => Math.round(n / pts.length)));
    }
    out.push([p.name, v0, pos.length / 3 - v0, t0, idx.length / 3 - t0]);
  }
  if (pos.length / 3 > 65535) throw new Error(name + ": too many vertices");
  const blob = Buffer.concat([
    Buffer.from(new Int16Array(pos).buffer),
    Buffer.from(new Uint16Array(idx).buffer),
    Buffer.from(Uint8Array.from(col)),
  ]);
  const sockets = Object.fromEntries(
    meta.sockets.map((s) => [s.name, s.at.map((n) => +n.toFixed(4))]),
  );
  console.log(
    `${name}: ${idx.length / 3} triangles, ${pos.length / 3} vertices, ${blob.length} bytes`,
  );
  return {
    parts: out,
    sockets,
    vertices: pos.length / 3,
    triangles: idx.length / 3,
    data: blob.toString("base64"),
  };
}

const models = Object.fromEntries(MODELS.map((m) => [m, convert(m)]));
writeFileSync(
  "src/a2b-models.js",
  `// Generated by scripts/import-a2b.mjs from the Project A2B pre-release pack (free for
// personal and commercial use, no attribution required; credited in THIRD_PARTY_NOTICES.md).
// Per model: parts as [name, firstVertex, vertexCount, firstTriangle, triangleCount], sockets
// in metres, and base64 of Int16 positions (1/${Q} m), Uint16 indices and RGB bytes per triangle.
export const A2B_QUANTUM = ${1 / Q};
export const A2B_MODELS = ${JSON.stringify(models)};
`,
);
