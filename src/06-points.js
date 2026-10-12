/* ---------- point-cloud rendering: every surface resampled into dots ---------- */
// Points live as children of the meshes they were sampled from, so every animation
// (doors, wheels, pantograph, explode) carries them along for free.
function sampleSurface(geo, perM2, rand, xf = null, minPerM = 0) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  const P = g.attributes.position.array, Nn = g.attributes.normal.array, tri = P.length / 9;
  const cum = new Float64Array(tri);
  let area = 0;
  const a = new T.Vector3, b = new T.Vector3, c = new T.Vector3;
  for (let i = 0; i < tri; i++) {
    a.fromArray(P, i * 9); b.fromArray(P, i * 9 + 3); c.fromArray(P, i * 9 + 6);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
    cum[i] = area;
  }
  if (!g.boundingBox) g.computeBoundingBox();
  const span = g.boundingBox.getSize(new T.Vector3()), longest = Math.max(span.x, span.y, span.z) * (xf ? 1 : 1);
  // thin, long things (wires, rails, arms) get points by length as well as by area
  const n = Math.min(400000, Math.round(Math.max(area * perM2, longest * minPerM) + rand()));
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), sc = new Float32Array(n * 3), jit = new Float32Array(n), keep = new Float32Array(n);
  const p = new T.Vector3, q = new T.Vector3;
  for (let k = 0; k < n; k++) {
    const r = rand() * area;
    let lo = 0, hi = tri - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    let u = rand(), v = rand();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v, o = lo * 9;
    for (let j = 0; j < 3; j++) {
      pos[k * 3 + j] = P[o + j] * w + P[o + 3 + j] * u + P[o + 6 + j] * v;
      nor[k * 3 + j] = Nn[o + j] * w + Nn[o + 3 + j] * u + Nn[o + 6 + j] * v;
    }
    // a direction to drift along when the figure comes apart: mostly outward and up
    const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1), d = .6 + rand() * 1.4;
    sc[k * 3] = Math.sin(ph) * Math.cos(th) * d; sc[k * 3 + 1] = Math.abs(Math.cos(ph)) * d * 1.3; sc[k * 3 + 2] = Math.sin(ph) * Math.sin(th) * d;
    jit[k] = rand(); keep[k] = rand();
  }
  if (xf) {
    const nm = new T.Matrix3().getNormalMatrix(xf);
    for (let k = 0; k < n; k++) {
      p.fromArray(pos, k * 3).applyMatrix4(xf).toArray(pos, k * 3);
      q.fromArray(nor, k * 3).applyMatrix3(nm).toArray(nor, k * 3);
    }
  }
  return { n, area, pos, nor, sc, jit, keep };
}
function cloudGeometry(parts) {
  const n = parts.reduce((s, p) => s + p.n, 0), g = new T.BufferGeometry;
  const cat = (key, size) => { const out = new Float32Array(n * size); let o = 0; for (const p of parts) { out.set(p[key], o); o += p[key].length; } return out; };
  g.setAttribute("position", new T.BufferAttribute(cat("pos", 3), 3));
  g.setAttribute("normal", new T.BufferAttribute(cat("nor", 3), 3));
  g.setAttribute("aScat", new T.BufferAttribute(cat("sc", 3), 3));
  g.setAttribute("aJit", new T.BufferAttribute(cat("jit", 1), 1));
  g.setAttribute("aKeep", new T.BufferAttribute(cat("keep", 1), 1));
  return g;
}

function buildCloud(ctx, roots, density) {
  const rand = rng(2026), clouds = [], cache = new Map;
  const pointsMat = src => {
    if (!cache.has(src.uuid)) {
      const { fam, o } = src.userData.toonArgs, shellSrc = !!(src.clippingPlanes && src.clippingPlanes.length === 1);
      const m = toon(ctx.U, fam, { ...o, points: true, ghost: shellSrc, clip: shellSrc ? undefined : o.clip, side: T.FrontSide });
      cache.set(src.uuid, ctx.track(m));
    }
    return cache.get(src.uuid);
  };
  let total = 0, area = 0;
  for (const root of roots) {
    const list = [];
    root.traverse(o => { if (o.isMesh && o.layers.mask === 1 && o.material && o.material.userData && o.material.userData.toonArgs) list.push(o); });
    for (const m of list) {
      const per = (m.userData.part ? 300 : m.userData.cloud ?? 150) * density, minL = (m.userData.part ? 60 : 45) * density;
      let parts;
      if (m.isInstancedMesh) {
        parts = [];
        const mx = new T.Matrix4;
        for (let i = 0; i < m.count; i++) { m.getMatrixAt(i, mx); parts.push(sampleSurface(m.geometry, per, rand, mx.clone(), 0)); }
      } else parts = [sampleSurface(m.geometry, per, rand, null, minL)];
      const g = cloudGeometry(parts);
      const pts = new T.Points(g, pointsMat(m.material));
      pts.receiveShadow = true; pts.castShadow = false; pts.frustumCulled = false;
      pts.userData.cloud = true;
      m.add(pts);
      clouds.push(pts);
      total += g.attributes.position.count; area += parts.reduce((s, p) => s + p.area, 0);
    }
  }
  return { clouds, total, area, materials: [...cache.values()] };
}

// glowing particles that run along a set of curves
function buildStreams(curves, colour, alpha, o = {}) {
  const per = o.per || 90, samples = curves.map(c => c.getSpacedPoints(400));
  const lens = curves.map(c => c.getLength());
  const n = curves.length * per, g = new T.BufferGeometry, pos = new Float32Array(n * 3), seed = new Float32Array(n);
  const r = rng(o.seed || 3);
  for (let i = 0; i < n; i++) seed[i] = r();
  g.setAttribute("position", new T.BufferAttribute(pos, 3));
  g.setAttribute("aSeed", new T.BufferAttribute(seed, 1));
  const size = { value: 4 };
  const mat = new T.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: o.depthTest ?? true, blending: T.NormalBlending,
    uniforms: { uC: colour, uA: alpha, uSize: size },
    vertexShader: "attribute float aSeed; varying float vS; uniform float uSize; void main(){ vS = aSeed; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_PointSize = uSize * (0.6 + 0.8 * aSeed); }",
    fragmentShader: "uniform vec3 uC; uniform float uA; varying float vS; void main(){ vec2 p = gl_PointCoord * 2.0 - 1.0; float r = dot(p, p); if (r > 1.0) discard; gl_FragColor = vec4(uC, uA * (1.0 - r * 0.6) * (0.55 + 0.45 * vS)); }"
  });
  const pts = new T.Points(g, mat);
  pts.frustumCulled = false; pts.layers.set(1); pts.renderOrder = 9;
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) phase[i] = (i % per) / per + seed[i] / per;
  return {
    pts, mat, size,
    update(dt, speed) {
      if (!pts.visible) return;
      for (let c = 0; c < curves.length; c++) {
        const sp = samples[c], m = sp.length - 1, step = speed * dt / lens[c];
        for (let k = 0; k < per; k++) {
          const i = c * per + k;
          phase[i] = ((phase[i] + step * (.8 + .4 * seed[i])) % 1 + 1) % 1;
          const f = phase[i] * m, j = Math.min(m - 1, Math.floor(f)), t = f - j, a = sp[j], b = sp[j + 1];
          pos[i * 3] = a.x + (b.x - a.x) * t; pos[i * 3 + 1] = a.y + (b.y - a.y) * t; pos[i * 3 + 2] = a.z + (b.z - a.z) * t;
        }
      }
      g.attributes.position.needsUpdate = true;
    }
  };
}
