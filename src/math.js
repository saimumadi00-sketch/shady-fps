export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export function direction(yaw, pitch = 0) {
  return [
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ];
}
export function rayBox(o, d, b, max = Infinity) {
  let lo = 0,
    hi = max;
  for (let i = 0; i < 3; i++) {
    const k = ["x", "y", "z"][i],
      h = ["w", "h", "d"][i];
    const mn = b[k] - b[h] / 2,
      mx = b[k] + b[h] / 2;
    if (Math.abs(d[i]) < 1e-8) {
      if (o[i] < mn || o[i] > mx) return Infinity;
    } else {
      let t1 = (mn - o[i]) / d[i],
        t2 = (mx - o[i]) / d[i];
      if (t1 > t2) [t1, t2] = [t2, t1];
      lo = Math.max(lo, t1);
      hi = Math.min(hi, t2);
      if (lo > hi) return Infinity;
    }
  }
  return lo;
}
export function cameraMatrix(out, x, y, z, yaw, pitch, fov, aspect) {
  const f = 1 / Math.tan(fov / 2),
    n = 0.07,
    far = 120,
    s = Math.sin(yaw),
    c = Math.cos(yaw),
    sp = Math.sin(pitch),
    cp = Math.cos(pitch);
  const r = [c, 0, s],
    u = [-s * sp, cp, c * sp],
    b = [-s * cp, -sp, c * cp];
  const a = f / aspect,
    k = (far + n) / (n - far),
    q = (2 * far * n) / (n - far);
  out.set([
    a * r[0],
    f * u[0],
    k * b[0],
    -b[0],
    a * r[1],
    f * u[1],
    k * b[1],
    -b[1],
    a * r[2],
    f * u[2],
    k * b[2],
    -b[2],
    -a * (r[0] * x + r[2] * z),
    -f * (u[0] * x + u[1] * y + u[2] * z),
    -k * (b[0] * x + b[1] * y + b[2] * z) + q,
    b[0] * x + b[1] * y + b[2] * z,
  ]);
  return out;
}
