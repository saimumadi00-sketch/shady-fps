import { drawCharacter } from "./characters.js";
import { cameraMatrix, direction } from "./math.js";
import { TEAM_COLORS } from "./world.js";
const VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 vertex;
layout(location=1) in vec3 normal;
layout(location=2) in vec3 offset;
layout(location=3) in vec3 size;
layout(location=4) in vec3 color;
layout(location=5) in float angle;
uniform mat4 vp;uniform vec3 eye;
out vec3 tint;out float dist;
void main(){float c=cos(angle),s=sin(angle);mat3 rot=mat3(c,0,-s,0,1,0,s,0,c);vec3 world=rot*(vertex*size)+offset;vec3 n=rot*normal;float light=.58+.42*max(0.,dot(n,normalize(vec3(-.4,.85,.3))));tint=color*light;dist=length(world-eye);gl_Position=vp*vec4(world,1.);}`;
const FS = `#version 300 es
precision mediump float;
in vec3 tint;in float dist;out vec4 pixel;
void main(){float fog=smoothstep(25.,100.,dist);pixel=vec4(mix(tint,vec3(.53,.66,.67),fog*.8),1.);}`;
export class Renderer {
  constructor(canvas, arena) {
    this.canvas = canvas;
    this.arena = arena;
    this.matrix = new Float32Array(16);
    this.dynamic = new Float32Array(1024 * 10);
    this.weapon = new Float32Array(160);
    this.drawCalls = 0;
    this.initialize();
  }
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
    const vertices = [];
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
    this.weaponBatch = this.batch(this.weapon, gl.DYNAMIC_DRAW);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0.53, 0.66, 0.67, 1);
  }
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
  resize(scale) {
    const w = Math.max(1, Math.round(this.canvas.clientWidth * scale)),
      h = Math.max(1, Math.round(this.canvas.clientHeight * scale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.gl.viewport(0, 0, w, h);
    }
  }
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
  render(game, quality, time) {
    const g = this.gl,
      p = game.player;
    this.resize(quality.scale);
    g.useProgram(this.program);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    this.drawCalls = 0;
    const inGame = game.match.state !== "menu",
      cam = inGame
        ? { x: p.x, y: p.y + p.eye, z: p.z, yaw: p.yaw, pitch: p.pitch }
        : { x: -21, y: 12, z: 22, yaw: 0.72, pitch: -0.4 };
    const fov = ((p.aim && inGame ? 57 : 83) * Math.PI) / 180;
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
    for (const a of game.actors) {
      if (!a.alive || (a === p && inGame)) continue;
      const dx = a.x - cam.x,
        dz = a.z - cam.z; // Cheap conservative horizontal view culling.
      if (inGame && dx * Math.sin(cam.yaw) - dz * Math.cos(cam.yaw) < -3)
        continue;
      drawCharacter(add, a, time, quality.shadows);
    }
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
      g.clear(g.DEPTH_BUFFER_BIT);
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
      const x = p.aim ? 0 : 0.29,
        bob = p.moving && !p.sliding ? Math.sin(time * 10) * 0.009 : 0,
        y =
          (p.aim ? -0.18 : -0.29) +
          bob -
          (p.reload > 0 ? 0.16 : 0) -
          (p.sliding ? 0.08 : 0),
        z = -0.58 + p.kick * 0.9;
      let w = 0;
      const gun = (a, b, c, d, e, f, col) =>
        this.write(this.weapon, w++, x + a, y + b, z + c, d, e, f, col);
      const metal = [0.12, 0.18, 0.19],
        trim = TEAM_COLORS[0];
      gun(0, 0, 0, 0.15, 0.16, p.weapon === 2 ? 0.26 : 0.48, metal);
      gun(0, 0.015, -0.3, 0.06, 0.065, 0.26, metal);
      gun(0, -0.12, 0.1, 0.09, 0.2, 0.11, [0.2, 0.25, 0.23]);
      gun(0, 0.1, 0.12, 0.07, 0.055, 0.045, trim);
      gun(0, 0.105, -0.2, 0.025, 0.06, 0.035, trim);
      gun(0.075, -0.075, 0.16, 0.12, 0.12, 0.26, [0.4, 0.47, 0.38]);
      if (p.flash > 0) gun(0, 0.02, -0.47, 0.1, 0.1, 0.15, [1, 0.88, 0.45]);
      this.draw(this.weaponBatch, w, this.weapon);
    }
  }
}
