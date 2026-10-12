/* Panipat 1526 — a point-cloud battle figure. Runs inside the bundle closure: F is three.js. */
const T = F;
const DEG = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const smoother = k => (k = clamp(k), k * k * k * (k * (k * 6 - 15) + 10));
const angLerp = (a, b, k) => a + (((b - a) % 360 + 540) % 360 - 180) * k;
function rng(seed = 1) {
  let e = seed >>> 0;
  return () => {
    e = e + 1831565813 >>> 0;
    let t = e;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const hexRGB = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

// the plain: gentle undulation, metres. The same function runs in the shaders.
const groundH = (x, z) => 1.6 * Math.sin(x * .0021 + .4) * Math.sin(z * .0017 + 1.1) + .9 * Math.sin(x * .0053 + z * .0041) + .45 * Math.sin(x * .011 - z * .009);
const GLSL_GROUND = `
float groundH(vec2 p){ return 1.6 * sin(p.x * .0021 + .4) * sin(p.y * .0017 + 1.1) + .9 * sin(p.x * .0053 + p.y * .0041) + .45 * sin(p.x * .011 - p.y * .009); }`;
// point size in pixels for a world size at a view depth, with sub-pixel points faded instead of shrunk
const GLSL_SIZE = `
uniform float uPx, uFade, uCamDist;
float pointPx(float worldSize, float depth, inout float alpha){
  float px = worldSize * uPx / max(depth, 1.0);
  if (px < 1.4) { alpha *= px / 1.4; px = 1.4; }
  alpha *= 1.0 - smoothstep(uCamDist * 1.6, uCamDist * 3.2, depth) * uFade;
  return min(px, 22.0);
}`;
const GLSL_DISC = `
  vec2 pc_ = gl_PointCoord * 2.0 - 1.0; float r2_ = dot(pc_, pc_); if (r2_ > 1.0) discard;
  float soft_ = 1.0 - r2_ * 0.55;`;

/* ---------- a growing list of coloured points (static scenery) ---------- */
class Cloud {
  constructor() { this.p = []; this.c = []; this.t = []; this.s = []; }
  add(x, y, z, col, t = 0, s = 1) { this.p.push(x, y, z); this.c.push(...col); this.t.push(t); this.s.push(s); }
  // sample the surface of a box, sitting on the ground, rotated about y
  box(cx, cz, w, h, d, ry, col, per, t = 0, r = Math.random, y0 = null, s = 1) {
    const base = y0 ?? groundH(cx, cz), faces = [[w * d, 0], [w * d, 1], [w * h, 2], [w * h, 3], [d * h, 4], [d * h, 5]];
    const area = 2 * (w * d + w * h + d * h), n = Math.max(4, Math.round(area * per)), cs = Math.cos(ry), sn = Math.sin(ry);
    for (let i = 0; i < n; i++) {
      let a = r() * area, f = 0;
      while (a > faces[f][0] && f < 5) a -= faces[f++][0];
      let lx = (r() - .5) * w, ly = r() * h, lz = (r() - .5) * d;
      if (f === 0) ly = 0; if (f === 1) ly = h; if (f === 2) lz = -d / 2; if (f === 3) lz = d / 2; if (f === 4) lx = -w / 2; if (f === 5) lx = w / 2;
      this.add(cx + lx * cs + lz * sn, base + ly, cz - lx * sn + lz * cs, col, t, s);
    }
  }
  line(ax, ay, az, bx, by, bz, col, step, t = 0, jit = 0, r = Math.random, s = 1) {
    const L = Math.hypot(bx - ax, by - ay, bz - az), n = Math.max(2, Math.round(L / step));
    for (let i = 0; i <= n; i++) { const k = i / n; this.add(lerp(ax, bx, k) + (r() - .5) * jit, lerp(ay, by, k) + (r() - .5) * jit, lerp(az, bz, k) + (r() - .5) * jit, col, t, s); }
  }
  ball(cx, cy, cz, rx, ry, rz, col, n, t = 0, r = Math.random, s = 1) {
    for (let i = 0; i < n; i++) {
      const u = r() * 2 - 1, th = r() * Math.PI * 2, q = Math.sqrt(1 - u * u);
      this.add(cx + q * Math.cos(th) * rx, cy + u * ry, cz + q * Math.sin(th) * rz, col, t, s);
    }
  }
  geometry() {
    const g = new T.BufferGeometry;
    g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute("aCol", new T.Float32BufferAttribute(this.c, 3));
    g.setAttribute("aT", new T.Float32BufferAttribute(this.t, 1));
    g.setAttribute("aS", new T.Float32BufferAttribute(this.s, 1));
    return g;
  }
}
