// WebGL 2 renderer: instanced arena/actors plus a separate animated first-person triangle mesh.
import { drawCharacter } from "./characters.js";
import { cameraMatrix, direction } from "./math.js";
import { reloadPose, animateWeapon } from "./reload-animation.js";
import { weaponMesh } from "./weapon-models.js";
import { viewmodelPose } from "./viewmodel.js";
// The vertex shader shares lighting and transform logic across instances and weapon vertices.
const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 vertex;
layout(location=1) in vec3 normal;
layout(location=2) in vec3 offset;
layout(location=3) in vec3 size;
layout(location=4) in vec3 color;
layout(location=5) in float angle;
uniform mat4 vp;uniform vec3 eye;
out vec3 tint;out float dist;out vec3 surfacePosition;out vec3 surfaceNormal;
void main(){float c=cos(angle),s=sin(angle);mat3 rot=mat3(c,0,-s,0,1,0,s,0,c);vec3 world=rot*(vertex*size)+offset;vec3 n=normalize(rot*normal);tint=color;surfacePosition=world;surfaceNormal=n;dist=length(world-eye);gl_Position=vp*vec4(world,1.);}`;
// Distance fog blends distant geometry into the sky color without textures or postprocessing.
const FS = `#version 300 es
precision highp float;
in vec3 tint;in float dist;in vec3 surfacePosition;in vec3 surfaceNormal;
uniform float surfaceDetail;uniform float firstPerson;out vec4 pixel;
void main(){
  vec3 n=normalize(surfaceNormal);
  float sun=max(0.,dot(n,normalize(vec3(-.4,.85,.3))));
  float sky=.5+.5*n.y;
  vec3 lighting=mix(vec3(.28,.30,.29),vec3(.47,.51,.54),sky)+vec3(.72,.68,.60)*sun;
  // Restrained grain avoids the previous cloudy concrete pattern.
  float grain=fract(sin(dot(floor(surfacePosition*95.),vec3(12.9898,78.233,39.425)))*43758.5453)-.5;
  float variation=1.+surfaceDetail*grain*.012;
  // Fade the grain at distance to avoid sparkling on low-resolution displays.
  variation=mix(1.,variation,1.-smoothstep(8.,35.,dist));
  float baseShade=mix(.83,1.,smoothstep(0.,.7,surfacePosition.y));
  baseShade=mix(baseShade,1.,max(firstPerson,abs(n.y)));
  float luminance=dot(tint,vec3(.2126,.7152,.0722));
  vec3 material=mix(tint,vec3(luminance),.18*(1.-firstPerson));
  vec3 shaded=material*lighting*variation*baseShade;
  // A small steel highlight gives firearm edges definition without glossy gloves.
  vec3 halfLight=normalize(normalize(vec3(-.4,.85,.3))+normalize(-surfacePosition));
  float steel=firstPerson*(1.-step(.17,tint.r));
  shaded+=vec3(.075)*steel*pow(max(0.,dot(n,halfLight)),24.);
  float fog=smoothstep(28.,100.,dist)*(1.-firstPerson);
  pixel=vec4(mix(shaded,vec3(.61,.66,.68),fog*.65),1.);
}`;
export class Renderer {
  // Allocate reusable CPU buffers before creating GPU resources.
  constructor(canvas, arena) {
    this.canvas = canvas;
    this.arena = arena;
    this.matrix = new Float32Array(16);
    this.dynamic = new Float32Array(1024 * 10);
    this.weaponModels = new Map();
    this.drawCalls = 0;
    this.initialize();
  }
  // Create or recreate all GPU objects, including after WebGL context restoration.
  initialize() {
    const gl = this.canvas.getContext("webgl2", {
      antialias: false,
      alpha: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl)
      throw Error(
        "WebGL 2 is unavailable. Enable hardware acceleration in your browser, or try a compatible browser.",
      );
    this.gl = gl;
    // Fail early with shader diagnostics instead of silently drawing an empty canvas.
    const compile = (type, code) => {
      let s = gl.createShader(type);
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(s));
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VS),
      fs = compile(gl.FRAGMENT_SHADER, FS);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vs);
    gl.attachShader(this.program, fs);
    gl.linkProgram(this.program);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS))
      throw Error(gl.getProgramInfoLog(this.program));
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    gl.useProgram(this.program);
    this.vp = gl.getUniformLocation(this.program, "vp");
    this.eye = gl.getUniformLocation(this.program, "eye");
    this.surfaceDetail = gl.getUniformLocation(this.program, "surfaceDetail");
    this.firstPerson = gl.getUniformLocation(this.program, "firstPerson");
    const vertices = [];
    // Describe the six cube faces once; indexed corner expansion emits two triangles per face.
    const faces = [
      [
        [1, 0, 0],
        [
          [0.5, -0.5, -0.5],
          [0.5, 0.5, -0.5],
          [0.5, 0.5, 0.5],
          [0.5, -0.5, 0.5],
        ],
      ],
      [
        [-1, 0, 0],
        [
          [-0.5, -0.5, 0.5],
          [-0.5, 0.5, 0.5],
          [-0.5, 0.5, -0.5],
          [-0.5, -0.5, -0.5],
        ],
      ],
      [
        [0, 1, 0],
        [
          [-0.5, 0.5, -0.5],
          [-0.5, 0.5, 0.5],
          [0.5, 0.5, 0.5],
          [0.5, 0.5, -0.5],
        ],
      ],
      [
        [0, -1, 0],
        [
          [-0.5, -0.5, 0.5],
          [-0.5, -0.5, -0.5],
          [0.5, -0.5, -0.5],
          [0.5, -0.5, 0.5],
        ],
      ],
      [
        [0, 0, 1],
        [
          [0.5, -0.5, 0.5],
          [0.5, 0.5, 0.5],
          [-0.5, 0.5, 0.5],
          [-0.5, -0.5, 0.5],
        ],
      ],
      [
        [0, 0, -1],
        [
          [-0.5, -0.5, -0.5],
          [-0.5, 0.5, -0.5],
          [0.5, 0.5, -0.5],
          [0.5, -0.5, -0.5],
        ],
      ],
    ];
    for (const [normal, corners] of faces)
      for (const i of [0, 1, 2, 0, 2, 3])
        vertices.push(...corners[i], ...normal);
    this.vertex = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertex);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    this.staticData = new Float32Array(this.arena.boxes.length * 10);
    this.arena.boxes.forEach((b, i) =>
      this.write(this.staticData, i, b.x, b.y, b.z, b.w, b.h, b.d, b.color, 0),
    );
    this.staticBatch = this.batch(this.staticData, gl.STATIC_DRAW);
    this.dynamicBatch = this.batch(this.dynamic, gl.DYNAMIC_DRAW);
    this.weaponModels.clear();
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0.61, 0.66, 0.68, 1);
  }
  // Create a VAO with shared cube vertices and per-instance position, size, color, and yaw.
  batch(data, usage) {
    const g = this.gl,
      vao = g.createVertexArray(),
      buffer = g.createBuffer();
    g.bindVertexArray(vao);
    g.bindBuffer(g.ARRAY_BUFFER, this.vertex);
    for (let i = 0; i < 2; i++) {
      g.enableVertexAttribArray(i);
      g.vertexAttribPointer(i, 3, g.FLOAT, false, 24, i * 12);
    }
    g.bindBuffer(g.ARRAY_BUFFER, buffer);
    g.bufferData(g.ARRAY_BUFFER, data, usage);
    for (let i = 2; i <= 5; i++) {
      g.enableVertexAttribArray(i);
      g.vertexAttribPointer(
        i,
        i === 5 ? 1 : 3,
        g.FLOAT,
        false,
        40,
        (i - 2) * 12,
      );
      g.vertexAttribDivisor(i, 1);
    }
    return { vao, buffer };
  }
  // Pack one cube instance into ten floats, matching the attribute stride configured in batch().
  write(array, i, x, y, z, w, h, d, color, angle = 0) {
    const k = i * 10;
    array[k] = x;
    array[k + 1] = y;
    array[k + 2] = z;
    array[k + 3] = w;
    array[k + 4] = h;
    array[k + 5] = d;
    array[k + 6] = color[0];
    array[k + 7] = color[1];
    array[k + 8] = color[2];
    array[k + 9] = angle;
  }
  // Change framebuffer dimensions only when render scale or CSS viewport size changes.
  resize(scale) {
    const w = Math.max(1, Math.round(this.canvas.clientWidth * scale)),
      h = Math.max(1, Math.round(this.canvas.clientHeight * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }
  // Upload only the live instance range before issuing a single instanced draw.
  draw(batch, count, data) {
    if (!count) return;
    const g = this.gl;
    g.bindVertexArray(batch.vao);
    if (data) {
      g.bindBuffer(g.ARRAY_BUFFER, batch.buffer);
      g.bufferSubData(g.ARRAY_BUFFER, 0, data, 0, count * 10);
    }
    g.drawArraysInstanced(g.TRIANGLES, 0, 36, count);
    this.drawCalls++;
  }
  // Draw the world, actors/effects, then a camera-relative weapon with its own depth layer.
  render(game, quality, time) {
    const g = this.gl,
      p = game.player;
    this.resize(quality.scale);
    g.useProgram(this.program);
    g.uniform1f(this.surfaceDetail, quality.shadows ? 1 : 0);
    g.uniform1f(this.firstPerson, 0);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    this.drawCalls = 0;
    // Use the player camera during a match and an overview camera behind the start menu.
    const inGame = game.match.state !== "menu",
      cam = inGame
        ? { x: p.x, y: p.y + p.eye, z: p.z, yaw: p.yaw, pitch: p.pitch }
        : { x: -21, y: 12, z: 22, yaw: 0.72, pitch: -0.4 };
    // ADS narrows the world view; reloading temporarily returns to the normal field of view.
    const baseFov = this.customization?.fov || 83;
    const now = performance.now();
    const elapsed = Math.min((now - (this.viewTime ?? now)) / 1000, 0.05);
    this.viewTime = now;
    if (this.viewWeapon !== p.weapon || !inGame || !p.alive) {
      this.aimBlend = 0;
      this.viewWeapon = p.weapon;
    }
    const aimTarget = p.aim && p.reload <= 0 && inGame ? 1 : 0;
    this.aimBlend +=
      (aimTarget - (this.aimBlend || 0)) * (1 - Math.exp(-elapsed * 22));
    const fov = (baseFov * (1 - 0.31 * this.aimBlend) * Math.PI) / 180;
    cameraMatrix(
      this.matrix,
      cam.x,
      cam.y,
      cam.z,
      cam.yaw,
      cam.pitch,
      fov,
      this.canvas.width / this.canvas.height,
    );
    g.uniformMatrix4fv(this.vp, false, this.matrix);
    g.uniform3f(this.eye, cam.x, cam.y, cam.z);
    this.draw(this.staticBatch, this.arena.boxes.length);
    let n = 0;
    const add = (...args) => this.write(this.dynamic, n++, ...args);
    for (const s of game.match.sectors || []) {
      const color = s.contested
        ? [1, 0.85, 0.3]
        : s.owner === 0
          ? [0.25, 0.78, 0.72]
          : s.owner === 1
            ? [0.96, 0.38, 0.19]
            : [0.84, 0.85, 0.7];
      add(s.x, 1.7, s.z, 0.09, 3.4, 0.09, [0.22, 0.3, 0.31]);
      add(s.x + 0.6, 2.9, s.z, 1.15, 0.65, 0.07, color);
      const diameter = s.radius * 2;
      for (const sign of [-1, 1]) {
        add(s.x + sign * s.radius, 0.01, s.z, 0.08, 0.03, diameter, color);
        add(s.x, 0.01, s.z + sign * s.radius, diameter, 0.03, 0.08, color);
      }
    }
    for (const a of game.renderActors || game.actors) {
      if (!a.alive || (a === p && inGame)) continue;
      const dx = a.x - cam.x,
        dz = a.z - cam.z; // Cheap conservative horizontal view culling.
      if (inGame && dx * Math.sin(cam.yaw) - dz * Math.cos(cam.yaw) < -3)
        continue;
      drawCharacter(add, a, time, quality.shadows);
    }
    // Respect the adaptive visual-effect budget without modifying simulated shots or damage.
    let effects = 0;
    for (const e of game.effects.items)
      if (e.life > 0 && effects++ < quality.effects) {
        const v = e.kind === "impact" ? 0.08 : 0.14;
        add(
          e.x,
          e.y,
          e.z,
          v,
          v,
          v,
          e.kind === "impact" ? [1, 0.8, 0.4] : [1, 0.96, 0.6],
        );
      }
    this.draw(this.dynamicBatch, n, this.dynamic);
    if (inGame && p.alive && game.match.state !== "ended") {
      // Keep nearby world geometry from clipping through the first-person weapon.
      g.clear(g.DEPTH_BUFFER_BIT);
      g.uniform1f(this.firstPerson, 1);
      cameraMatrix(
        this.matrix,
        0,
        0,
        0,
        0,
        0,
        (75 * Math.PI) / 180,
        this.canvas.width / this.canvas.height,
      );
      g.uniformMatrix4fv(this.vp, false, this.matrix);
      g.uniform3f(this.eye, 0, 0, 0);
      // Derive visual reload motion from the authoritative remaining reload timer.
      const pose = reloadPose(p);
      const sightHeight =
        p.weapon === 3 || this.customization?.optic === "scope"
          ? 0.218
          : this.customization?.optic === "reflex"
            ? 0.205
            : 0.16;
      const view = viewmodelPose(
        p,
        now / 1000,
        this.aimBlend,
        pose,
        sightHeight,
      );
      const finish = this.customization?.finish || "graphite";
      const optic = this.customization?.optic || "iron";
      // Cache by discrete model choices, never by animation time, to keep cache growth bounded.
      const key = p.weapon + ":" + finish + ":" + optic + ":" + (p.flash > 0);
      let model = this.weaponModels.get(key);
      // Build and upload each chosen weapon variant once; reuse its buffer on later frames.
      if (!model) {
        const data = weaponMesh(p.weapon, finish, optic, p.flash > 0, true);
        const vao = g.createVertexArray(),
          buffer = g.createBuffer();
        g.bindVertexArray(vao);
        g.bindBuffer(g.ARRAY_BUFFER, buffer);
        g.bufferData(g.ARRAY_BUFFER, data, g.DYNAMIC_DRAW);
        for (const [attribute, offset] of [
          [0, 0],
          [1, 12],
          [4, 24],
        ]) {
          g.enableVertexAttribArray(attribute);
          g.vertexAttribPointer(attribute, 3, g.FLOAT, false, 36, offset);
        }
        model = {
          vao,
          buffer,
          count: data.length / 9,
          base: data,
          animated: new Float32Array(data.length),
        };
        this.weaponModels.set(key, model);
      }
      // Animate into reusable storage, then set constant transform attributes for the weapon draw.
      g.bindVertexArray(model.vao);
      g.bindBuffer(g.ARRAY_BUFFER, model.buffer);
      g.bufferSubData(
        g.ARRAY_BUFFER,
        0,
        animateWeapon(model.base, model.animated, pose),
      );
      g.vertexAttrib3f(2, view.x, view.y, view.z);
      g.vertexAttrib3f(3, 1, 1, 1);
      g.vertexAttrib1f(5, view.yaw);
      g.drawArrays(g.TRIANGLES, 0, model.count);
      this.drawCalls++;
    }
  }
}
