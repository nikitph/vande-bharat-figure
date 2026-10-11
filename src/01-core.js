// Vande Bharat figure — core helpers and materials.
// Runs inside the bundle closure: F is the three.js namespace; iA/Af/ZM/fo are bundle helpers.
const T = F, hexTo = iA, rawColour = Af, softShadowPars = ZM, mergeGeometries = fo;

const DEG = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const smoother = k => (k = clamp(k), k * k * k * (k * (k * 6 - 15) + 10));
const V3 = (x, y, z) => new T.Vector3(x, y, z);

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
function shadeOf(c, k = .62, out = new T.Color) {
  return (c && c.isColor ? out.copy(c) : hexTo(c, out)).multiplyScalar(k).lerp(hexTo("#2a3b6e"), .1);
}

/* ---------- geometry helpers ---------- */
const box = (w, h, d) => new T.BoxGeometry(w, h, d);
function rbox(w, h, d, r = .05) {
  r = Math.max(.001, Math.min(r, w / 2 - .005, h / 2 - .005, d / 2 - .005));
  const a = w / 2 - r, b = d / 2 - r;
  const s = new T.Shape([new T.Vector2(-a, -b), new T.Vector2(a, -b), new T.Vector2(a, b), new T.Vector2(-a, b)]);
  const g = new T.ExtrudeGeometry(s, { depth: h - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 1 });
  g.rotateX(Math.PI / 2);
  g.translate(0, h / 2 - r, 0);
  return g;
}
function cyl(r, len, axis = "y", seg = 16, r2 = r) {
  const g = new T.CylinderGeometry(r2, r, len, seg, 1, false);
  if (axis === "x") g.rotateZ(-Math.PI / 2);
  if (axis === "z") g.rotateX(Math.PI / 2);
  return g;
}
const at = (g, x, y, z) => (g.translate(x, y, z), g);
// closed polygon of [z, y] points, extruded from x0 to x1
function extrudeX(pts, x0, x1, holes = []) {
  const s = new T.Shape(pts.map(([z, y]) => new T.Vector2(-z, y)));
  for (const h of holes) s.holes.push(new T.Path(h.map(([z, y]) => new T.Vector2(-z, y))));
  const g = new T.ExtrudeGeometry(s, { depth: x1 - x0, bevelEnabled: false, curveSegments: 1 });
  g.rotateY(Math.PI / 2);
  g.translate(x0, 0, 0);
  return g;
}
// closed polygon of [x, y] points, extruded from z0 to z1
function extrudeZ(pts, z0, z1) {
  const s = new T.Shape(pts.map(([x, y]) => new T.Vector2(x, y)));
  const g = new T.ExtrudeGeometry(s, { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, z0);
  return g;
}
// open polyline [z, y] thickened towards its left-hand normal
function strip(pts, th) {
  const n = pts.length, inner = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tz = b[0] - a[0], ty = b[1] - a[1];
    const l = Math.hypot(tz, ty) || 1;
    tz /= l; ty /= l;
    inner.push([pts[i][0] - ty * th, pts[i][1] + tz * th]);
  }
  return pts.concat(inner.reverse());
}
function plain(g) {
  const o = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(o.attributes)) if (k !== "position" && k !== "normal") o.deleteAttribute(k);
  return o;
}
function merge(list) {
  const out = mergeGeometries(list.map(plain), false);
  if (!out) throw new Error("[vande-bharat] merge failed");
  return out;
}
function mesh(g, m, cast = true, recv = true) {
  const o = new T.Mesh(g, m);
  o.castShadow = cast; o.receiveShadow = recv;
  return o;
}

/* ---------- shared uniforms and materials ---------- */
function makeUniforms() {
  const c = () => ({ value: new T.Color });
  return {
    bodyLo: c(), bodyHi: c(), deckLo: c(), deckHi: c(), darkLo: c(), darkHi: c(), markLo: c(), markHi: c(),
    ink: c(), mark: c(), glow: c(), bg: c(), shadow: c(), foam: c(), wave: c(),
    sel: c(), head: c(), tail: c(), cabin: c(), flow: c(), air: c(),
    time: { value: 0 }, cmix: { value: 0 }, ambient: { value: .3 },
    cabinGlow: { value: 0 }, screenGlow: { value: 0 },
    pal: { color: e => hexTo(e), shade: e => shadeOf(e), hex: e => e }
  };
}
const WPOS = `
  vec4 wpos_ = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wpos_ = instanceMatrix * wpos_;
  #endif
  vW = (modelMatrix * wpos_).xyz;`;

// Two-tone lit material. `fam` picks the monochrome family (body/deck/dark/mark);
// `color` names the paint used by the colour theme.
function toon(U, fam, o = {}) {
  const m = new T.MeshLambertMaterial({ color: 0xffffff, side: o.side ?? T.FrontSide });
  if (o.clip) { m.clippingPlanes = o.clip; m.clipShadows = true; }
  const emis = o.emis || null, strata = o.strata || 0;
  let hi = U[fam + "Hi"], lo = U[fam + "Lo"];
  if (o.color) { hi = { value: U.pal.color(o.color) }; lo = { value: U.pal.shade(o.color) }; }
  m.userData.paint = o.color || null;
  m.customProgramCacheKey = () => `vb-toon:${emis ? "e" : ""}${strata ? "s" : ""}`;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, {
      uLo: U[fam + "Lo"], uHi: U[fam + "Hi"], uCLo: lo, uCHi: hi, uCMix: U.cmix,
      uInk: U.ink, uGlow: o.emisColor || U.glow, uAmb: U.ambient
    });
    if (emis) sh.uniforms.uEmis = emis;
    if (strata) sh.uniforms.uStrata = { value: strata };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vW;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n" + WPOS);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <shadowmap_pars_fragment>", softShadowPars())
      .replace("#include <common>", `#include <common>
uniform vec3 uLo, uHi, uInk, uGlow, uCLo, uCHi; uniform float uCMix, uAmb;
${emis ? "uniform float uEmis;" : ""}
${strata ? "uniform float uStrata;" : ""}
varying vec3 vW;`)
      .replace("void main() {", "#include <shadowmask_pars_fragment>\nvoid main() {")
      .replace("#include <opaque_fragment>", `
      float shm = getShadowMask();
      float kd = max(dot(normal, directionalLights[0].direction), 0.0) * shm;
      float fl = max(dot(normal, directionalLights[1].direction), 0.0);
      float lum = uAmb + 0.70 * kd + 0.20 * fl;
      vec3 col = mix(mix(uLo, uCLo, uCMix), mix(uHi, uCHi, uCMix), smoothstep(0.26, 1.0, lum));
      ${strata ? `{
        vec3 wn = normalize((vec4(normal, 0.0) * viewMatrix).xyz);
        if (abs(wn.y) < 0.35) {
          float py = max(fwidth(vW.y), 1e-4);
          float d = abs(fract(vW.y / uStrata + 0.5) - 0.5) * uStrata;
          col = mix(col, uInk, (1.0 - smoothstep(0.45 * py, 1.35 * py, d)) * 0.55);
        }
      }` : ""}
      ${emis ? "col = mix(col, uGlow, clamp(uEmis, 0.0, 1.0));" : ""}
      gl_FragColor = vec4(col, 1.0);`);
  };
  return m;
}
// the endless ground: background colour, darkened where shadows fall
function groundMaterial(U) {
  const m = new T.MeshLambertMaterial({ color: 0xffffff });
  m.customProgramCacheKey = () => "vb-base";
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, { uBg: U.bg, uShadowC: U.shadow });
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <shadowmap_pars_fragment>", softShadowPars())
      .replace("#include <common>", "#include <common>\nuniform vec3 uBg, uShadowC;")
      .replace("void main() {", "#include <shadowmask_pars_fragment>\nvoid main() {")
      .replace("#include <opaque_fragment>", "float shm = getShadowMask(); gl_FragColor = vec4(mix(uShadowC, uBg, shm), 1.0);");
  };
  return m;
}
// moving dashes along a tube or ribbon (uv.x runs along its length)
function dashMaterial(colour, alpha, time, o = {}) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: o.depthTest ?? true, side: T.DoubleSide,
    uniforms: { uC: colour, uA: alpha, uT: time, uSpeed: o.speed || { value: 1 }, uRep: { value: o.rep || 6 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 uC; uniform float uA, uT, uSpeed, uRep; varying vec2 vUv;
      void main(){
        float d = fract(vUv.x * uRep - uT * uSpeed);
        float dash = smoothstep(0.0, 0.08, d) * smoothstep(0.62, 0.5, d);
        float head = smoothstep(0.5, 0.6, d) * smoothstep(0.66, 0.6, d);
        float ends = smoothstep(0.0, 0.06, vUv.x) * smoothstep(1.0, 0.94, vUv.x);
        float a = uA * (dash * 0.8 + head * 0.2) * ends;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uC, a);
      }`
  });
}
function glowMaterial(colour, alpha) {
  return new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide,
    uniforms: { uC: colour, uA: alpha },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform vec3 uC; uniform float uA; varying vec2 vUv;
      void main(){ float r = length(vUv); float a = uA * smoothstep(1.0, 0.0, r) * (0.55 + 0.45 * smoothstep(0.9, 0.2, r));
        gl_FragColor = vec4(uC, clamp(a, 0.0, 1.0)); }`
  });
}
