/* ---------- the diorama figure: renderer, camera, film, labels, controls ---------- */
const PAINT_LIST = [
  ["babur", "Babur's army", "#3f8ad0"], ["lodi", "Lodi's army", "#c9532a"], ["lodiFallen", "The fallen", "#7d3b27"],
  ["skin", "Faces", "#b98a66"], ["metal", "Weapons and guns", "#4d5258"], ["horse", "Babur's horses", "#b9ab95"], ["horseL", "Lodi's horses", "#7d5236"], ["elephant", "Elephants", "#8d8984"], ["parasol", "Royal parasol", "#e0b43c"],
  ["soil", "Plain", "#cdbd96"], ["earth", "Cut earth", "#9a7b5a"], ["field", "Green fields", "#a8b676"], ["field2", "Ripe fields", "#d2bd7c"], ["road", "Road", "#e2d3ad"],
  ["house", "Houses", "#d9c5a2"], ["townWall", "Town wall", "#c4a77f"], ["ditch", "Ditch", "#6b5a46"], ["trunk", "Trunks and logs", "#6b5238"], ["foliage", "Trees", "#6f8f4a"],
  ["cart", "Carts", "#9a7448"], ["wheel", "Wheels", "#4f3d2c"], ["rope", "Ropes", "#cdb98c"]
];
const PAINTS = Object.fromEntries(PAINT_LIST.map(([k, , c]) => [k, c]));
function themeValues(id) {
  const e = THEMES.find(t => t.id === id) || THEMES[0];
  return { bg: e.bg, ink: e.ink, bodyLo: e.body[0], bodyHi: e.body[1], deckLo: e.deck[0], deckHi: e.deck[1], darkLo: e.dark[0], darkHi: e.dark[1], mark: e.mark, glow: e.glow, shadow: e.shadow, foam: e.foam, wave: e.wave, inkStrength: e.inkA, paint: !!e.colour };
}
const DEFAULTS = {
  theme: "colour", ...themeValues("colour"), ...PAINTS,
  play: true, speed: 1, start: "0", filmCamera: true, labels: true, captions: true, arrows: true, gait: true,
  lineWidth: 1.1, sunFrom: 320, sunHeight: 42, ambient: .3
};
function coerce(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (!(k in DEFAULTS) || v == null) continue;
    const d = DEFAULTS[k];
    out[k] = typeof d === "boolean" ? (v === true || v === "true" || v === "" || v === "on") : typeof d === "number" ? (Number.isFinite(Number(v)) ? Number(v) : d) : String(v);
  }
  return out;
}
function mergeValues(cur, raw) {
  const t = coerce(raw), n = { ...cur };
  if ("theme" in t && THEMES.some(e => e.id === t.theme)) Object.assign(n, themeValues(t.theme));
  return Object.assign(n, t);
}
const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
const CAPTIONS = CHAPTERS.flatMap(c => (c.cap || []).map(([t, title, line]) => ({ t: c.t0 + t, n: c.n, chapter: c.name, title, line })));
function readable(bg, ink) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) || 0), b = p(bg), k = p(ink), dark = (b[0] + b[1] + b[2]) / 3 < 115, to = dark ? 255 : 0, amt = dark ? .55 : .35;
  return `rgb(${k.map(v => Math.round(v + (to - v) * amt)).join(",")})`;
}

function createPanipatDiorama(host, initial = {}, hooks = {}) {
  let values = mergeValues(DEFAULTS, initial);
  const U = makeUniforms();
  U.baburC = { value: new T.Color }; U.lodiC = { value: new T.Color };
  const registry = new Map, isHex = v => typeof v === "string" && v[0] === "#";
  function paint(key, f) {
    const out = new T.Color;
    if (isHex(key)) return f(key, out);
    if (!(key in PAINTS)) throw new Error(`[panipat] no paint "${key}"`);
    f(values[key], out);
    if (!registry.has(key)) registry.set(key, []);
    registry.get(key).push({ out, f });
    return out;
  }
  U.pal = { color: k => paint(k, (h, o) => hexTo(h, o)), shade: k => paint(k, (h, o) => shadeOf(h, .62, o)), hex: k => isHex(k) ? k : values[k] };

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none;cursor:grab";
  host.appendChild(canvas);
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: !!hooks.preserve, powerPreference: "high-performance" });
  renderer.outputColorSpace = T.LinearSRGBColorSpace; renderer.toneMapping = T.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFShadowMap;
  const scene = new T.Scene, world = new T.Group;
  world.scale.x = -1;          // data runs x = east, z = north; mirroring gives a true map in a right-handed scene
  scene.add(world);
  const sun = new T.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  const smap = Math.min(4096, renderer.capabilities.maxTextureSize);
  sun.shadow.mapSize.set(smap, smap); sun.shadow.bias = -4e-4; sun.shadow.radius = 2;
  const fill = new T.DirectionalLight(0xffffff, 1);
  scene.add(sun, sun.target, fill, fill.target);
  const base = new T.Mesh(new T.PlaneGeometry(40000, 40000), groundMaterial(U));
  base.rotation.x = -Math.PI / 2; base.position.y = SLAB.base; base.receiveShadow = true;
  scene.add(base);

  const tracked = [], track = m => (tracked.push(m), m), cache = new Map;
  const uA = new Float32Array(NU * 4), uB = new Float32Array(NU * 4), uC = new Float32Array(NU * 4);
  const figU = { uA: { value: uA }, uB: { value: uB }, uC: { value: uC }, uTime: { value: 0 }, uGait: { value: 1 }, uFig: { value: FIG_SCALE } };
  const sceneU = { uFilm: { value: 0 }, uCarts: { value: 0 }, uArrows: { value: 0 }, uFallen: { value: 0 } };
  const ctx = {
    U, figU, sceneU, track, count: 0,
    mat: (fam, color) => { const k = fam + "|" + color; if (!cache.has(k)) cache.set(k, track(toon(U, fam, { color }))); return cache.get(k); }
  };
  let armies, terrain, carts, puffs, sticks, fallen, ribbons, parasol;
  rawColour(() => {
    terrain = buildTerrain(ctx); armies = buildArmies(ctx); carts = buildCarts(ctx);
    puffs = buildPuffs(ctx); sticks = buildSticks(ctx); fallen = buildFallen(ctx); ribbons = buildRibbons(ctx); parasol = buildParasol(ctx);
  });
  world.add(terrain, ...armies, ...carts, fallen, parasol, puffs, sticks, ...ribbons);

  // ink lines: render normals and depth, then draw ink where either jumps
  const rtColour = new T.WebGLRenderTarget(4, 4, { depthBuffer: true }), rtNormal = new T.WebGLRenderTarget(4, 4, { depthBuffer: true });
  rtNormal.depthTexture = new T.DepthTexture(4, 4, T.FloatType);
  const normalMat = new T.MeshNormalMaterial({ side: T.DoubleSide });
  const comp = new T.ShaderMaterial({
    uniforms: { tColor: { value: rtColour.texture }, tNormal: { value: rtNormal.texture }, tDepth: { value: rtNormal.depthTexture }, uTexel: { value: new T.Vector2 }, uNear: { value: 1 }, uFar: { value: 4000 }, uPx: { value: .1 }, uInk: U.ink, uInkA: { value: .8 }, uLW: { value: 1 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      uniform sampler2D tColor, tNormal, tDepth; uniform vec2 uTexel; uniform float uNear, uFar, uPx, uInkA, uLW; uniform vec3 uInk;
      varying vec2 vUv;
      float D(vec2 uv){ return uNear + texture2D(tDepth, uv).x * (uFar - uNear); }
      vec3 N(vec2 uv){ return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
      float edgeAt(vec2 uv, vec2 o){
        float dc = D(uv), dl = D(uv - vec2(o.x, 0.0)), dr = D(uv + vec2(o.x, 0.0)), du = D(uv + vec2(0.0, o.y)), dd = D(uv - vec2(0.0, o.y));
        float lap = max(abs(dl + dr - 2.0 * dc), abs(du + dd - 2.0 * dc));
        float th = max(0.02, uPx * 2.2);
        float eD = smoothstep(th, th * 1.8, lap);
        vec3 nc = N(uv);
        float dn = max(max(1.0 - dot(nc, N(uv - vec2(o.x, 0.0))), 1.0 - dot(nc, N(uv + vec2(o.x, 0.0)))), max(1.0 - dot(nc, N(uv + vec2(0.0, o.y))), 1.0 - dot(nc, N(uv - vec2(0.0, o.y)))));
        return max(eD, smoothstep(0.22, 0.40, dn));
      }
      void main(){ vec3 col = texture2D(tColor, vUv).rgb; vec2 o = uTexel * uLW; float e = uLW > 0.0 ? edgeAt(vUv, o) : 0.0; gl_FragColor = vec4(mix(col, uInk, e * uInkA), 1.0); }`,
    depthTest: false, depthWrite: false
  });
  const compScene = new T.Scene, compCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  compScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), comp));
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 10000);

  function applyColours() {
    for (const k of ["bodyLo", "bodyHi", "deckLo", "deckHi", "darkLo", "darkHi", "ink", "mark", "glow", "bg", "shadow", "foam", "wave"]) hexTo(values[k], U[k].value);
    U.markHi.value.copy(U.mark.value); U.markLo.value.copy(U.mark.value).lerp(U.bodyLo.value, .4);
    comp.uniforms.uInkA.value = values.inkStrength;
    U.cmix.value = values.paint ? 1 : 0;
    for (const [k, list] of registry) for (const e of list) e.f(values[k], e.out);
    hexTo(values.babur, U.baburC.value); hexTo(values.lodi, U.lodiC.value);
    U.ambient.value = values.ambient;
    figU.uGait.value = values.gait ? 1 : 0;
  }

  let W = 1, H = 1, pw = 4, ph = 4, dpr = 2, quality = 1;
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.max(1.5, Math.min(window.devicePixelRatio || 1, 2)) * quality;
    const cap = 3200 * 2000; if (W * H * dpr * dpr > cap) dpr = Math.sqrt(cap / (W * H));
    pw = Math.round(W * dpr); ph = Math.round(H * dpr);
    renderer.setPixelRatio(1); renderer.setSize(pw, ph, false);
    rtColour.setSize(pw, ph); rtNormal.setSize(pw, ph);
    comp.uniforms.uTexel.value.set(1 / pw, 1 / ph);
  }

  const P = { camX: 0, camZ: -500, dist: 3600, az: 200, el: 52 };
  let film = hooks.film ?? values.filmCamera, filmBlend = null;
  const startClock = () => CHAPTERS[clamp(Math.round(Number(values.start) || 0), 0, CHAPTERS.length - 1)].t0 + .001;
  let clock = hooks.t ?? startClock(), wall = 0, paused = !!hooks.paused || !values.play, S = filmState(clock), chapter = -1, jump = null;
  const units = UNITS.map(() => null), portrait = () => W / H < .9;
  const ibrahimPos = () => { const u = units[UNIT_INDEX.lCentre]; return [u.x + 30, u.z - u.d * .25]; };

  function tick(dt) {
    wall += dt;
    if (!paused) clock = (clock + dt * values.speed) % FILM_LEN;
    const s = filmState(clock);
    if (jump) {
      const k = smoother((wall - jump.t0) / 1.6), f = jump.from;
      for (const key of ["camX", "camZ", "dist", "el"]) s[key] = lerp(f[key], s[key], k);
      s.az = angLerp(f.az, s.az, k);
      if (k >= 1) jump = null;
    }
    S = s;
    if (S.chapter !== chapter) { chapter = S.chapter; hooks.onChapter && hooks.onChapter(chapter); }
    UNITS.forEach((u, i) => {
      const o = unitAt(u, clock);
      if (o.mv > .01) { const n = unitAt(u, clock + .25), dx = n.x - o.x, dz = n.z - o.z; if (dx * dx + dz * dz > .01) o.h = angLerp(o.h, Math.atan2(dx, dz) / DEG, o.mv); }
      units[i] = o;
      uA.set([o.x, o.z, o.h * DEG, o.a], i * 4); uB.set([o.w, o.d, o.pace, o.chaos], i * 4); uC.set([o.loss, u.side, 0, 0], i * 4);
    });
    figU.uTime.value = wall;
    sceneU.uFilm.value = clock; sceneU.uCarts.value = S.carts * 1.02 - .01; sceneU.uArrows.value = S.arrows; sceneU.uFallen.value = S.fallen;
    terrain.visible = true;
    for (const r of ribbons) r.material.uniforms.uA.value = values.arrows ? S[r.userData.key] * .8 : 0;
    const lc = units[UNIT_INDEX.lCentre], [ix, iz] = ibrahimPos();
    parasol.position.set(ix, groundH(ix, iz), iz);
    parasol.visible = lc.a > .5 && S.reveal > .5;
    parasol.rotation.z = smoother(S.ibrahim) * 1.35;
    if (film) {
      let { camX, camZ, dist, az, el } = S;
      if (portrait()) dist *= 1.6;
      if (filmBlend) {
        const k = smoother((wall - filmBlend.t0) / 1.4), f = filmBlend;
        camX = lerp(f.camX, camX, k); camZ = lerp(f.camZ, camZ, k); dist = lerp(f.dist, dist, k); az = angLerp(f.az, az, k); el = lerp(f.el, el, k);
        if (k >= 1) filmBlend = null;
      }
      Object.assign(P, { camX, camZ, dist, az, el });
    }
  }
  let halfH = 100;
  function place() {
    const a = P.az * DEG, e = clamp(P.el, 4, 89) * DEG, ty = groundH(P.camX, P.camZ);
    const dir = new T.Vector3(-Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a));
    const tgt = new T.Vector3(-P.camX, ty, P.camZ);
    camera.position.copy(tgt).addScaledVector(dir, 5000);
    camera.up.set(0, 1, 0); camera.lookAt(tgt);
    halfH = P.dist * Math.tan(15 * DEG) * 1.15;
    const asp = W / H;
    Object.assign(camera, { left: -halfH * asp, right: halfH * asp, top: halfH, bottom: -halfH, near: 5000 - P.dist * 2.2 - 800, far: 5000 + P.dist * 2.2 + 800 });
    camera.near = Math.max(1, camera.near);
    camera.updateProjectionMatrix();
    comp.uniforms.uNear.value = camera.near; comp.uniforms.uFar.value = camera.far;
    comp.uniforms.uPx.value = 2 * halfH / ph; comp.uniforms.uLW.value = values.lineWidth * dpr * .5;
    // the shadow map follows the view so close-ups get crisp shadows
    const sa = values.sunFrom * DEG, sh = clamp(values.sunHeight, 5, 89) * DEG;
    const sd = new T.Vector3(-Math.cos(sh) * Math.cos(sa), Math.sin(sh), Math.cos(sh) * Math.sin(sa));
    const ext = Math.min(2600, halfH * Math.max(asp, 1) * 1.25);
    sun.position.copy(tgt).addScaledVector(sd, 6000); sun.target.position.copy(tgt);
    Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 6000 - ext * 2 - 200, far: 6000 + ext * 2 + 200 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.normalBias = ext / smap * 1.2;
    fill.position.copy(tgt).addScaledVector(new T.Vector3(-sd.x, .45, -sd.z).normalize(), 3000); fill.target.position.copy(tgt);
  }
  const swapped = [];
  function render() {
    place();
    camera.layers.set(0);
    scene.traverseVisible(o => { if (o.isMesh && o.layers.mask & 1 && o !== base) { swapped.push(o, o.material); o.material = o.userData.nmat || normalMat; } });
    base.visible = false;
    renderer.setRenderTarget(rtNormal); renderer.setClearColor(0x8080ff, 1); renderer.clear(); renderer.render(scene, camera);
    base.visible = true;
    for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
    swapped.length = 0;
    camera.layers.enable(1);
    renderer.setClearColor(U.bg.value, 1); renderer.setRenderTarget(rtColour); renderer.clear(); renderer.render(scene, camera);
    renderer.setRenderTarget(null); renderer.render(compScene, compCam);
  }

  /* captions and labels */
  const ui = document.createElement("div");
  ui.style.cssText = `position:absolute;inset:0;pointer-events:none;font-family:${MONO};overflow:hidden`;
  const cap = document.createElement("div");
  cap.style.cssText = "position:absolute;left:20px;bottom:24px;max-width:min(540px,calc(100% - 40px));opacity:0;transform:translateY(6px);transition:opacity .6s,transform .6s";
  cap.innerHTML = '<span style="display:block;font-size:10px;letter-spacing:.16em;margin-bottom:6px"></span><b style="display:block;font-size:22px;font-weight:600;letter-spacing:.08em;line-height:1.15"></b><p style="margin:7px 0 0;font-size:12px;line-height:1.55;letter-spacing:.02em;opacity:.78"></p>';
  const [capN, capT, capL] = cap.children;
  const lab = document.createElement("div"); lab.style.cssText = "position:absolute;inset:0";
  ui.append(lab, cap); host.appendChild(ui);
  const labelEls = LABELS.map(() => {
    const d = document.createElement("div");
    d.style.cssText = "position:absolute;left:0;top:0;white-space:nowrap;transition:opacity .4s;opacity:0";
    d.innerHTML = '<i style="position:absolute;left:-3px;bottom:-3px;width:6px;height:6px;border-radius:50%"></i><i style="position:absolute;left:0;bottom:3px;width:1px;height:34px"></i><b style="position:absolute;left:8px;bottom:30px;font-size:11px;letter-spacing:.14em;font-weight:600"></b><span style="position:absolute;left:8px;bottom:17px;font-size:10px;letter-spacing:.06em"></span>';
    lab.appendChild(d);
    return d;
  });
  const v3 = new T.Vector3;
  let styleKey = "";
  function overlay() {
    const text = readable(values.bg, values.ink), halo = `0 0 6px ${values.bg}, 0 0 2px ${values.bg}, 0 0 1px ${values.bg}`, key = values.bg + values.ink + values.babur + values.lodi;
    if (key !== styleKey) {
      styleKey = key;
      cap.style.color = text; capN.style.color = values.glow;
      for (const el of [capN, capT, capL]) el.style.textShadow = halo;
      for (const el of labelEls) { el.style.textShadow = halo; el.dataset.k = ""; }
    }
    const t = clock;
    LABELS.forEach(([t0, t1, txt, sub, anchor], i) => {
      const el = labelEls[i];
      let on = values.labels && t >= t0 && t <= t1, x, z, side = -1;
      if (anchor === "ibrahim") { [x, z] = ibrahimPos(); side = 1; }
      else if (typeof anchor === "string") { const u = units[UNIT_INDEX[anchor]]; x = u.x; z = u.z; side = UNITS[UNIT_INDEX[anchor]].side; on = on && u.a > .2; }
      else [x, z] = anchor;
      if (!on) { el.style.opacity = "0"; return; }
      v3.set(-x, groundH(x, z) + 6, z).project(camera);
      const px = (v3.x * .5 + .5) * W, py = (-v3.y * .5 + .5) * H;
      if (px < -50 || px > W + 50 || py < -50 || py > H + 50) { el.style.opacity = "0"; return; }
      const col = side === 0 ? values.babur : side === 1 ? values.lodi : text;
      if (el.dataset.k !== txt + sub + col) {
        el.dataset.k = txt + sub + col;
        el.children[0].style.background = col; el.children[1].style.background = values.ink;
        el.children[2].textContent = txt; el.children[2].style.color = col; el.children[3].textContent = sub; el.children[3].style.color = text;
      }
      el.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`; el.style.opacity = "1";
    });
    let cur = null;
    if (values.captions) { for (const c of CAPTIONS) if (c.t <= t + .001) cur = c; if (cur && t - cur.t > 7.5) cur = null; }
    const k = cur ? cur.t + cur.title : "";
    if (cap.dataset.k !== k) { cap.dataset.k = k; if (cur) { capN.textContent = `${String(cur.n).padStart(2, "0")} · ${cur.chapter.toUpperCase()}`; capT.textContent = cur.title; capL.textContent = cur.line; } }
    cap.style.opacity = cur ? "1" : "0"; cap.style.transform = cur ? "none" : "translateY(6px)";
  }

  /* pointer */
  let drag = null;
  const setFilm = on => { if (on === film) return; film = on; filmBlend = on ? { ...P, t0: wall } : null; hooks.onFilm && hooks.onFilm(film); };
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, P: { ...P }, pan: e.shiftKey || e.button !== 0, moved: false }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; });
  canvas.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 3) { drag.moved = true; setFilm(false); }
    if (!drag.moved) return;
    if (drag.pan) { const k = 2 * halfH / H, a = P.az * DEG; P.camX = drag.P.camX + (dx * Math.cos(a) - dy * Math.sin(a) / Math.max(.3, Math.sin(P.el * DEG))) * k; P.camZ = drag.P.camZ + (dx * Math.sin(a) + dy * Math.cos(a) / Math.max(.3, Math.sin(P.el * DEG))) * k; }
    else { P.az = drag.P.az + dx * .3; P.el = clamp(drag.P.el + dy * .2, 5, 88); }
  });
  const end = () => { drag = null; canvas.style.cursor = "grab"; };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("wheel", e => { e.preventDefault(); setFilm(false); P.dist = clamp(P.dist * Math.exp(e.deltaY * .0012), 40, 7000); }, { passive: false });
  canvas.addEventListener("dblclick", () => setFilm(true));

  let raf = 0, last = performance.now(), avg = 1 / 60, slow = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (document.hidden) return;
    avg = avg * .95 + dt * .05;
    if (++slow > 90 && avg > .034 && quality > .55) { quality -= .15; slow = 0; resize(); }
    tick(dt); render(); overlay();
    hooks.onFrame && hooks.onFrame(S, status());
  }
  function status() {
    const ch = CHAPTERS[S.chapter], m = Math.floor(clock / 60), s = Math.floor(clock % 60);
    return `${String(ch.n).padStart(2, "0")} · ${ch.name.toUpperCase()} · ${m}:${String(s).padStart(2, "0")} / ${Math.floor(FILM_LEN / 60)}:${String(Math.round(FILM_LEN % 60)).padStart(2, "0")}`;
  }
  const ro = new ResizeObserver(() => { resize(); if (paused || hooks.manual) { render(); overlay(); } }); ro.observe(host);
  const api = {
    get values() { return values; }, get state() { return S; }, get clock() { return clock; }, get paused() { return paused; }, get film() { return film; },
    chapters: CHAPTERS, themes: THEMES, paints: PAINT_LIST, figures: ctx.count, status,
    set(raw) {
      const prev = values; values = mergeValues(values, raw);
      applyColours();
      if (values.filmCamera !== prev.filmCamera) setFilm(values.filmCamera);
      if (values.play !== prev.play) paused = !values.play;
      if (values.start !== prev.start) api.phase(Number(values.start) || 0);
      if (paused || hooks.manual) { tick(0); render(); overlay(); }
    },
    phase(i) { jump = { from: { ...S }, t0: wall }; clock = CHAPTERS[clamp(i, 0, CHAPTERS.length - 1)].t0 + .001; if (paused) { paused = false; hooks.onPause && hooks.onPause(false); } setFilm(true); },
    seek(t) { clock = (t % FILM_LEN + FILM_LEN) % FILM_LEN; jump = null; filmBlend = null; tick(0); render(); overlay(); return status(); },
    pause() { paused = true; }, play() { paused = false; last = performance.now(); },
    togglePause() { paused = !paused; last = performance.now(); return paused; },
    setFilm, resetView() { setFilm(true); },
    debug: { renderer, scene, camera, step: dt => { tick(dt); render(); overlay(); } },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); ui.remove(); scene.traverse(o => { o.geometry && o.geometry.dispose(); }); for (const m of tracked) m.dispose && m.dispose(); rtColour.dispose(); rtNormal.dispose(); renderer.dispose(); canvas.remove(); }
  };
  applyColours(); resize(); tick(0); render(); overlay();
  if (!hooks.manual) raf = requestAnimationFrame(loop);
  return api;
}
class PanipatDiorama extends HTMLElement {
  connectedCallback() {
    if (this._f) return;
    if (getComputedStyle(this).position === "static") this.style.position = "relative";
    if (getComputedStyle(this).display === "inline") this.style.display = "block";
    if (this.clientHeight < 2) this.style.height = "min(80vh, 640px)";
    const init = {};
    for (const k of Object.keys(DEFAULTS)) { const a = this.getAttribute(k.toLowerCase()); if (a != null) init[k] = a; }
    this._f = createPanipatDiorama(this, init, { onChapter: i => this.dispatchEvent(new CustomEvent("chapter", { detail: { index: i, name: CHAPTERS[i].name } })) });
    this.dispatchEvent(new CustomEvent("ready"));
  }
  disconnectedCallback() { this._f && this._f.dispose(); this._f = null; }
  get figure() { return this._f; }
}
if (typeof customElements !== "undefined" && !customElements.get("panipat-diorama")) customElements.define("panipat-diorama", PanipatDiorama);
globalThis.PanipatDiorama = { CHAPTERS, UNITS, THEMES, DEFAULTS, PAINTS: PAINT_LIST, createPanipatDiorama };
