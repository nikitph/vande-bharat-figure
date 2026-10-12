// Rani ki Vav, Patan: a sectional museum model on a bench.
// The stepwell is cut down its long east-west axis. A month dial sets the
// water table; water rises in the well shaft, floods the kund and climbs the
// stairs terrace by terrace, and a sight-glass gauge on the section reads it.
//
//   node build.mjs            -> rani-ki-vav.html (dark)
//   node build.mjs --light    -> rani-ki-vav-light.html
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../kit/iso-kit.mjs";
import { kitScript } from "../scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";
const WIDTH = 640;
const HEIGHT = 400;

// ---------------------------------------------------------------- truth (metres)
// Measured: about 65 m long, 20 m wide; seven flights of stairs; a kund
// 9.5 x 9.4 m at a depth of 23 m; a well shaft 10 m across and 30 m deep;
// three pillared pavilion towers whose storeys grow toward the west.
const FLIGHTS = 7;
const RISERS = 16;                         // per flight
const DEPTH_KUND = 23;
const RISE = DEPTH_KUND / (FLIGHTS * RISERS); // 0.205 m
const TREAD = 0.28;
const RUN = RISERS * TREAD;                // 4.48 m of stair per flight
const LANDING = 1.9;
const MODULE = RUN + LANDING;
const zL = (j) => -j * RISERS * RISE;      // landing j level (m), zL(0) = ground
const aF = (j) => (j - 1) * MODULE;        // flight j starts (u, m west of entrance)
const KUND_FROM = aF(FLIGHTS) + RUN;       // 42.76
const KUND = 9.5;
const UT = KUND_FROM + KUND;               // west wall of the kund, 52.26
const WC = 4.75;                           // half width of the corridor at kund level
const setback = (j) => 0.5 * (FLIGHTS - j); // terraces step back 0.5 m per level going up
const VB = -(WC + setback(1));             // face of the top terrace, -7.75
const VE = -9.5;                           // back of the model block
const WALL = 1.6;                          // kund to shaft
const RS = 5;                              // shaft radius
const US = UT + WALL + RS;                 // shaft centre, 58.86
const ZS = -30;                            // shaft floor
const UW = US + RS + 0.6;                  // west end of the model
const UE = -4;                             // east end of the model
const ZB = -32;                            // underside of the model block
const TOWERS = [2, 4, 6];                  // pavilion towers stand on these landings
const FLOOR_T = 0.45;
const SCALE_U0 = -3.55, SCALE_U1 = -0.6; // the gauge on the section covers this span
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Illustrative water table (m below ground) through the year: falls through the
// dry season below the kund floor, recharges with the monsoon from late June.
const TABLE = [-14.2, -16.6, -19.0, -21.4, -23.8, -24.6, -18.6, -10.8, -6.2, -7.6, -10.0, -12.2];

// ---------------------------------------------------------------- world
const K = 4; // units per metre
const X = (u) => (UW - u) * K;
const Y = (v) => v * K;
const Z = (z) => z * K;
const W = (u, v, z) => [X(u), Y(v), Z(z)];

const PLATE_U = [-17, UW + 2.2];
const PLATE_V = [-11.6, 4.6];
const PLATE_H = 2.4;
const FOOT_H = 1.5;

const plan = (u0, u1, v0, v1, r = 0) => ({ x: X(u1), y: Y(v0), w: (u1 - u0) * K, d: (v1 - v0) * K, r: r * K });

const fitPoints = [
  ...k.boxCorners(plan(PLATE_U[0], PLATE_U[1], PLATE_V[0], PLATE_V[1]), Z(ZB - PLATE_H - FOOT_H), Z(ZB)),
  ...k.boxCorners(plan(UE, UW, VE, 0), Z(ZB), Z(0.9)),
];
const P = k.fitProjection(fitPoints, WIDTH, HEIGHT, { pad: 22, azimuth: 63, elevation: 30 });
const at = (u, v, z) => k.iso(W(u, v, z), P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const path = (points, closed = true) => k.pathOf(points, closed);
const seg = (a, b) => k.pathOf([at(...a), at(...b)]);

// ---------------------------------------------------------------- floor profile
const COLUMNS = []; // { u0, u1, top, back, flight }
for (let j = 1; j <= FLIGHTS; j++) {
  const back = -(WC + setback(j));
  for (let i = 0; i < RISERS - 1; i++) COLUMNS.push({ u0: aF(j) + i * TREAD, u1: aF(j) + (i + 1) * TREAD, top: zL(j - 1) - (i + 1) * RISE, back, flight: j });
  const end = j < FLIGHTS ? aF(j + 1) : UT;
  COLUMNS.push({ u0: aF(j) + (RISERS - 1) * TREAD, u1: end, top: zL(j), back, flight: j, landing: j });
}
const floorAt = (u) => {
  for (const c of COLUMNS) if (u >= c.u0 && u < c.u1) return c.top;
  return u < 0 ? 0 : zL(FLIGHTS);
};

// ---------------------------------------------------------------- items
// Every model part is an item with a world box. Items are ordered by a
// separating-axis topological sort, drawn once (the wet layer, under the
// water surface) and again as a <use> clipped to the part above the water.
const ITEMS = [];
const item = (svg, box, name) => {
  ITEMS.push({ svg, box, name });
};
const boxOf = (u0, u1, v0, v1, z0, z1) => [X(u1), X(u0), Y(v0), Y(v1), Z(z0), Z(z1)];

// faces of a vertical plane v = const, as a path of (u, z) points
const onV = (v, pts, closed = true) => path(pts.map(([u, z]) => at(u, v, z)), closed);

function niches(v, u0, u1, zb, zt) {
  // a row of sculpture niches on a terrace wall: pediment frame, inner panel, figure
  const out = [];
  const h = zt - zb;
  if (h < 1.6) return "";
  const width = 0.9, gap = 1.42;
  const count = Math.floor((u1 - u0 - 0.4) / gap);
  if (count < 1) return "";
  const start = u0 + (u1 - u0 - (count - 1) * gap) / 2;
  const base = zb + 0.35, top = zt - 0.75;
  for (let n = 0; n < count; n++) {
    const c = start + n * gap;
    const l = c - width / 2, r = c + width / 2;
    out.push(onV(v, [[l, base], [r, base], [r, top - 0.28], [c, top], [l, top - 0.28]]));
    out.push(onV(v, [[c - 0.17, base + 0.22], [c + 0.17, base + 0.22], [c + 0.17, top - 0.62], [c, top - 0.48], [c - 0.17, top - 0.62]]));
  }
  return L(out.join(""), { tone: "faint" });
}

function frieze(v, u0, u1, z) {
  return L(onV(v, [[u0, z], [u1, z]], false), { tone: "faint" });
}

// back strip: the ground behind the top terrace, full length
{
  const paths = k.slabOf(plan(0, UW, VE, VB), Z(ZB), Z(0) - Z(ZB), P, 2);
  const inner = niches(VB, aF(1) + RUN, UT, zL(1), 0) + frieze(VB, 0, UT, -0.32);
  item(S(paths, { tone: "mid", inner }), boxOf(0, UW, VE, VB, ZB, 0), "ground behind");
}

// west block: the earth round the well shaft, with the shaft cut in half
const shaftRing = (r, from = Math.PI, to = 2 * Math.PI, steps = 56) =>
  Array.from({ length: steps + 1 }, (_, i) => {
    const t = from + ((to - from) * i) / steps;
    return [US + r * Math.cos(t), r * Math.sin(t)];
  });
{
  const below = k.slabOf(plan(UT, UW, VB, 0), Z(ZB), Z(ZS) - Z(ZB), P, 2);
  const uv = [[UT, 0], ...shaftRing(RS).map(([u, v]) => [u, v]), [UW, 0], [UW, VB], [UT, VB]];
  // shaftRing runs from angle PI (u = US - RS) round the back (v < 0) to 2 PI (u = US + RS)
  const ring = uv.map(([u, v]) => [X(u), Y(v)]);
  const upper = k.extrude(ring, Z(ZS), Z(0) - Z(ZS), P, { convex: false });
  // courses of the shaft lining: faint rings on the inner wall every 3.3 m
  const courses = [];
  for (let j = 1; j <= FLIGHTS; j++) {
    const z = zL(j) + 1.55;
    courses.push(path(shaftRing(RS).map(([u, v]) => at(u, v, z)), false));
  }
  // carved registers: vertical ribs on the part of the inner wall that faces the viewer
  const view = [Math.cos((P.azimuth * Math.PI) / 180), Math.sin((P.azimuth * Math.PI) / 180)];
  for (let n = 1; n < 16; n++) {
    const t = Math.PI + (n * Math.PI) / 16;
    const facing = Math.cos(t) * view[0] - Math.sin(t) * view[1];
    if (facing < 0.12) continue;
    const u = US + RS * Math.cos(t), v = RS * Math.sin(t);
    courses.push(seg([u, v, ZS], [u, v, 0]));
  }
  // paving on the ground beyond the shaft
  const paving = [seg([UT, -6.2, 0], [UW, -6.2, 0]), seg([UT, -7.0, 0], [UW, -7.0, 0]), seg([UT + 0.55, VB, 0], [UT + 0.55, 0, 0])];
  item(S(below, { tone: "mid" }) + S(upper, { tone: "mid", inner: L(courses.join(""), { tone: "faint" }) + L(paving.join(""), { tone: "faint" }) }), boxOf(UT, UW, VB, 0, ZB, 0), "west block");
}

// ledges: the terrace walls of the corridor, one per landing level
for (let j = 1; j < FLIGHTS; j++) {
  const v0 = -(WC + setback(j));
  const v1 = -(WC + setback(j + 1));
  const u0 = aF(j + 1);
  const paths = k.slabOf(plan(u0, UT, v0, v1), Z(ZB), Z(zL(j)) - Z(ZB), P, 2, 0.5);
  const inner = niches(v1, aF(j + 1) + RUN, UT, zL(j + 1), zL(j)) + frieze(v1, u0, UT, zL(j) - 0.32);
  item(S(paths, { tone: "mid", inner }), boxOf(u0, UT, v0, v1, ZB, zL(j)), `terrace ${j}`);
}

// east block: the ground at the head of the stairs
// its east face carries the same beds as the section, wrapping the corner
const BEDS = [-2.6, -6.9, -11.4, -15.2, -19.8, -25.6, -28.9];
const bedZ = (b, u) => b + 0.32 * Math.sin(u * 0.19 + b) + 0.18 * Math.sin(u * 0.53 - b * 1.7);
{
  const beds = BEDS.map((b) => path([at(UE, 0, bedZ(b, UE)), at(UE, VE, bedZ(b, UE) - 0.25)], false)).join("")
    + [-1.33, -2.67].map((u) => seg([u, VE, 0], [u, 0, 0])).join("")
    + [-1.9, -3.8, -5.7, -7.6].map((v) => seg([UE, v, 0], [0, v, 0])).join("");
  item(S(k.slabOf(plan(UE, 0, VE, 0), Z(ZB), Z(0) - Z(ZB), P, 2), { tone: "mid", inner: L(beds, { tone: "faint" }) }), boxOf(UE, 0, VE, 0, ZB, 0), "east block");
}

// stair columns: every tread is the top of a column of masonry and earth
for (const c of COLUMNS) {
  const paths = k.slabOf(plan(c.u0, c.u1, c.back, 0), Z(ZB), Z(c.top) - Z(ZB), P, 2);
  item(S(paths, { tone: c.landing ? "hi" : "mid", crease: "lo" }), boxOf(c.u0, c.u1, c.back, 0, ZB, c.top), c.landing ? `landing ${c.landing}` : "tread");
}

// pavilion towers: posts with bases and bracket capitals, floors abutting the terraces
function post(u, v, z0, z1) {
  const out = [];
  const base = 0.3, cap = 0.32;
  out.push(S(k.slabOf(plan(u - 0.38, u + 0.38, v - 0.38, v + 0.38, 0.04), Z(z0), Z(base), P, 2, 0.3), { tone: "mid" }));
  out.push(S(k.slabOf(plan(u - 0.24, u + 0.24, v - 0.24, v + 0.24, 0.03), Z(z0 + base), Z(z1 - cap) - Z(z0 + base), P, 2), { tone: "hi", crease: "lo" }));
  out.push(L(k.sideSeam(plan(u - 0.24, u + 0.24, v - 0.24, v + 0.24, 0.03), Z(z0 + base + (z1 - cap - z0 - base) * 0.62), P, 2), { tone: "faint" }));
  out.push(S(k.slabOf(plan(u - 0.43, u + 0.43, v - 0.43, v + 0.43, 0.04), Z(z1 - cap), Z(cap), P, 2, 0.3), { tone: "hi", crease: "lo" }));
  item(out.join(""), boxOf(u - 0.43, u + 0.43, v - 0.43, v + 0.43, z0, z1), "post");
}
function floorSlab(u0, u1, m, west = 0.22) {
  // a beam course on the posts and a deck over it that projects as a cornice
  const v0 = -(WC + setback(m));
  const z1 = zL(m - 1);
  const beam = 0.26, deck = FLOOR_T - beam;
  const d0 = u0 - 0.22, d1 = u1 + west;
  const lower = k.slabOf(plan(u0, u1, v0, 0), Z(z1 - FLOOR_T), Z(beam), P, 2);
  const upper = k.slabOf(plan(d0, d1, v0, 0), Z(z1 - deck), Z(deck), P, 2, 0.45);
  const lip = k.sideSeam(plan(u0, u1, v0, 0), Z(z1 - FLOOR_T + beam * 0.5), P, 2);
  item(S(lower, { tone: "mid", inner: L(lip, { tone: "faint" }) }) + S(upper, { tone: "hi", crease: "lo" }), boxOf(d0, d1, v0, 0, z1 - FLOOR_T, z1), `floor ${m - 1}`);
}
const POST_V = [-1.25, -(WC - 0.75)];
function tower(u0, u1, levels, posts, west = 0.22) {
  for (let m = levels; m >= 1; m--) {
    const zb = m === levels ? zL(levels) : zL(m);
    for (const pu of posts) for (const pv of POST_V) post(pu, pv, zb, zL(m - 1) - FLOOR_T);
    floorSlab(u0, u1, m, west);
  }
}
for (const j of TOWERS) {
  const u0 = aF(j) + (RISERS - 1) * TREAD, u1 = aF(j + 1);
  tower(u0 + 0.04, u1 - 0.04, j, [u0 + 0.5, u1 - 0.5]);
}
tower(UT - 2.4, UT, FLIGHTS, [UT - 1.95, UT - 0.55], 0); // galleries on the kund's west wall

// galleries round the well shaft: bracketed half rings at each terrace level
for (let j = 1; j <= FLIGHTS; j++) {
  const z = zL(j);
  const outer = shaftRing(RS, Math.PI, 2 * Math.PI, 48);
  const inner = shaftRing(RS - 0.7, Math.PI, 2 * Math.PI, 48).reverse();
  const ring = [...outer, ...inner].map(([u, v]) => [X(u), Y(v)]);
  const paths = k.extrude(ring, Z(z - 0.35), Z(0.35), P, { convex: false });
  item(S(paths, { tone: "hi", crease: "lo" }), boxOf(US - RS, US + RS, -RS, 0, z - 0.35, z), `shaft gallery ${j}`);
}

// parapets: along the top terrace and round the mouth of the shaft
{
  const paths = k.slabOf(plan(0, UT, VB - 0.45, VB), Z(0), Z(0.9), P, 2, 0.4);
  item(S(paths, { tone: "hi", crease: "lo" }), boxOf(0, UT, VB - 0.45, VB, 0, 0.9), "parapet");
  const outer = shaftRing(RS + 0.5, Math.PI, 2 * Math.PI, 56);
  const inner = shaftRing(RS, Math.PI, 2 * Math.PI, 56).reverse();
  const ring = [...outer, ...inner].map(([u, v]) => [X(u), Y(v)]);
  item(S(k.extrude(ring, Z(0), Z(0.9), P, { convex: false }), { tone: "hi", crease: "lo" }), boxOf(US - RS - 0.5, US + RS + 0.5, -RS - 0.5, 0, 0, 0.9), "shaft parapet");
}

// ---------------------------------------------------------------- order
function hull(points) {
  const s = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
const corners3 = ([x0, x1, y0, y1, z0, z1]) => [[x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0], [x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1]];
function overlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const nx = q[1] - p[1], ny = p[0] - q[0];
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const r of a) { const d = r[0] * nx + r[1] * ny; amin = Math.min(amin, d); amax = Math.max(amax, d); }
      for (const r of b) { const d = r[0] * nx + r[1] * ny; bmin = Math.min(bmin, d); bmax = Math.max(bmax, d); }
      if (amax <= bmin + 0.05 || bmax <= amin + 0.05) return false;
    }
  }
  return true;
}
const FIXED = ["ground behind", "west block"];
const fixed = ITEMS.filter((it) => FIXED.includes(it.name));
const free = ITEMS.filter((it) => !FIXED.includes(it.name));
for (const it of free) {
  it.hull = hull(corners3(it.box).map((p) => k.iso(p, P)));
  const [x0, x1, y0, y1, z0, z1] = it.box;
  it.depth = k.depthOf([(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], P);
}
const E = 1e-6;
const behind = (a, b) => {
  // a strictly behind b along some axis that points at the viewer (+x, +y, +z)
  const ax = a.box, bx = b.box;
  const votes = [];
  if (ax[1] <= bx[0] + E) votes.push(1); if (bx[1] <= ax[0] + E) votes.push(-1);
  if (ax[3] <= bx[2] + E) votes.push(1); if (bx[3] <= ax[2] + E) votes.push(-1);
  if (ax[5] <= bx[4] + E) votes.push(1); if (bx[5] <= ax[4] + E) votes.push(-1);
  if (!votes.length) return 0;
  if (votes.every((v) => v === 1)) return 1;
  if (votes.every((v) => v === -1)) return -1;
  return 0; // separated both ways: neither can hide the other
};
const n = free.length;
const after = Array.from({ length: n }, () => []);
const need = new Array(n).fill(0);
let edges = 0, tangled = 0;
for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
  if (!overlap(free[i].hull, free[j].hull)) continue;
  const o = behind(free[i], free[j]);
  if (o === 1) { after[i].push(j); need[j]++; edges++; }
  else if (o === -1) { after[j].push(i); need[i]++; edges++; }
  else if (!free[i].box.every((v, q) => true)) tangled++;
}
const order = [];
const ready = [];
for (let i = 0; i < n; i++) if (!need[i]) ready.push(i);
while (order.length < n) {
  if (!ready.length) {
    tangled++;
    let pick = -1;
    for (let i = 0; i < n; i++) if (need[i] > 0 && !order.includes(i) && (pick < 0 || free[i].depth < free[pick].depth)) pick = i;
    need[pick] = 0; ready.push(pick);
  }
  ready.sort((a, b) => free[b].depth - free[a].depth);
  const i = ready.pop();
  order.push(i);
  for (const j of after[i]) if (--need[j] === 0) ready.push(j);
}
const SORTED = [...fixed, ...order.map((i) => free[i])];
console.log(`items ${ITEMS.length} · order rules ${edges} · cycles broken ${tangled}`);

// ---------------------------------------------------------------- the section (plane v = 0)
const cavityProfile = [[0, 0]];
for (const c of COLUMNS) { cavityProfile.push([c.u0, c.top]); cavityProfile.push([c.u1, c.top]); }
cavityProfile.push([UT, 0]);
const LINING = 1.2;
const shaftRect = [[US - RS, 0], [US + RS, 0], [US + RS, ZS], [US - RS, ZS]];
const outerRect = [[UE, 0], [UE, ZB], [UW, ZB], [UW, 0]];
// the earth's section: one polygon, open where the stair corridor and the shaft meet the ground
const earthOutline = [[UE, 0], ...cavityProfile, [US - RS, 0], [US - RS, ZS], [US + RS, ZS], [US + RS, 0], [UW, 0], [UW, ZB], [UE, ZB]];
const cutD = onV(0, earthOutline);
void outerRect;
// masonry lining: the stair blocks under the treads, the kund and shaft walls
const stairBand = [...cavityProfile.slice(0, -1), [UT, zL(FLIGHTS) - LINING], ...[...cavityProfile.slice(1, -1)].reverse().map(([u, z]) => [u, z - LINING]), [0, -LINING]];
const wallKS = [[UT, 0], [US - RS, 0], [US - RS, ZS], [US - RS - 0, ZS - LINING], [UT, ZS - LINING]];
const kundWall = [[UT, 0], [US - RS, 0], [US - RS, ZS - LINING], [UT, ZS - LINING]];
const shaftWest = [[US + RS, 0], [US + RS + LINING, 0], [US + RS + LINING, ZS - LINING], [US + RS, ZS - LINING]];
const shaftFloor = [[US - RS, ZS], [US + RS, ZS], [US + RS, ZS - LINING], [US - RS, ZS - LINING]];
void wallKS;
// the lower kund floor lining meets the kund wall
const liningD = onV(0, stairBand) + onV(0, kundWall) + onV(0, shaftWest) + onV(0, shaftFloor);
// joints between stair blocks: under every riser, from the nosing to the lining's underside
// joints between the stair masonry of each flight: at both ends of every landing
const joints = [];
for (let i = 1; i < COLUMNS.length; i++) {
  const c = COLUMNS[i], prev = COLUMNS[i - 1];
  if (c.landing || prev.landing) joints.push(onV(0, [[c.u0, prev.top], [c.u0, c.top - LINING]], false));
}
// earth strata: gentle undulating beds, ended exactly on the lining or the block edge
const inMasonry = (u, z) => {
  if (u >= 0 && u <= UT) { const f = floorAt(u); if (z >= f - LINING && z <= 0) return true; }
  if (u >= UT && u <= US + RS + LINING && z >= ZS - LINING && z <= 0) return true;
  return false;
};
const strata = [];
for (const b of BEDS) {
  const step = 0.25;
  let run = [];
  const flush = () => { if (run.length > 1) strata.push(path(run.map(([u, z]) => at(u, 0, z)), false)); run = []; };
  const edge = (u0, u1) => { // bisect the boundary between earth (u0) and masonry (u1)
    let a = u0, c = u1;
    for (let i = 0; i < 30; i++) { const m = (a + c) / 2; if (inMasonry(m, bedZ(b, m))) c = m; else a = m; }
    return (a + c) / 2;
  };
  let prevU = UE, prevIn = inMasonry(UE, bedZ(b, UE));
  if (!prevIn) run.push([UE, bedZ(b, UE)]);
  for (let u = UE + step; u <= UW + 1e-9; u += step) {
    const uu = Math.min(u, UW);
    const inside = inMasonry(uu, bedZ(b, uu));
    if (inside !== prevIn) {
      const e = inside ? edge(prevU, uu) : edge(uu, prevU);
      if (inside) { run.push([e, bedZ(b, e)]); flush(); } else { run.push([e, bedZ(b, e)]); }
    }
    if (!inside) run.push([uu, bedZ(b, uu)]);
    prevU = uu; prevIn = inside;
  }
  flush();
}
// grain of each bed: silt, sand and kankar stippled, clay left plain (beds are illustrative)
const GRAIN = [0.35, 0.55, 0, 1.25, 0.8, 1.35, 0, 0.3]; // dots per square metre, bed by bed from the top
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const grains = [];
const bedTop = (i, u) => (i === 0 ? 0 : bedZ(BEDS[i - 1], u));
const bedBottom = (i, u) => (i === BEDS.length ? ZB : bedZ(BEDS[i], u));
for (let i = 0; i <= BEDS.length; i++) {
  const density = GRAIN[i];
  if (!density) continue;
  const top = i === 0 ? 0 : BEDS[i - 1] + 0.6, bottom = i === BEDS.length ? ZB : BEDS[i] - 0.6;
  const count = Math.round((UW - UE) * (top - bottom) * density);
  for (let n = 0; n < count; n++) {
    const u = UE + rand() * (UW - UE), z = bottom + rand() * (top - bottom);
    if (z > bedTop(i, u) - 0.25 || z < bedBottom(i, u) + 0.25 || z > -0.3 || z < ZB + 0.3) continue;
    if (u < UE + 0.3 || u > UW - 0.3 || inMasonry(u, z) || inMasonry(u + 0.3, z) || inMasonry(u - 0.3, z) || inMasonry(u, z + 0.3)) continue;
    if (u > US - RS - 0.3 && u < US + RS + 0.3 && z > ZS - 0.3) continue;
    if (u > 0 && u < UT && z > floorAt(u) - 0.3) continue;
    if (u > SCALE_U0 - 0.3 && u < SCALE_U1 + 0.3) continue;
    grains.push(at(u, 0, z));
  }
}
// water section: open cavity at v = 0, less the floors cut by the plane
const floorCuts = ITEMS.filter((it) => it.name.startsWith("floor")).map((it) => {
  const [x0, x1, , , z0, z1] = it.box;
  const u1 = UW - x0 / K, u0 = UW - x1 / K;
  // the section of beam and deck: the deck runs 0.22 m beyond the beam at each end
  const zd = z1 / K - (FLOOR_T - 0.26), a = u0 + 0.22, b = u1 - (u1 > UT - 0.01 ? 0 : 0.22);
  return onV(0, [[a, z0 / K], [b, z0 / K], [b, zd], [u1, zd], [u1, z1 / K], [u0, z1 / K], [u0, zd], [a, zd]]);
});
const gal = ITEMS.filter((it) => it.name.startsWith("shaft gallery")).map((it) => {
  const z1 = it.box[5] / K, z0 = it.box[4] / K;
  return onV(0, [[US - RS, z0], [US - RS + 0.7, z0], [US - RS + 0.7, z1], [US - RS, z1]]) + onV(0, [[US + RS - 0.7, z0], [US + RS, z0], [US + RS, z1], [US + RS - 0.7, z1]]);
});
const waterCutD = onV(0, cavityProfile) + floorCuts.join("") + onV(0, shaftRect) + gal.join("");

// ---------------------------------------------------------------- bench
const PLATE = plan(PLATE_U[0], PLATE_U[1], PLATE_V[0], PLATE_V[1], 1.4);
function bench() {
  const z0 = ZB - PLATE_H;
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, Z(z0 - FOOT_H), Z(PLATE_H), P)}"/>`];
  const feet = k.corners(PLATE, 5.5 * K).sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));
  for (const [x, y] of feet) {
    out.push(S(k.cylinder(x, y, 1.7 * K, Z(z0 - FOOT_H), 0.4 * K, P, 28), { tone: "lo" }));
    out.push(S(k.cylinder(x, y, 1.25 * K, Z(z0 - FOOT_H + 0.4), Z(FOOT_H - 0.4), P, 28), { tone: "mid" }));
  }
  out.push(S(k.slabOf(PLATE, Z(z0), Z(PLATE_H), P, 8, 1.4), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 1.1 * K), Z(ZB), P), { tone: "lo" }));
  const screws = k.corners(PLATE, 2.4 * K);
  out.push(L(screws.map(([x, y]) => k.ring(x, y, 0.55 * K, Z(ZB), P, 16)).join(""), { tone: "lo" }));
  out.push(D(screws.map(([x, y]) => k.iso([x, y, Z(ZB)], P)), { size: 0.5 }));
  // the model's footing: a shallow plinth the block stands in
  out.push(S(k.slabOf(plan(UE - 0.5, UW + 0.5, VE - 0.5, 0.5, 0.2), Z(ZB), Z(0.4), P, 2, 0.4), { tone: "lo" }));
  return out.join("");
}
const RULER = plan(-0.6, 65.6, 1.5, 3.3, 0.15);
function ruler() {
  const out = [S(k.slabOf(RULER, Z(ZB), Z(0.25), P, 3), { tone: "lo", crease: "none" })];
  const t = k.topTicks(X(65), X(0), K, 5, RULER.y + 0.2, Z(ZB + 0.25), [2.2, 4.2], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  out.push(L(k.lineOnTop([X(0), RULER.y + 0.2], [X(0), RULER.y + 6.2], Z(ZB + 0.25), P), { tone: "hi" }));
  out.push(D([k.iso([RULER.x + 1.6, RULER.y + 3.6, Z(ZB + 0.25)], P), k.iso([RULER.x + RULER.w - 1.6, RULER.y + 3.6, Z(ZB + 0.25)], P)], { size: 0.45 }));
  return out.join("");
}
const LABEL = plan(-15.6, -5.2, 0.8, 3.6, 0.3);
function label() {
  const zt = Z(ZB + 0.3);
  const out = [S(k.slabOf(LABEL, Z(ZB), Z(0.3), P, 3, 0.3), { tone: "mid" })];
  out.push(L(k.planOutline(k.insetPlan(LABEL, 0.35 * K), zt, P, 3), { tone: "faint" }));
  out.push(k.faceTextSvg(k.topMatrix([X(-6.1), Y(1.85)], zt, P, "x"), "RANI KI VAV · PATAN", { size: 2.25, tone: "mid", anchor: "start" }));
  const rule = (v, u0, u1) => L(k.lineOnTop([X(u0), Y(v)], [X(u1), Y(v)], zt, P), { tone: "lo", free: true });
  out.push(rule(2.55, -6.1, -12.4), rule(3.05, -6.1, -10.2));
  out.push(D([k.iso([X(-15.05), Y(2.2), zt], P), k.iso([X(-5.75), Y(2.2), zt], P)], { size: 0.45 }));
  return out.join("");
}
const DIAL = { u: -10.4, v: -5.0, r: 3.3, h: 1.4 };
const dialAngle = (month) => (month / 12) * Math.PI * 2;
const needleAt = (month) => {
  const a = dialAngle(month);
  const [cx, cy] = [X(DIAL.u), Y(DIAL.v)];
  const R = DIAL.r * K;
  return k.lineOnTop([cx - Math.sin(a) * 0.12 * R, cy + Math.cos(a) * 0.12 * R], [cx + Math.sin(a) * 0.76 * R, cy - Math.cos(a) * 0.76 * R], Z(ZB + DIAL.h) + 0.2, P);
};
function dial() {
  const [cx, cy] = [X(DIAL.u), Y(DIAL.v)];
  const R = DIAL.r * K, z0 = Z(ZB), top = Z(ZB + DIAL.h);
  const out = [`<path class="iso-halo" d="${k.haloOf({ x: cx - R, y: cy - R, w: 2 * R, d: 2 * R, r: R }, z0, 0.1, P)}" style="filter:blur(4px)"/>`];
  out.push(S(k.cylinder(cx, cy, R + 1.6, z0, 1.2, P, 72), { tone: "lo" }));
  out.push(S(k.cylinder(cx, cy, R, z0 + 1.2, top - z0 - 1.2, P, 72, 0.8), { tone: "hi", crease: "lo" }));
  out.push(L(k.knurl(cx, cy, R, top - 2.2, top, 90, P, 0.3), { tone: "lo" }));
  out.push(L(k.sideArc(cx, cy, R, top - 2.2, P, 48), { tone: "faint" }));
  out.push(L(k.ring(cx, cy, R - 1.6, top, P, 72), { tone: "lo" }));
  const t = k.radialTicks(cx, cy, R - 1.6, 12, 3, top, [1.6, 3.0], P);
  out.push(L(t.minor, { tone: "lo" }), L(t.major, { tone: "mid" }));
  // the monsoon arc: Jun to Sep engraved inside the ticks
  const arc = [];
  for (let i = 0; i <= 24; i++) {
    const a = dialAngle(5 + (i / 24) * 3.5);
    arc.push([cx + Math.sin(a) * (R - 5.4), cy - Math.cos(a) * (R - 5.4)]);
  }
  out.push(L(k.onTop(arc, top, P), { tone: "mid", free: true }));
  out.push(L(k.ring(cx, cy, 1.5, top, P, 20), { tone: "mid" }));
  // the crown, on the side toward the viewer
  out.push(S(k.slabOf({ x: cx + R - 0.6, y: cy - 1.4, w: 3.4, d: 2.8, r: 0.8 }, z0 + 2.2, 2.2, P, 3), { tone: "mid" }));
  out.push(S(k.cylinder(cx + R + 4.4, cy, 1.9, z0 + 1.2, 4.2, P, 24), { tone: "mid" }));
  out.push(L(k.knurl(cx + R + 4.4, cy, 1.9, z0 + 1.2, z0 + 5.4, 20, P), { tone: "lo" }));
  return out.join("");
}
// gauge on the section: a depth scale and a sight glass reading the water table
const SCALE = { u0: SCALE_U0 + 0.25, u1: -2.3, out: 0.32 };
const GLASS = { u0: -1.95, u1: -0.85, out: 0.5, slot: 0.18 };
function gauge() {
  const out = [];
  const sp = plan(SCALE.u0, SCALE.u1, 0, SCALE.out, 0.04);
  out.push(S(k.slabOf(sp, Z(-30.8), Z(31.2), P, 2), { tone: "lo", crease: "none" }));
  // ticks hang from the scale's west edge (its left silhouette) across the front face
  const tk = [];
  for (let m = 0; m <= 30; m++) {
    const len = m % 5 === 0 ? 0.62 : 0.32;
    tk.push(seg([SCALE.u1, SCALE.out, -m], [SCALE.u1 - len, SCALE.out, -m]));
  }
  // the scale's west edge is u1 (x smaller is west: X decreases with u) -> ticks grow east
  out.push(L(tk.filter((_, m) => m % 5).join(""), { tone: "lo" }), L(tk.filter((_, m) => m % 5 === 0).join(""), { tone: "mid" }));
  out.push(D([at(SCALE.u0 + 0.5, SCALE.out, -30.4), at(SCALE.u0 + 0.5, SCALE.out, 0.15)], { size: 0.45 }));
  const gp = plan(GLASS.u0, GLASS.u1, 0, GLASS.out, 0.08);
  out.push(S(k.slabOf(gp, Z(-30.8), Z(31.2), P, 2, 0.3), { tone: "mid" }));
  const c = (GLASS.u0 + GLASS.u1) / 2, w = GLASS.slot;
  const slot = onV(GLASS.out, [[c - w, -30], [c + w, -30], [c + w, -0.3], [c - w, -0.3]]);
  out.push(`<path class="rv-glass" d="${slot}"/>`);
  out.push(`<path class="rv-col" data-part="column" d=""/>`);
  out.push(L(slot, { tone: "mid" }));
  out.push(`<path class="iso-line" data-tone="lit" data-part="meniscus" d="" style="stroke-width:1"/>`);
  out.push(D([at(c, GLASS.out, -30.45), at(c, GLASS.out, 0.15)], { size: 0.45 }));
  // caps on both gauge parts
  out.push(S(k.slabOf(plan(SCALE.u0 - 0.12, GLASS.u1 + 0.12, -0.05, GLASS.out + 0.12, 0.05), Z(0.4), Z(0.35), P, 2, 0.3), { tone: "mid" }));
  return out.join("");
}

// ---------------------------------------------------------------- assemble
const wet = SORTED.map((it, i) => `<g id="rv${i}">${it.svg}</g>`).join("");
const clips = SORTED.map((_, i) => `<clipPath id="rc${i}" clipPathUnits="userSpaceOnUse"><path d=""/></clipPath>`).join("");
const dry = SORTED.map((_, i) => `<use href="#rv${i}" clip-path="url(#rc${i})" data-dry="${i}"/>`).join("");
const sectionClip = `<clipPath id="rv-below" clipPathUnits="userSpaceOnUse"><path data-part="below" d=""/></clipPath>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A sectional model of Rani ki Vav, the eleventh-century stepwell at Patan, cut down its long east-west axis and standing on a bench. Seven flights of stairs fall 23 metres westward past three pillared pavilion towers to a square kund, and beyond it a round well shaft drops to 30 metres. A month dial sets the water table: water rises in the shaft, fills the kund and climbs the stairs terrace by terrace, and a sight glass on the section reads its depth.",
  body: [
    `<defs>${clips}${sectionClip}</defs>`,
    bench(),
    `<g data-layer="wet">${wet}</g>`,
    `<g data-layer="water"><path class="rv-water" data-part="surface" d=""/><path class="rv-water-edge" data-part="surface-edge" d=""/></g>`,
    `<g data-layer="dry">${dry}</g>`,
    `<g data-layer="section">`,
    `<path class="rv-cut" d="${cutD}" fill-rule="evenodd"/>`,
    `<path class="rv-lining" d="${liningD}" fill-rule="evenodd"/>`,
    L(strata.join(""), { tone: "faint" }),
    D(grains, { size: 0.42, tone: "lo" }),
    L(joints.join(""), { tone: "faint" }),
    `<path class="rv-damp" d="${cutD}" fill-rule="evenodd" clip-path="url(#rv-below)"/>`,
    `<path class="rv-water rv-water-cut" d="${waterCutD}" fill-rule="evenodd" clip-path="url(#rv-below)"/>`,
    L(liningD, { tone: "lo" }),
    L(cutD, { tone: "hi" }),
    `<path class="iso-line rv-table" data-part="table" d=""/>`,
    `</g>`,
    gauge(),
    ruler(),
    label(),
    dial(),
    `<path data-part="needle" class="iso-line" data-tone="hi" data-free="" d="${needleAt(8)}" style="stroke-width:1.1"/>`,
  ],
});

const RV_CSS = `
.iso{--rv-water:#5d7f96;--rv-water-ink:#8fb3cc;--rv-water-a:.38;--rv-cut:#101010;--rv-stone:#161616;--rv-damp:#5d7f96;--rv-damp-a:.07}
.iso[data-theme="light"]{--rv-water:#7f9db1;--rv-water-ink:#4f7189;--rv-water-a:.42;--rv-cut:#ebeae6;--rv-stone:#f3f2ee;--rv-damp:#8eaabd;--rv-damp-a:.09}
.rv-cut{fill:var(--rv-cut);stroke:none}
.rv-lining{fill:var(--rv-stone);stroke:none}
.rv-water{fill:var(--rv-water);fill-opacity:var(--rv-water-a);stroke:none}
.rv-water-cut{fill-opacity:calc(var(--rv-water-a) + .16)}
.rv-damp{fill:var(--rv-damp);fill-opacity:var(--rv-damp-a);stroke:none}
.rv-water-edge{fill:none;stroke:var(--rv-water-ink);stroke-width:.6;stroke-linejoin:round;vector-effect:non-scaling-stroke}
.rv-table{stroke:var(--rv-water-ink)!important;stroke-width:.7}
.rv-glass{fill:var(--anatomy-shade-0);stroke:none}
.rv-col{fill:var(--rv-water-ink);stroke:none}
.iso-page{width:min(900px,100% - 32px)}
.iso-stage{outline:none;touch-action:pan-y}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
@media (max-width:560px){.iso-stage{overflow:hidden;margin:0 -12px}.iso-stage .iso-svg{width:118%;max-width:none;margin-left:-9%}}
`;

const live = `
const P = ${JSON.stringify(P)};
const K = ${K}, UW = ${UW}, UE = ${UE}, UT = ${UT}, US = ${US}, RS = ${RS}, ZS = ${ZS}, ZB = ${ZB};
const COLS = ${JSON.stringify(COLUMNS.map((c) => [+c.u0.toFixed(4), +c.top.toFixed(4), +c.back.toFixed(4)]))};
const LANDINGS = ${JSON.stringify(Array.from({ length: FLIGHTS }, (_, i) => +zL(i + 1).toFixed(4)))};
const BACKS = ${JSON.stringify(Array.from({ length: FLIGHTS }, (_, i) => +(-(WC + setback(i + 1))).toFixed(4)))};
const BOXES = ${JSON.stringify(SORTED.map((it) => it.box.map((v) => +v.toFixed(3))))};
const TABLE = ${JSON.stringify(TABLE)};
const MONTHS = ${JSON.stringify(MONTHS)};
const GLASS = ${JSON.stringify(GLASS)};
const DIAL = ${JSON.stringify(DIAL)};
const at = (u, v, z) => iso([(UW - u) * K, v * K, z * K], P);
const pts = (list) => list.map(([x, y]) => x.toFixed(1) + " " + y.toFixed(1)).join("L");
const poly = (list) => "M" + pts(list) + "Z";
const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const q = (name) => svg.querySelector('[data-part="' + name + '"]');
const surface = q("surface"), surfaceEdge = q("surface-edge"), below = q("below"), table = q("table");
const column = q("column"), meniscus = q("meniscus"), needle = q("needle");
const dry = [...svg.querySelectorAll("[data-dry]")];
const clips = BOXES.map((_, i) => svg.querySelector("#rc" + i + " path"));
const readout = document.querySelector("[data-readout]");
const still = matchMedia("(prefers-reduced-motion: reduce)");

// the water table through the year: a periodic Catmull-Rom curve through the monthly values
const levelAt = (m) => {
  const n = 12, f = ((m % n) + n) % n, i = Math.floor(f), t = f - i;
  const p0 = TABLE[(i + n - 1) % n], p1 = TABLE[i], p2 = TABLE[(i + 1) % n], p3 = TABLE[(i + 2) % n];
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
};
function hull(points) {
  const s = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], hi = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = s.length - 1; i >= 0; i--) { const p = s[i]; while (hi.length >= 2 && cross(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) hi.pop(); hi.push(p); }
  return [...lo.slice(0, -1), ...hi.slice(0, -1)];
}
let drawnH = null;
function water(h) {
  if (drawnH !== null && Math.abs(h - drawnH) < 0.002) return;
  drawnH = h;
  const zh = h * K;
  // parts above the water are drawn again over the water surface
  BOXES.forEach(([x0, x1, y0, y1, z0, z1], i) => {
    const el = dry[i];
    if (z1 <= zh + 0.01) { if (el.style.display !== "none") el.style.display = "none"; return; }
    if (el.style.display === "none") el.style.display = "";
    const lo = Math.max(z0, zh), e = 0.8;
    const c = [];
    for (const x of [x0 - e, x1 + e]) for (const y of [y0 - e, y1 + e]) for (const z of [lo, z1 + e]) c.push(iso([x, y, z], P));
    clips[i].setAttribute("d", poly(hull(c)));
  });
  // the water surface: the corridor and kund west of the waterline, and the half shaft
  let d = "", edge = "";
  if (h > LANDINGS[LANDINGS.length - 1] + 0.001) {
    let uw = UT, back = BACKS[BACKS.length - 1];
    for (let i = 0; i < COLS.length; i++) if (COLS[i][1] < h) { uw = COLS[i][0]; back = COLS[i][2]; break; }
    for (let j = 0; j < LANDINGS.length; j++) { const top = j ? LANDINGS[j - 1] : 0; if (h < top && h >= LANDINGS[j]) back = BACKS[j]; }
    const ring = [at(uw, 0, h), at(UT, 0, h), at(UT, back, h), at(uw, back, h)];
    d += poly(ring);
    edge += "M" + pts([ring[0], ring[3], ring[2], ring[1]]);
  }
  const arc = [];
  for (let i = 0; i <= 48; i++) { const t = Math.PI + (Math.PI * i) / 48; arc.push(at(US + RS * Math.cos(t), RS * Math.sin(t), h)); }
  d += poly(arc);
  edge += "M" + pts(arc);
  surface.setAttribute("d", d);
  surfaceEdge.setAttribute("d", edge);
  below.setAttribute("d", poly([at(UE - 1, 0, h), at(UW + 1, 0, h), at(UW + 1, 0, ZB - 1), at(UE - 1, 0, ZB - 1)]));
  table.setAttribute("d", "M" + pts([at(UE, 0, h), at(UW, 0, h)]));
  const c = (GLASS.u0 + GLASS.u1) / 2, w = GLASS.slot;
  column.setAttribute("d", poly([at(c - w, GLASS.out, -30), at(c + w, GLASS.out, -30), at(c + w, GLASS.out, h), at(c - w, GLASS.out, h)]));
  meniscus.setAttribute("d", "M" + pts([at(c - w, GLASS.out, h), at(c + w, GLASS.out, h)]));
}
const needleAt = (month) => {
  const a = (month / 12) * Math.PI * 2;
  const cx = (UW - DIAL.u) * K, cy = DIAL.v * K, R = DIAL.r * K;
  return lineOnTop([cx - Math.sin(a) * 0.12 * R, cy + Math.cos(a) * 0.12 * R], [cx + Math.sin(a) * 0.76 * R, cy - Math.cos(a) * 0.76 * R], (ZB + DIAL.h) * K + 0.2, P);
};
let month = 8, target = 8, frame = 0, last = 0, clock = 0, touring = !still.matches, visible = false, idle = 0, said = "";
const TOUR = 1.7; // seconds per month
function draw() {
  const h = levelAt(month);
  water(h);
  needle.setAttribute("d", needleAt(((month % 12) + 12) % 12));
  const name = MONTHS[Math.round(((month % 12) + 12) % 12) % 12];
  const under = LANDINGS.filter((z) => z < h).length;
  const where = under ? under + " of 7 landings wet" : h > ZS ? "only the shaft holds water" : "dry";
  const text = name + " · water " + (-h).toFixed(1) + " m down · " + where;
  if (readout.textContent !== text) readout.textContent = text;
  if (name !== said) { said = name; stage.setAttribute("aria-valuetext", name + ": water table " + (-h).toFixed(1) + " metres below ground, " + where); stage.setAttribute("aria-valuenow", String(Math.round(((month % 12) + 12) % 12))); }
}
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (touring) { clock += dt; target = 8 + clock / TOUR; }
  month = calm ? target : month + (target - month) * (1 - Math.exp(-dt / 0.35));
  if (Math.abs(target - month) < 0.0005) month = target;
  draw();
  const settled = !touring && month === target;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
const steer = (next) => {
  if (touring) { touring = false; month = ((month % 12) + 12) % 12; }
  target = next;
  clearTimeout(idle);
  idle = setTimeout(() => { if (still.matches) return; touring = true; clock = (((month - 8) % 12) + 12) % 12 * TOUR; run(); }, 3600);
  run();
};
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const aim = (event) => {
  const box = svg.getBoundingClientRect();
  const share = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
  steer(share * 11.999);
};
stage.addEventListener("pointermove", aim);
stage.addEventListener("pointerdown", aim);
stage.addEventListener("keydown", (event) => {
  let to = null;
  const here = Math.round(((target % 12) + 12) % 12);
  if (event.key === "ArrowRight" || event.key === "ArrowUp") to = (here + 1) % 12;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") to = (here + 11) % 12;
  if (event.key === "Home") to = 5;
  if (event.key === "End") to = 8;
  if (event.key === "Escape") { touring = false; to = here; }
  if (to === null) return;
  event.preventDefault();
  if (touring) { touring = false; month = ((month % 12) + 12) % 12; }
  if (Math.abs(to - month) > 6) month += to > month ? 12 : -12;
  steer(to);
});
window.__rv = { seek: (m) => { touring = false; clearTimeout(idle); month = target = m; draw(); } };
draw();
`;

const body = k.plateHtml({
  fig: "Fig 1",
  title: "Rani ki Vav, in section",
  hint: "Hover or drag across: months",
  readout: "",
  keys: [
    { mark: "lit", label: "Sight glass: the water table, read in metres below ground" },
    { mark: "raised", label: "Three pavilion towers and the kund galleries; storeys grow toward the well" },
    { mark: "flat", label: "Section through the stair masonry and the earth it is cut into" },
  ],
  caption:
    "Rani ki Vav, Patan (c. 1063 CE), cut down its east-west axis. Seven flights of stairs, 112 risers in all, fall 23 m to a 9.5 × 9.4 m kund; the well shaft beyond is 10 m across and 30 m deep. Turn the months and the water table rises and falls: the stairs exist so that, whatever the season, you can walk down to the water. Built dimensions are from published surveys; the monthly water curve is illustrative of the dry-season fall and monsoon recharge, not a measured record.",
  body: `<div class="iso-stage" tabindex="0" role="slider" aria-label="Rani ki Vav section: arrow keys change the month, Home is the June low, End the September high" aria-valuemin="0" aria-valuemax="11" aria-valuenow="8">${svg}</div>`,
});

const file = theme === "light" ? "rani-ki-vav-light.html" : "rani-ki-vav.html";
const html = k.pageHtml({ title: "Rani ki Vav, in section", theme, body, script: kitScript() + live, width: 900 }).replace("</style>", RV_CSS + "</style>");
writeFileSync(join(HERE, file), html);
if (theme === "light") writeFileSync(join(HERE, "index.html"), html); // light ships
console.log("wrote", file, (html.length / 1024).toFixed(0) + " KB");
