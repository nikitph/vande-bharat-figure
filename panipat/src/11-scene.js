/* ---------- the battle as data: units, their moves, the film ---------- */
// x runs east, z runs north, metres. Babur's cart line lies along z = 0 facing south;
// Ibrahim Lodi comes up from the south (from Delhi). Headings in degrees: 0 faces north, 180 south.
const SIDE_BABUR = 0, SIDE_LODI = 1;
const UNITS = [
  { id: "bGuns", side: 0, type: "gun", n: 360, name: "Matchlockmen and guns", keys: [
    [0, { x: 0, z: 9, h: 180, w: 1450, d: 5, a: 0 }], [11.5, {}], [13, { a: 1 }]] },
  { id: "bVan", side: 0, type: "cav", n: 300, name: "Vanguard", keys: [
    [0, { x: 0, z: 45, h: 180, w: 400, d: 24, a: 0 }], [12, {}], [14, { a: 1 }], [60, {}], [66, { z: -70, pace: 1.4 }], [68, { pace: .2 }]] },
  { id: "bCentre", side: 0, type: "cav", n: 700, name: "Babur, centre", keys: [
    [0, { x: 0, z: 110, h: 180, w: 450, d: 40, a: 0 }], [12.5, {}], [14.5, { a: 1 }], [61, {}], [67, { z: 25, pace: 1 }], [68, { pace: 0 }]] },
  { id: "bRight", side: 0, type: "cav", n: 600, name: "Humayun, right wing", keys: [
    [0, { x: -520, z: 95, h: 180, w: 420, d: 40, a: 0 }], [12, {}], [14, { a: 1 }],
    [48, {}], [56, { x: -900, z: -180, face: [0, -330], pace: 1.6, mv: .6 }], [62, { x: -760, z: -260, pace: 1, mv: 0 }], [68, { pace: .2 }]] },
  { id: "bLeft", side: 0, type: "cav", n: 600, name: "Left wing", keys: [
    [0, { x: 520, z: 95, h: 180, w: 420, d: 40, a: 0 }], [12.5, {}], [14.5, { a: 1 }],
    [48, {}], [56, { x: 900, z: -180, face: [0, -330], pace: 1.6, mv: .6 }], [62, { x: 760, z: -260, pace: 1, mv: 0 }], [68, { pace: .2 }]] },
  { id: "bReserve", side: 0, type: "cav", n: 400, name: "Reserve", keys: [
    [0, { x: 0, z: 235, h: 180, w: 380, d: 40, a: 0 }], [13, {}], [15, { a: 1 }]] },
  { id: "bTulR", side: 0, type: "cav", n: 260, name: "Flanking party (right)", keys: [
    [0, { x: -930, z: 80, h: 180, w: 220, d: 30, a: 0 }], [13, {}], [15, { a: 1 }],
    [48, { pace: 0 }], [49, { pace: 2, mv: 1 }], [52, { x: -1260, z: -240 }], [55, { x: -1080, z: -650 }], [58, { x: -620, z: -830, pace: 2 }],
    [59.5, { pace: .7, mv: 0, face: [0, -400] }], [67, { x: -380, z: -720 }]] },
  { id: "bTulL", side: 0, type: "cav", n: 260, name: "Flanking party (left)", keys: [
    [0, { x: 930, z: 80, h: 180, w: 220, d: 30, a: 0 }], [13.5, {}], [15.5, { a: 1 }],
    [48, { pace: 0 }], [49, { pace: 2, mv: 1 }], [52, { x: 1260, z: -240 }], [55, { x: 1080, z: -650 }], [58, { x: 620, z: -830, pace: 2 }],
    [59.5, { pace: .7, mv: 0, face: [0, -400] }], [67, { x: 380, z: -720 }]] },

  { id: "lEle", side: 1, type: "ele", n: 100, name: "War elephants", keys: [
    [0, { x: 0, z: -1500, h: 0, w: 1100, d: 24, a: 0 }], [19.5, {}], [21.5, { a: 1 }],
    [27, { pace: .8 }], [36, { z: -95 }], [37, { pace: 0 }], [38.5, { chaos: .15 }], [41, { chaos: .9, pace: 1.6, loss: .2, z: -170 }],
    [46, { chaos: 1, loss: .5, z: -260, w: 900, d: 60 }], [60, {}], [68, { loss: .78 }], [72, { loss: .86 }], [79, {}], [82, { a: 0 }]] },
  { id: "lVan", side: 1, type: "inf", n: 2000, name: "Lodi vanguard", keys: [
    [0, { x: 0, z: -1585, h: 0, w: 1200, d: 60, a: 0 }], [20, {}], [22, { a: 1 }],
    [27, { pace: 1 }], [36, { z: -175, w: 1000, d: 80 }], [37, { pace: .2 }], [40, { loss: .1, chaos: .25 }], [46, { loss: .26, chaos: .35, w: 900, d: 110 }],
    [60, {}], [68, { loss: .6, chaos: .8, w: 650, d: 150, z: -200 }], [71, {}], [76, { z: -700, loss: .7, pace: 2, chaos: .55, a: .55 }], [80, { z: -1100, a: 0 }]] },
  { id: "lCentre", side: 1, type: "inf", n: 3500, name: "Lodi centre", keys: [
    [0, { x: 0, z: -1725, h: 0, w: 1000, d: 150, a: 0 }], [20.5, {}], [22.5, { a: 1 }],
    [27, { pace: 1 }], [36, { z: -335, w: 850, d: 200 }], [37, { pace: .2 }], [46, { loss: .08, chaos: .2, w: 800, d: 230 }],
    [52, {}], [59, { w: 700, d: 260, chaos: .4, loss: .18 }], [68, { w: 520, d: 300, chaos: .8, loss: .5 }],
    [71, {}], [77, { z: -900, pace: 2, loss: .62, a: .5, chaos: .5 }], [81, { z: -1300, a: 0 }]] },
  { id: "lRight", side: 1, type: "cav", n: 2200, name: "Lodi right", keys: [
    [0, { x: 950, z: -1685, h: 0, w: 600, d: 100, a: 0 }], [21, {}], [23, { a: 1 }],
    [27, { pace: 1 }], [36, { x: 720, z: -315 }], [37, { pace: .2 }], [52, {}], [59, { x: 560, z: -335, chaos: .4, loss: .15, w: 450, d: 160 }],
    [68, { x: 420, w: 350, d: 200, chaos: .8, loss: .5 }], [71, {}], [77, { x: 700, z: -1000, pace: 2, a: .5, loss: .6, mv: 1 }], [81, { z: -1400, a: 0 }]] },
  { id: "lLeft", side: 1, type: "cav", n: 2200, name: "Lodi left", keys: [
    [0, { x: -950, z: -1685, h: 0, w: 600, d: 100, a: 0 }], [21, {}], [23, { a: 1 }],
    [27, { pace: 1 }], [36, { x: -720, z: -315 }], [37, { pace: .2 }], [52, {}], [59, { x: -560, z: -335, chaos: .4, loss: .15, w: 450, d: 160 }],
    [68, { x: -420, w: 350, d: 200, chaos: .8, loss: .5 }], [71, {}], [77, { x: -700, z: -1000, pace: 2, a: .5, loss: .6, mv: 1 }], [81, { z: -1400, a: 0 }]] },
  { id: "lRear", side: 1, type: "inf", n: 2000, name: "Lodi rear", keys: [
    [0, { x: 0, z: -1955, h: 0, w: 900, d: 120, a: 0 }], [21.5, {}], [23.5, { a: 1 }],
    [27, { pace: 1 }], [36, { z: -565, w: 800 }], [37, { pace: .2 }], [56, {}], [60, { chaos: .35, loss: .1 }], [68, { z: -525, chaos: .7, loss: .4, w: 700 }],
    [70, {}], [75, { z: -1000, pace: 2, a: .6 }], [79, { z: -1500, a: 0 }]] }
];
const NU = 16;
const UNIT_INDEX = Object.fromEntries(UNITS.map((u, i) => [u.id, i]));
const FIELDS = ["x", "z", "h", "w", "d", "pace", "chaos", "loss", "a", "mv"];
const UNIT_DEFAULT = { pace: 0, chaos: 0, loss: 0, mv: 0 };
// fill every key with the full set of values and resolve "face" into a heading
for (const u of UNITS) {
  let prev = { ...UNIT_DEFAULT };
  u.k = u.keys.map(([t, v]) => {
    const full = { ...prev, ...v };
    if (v.face) full.h = Math.atan2(v.face[0] - full.x, v.face[1] - full.z) / DEG;
    delete full.face;
    prev = full;
    return { t, ...full };
  });
}
// position along the keys uses Hermite curves (smooth through waypoints, still at rests); the rest eases key to key
function unitAt(u, t) {
  const K = u.k;
  if (t <= K[0].t) return { ...K[0] };
  if (t >= K[K.length - 1].t) return { ...K[K.length - 1] };
  let i = 0;
  while (K[i + 1].t < t) i++;
  const a = K[i], b = K[i + 1], dt = b.t - a.t, k = (t - a.t) / dt, e = smoother(k);
  const o = {};
  for (const f of FIELDS) o[f] = f === "h" ? angLerp(a.h, b.h, e) : lerp(a[f], b[f], e);
  const tan = j => {
    const p = K[j - 1], c = K[j], n = K[j + 1];
    if (!p || !n) return [0, 0];
    const still = (q, r) => Math.abs(q.x - r.x) + Math.abs(q.z - r.z) < .5;
    if (still(p, c) || still(c, n)) return [0, 0];
    return [(n.x - p.x) / (n.t - p.t), (n.z - p.z) / (n.t - p.t)];
  };
  const ta = tan(i), tb = tan(i + 1), h1 = 2 * k ** 3 - 3 * k ** 2 + 1, h2 = k ** 3 - 2 * k ** 2 + k, h3 = -2 * k ** 3 + 3 * k ** 2, h4 = k ** 3 - k ** 2;
  const moving = Math.abs(a.x - b.x) + Math.abs(a.z - b.z) > .5;
  if (moving && (ta[0] || ta[1] || tb[0] || tb[1])) {
    o.x = h1 * a.x + h2 * ta[0] * dt + h3 * b.x + h4 * tb[0] * dt;
    o.z = h1 * a.z + h2 * ta[1] * dt + h3 * b.z + h4 * tb[1] * dt;
  }
  return o;
}

/* the film: chapters move the camera and the global effects; units follow their own keys */
const BASE = {
  reveal: 0, carts: 0, arrows: 0, fallen: 0, ribAdv: 0, ribTul: 0, ribRout: 0, ibrahim: 0, smoke: 1,
  camX: 0, camZ: -500, dist: 3600, az: 200, el: 52
};
const KEYS = Object.keys(BASE);
const EASE = { io: smoother, s: k => k * k * (3 - 2 * k), lin: k => k, in: k => k * k, out: k => 1 - (1 - k) * (1 - k) };
const cam = (x, z, dist, az, el, t0, t1, e = "io") => [["camX", x, t0, t1, e], ["camZ", z, t0, t1, e], ["dist", dist, t0, t1, e], ["az", az, t0, t1, e], ["el", el, t0, t1, e]];
const CHAPTERS = [
  { id: "plain", name: "The plain of Panipat", dur: 8, tw: [["reveal", 1, .2, 5.5, "s"], ...cam(-250, -350, 2900, 205, 48, 0, 8, "s")],
    cap: [[.2, "PANIPAT · 21 APRIL 1526", "About 90 km north of Delhi. Babur, ruler of Kabul, faces Ibrahim Lodi, Sultan of Delhi."]] },
  { id: "babur", name: "Babur's position", dur: 11, tw: [["carts", 1, .5, 5, "lin"], ...cam(-150, 60, 1500, 215, 32, 0, 3), ...cam(-60, 10, 190, 240, 14, 5, 9.5), ...cam(0, -20, 900, 200, 30, 9.5, 11)],
    cap: [[.2, "BABUR'S POSITION", "His right rests on the town of Panipat; ditches and felled trees cover his left."],
      [4.5, "THE ARABA", "Across the front, carts lashed together with rawhide ropes, with gaps left for guns and for horsemen to ride out."]] },
  { id: "lodi", name: "Ibrahim Lodi's host", dur: 8, tw: [...cam(0, -1650, 1700, 180, 34, 0, 3), ...cam(180, -1500, 170, 150, 9, 3.5, 7.5)],
    cap: [[.2, "IBRAHIM LODI'S HOST", "Babur put it at 100,000 men and 1,000 elephants. Modern estimates are far lower, but it greatly outnumbered his own army of about 12,000."]] },
  { id: "advance", name: "The advance", dur: 10, tw: [["ribAdv", 1, .3, 1.2], ["ribAdv", 0, 8, 9.5], ...cam(-1500, -800, 1700, 268, 24, 0, 2.5), ...cam(-900, -300, 1200, 250, 22, 2.5, 10, "s")],
    cap: [[.2, "THE ADVANCE", "Lodi's army comes on at speed, then bunches up as its front meets the cart line."]] },
  { id: "guns", name: "Guns at the carts", dur: 10, tw: [["fallen", .15, 2, 10], ...cam(-140, -40, 260, 300, 9, 0, 1.5), ...cam(-60, -120, 520, 330, 26, 5, 10, "s")],
    cap: [[.2, "GUNS AT THE CARTS", "Matchlocks and cannon fire from behind the carts, under Ustad Ali Quli and Mustafa."],
      [4, "THE ELEPHANTS TURN", "Unused to gunfire, the elephants panic and crash back into their own ranks."]] },
  { id: "tulughma", name: "Tulughma", dur: 12, tw: [["ribTul", 1, .5, 1.5], ["arrows", 1, 2, 4], ["ribTul", 0, 10, 12], ...cam(0, -320, 3100, 180, 56, 0, 2), ...cam(-700, -450, 900, 230, 22, 6, 11)],
    cap: [[.2, "TULUGHMA", "Babur's flanking parties ride round both enemy wings and shoot into the rear: the Mongol tulughma."]] },
  { id: "encircled", name: "Encircled", dur: 10, tw: [["fallen", .62, 0, 10], ...cam(0, -340, 700, 240, 34, 0, 1.5), ...cam(0, -340, 640, 310, 30, 1.5, 10, "lin")],
    cap: [[.2, "ENCIRCLED", "Pressed from the front, the sides and the rear, the Lodi army can neither advance nor get away."]] },
  { id: "falls", name: "The sultan falls", dur: 8, tw: [["ibrahim", 1, 2, 2.6], ["ribRout", 1, 3.5, 4.5], ["arrows", 0, 3, 5], ["fallen", .92, 0, 8], ...cam(40, -380, 170, 200, 16, 0, 1.6), ...cam(0, -700, 1600, 190, 40, 3.5, 8)],
    cap: [[.2, "THE SULTAN FALLS", "Ibrahim Lodi is killed fighting in the press. By midday his army has broken and fled."]] },
  { id: "after", name: "Aftermath", dur: 11, tw: [["ribRout", 0, 1, 3], ["fallen", 1, 0, 3], ["ibrahim", 0, 10.6, 10.8], ...cam(-250, -350, 3000, 205, 50, 0, 9, "s"), ["reveal", 0, 9.5, 11], ["carts", 0, 9.5, 11], ["fallen", 0, 9.5, 11]],
    cap: [[.2, "AFTERMATH", "Babur reached Delhi within days, then Agra. The dynasty founded here ruled, at least in name, until 1857."]] }
];
const FILM_LEN = CHAPTERS.reduce((s, c) => s + c.dur, 0);
{ let t = 0; CHAPTERS.forEach((c, i) => { c.t0 = t; c.n = i + 1; t += c.dur; }); }
function applyChapter(ch, from, t) {
  const n = { ...from };
  for (const [key, to, t0, t1, e = "io"] of ch.tw) {
    if (t <= t0) continue;
    const k = EASE[e](clamp((t - t0) / Math.max(1e-6, t1 - t0)));
    n[key] = key === "az" ? angLerp(n[key], to, k) : lerp(n[key], to, k);
  }
  return n;
}
const CH_END = [];
{ let s = { ...BASE }; for (const ch of CHAPTERS) { s = applyChapter(ch, s, ch.dur + 1); CH_END.push(s); } }
function filmState(t) {
  t = (t % FILM_LEN + FILM_LEN) % FILM_LEN;
  let i = CHAPTERS.length - 1;
  while (i > 0 && CHAPTERS[i].t0 > t) i--;
  const s = applyChapter(CHAPTERS[i], i ? CH_END[i - 1] : BASE, t - CHAPTERS[i].t0);
  s.chapter = i; s.t = t;
  return s;
}

/* volleys from the cart line: [time, kind] — muskets along the line, cannon at the gaps */
const VOLLEYS = [[37.6, "m"], [38.2, "g"], [39.6, "m"], [41, "g"], [41.6, "m"], [43.6, "m"], [44.2, "g"], [45.6, "m"], [46.4, "g"], [48.5, "m"], [50.5, "g"], [52, "m"], [55, "m"], [57, "g"], [61, "m"], [64, "g"]];
const GUN_X = [-660, -560, -430, -300, -200, -120, -60, 0, 60, 120, 200, 300, 430, 560, 660];

/* movement arrows drawn on the ground: [film key, polyline] */
const RIBBONS = [
  ["ribAdv", [[-620, -1480], [-640, -900], [-560, -420]]], ["ribAdv", [[0, -1560], [0, -900], [0, -320]]], ["ribAdv", [[620, -1480], [640, -900], [560, -420]]],
  ["ribTul", [[-930, 40], [-1250, -240], [-1080, -650], [-640, -820]]], ["ribTul", [[930, 40], [1250, -240], [1080, -650], [640, -820]]],
  ["ribTul", [[-520, 60], [-880, -150]]], ["ribTul", [[520, 60], [880, -150]]],
  ["ribRout", [[0, -420], [0, -1300]]], ["ribRout", [[-450, -420], [-720, -1250]]], ["ribRout", [[450, -420], [720, -1250]]]
];

/* labels: [from, to, text, sub, anchor] — anchors are [x, z], a unit id, or "ibrahim" */
const LABELS = [
  [1.5, 19, "PANIPAT", "the town anchors Babur's right", [-1150, 120]],
  [2.5, 18, "ROAD TO DELHI", "about 90 km south", [260, -2000]],
  [12, 27, "BABUR", "about 12,000 men", "bCentre"],
  [13, 27, "HUMAYUN", "right wing", "bRight"],
  [12, 27, "CART LINE", "the araba", [330, 0]],
  [12, 23, "DITCH AND FELLED TREES", "", [1120, 30]],
  [36.5, 47, "GUNS", "Ustad Ali Quli", [-60, 6]],
  [21, 35, "WAR ELEPHANTS", "", "lEle"],
  [21, 31, "IBRAHIM LODI", "Sultan of Delhi", "ibrahim"],
  [39, 47, "ELEPHANTS PANIC", "", "lEle"],
  [48.5, 60, "TULUGHMA", "right flanking party", "bTulR"],
  [48.5, 60, "TULUGHMA", "left flanking party", "bTulL"],
  [59, 70, "IBRAHIM LODI", "Sultan of Delhi", "ibrahim"],
  [70.6, 79, "IBRAHIM LODI KILLED", "", "ibrahim"]
];
