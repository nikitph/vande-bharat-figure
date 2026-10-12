/* ---------- Panipat as a diorama: two-tone shading and ink lines, like the train's first version ---------- */
const angLerp = (a, b, k) => a + (((b - a) % 360 + 540) % 360 - 180) * k;
const groundH = (x, z) => 1.6 * Math.sin(x * .0021 + .4) * Math.sin(z * .0017 + 1.1) + .9 * Math.sin(x * .0053 + z * .0041) + .45 * Math.sin(x * .011 - z * .009);
const GLSL_GROUND = `
float groundH(vec2 p){ return 1.6 * sin(p.x * .0021 + .4) * sin(p.y * .0017 + 1.1) + .9 * sin(p.x * .0053 + p.y * .0041) + .45 * sin(p.x * .011 - p.y * .009); }`;
const FIG_SCALE = 2.2;      // figures are drawn larger than life so they read at battlefield scale, as on a wargames table
const FIG_SHARE = .5;       // and there are fewer of them: each stands for more men

/* ----- animated figures: every vertex is placed by its unit's state, entirely on the GPU ----- */
const FIG_DECL = `
attribute vec3 aLeg; attribute float aUnit; attribute vec2 aSlot; attribute vec3 aSeed;
uniform vec4 uA[${NU}], uB[${NU}], uC[${NU}];
uniform float uTime, uGait, uFig;
${GLSL_GROUND}
vec2 rot2(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }
struct Fig { vec2 wp; float hd; float dead; float ph; float go; float vis; float flip; };
Fig figState(){
  Fig F; int u = int(aUnit + 0.5);
  vec4 A = uA[u], B = uB[u], C = uC[u];
  float seed = aSeed.x, die = aSeed.y, wob = aSeed.z;
  F.vis = step(seed * 0.98 + 0.01, A.w);
  float chaos = B.w, pace = B.z;
  vec2 s = aSlot * B.xy + vec2(sin(uTime * (0.35 + wob) + seed * 40.0), cos(uTime * (0.3 + wob) + seed * 31.0)) * chaos * 9.0;
  F.hd = A.z + chaos * sin(uTime * 0.8 + seed * 17.0) * 1.4 + (seed - 0.5) * 0.12;
  vec2 f = vec2(sin(A.z), cos(A.z)), r = vec2(cos(A.z), -sin(A.z));
  F.wp = A.xy + r * s.x - f * s.y;
  F.dead = smoothstep(die, die + 0.025, C.x);
  F.ph = uTime * (2.2 + pace * 2.4) + seed * 6.2831;
  F.go = min(pace, 2.0) * (1.0 - F.dead) * uGait;
  F.flip = seed > 0.5 ? 1.0 : -1.0;
  return F;
}
vec3 figApply(vec3 p, Fig F, bool isPoint){
  if (aLeg.x >= 0.0) {
    float a = sin(F.ph + aLeg.x) * 0.42 * min(F.go, 1.4);
    vec2 piv = isPoint ? vec2(aLeg.z, aLeg.y) : vec2(0.0);
    vec2 q = rot2(vec2(p.z, p.y) - piv, a) + piv;
    p.z = q.x; p.y = q.y;
  }
  if (isPoint) p.y += abs(sin(F.ph)) * 0.07 * F.go;
  p.xy = rot2(p.xy, F.dead * 1.45 * F.flip);
  if (isPoint) { p.y = max(p.y, 0.02); p *= uFig; }
  p.xz = rot2(p.xz, -F.hd);
  if (isPoint) {
    p += vec3(F.wp.x, groundH(F.wp), F.wp.y);
    if (F.vis < 0.5) p = vec3(F.wp.x, -800.0, F.wp.y);
  }
  return p;
}`;
function injectFigure(sh, U) {
  Object.assign(sh.uniforms, U);
  sh.vertexShader = sh.vertexShader
    .replace("#include <common>", "#include <common>\n" + FIG_DECL)
    .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\n{ Fig Fn = figState(); objectNormal = figApply(objectNormal, Fn, false); }")
    .replace("#include <begin_vertex>", "#include <begin_vertex>\n{ Fig Fv = figState(); transformed = figApply(position, Fv, true); }");
}
// wrap any material so it runs the figure transform; the same code drives colour, ink and shadow passes
function figureMaterial(base, U, key) {
  const prev = base.onBeforeCompile;
  base.onBeforeCompile = (sh, r) => { if (prev) prev.call(base, sh, r); injectFigure(sh, U); };
  const pk = base.customProgramCacheKey && base.customProgramCacheKey.bind(base);
  base.customProgramCacheKey = () => "fig:" + key + ":" + (pk ? pk() : "");
  return base;
}

/* ----- figure geometry: low-poly pieces, each vertex tagged with how its leg swings ----- */
function tagged(g, leg = [-1, 0, 0]) {
  const o = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(o.attributes)) if (k !== "position" && k !== "normal") o.deleteAttribute(k);
  const n = o.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set(leg, i * 3);
  o.setAttribute("aLeg", new T.BufferAttribute(a, 3));
  return o;
}
const ball = (r, x, y, z, sx = 1, sy = 1, sz = 1) => { const g = new T.IcosahedronGeometry(r, 1); g.scale(sx, sy, sz); g.translate(x, y, z); return g; };
const stick = (a, b, r, seg = 5) => {
  const d = new T.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length(), g = new T.CylinderGeometry(r, r, L, seg);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
};
const blk = (w, h, d, x, y, z) => { const g = new T.BoxGeometry(w, h, d); g.translate(x, y, z); return g; };
function figureParts(kind) {
  const parts = {}, put = (k, g, leg) => (parts[k] ||= []).push(tagged(g, leg));
  if (kind === "inf" || kind === "gun") {
    put("cloth", blk(.15, .9, .17, .1, .45, 0), [0, .9, 0]); put("cloth", blk(.15, .9, .17, -.1, .45, 0), [Math.PI, .9, 0]);
    put("cloth", blk(.4, .6, .26, 0, 1.22, 0)); put("cloth", blk(.46, .12, .3, 0, 1.47, 0));
    put("cloth", stick([.24, 1.45, 0], [.28, .98, .12], .055)); put("cloth", stick([-.24, 1.45, 0], [-.28, .98, .08], .055));
    put("skin", ball(.12, 0, 1.64, 0)); put("cloth", ball(.13, 0, 1.73, 0, 1, .6, 1));
    if (kind === "inf") { put("metal", stick([.3, .5, .1], [.34, 2.75, .26], .025)); put("cloth", blk(.06, .55, .42, -.3, 1.15, .12)); }
    else put("metal", stick([.2, 1.25, -.3], [.15, 1.4, .95], .035));
  } else if (kind === "cav") {
    put("horse", ball(.5, 0, 1.38, 0, .72, .72, 1.9)); put("horse", stick([0, 1.5, .75], [0, 2.05, 1.2], .16)); put("horse", blk(.2, .22, .55, 0, 2.05, 1.42));
    for (const [x, z, ph] of [[.2, .7, 0], [-.2, .7, .5], [.2, -.72, Math.PI], [-.2, -.72, Math.PI + .5]]) put("horse", blk(.12, 1.15, .14, x, .57, z), [ph, 1.15, z]);
    put("horse", stick([0, 1.45, -.9], [0, .8, -1.15], .07));
    put("cloth", blk(.36, .55, .26, 0, 2.08, -.05)); put("cloth", stick([.17, 1.85, -.05], [.2, 1.45, .25], .06)); put("cloth", stick([-.17, 1.85, -.05], [-.2, 1.45, .25], .06));
    put("skin", ball(.11, 0, 2.48, 0)); put("cloth", ball(.12, 0, 2.57, 0, 1, .6, 1));
    put("metal", stick([.3, 1.7, -.6], [.34, 3.0, 1.0], .025));
  } else {
    put("hide", ball(1, 0, 2.15, 0, 1.05, 1.15, 1.75)); put("hide", ball(.78, 0, 2.7, 1.9));
    put("hide", stick([0, 2.4, 2.45], [0, 1.2, 2.85], .2)); put("hide", stick([0, 1.2, 2.85], [0, .45, 2.6], .12));
    put("hide", blk(.08, 1.0, .85, .82, 2.65, 1.75)); put("hide", blk(.08, 1.0, .85, -.82, 2.65, 1.75));
    put("metal", stick([.32, 2.0, 2.4], [.42, 1.6, 3.15], .05)); put("metal", stick([-.32, 2.0, 2.4], [-.42, 1.6, 3.15], .05));
    for (const [x, z, ph] of [[.6, 1.1, 0], [-.6, 1.1, Math.PI], [.6, -1.1, Math.PI], [-.6, -1.1, 0]]) put("hide", stick([x, 1.55, z], [x, 0, z], .3, 8), [ph, 1.55, z]);
    put("cloth", blk(1.3, .55, 1.4, 0, 3.55, -.2)); put("cloth", blk(1.5, .08, 1.6, 0, 3.3, -.2));
    put("cloth", blk(.3, .5, .25, 0, 4.05, -.2)); put("skin", ball(.12, 0, 4.42, -.2)); put("skin", ball(.11, 0, 3.35, 2.1));
  }
  const out = {};
  for (const [k, list] of Object.entries(parts)) out[k] = mergeGeometries(list, false);
  return out;
}

/* ----- armies ----- */
function buildArmies(ctx) {
  const { mat, U, figU } = ctx, groups = {}, meshes = [];
  UNITS.forEach((u, ui) => { const k = u.type + ":" + u.side; (groups[k] ||= []).push([u, ui]); });
  for (const [key, list] of Object.entries(groups)) {
    const [type, side] = key.split(":"), r = rng(type.length * 977 + Number(side) * 31 + 5);
    const unitIdx = [], slots = [], seeds = [];
    for (const [u, ui] of list) {
      const n = Math.round(u.n * (type === "ele" ? 1 : FIG_SHARE)), k0 = u.k[0];
      const cols = Math.max(1, Math.round(Math.sqrt(n * k0.w / k0.d))), rows = Math.ceil(n / cols), ph1 = r() * 6.28, ph2 = r() * 6.28, bow = (r() - .5) * .16;
      for (let i = 0; i < n; i++) {
        const c = i % cols, rw = Math.floor(i / cols);
        let x = (c + .5 + (r() - .5) * 1.3) / cols - .5, y = (rw + .5 + (r() - .5) * 1.3) / rows - .5;
        const edge = 1 + .14 * Math.sin(x * 9 + ph1) + .1 * Math.sin(y * 7 + ph2), q = Math.abs(2 * x) ** 3 + Math.abs(2 * y) ** 3;
        if (q > edge) { const kk = (edge / q) ** (1 / 3) * (.85 + r() * .15); x *= kk; y *= kk; }
        y += bow * Math.cos(x * Math.PI);
        unitIdx.push(ui); slots.push(x, y); seeds.push(r(), .02 + r() * .96, r() * .4);
      }
    }
    const parts = figureParts(type), sideCol = side === "0" ? "babur" : "lodi";
    const paintOf = { cloth: sideCol, skin: "skin", metal: "metal", horse: side === "0" ? "horse" : "horseL", hide: "elephant" };
    for (const [part, geo] of Object.entries(parts)) {
      const g = new T.InstancedBufferGeometry();
      g.setAttribute("position", geo.attributes.position); g.setAttribute("normal", geo.attributes.normal); g.setAttribute("aLeg", geo.attributes.aLeg);
      g.setAttribute("aUnit", new T.InstancedBufferAttribute(new Float32Array(unitIdx), 1));
      g.setAttribute("aSlot", new T.InstancedBufferAttribute(new Float32Array(slots), 2));
      g.setAttribute("aSeed", new T.InstancedBufferAttribute(new Float32Array(seeds), 3));
      g.instanceCount = unitIdx.length;
      const k = `${type}-${part}-${side}`;
      const m = mesh(g, figureMaterial(toon(U, part === "cloth" ? "body" : "deck", { color: paintOf[part], forcePaint: true }), figU, k), true, true);
      m.frustumCulled = false;
      m.userData.nmat = figureMaterial(new T.MeshNormalMaterial(), figU, k + "-n");
      m.customDepthMaterial = figureMaterial(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }), figU, k + "-d");
      ctx.track(m.material); ctx.track(m.userData.nmat); ctx.track(m.customDepthMaterial);
      meshes.push(m);
      ctx.count += unitIdx.length;
    }
  }
  return meshes;
}

/* ----- the slab of ground, fields, road, town, ditch, trees, carts and guns ----- */
const SLAB = { x0: -2100, x1: 1700, z0: -2300, z1: 700, base: -60 };
function buildTerrain(ctx) {
  const { mat, U } = ctx, root = new T.Group, r = rng(1526);
  const NX = 190, NZ = 150, g = new T.PlaneGeometry(SLAB.x1 - SLAB.x0, SLAB.z1 - SLAB.z0, NX, NZ);
  g.rotateX(-Math.PI / 2); g.translate((SLAB.x0 + SLAB.x1) / 2, 0, (SLAB.z0 + SLAB.z1) / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundH(p.getX(i), p.getZ(i)));
  g.computeVertexNormals();
  root.add(mesh(g, mat("deck", "soil"), false, true));
  // the cut sides of the slab, with strata
  const sides = [];
  const wall = (pts) => { const P = [], idx = []; pts.forEach(([x, z], i) => { P.push(x, groundH(x, z), z, x, SLAB.base, z); if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }); const w = new T.BufferGeometry; w.setAttribute("position", new T.Float32BufferAttribute(P, 3)); w.setIndex(idx); w.computeVertexNormals(); return w; };
  const edge = (a, b, n = 120) => [...Array(n + 1)].map((_, i) => [lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]);
  sides.push(wall(edge([SLAB.x0, SLAB.z0], [SLAB.x1, SLAB.z0])), wall(edge([SLAB.x1, SLAB.z0], [SLAB.x1, SLAB.z1])), wall(edge([SLAB.x1, SLAB.z1], [SLAB.x0, SLAB.z1])), wall(edge([SLAB.x0, SLAB.z1], [SLAB.x0, SLAB.z0])));
  root.add(mesh(merge(sides), toon(U, "deck", { color: "earth", strata: 9, side: T.DoubleSide }), false, true));
  // field patches, draped on the ground
  const patch = (cx, cz, w, d, a, lift = .6) => {
    const pg = new T.PlaneGeometry(w, d, Math.max(2, Math.round(w / 12)), Math.max(2, Math.round(d / 12))); pg.rotateX(-Math.PI / 2); pg.rotateY(a); pg.translate(cx, 0, cz);
    const q = pg.attributes.position; for (let i = 0; i < q.count; i++) q.setY(i, groundH(q.getX(i), q.getZ(i)) + lift);
    pg.computeVertexNormals(); return pg;
  };
  const f1 = [], f2 = [];
  for (let i = 0; i < 150; i++) {
    const cx = lerp(SLAB.x0 + 150, SLAB.x1 - 150, r()), cz = lerp(SLAB.z0 + 150, SLAB.z1 - 150, r());
    if (Math.hypot(cx + 1150, cz - 110) < 380 || (Math.abs(cx) < 900 && cz > -900 && cz < 120)) continue;
    const ripe = r() < .45; (ripe ? f2 : f1).push(patch(cx, cz, 80 + r() * 160, 60 + r() * 120, (r() - .5) * .5, ripe ? 1.0 : .6));
  }
  root.add(mesh(merge(f1), mat("deck", "field"), false, true), mesh(merge(f2), mat("deck", "field2"), false, true));
  // road south to Delhi
  const road = [];
  for (let z = SLAB.z0; z < -60; z += 20) { const x = 240 + Math.sin(z * .0021) * 60, x2 = 240 + Math.sin((z + 20) * .0021) * 60; road.push(patch((x + x2) / 2, z + 10, 9, 21, Math.atan2(x2 - x, 20), 1.4)); }
  root.add(mesh(merge(road), mat("mark", "road"), false, true));
  // Panipat: walled town of flat-roofed houses on Babur's right
  const houses = [], roofs = [];
  for (let i = 0; i < 200; i++) {
    const a = r() * 6.28, rad = Math.sqrt(r()) * 255, x = -1150 + Math.cos(a) * rad * 1.1, z = 110 + Math.sin(a) * rad, w = 9 + r() * 14, d = 9 + r() * 12, h = 4 + r() * 6;
    const b = new T.BoxGeometry(w, h, d); b.rotateY(r() * 1.5); b.translate(x, groundH(x, z) + h / 2, z); houses.push(b);
    if (r() < .35) { const t = new T.BoxGeometry(w * .4, 2, d * .4); t.translate(x, groundH(x, z) + h + 1, z); roofs.push(t); }
  }
  const ring = [];
  for (let i = 0; i < 90; i++) {
    const a0 = i / 90 * 6.283, a1 = (i + 1) / 90 * 6.283, w = a => 1 + .05 * Math.sin(a * 5) + .03 * Math.sin(a * 13);
    const p0 = [-1150 + Math.cos(a0) * 300 * w(a0), 110 + Math.sin(a0) * 275 * w(a0)], p1 = [-1150 + Math.cos(a1) * 300 * w(a1), 110 + Math.sin(a1) * 275 * w(a1)];
    const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), b = new T.BoxGeometry(L + .8, 7, 3);
    b.rotateY(-Math.atan2(p1[1] - p0[1], p1[0] - p0[0])); b.translate((p0[0] + p1[0]) / 2, groundH(p0[0], p0[1]) + 3.5, (p0[1] + p1[1]) / 2); ring.push(b);
    if (i % 9 === 0) { const t = new T.CylinderGeometry(5, 6, 11, 10); t.translate(p0[0], groundH(p0[0], p0[1]) + 5.5, p0[1]); ring.push(t); }
  }
  const fort = new T.BoxGeometry(46, 15, 46); fort.translate(-1150, groundH(-1150, 110) + 7.5, 110);
  root.add(mesh(merge(houses), mat("body", "house")), mesh(merge(roofs), mat("body", "house")), mesh(merge(ring.concat([fort])), mat("body", "townWall")));
  // ditch and felled trees on Babur's left
  const ditch = [];
  for (let x = 720; x < 1450; x += 20) ditch.push(patch(x + 10, 40 - (x + 10 - 720) * .1, 21, 9, -Math.atan(.1), 1.4));
  root.add(mesh(merge(ditch), mat("dark", "ditch"), false, true));
  const logs = [], crowns = [], trunks = [];
  for (let i = 0; i < 140; i++) {
    const x = 760 + r() * 650, z = 60 - (x - 720) * .1 + (r() - .5) * 24, a = r() * 6.28, L = 7 + r() * 6, y = groundH(x, z);
    logs.push(stick([x, y + .5, z], [x + Math.cos(a) * L, y + .4, z + Math.sin(a) * L], .35, 6));
    const c = new T.IcosahedronGeometry(2.4, 0); c.scale(1.2, .7, 1.2); c.translate(x + Math.cos(a) * L, y + 1.2, z + Math.sin(a) * L); crowns.push(c);
  }
  for (let i = 0; i < 320; i++) {
    const x = lerp(SLAB.x0 + 40, SLAB.x1 - 40, r()), z = lerp(SLAB.z0 + 40, SLAB.z1 - 40, r());
    if ((Math.abs(x) < 950 && z > -1800 && z < 300) || Math.hypot(x + 1150, z - 110) < 330) continue;
    const h = 7 + r() * 7, y = groundH(x, z), n = r() < .5 ? 1 : 3;
    for (let j = 0; j < n; j++) {
      const ox = x + (r() - .5) * 14 * (n > 1), oz = z + (r() - .5) * 14 * (n > 1);
      trunks.push(stick([ox, y, oz], [ox, y + h * .55, oz], .45, 5));
      const c = new T.IcosahedronGeometry(3.2 + r() * 2, 0); c.scale(1, .85, 1); c.translate(ox, y + h * .75, oz); crowns.push(c);
    }
  }
  root.add(mesh(merge(logs.concat(trunks)), mat("dark", "trunk")), mesh(merge(crowns), mat("deck", "foliage")));
  return root;
}
// carts and guns appear west to east as the line is built
function buildCarts(ctx) {
  const { U } = ctx, cartU = { uCarts: ctx.sceneU.uCarts };
  const inject = (sh) => { Object.assign(sh.uniforms, cartU); sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute float aOrder; uniform float uCarts;").replace("#include <begin_vertex>", "#include <begin_vertex>\nif (aOrder > uCarts) transformed.y -= 400.0;"); };
  const wrap = (m, key) => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, r) => { if (prev) prev.call(m, sh, r); inject(sh); }; const pk = m.customProgramCacheKey && m.customProgramCacheKey.bind(m); m.customProgramCacheKey = () => "cart:" + key + (pk ? pk() : ""); return m; };
  const withOrder = (g, k) => { const o = g.index ? g.toNonIndexed() : g; for (const n of Object.keys(o.attributes)) if (n !== "position" && n !== "normal") o.deleteAttribute(n); o.setAttribute("aOrder", new T.BufferAttribute(new Float32Array(o.attributes.position.count).fill(k), 1)); return o; };
  const wood = [], wheels = [], guns = [], ropes = [];
  for (let x = -760; x <= 760; x += 7) {
    if (GUN_X.some(g => Math.abs(g - x) < 6)) continue;
    const k = (x + 760) / 1520, y = groundH(x, 0);
    wood.push(withOrder(blk(4.4, .35, 2, x, y + .95, 0), k), withOrder(blk(4.4, .7, .1, x, y + 1.4, .95), k), withOrder(blk(4.4, .7, .1, x, y + 1.4, -.95), k), withOrder(stick([x + 2.2, y + .9, 0], [x + 3.6, y + .6, 0], .08), k));
    for (const s of [-1, 1]) wheels.push(withOrder((() => { const w = new T.CylinderGeometry(.7, .7, .15, 12); w.rotateX(Math.PI / 2); w.translate(x, y + .7, s * 1.1); return w; })(), k));
    ropes.push(withOrder(stick([x + 2.2, y + 1.2, .9], [x + 4.8, y + 1.2, .9], .05, 4), k), withOrder(stick([x + 2.2, y + 1.2, -.9], [x + 4.8, y + 1.2, -.9], .05, 4), k));
  }
  for (const gx of GUN_X) {
    const k = (gx + 760) / 1520, y = groundH(gx, 0);
    guns.push(withOrder(stick([gx, y + 1.0, 1.4], [gx, y + 1.05, -1.6], .26, 10), k));
    wood.push(withOrder(blk(1.2, .5, 2.4, gx, y + .55, .6), k), withOrder(blk(1.8, 1.9, .25, gx - 3.2, y + .95, -1.3), k), withOrder(blk(1.8, 1.9, .25, gx + 3.2, y + .95, -1.3), k));
    for (const s of [-1, 1]) wheels.push(withOrder((() => { const w = new T.CylinderGeometry(.6, .6, .15, 12); w.rotateZ(Math.PI / 2); w.translate(gx + s * .7, y + .6, .5); return w; })(), k));
  }
  const nmat = wrap(new T.MeshNormalMaterial({ side: T.DoubleSide }), "n");
  const make = (list, fam, color, key) => { const m = mesh(mergeGeometries(list, false), wrap(toon(U, fam, { color }), key)); m.userData.nmat = nmat; m.customDepthMaterial = wrap(new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking }), key + "d"); ctx.track(m.material); return m; };
  return [make(wood, "body", "cart", "w"), make(wheels, "dark", "wheel", "h"), make(guns, "dark", "metal", "g"), make(ropes, "mark", "rope", "r")];
}

/* ----- smoke, dust, cannon shot and arrows (transparent, drawn after the ink pass) ----- */
const PUFF_VERT = `
${GLSL_GROUND}
attribute vec3 aOrigin; attribute vec3 aDir; attribute vec2 aInfo;
uniform float uFilm, uTime; uniform vec4 uA[${NU}], uB[${NU}];
varying vec3 vN; varying float vA; varying float vFlash;
void main(){
  vec3 c; float size, alpha;
  if (aInfo.y < 1.5) {
    float age = uFilm - aInfo.x, kind = aInfo.y, life = mix(6.0, 9.0, kind);
    if (age < 0.0 || age > life) { gl_Position = vec4(2.0); return; }
    float k = age / life, burst = 1.0 - exp(-age * 4.0);
    c = aOrigin + vec3(aDir.x * 2.5, abs(aDir.y) * 1.5 + 0.6, -abs(aDir.z) * mix(9.0, 22.0, kind)) * burst * mix(1.0, 1.6, kind) + aDir * (2.0 + 9.0 * k) + vec3(3.0, 1.4, 1.2) * age;
    size = mix(1.4, 4.6, sqrt(k)) * mix(1.0, 1.4, kind);
    alpha = (1.0 - k) * 0.85; vFlash = 1.0 - smoothstep(0.0, 0.15, age);
  } else {
    int u = int(aInfo.x + 0.5); vec4 A = uA[u], B = uB[u];
    float k = fract(uTime * 0.22 + aDir.z * 5.0);
    alpha = A.w * smoothstep(0.4, 1.6, B.z) * sin(k * 3.1416) * 0.55;
    if (alpha < 0.01) { gl_Position = vec4(2.0); return; }
    vec2 f = vec2(sin(A.z), cos(A.z)), r = vec2(cos(A.z), -sin(A.z));
    vec2 xz = A.xy + r * (aDir.x * B.x * 1.1) - f * (aDir.y * B.y * 1.3 + B.y * 0.6 + k * 30.0);
    c = vec3(xz.x, groundH(xz) + 1.0 + k * 7.0, xz.y); size = 4.0 + k * 9.0; vFlash = 0.0;
  }
  vN = normalize(normalMatrix * normal); vA = alpha;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(c + position * size, 1.0);
}`;
const PUFF_FRAG = `
uniform vec3 uSmoke, uInk, uFlashC; uniform vec3 uLight;
varying vec3 vN; varying float vA; varying float vFlash;
void main(){
  float l = clamp(dot(normalize(vN), uLight), 0.0, 1.0), rim = 1.0 - abs(normalize(vN).z);
  vec3 col = mix(uSmoke * 0.78, uSmoke, smoothstep(0.1, 0.8, l));
  col = mix(col, uInk, smoothstep(0.62, 0.95, rim) * 0.5);
  col = mix(col, uFlashC, vFlash);
  gl_FragColor = vec4(col, vA * (1.0 - smoothstep(0.85, 1.0, rim) * 0.6));
}`;
function buildPuffs(ctx) {
  const r = rng(77), O = [], D = [], I = [];
  for (const [t, kind] of VOLLEYS) {
    if (kind === "m") for (let x = -720; x <= 720; x += 22) for (let i = 0; i < 2; i++) { const xx = x + (r() - .5) * 12; O.push(xx, groundH(xx, 0) + 1.5, -1.8); D.push(r() - .5, r() - .5, r() - .5); I.push(t + r() * .3, 0); }
    else for (const gx of GUN_X) for (let i = 0; i < 6; i++) { O.push(gx, groundH(gx, 0) + 1.1, -2); D.push(r() - .5, r() - .5, r() - .5); I.push(t + r() * .25 + (gx + 700) / 7000, 1); }
  }
  UNITS.forEach((u, ui) => { if (u.type === "cav" || u.type === "ele") for (let i = 0; i < 90; i++) { O.push(0, 0, 0); D.push(r() - .5, r() - .5, r()); I.push(ui, 2); } });
  const base = new T.IcosahedronGeometry(1, 1), g = new T.InstancedBufferGeometry();
  g.setAttribute("position", base.attributes.position); g.setAttribute("normal", base.attributes.normal); g.setIndex(base.index);
  g.setAttribute("aOrigin", new T.InstancedBufferAttribute(new Float32Array(O), 3));
  g.setAttribute("aDir", new T.InstancedBufferAttribute(new Float32Array(D), 3));
  g.setAttribute("aInfo", new T.InstancedBufferAttribute(new Float32Array(I), 2));
  g.instanceCount = I.length / 2;
  const m = ctx.track(new T.ShaderMaterial({
    uniforms: { ...ctx.figU, uFilm: ctx.sceneU.uFilm, uSmoke: ctx.U.foam, uInk: ctx.U.ink, uFlashC: { value: new T.Color(1, .82, .45) }, uLight: { value: new T.Vector3(.4, .8, .45).normalize() } },
    vertexShader: PUFF_VERT, fragmentShader: PUFF_FRAG, transparent: true, depthWrite: false
  }));
  const p = new T.Mesh(g, m); p.frustumCulled = false; p.layers.set(1); p.renderOrder = 5;
  return p;
}
const STICK_VERT = `
${GLSL_GROUND}
attribute vec4 aPair; attribute vec2 aShot;
uniform float uTime, uArrows, uFilm; uniform vec4 uA[${NU}], uB[${NU}];
varying float vA;
void main(){
  vec3 a3, b3; float k, alpha, arc;
  if (aShot.x > 0.0) {
    float age = uFilm - aShot.x; k = age / 0.9; alpha = step(0.0, age) * step(age, 0.9);
    a3 = vec3(aPair.x, groundH(aPair.xy) + 1.1, -2.0); b3 = vec3(aPair.x + (aPair.z - 0.5) * 60.0, 0.0, -aPair.w);
    b3.y = groundH(b3.xz) + 1.0; arc = 14.0;
  } else {
    int s = int(aPair.x + 0.5), d = int(aPair.y + 0.5);
    k = fract(uTime * 0.55 + aPair.z * 7.0);
    alpha = uArrows * step(0.5, min(uA[s].w, uA[d].w)) * step(0.06, k) * step(k, 0.94);
    vec2 o1 = vec2(fract(aPair.z * 13.1) - 0.5, fract(aPair.z * 29.7) - 0.5), o2 = vec2(fract(aPair.z * 51.3) - 0.5, fract(aPair.z * 71.9) - 0.5);
    vec2 a = uA[s].xy + o1 * uB[s].xy, b = uA[d].xy + o2 * uB[d].xy * 0.8;
    a3 = vec3(a.x, groundH(a) + 2.5, a.y); b3 = vec3(b.x, groundH(b) + 1.5, b.y); arc = length(b - a) * 0.22;
  }
  if (alpha < 0.5) { gl_Position = vec4(2.0); vA = 0.0; return; }
  vec3 pk = mix(a3, b3, k); pk.y += arc * 4.0 * k * (1.0 - k);
  vec3 tg = normalize(b3 - a3 + vec3(0.0, arc * 4.0 * (1.0 - 2.0 * k), 0.0));
  vec3 side = normalize(cross(tg, vec3(0.0, 1.0, 0.0))), up = cross(side, tg);
  vec3 p = pk + tg * position.z + side * position.x + up * position.y;
  vA = 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
function buildSticks(ctx) {
  const r = rng(9), P = [], S = [];
  const pairs = [["bTulR", "lLeft"], ["bTulR", "lRear"], ["bTulL", "lRight"], ["bTulL", "lRear"], ["bRight", "lLeft"], ["bLeft", "lRight"], ["bTulR", "lCentre"], ["bTulL", "lCentre"]];
  for (const [s, d] of pairs) for (let i = 0; i < 260; i++) { P.push(UNIT_INDEX[s], UNIT_INDEX[d], r(), 0); S.push(0, 0); }
  for (const [t, kind] of VOLLEYS) if (kind === "g") for (const gx of GUN_X) { P.push(gx, 0, r(), 260 + r() * 160); S.push(t + (gx + 700) / 7000, 1); }
  const base = new T.BoxGeometry(.1, .1, 2.2), g = new T.InstancedBufferGeometry();
  g.setAttribute("position", base.attributes.position); g.setIndex(base.index);
  g.setAttribute("aPair", new T.InstancedBufferAttribute(new Float32Array(P), 4));
  g.setAttribute("aShot", new T.InstancedBufferAttribute(new Float32Array(S), 2));
  g.instanceCount = S.length / 2;
  const m = ctx.track(new T.ShaderMaterial({ uniforms: { ...ctx.figU, uArrows: ctx.sceneU.uArrows, uFilm: ctx.sceneU.uFilm, uC: ctx.U.ink }, vertexShader: STICK_VERT, fragmentShader: "uniform vec3 uC; varying float vA; void main(){ gl_FragColor = vec4(uC, vA); }" }));
  const p = new T.Mesh(g, m); p.frustumCulled = false; p.layers.set(1); p.renderOrder = 6;
  return p;
}
// the fallen: bodies that stay where they fell, appearing as casualties mount
function buildFallen(ctx) {
  const r = rng(41), P = [];
  const blob = (cx, cz, rx, rz, n, t0, t1) => { for (let i = 0; i < n; i++) { const a = r() * 6.28, q = Math.sqrt(r()); P.push(cx + Math.cos(a) * rx * q, cz + Math.sin(a) * rz * q, r() * 6.28, lerp(t0, t1, r())); } };
  blob(0, -150, 560, 70, 380, 0, .3); blob(0, -330, 420, 160, 900, .15, .8); blob(-480, -340, 160, 140, 260, .3, .9); blob(480, -340, 160, 140, 260, .3, .9); blob(0, -560, 380, 90, 260, .4, .95); blob(0, -800, 450, 260, 200, .85, 1);
  const parts = figureParts("inf"), geo = mergeGeometries(Object.values(parts), false);
  geo.rotateZ(Math.PI / 2 * .97); geo.translate(.9, .12, 0); geo.scale(FIG_SCALE, FIG_SCALE, FIG_SCALE);
  const g = new T.InstancedBufferGeometry();
  g.setAttribute("position", geo.attributes.position); g.setAttribute("normal", geo.attributes.normal);
  g.setAttribute("aBody", new T.InstancedBufferAttribute(new Float32Array(P), 4));
  g.instanceCount = P.length / 4;
  const inject = sh => {
    Object.assign(sh.uniforms, { uFallen: ctx.sceneU.uFallen });
    sh.vertexShader = sh.vertexShader.replace("#include <common>", `#include <common>\nattribute vec4 aBody; uniform float uFallen;\n${GLSL_GROUND}\nvec2 rotB(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }`)
      .replace("#include <beginnormal_vertex>", "#include <beginnormal_vertex>\nobjectNormal.xz = rotB(objectNormal.xz, aBody.z);")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\ntransformed.xz = rotB(transformed.xz, aBody.z); transformed += vec3(aBody.x, groundH(aBody.xy), aBody.y); if (aBody.w > uFallen) transformed.y -= 900.0;");
  };
  const wrap = (m, key) => { const prev = m.onBeforeCompile; m.onBeforeCompile = (sh, rr) => { if (prev) prev.call(m, sh, rr); inject(sh); }; const pk = m.customProgramCacheKey && m.customProgramCacheKey.bind(m); m.customProgramCacheKey = () => "fallen:" + key + (pk ? pk() : ""); return m; };
  const m = mesh(g, wrap(toon(ctx.U, "body", { color: "lodiFallen", forcePaint: true }), "c"), false, true);
  m.userData.nmat = wrap(new T.MeshNormalMaterial(), "n");
  m.frustumCulled = false; ctx.track(m.material);
  return m;
}
// movement arrows on the ground
function buildRibbons(ctx) {
  const out = [];
  for (const [key, pts] of RIBBONS) {
    const curve = new T.CatmullRomCurve3(pts.map(([x, z]) => new T.Vector3(x, 0, z)), false, "centripetal");
    const N = 120, W = 11, P = [], UV = [], idx = [], len = curve.getLength();
    for (let i = 0; i <= N; i++) {
      const k = i / N, p = curve.getPointAt(Math.min(k, .999)), tg = curve.getTangentAt(Math.min(k, .999)), nx = -tg.z, nz = tg.x, w = k > .92 ? W * 2.8 * (1 - k) / .08 : W;
      for (const s of [-1, 1]) { const x = p.x + nx * w * s, z = p.z + nz * w * s; P.push(x, groundH(x, z) + 1.2, z); UV.push(k * len, s); }
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new T.BufferGeometry; g.setAttribute("position", new T.Float32BufferAttribute(P, 3)); g.setAttribute("uv", new T.Float32BufferAttribute(UV, 2)); g.setIndex(idx);
    const col = key === "ribTul" ? ctx.U.baburC : ctx.U.lodiC;
    const m = ctx.track(new T.ShaderMaterial({
      uniforms: { uC: col, uInk: ctx.U.ink, uA: { value: 0 }, uTime: ctx.figU.uTime }, transparent: true, depthWrite: false, side: T.DoubleSide,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 uC, uInk; uniform float uA, uTime; varying vec2 vUv;
        void main(){ float d = fract(vUv.x / 46.0 - uTime * 0.5); float dash = smoothstep(0.0, 0.06, d) * smoothstep(0.72, 0.62, d);
          float edge = smoothstep(0.78, 0.92, abs(vUv.y)); float a = uA * mix(0.55 + 0.45 * dash, 0.95, edge) * smoothstep(0.0, 40.0, vUv.x);
          if (a < 0.01) discard; gl_FragColor = vec4(mix(uC, uInk, edge * 0.6), a); }`
    }));
    const mesh_ = new T.Mesh(g, m); mesh_.frustumCulled = false; mesh_.layers.set(1); mesh_.renderOrder = 3; mesh_.userData.key = key;
    out.push(mesh_);
  }
  return out;
}
// the sultan's parasol, which falls with him
function buildParasol(ctx) {
  const g = new T.Group, pole = mesh(stick([0, 0, 0], [0, 9, 0], .12, 6), ctx.mat("dark", "trunk")), canopy = mesh((() => { const c = new T.ConeGeometry(3.4, 1.6, 14, 1, true); c.translate(0, 9.4, 0); return c; })(), toon(ctx.U, "mark", { color: "parasol", side: T.DoubleSide, forcePaint: true }));
  ctx.track(canopy.material);
  g.add(pole, canopy);
  return g;
}
