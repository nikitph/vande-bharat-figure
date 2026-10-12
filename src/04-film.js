/* ---------- the film: ten chapters of tweens over one looping timeline ---------- */
const BASE = {
  scan: 0, speed: 0, doors: 1, panto: 0, power: 0, flow: 0, head: 0, cabin: 0, airflow: 0, streaks: 0,
  explode: 1, cut: 0, labels: 0, camAz: 318, camEl: 26, camZoom: 1, camX: 0
};
const KEYS = Object.keys(BASE);
const EASE = {
  io: s => s * s * s * (s * (s * 6 - 15) + 10), s: s => s * s * (3 - 2 * s), lin: s => s,
  in: s => s * s, out: s => 1 - (1 - s) * (1 - s)
};
const cam = (az, el, zoom, x, t0, t1, e = "io") => [["camAz", az, t0, t1, e], ["camEl", el, t0, t1, e], ["camZoom", zoom, t0, t1, e], ["camX", x, t0, t1, e]];
const X_DTC = CAR_PITCH, X_TC = -CAR_PITCH;

const CHAPTERS = [{
  id: "build", n: 1, name: "Assembly", status: "ASSEMBLY", dur: 4,
  tw: [["explode", 0, .3, 3.6, "io"], ["scan", 1, .6, 3.9, "lin"], ...cam(314, 24, 1.08, 0, 0, 4, "s")],
  cap: [
    [.1, "VANDE BHARAT · THREE CARS OF SIXTEEN", "A trainset with no locomotive: the traction equipment is spread out under the coaches."],
    [1.9, "ASSEMBLY", "Bogies first, the underfloor equipment, floor and seats, then the walls, the nose and the roof — the pantograph last."]
  ]
}, {
  id: "platform", n: 2, name: "At the platform", status: "AT THE PLATFORM", dur: 2,
  tw: [["scan", 0, 0, .01, "lin"], ["cabin", 1, .2, .6], ...cam(302, 17, 1.9, X_DTC - 2, 0, 1.6)],
  cap: [[.1, "AT THE PLATFORM", "Doors open, steps out, pantograph down. Driving trailer in front, then a motor coach, then a trailer coach."]]
}, {
  id: "power", n: 3, name: "Power up", status: "POWER UP", dur: 3.8,
  tw: [...cam(248, 30, 3.4, X_TC + 5.6, 0, 1), ["panto", 1, .5, 2], ["flow", 1, 2, 2.4], ["head", 1, 2.6, 2.8],
    ...cam(290, 20, 1.45, -9, 2.4, 3.8)],
  cap: [
    [.1, "PANTOGRAPH UP", "It rises to the contact wire: 25,000 volts AC, 50 Hz."],
    [2.1, "THE POWER PATH", "Through the circuit breaker to the transformer under the floor, then to the traction converter and the motors."]
  ]
}, {
  id: "doors", n: 4, name: "Doors close", status: "DOORS CLOSING", dur: 2.2,
  tw: [...cam(304, 14, 4.2, X_DTC - 9.2, 0, .8), ["doors", 0, .6, 1.9]],
  cap: [[.1, "DOORS CLOSE", "Plug doors slide shut flush with the body and the steps retract. The train cannot take power until they lock."]]
}, {
  id: "depart", n: 5, name: "Departure", status: "DEPARTURE", dur: 4,
  tw: [...cam(284, 10, 5, BOGIE_X, 0, 1), ["power", 1, 0, .4], ["speed", 100, .2, 4, "s"], ...cam(322, 18, 1.3, 10, 2.6, 4)],
  cap: [
    [.1, "DEPARTURE", "Four motors under every motor coach. Half the axles on the train are driven."],
    [2.4, "0 – 100 KM/H IN ABOUT 52 S", "Distributed power gets it away from stations far quicker than a locomotive-hauled train."]
  ]
}, {
  id: "cruise", n: 6, name: "Cruise", status: "CRUISE", dur: 5,
  tw: [["speed", 160, 0, 1.6, "s"], ["power", .5, 1.6, 2], ["airflow", 1, .4, 1], ["streaks", 1, .3, .9],
    ...cam(338, 14, 2.1, X_DTC + 6, 0, 1.4), ...cam(215, 16, 1.25, 0, 1.8, 3.4), ...cam(276, 9, 1.5, 0, 3.6, 5)],
  cap: [
    [.1, "160 KM/H", "Cleared for 160 km/h in service and tested to 180. The nose is shaped to part the air cleanly."],
    [2.2, "ONE FIXED SET", "Sealed gangways, a cab at each end — at the terminus the crew simply walk to the other one."]
  ]
}, {
  id: "inside", n: 7, name: "Inside", status: "CRUISE · CUTAWAY", dur: 5,
  tw: [...cam(290, 24, 1.1, 0, 0, 1), ["cut", 1, .3, .8], ["labels", 1, .9, 1.1], ["labels", 0, 3.6, 3.8], ["cut", 0, 3.9, 4.4],
    ...cam(300, 20, 1.2, 4, 4, 5)],
  cap: [
    [.1, "INSIDE", "Chair car, three and two across; air-conditioning on the roof."],
    [1.2, "A LOCOMOTIVE, SPREAD OUT", "Transformer, converters, compressors and batteries all hang under the floor."]
  ]
}, {
  id: "brake", n: 8, name: "Regenerative braking", status: "REGENERATIVE BRAKING", dur: 3.6,
  tw: [["power", -1, 0, .3], ["speed", 40, .1, 3.4, "s"], ["airflow", 0, 1, 2], ["streaks", 0, 1, 2.2],
    ...cam(280, 11, 4, -BOGIE_X, 0, 1.2), ...cam(254, 28, 1.9, X_TC + 6, 1.8, 3.2)],
  cap: [
    [.1, "REGENERATIVE BRAKING", "The motors become generators and slow the train."],
    [1.7, "POWER FLOWS BACK", "The current runs the other way, up through the pantograph into the wire for other trains to use."]
  ]
}, {
  id: "arrive", n: 9, name: "Arrival", status: "ARRIVAL", dur: 3.2,
  tw: [["speed", 0, 0, 2.6, "out"], ["power", 0, 2.3, 2.6], ...cam(318, 22, 1.15, 6, 0, 1.6), ["doors", 1, 2.75, 3.2]],
  cap: [[.1, "ARRIVAL", "Disc brakes take over for the last few km/h. The doors are released only at a standstill."]]
}, {
  id: "shutdown", n: 10, name: "Shutdown", status: "SHUTDOWN", dur: 3.6,
  tw: [["head", 0, .3, .5], ["flow", 0, .2, .5], ["panto", 0, .4, 1.6], ["cabin", 0, 1.6, 1.9],
    ...cam(318, 26, 1, 0, 1.6, 3.6, "s"), ["explode", 1, 2, 3.5, "io"]],
  cap: [
    [.1, "SHUTDOWN", "Breaker open, pantograph down, lights out."],
    [2, "AND APART AGAIN", "Back to bogies, boxes and body shells."]
  ]
}];
const FILM_LEN = CHAPTERS.reduce((s, c) => s + c.dur, 0);
{ let t = 0; for (const c of CHAPTERS) { c.t0 = t; t += c.dur; } }
const angLerp = (a, b, k) => a + (((b - a) % 360 + 540) % 360 - 180) * k;

function applyChapter(ch, from, t) {
  const n = { ...from };
  for (const [key, to, t0, t1, e = "io"] of ch.tw) {
    if (t <= t0) continue;
    const k = EASE[e](clamp((t - t0) / Math.max(1e-6, t1 - t0)));
    n[key] = key === "camAz" ? angLerp(n[key], to, k) : lerp(n[key], to, k);
  }
  return n;
}
const CH_END = [];
{ let s = { ...BASE }; for (const ch of CHAPTERS) { s = applyChapter(ch, s, ch.dur + 1); CH_END.push(s); } }
const chapterAt = t => { let i = CHAPTERS.length - 1; while (i > 0 && CHAPTERS[i].t0 > t) i--; return i; };
function filmState(t) {
  t = (t % FILM_LEN + FILM_LEN) % FILM_LEN;
  const i = chapterAt(t);
  const s = applyChapter(CHAPTERS[i], i ? CH_END[i - 1] : BASE, t - CHAPTERS[i].t0);
  s.chapter = i;
  return s;
}
// distance along the track, scaled so the train comes back to the platform exactly as the film ends
const PERIOD = 236, DIST_N = Math.round(FILM_LEN * 120), DIST = new Float32Array(DIST_N + 1);
{
  let d = 0;
  for (let i = 1; i <= DIST_N; i++) { d += filmState((i - .5) / 120).speed / 120; DIST[i] = d; }
  const k = PERIOD / d;
  for (let i = 0; i <= DIST_N; i++) DIST[i] *= k;
}
function distanceAt(t) {
  t = (t % FILM_LEN + FILM_LEN) % FILM_LEN;
  const f = t * 120, i = Math.min(DIST_N - 1, Math.floor(f));
  return lerp(DIST[i], DIST[i + 1], f - i);
}
function stateAt(t) {
  const s = filmState(t);
  s.s = distanceAt(t);
  s.period = PERIOD;
  return s;
}

/* ---------- themes and paints ---------- */
const THEMES = [
  { id: "dark", name: "Dark", bg: "#1d1d1d", body: ["#262626", "#545454"], deck: ["#141414", "#1d1d1d"], dark: ["#060606", "#111111"], ink: "#7a7a7a", inkA: .8, mark: "#8a8a8a", glow: "#ffad55", shadow: "#121212", foam: "#3a3a3a", wave: "#3e3e3e" },
  { id: "paper", name: "Paper", bg: "#c5c6bf", body: ["#a7a8a1", "#f2f3ec"], deck: ["#8e8f88", "#b9bab3"], dark: ["#3a3b37", "#5f605a"], ink: "#4b4c45", inkA: .85, mark: "#f4f5ee", glow: "#e0a24e", shadow: "#a9aaa3", foam: "#dcddd6", wave: "#8f908a" },
  { id: "light", name: "Light", bg: "#e4e4e2", body: ["#bdbdb9", "#ffffff"], deck: ["#a9a9a5", "#d3d3d0"], dark: ["#4b4b4a", "#707070"], ink: "#62625f", inkA: .8, mark: "#ffffff", glow: "#e9a54e", shadow: "#c3c3c0", foam: "#f4f4f2", wave: "#a3a3a0" },
  { id: "blueprint", name: "Blueprint", bg: "#15294e", body: ["#1d3a70", "#3a63a8"], deck: ["#10213f", "#172e58"], dark: ["#0a142b", "#122347"], ink: "#9fb5e3", inkA: .85, mark: "#6a87bd", glow: "#d6e4ff", shadow: "#0f2140", foam: "#2c4a82", wave: "#3a5891" },
  { id: "sepia", name: "Sepia", bg: "#d4c8b4", body: ["#b4a486", "#f7f1e6"], deck: ["#9f8e71", "#c9bda6"], dark: ["#4a3a2a", "#6e5a44"], ink: "#6f5d46", inkA: .85, mark: "#f7f2e8", glow: "#c45a2f", shadow: "#b9ab93", foam: "#e6ded0", wave: "#a8987e" },
  { id: "colour", name: "Colour", colour: true, bg: "#dfe6ea", body: ["#c9c1b3", "#f6f2ea"], deck: ["#b3ab99", "#ded7c8"], dark: ["#2c3440", "#4a5563"], ink: "#26303a", inkA: .62, mark: "#ffffff", glow: "#ffb23c", shadow: "#b5c4cc", foam: "#ffffff", wave: "#cdeaf8" }
];
const PAINT_GROUPS = [
  ["The train", [
    ["body", "Body", "#f3f3ee"], ["stripe", "Livery band", "#1d4f9c"], ["roof", "Roof", "#dcdedb"], ["band", "Window band", "#15181c"], ["glass", "Glass", "#232a33"],
    ["door", "Doors", "#ecece6"], ["skirt", "Underframe skirts", "#3f4650"], ["step", "Steps", "#8f969d"], ["gangway", "Gangway bellows", "#2e3238"],
    ["hvac", "Roof air-conditioning", "#c9cdd1"], ["rubber", "Rubber and dark parts", "#25272b"]
  ]],
  ["High voltage and traction", [
    ["panto", "Pantograph", "#c8392f"], ["insulator", "Insulators", "#8a4b2a"], ["vcb", "Circuit breaker", "#d7d9d6"], ["busbar", "Roof line", "#d98a2f"],
    ["transformer", "Transformer", "#6f8a5a"], ["cooler", "Coolers", "#7d8791"], ["converter", "Traction converter", "#a7b0ba"], ["auxconv", "Auxiliary converter", "#b9c0c6"],
    ["motor", "Traction motors", "#c06a2b"], ["gearbox", "Gearboxes", "#7a8591"], ["battery", "Battery box", "#3f6f8f"], ["compressor", "Compressor", "#5d6c78"],
    ["brakeUnit", "Brake control", "#c9c2a8"], ["reservoir", "Air reservoirs", "#d4d6d2"]
  ]],
  ["Bogies", [
    ["bogie", "Bogie frames", "#3a3e44"], ["wheel", "Wheels and axles", "#6a6e74"], ["spring", "Springs", "#e0b33a"], ["damper", "Dampers", "#d8463a"], ["brake", "Brake discs", "#b3b7bb"]
  ]],
  ["Inside", [
    ["floor", "Floor", "#6d737d"], ["seat", "Seats", "#2f5fa8"], ["headrest", "Headrest covers", "#eeece6"], ["rack", "Luggage racks and ducts", "#d5d8da"],
    ["duct", "Ceiling duct", "#e2e3e0"], ["partition", "Partitions", "#dcd8cc"], ["toilet", "Toilet modules", "#c2cbd0"], ["pantry", "Pantry and cabinets", "#9aa3aa"],
    ["desk", "Driver's desk", "#4a4d51"], ["screen", "Displays", "#1d2a33"], ["cabSeat", "Crew seats", "#2b2e33"], ["uniform", "Crew uniform", "#e9e9e4"], ["skin", "Crew faces", "#b98a66"]
  ]],
  ["Track and station", [
    ["soil", "Ground", "#b7ad98"], ["ballast", "Ballast", "#948d82"], ["sleeper", "Sleepers", "#c2beb5"], ["rail", "Rails", "#5f4f45"], ["trough", "Cable trough", "#bdb9b0"],
    ["wire", "Overhead wires", "#a8683a"], ["mast", "Masts and posts", "#8f989d"], ["scrub", "Scrub", "#6f8f58"], ["cabinet", "Lineside cabinets", "#c9cdd0"], ["post", "Marker posts", "#f1efe8"],
    ["paving", "Platform", "#cfcac0"], ["platformEdge", "Platform warning strip", "#f0c02f"], ["platformLine", "Platform edge line", "#f6f5f0"], ["bench", "Benches", "#4d7a5a"], ["signboard", "Station board", "#f3d23c"]
  ]]
];
const PAINTS = Object.fromEntries(PAINT_GROUPS.flatMap(([, list]) => list.map(([k, , c]) => [k, c.toLowerCase()])));
const LIGHTS = [["head", "Headlights", "#fff4d6"]];
const LIVERIES = {
  blue: { body: "#f3f3ee", stripe: "#1d4f9c", door: "#ecece6", skirt: "#3f4650" },
  saffron: { body: "#f26b21", stripe: "#f3f3ee", door: "#f26b21", skirt: "#4f545b" }
};
const mixHex = (a, b, t) => {
  const n = parseInt(a.slice(1), 16), i = parseInt(b.slice(1), 16), f = r => Math.round((n >> r & 255) * (1 - t) + (i >> r & 255) * t);
  return "#" + [16, 8, 0].map(r => f(r).toString(16).padStart(2, "0")).join("");
};
function themeValues(id) {
  const e = THEMES.find(t => t.id === id) || THEMES[0];
  return {
    bg: e.bg, ink: e.ink, bodyLo: e.body[0], bodyHi: e.body[1], deckLo: e.deck[0], deckHi: e.deck[1], darkLo: e.dark[0], darkHi: e.dark[1],
    mark: e.mark, glow: e.glow, shadow: e.shadow, foam: e.foam, wave: e.wave, inkStrength: e.inkA, paint: !!e.colour,
    flow: e.colour ? "#f2541b" : e.glow, heat: e.colour ? "#ff5a1f" : e.glow, air: e.colour ? "#2f8fe0" : mixHex(e.ink, e.mark, .5), cabin: e.colour ? "#ffe2a8" : e.glow, highlight: e.glow
  };
}
const DEFAULTS = {
  theme: "dark", livery: "blue", render: "solid", density: 1, pointSize: 1,
  ...Object.fromEntries(LIGHTS.map(([k, , c]) => [k, c])),
  ...themeValues("dark"), ...PAINTS,
  lineWidth: 1.1, play: true, speed: 1, start: "0", filmCamera: true,
  azimuth: 318, elevation: 26, zoom: 1, focusX: 0,
  sunFrom: 318, sunHeight: 52, shadowSoftness: 2.4, ambient: .3,
  cutaway: false, explode: false, airflow: true, power: true, inspect: false, labels: false,
  filmCutaway: true, filmLabels: true, captions: false, ground: true, platform: true, drag: true, wheelZoom: true
};
function coerce(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (!(k in DEFAULTS) || v == null) continue;
    const d = DEFAULTS[k];
    if (typeof d === "boolean") out[k] = v === true || v === "true" || v === "" || v === "on";
    else if (typeof d === "number") { const n = Number(v); if (Number.isFinite(n)) out[k] = n; }
    else out[k] = String(v);
  }
  return out;
}
function mergeValues(cur, raw) {
  const t = coerce(raw), n = { ...cur };
  if ("theme" in t && THEMES.some(e => e.id === t.theme)) Object.assign(n, themeValues(t.theme));
  if ("livery" in t && LIVERIES[t.livery]) Object.assign(n, LIVERIES[t.livery]);
  return Object.assign(n, t);
}
const TOGGLES = [
  { key: "doors", label: "Doors", keys: { doors: [0, 1] }, dur: 2.2 },
  { key: "panto", label: "Pantograph", keys: { panto: [0, 1] }, dur: 2.4 },
  { key: "head", label: "Headlights", keys: { head: [0, 1] }, dur: .2 },
  { key: "cabin", label: "Cabin lights", keys: { cabin: [0, 1] }, dur: .4 }
];
