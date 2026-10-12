/* ---------- the figure ---------- */
const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace';
const CAPTIONS = CHAPTERS.flatMap(c => (c.cap || []).map(([t, title, line]) => ({ t: c.t0 + t, n: c.n, chapter: c.name, title, line })));
const DEFAULTS = {
  play: true, speed: 1, start: "0", filmCamera: true, labels: true, captions: true, arrows: true,
  babur: "#5fd8ff", lodi: "#ffae4a", bg: "#04060a", gait: true, density: 1
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

function createPanipat(host, initial = {}, hooks = {}) {
  let values = { ...DEFAULTS, ...coerce(initial) };
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none;cursor:grab";
  host.appendChild(canvas);
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: !!hooks.preserve, powerPreference: "high-performance" });
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  const scene = new T.Scene, camera = new T.PerspectiveCamera(30, 1, 1, 20000);

  const uA = new Float32Array(NU * 4), uB = new Float32Array(NU * 4), uC = new Float32Array(NU * 4);
  const colBabur = { value: new T.Color }, colLodi = { value: new T.Color };
  const shared = { uPx: { value: 800 }, uFade: { value: 1 }, uCamDist: { value: 3000 }, uTime: { value: 0 } };
  const armyU = { ...shared, uA: { value: uA }, uB: { value: uB }, uC: { value: uC }, uGait: { value: 1 }, uCol0: colBabur, uCol1: colLodi, uDead: { value: new T.Color(.5, .12, .08) } };
  const sceneU = { ...shared, uFilm: { value: 0 }, uReveal: { value: 0 }, uRevealR: { value: 0 }, uCarts: { value: 0 }, uSmoke: { value: 1 }, uArrows: { value: 0 }, uFallen: { value: 0 } };
  const ctx = { armyU, sceneU, colBabur, colLodi, count: 0 };
  const armies = buildArmies(ctx), scenery = buildScenery(ctx), smoke = buildSmoke(ctx), shot = buildShot(ctx), arrows = buildArrows(ctx), dust = buildDust(ctx), fallen = buildFallen(ctx), ribbons = buildRibbons(ctx), marker = buildMarker(ctx);
  // data coordinates run x = east, z = north; mirroring x gives a true map orientation in a right-handed scene
  const world = new T.Group();
  world.scale.x = -1;
  world.add(...scenery, fallen, ...ribbons, ...armies, dust, smoke, shot, arrows, marker.p);
  scene.add(world);

  function applyColours() {
    const set = (c, h) => { const [r, g, b] = hexRGB(h); c.setRGB(r * .5, g * .5, b * .5); };
    set(colBabur.value, values.babur); set(colLodi.value, values.lodi);
    const [r, g, b] = hexRGB(values.bg); renderer.setClearColor(new T.Color(r, g, b), 1);
    armyU.uGait.value = values.gait ? 1 : 0;
  }

  let W = 1, H = 1, dpr = 1, quality = 1;
  function resize() {
    const rc = host.getBoundingClientRect();
    W = Math.max(1, rc.width); H = Math.max(1, rc.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2) * quality;
    renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
  }

  // camera state: film or free
  const P = { camX: 0, camZ: -500, dist: 3600, az: 200, el: 52 };
  let film = hooks.film ?? values.filmCamera, filmBlend = null;
  const startClock = () => CHAPTERS[clamp(Math.round(Number(values.start) || 0), 0, CHAPTERS.length - 1)].t0 + .001;
  let clock = hooks.t ?? startClock(), wall = 0, paused = !!hooks.paused || !values.play, S = filmState(clock), chapter = -1, jump = null;
  const units = UNITS.map(() => null);
  const portrait = () => W / H < .9;

  function tick(dt) {
    wall += dt;
    if (!paused) clock = (clock + dt * values.speed) % FILM_LEN;
    let s = filmState(clock);
    if (jump) {
      const k = smoother((wall - jump.t0) / 1.6), f = jump.from;
      for (const key of ["camX", "camZ", "dist", "el"]) s[key] = lerp(f[key], s[key], k);
      s.az = angLerp(f.az, s.az, k);
      if (k >= 1) jump = null;
    }
    S = s;
    if (S.chapter !== chapter) { chapter = S.chapter; hooks.onChapter && hooks.onChapter(chapter); }
    // units
    UNITS.forEach((u, i) => {
      const o = unitAt(u, clock);
      if (o.mv > .01) { const n = unitAt(u, clock + .25), dx = n.x - o.x, dz = n.z - o.z; if (dx * dx + dz * dz > .01) o.h = angLerp(o.h, Math.atan2(dx, dz) / DEG, o.mv); }
      units[i] = o;
      uA.set([o.x, o.z, o.h * DEG, o.a], i * 4);
      uB.set([o.w, o.d, o.pace, o.chaos], i * 4);
      uC.set([o.loss, u.side, 0, 0], i * 4);
    });
    shared.uTime.value = wall;
    sceneU.uFilm.value = clock;
    sceneU.uRevealR.value = lerp(0, 4200, smoother(S.reveal));
    sceneU.uCarts.value = S.carts;
    sceneU.uArrows.value = S.arrows;
    sceneU.uFallen.value = S.fallen;
    for (const r of ribbons) r.material.uniforms.uA.value = values.arrows ? S[r.userData.key] * .4 : 0;
    const lc = units[UNIT_INDEX.lCentre], ib = ibrahimPos();
    marker.p.position.set(ib[0], groundH(ib[0], ib[1]), ib[1]);
    marker.u.uA.value = lc.a * (S.ibrahim > .5 ? 1 : .55);
    marker.u.uC.value.setRGB(...(S.ibrahim > .5 ? [1, .25, .15] : [1, .85, .5]));
    if (film) {
      let { camX, camZ, dist, az, el } = S;
      if (portrait()) dist *= 1.5;
      if (filmBlend) {
        const k = smoother((wall - filmBlend.t0) / 1.4), f = filmBlend;
        camX = lerp(f.camX, camX, k); camZ = lerp(f.camZ, camZ, k); dist = lerp(f.dist, dist, k); az = angLerp(f.az, az, k); el = lerp(f.el, el, k);
        if (k >= 1) filmBlend = null;
      }
      Object.assign(P, { camX, camZ, dist, az, el });
    }
  }
  const ibrahimPos = () => { const u = units[UNIT_INDEX.lCentre]; return [u.x + 30, u.z - u.d * .25]; };
  function place() {
    const ty = groundH(P.camX, P.camZ), a = P.az * DEG, e = clamp(P.el, 3, 89) * DEG;
    camera.position.set(-(P.camX + Math.cos(e) * Math.sin(a) * P.dist), ty + Math.sin(e) * P.dist, P.camZ + Math.cos(e) * Math.cos(a) * P.dist);
    camera.lookAt(-P.camX, ty, P.camZ);
    camera.near = Math.max(.5, P.dist * .02); camera.far = P.dist * 4 + 6000;
    camera.updateProjectionMatrix();
    shared.uPx.value = H * dpr / (2 * Math.tan(camera.fov * DEG / 2));
    shared.uCamDist.value = P.dist;
  }
  function render() { place(); renderer.render(scene, camera); }

  /* captions and labels */
  const ui = document.createElement("div");
  ui.style.cssText = `position:absolute;inset:0;pointer-events:none;font-family:${MONO};color:#dfe7ee;overflow:hidden`;
  const cap = document.createElement("div");
  cap.style.cssText = "position:absolute;left:22px;bottom:24px;max-width:min(540px,calc(100% - 44px));opacity:0;transform:translateY(6px);transition:opacity .6s,transform .6s;text-shadow:0 0 10px #000,0 0 3px #000";
  cap.innerHTML = '<span style="display:block;font-size:10px;letter-spacing:.18em;margin-bottom:6px;color:#9fb3c4"></span><b style="display:block;font-size:22px;font-weight:600;letter-spacing:.08em;line-height:1.15"></b><p style="margin:8px 0 0;font-size:12px;line-height:1.55;letter-spacing:.02em;opacity:.82"></p>';
  const [capN, capT, capL] = cap.children;
  const lab = document.createElement("div");
  lab.style.cssText = "position:absolute;inset:0";
  ui.append(lab, cap); host.appendChild(ui);
  const labelEls = LABELS.map(() => {
    const d = document.createElement("div");
    d.style.cssText = "position:absolute;left:0;top:0;white-space:nowrap;transition:opacity .4s;opacity:0;text-shadow:0 0 8px #000,0 0 2px #000";
    d.innerHTML = '<i style="position:absolute;left:-3px;bottom:-3px;width:6px;height:6px;border-radius:50%"></i><i style="position:absolute;left:0;bottom:3px;width:1px;height:34px;opacity:.6"></i><b style="position:absolute;left:8px;bottom:30px;font-size:11px;letter-spacing:.14em;font-weight:600"></b><span style="position:absolute;left:8px;bottom:17px;font-size:10px;letter-spacing:.06em;opacity:.75"></span>';
    lab.appendChild(d);
    return d;
  });
  const v3 = new T.Vector3;
  function overlay() {
    const t = clock;
    LABELS.forEach(([t0, t1, text, sub, anchor], i) => {
      const el = labelEls[i];
      let on = values.labels && t >= t0 && t <= t1, x, z, side = 0;
      if (anchor === "ibrahim") { [x, z] = ibrahimPos(); side = 1; }
      else if (typeof anchor === "string") { const u = units[UNIT_INDEX[anchor]]; x = u.x; z = u.z; side = UNITS[UNIT_INDEX[anchor]].side; on = on && u.a > .2; }
      else { [x, z] = anchor; side = -1; }
      if (!on) { el.style.opacity = "0"; return; }
      v3.set(-x, groundH(x, z) + 3, z).project(camera);
      const px = (v3.x * .5 + .5) * W, py = (-v3.y * .5 + .5) * H;
      if (v3.z > 1 || px < -50 || px > W + 50 || py < -50 || py > H + 50) { el.style.opacity = "0"; return; }
      const col = side === 0 ? values.babur : side === 1 ? values.lodi : "#c9d4de";
      if (el.dataset.k !== text + sub + col) {
        el.dataset.k = text + sub + col;
        el.children[0].style.background = col; el.children[1].style.background = col;
        el.children[2].textContent = text; el.children[2].style.color = col; el.children[3].textContent = sub;
      }
      el.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
      el.style.opacity = "1";
    });
    let cur = null;
    if (values.captions) { for (const c of CAPTIONS) if (c.t <= t + .001) cur = c; if (cur && t - cur.t > 7.5) cur = null; }
    const key = cur ? cur.t + cur.title : "";
    if (cap.dataset.k !== key) {
      cap.dataset.k = key;
      if (cur) { capN.textContent = `${String(cur.n).padStart(2, "0")} · ${cur.chapter.toUpperCase()}`; capT.textContent = cur.title; capL.textContent = cur.line; }
    }
    cap.style.opacity = cur ? "1" : "0"; cap.style.transform = cur ? "none" : "translateY(6px)";
  }

  /* pointer: drag turns, wheel zooms, right- or shift-drag pans, double-click returns to the film */
  let drag = null;
  const setFilm = on => { if (on === film) return; film = on; filmBlend = on ? { ...P, t0: wall } : null; hooks.onFilm && hooks.onFilm(film); };
  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, P: { ...P }, pan: e.shiftKey || e.button !== 0, moved: false }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; });
  canvas.addEventListener("pointermove", e => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 3) { drag.moved = true; setFilm(false); }
    if (!drag.moved) return;
    if (drag.pan) {
      const k = P.dist / H * 1.1, a = P.az * DEG;
      P.camX = drag.P.camX + (dx * Math.cos(a) - dy * Math.sin(a)) * k;
      P.camZ = drag.P.camZ + (dx * Math.sin(a) + dy * Math.cos(a)) * k;
    } else { P.az = drag.P.az + dx * .3; P.el = clamp(drag.P.el + dy * .2, 4, 88); }
  });
  const end = () => { drag = null; canvas.style.cursor = "grab"; };
  canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
  canvas.addEventListener("wheel", e => { e.preventDefault(); setFilm(false); P.dist = clamp(P.dist * Math.exp(e.deltaY * .0012), 25, 9000); }, { passive: false });
  canvas.addEventListener("dblclick", () => setFilm(true));

  let raf = 0, last = performance.now(), avg = 1 / 60, slow = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, Math.max(0, (now - last) / 1000)); last = now;
    if (document.hidden) return;
    avg = avg * .95 + dt * .05;
    if (++slow > 90 && avg > .034 && quality > .5) { quality -= .15; slow = 0; resize(); }
    tick(dt); render(); overlay();
    hooks.onFrame && hooks.onFrame(S, status());
  }
  function status() {
    const ch = CHAPTERS[S.chapter], m = Math.floor(clock / 60), s = Math.floor(clock % 60);
    return `${String(ch.n).padStart(2, "0")} · ${ch.name.toUpperCase()} · ${m}:${String(s).padStart(2, "0")} / ${Math.floor(FILM_LEN / 60)}:${String(Math.round(FILM_LEN % 60)).padStart(2, "0")}`;
  }
  const ro = new ResizeObserver(resize); ro.observe(host);
  const api = {
    get values() { return values; }, get state() { return S; }, get clock() { return clock; }, get paused() { return paused; }, get film() { return film; },
    chapters: CHAPTERS, points: ctx.count, status,
    set(raw) {
      const prev = values; values = { ...values, ...coerce(raw) };
      applyColours();
      if (values.filmCamera !== prev.filmCamera) setFilm(values.filmCamera);
      if (values.play !== prev.play) paused = !values.play;
      if (values.start !== prev.start) api.phase(Number(values.start) || 0);
      if (paused || hooks.manual) { tick(0); render(); overlay(); }
    },
    phase(i) { jump = { from: { ...S }, t0: wall }; clock = CHAPTERS[clamp(i, 0, CHAPTERS.length - 1)].t0 + .001; if (paused) paused = false; hooks.onPause && hooks.onPause(false); setFilm(true); },
    seek(t) { clock = (t % FILM_LEN + FILM_LEN) % FILM_LEN; jump = null; filmBlend = null; tick(0); render(); overlay(); return status(); },
    pause() { paused = true; }, play() { paused = false; last = performance.now(); },
    togglePause() { paused = !paused; last = performance.now(); return paused; },
    setFilm, resetView() { setFilm(true); },
    debug: { renderer, scene, camera, step: dt => { tick(dt); render(); overlay(); } },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); ui.remove(); scene.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); }); renderer.dispose(); canvas.remove(); }
  };
  applyColours(); resize(); tick(0); render(); overlay();
  if (!hooks.manual) raf = requestAnimationFrame(loop);
  return api;
}

class PanipatBattle extends HTMLElement {
  connectedCallback() {
    if (this._f) return;
    if (getComputedStyle(this).position === "static") this.style.position = "relative";
    if (getComputedStyle(this).display === "inline") this.style.display = "block";
    if (this.clientHeight < 2) this.style.height = "min(80vh, 640px)";
    const init = {};
    for (const k of Object.keys(DEFAULTS)) { const a = this.getAttribute(k.toLowerCase()); if (a != null) init[k] = a; }
    this._f = createPanipat(this, init, { onChapter: i => this.dispatchEvent(new CustomEvent("chapter", { detail: { index: i, name: CHAPTERS[i].name } })) });
    this.dispatchEvent(new CustomEvent("ready"));
  }
  disconnectedCallback() { this._f && this._f.dispose(); this._f = null; }
  get figure() { return this._f; }
}
if (typeof customElements !== "undefined" && !customElements.get("panipat-battle")) customElements.define("panipat-battle", PanipatBattle);
globalThis.Panipat = { CHAPTERS, UNITS, DEFAULTS, createPanipat };
