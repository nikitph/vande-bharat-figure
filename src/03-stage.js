/* ---------- the stage: track, platform, overhead line ---------- */
const HX = 46, ZN = -6.5, ZF = 9.5, Y0 = -.72, SLAB = 1.1, MAST_PITCH = 27, SCENE_PITCH = 54, PLAT_HALF = 55;
const wrapSym = (v, p) => ((v % p) + p * 1.5) % p - p * .5;

function segment(a, b, r, seg = 6) {
  const d = V3(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = d.length();
  const g = new T.CylinderGeometry(r, r, len, seg, 1, false);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
}

function buildStage(ctx) {
  const { U } = ctx, sm = ctx.stageMat;
  const root = new T.Group;
  const S = (parent, g, material, cast = true) => {
    const m = mesh(g, material, cast, true);
    m.userData.nmat = ctx.stageNormal;
    parent.add(m);
    return m;
  };
  // the slab of ground the scene sits on
  const c = 1.2, outline = [[-HX + c, ZN], [HX - c, ZN], [HX, ZN + c], [HX, ZF - c], [HX - c, ZF], [-HX + c, ZF], [-HX, ZF - c], [-HX, ZN + c]];
  const slab = new T.ExtrudeGeometry(new T.Shape(outline.map(([x, z]) => new T.Vector2(x, z))), { depth: SLAB, bevelEnabled: false });
  slab.rotateX(Math.PI / 2);
  slab.translate(0, Y0, 0);
  root.add(mesh(slab, ctx.track(toon(U, "deck", { color: "soil", strata: .3 })), false, true));

  // ballast, rails
  S(root, extrudeX([[-2.9, Y0], [-2.0, -.25], [2.0, -.25], [2.9, Y0]], -HX + .03, HX - .03), sm("deck", "ballast"));
  const rails = [];
  for (const sz of [-1, 1]) rails.push(at(box(2 * HX - .06, .14, .075), 0, -.07, sz * .873), at(box(2 * HX - .06, .03, .15), 0, -.155, sz * .873));
  S(root, merge(rails), sm("dark", "rail"));
  // sleepers scroll under the train
  const nS = Math.ceil(2 * HX / .65) + 4;
  const sleepers = new T.InstancedMesh(box(.26, .17, 2.75), sm("mark", "sleeper"), nS);
  const mtx = new T.Matrix4;
  for (let i = 0; i < nS; i++) sleepers.setMatrixAt(i, mtx.makeTranslation((i - nS / 2) * .65, -.255, 0));
  sleepers.castShadow = false; sleepers.receiveShadow = true; sleepers.userData.nmat = ctx.stageNormal;
  const gSleep = new T.Group;
  gSleep.add(sleepers); root.add(gSleep);

  // contact wire (the same everywhere, so it does not need to move)
  S(root, at(cyl(.02, 2 * HX - .06, "x", 6), 0, WIRE_Y + .02, 0), sm("deck", "wire"), false);

  // masts, cantilevers, catenary wire and droppers: one 27 m span, repeated
  const gOhe = new T.Group;
  root.add(gOhe);
  {
    const mast = [], arm = [], ins = [], wire = [];
    for (let k = -3; k <= 3; k++) {
      const x = k * MAST_PITCH, mz = 3.15;
      mast.push(at(box(.2, 7.7, .24), x, Y0 + 3.85, mz), at(box(.5, .12, .5), x, Y0 + .9, mz));
      arm.push(segment([x, 6.78, mz], [x, 6.78, -.25], .035), segment([x, 5.6, mz], [x, 6.74, .5], .03), segment([x, 6.74, 1.15], [x, 5.74, 1.15], .025), segment([x, 5.74, 1.2], [x, 5.62, 0], .02));
      for (const y of [6.78, 5.66]) for (let j = 0; j < 4; j++) ins.push(at(cyl(.09, .03, "z", 10), x, y + (y < 6 ? j * .028 : 0), mz - .25 - j * .09));
      if (k < 3) {
        const N = 14, py = u => 6.72 - .78 * (1 - (2 * u - 1) ** 2);
        for (let j = 0; j < N; j++) wire.push(segment([x + j / N * MAST_PITCH, py(j / N), 0], [x + (j + 1) / N * MAST_PITCH, py((j + 1) / N), 0], .018, 5));
        for (const u of [.14, .32, .5, .68, .86]) wire.push(segment([x + u * MAST_PITCH, py(u), 0], [x + u * MAST_PITCH, WIRE_Y + .03, 0], .01, 4));
      }
    }
    S(gOhe, merge(mast), sm("deck", "mast"));
    S(gOhe, merge(arm), sm("deck", "mast"));
    S(gOhe, merge(ins), sm("deck", "insulator"), false);
    S(gOhe, merge(wire), sm("deck", "wire"), false);
  }

  // lineside on the near side: cable trough, cabinets, scrub
  const gSide = new T.Group;
  root.add(gSide);
  {
    const r = rng(11), bush = [], cab = [], post = [];
    for (let k = -2; k <= 2; k++) {
      const r2 = rng(5);
      for (let i = 0; i < 7; i++) {
        const x = k * SCENE_PITCH + (r2() - .5) * SCENE_PITCH, z = -3.9 - r2() * 2.1, s = .28 + r2() * .4;
        const b = new T.IcosahedronGeometry(s, 0);
        b.scale(1.3, .75, 1.1); b.rotateY(r2() * 3);
        bush.push(at(b, x, Y0 + s * .5, z));
      }
      cab.push(at(rbox(.9, 1.1, .5, .04), k * SCENE_PITCH + 9, Y0 + .55, -4.6));
      post.push(at(box(.12, 1.0, .12), k * SCENE_PITCH - 14, Y0 + .5, -3.5), at(box(.34, .3, .04), k * SCENE_PITCH - 14, Y0 + .95, -3.5));
    }
    void r;
    S(gSide, merge(bush), sm("deck", "scrub"));
    S(gSide, merge(cab), sm("mark", "cabinet"));
    S(gSide, merge(post), sm("mark", "post"));
  }
  S(root, at(box(2 * HX - .06, .12, .4), 0, Y0 + .06, -3.25), sm("mark", "trough"), false);

  // the platform slides in and out as the train arrives and leaves
  const gPlat = new T.Group;
  root.add(gPlat);
  {
    const P = PLAT_HALF;
    S(gPlat, extrudeX([[1.78, Y0], [1.78, .72], [1.70, .72], [1.70, .84], [ZF - .03, .84], [ZF - .03, Y0]], -P, P), sm("deck", "paving"));
    S(gPlat, at(box(2 * P, .014, .3), 0, .847, 2.55), sm("mark", "platformEdge"), false);
    S(gPlat, at(box(2 * P, .014, .1), 0, .847, 1.86), sm("mark", "platformLine"), false);
    const bench = [], lamp = [], sign = [];
    for (const x of [-38, -19, 0, 19, 38]) {
      bench.push(at(rbox(1.8, .07, .5, .02), x, .84 + .45, 6.6), at(rbox(1.8, .5, .06, .02), x, .84 + .78, 6.86));
      for (const s of [-.75, .75]) bench.push(at(box(.07, .45, .45), x + s, .84 + .22, 6.6));
    }
    for (const x of [-47, -28.5, -9.5, 9.5, 28.5, 47]) {
      lamp.push(at(cyl(.06, 4.2, "y", 8), x, .84 + 2.1, 8.7), segment([x, 5.0, 8.7], [x, 5.15, 7.7], .04), at(rbox(.26, .08, .7, .02), x, 5.13, 7.5));
    }
    for (const x of [-9.5]) {
      sign.push(at(box(.1, 2.3, .1), x - 1.6, .84 + 1.15, 7.9), at(box(.1, 2.3, .1), x + 1.6, .84 + 1.15, 7.9));
    }
    S(gPlat, merge(bench), sm("body", "bench"));
    S(gPlat, merge(lamp.concat(sign)), sm("deck", "mast"));
    S(gPlat, at(rbox(3.6, .9, .08, .02), -9.5, .84 + 2.2, 7.9), sm("mark", "signboard"));
    S(gPlat, at(box(3.3, .14, .02), -9.5, .84 + 1.95, 7.85), sm("deck", "stripe"), false);
  }

  // streaks in the air at speed
  const streakA = { value: 0 };
  const streakMat = ctx.track(new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: { uC: U.ink, uA: streakA },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }",
    fragmentShader: "uniform vec3 uC; uniform float uA; varying vec2 vUv; void main(){ float a = uA * smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.6, vUv.x); gl_FragColor = vec4(uC, a); }"
  }));
  const NST = 40, streaks = new T.InstancedMesh(new T.PlaneGeometry(1, 1), streakMat, NST), sr = rng(7), sd = [];
  streaks.layers.set(1); streaks.renderOrder = 2; streaks.frustumCulled = false;
  root.add(streaks);
  for (let i = 0; i < NST; i++) sd.push({ y: 1 + sr() * 5.5, z: sr() < .5 ? -2.2 - sr() * 3.5 : 2.2 + sr() * 3, ph: sr(), L: 3 + sr() * 7, sp: .8 + sr() * .5 });
  const q = new T.Quaternion, p = new T.Vector3, sc = new T.Vector3;

  function update(St, time) {
    gSleep.position.x = -wrapSym(St.s, .65);
    gOhe.position.x = -wrapSym(St.s, MAST_PITCH);
    gSide.position.x = -wrapSym(St.s + 20, SCENE_PITCH);
    const px = wrapSym(-St.s, St.period);
    gPlat.position.x = px;
    gPlat.visible = platform && Math.abs(px) < PLAT_HALF + HX + 1;
    const a = clamp(St.speed / 160) * St.streaks * (1 - St.explode);
    streaks.visible = a > .01;
    streakA.value = a * .5;
    if (streaks.visible) {
      const span = 2 * HX - 6;
      sd.forEach((d, i) => {
        const x = ((d.ph * span - time * 34 * d.sp) % span + span) % span - span / 2;
        mtx.compose(p.set(x, d.y, d.z), q, sc.set(d.L, .05, 1));
        streaks.setMatrixAt(i, mtx);
      });
      streaks.instanceMatrix.needsUpdate = true;
    }
  }
  let platform = true;
  return { root, update, setPlatform: v => { platform = !!v; } };
}
