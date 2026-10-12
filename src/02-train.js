/* ---------- the train: driving trailer + motor coach + trailer coach ---------- */
const CAR_L = 24, CAR_H = CAR_L / 2, CAR_PITCH = 24.4, NOSE_L = 3.6, FLOOR_Y = 1.28, WHEEL_R = .4575;
const WIRE_Y = 5.55, BOGIE_X = 7.45, DTC_FRONT_BOGIE = 5.6;
const CARS = [
  { kind: "TC", x: -CAR_PITCH, name: "Trailer coach" },
  { kind: "MC", x: 0, name: "Motor coach" },
  { kind: "DTC", x: CAR_PITCH, name: "Driving trailer coach" }
];
const SIDE = [[1.46, .40], [1.58, .80], [1.62, 1.28], [1.62, 2.75], [1.585, 3.2], [1.45, 3.55]];
const ROOF_R = [[1.45, 3.55], [1.2, 3.80], [.8, 3.95], [.4, 4.02], [0, 4.04]];
const mirror = pts => pts.map(([z, y]) => [-z, y]).reverse();
const ROOF = ROOF_R.concat(mirror(ROOF_R).slice(1));

// right half of the section, from the roof centre down to the skirt edge, by arc length
const HALF = [...ROOF_R].reverse().concat([...SIDE].reverse().slice(1));
const HALF_S = HALF.reduce((a, p, i) => (a.push(i ? a[i - 1] + Math.hypot(p[0] - HALF[i - 1][0], p[1] - HALF[i - 1][1]) : 0), a), []);
function ptAtArc(a) {
  const s = Math.abs(a), sg = a < 0 ? -1 : 1;
  let i = 1;
  while (i < HALF.length - 1 && HALF_S[i] < s) i++;
  const k = clamp((s - HALF_S[i - 1]) / (HALF_S[i] - HALF_S[i - 1]));
  return [sg * lerp(HALF[i - 1][0], HALF[i][0], k), lerp(HALF[i - 1][1], HALF[i][1], k)];
}
function arcAtY(y) {
  for (let i = 1; i < HALF.length; i++) {
    const y0 = HALF[i - 1][1], y1 = HALF[i][1];
    if (y <= y0 && y >= y1) return lerp(HALF_S[i - 1], HALF_S[i], y0 === y1 ? 0 : (y0 - y) / (y0 - y1));
  }
  return y > HALF[0][1] ? 0 : HALF_S[HALF_S.length - 1];
}
// the nose: the constant section squeezed to a rounded point over NOSE_L
function noseMap(t, z, y) {
  t = clamp(t);
  const h = Math.pow(1 - Math.pow(t, 2.3), .62), w = Math.pow(1 - Math.pow(t, 2.6), .5);
  const yb = .40 + .78 * Math.pow(t, 2.4);
  return [t * NOSE_L, yb + (y - .40) * h, z * w];
}
function noseGeometry() {
  const loop = SIDE.concat(ROOF_R.slice(1), mirror(ROOF_R).slice(1), mirror(SIDE).slice(1));
  const seg = [], n = loop.length;
  let total = 0;
  for (let i = 0; i < n; i++) { const a = loop[i], b = loop[(i + 1) % n]; seg.push(Math.hypot(b[0] - a[0], b[1] - a[1])); total += seg[i]; }
  const NU = 120, NT = 30, ring = [];
  for (let j = 0; j < NU; j++) {
    let s = j / NU * total, i = 0;
    while (s > seg[i] && i < n - 1) s -= seg[i++];
    const a = loop[i], b = loop[(i + 1) % n], k = seg[i] ? s / seg[i] : 0;
    ring.push([lerp(a[0], b[0], k), lerp(a[1], b[1], k)]);
  }
  const pos = [], idx = [];
  for (let i = 0; i <= NT; i++) {
    const t = Math.sin(Math.PI / 2 * i / NT);
    for (let j = 0; j < NU; j++) pos.push(...noseMap(t, ring[j][0], ring[j][1]));
  }
  for (let i = 0; i < NT; i++) for (let j = 0; j < NU; j++) {
    const a = i * NU + j, b = i * NU + (j + 1) % NU, c = a + NU, d = b + NU;
    idx.push(a, c, b, b, c, d);
  }
  const g = new T.BufferGeometry;
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// a patch lying just proud of the nose, between two arc positions that may vary with t
function nosePatch(t0, t1, a0, a1, off = .02, nt = 22, nv = 22) {
  const pos = [], idx = [];
  for (let i = 0; i <= nt; i++) {
    const t = lerp(t0, t1, i / nt), lo = a0(t), hi = a1(t);
    const [, yc] = noseMap(t, 0, 2.2);
    for (let j = 0; j <= nv; j++) {
      const [z, y] = ptAtArc(lerp(lo, hi, j / nv));
      const p = noseMap(t, z, y);
      let dy = p[1] - yc, dz = p[2];
      const l = Math.hypot(dy, dz) || 1;
      pos.push(p[0] + off * .6, p[1] + dy / l * off, p[2] + dz / l * off);
    }
  }
  for (let i = 0; i < nt; i++) for (let j = 0; j < nv; j++) {
    const a = i * (nv + 1) + j, b = a + 1, c = a + nv + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new T.BufferGeometry;
  g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const PARTS = {
  shell: ["Car body", "Structure", "Stainless-steel shell about 24 m long and 3.2 m wide. Sixteen of them make a full train."],
  roof: ["Roof", "Structure", "Carries the air-conditioning units and, on the trailer coach, the high-voltage gear."],
  nose: ["Nose", "Structure", "A moulded aerodynamic nose over the cab. There is one at each end, so the train never needs turning round."],
  windshield: ["Windshield", "Driver's cab", "A wraparound laminated screen for the loco pilot and the assistant."],
  stripe: ["Livery band", "Structure", "Blue on white here; trainsets since 2023 wear saffron and grey."],
  windows: ["Windows", "Passenger saloon", "Wide sealed double-glazed panes in one continuous dark band."],
  door: ["Plug door", "Doors", "Slides out and along the body, and closes flush with it. Released by the crew only at a standstill."],
  step: ["Sliding step", "Doors", "Slides out to bridge the gap to the platform and retracts before the train moves."],
  skirt: ["Underframe skirt", "Structure", "Hinged panels that hide the underfloor equipment and smooth the airflow."],
  endwall: ["End wall", "Structure", "The gangway opening leads into the next coach."],
  gangway: ["Sealed gangway", "Structure", "A closed bellows between coaches, so you can walk the length of the train without dust or noise."],
  coupler: ["Semi-permanent coupler", "Structure", "The coaches stay coupled as a fixed set."],
  floor: ["Floor and underframe", "Structure", "The floor sits about 1.3 m above the rails; everything heavy hangs underneath it."],
  seats: ["Seats", "Passenger saloon", "Chair car, three and two across — 78 seats in a middle coach. Executive class seats swivel to face the way you travel."],
  racks: ["Luggage racks", "Passenger saloon", "Overhead racks run the length of the saloon."],
  duct: ["Air duct", "Passenger saloon", "Conditioned air from the roof units is spread along the ceiling."],
  partition: ["Partition", "Passenger saloon", "Automatic sliding doors separate the saloon from the vestibule."],
  toilet: ["Toilet module", "Passenger saloon", "Bio-vacuum toilets, touch-free fittings."],
  pantry: ["Pantry and cabinets", "Passenger saloon", "Hot cases, a chiller and the coach's electrical cabinets."],
  desk: ["Driver's desk", "Driver's cab", "Master controller, brake handle and displays. The same desk exists at the other end of the train."],
  screen: ["Displays", "Driver's cab", "Train control and diagnostics, with CCTV views of the platform side."],
  cabSeat: ["Crew seats", "Driver's cab", "Loco pilot on one side, assistant on the other."],
  crew: ["Loco pilot", "Driver's cab", "Two crew in the cab; a train manager looks after the doors."],
  hvac: ["Roof air-conditioning unit", "Roof", "Two packaged units per coach."],
  panto: ["Pantograph", "High voltage", "Sprung against the contact wire to collect 25,000 V AC. Shown on the trailer coach, next to the transformer it feeds."],
  vcb: ["Vacuum circuit breaker", "High voltage", "The train's main switch: it opens in milliseconds on a fault."],
  insulator: ["Roof insulators", "High voltage", "Keep 25 kV away from the roof."],
  busbar: ["High-voltage roof line", "High voltage", "Takes the current from the pantograph to the breaker and down to the transformer."],
  transformer: ["Main transformer", "Traction", "Hung under the trailer coach. Steps 25 kV down for the traction converters."],
  cooler: ["Transformer cooler", "Traction", "Oil from the transformer is cooled here by forced air."],
  converter: ["Traction converter", "Traction", "Turns single-phase AC into variable-frequency three-phase power for the motors — and back again when braking."],
  auxconv: ["Auxiliary converter", "Traction", "Powers air-conditioning, lights and sockets."],
  battery: ["Battery box", "Auxiliaries", "Keeps control circuits and emergency lighting alive without the overhead supply."],
  compressor: ["Air compressor", "Auxiliaries", "Supplies air for the brakes, the suspension and the doors."],
  reservoir: ["Air reservoirs", "Auxiliaries", "Stored compressed air."],
  brakeUnit: ["Brake control unit", "Auxiliaries", "Blends regenerative and friction braking."],
  bogieFrame: ["Bogie frame", "Bogie", "A fabricated frame carrying two axles."],
  wheelset: ["Wheelset", "Bogie", "915 mm wheels on Indian broad gauge, 1,676 mm between the rails."],
  brakeDisc: ["Brake discs", "Bogie", "Friction brakes for the last few km/h and for emergencies."],
  axlebox: ["Axle box and primary springs", "Bogie", "Coil springs between axle and bogie frame."],
  airSpring: ["Air spring", "Bogie", "The body rides on air bags, kept level whatever the load."],
  bolster: ["Bolster", "Bogie", "Joins the bogie to the body."],
  damper: ["Dampers", "Bogie", "Hydraulic dampers calm bounce and hunting at speed."],
  motor: ["Traction motor", "Traction", "Three-phase induction motor, fully suspended from the bogie frame. Four per motor coach."],
  gearbox: ["Gearbox", "Traction", "Takes the motor's drive to the axle."]
};

function buildTrain(ctx) {
  const { U } = ctx;
  const root = new T.Group, body = new T.Group;
  root.add(body);
  const parts = [], exGroups = [], doors = [], steps = [], wheelsets = [], cars = [];
  const anchors = {};
  const M = (parent, g, material, part, o = {}) => {
    const m = mesh(g, material, o.cast ?? true, true);
    m.userData.part = part;
    if (o.shell) { m.userData.shell = true; m.userData.nmat = ctx.shellNormal; }
    parent.add(m);
    parts.push(m);
    return m;
  };
  const mat = ctx.mat, shell = ctx.shell;
  const exGroup = (parent, ex, d) => {
    const g = new T.Group;
    g.userData.ex = V3(...ex); g.userData.d = d;
    parent.add(g); exGroups.push(g);
    return g;
  };

  /* ----- bogie ----- */
  function buildBogie(parent, x, motor) {
    const g = new T.Group;
    g.position.set(x, 0, 0);
    parent.add(g);
    const mFrame = mat("deck", "bogie"), mDark = mat("dark", "rubber"), mWheel = mat("deck", "wheel");
    const frame = [];
    for (const sz of [-1, 1]) {
      frame.push(at(rbox(3.5, .22, .2, .04), 0, .62, sz * 1.03));
      frame.push(at(box(.5, .16, .2), 0, .76, sz * 1.03));
    }
    for (const sx of [-1, 1]) frame.push(at(rbox(.26, .2, 2.06, .04), sx * .5, .6, 0));
    M(g, merge(frame), mFrame, "bogieFrame");
    const WB = 1.28, ax = [], sp = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      ax.push(at(rbox(.36, .34, .22, .04), sx * WB, WHEEL_R, sz * 1.05));
      sp.push(at(cyl(.1, .22, "y", 10), sx * WB, .56 + WHEEL_R - .34, sz * 1.05));
      sp.push(at(cyl(.07, .2, "y", 8), sx * (WB - .34), .46, sz * 1.03));
    }
    M(g, merge(ax), mFrame, "axlebox");
    M(g, merge(sp), mat("mark", "spring"), "axlebox");
    const air = [], top = [];
    for (const sz of [-1, 1]) {
      air.push(at(cyl(.3, .2, "y", 18), 0, .94, sz * 1.03));
      top.push(at(cyl(.33, .04, "y", 18), 0, 1.05, sz * 1.03));
    }
    M(g, merge(air), mDark, "airSpring");
    M(g, merge(top.concat([at(rbox(.6, .14, 2.5, .03), 0, 1.13, 0)])), mFrame, "bolster");
    const dm = [];
    for (const sz of [-1, 1]) {
      dm.push(at(cyl(.045, 1.1, "x", 8), .95, .78, sz * 1.2));
      const v = cyl(.04, .5, "y", 8); v.rotateZ(.35); dm.push(at(v, -.35, .86, sz * 1.2));
    }
    M(g, merge(dm), mat("mark", "damper"), "damper");
    for (const sx of [-1, 1]) {
      const ws = new T.Group;
      ws.position.set(sx * WB, WHEEL_R, 0);
      g.add(ws);
      const w = [cyl(.085, 2.3, "z", 12)];
      for (const sz of [-1, 1]) {
        w.push(at(cyl(WHEEL_R, .13, "z", 28), 0, 0, sz * .86));
        w.push(at(cyl(.495, .03, "z", 28), 0, 0, sz * .78));
        w.push(at(cyl(.16, .2, "z", 12), 0, 0, sz * .9));
        for (let k = 0; k < 4; k++) w.push(at(cyl(.045, .03, "z", 8), Math.cos(k * Math.PI / 2 + .4) * .29, Math.sin(k * Math.PI / 2 + .4) * .29, sz * .935));
      }
      M(ws, merge(w), mWheel, "wheelset");
      if (!motor) {
        const d = [];
        for (const sz of [-1, 1]) {
          d.push(at(cyl(.31, .07, "z", 22), 0, 0, sz * .36));
          for (let k = 0; k < 6; k++) d.push(at(cyl(.035, .08, "z", 6), Math.cos(k * Math.PI / 3) * .21, Math.sin(k * Math.PI / 3) * .21, sz * .36));
        }
        M(ws, merge(d), mat("mark", "brake"), "brakeDisc");
        const cal = [];
        for (const sz of [-1, 1]) cal.push(at(rbox(.22, .2, .2, .03), sx * (WB - .36), WHEEL_R + .08, sz * .36));
        M(g, merge(cal), mFrame, "brakeDisc");
      } else {
        const mo = [at(cyl(.29, .8, "z", 20), sx * (WB - .6), .5, -.16)];
        for (let k = 0; k < 5; k++) mo.push(at(cyl(.31, .03, "z", 20), sx * (WB - .6), .5, -.48 + k * .16));
        mo.push(at(rbox(.3, .14, .3, .03), sx * (WB - .6), .82, -.16));
        M(g, merge(mo), mat("body", "motor", { emis: U.heat, emisColor: U.heatC }), "motor");
        M(g, merge([at(rbox(.82, .6, .2, .05), sx * (WB - .3), .47, .44), at(cyl(.34, .22, "z", 18), sx * WB, WHEEL_R, .44)]), mat("deck", "gearbox"), "gearbox");
        wheelsets.push(ws);
        continue;
      }
      wheelsets.push(ws);
    }
    return g;
  }

  /* ----- one car ----- */
  function buildCar(spec) {
    const { kind } = spec, isD = kind === "DTC";
    const g = new T.Group;
    g.position.x = spec.x;
    g.userData.sep = isD ? 5 : kind === "TC" ? -5 : 0;
    body.add(g);
    const x0 = -CAR_H + .03, x1 = isD ? CAR_H - NOSE_L : CAR_H - .03;
    const frontBogie = isD ? DTC_FRONT_BOGIE : BOGIE_X;
    const doorXs = isD ? [-9.6, 3.9] : [-9.6, 9.6];
    const gFloor = exGroup(g, [0, 2.2, 0], .5);
    const gUnder = exGroup(g, [0, 1.0, 0], .6);
    const gRoof = exGroup(g, [0, 4.6, 0], .2);
    const gRoofEq = exGroup(g, [0, 6.0, 0], .1);
    const walls = { "-1": exGroup(g, [0, 2.2, -2.6], .35), "1": exGroup(g, [0, 2.2, 2.6], .35) };
    const mBody = shell("body", "body"), mSkirt = shell("deck", "skirt"), mBand = shell("dark", "band");
    const mGlass = shell("dark", "glass", { emis: U.cabinGlow, emisColor: U.cabin });

    // floor and underframe
    const fl = [at(box(x1 - x0 - .1, .3, 3.1), (x0 + x1) / 2, FLOOR_Y - .15, 0)];
    if (isD) fl.push(at(box(1.5, .3, 2.5), x1 + .7, FLOOR_Y - .15, 0));
    M(gFloor, merge(fl), mat("deck", "floor"), "floor");

    // side walls, split round the doorways
    const wallPts = SIDE.slice(2), headPts = SIDE.slice(4), skirtPts = SIDE.slice(0, 3);
    for (const sz of [-1, 1]) {
      const W = walls[sz];
      const side = p => sz > 0 ? p : mirror(p);
      const segs = [], heads = [];
      let x = x0;
      for (const dx of doorXs) {
        segs.push(extrudeX(strip(side(wallPts), .07), x, dx - .5));
        heads.push(extrudeX(strip(side(headPts), .07), dx - .5, dx + .5));
        x = dx + .5;
      }
      segs.push(extrudeX(strip(side(wallPts), .07), x, x1));
      M(W, merge(segs.concat(heads)), mBody, "shell", { shell: true });
      // skirts between and beyond the bogies
      const sk = [];
      const ranges = isD ? [[x0, -9.45], [-5.45, 3.65], [7.55, x1]] : [[x0, -9.45], [-5.45, 5.45], [9.45, x1]];
      for (const [a, b] of ranges) sk.push(extrudeX(strip(side(skirtPts), .05), a, b));
      M(W, merge(sk), mSkirt, "skirt", { shell: true });
      // window band, panes and the livery band
      const wa = -8.9, wb = isD ? 3.2 : 8.9, panes = [], n = Math.floor((wb - wa) / 1.9);
      const pitch = (wb - wa) / n;
      for (let i = 0; i < n; i++) panes.push(at(rbox(pitch - .22, .7, .03, .01), wa + pitch * (i + .5), 2.35, sz * 1.634));
      if (isD) panes.push(at(rbox(1.5, .62, .03, .01), 6.6, 2.42, sz * 1.634));
      M(W, at(box(wb - wa + .1, .86, .02), (wa + wb) / 2, 2.35, sz * 1.622), mBand, "windows", { shell: true, cast: false });
      M(W, merge(panes), mGlass, "windows", { shell: true, cast: false });
      const sa = doorXs[0] + .52, sb = isD ? x1 : doorXs[1] - .52;
      const st = [at(box(sb - sa, .22, .02), (sa + sb) / 2, 1.62, sz * 1.622)];
      if (isD) st.length = 0, st.push(at(box(doorXs[1] - .52 - sa, .22, .02), (sa + doorXs[1] - .52) / 2, 1.62, sz * 1.622), at(box(x1 - doorXs[1] - .52, .22, .02), (x1 + doorXs[1] + .52) / 2, 1.62, sz * 1.622));
      M(W, merge(st), shell("deck", "stripe"), "stripe", { shell: true, cast: false });
      // luggage rack
      M(W, at(box(wb - wa, .04, .42), (wa + wb) / 2, 3.02, sz * 1.33), shell("mark", "rack"), "racks", { shell: true });
      // doors and steps
      for (const dx of doorXs) {
        const dg = new T.Group;
        dg.position.set(dx, 0, 0);
        W.add(dg);
        M(dg, at(rbox(.98, 1.9, .05, .015), 0, FLOOR_Y + .96, sz * 1.612), shell("body", "door"), "door", { shell: true });
        M(dg, at(rbox(.5, .78, .02, .008), 0, 2.5, sz * 1.642), mGlass, "door", { shell: true, cast: false });
        doors.push({ g: dg, sz, dir: dx < 0 ? 1 : -1, x: dx });
        const sg = M(W, at(rbox(.96, .04, .3, .012), dx, FLOOR_Y - .09, sz * 1.44), shell("deck", "step"), "step", { shell: true });
        steps.push({ m: sg, sz });
      }
    }

    // roof, ceiling duct
    M(gRoof, extrudeX(strip(ROOF, .07), x0, x1), shell("body", "roof"), "roof", { shell: true });
    M(gRoof, at(box(x1 - x0 - 3, .12, .9), (x0 + x1) / 2, 3.86, 0), shell("mark", "duct"), "duct", { shell: true, cast: false });

    // end walls with the gangway opening
    const endPts = [[1.6, .98], ...SIDE.slice(2), ...ROOF_R.slice(1), ...mirror(ROOF_R).slice(1), ...mirror(SIDE.slice(2)).slice(1), [-1.6, .98]];
    const hole = [[.5, FLOOR_Y], [.5, 3.25], [-.5, 3.25], [-.5, FLOOR_Y]];
    const ends = [extrudeX(endPts, x0, x0 + .06, [hole])];
    if (!isD) ends.push(extrudeX(endPts, x1 - .06, x1, [hole]));
    M(gFloor, merge(ends), mBody, "endwall", { shell: true });
    // gangway bellows and coupler towards the next car (and a stub behind the last one)
    const ringO = [[.72, 1.2], [.72, 3.4], [-.72, 3.4], [-.72, 1.2]], ringI = [[.52, FLOOR_Y], [.52, 3.24], [-.52, 3.24], [-.52, FLOOR_Y]];
    const gw = [], cp = [];
    if (!isD) {
      for (let i = 0; i < 4; i++) gw.push(extrudeX(ringO.map(([z, y]) => [z * (i % 2 ? .96 : 1), i % 2 ? lerp(2.3, y, .97) : y]), CAR_H + i * .1, CAR_H + i * .1 + .1, [ringI]));
      cp.push(at(cyl(.11, .9, "x", 10), CAR_H + .2, .95, 0), at(rbox(.3, .3, .34, .04), CAR_H + .2, .95, 0));
    }
    if (kind === "TC") {
      gw.push(extrudeX(ringO, -CAR_H - .22, -CAR_H, [ringI]));
      cp.push(at(cyl(.11, .5, "x", 10), -CAR_H - .2, .95, 0));
    }
    if (gw.length) M(gFloor, merge(gw), mat("dark", "gangway"), "gangway");
    if (cp.length) M(gUnder, merge(cp), mat("dark", "rubber"), "coupler");

    // saloon: seats three-and-two across
    const rows = isD ? 9 : 16, rx0 = isD ? -8.2 : -7.2, seat = [], head = [], ped = [];
    for (let r = 0; r < rows; r++) for (const z of [.38, .84, 1.30, -.84, -1.30]) {
      const x = rx0 + r * .95;
      seat.push(at(rbox(.46, .12, .42, .03), x, FLOOR_Y + .47, z));
      const b = rbox(.1, .66, .42, .03); b.rotateZ(.16); seat.push(at(b, x - .27, FLOOR_Y + .86, z));
      const h = rbox(.08, .2, .3, .02); h.rotateZ(.16); head.push(at(h, x - .33, FLOOR_Y + 1.24, z));
      ped.push(at(box(.28, .4, .3), x, FLOOR_Y + .2, z));
    }
    M(gFloor, merge(seat), mat("body", "seat"), "seats");
    M(gFloor, merge(head), mat("mark", "headrest"), "seats", { cast: false });
    M(gFloor, merge(ped), mat("dark", "rubber"), "seats", { cast: false });
    // partitions
    const partPts = [[1.5, FLOOR_Y], [1.5, 3.15], [1.3, 3.5], [-1.3, 3.5], [-1.5, 3.15], [-1.5, FLOOR_Y]];
    const ph = [[.42, FLOOR_Y + .001], [.42, 3.2], [-.42, 3.2], [-.42, FLOOR_Y + .001]];
    const pxs = isD ? [-8.95, 3.25, 4.6] : [-8.95, 8.95];
    M(gFloor, merge(pxs.map(px => extrudeX(partPts, px - .03, px + .03, [ph]))), mat("mark", "partition"), "partition");
    // toilets, pantry, cabinets
    const tl = [];
    for (const sz of [-1, 1]) tl.push(at(rbox(1.5, 2.05, .95, .05), isD ? -11.0 : 11.0, FLOOR_Y + 1.03, sz * 1.04));
    M(gFloor, merge(tl), mat("body", "toilet"), "toilet");
    const pn = [];
    if (isD) pn.push(at(rbox(2.4, 1.9, .7, .04), 1.6, FLOOR_Y + .96, 1.17), at(rbox(1.6, 1.1, .7, .04), 1.2, FLOOR_Y + .56, -1.17));
    else pn.push(at(rbox(1.4, 1.9, .7, .04), -11.0, FLOOR_Y + .96, 1.17), at(rbox(1.4, 1.1, .7, .04), -11.0, FLOOR_Y + .56, -1.17));
    M(gFloor, merge(pn), mat("deck", "pantry"), "pantry");

    // roof air-conditioning
    const hx = isD ? [-6, 1.2] : kind === "TC" ? [-6.4, -.2] : [-5.6, 5.6], hv = [], fan = [];
    for (const x of hx) {
      hv.push(at(rbox(3.5, .36, 1.9, .08), x, 4.04, 0));
      for (const s of [-1, 1]) { fan.push(at(cyl(.42, .03, "y", 20), x + s * .9, 4.235, 0)); fan.push(at(box(.5, .02, 1.5), x, 4.23, 0)); }
    }
    M(gRoofEq, merge(hv), mat("mark", "hvac"), "hvac");
    M(gRoofEq, merge(fan), mat("dark", "rubber"), "hvac", { cast: false });
    anchors["hvac" + kind] = kind === "MC" ? { t: "Roof AC unit", p: V3(spec.x + hx[1], 4.25, 0), n: V3(0, 1, 0) } : null;

    // underfloor equipment
    const U_Y = .64;
    const res = [];
    for (const [x, z] of [[-3.9, .7], [-3.9, -.7]]) res.push(at(cyl(.2, 1.5, "x", 14), x, .72, z));
    if (kind === "TC") {
      M(gUnder, merge([at(rbox(3.2, .66, 2.2, .06), .6, U_Y, 0), at(cyl(.22, 1.5, "z", 12), -.75, .8, 0)]), mat("body", "transformer", { emis: U.heat, emisColor: U.heatC }), "transformer");
      const co = [at(rbox(1.5, .6, 2.3, .05), 3.4, U_Y, 0)];
      for (let k = 0; k < 7; k++) for (const sz of [-1, 1]) co.push(at(box(.05, .5, .04), 2.8 + k * .2, U_Y, sz * 1.16));
      M(gUnder, merge(co), mat("deck", "cooler"), "cooler");
      M(gUnder, at(rbox(1.7, .6, 2.0, .05), -2.2, U_Y, 0), mat("mark", "auxconv"), "auxconv");
      res.length = 0;
      res.push(at(cyl(.2, 1.3, "x", 14), -4.3, .72, .7), at(cyl(.2, 1.3, "x", 14), -4.3, .72, -.7));
    } else if (kind === "MC") {
      const cv = [at(rbox(3.4, .64, 2.2, .06), .3, U_Y, 0)];
      for (let k = 0; k < 9; k++) for (const sz of [-1, 1]) cv.push(at(box(.06, .44, .04), -.9 + k * .3, U_Y, sz * 1.11));
      M(gUnder, merge(cv), mat("mark", "converter", { emis: U.heat, emisColor: U.heatC }), "converter");
      M(gUnder, merge([at(rbox(1.3, .56, 1.6, .05), 3.3, U_Y, 0), at(cyl(.42, .1, "z", 18), 3.3, U_Y, .82), at(cyl(.42, .1, "z", 18), 3.3, U_Y, -.82)]), mat("deck", "cooler"), "cooler");
      res.length = 0;
      res.push(at(cyl(.2, 1.4, "x", 14), -3.2, .72, .7), at(cyl(.2, 1.4, "x", 14), -3.2, .72, -.7));
    } else {
      M(gUnder, at(rbox(2.2, .6, 2.1, .05), 1.9, U_Y, 0), mat("deck", "battery"), "battery");
      M(gUnder, merge([at(cyl(.3, 1.2, "x", 16), -1.0, .66, .55), at(rbox(.7, .5, .7, .04), -1.0, .66, -.6), at(cyl(.2, .5, "x", 12), -1.9, .66, .55)]), mat("body", "compressor"), "compressor");
      M(gUnder, at(rbox(1.0, .56, 1.4, .05), -5.0, U_Y, 0), mat("mark", "brakeUnit"), "brakeUnit");
    }
    M(gUnder, merge(res), mat("mark", "reservoir"), "reservoir");

    // bogies (they stay on the rails when the car comes apart)
    buildBogie(g, -BOGIE_X, kind === "MC");
    buildBogie(g, frontBogie, kind === "MC");

    const car = { g, spec, hx, doorXs, x1, gRoofEq, gFloor, walls };
    cars.push(car);
    return car;
  }

  const tc = buildCar(CARS[0]), mc = buildCar(CARS[1]), dtc = buildCar(CARS[2]);

  /* ----- the nose and the cab (driving trailer) ----- */
  const nx = CAR_H - NOSE_L;
  {
    const gNose = exGroup(dtc.g, [3.4, 2.2, 0], .3);
    const ng = new T.Group;
    ng.position.x = nx;
    gNose.add(ng);
    M(ng, noseGeometry(), ctx.shell("body", "body"), "nose", { shell: true });
    const ylo = t => lerp(3.74, 2.2, sstep(.2, .64, t));
    M(ng, nosePatch(.2, .64, t => -arcAtY(ylo(t)), t => arcAtY(ylo(t)), .022, 22, 40), ctx.shell("dark", "glass", { emis: U.screenGlow }), "windshield", { shell: true, cast: false });
    for (const sz of [-1, 1]) {
      M(ng, nosePatch(0, .86, () => sz * arcAtY(1.73), () => sz * arcAtY(1.51), .018, 26, 4), ctx.shell("deck", "stripe"), "stripe", { shell: true, cast: false });
      M(ng, nosePatch(.74, .87, () => sz * arcAtY(2.12), () => sz * arcAtY(1.82), .02, 6, 6), ctx.shell("dark", "band"), "nose", { shell: true, cast: false });
    }
    // cab fittings travel with the floor
    const gF = dtc.gFloor;
    const deskPts = [[8.1, FLOOR_Y], [8.1, FLOOR_Y + .92], [8.5, FLOOR_Y + 1.12], [9.3, FLOOR_Y + .95], [9.5, FLOOR_Y]];
    M(gF, extrudeZ(deskPts, -1.2, 1.2), mat("deck", "desk"), "desk");
    const sc = [];
    for (const z of [-.75, -.25, .25, .75]) {
      const s = box(.03, .26, .4); s.rotateZ(-.45); sc.push(at(s, 8.34, FLOOR_Y + 1.06, z));
    }
    M(gF, merge(sc), mat("dark", "screen", { emis: U.screenGlow }), "screen", { cast: false });
    const cs = [], crew = [], skin = [];
    for (const z of [-.62, .62]) {
      cs.push(at(rbox(.5, .14, .5, .03), 7.3, FLOOR_Y + .5, z), at(box(.12, .5, .12), 7.3, FLOOR_Y + .22, z));
      const b = rbox(.12, .8, .5, .03); b.rotateZ(.12); cs.push(at(b, 6.98, FLOOR_Y + .95, z));
      const torso = rbox(.26, .56, .42, .06); torso.rotateZ(.1); crew.push(at(torso, 7.16, FLOOR_Y + .86, z));
      crew.push(at(rbox(.46, .16, .36, .05), 7.44, FLOOR_Y + .62, z), at(rbox(.14, .44, .34, .04), 7.68, FLOOR_Y + .34, z));
      const arm = rbox(.5, .1, .1, .03); arm.rotateZ(-.25); crew.push(at(arm, 7.5, FLOOR_Y + .98, z + .24), at(arm.clone(), 0, 0, -.48));
      skin.push(at(new T.SphereGeometry(.12, 14, 10), 7.18, FLOOR_Y + 1.3, z));
    }
    M(gF, merge(cs), mat("dark", "cabSeat"), "cabSeat");
    M(gF, merge(crew), mat("mark", "uniform"), "crew");
    M(gF, merge(skin), mat("body", "skin"), "crew");
  }

  /* ----- lamps on the nose ----- */
  const lampA = { value: 0 }, lamps = [];
  for (const sz of [-1, 1]) {
    const [z, y] = ptAtArc(sz * arcAtY(1.96));
    const p = noseMap(.8, z, y);
    const disc = new T.Mesh(new T.CircleGeometry(.34, 20), glowMaterial(U.head, lampA));
    disc.position.set(nx + p[0] + .09, p[1], p[2] + sz * .06);
    disc.rotation.y = Math.PI / 2 - sz * .5;
    disc.layers.set(1); disc.renderOrder = 5;
    dtc.g.add(disc); lamps.push(disc); ctx.track(disc.material);
  }
  const beam = new T.Mesh(new T.CircleGeometry(1, 28), glowMaterial(U.head, lampA));
  beam.rotation.x = -Math.PI / 2;
  beam.scale.set(4.6, 1.9, 1);
  beam.position.set(CAR_PITCH + CAR_H + 4.2, -.15, 0);
  beam.layers.set(1); beam.renderOrder = 2;
  root.add(beam); ctx.track(beam.material);

  /* ----- pantograph and roof high-voltage gear (trailer coach) ----- */
  const PX = 7.0, PA = { x: PX + .75, y: 4.32 }, ARM_A = 1.6, ARM_B = 1.25;
  const panto = {};
  {
    const gP = exGroup(tc.g, [0, 7.4, 0], 0);
    const mP = mat("mark", "panto"), mIns = mat("deck", "insulator");
    const ins = [];
    const insulator = (x, y, z, h = .22) => { ins.push(at(cyl(.05, h, "y", 10), x, y + h / 2, z)); for (let k = 0; k < 3; k++) ins.push(at(cyl(.1, .025, "y", 12), x, y + h * (.25 + k * .25), z)); };
    for (const sx of [-.7, .7]) for (const sz of [-.5, .5]) insulator(PX + sx, 4.0, sz, .26);
    const base = [at(box(1.7, .06, .08), PX, 4.29, .5), at(box(1.7, .06, .08), PX, 4.29, -.5), at(box(.08, .06, 1.08), PX + .75, 4.29, 0), at(box(.08, .06, 1.08), PX - .75, 4.29, 0)];
    M(gP, merge(base), mP, "panto");
    const unit = len => { const b = box(len, .06, .06); b.translate(len / 2, 0, 0); return b; };
    const lower = M(gP, merge([unit(ARM_A), at(unit(ARM_A), 0, 0, .14), at(unit(ARM_A), 0, 0, -.14)]), mP, "panto");
    const upper = M(gP, merge([at(unit(ARM_B), 0, 0, .1), at(unit(ARM_B), 0, 0, -.1)]), mP, "panto");
    const hd = [at(box(.06, .05, 1.7), -.16, 0, 0), at(box(.06, .05, 1.7), .16, 0, 0), at(box(.38, .04, .06), 0, -.03, .3), at(box(.38, .04, .06), 0, -.03, -.3)];
    for (const sx of [-.16, .16]) for (const sz of [-1, 1]) { const h = box(.05, .05, .32); h.rotateX(sz * .5); hd.push(at(h, sx, -.07, sz * .98)); }
    const headM = M(gP, merge(hd), mat("dark", "rubber"), "panto");
    Object.assign(panto, { lower, upper, head: headM });
    // breaker, busbar and the cable down to the transformer
    insulator(4.4, 4.0, 0, .3); insulator(5.4, 4.0, 0, .3); insulator(3.5, 4.0, .9, .2);
    M(gP, merge(ins), mIns, "insulator");
    M(gP, merge([at(rbox(.5, .22, .3, .03), 4.4, 4.42, 0), at(cyl(.07, .9, "x", 10), 4.4, 4.42, 0)]), mat("mark", "vcb"), "vcb");
    const bus = [at(cyl(.025, 1.9, "x", 8), 5.3, 4.34, 0)];
    const drop = cyl(.03, 1.1, "x", 8); drop.rotateY(-.75); bus.push(at(drop, 3.95, 4.3, .45));
    M(gP, merge(bus), mat("mark", "busbar"), "busbar");
  }
  function poseArm(m, x0, y0, x1, y1) { m.position.set(x0, y0, 0); m.rotation.z = Math.atan2(y1 - y0, x1 - x0); }
  function posePanto(k) {
    const px = lerp(PA.x - ARM_A + ARM_B, PX, k), py = lerp(PA.y + .1, WIRE_Y - .04, k);
    const dx = px - PA.x, dy = py - PA.y, d = Math.hypot(dx, dy);
    const a = Math.acos(clamp((ARM_A * ARM_A + d * d - ARM_B * ARM_B) / (2 * ARM_A * d), -1, 1)), phi = Math.atan2(dy, dx) + a;
    const ex = PA.x + Math.cos(phi) * ARM_A, ey = PA.y + Math.sin(phi) * ARM_A;
    poseArm(panto.lower, PA.x, PA.y, ex, ey);
    poseArm(panto.upper, ex, ey, px, py);
    panto.head.position.set(px, py, 0);
    return { ex, ey, px, py };
  }
  const up = posePanto(1);

  /* ----- power path: wire → pantograph → breaker → transformer → converter → motors ----- */
  const flowA = { value: 0 }, flowDir = { value: 1 }, flows = [], flowCurves = [];
  const TX = -CAR_PITCH;
  const tube = (pts, rep) => {
    const curve = new T.CatmullRomCurve3(pts.map(p => V3(...p)), false, "catmullrom", .08);
    const len = curve.getLength();
    const m = new T.Mesh(new T.TubeGeometry(curve, Math.max(24, Math.round(len * 5)), .06, 6, false), dashMaterial(U.flow, flowA, U.time, { depthTest: false, speed: flowDir, rep: len * (rep || .8) }));
    m.layers.set(1); m.renderOrder = 8; m.frustumCulled = false;
    root.add(m); flows.push(m); flowCurves.push(curve); ctx.track(m.material);
    return m;
  };
  tube([[TX + PX - 15, WIRE_Y, 0], [TX + PX - 1, WIRE_Y, 0], [TX + up.px, WIRE_Y - .03, 0], [TX + up.ex, up.ey, 0], [TX + PA.x, PA.y, 0], [TX + PX, 4.34, 0], [TX + 5.4, 4.36, 0], [TX + 4.4, 4.42, 0], [TX + 3.6, 4.3, .8],
    [TX + 3.5, 3.7, 1.5], [TX + 3.5, 1.3, 1.5], [TX + 2.6, .7, .9], [TX + .6, .64, 0]]);
  tube([[TX + .6, .64, .45], [TX + 6, .78, .45], [TX + CAR_H, .95, .2], [-CAR_H, .95, .2], [-6, .78, .45], [.3, .64, .45]]);
  tube([[.3, .64, -.3], [4.5, .74, -.3], [BOGIE_X - .68, .5, -.16], [BOGIE_X + .68, .5, -.16]]);
  tube([[.3, .64, -.3], [-4.5, .74, -.3], [-BOGIE_X + .68, .5, -.16], [-BOGIE_X - .68, .5, -.16]]);

  /* ----- air over the nose ----- */
  const airA = { value: 0 }, airs = [], airCurves = [];
  {
    const tip = noseMap(1, 0, 0);
    const lines = [[0, 4.04], [.9, 3.92], [-.9, 3.92], [1.62, 2.7], [-1.62, 2.7], [1.62, 1.75], [-1.62, 1.75], [1.5, 3.45], [-1.5, 3.45]];
    for (const [z0, y0] of lines) {
      const pts = [];
      for (let x = 9; x >= -17; x -= .45) {
        // x is measured from the nose tip: positive ahead of the train, negative back along it
        const far = [x, lerp(tip[1], y0, .5), z0 * .5];
        let py = far[1], pz = far[2];
        if (x <= 0) {
          // over the nose and along the body: ease onto a path a hand's width off the surface, never inside it
          const tt = clamp(1 + x / NOSE_L), s = noseMap(tt, z0, y0), yc = noseMap(tt, 0, 2.2)[1];
          const sy = s[1] - yc, sz = s[2], sl = Math.hypot(sy, sz) || 1e-6, w = sstep(0, -1.8, x);
          py = lerp(far[1], s[1] + sy / sl * .2, w); pz = lerp(far[2], s[2] + sz / sl * .2, w);
          const by = py - yc, bz = pz, bl = Math.hypot(by, bz) || 1e-6, need = sl + .16;
          if (bl < need) { py = yc + by / bl * need; pz = bz / bl * need; }
        }
        pts.push(V3(CAR_PITCH + CAR_H + x, py, pz));
      }
      const curve = new T.CatmullRomCurve3(pts, false, "centripetal");
      const m = new T.Mesh(new T.TubeGeometry(curve, 120, .035, 5, false), dashMaterial(U.air, airA, U.time, { speed: { value: 1.7 }, rep: 9 }));
      m.layers.set(1); m.renderOrder = 6; m.frustumCulled = false;
      root.add(m); airs.push(m); airCurves.push(curve); ctx.track(m.material);
    }
  }

  /* ----- callout anchors (train coordinates) ----- */
  Object.assign(anchors, {
    panto: { t: "Pantograph", p: V3(TX + PX, WIRE_Y - .1, 0), n: V3(0, 1, 0) },
    vcb: { t: "Circuit breaker", p: V3(TX + 4.4, 4.5, 0), n: V3(0, 1, 0) },
    transformer: { t: "Main transformer", p: V3(TX + .6, .7, 1.1), n: V3(0, 0, 1), sided: true, cut: true },
    converter: { t: "Traction converter", p: V3(.3, .7, 1.1), n: V3(0, 0, 1), sided: true, cut: true },
    motor: { t: "Traction motors", p: V3(BOGIE_X, .5, .9), n: V3(0, 0, 1), sided: true },
    airSpring: { t: "Air springs", p: V3(-BOGIE_X, .95, 1.03), n: V3(0, 0, 1), sided: true },
    seats: { t: "78 seats, 3 + 2", p: V3(-3, FLOOR_Y + 1.1, .9), n: V3(0, 0, 1), sided: true, cut: true },
    door: { t: "Plug door", p: V3(CAR_PITCH - 9.6, 2.6, 1.64), n: V3(0, 0, 1), sided: true, wall: true },
    cab: { t: "Driver's cab", p: V3(CAR_PITCH + 8.2, FLOOR_Y + 1.2, .6), n: V3(0, 0, 1), sided: true, cut: true },
    battery: { t: "Battery and compressor", p: V3(CAR_PITCH + 1.9, .7, 1.05), n: V3(0, 0, 1), sided: true, cut: true },
    nose: { t: "Aerodynamic nose", p: V3(CAR_PITCH + nx + 2.9, 2.2, 0), n: V3(1, .4, 0) },
    brake: { t: "Disc brakes", p: V3(CAR_PITCH + DTC_FRONT_BOGIE + 1.28, .46, .86), n: V3(0, 0, 1), sided: true }
  });
  for (const k of Object.keys(anchors)) if (!anchors[k]) delete anchors[k];

  const boxPts = [];
  for (const x of [-CAR_PITCH - CAR_H, CAR_PITCH + CAR_H]) for (const y of [0, 4.3]) for (const z of [-1.7, 1.7]) boxPts.push(V3(x, y, z));

  const opt = { tubes: true };
  function apply(S) {
    const E = S.explode;
    for (const g of exGroups) {
      const k = smoother(clamp(E * 1.6 - g.userData.d));
      g.position.copy(g.userData.ex).multiplyScalar(k);
    }
    for (const c of cars) c.g.position.x = c.spec.x + c.g.userData.sep * smoother(E);
    for (const d of doors) {
      const k = clamp(S.doors), out = smoother(clamp(k * 3.2)), slide = smoother(clamp((k - .22) / .78));
      d.g.position.set(d.x + d.dir * slide * 1.02, 0, d.sz * out * .085);
    }
    for (const s of steps) s.m.position.z = s.sz * .26 * smoother(clamp(S.doors * 2.2));
    const rot = -S.s / WHEEL_R;
    for (const w of wheelsets) w.rotation.z = rot;
    posePanto(smoother(S.panto));
    const live = sstep(.92, 1, S.panto) * (1 - sstep(0, .05, E));
    flowA.value = S.flow * live * .95;
    flowDir.value = S.power < -.05 ? -1.6 : .6 + 1.4 * Math.abs(S.power);
    for (const f of flows) f.visible = opt.tubes && flowA.value > .01;
    airA.value = S.airflow * clamp(S.speed / 110) * (1 - sstep(0, .05, E)) * .85;
    for (const a of airs) a.visible = opt.tubes && airA.value > .01;
    lampA.value = S.head * .9 * (1 - sstep(0, .2, E));
    for (const l of lamps) l.visible = lampA.value > .01;
    beam.visible = lampA.value > .01;
    U.cabinGlow.value = S.cabin * .16;
    U.heat.value = Math.abs(S.power) * .42 * live;
    U.screenGlow.value = S.cabin * .12;
  }

  return { root, body, parts, anchors, box: boxPts, apply, cars, count: parts.length, flows, airs, flowCurves, airCurves, flowA, flowDir, airA, opt };
}
