/* ---------- figure templates: points in a figure's own frame (y up, facing +z) ---------- */
// each point carries aLeg = (phase offset or -1, hip height, pivot z) so the shader can swing legs
function template(kind) {
  const r = rng({ inf: 11, gun: 12, cav: 13, ele: 14 }[kind]), P = [], L = [], B = [];
  const pt = (x, y, z, leg = [-1, 0, 0], bright = 1) => { P.push(x, y, z); L.push(...leg); B.push(bright); };
  const seg = (a, b, n, rad, leg, br = 1) => { for (let i = 0; i < n; i++) { const k = (i + r() * .6) / n; pt(lerp(a[0], b[0], k) + (r() - .5) * rad, lerp(a[1], b[1], k) + (r() - .5) * rad, lerp(a[2], b[2], k) + (r() - .5) * rad, leg, br); } };
  const blob = (c, rx, ry, rz, n, leg, br = 1) => { for (let i = 0; i < n; i++) { const u = r() * 2 - 1, th = r() * 6.283, q = Math.sqrt(1 - u * u), s = .8 + .2 * r(); pt(c[0] + q * Math.cos(th) * rx * s, c[1] + u * ry * s, c[2] + q * Math.sin(th) * rz * s, leg, br); } };
  if (kind === "inf" || kind === "gun") {
    seg([.1, .9, 0], [.12, 0, .02], 7, .05, [0, .9, 0]); seg([-.1, .9, 0], [-.12, 0, .02], 7, .05, [Math.PI, .9, 0]);
    blob([0, 1.22, 0], .19, .3, .12, 14); blob([0, 1.62, 0], .1, .11, .1, 7, undefined, 1.5);
    seg([.22, 1.45, 0], [.26, .95, .12], 4, .04); seg([-.22, 1.45, 0], [-.26, .95, .08], 4, .04);
    if (kind === "inf") seg([.3, .55, .08], [.34, 2.7, .25], 9, .02, undefined, 1.3);
    else seg([.2, 1.25, -.25], [.15, 1.4, .95], 7, .02, undefined, 1.3);
  } else if (kind === "cav") {
    blob([0, 1.35, 0], .32, .34, .95, 34); seg([0, 1.55, .85], [0, 2.05, 1.25], 6, .12); blob([0, 2.0, 1.45], .1, .12, .26, 6, undefined, 1.3);
    const legs = [[.2, .75, 0], [-.2, .75, .5], [.2, -.75, Math.PI], [-.2, -.75, Math.PI + .5]];
    for (const [x, z, ph] of legs) seg([x, 1.12, z], [x, 0, z + .05], 7, .05, [ph, 1.12, z]);
    seg([0, 1.45, -.95], [0, .85, -1.15], 4, .08);
    blob([0, 2.1, -.05], .16, .27, .12, 9); blob([0, 2.5, 0], .09, .1, .09, 4, undefined, 1.5);
    seg([.28, 1.7, -.5], [.32, 2.9, .9], 7, .02, undefined, 1.3);
  } else {
    blob([0, 2.1, 0], 1.05, 1.15, 1.75, 190); blob([0, 2.65, 1.9], .78, .78, .65, 50);
    seg([0, 2.3, 2.45], [0, .6, 2.75], 14, .16); seg([0, .6, 2.75], [0, .4, 2.45], 4, .1);
    blob([.85, 2.7, 1.75], .1, .55, .45, 14); blob([-.85, 2.7, 1.75], .1, .55, .45, 14);
    seg([.35, 1.9, 2.4], [.45, 1.5, 3.1], 5, .04, undefined, 1.6); seg([-.35, 1.9, 2.4], [-.45, 1.5, 3.1], 5, .04, undefined, 1.6);
    const legs = [[.6, 1.1, 0], [-.6, 1.1, Math.PI], [.6, -1.1, Math.PI], [-.6, -1.1, 0]];
    for (const [x, z, ph] of legs) { for (let i = 0; i < 26; i++) { const k = r(); pt(x + (r() - .5) * .5, 1.5 * (1 - k), z + (r() - .5) * .5, [ph, 1.5, z]); } }
    for (let i = 0; i < 40; i++) pt((r() - .5) * 1.3, 3.35 + r() * .55, -.2 + (r() - .5) * 1.3, undefined, 1.2);
    blob([0, 4.2, -.1], .15, .28, .12, 8); blob([0, 2.4, -1.85], .08, .5, .08, 6);
  }
  return { pos: new Float32Array(P), leg: new Float32Array(L), bright: new Float32Array(B), n: P.length / 3 };
}

const ARMY_VERT = `
${GLSL_GROUND}
${GLSL_SIZE}
attribute vec3 aLeg; attribute float aBright;
attribute float aUnit; attribute vec2 aSlot; attribute vec3 aSeed;
uniform vec4 uA[${NU}], uB[${NU}], uC[${NU}];
uniform float uTime, uSize, uGait;
uniform vec3 uCol0, uCol1, uDead;
varying vec3 vCol; varying float vA;
vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
void main(){
  int u = int(aUnit + 0.5);
  vec4 A = uA[u], B = uB[u], C = uC[u];
  float seed = aSeed.x, die = aSeed.y, wob = aSeed.z;
  float alpha = A.w;
  if (alpha < 0.003) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; vA = 0.0; return; }
  float chaos = B.w, pace = B.z;
  vec2 s = aSlot * B.xy;
  s += vec2(sin(uTime * (0.35 + wob) + seed * 40.0), cos(uTime * (0.3 + wob) + seed * 31.0)) * chaos * 9.0;
  float hd = A.z + chaos * sin(uTime * 0.8 + seed * 17.0) * 1.4 + (seed - 0.5) * 0.12;
  vec2 f = vec2(sin(A.z), cos(A.z)), r = vec2(cos(A.z), -sin(A.z));
  vec2 wp = A.xy + r * s.x - f * s.y;
  float dead = smoothstep(die, die + 0.025, C.x);
  vec3 p = position;
  float ph = uTime * (2.2 + pace * 2.4) + seed * 6.2831;
  float go = min(pace, 2.0) * (1.0 - dead);
  if (aLeg.x >= 0.0 && p.y < aLeg.y) {
    float a = sin(ph + aLeg.x) * 0.42 * min(go, 1.4) * uGait;
    vec2 q = rot(vec2(p.z - aLeg.z, p.y - aLeg.y), a);
    p.z = q.x + aLeg.z; p.y = q.y + aLeg.y;
  }
  p.y += abs(sin(ph)) * 0.07 * go * uGait;
  // the fallen topple sideways and settle
  vec2 tp = rot(p.xy, dead * 1.45 * (seed > 0.5 ? 1.0 : -1.0));
  p.xy = tp; p.y = max(p.y, 0.05) * (1.0 - dead * 0.6);
  vec2 rp = rot(p.xz, -hd);
  vec3 w = vec3(wp.x + rp.x, p.y, wp.y + rp.y);
  w.y += groundH(w.xz);
  vec4 mv = modelViewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mv;
  vec3 col = mix(uCol0, uCol1, C.y) * aBright;
  col = mix(col, uDead, dead);
  alpha *= mix(1.0, 0.35, dead);
  gl_PointSize = pointPx(uSize, -mv.z, alpha);
  vCol = col; vA = alpha;
}`;
const GLOW_FRAG = `
varying vec3 vCol; varying float vA;
void main(){
  ${GLSL_DISC}
  gl_FragColor = vec4(vCol * vA * soft_, 1.0);
}`;

function buildArmies(ctx) {
  const groups = {}, out = [];
  UNITS.forEach((u, ui) => { (groups[u.type] ||= []).push([u, ui]); });
  for (const [type, list] of Object.entries(groups)) {
    const tp = template(type), r = rng(type.length * 977 + 5);
    const unitIdx = [], slots = [], seeds = [];
    for (const [u, ui] of list) {
      const aspect = u.k[0].w / u.k[0].d, cols = Math.max(1, Math.round(Math.sqrt(u.n * aspect))), rows = Math.ceil(u.n / cols);
      // ranks and files, but loosened: big jitter, a ragged rounded outline, a slightly bowed front and clumps
      const ph1 = r() * 6.28, ph2 = r() * 6.28, bow = (r() - .5) * .16;
      for (let i = 0; i < u.n; i++) {
        const c = i % cols, rw = Math.floor(i / cols);
        let x = (c + .5 + (r() - .5) * 1.5) / cols - .5, y = (rw + .5 + (r() - .5) * 1.5) / rows - .5;
        const edge = 1 + .14 * Math.sin(x * 9 + ph1) + .1 * Math.sin(y * 7 + ph2);
        const q = Math.pow(Math.abs(2 * x), 3) + Math.pow(Math.abs(2 * y), 3);
        if (q > edge) { const k = Math.pow(edge / q, 1 / 3) * (.85 + r() * .15); x *= k; y *= k; }
        y += bow * Math.cos(x * Math.PI) + .05 * Math.sin(x * 23 + ph1) * Math.sin(y * 17 + ph2);
        x += .02 * Math.sin(y * 31 + ph2);
        unitIdx.push(ui);
        slots.push(x, y);
        seeds.push(r(), .02 + r() * .96, r() * .4);
      }
    }
    const g = new T.InstancedBufferGeometry;
    g.setAttribute("position", new T.BufferAttribute(tp.pos, 3));
    g.setAttribute("aLeg", new T.BufferAttribute(tp.leg, 3));
    g.setAttribute("aBright", new T.BufferAttribute(tp.bright, 1));
    g.setAttribute("aUnit", new T.InstancedBufferAttribute(new Float32Array(unitIdx), 1));
    g.setAttribute("aSlot", new T.InstancedBufferAttribute(new Float32Array(slots), 2));
    g.setAttribute("aSeed", new T.InstancedBufferAttribute(new Float32Array(seeds), 3));
    g.instanceCount = unitIdx.length;
    const m = new T.ShaderMaterial({
      uniforms: { ...ctx.armyU, uSize: { value: type === "ele" ? .5 : .32 } },
      vertexShader: ARMY_VERT, fragmentShader: GLOW_FRAG,
      transparent: true, depthWrite: false, blending: T.AdditiveBlending
    });
    const pts = new T.Points(g, m);
    pts.frustumCulled = false;
    out.push(pts);
    ctx.count += tp.n * unitIdx.length;
  }
  return out;
}

/* ---------- static scenery: the plain, the town, the carts, trees, ditch ---------- */
const SCENE_VERT = `
${GLSL_GROUND}
${GLSL_SIZE}
attribute vec3 aCol; attribute float aT; attribute float aS;
uniform float uFilm, uSize, uReveal, uCarts, uRevealR;
varying vec3 vCol; varying float vA;
void main(){
  // everything is revealed by a ring spreading from the field; carts (aT >= 10) are then built west to east
  float d = length(position.xz - vec2(-200.0, -500.0));
  float alpha = smoothstep(uRevealR, uRevealR - 300.0, d);
  if (aT < -0.5) alpha *= 1.0 - smoothstep(900.0, 2100.0, length((position.xz - vec2(-150.0, -700.0)) * vec2(0.8, 1.0)));
  if (aT > 9.5) { float o = aT - 10.0; alpha *= smoothstep(o - 0.03, o, uCarts * 1.03); }
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(uSize * aS, -mv.z, alpha);
  vCol = aCol; vA = alpha;
}`;

function buildScenery(ctx) {
  const r = rng(1526), ground = new Cloud, things = new Cloud;
  const sand = hexRGB("#6a6459"), field = hexRGB("#4b5e41"), rut = hexRGB("#2a2925"), road = hexRGB("#5a503f"), grid = hexRGB("#22303c");
  const town = hexRGB("#6f7883"), townDim = hexRGB("#46505a"), tree = hexRGB("#4f6b4a"), wood = hexRGB("#6b5a45"), ditch = hexRGB("#1b1f24");
  const cart = hexRGB("#3f7f96"), rope = hexRGB("#2b5b6c");
  // the plain: jittered grid, denser where the fighting happens; fields drawn as patches of tint
  const field_ = (x, z) => (Math.sin(x * .013 + Math.sin(z * .007) * 2) * Math.sin(z * .011 + Math.cos(x * .006) * 2) > .25);
  const plain = (x0, x1, z0, z1, step) => {
    for (let x = x0; x < x1; x += step) for (let z = z0; z < z1; z += step) {
      const px = x + (r() - .5) * step, pz = z + (r() - .5) * step;
      const c = field_(px, pz) ? field : sand, k = .7 + r() * .5;
      ground.add(px, groundH(px, pz), pz, [c[0] * k, c[1] * k, c[2] * k], -1, .9 + r() * .5);
    }
  };
  plain(-2600, 2200, -2900, 1100, 5.2);
  // denser near the fighting, thinning out so the patch has no visible edge
  for (let x = -1500; x < 1500; x += 4) for (let z = -1250; z < 450; z += 4) {
    const e = Math.max(Math.abs(x) / 1500, Math.abs(z + 400) / 850);
    if (r() > 1 - sstep(.55, 1, e)) {
      const px = x + (r() - .5) * 4, pz = z + (r() - .5) * 4, c = field_(px, pz) ? field : sand, k = .7 + r() * .5;
      ground.add(px, groundH(px, pz), pz, [c[0] * k, c[1] * k, c[2] * k], -1, .9 + r() * .5);
    }
  }
  // survey grid every 500 m, faint
  for (let x = -2000; x <= 1500; x += 500) for (let z = -2500; z <= 500; z += 4) ground.add(x, groundH(x, z) + .2, z, grid, -1, .8);
  for (let z = -2500; z <= 500; z += 500) for (let x = -2400; x <= 2000; x += 4) ground.add(x, groundH(x, z) + .2, z, grid, -1, .8);
  // road south to Delhi
  for (let z = -2700; z < -60; z += 1.6) { const x = 240 + Math.sin(z * .0021) * 60; for (const o of [-3, 3]) ground.add(x + o + (r() - .5), groundH(x, z) + .1, z, road, -1, 1); }
  // cart ruts across the plain in front of the line
  for (let i = 0; i < 16; i++) { const x0 = (r() - .5) * 2400, z0 = -200 - r() * 1600, a = r() * 6.28, L = 60 + r() * 200; for (let s = 0; s < L; s += 2) { const x = x0 + Math.cos(a) * s, z = z0 + Math.sin(a) * s; ground.add(x, groundH(x, z) + .1, z, rut, -1, .9); } }

  // Panipat town: mud-brick houses inside a wall, on Babur's right
  for (let i = 0; i < 170; i++) {
    const a = r() * 6.28, rad = Math.sqrt(r()) * 260, x = -1150 + Math.cos(a) * rad * 1.1, z = 110 + Math.sin(a) * rad;
    things.box(x, z, 8 + r() * 14, 3 + r() * 5, 8 + r() * 12, r() * 1.5, r() < .2 ? town : townDim, .35, 0, r, null, 1.1);
  }
  for (let a = 0; a < 6.283; a += .006) { const w = 1 + .05 * Math.sin(a * 5) + .03 * Math.sin(a * 13), x = -1150 + Math.cos(a) * 300 * w, z = 110 + Math.sin(a) * 275 * w; for (let y = 0; y < 6; y += 2) things.add(x + (r() - .5) * 2, groundH(x, z) + y, z + (r() - .5) * 2, townDim, 0, 1); }
  things.box(-1150, 110, 40, 16, 40, .3, town, .6, 0, r, null, 1.2);
  // ditch and felled trees on Babur's left
  for (let x = 720; x < 1450; x += 1.2) for (const o of [-4, 0, 4]) { const z = 40 - (x - 720) * .1 + o; things.add(x, groundH(x, z) - 1.2, z, ditch, 0, 1.2); }
  for (let i = 0; i < 160; i++) {
    const x = 760 + r() * 650, z = 60 - (x - 720) * .1 + (r() - .5) * 24, a = r() * 6.28, L = 6 + r() * 6;
    things.line(x, groundH(x, z) + .5, z, x + Math.cos(a) * L, groundH(x, z) + .3, z + Math.sin(a) * L, wood, .5, 0, .3, r, 1.1);
    things.ball(x + Math.cos(a) * L, groundH(x, z) + 1.5, z + Math.sin(a) * L, 2.5, 1.5, 2.5, tree, 30, 0, r);
  }
  // scattered trees and groves on the plain
  for (let i = 0; i < 260; i++) {
    const x = -2200 + r() * 4000, z = -2600 + r() * 3400;
    if (Math.abs(x) < 900 && z > -1700 && z < 300) continue;
    const h = 5 + r() * 6;
    things.line(x, groundH(x, z), z, x, groundH(x, z) + h * .55, z, wood, .5, 0, .2, r);
    things.ball(x, groundH(x, z) + h * .7, z, 3 + r() * 2, 2.5 + r() * 1.5, 3 + r() * 2, tree, 70, 0, r);
  }
  // the araba: carts lashed in a line, built from west to east (aT encodes build order, > 10)
  const gaps = new Set(GUN_X.map(x => Math.round(x)));
  for (let x = -760; x <= 760; x += 6.5) {
    if ([...gaps].some(g => Math.abs(g - x) < 6)) continue;
    const order = 10 + (x + 760) / 1520 * .99, y = groundH(x, 0);
    things.box(x, 0, 4.2, .25, 1.8, 0, cart, 3.2, order, r, y + .7, 1);
    for (const s of [-1, 1]) for (let a = 0; a < 6.283; a += .35) things.add(x + Math.cos(a) * .6, y + .6 + Math.sin(a) * .6, s * .95, cart, order, 1);
    things.line(x + 2.1, y + .9, .8, x + 4.4, y + .8, .8, rope, .25, order, .05, r);
    things.line(x + 2.1, y + .9, -.8, x + 4.4, y + .8, -.8, rope, .25, order, .05, r);
  }
  // mantlets and guns in the gaps
  for (const gx of GUN_X) {
    const y = groundH(gx, 0), order = 10 + (gx + 760) / 1520 * .99;
    things.box(gx - 3, -1.2, 1.6, 1.6, .2, 0, cart, 6, order, r, y);
    things.box(gx + 3, -1.2, 1.6, 1.6, .2, 0, cart, 6, order, r, y);
    things.line(gx, y + 1.0, 1.2, gx, y + .9, -1.6, hexRGB("#9fd6e8"), .08, order, .25, r, 1.2);
    for (const s of [-1, 1]) for (let a = 0; a < 6.283; a += .3) things.add(gx + s * .5, y + .5 + Math.sin(a) * .5, Math.cos(a) * .5 + .4, cart, order, 1);
  }
  const mk = (cloud, size) => {
    const m = new T.ShaderMaterial({ uniforms: { ...ctx.sceneU, uSize: { value: size } }, vertexShader: SCENE_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
    const p = new T.Points(cloud.geometry(), m);
    p.frustumCulled = false;
    ctx.count += cloud.t.length;
    return p;
  };
  return [mk(ground, .55), mk(things, .6)];
}

/* ---------- effects: smoke, muzzle flashes, cannon shot, arrows, dust, the fallen ---------- */
const SMOKE_VERT = `
${GLSL_GROUND}
${GLSL_SIZE}
attribute vec3 aDir; attribute vec2 aInfo;   // aInfo: spawn time, kind (0 musket, 1 cannon)
uniform float uFilm, uSmoke;
varying vec3 vCol; varying float vA;
void main(){
  float age = uFilm - aInfo.x, kind = aInfo.y;
  float life = mix(6.0, 9.0, kind);
  if (age < 0.0 || age > life) { gl_Position = vec4(2.0); gl_PointSize = 0.0; vA = 0.0; return; }
  float k = age / life;
  vec3 p = position;
  float burst = (1.0 - exp(-age * 4.0));
  p += vec3(aDir.x * 2.5, abs(aDir.y) * 1.5 + 0.4, -abs(aDir.z) * mix(9.0, 22.0, kind)) * burst * mix(1.0, 1.6, kind);
  p += aDir * (2.0 + 9.0 * k) * mix(1.0, 1.5, kind);
  p += vec3(3.0, 1.6, 1.2) * age;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float flash = 1.0 - smoothstep(0.0, 0.12, age);
  float alpha = (1.0 - k) * (1.0 - k) * 0.28 * uSmoke + flash * 1.5;
  vCol = mix(vec3(0.62, 0.66, 0.70), vec3(1.0, 0.86, 0.55), flash);
  gl_PointSize = pointPx(mix(2.0, 5.0, k) * mix(1.0, 1.4, kind), -mv.z, alpha);
  vA = alpha;
}`;
function buildSmoke(ctx) {
  const r = rng(77), P = [], D = [], I = [];
  for (const [t, kind] of VOLLEYS) {
    if (kind === "m") {
      for (let x = -720; x <= 720; x += 24) for (let i = 0; i < 18; i++) {
        const xx = x + (r() - .5) * 16, td = t + r() * .25;
        P.push(xx, groundH(xx, 0) + 1.3, -1.5); D.push(r() - .5, r() - .5, r() - .5); I.push(td, 0);
      }
    } else {
      for (const gx of GUN_X) for (let i = 0; i < 70; i++) {
        P.push(gx, groundH(gx, 0) + 1, -2); D.push(r() - .5, r() - .5, r() - .5); I.push(t + r() * .3 + (gx + 700) / 7000, 1);
      }
    }
  }
  const g = new T.BufferGeometry;
  g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
  g.setAttribute("aDir", new T.Float32BufferAttribute(D, 3));
  g.setAttribute("aInfo", new T.Float32BufferAttribute(I, 2));
  const m = new T.ShaderMaterial({ uniforms: ctx.sceneU, vertexShader: SMOKE_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const p = new T.Points(g, m); p.frustumCulled = false; ctx.count += I.length / 2;
  return p;
}
// cannon shot: bright comets flying south from each gun after each cannon volley
const SHOT_VERT = `
${GLSL_GROUND}
${GLSL_SIZE}
attribute vec3 aInfo;   // spawn time, tail index 0..1, range
uniform float uFilm;
varying vec3 vCol; varying float vA;
void main(){
  float age = uFilm - aInfo.x - aInfo.y * 0.05;
  if (age < 0.0 || age > 0.9) { gl_Position = vec4(2.0); gl_PointSize = 0.0; vA = 0.0; return; }
  float k = age / 0.9;
  vec3 p = position + vec3(0.0, 10.0 * k * (1.0 - k), -aInfo.z * k);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float alpha = (1.0 - aInfo.y) * 1.4 * (1.0 - k * 0.5);
  gl_PointSize = pointPx(1.2, -mv.z, alpha);
  vCol = vec3(1.0, 0.8, 0.45); vA = alpha;
}`;
function buildShot(ctx) {
  const r = rng(5), P = [], I = [];
  for (const [t, kind] of VOLLEYS) if (kind === "g") for (const gx of GUN_X) for (let i = 0; i < 10; i++) { P.push(gx, groundH(gx, 0) + 1, -2); I.push(t + (gx + 700) / 7000, i / 10, 260 + r() * 160); }
  const g = new T.BufferGeometry;
  g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
  g.setAttribute("aInfo", new T.Float32BufferAttribute(I, 3));
  const m = new T.ShaderMaterial({ uniforms: ctx.sceneU, vertexShader: SHOT_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const p = new T.Points(g, m); p.frustumCulled = false;
  return p;
}
// arrows: arcs from one unit to another, cycling while uArrows is up
const ARROW_VERT = `
${GLSL_GROUND}
${GLSL_SIZE}
attribute vec4 aPair;   // source unit, target unit, seed, spread
uniform vec4 uA[${NU}], uB[${NU}];
uniform float uTime, uArrows;
varying vec3 vCol; varying float vA;
void main(){
  int s = int(aPair.x + 0.5), d = int(aPair.y + 0.5);
  float alpha = uArrows * min(uA[s].w, uA[d].w);
  float k = fract(uTime * 0.55 + aPair.z * 7.0);
  vec2 o1 = vec2(fract(aPair.z * 13.1) - 0.5, fract(aPair.z * 29.7) - 0.5), o2 = vec2(fract(aPair.z * 51.3) - 0.5, fract(aPair.z * 71.9) - 0.5);
  vec2 a = uA[s].xy + o1 * uB[s].xy, b = uA[d].xy + o2 * uB[d].xy * 0.8;
  vec2 xz = mix(a, b, k);
  float lift = length(b - a) * 0.22 * 4.0 * k * (1.0 - k);
  vec3 p = vec3(xz.x, groundH(xz) + 2.0 + lift, xz.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  alpha *= smoothstep(0.0, 0.1, k) * (1.0 - smoothstep(0.85, 1.0, k)) * 0.9;
  gl_PointSize = pointPx(0.9, -mv.z, alpha);
  vCol = vec3(0.75, 0.95, 1.0); vA = alpha;
}`;
function buildArrows(ctx) {
  const r = rng(9), A = [], pairs = [["bTulR", "lLeft"], ["bTulR", "lRear"], ["bTulL", "lRight"], ["bTulL", "lRear"], ["bRight", "lLeft"], ["bLeft", "lRight"], ["bTulR", "lCentre"], ["bTulL", "lCentre"]];
  for (const [s, d] of pairs) for (let i = 0; i < 900; i++) A.push(UNIT_INDEX[s], UNIT_INDEX[d], r(), 0);
  const g = new T.BufferGeometry;
  g.setAttribute("position", new T.Float32BufferAttribute(new Float32Array(A.length / 4 * 3), 3));
  g.setAttribute("aPair", new T.Float32BufferAttribute(A, 4));
  const m = new T.ShaderMaterial({ uniforms: { ...ctx.armyU, ...ctx.sceneU }, vertexShader: ARROW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const p = new T.Points(g, m); p.frustumCulled = false;
  return p;
}
// dust thrown up by moving units
const DUST_VERT = `
${GLSL_GROUND}
${GLSL_SIZE}
attribute vec4 aD;   // unit, slot x, slot z, seed
uniform vec4 uA[${NU}], uB[${NU}];
uniform float uTime;
varying vec3 vCol; varying float vA;
void main(){
  int u = int(aD.x + 0.5);
  vec4 A = uA[u], B = uB[u];
  float pace = B.z, alpha = A.w * smoothstep(0.3, 1.6, pace) * 0.22;
  if (alpha < 0.002) { gl_Position = vec4(2.0); gl_PointSize = 0.0; vA = 0.0; return; }
  float k = fract(uTime * 0.25 + aD.w * 5.0);
  vec2 f = vec2(sin(A.z), cos(A.z)), r = vec2(cos(A.z), -sin(A.z));
  vec2 s = vec2(aD.y * B.x * 1.15, aD.z * B.y * 1.4 + B.y * 0.6 + k * 30.0);
  vec2 xz = A.xy + r * s.x - f * s.y;
  vec3 p = vec3(xz.x, groundH(xz) + k * 9.0, xz.y);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  alpha *= sin(k * 3.1416);
  gl_PointSize = pointPx(5.0 + k * 9.0, -mv.z, alpha);
  vCol = vec3(0.55, 0.48, 0.38); vA = alpha;
}`;
function buildDust(ctx) {
  const r = rng(31), D = [];
  UNITS.forEach((u, ui) => { if (u.type === "cav" || u.type === "ele") for (let i = 0; i < Math.min(900, u.n * .6); i++) D.push(ui, r() - .5, r() - .5, r()); });
  const g = new T.BufferGeometry;
  g.setAttribute("position", new T.Float32BufferAttribute(new Float32Array(D.length / 4 * 3), 3));
  g.setAttribute("aD", new T.Float32BufferAttribute(D, 4));
  const m = new T.ShaderMaterial({ uniforms: { ...ctx.armyU, ...ctx.sceneU }, vertexShader: DUST_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const p = new T.Points(g, m); p.frustumCulled = false;
  return p;
}
// the fallen: a field that fills in as casualties mount (each point appears past its own threshold)
const FALLEN_VERT = `
${GLSL_SIZE}
attribute float aThr;
uniform float uFallen;
varying vec3 vCol; varying float vA;
void main(){
  float alpha = smoothstep(aThr, aThr + 0.03, uFallen) * 0.55;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(0.7, -mv.z, alpha);
  vCol = vec3(0.75, 0.22, 0.16); vA = alpha;
}`;
function buildFallen(ctx) {
  const r = rng(41), P = [], A = [];
  const blob = (cx, cz, rx, rz, n, t0, t1) => { for (let i = 0; i < n; i++) { const a = r() * 6.28, q = Math.sqrt(r()), x = cx + Math.cos(a) * rx * q, z = cz + Math.sin(a) * rz * q; for (let j = 0; j < 4; j++) { const xx = x + (r() - .5) * 1.6, zz = z + (r() - .5) * .6; P.push(xx, groundH(xx, zz) + .15, zz); A.push(lerp(t0, t1, r())); } } };
  blob(0, -150, 560, 70, 2500, 0, .3);
  blob(0, -330, 420, 160, 6000, .15, .8);
  blob(-480, -340, 160, 140, 1500, .3, .9); blob(480, -340, 160, 140, 1500, .3, .9);
  blob(0, -560, 380, 90, 1500, .4, .95);
  blob(0, -800, 450, 260, 1200, .85, 1);
  const g = new T.BufferGeometry;
  g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
  g.setAttribute("aThr", new T.Float32BufferAttribute(A, 1));
  const m = new T.ShaderMaterial({ uniforms: ctx.sceneU, vertexShader: FALLEN_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: T.AdditiveBlending });
  const p = new T.Points(g, m); p.frustumCulled = false; ctx.count += A.length;
  return p;
}
// movement arrows on the ground: dashed ribbons with an arrowhead
const RIB_VERT = `
attribute float aAlong;
varying float vAlong; varying vec2 vUv;
void main(){ vAlong = aAlong; vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const RIB_FRAG = `
uniform vec3 uC; uniform float uA, uTime, uLen;
varying float vAlong; varying vec2 vUv;
void main(){
  float d = fract(vAlong / 40.0 - uTime * 0.6);
  float dash = smoothstep(0.0, 0.1, d) * smoothstep(0.7, 0.55, d);
  float edge = 1.0 - smoothstep(0.35, 0.5, abs(vUv.y - 0.5));
  float a = uA * (0.25 + 0.75 * dash) * edge * smoothstep(0.0, 60.0, vAlong);
  if (a < 0.01) discard;
  gl_FragColor = vec4(uC * a, 1.0);
}`;
function buildRibbons(ctx) {
  const out = [];
  for (const [key, pts] of RIBBONS) {
    const curve = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), false, "centripetal");
    const N = 120, W = 7, P = [], UV = [], AL = [], idx = [];
    const len = curve.getLength();
    for (let i = 0; i <= N; i++) {
      const k = i / N, p = curve.getPointAt(Math.min(k, .999)), tg = curve.getTangentAt(Math.min(k, .999));
      const nx = -tg.z, nz = tg.x, w = k > .94 ? W * 3.2 * (1 - k) / .06 : W;
      for (const s of [-1, 1]) { const x = p.x + nx * w * s, z = p.z + nz * w * s; P.push(x, groundH(x, z) + .8, z); UV.push(k, s > 0 ? 1 : 0); AL.push(k * len); }
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new T.BufferGeometry;
    g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(UV, 2));
    g.setAttribute("aAlong", new T.Float32BufferAttribute(AL, 1));
    g.setIndex(idx);
    const side = key === "ribAdv" || key === "ribRout" ? ctx.colLodi : ctx.colBabur;
    const m = new T.ShaderMaterial({ uniforms: { uC: side, uA: { value: 0 }, uTime: ctx.sceneU.uTime, uLen: { value: len } }, vertexShader: RIB_VERT, fragmentShader: RIB_FRAG, transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide });
    const mesh = new T.Mesh(g, m);
    mesh.frustumCulled = false; mesh.userData.key = key;
    out.push(mesh);
  }
  return out;
}
// a ring that marks the sultan, turning red when he falls
function buildMarker(ctx) {
  const P = [];
  for (let a = 0; a < 6.283; a += .03) P.push(Math.cos(a) * 14, .6, Math.sin(a) * 14);
  const g = new T.BufferGeometry;
  g.setAttribute("position", new T.Float32BufferAttribute(P, 3));
  const u = { uC: { value: new T.Color(1, .85, .5) }, uA: { value: 0 } };
  const m = new T.ShaderMaterial({ uniforms: { ...u, ...ctx.sceneU }, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: `${GLSL_SIZE}\nuniform vec3 uC; uniform float uA; varying vec3 vCol; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; float a = uA; gl_PointSize = pointPx(1.1, -mv.z, a); vCol = uC; vA = a; }`,
    fragmentShader: GLOW_FRAG });
  const p = new T.Points(g, m); p.frustumCulled = false;
  return { p, u };
}
