/* ---------- captions, callouts and the inspect tooltip (plain DOM over the canvas) ---------- */
const MONO = 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace', MONO_SVG = MONO.replace(/"/g, "'");
const CAPTIONS = CHAPTERS.flatMap(c => (c.cap || []).map(([t, title, line]) => ({ t: c.t0 + t, n: c.n, chapter: c.name, title, line })));
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
function readable(bg, ink) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) || 0), b = p(bg), k = p(ink);
  const dark = (b[0] + b[1] + b[2]) / 3 < 115, to = dark ? 255 : 0, amt = dark ? .55 : .35;
  return `rgb(${k.map(v => Math.round(v + (to - v) * amt)).join(",")})`;
}
function buildOverlay(host, getFigure, getValues) {
  const root = document.createElement("div");
  root.style.cssText = `position:absolute;inset:0;pointer-events:none;z-index:2;font-family:${MONO};overflow:hidden`;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("style", "position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible");
  const cap = document.createElement("div");
  cap.style.cssText = "position:absolute;left:20px;bottom:24px;max-width:min(520px,60%,calc(100% - 20px - var(--vb-cap-right,20px)));opacity:0;transform:translateY(6px);transition:opacity .6s,transform .6s";
  cap.innerHTML = '<span style="display:block;font-size:10px;letter-spacing:.16em;margin-bottom:6px"></span><b style="display:block;font-size:22px;font-weight:600;letter-spacing:.08em;line-height:1.15"></b><p style="margin:7px 0 0;font-size:12px;line-height:1.55;letter-spacing:.02em;opacity:.75"></p>';
  const [capN, capT, capL] = cap.children;
  const tip = document.createElement("div");
  tip.style.cssText = "position:absolute;max-width:300px;padding:10px 12px 11px;font-size:11px;line-height:1.5;opacity:0;transform:translateY(4px);transition:opacity .15s,transform .15s;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)";
  tip.innerHTML = '<i style="display:block;font-style:normal;letter-spacing:.1em;font-size:9px;opacity:.7"></i><b style="display:block;font-size:11px;letter-spacing:.12em;margin-bottom:3px"></b><span></span>';
  const [tipG, tipN, tipD] = tip.children;
  root.append(svg, cap, tip);
  host.appendChild(root);
  let capKey = "", svgKey = "", styleKey = "", narrow = null;

  function layout(w) {
    const n = w < 640;
    if (n === narrow) return;
    narrow = n;
    cap.style.left = n ? "12px" : "20px"; cap.style.bottom = n ? "18px" : "24px";
    capT.style.fontSize = n ? "16px" : "22px"; capL.style.fontSize = n ? "11px" : "12px";
  }
  function colours() {
    const v = getValues(), text = readable(v.bg, v.ink), key = `${v.bg}|${v.ink}|${v.glow}`;
    if (key !== styleKey) {
      styleKey = key;
      const halo = `0 0 8px ${v.bg}, 0 0 3px ${v.bg}, 0 0 1px ${v.bg}`;
      cap.style.color = text; capN.style.color = v.glow;
      for (const el of [capN, capT, capL]) el.style.textShadow = halo;
      tip.style.color = text; tip.style.border = `1px solid ${v.ink}`; tip.style.background = `${v.bg}e0`; tipN.style.color = v.glow;
      svgKey = "";
    }
    return { text, ink: v.ink, glow: v.glow, bg: v.bg };
  }
  function callouts(f, c) {
    const v = getValues(), a = v.labels ? 1 : (f.state.labels || 0);
    if (a < .02 || f.state.explode > .02) { if (svg.firstChild) { svg.innerHTML = ""; svgKey = ""; } return; }
    svg.style.opacity = String(a);
    const list = f.labels(), r = host.getBoundingClientRect(), font = `font:10px ${MONO_SVG};letter-spacing:.12em`;
    let out = "";
    if (r.width < 640) {
      list.sort((p, q) => p.p.y - q.p.y).forEach((l, i) => {
        out += `<circle cx="${l.p.x.toFixed(1)}" cy="${l.p.y.toFixed(1)}" r="7.5" fill="${c.bg}" stroke="${c.glow}" stroke-width="1.2"/><text x="${l.p.x.toFixed(1)}" y="${(l.p.y + 3.3).toFixed(1)}" text-anchor="middle" fill="${c.glow}" style="font:9px ${MONO_SVG}">${i + 1}</text>`;
        out += `<text x="${(14 + (i % 2) * (r.width / 2 - 8)).toFixed(1)}" y="${(24 + Math.floor(i / 2) * 15).toFixed(1)}" fill="${c.text}" style="${font}"><tspan fill="${c.glow}">${i + 1}</tspan> ${esc(l.t)}</text>`;
      });
    } else {
      // labels sit in a row above the train and a row below it, with leaders dropping to the parts
      const top = list.filter(l => l.up).sort((p, q) => p.p.x - q.p.x), bot = list.filter(l => !l.up).sort((p, q) => p.p.x - q.p.x);
      let ymin = 1e9, ymax = -1e9;
      for (const pt of f.train.box) { const s = f.project(pt); ymin = Math.min(ymin, s.y); ymax = Math.max(ymax, s.y); }
      const width = t => t.length * 7.4 + 10;
      const row = (items, y, dir) => {
        for (const l of items) l.x = l.p.x;
        for (let k = 0; k < 40; k++) for (let i = 1; i < items.length; i++) {
          const need = (width(items[i - 1].t) + width(items[i].t)) / 2 + 8, gap = items[i].x - items[i - 1].x;
          if (gap < need) { const d = (need - gap) / 2; items[i].x += d; items[i - 1].x -= d; }
        }
        for (const l of items) l.x = clamp(l.x, width(l.t) / 2 + 8, r.width - width(l.t) / 2 - 8);
        items.forEach((l, i) => {
          const ly = clamp(y + dir * (i % 2) * 16, 16, r.height - 12);
          out += `<circle cx="${l.p.x.toFixed(1)}" cy="${l.p.y.toFixed(1)}" r="2.6" fill="${c.glow}"/><polyline points="${l.p.x.toFixed(1)},${l.p.y.toFixed(1)} ${l.x.toFixed(1)},${(ly - dir * 8).toFixed(1)}" stroke="${c.ink}" stroke-width="1" fill="none"/>`;
          out += `<text x="${l.x.toFixed(1)}" y="${(ly + (dir > 0 ? 9 : -1)).toFixed(1)}" text-anchor="middle" fill="${c.text}" style="${font};paint-order:stroke;stroke:${c.bg};stroke-width:3px">${esc(l.t)}</text>`;
        });
      };
      row(top, Math.max(30, ymin - 46), -1);
      row(bot, Math.min(r.height - 30, ymax + 40), 1);
    }
    if (out !== svgKey) { svg.innerHTML = out; svgKey = out; }
  }
  function caption(f) {
    const v = getValues();
    let cur = null;
    if (v.captions) {
      const t = f.clock;
      for (const c of CAPTIONS) if (c.t <= t + .001) cur = c;
      if (cur && t - cur.t >= 5.2) cur = null;
    }
    const key = cur ? cur.t + cur.title : "";
    if (key !== capKey) {
      capKey = key;
      if (cur) { capN.textContent = `${String(cur.n).padStart(2, "0")} · ${cur.chapter.toUpperCase()}`; capT.textContent = cur.title; capL.textContent = cur.line; }
    }
    cap.style.opacity = cur ? "1" : "0";
    cap.style.transform = cur ? "none" : "translateY(6px)";
  }
  return {
    frame() { const f = getFigure(); if (!f) return; const c = colours(); layout(host.clientWidth); callouts(f, c); caption(f); },
    inspect(hit) {
      if (!hit || !getValues().inspect) { tip.style.opacity = "0"; return; }
      tipG.textContent = String(hit.group || "").toUpperCase(); tipN.textContent = String(hit.name || "").toUpperCase(); tipD.textContent = hit.desc || "";
      const r = host.getBoundingClientRect();
      tip.style.left = `${Math.max(8, Math.min(hit.x + 18, r.width - 320))}px`;
      tip.style.top = `${Math.max(8, Math.min(hit.y + 16, r.height - 110))}px`;
      tip.style.opacity = "1"; tip.style.transform = "none";
    },
    dispose() { root.remove(); }
  };
}

/* ---------- the figure ---------- */
const POINT_BG = new T.Color(.012, .018, .027);
function createVandeBharat(host, initial = {}, hooks = {}) {
  let values = mergeValues(DEFAULTS, initial);
  const P = { theme: values.theme, azimuth: values.azimuth, elevation: values.elevation, zoom: values.zoom, focusX: values.focusX, lineWidth: values.lineWidth, speed: values.speed };
  const U = makeUniforms();
  const registry = new Map, isHex = v => typeof v === "string" && v[0] === "#";
  function paint(key, f) {
    const out = new T.Color;
    if (key && key.isColor) return out.copy(key);
    if (isHex(key)) return f(key, out);
    if (!(key in PAINTS)) throw new Error(`[vande-bharat] no paint "${key}"`);
    f(values[key], out);
    if (!registry.has(key)) registry.set(key, []);
    registry.get(key).push({ out, f });
    return out;
  }
  U.pal = { color: k => paint(k, (h, o) => hexTo(h, o)), shade: k => paint(k, (h, o) => shadeOf(h, .62, o)), hex: k => isHex(k) ? k : values[k] };

  let overlay = null;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;outline:none";
  host.appendChild(canvas);
  const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: !!hooks.preserve, powerPreference: "high-performance" });
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.toneMapping = T.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.localClippingEnabled = true;

  const scene = new T.Scene;
  const sun = new T.DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  const smap = Math.min(3072, renderer.capabilities.maxTextureSize);
  sun.shadow.mapSize.set(smap, smap);
  sun.shadow.bias = -5e-4; sun.shadow.normalBias = .04; sun.shadow.radius = 2.4;
  scene.add(sun, sun.target);
  const fill = new T.DirectionalLight(0xffffff, 1);
  scene.add(fill, fill.target);
  const ground = new T.Mesh(new T.PlaneGeometry(4000, 4000), groundMaterial(U));
  ground.rotation.x = -Math.PI / 2; ground.position.y = Y0 - SLAB; ground.receiveShadow = true;
  scene.add(ground);

  // colour pass + normal/depth pass, composited with ink lines along the edges
  const rtColour = new T.WebGLRenderTarget(4, 4, { depthBuffer: true }), rtNormal = new T.WebGLRenderTarget(4, 4, { depthBuffer: true });
  rtNormal.depthTexture = new T.DepthTexture(4, 4, T.FloatType);
  const normalMat = new T.MeshNormalMaterial({ side: T.DoubleSide });
  const comp = new T.ShaderMaterial({
    uniforms: {
      tColor: { value: rtColour.texture }, tNormal: { value: rtNormal.texture }, tDepth: { value: rtNormal.depthTexture },
      uTexel: { value: new T.Vector2 }, uNear: { value: 1 }, uFar: { value: 4000 }, uPx: { value: .1 }, uInk: U.ink, uInkA: { value: .8 }, uLW: { value: 1 }, uTone: { value: 0 }
    },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: `
      uniform sampler2D tColor, tNormal, tDepth; uniform vec2 uTexel; uniform float uNear, uFar, uPx, uInkA, uLW, uTone; uniform vec3 uInk;
      varying vec2 vUv;
      float D(vec2 uv){ return uNear + texture2D(tDepth, uv).x * (uFar - uNear); }
      vec3 N(vec2 uv){ return texture2D(tNormal, uv).xyz * 2.0 - 1.0; }
      float edgeAt(vec2 uv, vec2 o){
        float dc = D(uv);
        float dl = D(uv - vec2(o.x, 0.0)), dr = D(uv + vec2(o.x, 0.0));
        float du = D(uv + vec2(0.0, o.y)), dd = D(uv - vec2(0.0, o.y));
        float lap = max(abs(dl + dr - 2.0 * dc), abs(du + dd - 2.0 * dc));
        float th = max(0.02, uPx * 2.2);
        float eD = smoothstep(th, th * 1.8, lap);
        vec3 nc = N(uv);
        float dn = max(max(1.0 - dot(nc, N(uv - vec2(o.x, 0.0))), 1.0 - dot(nc, N(uv + vec2(o.x, 0.0)))),
                       max(1.0 - dot(nc, N(uv + vec2(0.0, o.y))), 1.0 - dot(nc, N(uv - vec2(0.0, o.y)))));
        float eN = smoothstep(0.22, 0.40, dn);
        return max(eD, eN);
      }
      void main(){
        vec3 col = texture2D(tColor, vUv).rgb;
        // point-cloud mode sums light additively; roll the highlights off instead of clipping them
        if (uTone > 0.5) col = 1.0 - exp(-col * 1.15);
        vec2 o = uTexel * uLW;
        float e = uLW > 0.0 ? edgeAt(vUv, o) : 0.0;
        gl_FragColor = vec4(mix(col, uInk, e * uInkA), 1.0);
      }`,
    depthTest: false, depthWrite: false
  });
  const compScene = new T.Scene, compCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  compScene.add(new T.Mesh(new T.PlaneGeometry(2, 2), comp));
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 1, 4000);

  const tracked = [], track = m => (tracked.push(m), m), cache = new Map;
  const cached = (key, make) => { if (!cache.has(key)) cache.set(key, track(make())); return cache.get(key); };
  const ek = o => o && o.emis ? (o.emis === U.cabinGlow ? "c" : o.emis === U.heat ? "h" : "s") : "";
  const shellPlane = new T.Plane(V3(0, 0, -1), 1e3);
  const stageClip = [new T.Plane(V3(1, 0, 0), HX - .02), new T.Plane(V3(-1, 0, 0), HX - .02), new T.Plane(V3(0, 0, 1), -ZN - .02), new T.Plane(V3(0, 0, -1), ZF - .02)];
  const ctx = {
    U, track,
    mat: (fam, color, o = {}) => cached(`m|${fam}|${color}|${ek(o)}`, () => toon(U, fam, { color, ...o })),
    shell: (fam, color, o = {}) => cached(`s|${fam}|${color}|${ek(o)}`, () => toon(U, fam, { color, side: T.DoubleSide, clip: [shellPlane], ...o })),
    shellNormal: track(new T.MeshNormalMaterial({ side: T.DoubleSide, clippingPlanes: [shellPlane] })),
    stageMat: (fam, color, o = {}) => cached(`g|${fam}|${color}`, () => toon(U, fam, { color, clip: stageClip, ...o })),
    stageNormal: track(new T.MeshNormalMaterial({ side: T.DoubleSide, clippingPlanes: stageClip }))
  };
  let train, stage;
  rawColour(() => { train = buildTrain(ctx); stage = buildStage(ctx); });
  scene.add(stage.root, train.root);
  const hlMat = track(new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: T.DoubleSide }));
  const hl = new T.Mesh(new T.BufferGeometry, hlMat);
  hl.layers.set(1); hl.renderOrder = 7; hl.visible = false; hl.matrixAutoUpdate = false; hl.frustumCulled = false;
  scene.add(hl);

  function applyColours() {
    for (const k of ["bodyLo", "bodyHi", "deckLo", "deckHi", "darkLo", "darkHi", "ink", "mark", "glow", "bg", "shadow", "foam", "wave"]) hexTo(values[k], U[k].value);
    U.markHi.value.copy(U.mark.value);
    U.markLo.value.copy(U.mark.value).lerp(U.bodyLo.value, .4);
    hexTo(values.highlight, U.sel.value);
    for (const k of ["head", "cabin", "flow", "air"]) hexTo(values[k], U[k].value);
    hexTo(values.heat, U.heatC.value);
    comp.uniforms.uInkA.value = values.inkStrength;
    U.cmix.value = values.paint || values.render === "points" ? 1 : 0;
    for (const [k, list] of registry) for (const e of list) e.f(values[k], e.out);
    hlMat.color.copy(U.sel.value);
  }
  const centre = V3(0, 2, 0);
  function applySun() {
    const a = values.sunFrom * DEG, h = clamp(values.sunHeight, 5, 89) * DEG, d = V3(Math.cos(h) * Math.cos(a), Math.sin(h), Math.cos(h) * Math.sin(a));
    sun.shadow.radius = values.shadowSoftness;
    U.ambient.value = values.ambient;
    const R = 52;
    sun.position.copy(centre).addScaledVector(d, R * 4);
    sun.target.position.copy(centre);
    Object.assign(sun.shadow.camera, { left: -R, right: R, top: R * .55, bottom: -R * .55, near: R * 1.5, far: R * 7 });
    sun.shadow.camera.updateProjectionMatrix();
    const f = V3(-d.x, .45, -d.z).normalize();
    fill.position.copy(centre).addScaledVector(f, R * 3);
    fill.target.position.copy(centre);
  }

  let pw = 4, ph = 4, W = 1, H = 1, dpr = 2, quality = 1, halfH = 20;
  const fitOffset = V3(0, 0, 0), reserve = { top: 0, bottom: 0, left: 0, right: 0 };
  const portrait = () => W / Math.max(1, H) < .86;
  const viewDir = (az = P.azimuth, el = P.elevation) => (az *= DEG, el *= DEG, V3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)));
  function resize() {
    const r = host.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.max(2, Math.min(window.devicePixelRatio || 1, 2.5)) * quality;
    const cap = 3400 * 2200;
    if (W * H * dpr * dpr > cap) dpr = Math.sqrt(cap / (W * H));
    pw = Math.round(W * dpr); ph = Math.round(H * dpr);
    renderer.setPixelRatio(1);
    renderer.setSize(pw, ph, false);
    rtColour.setSize(pw, ph); rtNormal.setSize(pw, ph);
    comp.uniforms.uTexel.value.set(1 / pw, 1 / ph);
    fit();
  }
  // frame the whole stage from a fixed reference direction, so the scale does not change as the view turns
  function fit() {
    const d = viewDir(300, 24), right = V3(0, 1, 0).cross(d).normalize(), upv = d.clone().cross(right).normalize();
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const hx = portrait() ? 20 : HX, pts = [];
    for (const sx of [-1, 1]) for (const z of [ZN, ZF]) pts.push([sx * hx, Y0, z], [sx * hx, Y0 - SLAB, z]);
    pts.push([hx * .9, 7, 0], [-hx * .9, 7, 3.2], [hx * .9, 7, 3.2], [-hx * .9, 7, 0]);
    for (const [x, y, z] of pts) {
      const v = V3(x, y, z).sub(centre);
      x0 = Math.min(x0, v.dot(right)); x1 = Math.max(x1, v.dot(right)); y0 = Math.min(y0, v.dot(upv)); y1 = Math.max(y1, v.dot(upv));
    }
    const mt = Math.max(reserve.top, 24), mb = Math.max(reserve.bottom, 24), ml = Math.max(reserve.left, 12), mr = Math.max(reserve.right, 12);
    const ah = Math.max(80, H - mt - mb), aw = Math.max(80, W - ml - mr);
    const scale = Math.max((y1 - y0) / ah, (x1 - x0) / aw) * 1.04;
    halfH = scale * H / 2;
    const oy = mt + ah / 2 - H / 2, ox = ml + aw / 2 - W / 2;
    fitOffset.copy(centre).addScaledVector(right, (x0 + x1) / 2 - ox * scale).addScaledVector(upv, (y0 + y1) / 2 + oy * scale).sub(centre);
  }
  let viewZoom = 1, curHalf = 20;
  const focus = V3(0, 2.3, 0);
  function placeCamera() {
    const d = viewDir(), tgt = centre.clone().add(fitOffset), ex = S.explode || 0, z = P.zoom * viewZoom;
    tgt.y += 1.6 * ex;
    focus.set(clamp(P.focusX, -HX, HX), 2.3 + 1.6 * ex, 0);
    tgt.lerp(focus, sstep(1, 1.9, z));
    camera.position.copy(tgt).addScaledVector(d, 1500);
    camera.up.set(0, 1, 0);
    camera.lookAt(tgt);
    curHalf = halfH / z * (1 + .22 * ex);
    const a = W / H;
    camera.left = -curHalf * a; camera.right = curHalf * a; camera.top = curHalf; camera.bottom = -curHalf;
    camera.near = 1000; camera.far = 2200;
    camera.updateProjectionMatrix();
    comp.uniforms.uNear.value = camera.near; comp.uniforms.uFar.value = camera.far;
    comp.uniforms.uPx.value = 2 * curHalf / ph;
    comp.uniforms.uLW.value = P.lineWidth * dpr * .5;
    const pxPerM = ph / (2 * curHalf);
    U.ptSize.value = clamp(.026 * pxPerM * values.pointSize, 1.1 * dpr * .5, 3.2 * dpr * values.pointSize);
    if (cloud) { airStream.size.value = clamp(.11 * pxPerM, 2 * dpr * .5, 9 * dpr); flowStream.size.value = clamp(.13 * pxPerM, 2.4 * dpr * .5, 10 * dpr); }
  }
  /* point-cloud mode: meshes still cast shadows and take the pointer, but only their dots are drawn */
  let cloud = null, cloudDensity = 0, airStream = null, flowStream = null;
  const points = () => values.render === "points";
  function applyRender() {
    const pm = points();
    if (pm && (!cloud || cloudDensity !== values.density)) {
      if (cloud) for (const c of cloud.clouds) { c.parent.remove(c); c.geometry.dispose(); }
      cloudDensity = values.density;
      rawColour(() => { cloud = buildCloud(ctx, [train.root, stage.root], clamp(values.density, .1, 4)); });
      if (!airStream) {
        airStream = buildStreams(train.airCurves, U.air, train.airA, { per: 120, seed: 5 });
        flowStream = buildStreams(train.flowCurves, U.flow, train.flowA, { per: 140, seed: 9, depthTest: false });
        scene.add(airStream.pts, flowStream.pts);
      }
      hooks.onCloud && hooks.onCloud({ points: cloud.total, area: cloud.area });
    }
    for (const m of tracked) if (m.userData && m.userData.toonArgs && !m.userData.toonArgs.o.points) { m.colorWrite = !pm; m.depthWrite = !pm; }
    if (cloud) for (const c of cloud.clouds) c.visible = pm;
    ground.visible = !pm;
    U.cmix.value = pm || values.paint ? 1 : 0;
    if (airStream) { airStream.pts.visible = pm; flowStream.pts.visible = pm; }
    train.opt.tubes = !pm;
  }

  const startClock = () => CHAPTERS[clamp(Math.round(Number(values.start) || 0), 0, CHAPTERS.length - 1)].t0 + .001;
  let clock = hooks.t ?? startClock(), wall = 0, paused = !!hooks.paused || !values.play, blend = null, lastDt = 0;
  const overrides = new Map;
  const view = { cutaway: values.cutaway ? 1 : 0, explode: values.explode ? 1 : 0, airflow: values.airflow ? 1 : 0, power: values.power ? 1 : 0, inspect: values.inspect ? 1 : 0, callouts: values.labels ? 1 : 0 };
  const eased = { cutaway: view.cutaway, explode: view.explode, airflow: view.airflow, power: view.power };
  let chapter = -1, S = { ...BASE, s: 0, period: PERIOD, chapter: 0, cutaway: 0 }, cutSide = -1, cutC = 1e3;
  let film = hooks.film ?? values.filmCamera, filmBlend = null;

  function computeState() {
    let L = stateAt(clock);
    const ci = L.chapter;
    if (ci !== chapter) { if (chapter >= 0) overrides.clear(); chapter = ci; hooks.onChapter && hooks.onChapter(ci); }
    if (blend) {
      const k = smoother(clamp((wall - blend.t0) / blend.dur)), from = blend.from, o = {};
      for (const key of KEYS) o[key] = key === "camAz" ? angLerp(from[key], L[key], k) : lerp(from[key], L[key], k);
      o.s = from.s + wrapSym(L.s - from.s, PERIOD) * k; o.period = PERIOD; o.chapter = ci;
      L = o;
      if (k >= 1) blend = null;
    }
    for (const [key, o] of overrides) L[key] = lerp(o.from, o.to, smoother(clamp((wall - o.t0) / o.dur)));
    if (overrides.has("panto")) L.flow = 1;
    for (const k of ["cutaway", "airflow", "power"]) {
      eased[k] += (view[k] - eased[k]) * .08;
      if (Math.abs(eased[k] - view[k]) < .001) eased[k] = view[k];
    }
    L.cutaway = Math.max(eased.cutaway, film && values.filmCutaway ? L.cut : 0);
    L.labels = film && values.filmLabels ? L.labels : 0;
    const step = Math.min(1, lastDt * 1.4);
    eased.explode = view.explode ? Math.min(1, eased.explode + step) : Math.max(0, eased.explode - step);
    L.explode = Math.max(L.explode, smoother(eased.explode));
    L.airflow *= eased.airflow;
    L.flow *= eased.power;
    return L;
  }
  function setFilm(on) {
    if (on === film) return;
    film = on;
    filmBlend = on ? { az: P.azimuth, el: P.elevation, zoom: P.zoom, x: P.focusX, t0: wall } : null;
    hooks.onFilm && hooks.onFilm(film);
  }
  function followFilm(L, instant) {
    if (!film) return;
    let az = L.camAz, el = L.camEl, zoom = L.camZoom, x = L.camX;
    if (portrait()) zoom *= 1.15;
    if (filmBlend && !instant) {
      const k = smoother(clamp((wall - filmBlend.t0) / 1.4));
      az = angLerp(filmBlend.az, az, k); el = lerp(filmBlend.el, el, k); zoom = lerp(filmBlend.zoom, zoom, k); x = lerp(filmBlend.x, x, k);
      if (k >= 1) filmBlend = null;
    }
    P.azimuth = az; P.elevation = el; P.zoom = zoom; P.focusX = x;
  }
  function updateCut() {
    cutSide = viewDir().z >= 0 ? 1 : -1;
    const on = S.cutaway > .001 && S.explode < .001;
    cutC = on ? lerp(1.9, .06, smoother(S.cutaway)) : 1e3;
    shellPlane.normal.set(0, 0, -cutSide);
    shellPlane.constant = cutC;
    U.cutN.value.set(0, 0, cutSide); U.cutC.value = cutC;
  }
  function tick(dt) {
    wall += dt; lastDt = dt;
    if (!paused) clock = (clock + dt * P.speed) % FILM_LEN;
    U.time.value = wall;
    S = computeState();
    followFilm(S, dt === 0);
    updateCut();
    rawColour(() => { train.apply(S); stage.update(S, wall); });
    U.scatter.value = Math.pow(S.explode, 1.6) * 2.4;
    U.scanX.value = lerp(-CAR_PITCH - CAR_H - 3, CAR_PITCH + CAR_H + 3, S.scan);
    U.scanA.value = sstep(0, .04, S.scan) * (1 - sstep(.96, 1, S.scan));
    if (cloud) {
      const pm = points();
      airStream.pts.visible = pm && train.airA.value > .01; flowStream.pts.visible = pm && train.flowA.value > .01;
      airStream.update(dt, -(8 + S.speed / 3.6 * .6));
      flowStream.update(dt, (S.power < -.05 ? -1 : 1) * (5 + 6 * Math.abs(S.power)));
    }
    if (hl.visible && hl.userData.src) { hl.userData.src.updateWorldMatrix(true, false); hl.matrix.copy(hl.userData.src.matrixWorld); hl.matrixWorld.copy(hl.matrix); }
  }
  const swapped = [];
  function render() {
    placeCamera();
    if (points()) {
      comp.uniforms.uLW.value = 0; comp.uniforms.uTone.value = 1;
      camera.layers.enable(1);
      renderer.setClearColor(POINT_BG, 1);
      renderer.setRenderTarget(rtColour); renderer.clear(); renderer.render(scene, camera);
      renderer.setRenderTarget(null); renderer.render(compScene, compCam);
      return;
    }
    comp.uniforms.uTone.value = 0;
    camera.layers.set(0);
    scene.traverseVisible(o => { if (o.isMesh && o.layers.mask & 1) { swapped.push(o, o.material); o.material = o.userData.nmat || normalMat; } });
    renderer.setRenderTarget(rtNormal);
    renderer.setClearColor(0x8080ff, 1);
    renderer.clear();
    renderer.render(scene, camera);
    for (let i = 0; i < swapped.length; i += 2) swapped[i].material = swapped[i + 1];
    swapped.length = 0;
    camera.layers.enable(1);
    renderer.setClearColor(U.bg.value, 1);
    renderer.setRenderTarget(rtColour);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(compScene, compCam);
  }
  function status(L = S) {
    const ch = CHAPTERS[L.chapter] || CHAPTERS[0], out = [ch.status, `${Math.round(L.speed)} KM/H`];
    out.push(L.panto > .98 ? "PANTOGRAPH UP · 25 kV" : L.panto < .02 ? "PANTOGRAPH DOWN" : "PANTOGRAPH MOVING");
    if (L.power > .05) out.push(`TRACTION ${Math.round(L.power * 100)}%`);
    if (L.power < -.05) out.push(`REGEN ${Math.round(-L.power * 100)}%`);
    out.push(L.doors > .98 ? "DOORS OPEN" : L.doors < .02 ? "DOORS LOCKED" : "DOORS MOVING");
    return out.join(" · ");
  }

  /* pointer: drag turns the view, shift- or right-drag slides along the train, wheel zooms, double-click returns to the film */
  let drag = null;
  const emitView = () => hooks.onView && hooks.onView({ azimuth: P.azimuth, elevation: P.elevation, zoom: P.zoom, focusX: P.focusX, filmCamera: film });
  const setCursor = () => { canvas.style.cursor = values.inspect ? "crosshair" : values.drag ? "grab" : ""; };
  canvas.addEventListener("contextmenu", e => { if (values.drag) e.preventDefault(); });
  canvas.addEventListener("pointerdown", e => {
    if (!values.drag) return;
    drag = { x: e.clientX, y: e.clientY, az: P.azimuth, el: P.elevation, fx: P.focusX, pan: e.shiftKey || e.button === 2 || e.button === 1, moved: false };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", e => {
    if (drag) {
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3 && !drag.moved) { drag.moved = true; setFilm(false); }
      if (!drag.moved) return;
      if (drag.pan) {
        const d = viewDir(), rx = V3(0, 1, 0).cross(d).normalize().x;
        P.focusX = clamp(drag.fx - dx * (2 * curHalf / H) / (Math.abs(rx) < .3 ? Math.sign(rx || 1) * .3 : rx), -HX, HX);
        if (P.zoom < 1.9) P.zoom = Math.min(1.9, P.zoom + .02);
      } else {
        P.azimuth = drag.az - dx * .35;
        P.elevation = clamp(drag.el + dy * .25, 4, 86);
      }
    } else if (view.inspect) pick(e);
  });
  const endDrag = () => { const moved = drag && drag.moved; drag = null; setCursor(); if (moved) emitView(); };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => { if (view.inspect) select(null); });
  let wheelTimer = 0;
  canvas.addEventListener("wheel", e => {
    if (!values.wheelZoom) return;
    e.preventDefault();
    setFilm(false);
    P.zoom = clamp(P.zoom * Math.exp(-e.deltaY * .0012), .6, 8);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(emitView, 250);
  }, { passive: false });
  canvas.addEventListener("dblclick", () => { if (values.drag || values.wheelZoom) { setFilm(true); emitView(); } });

  const ray = new T.Raycaster, ndc = new T.Vector2;
  function select(hit, e) {
    if (!hit) { hl.visible = false; hl.userData.src = null; overlay?.inspect(null); hooks.onInspect && hooks.onInspect(null); return; }
    const o = hit.object, r = canvas.getBoundingClientRect(), [name, group, desc] = PARTS[o.userData.part] || [o.userData.part, "", ""];
    hl.geometry = o.geometry; hl.userData.src = o; hl.visible = true;
    hlMat.clippingPlanes = o.userData.shell ? [shellPlane] : [];
    const info = { key: o.userData.part, name, group, desc, x: e.clientX - r.left, y: e.clientY - r.top };
    overlay?.inspect(info); hooks.onInspect && hooks.onInspect(info);
  }
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    placeCamera();
    ray.setFromCamera(ndc, camera);
    ray.layers.set(0);
    let found = null;
    for (const h of ray.intersectObjects(train.parts, false)) {
      if (h.object.userData.shell && cutC < 100 && h.point.z * cutSide > cutC) continue;
      found = h; break;
    }
    select(found, e);
  }

  let last = performance.now(), raf = 0, onScreen = true, avg = 1 / 60, slow = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = Math.max(0, (now - last) / 1000), step = Math.min(.05, dt);
    last = now;
    if (!onScreen || document.hidden || hooks.frozen) return;
    if (dt < .2) { avg = avg * .95 + dt * .05; if (++slow > 120 && avg > .03 && quality > .6) { quality -= .2; slow = 0; avg = 1 / 60; resize(); } }
    tick(step); render(); overlay?.frame();
    hooks.onFrame && hooks.onFrame(S, status(S), api);
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(host);
  const io = new IntersectionObserver(en => { onScreen = en[0].isIntersecting; last = performance.now(); });
  io.observe(host);

  function set(raw) {
    const prev = values;
    values = mergeValues(values, raw);
    const ch = k => values[k] !== prev[k];
    applyColours();
    P.lineWidth = values.lineWidth; P.speed = values.speed; P.theme = values.theme;
    if (["sunFrom", "sunHeight", "shadowSoftness", "ambient"].some(ch)) applySun();
    if (ch("filmCamera")) setFilm(!!values.filmCamera);
    if (!film && ["azimuth", "elevation", "zoom", "focusX", "filmCamera"].some(ch)) { P.azimuth = values.azimuth; P.elevation = values.elevation; P.zoom = values.zoom; P.focusX = values.focusX; }
    if (ch("play")) { paused = !values.play; last = performance.now(); }
    if (ch("start")) { api.phase(clamp(Math.round(Number(values.start) || 0), 0, CHAPTERS.length - 1)); if (!values.play) paused = true; }
    for (const k of ["cutaway", "explode", "airflow", "power"]) if (ch(k)) view[k] = values[k] ? 1 : 0;
    if (ch("inspect")) api.setView("inspect", values.inspect);
    if (ch("labels")) view.callouts = values.labels ? 1 : 0;
    stage.root.visible = !!values.ground;
    stage.setPlatform(values.platform);
    if (ch("render") || (points() && ch("density"))) applyRender();
    setCursor();
    if (paused || hooks.frozen) { tick(0); render(); overlay?.frame(); }
  }
  const findToggle = k => TOGGLES.find(t => t.key === k);
  const api = {
    P, train, stage, U, set, chapters: CHAPTERS,
    get values() { return values; },
    get state() { return S; },
    get clock() { return clock; },
    get paused() { return paused; },
    get view() { return view; },
    get film() { return film; },
    get theme() { return THEMES.find(t => t.id === values.theme) || THEMES[0]; },
    get viewZoom() { return viewZoom; },
    resetView() { setFilm(true); emitView(); },
    setFilm,
    phase(i, dur = 1.6) {
      blend = { from: { ...S }, t0: wall, dur };
      if (paused) { paused = false; last = performance.now(); hooks.onPause && hooks.onPause(false); }
      clock = CHAPTERS[i].t0 + .001; chapter = i; overrides.clear();
      hooks.onChapter && hooks.onChapter(i);
    },
    toggle(key) {
      const t = findToggle(key);
      if (!t) return;
      if (!paused) { paused = true; hooks.onPause && hooks.onPause(true); }
      const entries = Object.entries(t.keys), [k0, [a0, b0]] = entries[0], on = Math.abs(S[k0] - a0) < Math.abs(S[k0] - b0) * 1.0001;
      for (const [k, [a, b]] of entries) overrides.set(k, { from: S[k], to: on ? b : a, t0: wall, dur: t.dur });
    },
    isOn(key) {
      const t = findToggle(key);
      if (!t) return false;
      const [k, [a, b]] = Object.entries(t.keys)[0];
      return Math.abs(S[k] - b) < Math.abs(S[k] - a);
    },
    setView(k, on) { view[k] = on ? 1 : 0; if (k === "inspect" && !on) select(null); },
    setFocus(x) { P.focusX = clamp(Number(x) || 0, -HX, HX); },
    setViewZoom(z) { viewZoom = clamp(Number(z) || 1, .5, 4); if (paused || hooks.frozen) { tick(0); render(); overlay?.frame(); } },
    setReserve(r) { Object.assign(reserve, r); fit(); },
    setSpeed(v) { P.speed = v; },
    seek(t) {
      clock = (t % FILM_LEN + FILM_LEN) % FILM_LEN; blend = null; overrides.clear();
      Object.assign(eased, { cutaway: view.cutaway, airflow: view.airflow, power: view.power, explode: view.explode });
      tick(0); tick(0); render(); overlay?.frame();
      return status(S);
    },
    pause() { paused = true; },
    play() { paused = false; last = performance.now(); },
    togglePause() { paused = !paused; last = performance.now(); return paused; },
    labels() {
      const out = [], d = viewDir();
      if (S.explode > .02) return out;
      for (const [k, a] of Object.entries(train.anchors)) {
        if (a.cut && S.cutaway < .5) continue;
        if (a.wall && S.cutaway > .5) continue;
        const p = a.p.clone(), n = a.n.clone();
        if (a.sided) { p.z *= cutSide; n.z *= cutSide; }
        if (n.normalize().dot(d) < .08) continue;
        const sp = this.project(p);
        if (sp.x < 6 || sp.x > W - 6 || sp.y < 6 || sp.y > H - 6) continue;
        out.push({ k, t: a.t, p: sp, up: a.n.y > .5 || a.p.y > 2 });
      }
      return out;
    },
    project(v) {
      const p = v.clone().project(camera);
      return { x: (p.x * .5 + .5) * W, y: (-p.y * .5 + .5) * H };
    },
    status: () => status(S),
    get cloud() { return cloud && { points: cloud.total, area: cloud.area }; },
    debug: { scene, camera, renderer, canvas, comp, step: dt => { tick(dt); render(); }, frame: () => render(), eased, view },
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); overlay?.dispose();
      for (const m of tracked) m.dispose && m.dispose();
      scene.traverse(o => { o.geometry && o.geometry.dispose && o.geometry.dispose(); });
      rtColour.dispose(); rtNormal.dispose(); renderer.dispose();
      const lose = renderer.getContext().getExtension("WEBGL_lose_context");
      lose && lose.loseContext();
      canvas.remove();
    }
  };
  applyColours(); applySun();
  stage.root.visible = !!values.ground; stage.setPlatform(values.platform);
  if (points()) applyRender();
  setCursor(); resize(); tick(0); render();
  overlay = buildOverlay(host, () => api, () => points() ? { ...values, bg: "#05070b", ink: "#56616b", inkStrength: .8 } : values);
  if (!hooks.manual && !hooks.frozen) raf = requestAnimationFrame(loop);
  return api;
}

/* ---------- <vande-bharat-figure> ---------- */
const ATTRS = Object.fromEntries(Object.keys(DEFAULTS).map(k => [k.toLowerCase(), k]));
class VandeBharatFigure extends HTMLElement {
  static get observedAttributes() { return Object.keys(ATTRS); }
  constructor() { super(); this._f = null; this._host = null; this._pending = {}; }
  connectedCallback() {
    if (this._f || this._booting) return;
    this._booting = true;
    const cs = getComputedStyle(this);
    if (cs.display === "inline") this.style.display = "block";
    if (cs.position === "static") this.style.position = "relative";
    const boot = () => {
      this._booting = false;
      if (!this.isConnected || this._f) return;
      if (this.clientHeight < 2) this.style.height = "min(80vh, 640px)";
      const host = document.createElement("div");
      host.style.cssText = "position:absolute;left:0;top:0;right:0;bottom:0;overflow:hidden;border-radius:inherit";
      this.appendChild(host);
      this._host = host;
      const init = {};
      for (const a of this.getAttributeNames()) { const k = ATTRS[a]; if (k) init[k] = this.getAttribute(a); }
      Object.assign(init, this._pending);
      this._pending = {};
      const fire = (name, detail) => this.dispatchEvent(new CustomEvent(name, { detail }));
      this._f = createVandeBharat(host, init, {
        onChapter: i => fire("chapter", { index: i, name: CHAPTERS[i].name }),
        onPause: p => fire("pausechange", { paused: p }),
        onFilm: on => fire("filmchange", { film: on }),
        onInspect: info => fire("inspect", info),
        onFrame: (state, status) => { if (this.onframe) this.onframe(state, status); }
      });
      fire("ready");
    };
    document.readyState === "complete" ? setTimeout(boot, 0) : window.addEventListener("load", () => setTimeout(boot, 0), { once: true });
  }
  disconnectedCallback() { if (this._f) { this._f.dispose(); this._f = null; this._host && this._host.remove(); this._host = null; } }
  attributeChangedCallback(name, _old, value) { const k = ATTRS[name]; if (k) this.set({ [k]: value }); }
  get figure() { return this._f; }
  get theme() { return this._f ? this._f.values.theme : this._pending.theme || DEFAULTS.theme; }
  set theme(v) { this.set({ theme: v }); }
  set(v) { this._f ? this._f.set(v) : Object.assign(this._pending, v); }
  pause() { this._f?.pause(); }
  play() { this._f?.play(); }
  resetView() { this._f?.resetView(); }
  phase(i) { this._f?.phase(Math.max(0, Math.min(CHAPTERS.length - 1, Number(i) || 0))); }
  toggle(k) { this._f?.toggle(k); }
}
if (typeof customElements < "u" && !customElements.get("vande-bharat-figure")) customElements.define("vande-bharat-figure", VandeBharatFigure);
globalThis.MFVB = { DEFAULTS, CHAPTERS, THEMES, TOGGLES, PAINT_GROUPS, LIVERIES, PARTS, createVandeBharat };
