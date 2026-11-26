/* EL MAPA DE FUNES — CREATED BY DEV-HUNTERS
   Mundo abierto 3D en el navegador sobre el pueblo de Funes (Navarra).
   Los edificios y calles se generan al cargar a partir de datos reales de OpenStreetMap
   (© colaboradores de OpenStreetMap, ODbL). Motor: three.js (MIT). */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2, hyp = Math.hypot;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const hexRGB = h => { const n = typeof h === 'string' ? parseInt(h.slice(1), 16) : h; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const pick = a => a[(Math.random() * a.length) | 0];

/* ================= PANTALLA DE CARGA RÁPIDA ================= */
const T0 = performance.now();
const loader = $('#loader'), loadBar = $('#loadBar'), loadMsg = $('#loadMsg');
let prog = 0;
const setProg = p => { prog = Math.max(prog, p); loadBar.style.width = prog + '%'; };
const loadImg = (el, src) => new Promise(r => { el.onload = el.onerror = r; el.src = src; });
setProg(12);
const imgsReady = Promise.all([
  loadImg($('#bgfull'), 'fondo-carga.jpg').then(() => { $('#bgfull').classList.add('on'); setProg(60); }),
  loadImg($('#loadLogo'), 'logo.png').then(() => setProg(45))
]);

/* ================= AJUSTES / GUARDADO ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
};
const settings = Object.assign({ quality: 'alta', sound: true, tod: 'tarde', police: true, sens: 1 }, store.get('funes-settings3d', {}));
const save = Object.assign({ mission: 0, money: 0, char: { name: 'Issa', skin: '#e8b98a', shirt: '#e63946', pants: '#26324a' }, weapons: ['fist', 'pistol'], ammo: { pistol: 80, shotgun: 0, smg: 0 } }, store.get('funes-save3d', {}));
const saveAll = () => store.set('funes-save3d', save);
const saveSettings = () => store.set('funes-settings3d', settings);

if (typeof THREE === 'undefined') {
  loadMsg.textContent = 'No se pudo cargar el motor 3D. Revisa tu conexión y recarga.';
  loadBar.style.background = '#e63946'; loadBar.style.width = '100%';
  return;
}

/* ================= DATOS DEL MAPA (OpenStreetMap) ================= */
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
async function overpass(q, ms = 22000) {
  let last;
  for (const url of OVERPASS) {
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) { last = e; }
  }
  throw last;
}
const R_AREA = 1300;
async function fetchOSM(onP) {
  const cached = store.get('funes-osm-v1', null);
  if (cached && cached.els && cached.els.length > 200) { onP(40); return cached; }
  onP(5);
  const f = await overpass('[out:json][timeout:20];node["place"~"^(village|town|hamlet)$"]["name"="Funes"](41.9,-2.3,42.8,-1.3);out 3;', 15000);
  const c = f.elements && f.elements[0];
  if (!c) throw new Error('Funes no encontrado');
  onP(15);
  const A = `(around:${R_AREA},${c.lat},${c.lon})`;
  const q = `[out:json][timeout:40];(way["building"]${A};way["highway"]${A};way["waterway"~"^(riverbank|river|stream|canal)$"]${A};way["natural"="water"]${A};way["leisure"~"^(park|pitch|garden|playground)$"]${A};way["landuse"~"^(grass|forest)$"]${A};node["natural"="tree"]${A};node["amenity"~"^(townhall|place_of_worship|school)$"]${A};);out geom;`;
  const d = await overpass(q, 30000);
  onP(40);
  const out = { lat: c.lat, lon: c.lon, els: d.elements || [] };
  store.set('funes-osm-v1', out);
  return out;
}

/* Pueblo de respaldo (si no hay conexión con OpenStreetMap) */
function fallbackData() {
  const r = mulberry32(1126), els = []; let id = 1;
  const lat0 = 42.3167, lon0 = -1.8167, mx = 111320 * Math.cos(lat0 * Math.PI / 180), my = 110574;
  const ll = (x, z) => ({ lat: lat0 - z / my, lon: lon0 + x / mx });
  const way = (pts, tags) => els.push({ type: 'way', id: id++, tags, geometry: pts.map(p => ll(p[0], p[1])) });
  const X = [-420, -210, 0, 210, 420], Z = [-330, -165, 0, 165, 330];
  const line = (a, b, step) => { const o = [], n = Math.round(hyp(b[0] - a[0], b[1] - a[1]) / step); for (let i = 0; i <= n; i++) o.push([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); return o; };
  X.forEach(x => way(line([x, -390], [x, 390], 15), { highway: 'residential', name: 'Calle ' + (Math.abs(x) / 210 + 1) }));
  Z.forEach(z => way(line([-470, z], [470, z], 10), { highway: z === 0 ? 'secondary' : 'residential', name: z === 0 ? 'Calle Mayor' : 'Calle ' + (Math.abs(z) / 165 + 5) }));
  way([[560, -500], [560, 500]], { waterway: 'river', name: 'Río Arga' });
  way(line([470, 0], [650, 0], 10), { highway: 'secondary', bridge: 'yes', name: 'Puente del Arga' });
  for (let i = 0; i < X.length - 1; i++) for (let j = 0; j < Z.length - 1; j++) {
    const x0 = X[i] + 14, x1 = X[i + 1] - 14, z0 = Z[j] + 14, z1 = Z[j + 1] - 14;
    for (let z = z0; z + 20 < z1; z += 26) for (let x = x0; x + 14 < x1; x += 22 + r() * 10) {
      const w = 16 + r() * 8, d = 14 + r() * 8; if (x + w > x1 || z + d > z1) continue; if (r() < .15) continue;
      const tags = { building: 'house' };
      if (i === 1 && j === 1 && x < X[1] + 40 && z < Z[1] + 40) { tags.building = 'church'; tags.amenity = 'place_of_worship'; tags.name = 'Iglesia de Funes'; }
      if (i === 2 && j === 1 && x < X[2] + 36 && z < Z[1] + 40) { tags.amenity = 'townhall'; tags.name = 'Ayuntamiento'; }
      way([[x, z], [x + w, z], [x + w, z + d], [x, z + d], [x, z]], tags);
    }
  }
  return { lat: lat0, lon: lon0, els };
}

/* Convertir elementos OSM → datos del mundo */
function parseOSM(osm) {
  const lat0 = osm.lat, lon0 = osm.lon, mx = 111320 * Math.cos(lat0 * Math.PI / 180), my = 110574;
  const P = g => g.map(p => [(p.lon - lon0) * mx, -(p.lat - lat0) * my]);
  const D = { buildings: [], roads: [], water: [], rivers: [], parks: [], trees: [], landmarks: [] };
  const walls = ['#d9b38c', '#e3cfa6', '#c98f6b', '#e8dcc0', '#bfa07a', '#d6a57e', '#efe3c8', '#d8c4a0', '#cf9a78'];
  const roofs = ['#a8473a', '#b5523f', '#9a3f33', '#8c4a3a', '#a65b45', '#b8624a'];
  const rr = mulberry32(777);
  const RW = { motorway: 14, trunk: 12, primary: 10, secondary: 9, tertiary: 8, unclassified: 6.5, residential: 6.5, living_street: 5, service: 4, pedestrian: 4, track: 3, footway: 1.8, path: 1.6, steps: 1.6, cycleway: 2 };
  const DRIVE = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'service', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']);
  for (const e of osm.els) {
    const t = e.tags || {};
    if (e.type === 'node') {
      if (t.natural === 'tree') D.trees.push([(e.lon - lon0) * mx, -(e.lat - lat0) * my]);
      else if (t.amenity) D.landmarks.push({ x: (e.lon - lon0) * mx, z: -(e.lat - lat0) * my, name: t.name || ({ townhall: 'Ayuntamiento', place_of_worship: 'Iglesia', school: 'Colegio' })[t.amenity] || 'Funes', kind: t.amenity });
      continue;
    }
    if (!e.geometry || e.geometry.length < 2) continue;
    const pts = P(e.geometry);
    if (t.building) {
      if (pts.length < 4) continue;
      pts.pop();
      let a = 0, cx = 0, cz = 0; for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; cx += p[0]; cz += p[1]; }
      const area = Math.abs(a / 2); if (area < 6) continue;
      let h = t['building:levels'] ? parseFloat(t['building:levels']) * 3.2 + 1.2 : t.height ? parseFloat(t.height) : (area > 700 ? 9 : 6.5 + rr() * 3.5);
      if (!(h > 2)) h = 7;
      const church = t.building === 'church' || t.building === 'cathedral' || t.amenity === 'place_of_worship';
      if (church) h = Math.max(h, 16);
      const b = { pts, h: Math.min(h, 40), wall: walls[(rr() * walls.length) | 0], roof: church ? '#9a5a3c' : roofs[(rr() * roofs.length) | 0] };
      if (church) b.wall = '#c9a979';
      D.buildings.push(b);
      const nm = t.name || (church ? 'Iglesia' : t.amenity === 'townhall' ? 'Ayuntamiento' : t.amenity === 'school' ? 'Colegio' : null);
      if (nm) D.landmarks.push({ x: cx / pts.length, z: cz / pts.length, name: nm, kind: church ? 'place_of_worship' : t.amenity || 'named' });
    } else if (t.highway) {
      D.roads.push({ pts, w: RW[t.highway] || 4, type: t.highway, drive: DRIVE.has(t.highway), name: t.name || '', bridge: t.bridge === 'yes' || t.bridge === 'viaduct' });
    } else if (t.waterway === 'river' || t.waterway === 'stream' || t.waterway === 'canal') {
      D.rivers.push({ pts, hw: (t.waterway === 'river' ? 16 : t.waterway === 'canal' ? 5 : 2.2) / 2, name: t.name || '' });
    } else if (t.waterway === 'riverbank' || t.natural === 'water') {
      if (pts.length >= 4) { pts.pop(); D.water.push({ pts }); }
    } else if (t.leisure || t.landuse) {
      if (pts.length >= 4) { pts.pop(); D.parks.push({ pts, c: t.landuse === 'forest' ? '#3d6b34' : t.leisure === 'pitch' ? '#5b9a4a' : '#6f9d4c' }); }
    }
  }
  return D;
}

/* ================= GEOMETRÍA ================= */
class Mesher {
  constructor() { this.p = []; this.c = []; this.u = []; }
  tri(a, b, c, col, ua, ub, uc) {
    this.p.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.c.push(col[0], col[1], col[2], col[0], col[1], col[2], col[0], col[1], col[2]);
    const z = [0, 0]; ua = ua || z; ub = ub || z; uc = uc || z;
    this.u.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]);
  }
  quad(a, b, c, d, col, ua, ub, uc, ud) { this.tri(a, b, c, col, ua, ub, uc); this.tri(a, c, d, col, ua, uc, ud); }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2));
    g.computeVertexNormals(); g.computeBoundingSphere();
    return g;
  }
  get empty() { return this.p.length === 0; }
}
class Grid {
  constructor(cell = 40) { this.cell = cell; this.m = new Map(); }
  add(item, x0, z0, x1, z1) {
    const c = this.cell;
    for (let i = Math.floor(x0 / c); i <= Math.floor(x1 / c); i++) for (let j = Math.floor(z0 / c); j <= Math.floor(z1 / c); j++) { const k = i + ',' + j; let a = this.m.get(k); if (!a) this.m.set(k, a = []); a.push(item); }
  }
  at(x, z) { return this.m.get(Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell)) || []; }
}
function pointInPoly(x, z, pts) {
  let in_ = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) in_ = !in_;
  }
  return in_;
}
function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  let t = l2 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0; t = clamp(t, 0, 1);
  return hyp(x - (a[0] + t * dx), z - (a[1] + t * dz));
}

/* ================= ESCENA ================= */
const cv = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(65, 1, 0.4, 1400);
const hemi = new THREE.HemisphereLight(0xffffff, 0x445533, .8); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1); scene.add(sun); scene.add(sun.target);
let skyMesh = null;
const TOD = {
  mediodia: { top: 0x4f93d8, hor: 0xcfe6f7, sun: 0xfff2d6, si: 1.0, hi: .85, hs: 0xd9ecff, hg: 0x556644, fog: 0xc4dcee, dir: [.45, 1, .35] },
  tarde:    { top: 0x2f3b7a, hor: 0xff9a5a, sun: 0xffa866, si: .95, hi: .6, hs: 0xffb48a, hg: 0x3d3446, fog: 0xe39066, dir: [-1, .42, .5] },
  noche:    { top: 0x04060f, hor: 0x1b2347, sun: 0x7d92ff, si: .35, hi: .38, hs: 0x5a68a8, hg: 0x1a1e30, fog: 0x0b1226, dir: [.3, 1, -.4] }
};
let todCur = TOD.tarde;
function applyTOD() {
  const T = todCur = TOD[settings.tod] || TOD.tarde;
  scene.background = new THREE.Color(T.hor); scene.fog = new THREE.Fog(T.fog, 160, 620);
  hemi.color.setHex(T.hs); hemi.groundColor.setHex(T.hg); hemi.intensity = T.hi;
  sun.color.setHex(T.sun); sun.intensity = T.si;
  if (skyMesh) { scene.remove(skyMesh); skyMesh.geometry.dispose(); }
  const g = new THREE.SphereGeometry(1000, 20, 14), pos = g.attributes.position, cols = [], top = hexRGB(T.top), hor = hexRGB(T.hor);
  for (let i = 0; i < pos.count; i++) { const k = clamp(pos.getY(i) / 700, 0, 1), s = Math.pow(k, .6); cols.push(hor[0] + (top[0] - hor[0]) * s, hor[1] + (top[1] - hor[1]) * s, hor[2] + (top[2] - hor[2]) * s); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  skyMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  skyMesh.renderOrder = -1; scene.add(skyMesh);
  applyQuality();
}
function applyQuality() {
  const low = settings.quality === 'baja';
  renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = !low; sun.castShadow = !low;
  if (!low) { sun.shadow.mapSize.set(2048, 2048); const s = sun.shadow.camera; s.left = -70; s.right = 70; s.top = 70; s.bottom = -70; s.near = 1; s.far = 260; sun.shadow.bias = -0.0006; }
  renderer.setSize(innerWidth, innerHeight);
  scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
}
function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

function windowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#f2ece0'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 60, 64, 4);
  g.fillStyle = '#e9e1cf'; g.fillRect(17, 13, 30, 40);
  g.fillStyle = '#2c3b4d'; g.fillRect(20, 16, 24, 34);
  g.fillStyle = '#4d6a85'; g.fillRect(20, 16, 24, 12);
  g.fillStyle = '#e9e1cf'; g.fillRect(31, 16, 2, 34); g.fillRect(20, 31, 24, 2);
  g.fillStyle = '#5a4a3a'; g.fillRect(13, 14, 4, 38); g.fillRect(47, 14, 4, 38);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}

/* ================= MUNDO ================= */
const W = { D: null, gB: new Grid(40), gW: new Grid(40), gBr: new Grid(40), root: new THREE.Group(), drive: null, walk: null, spawn: { x: 0, z: 0, yaw: 0 }, bounds: null, landmarks: [], ready: false, miniCv: null, mini: { sc: .6, x0: 0, z0: 0 } };
scene.add(W.root);

function buildGraph(roads, filter) {
  const map = new Map(), nodes = [], key = (x, z) => Math.round(x * 2) + ',' + Math.round(z * 2);
  const node = p => { const k = key(p[0], p[1]); let i = map.get(k); if (i === undefined) { i = nodes.length; map.set(k, i); nodes.push({ x: p[0], z: p[1], n: [] }); } return i; };
  for (const r of roads) {
    if (!filter(r)) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = node(r.pts[i]), b = node(r.pts[i + 1]); if (a === b) continue;
      if (!nodes[a].n.includes(b)) nodes[a].n.push(b);
      if (!nodes[b].n.includes(a)) nodes[b].n.push(a);
    }
  }
  return nodes;
}
function nearestNode(g, x, z) { let bi = -1, bd = 1e12; for (let i = 0; i < g.length; i++) { const d = (g[i].x - x) ** 2 + (g[i].z - z) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; }

function buildWorld(D, onP) {
  W.D = D;
  const walls = new Mesher(), roofs = new Mesher(), flat = new Mesher();
  const mat = (o) => new THREE.MeshLambertMaterial(o);
  let minX = 1e9, minZ = 1e9, maxX = -1e9, maxZ = -1e9;
  const ext = p => { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; if (p[1] < minZ) minZ = p[1]; if (p[1] > maxZ) maxZ = p[1]; };

  for (const pk of D.parks) {
    const c = hexRGB(pk.c);
    try { const tr = THREE.ShapeUtils.triangulateShape(pk.pts.map(p => new THREE.Vector2(p[0], p[1])), []); for (const t of tr) flat.tri([pk.pts[t[0]][0], .06, pk.pts[t[0]][1]], [pk.pts[t[1]][0], .06, pk.pts[t[1]][1]], [pk.pts[t[2]][0], .06, pk.pts[t[2]][1]], c); } catch (e) {}
  }
  const wc = hexRGB('#3a7ca5');
  for (const w of D.water) {
    let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; w.pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); ext(p); });
    w.bb = [x0, z0, x1, z1]; W.gW.add(w, x0, z0, x1, z1);
    try { const tr = THREE.ShapeUtils.triangulateShape(w.pts.map(p => new THREE.Vector2(p[0], p[1])), []); for (const t of tr) flat.tri([w.pts[t[0]][0], .09, w.pts[t[0]][1]], [w.pts[t[1]][0], .09, w.pts[t[1]][1]], [w.pts[t[2]][0], .09, w.pts[t[2]][1]], wc); } catch (e) {}
  }
  const ribbon = (M, pts, w, y, col, ext0 = 0) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = hyp(dx, dz); if (l < .01) continue;
      const nx = -dz / l * w / 2, nz = dx / l * w / 2, ex = dx / l * ext0, ez = dz / l * ext0;
      M.quad([a[0] - ex + nx, y, a[1] - ez + nz], [b[0] + ex + nx, y, b[1] + ez + nz], [b[0] + ex - nx, y, b[1] + ez - nz], [a[0] - ex - nx, y, a[1] - ez - nz], col);
    }
  };
  for (const rv of D.rivers) {
    ribbon(flat, rv.pts, rv.hw * 2, .09, wc);
    for (let i = 0; i < rv.pts.length - 1; i++) { const a = rv.pts[i], b = rv.pts[i + 1]; W.gW.add({ a, b, hw: rv.hw }, Math.min(a[0], b[0]) - rv.hw, Math.min(a[1], b[1]) - rv.hw, Math.max(a[0], b[0]) + rv.hw, Math.max(a[1], b[1]) + rv.hw); }
  }
  const asph = hexRGB('#3b3d42'), line = hexRGB('#d8d2b0'), walkc = hexRGB('#b9b2a2'), pedc = hexRGB('#c9bfa6'), trk = hexRGB('#8d7a55'), stone = hexRGB('#a99c85');
  D.roads.sort((a, b) => (a.drive ? 1 : 0) - (b.drive ? 1 : 0));
  for (const r of D.roads) {
    r.pts.forEach(ext);
    const col = r.drive ? asph : r.type === 'pedestrian' ? pedc : r.type === 'track' ? trk : walkc;
    const y = r.drive ? .16 : r.type === 'pedestrian' ? .17 : .19;
    ribbon(flat, r.pts, r.w, y, col, r.w * .12);
    if (r.drive && r.w >= 6.5) ribbon(flat, r.pts, .14, y + .02, line);
    if (r.w >= 4) for (let i = 1; i < r.pts.length - 1; i++) { const p = r.pts[i], n = 8, rad = r.w / 2; for (let k = 0; k < n; k++) { const a0 = k / n * TAU, a1 = (k + 1) / n * TAU; flat.tri([p[0], y, p[1]], [p[0] + Math.cos(a0) * rad, y, p[1] + Math.sin(a0) * rad], [p[0] + Math.cos(a1) * rad, y, p[1] + Math.sin(a1) * rad], col); } }
    if (r.bridge) for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = hyp(dx, dz); if (l < .1) continue;
      W.gBr.add({ a, b, hw: r.w / 2 + 1.5 }, Math.min(a[0], b[0]) - r.w, Math.min(a[1], b[1]) - r.w, Math.max(a[0], b[0]) + r.w, Math.max(a[1], b[1]) + r.w);
      for (const s of [-1, 1]) { const nx = -dz / l * (r.w / 2 + .2) * s, nz = dx / l * (r.w / 2 + .2) * s; roofs.quad([a[0] + nx, .1, a[1] + nz], [b[0] + nx, .1, b[1] + nz], [b[0] + nx, 1.1, b[1] + nz], [a[0] + nx, 1.1, a[1] + nz], stone); }
    }
  }
  onP && onP(55);
  let bi = 0;
  for (const b of D.buildings) {
    const pts = b.pts, n = pts.length, h = b.h, wc2 = hexRGB(b.wall), rc = hexRGB(b.roof);
    let acc = 0, x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9;
    const fl = Math.max(1, Math.round(h / 3.2));
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n], len = hyp(q[0] - p[0], q[1] - p[1]);
      const u0 = acc / 3.2, u1 = (acc + len) / 3.2; acc += len;
      walls.quad([p[0], 0, p[1]], [q[0], 0, q[1]], [q[0], h, q[1]], [p[0], h, p[1]], wc2, [u0, 0], [u1, 0], [u1, fl], [u0, fl]);
      x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); ext(p);
    }
    try { const tr = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []); for (const t of tr) roofs.tri([pts[t[0]][0], h, pts[t[0]][1]], [pts[t[1]][0], h, pts[t[1]][1]], [pts[t[2]][0], h, pts[t[2]][1]], rc); } catch (e) {}
    b.bb = [x0, z0, x1, z1]; W.gB.add(b, x0, z0, x1, z1);
    if (++bi % 800 === 0) onP && onP(55 + 25 * bi / D.buildings.length);
  }
  W.bounds = { x0: minX - 40, z0: minZ - 40, x1: maxX + 40, z1: maxZ + 40 };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), mat({ color: 0x6f8f4a }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; W.root.add(ground);
  const addM = (M, mt, shadow, recv) => { if (M.empty) return; const m = new THREE.Mesh(M.geometry(), mt); m.castShadow = shadow; m.receiveShadow = recv; W.root.add(m); };
  const tex = windowTexture();
  addM(flat, mat({ vertexColors: true, side: THREE.DoubleSide }), false, true);
  addM(walls, mat({ vertexColors: true, map: tex, side: THREE.DoubleSide }), true, true);
  addM(roofs, mat({ vertexColors: true, side: THREE.DoubleSide }), true, true);

  W.drive = buildGraph(D.roads, r => r.drive && r.type !== 'service');
  if (W.drive.length < 10) W.drive = buildGraph(D.roads, r => r.drive);
  W.walk = buildGraph(D.roads, r => r.type !== 'motorway' && r.type !== 'trunk');
  if (!W.walk.length) W.walk = W.drive;

  const rr = mulberry32(99), treePts = D.trees.slice(0, 900);
  for (const pk of D.parks) { if (pk.c !== '#3d6b34' && pk.c !== '#6f9d4c') continue; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; pk.pts.forEach(p => { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }); for (let k = 0; k < 40; k++) { const x = x0 + rr() * (x1 - x0), z = z0 + rr() * (z1 - z0); if (pointInPoly(x, z, pk.pts)) treePts.push([x, z]); } }
  for (let k = 0; k < 220 && W.drive.length; k++) { const a = W.drive[(rr() * W.drive.length) | 0]; if (!a.n.length) continue; const b = W.drive[a.n[0]], t = rr(), dx = b.x - a.x, dz = b.z - a.z, l = hyp(dx, dz) || 1, off = 6 + rr() * 2; treePts.push([a.x + dx * t - dz / l * off, a.z + dz * t + dx / l * off]); }
  const okTree = (x, z) => !hitsBuilding(x, z, 2.5) && !nearRoad(x, z, 3.5) && !waterAt(x, z);
  const trees = treePts.filter(p => okTree(p[0], p[1]));
  if (trees.length) {
    const crown = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat({ color: 0xffffff }), trees.length);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.14, .2, 1, 5), mat({ color: 0x5a3f28 }), trees.length);
    const o = new THREE.Object3D(), cc = new THREE.Color();
    trees.forEach((p, i) => { const s = 2.2 + rr() * 2, hh = 2 + rr() * 1.5; o.position.set(p[0], hh + s * .7, p[1]); o.scale.set(s, s * 1.15, s); o.rotation.y = rr() * 6; o.updateMatrix(); crown.setMatrixAt(i, o.matrix); cc.setHSL(.27 + rr() * .06, .45, .22 + rr() * .1); crown.setColorAt(i, cc); o.position.set(p[0], hh / 2, p[1]); o.scale.set(1, hh, 1); o.rotation.y = 0; o.updateMatrix(); trunk.setMatrixAt(i, o.matrix); });
    crown.castShadow = true; trunk.castShadow = true; W.root.add(crown, trunk);
  }
  const lamps = [];
  for (const r of D.roads) { if (!r.drive || r.w < 5) continue; for (let i = 0; i < r.pts.length - 1; i++) { const a = r.pts[i], b = r.pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = hyp(dx, dz); if (l < 1) continue; for (let t = 10; t < l; t += 38) { const off = r.w / 2 + 1.2, x = a[0] + dx / l * t - dz / l * off, z = a[1] + dz / l * t + dx / l * off; if (!hitsBuilding(x, z, 1) && !waterAt(x, z)) lamps.push([x, z]); } } }
  if (lamps.length) {
    const nL = Math.min(lamps.length, 1200);
    const lm = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .09, 5.2, 5), mat({ color: 0x333a40 }), nL), hd = new THREE.InstancedMesh(new THREE.BoxGeometry(.5, .16, .5), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), nL), o = new THREE.Object3D();
    lamps.slice(0, nL).forEach((p, i) => { o.position.set(p[0], 2.6, p[1]); o.updateMatrix(); lm.setMatrixAt(i, o.matrix); o.position.set(p[0], 5.3, p[1]); o.updateMatrix(); hd.setMatrixAt(i, o.matrix); });
    W.root.add(lm, hd);
  }

  // minimapa vectorial
  const sc = Math.min(.7, 2600 / Math.max(maxX - minX, maxZ - minZ, 1)), cw = Math.ceil((maxX - minX + 80) * sc), ch = Math.ceil((maxZ - minZ + 80) * sc);
  const mc = document.createElement('canvas'); mc.width = cw; mc.height = ch; const g = mc.getContext('2d');
  const X = x => (x - minX + 40) * sc, Z = z => (z - minZ + 40) * sc;
  const path = pts => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))); };
  g.fillStyle = '#4c6b3a'; g.fillRect(0, 0, cw, ch);
  D.parks.forEach(pk => { g.fillStyle = pk.c; path(pk.pts); g.closePath(); g.fill(); });
  g.fillStyle = '#3a7ca5'; D.water.forEach(w => { path(w.pts); g.closePath(); g.fill(); });
  g.strokeStyle = '#3a7ca5'; D.rivers.forEach(r => { g.lineWidth = r.hw * 2 * sc; path(r.pts); g.stroke(); });
  g.lineCap = 'round'; g.lineJoin = 'round';
  D.roads.forEach(r => { g.strokeStyle = r.drive ? '#d9d4c3' : '#a7a08c'; g.lineWidth = Math.max(1, r.w * sc * (r.drive ? 1.25 : 1)); path(r.pts); g.stroke(); });
  g.fillStyle = '#8a7d6c'; D.buildings.forEach(b => { path(b.pts); g.closePath(); g.fill(); });
  W.miniCv = mc; W.mini = { sc, x0: minX - 40, z0: minZ - 40 };

  W.landmarks = D.landmarks.filter((l, i, a) => a.findIndex(o => o.name === l.name && hyp(o.x - l.x, o.z - l.z) < 40) === i);
  const th = W.landmarks.find(l => l.kind === 'townhall') || W.landmarks.find(l => /ayunt/i.test(l.name));
  let sx = 0, sz = 0;
  if (th) { sx = th.x; sz = th.z; } else if (D.buildings.length) { D.buildings.forEach(b => { sx += b.pts[0][0]; sz += b.pts[0][1]; }); sx /= D.buildings.length; sz /= D.buildings.length; }
  const wi = nearestNode(W.walk, sx, sz);
  if (wi >= 0) { const n = W.walk[wi]; sx = n.x; sz = n.z; const m = W.walk[n.n[0]]; W.spawn = { x: sx, z: sz, yaw: m ? Math.atan2(m.x - sx, m.z - sz) : 0 }; } else W.spawn = { x: sx, z: sz, yaw: 0 };
  W.ready = true;
}

/* Colisiones */
function hitsBuilding(x, z, r) {
  for (const b of W.gB.at(x, z)) {
    const bb = b.bb; if (x < bb[0] - r || x > bb[2] + r || z < bb[1] - r || z > bb[3] + r) continue;
    if (pointInPoly(x, z, b.pts)) return true;
    const p = b.pts; for (let i = 0; i < p.length; i++) if (segDist(x, z, p[i], p[(i + 1) % p.length]) < r) return true;
  }
  return false;
}
function onBridge(x, z) { for (const s of W.gBr.at(x, z)) if (segDist(x, z, s.a, s.b) < s.hw) return true; return false; }
function waterAt(x, z) {
  let hit = false;
  for (const w of W.gW.at(x, z)) {
    if (w.pts) { const bb = w.bb; if (x < bb[0] || x > bb[2] || z < bb[1] || z > bb[3]) continue; if (pointInPoly(x, z, w.pts)) { hit = true; break; } }
    else if (segDist(x, z, w.a, w.b) < w.hw) { hit = true; break; }
  }
  return hit && !onBridge(x, z);
}
function nearRoad(x, z, m) { for (const r of W.D.roads) { if (!r.drive) continue; const hw = r.w / 2 + m; for (let i = 0; i < r.pts.length - 1; i++) { if (segDist(x, z, r.pts[i], r.pts[i + 1]) < hw) return true; } } return false; }
const blocked = (x, z, r) => hitsBuilding(x, z, r) || waterAt(x, z);
function tryMove(e, dx, dz, r) {
  let hit = false;
  if (blocked(e.x + dx, e.z, r)) hit = true; else e.x += dx;
  if (blocked(e.x, e.z + dz, r)) hit = true; else e.z += dz;
  return hit;
}

/* ================= PERSONAJES Y COCHES ================= */
const gcache = {}, mcache = {};
const GM = (w, h, d) => gcache[w + ',' + h + ',' + d] || (gcache[w + ',' + h + ',' + d] = new THREE.BoxGeometry(w, h, d));
const MM = c => mcache[c] || (mcache[c] = new THREE.MeshLambertMaterial({ color: c }));
function part(g, w, h, d, col, x, y, z) { const m = new THREE.Mesh(GM(w, h, d), MM(col)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; }
function makeHuman(shirt, skin, pants, hair) {
  const g = new THREE.Group();
  const legL = new THREE.Group(), legR = new THREE.Group(), armL = new THREE.Group(), armR = new THREE.Group();
  legL.position.set(-.13, .9, 0); legR.position.set(.13, .9, 0); armL.position.set(-.34, 1.56, 0); armR.position.set(.34, 1.56, 0);
  part(legL, .2, .9, .22, pants, 0, -.45, 0); part(legR, .2, .9, .22, pants, 0, -.45, 0);
  part(armL, .14, .62, .16, shirt, 0, -.3, 0); part(armR, .14, .62, .16, shirt, 0, -.3, 0);
  part(armL, .12, .14, .14, skin, 0, -.66, 0); part(armR, .12, .14, .14, skin, 0, -.66, 0);
  g.add(legL, legR, armL, armR);
  part(g, .54, .7, .3, shirt, 0, 1.25, 0);
  part(g, .27, .27, .27, skin, 0, 1.83, 0); part(g, .29, .12, .29, hair || '#2a1d14', 0, 1.99, -.01);
  const guns = {};
  const gunDefs = { pistol: [.07, .24, .1, '#222222'], smg: [.08, .4, .12, '#2a2a2a'], shotgun: [.08, .62, .1, '#4a3320'] };
  for (const k in gunDefs) { const d = gunDefs[k], m = new THREE.Mesh(GM(d[0], d[1], d[2]), MM(d[3])); m.position.set(0, -.66 - d[1] / 2 + .05, 0); m.visible = false; armR.add(m); guns[k] = m; }
  return { g, legL, legR, armL, armR, guns, walk: 0, shown: null };
}
function showGun(h, w) { if (h.shown === w) return; h.shown = w; for (const k in h.guns) h.guns[k].visible = k === w; }
function animHuman(h, speed, dt, armed, pitch) {
  h.walk += speed * dt * 2.2; const s = speed > .2 ? Math.sin(h.walk) * Math.min(.9, speed * .22) : 0;
  h.legL.rotation.x = s; h.legR.rotation.x = -s; h.armL.rotation.x = -s * .8;
  h.armR.rotation.x = armed ? -Math.PI / 2 - (pitch || 0) : s * .8;
}
function makeCar(col) {
  const g = new THREE.Group();
  part(g, 1.9, .62, 4.3, col, 0, .62, 0);
  part(g, 1.62, .56, 2.2, '#1d2833', 0, 1.2, -.2);
  part(g, 1.58, .09, 1.95, col, 0, 1.52, -.2);
  part(g, 1.5, .18, .9, col, 0, .98, 1.5);
  const wg = new THREE.CylinderGeometry(.34, .34, .26, 10), wm = MM('#15171a'), wheels = [];
  [[-.95, 1.35], [.95, 1.35], [-.95, -1.35], [.95, -1.35]].forEach(p => { const w = new THREE.Mesh(wg, wm); w.rotation.z = Math.PI / 2; w.position.set(p[0], .34, p[1]); g.add(w); wheels.push(w); });
  const hl = new THREE.MeshBasicMaterial({ color: 0xfff1b8 }), tl = new THREE.MeshBasicMaterial({ color: 0xdd2222 });
  [-.6, .6].forEach(x => { const a = new THREE.Mesh(GM(.4, .16, .08), hl); a.position.set(x, .72, 2.17); g.add(a); const b = new THREE.Mesh(GM(.4, .14, .08), tl); b.position.set(x, .74, -2.17); g.add(b); });
  return { g, wheels };
}

/* ================= ESTADO DEL JUEGO ================= */
const WEAPONS = {
  fist:    { n: 'Puños',    melee: true, dmg: 14, rate: .4 },
  pistol:  { n: 'Pistola',  dmg: 26, rate: .28, spread: .008, pellets: 1, range: 90 },
  shotgun: { n: 'Escopeta', dmg: 16, rate: .85, spread: .055, pellets: 7, range: 45 },
  smg:     { n: 'Subfusil', dmg: 11, rate: .085, spread: .03, pellets: 1, range: 80, auto: true }
};
const player = { x: 0, z: 0, y: 0, vy: 0, yaw: 0, hp: 100, car: null, w: 'pistol', cd: 0, h: null, speed: 0, aimT: 0, fired: false };
let cars = [], peds = [], cops = [], pickups = [], tracers = [], marker = null, markerRing = null;
let stars = 0, lastCrime = 0, gameTime = 0, missionIdx = 0, missionStart = 0, money = 0, MISSIONS = [];
let state = 'loading', camYaw = 0, camPitch = .25, usingTouch = false, noLock = false, lastLook = 0;
const keys = {}, mouse = { down: false, rdown: false }, stick = { x: 0, y: 0, id: null }, tf = { fire: false, brake: false };

const CAR_COLS = ['#c0392b', '#2c6fbb', '#e8e8e8', '#222222', '#d4a017', '#2e8b57', '#8e44ad', '#aab2bd', '#8c8c95', '#b5651d'];
function edgePos(g, off) {
  const a = g[(Math.random() * g.length) | 0]; if (!a || !a.n.length) return null;
  const bi = a.n[(Math.random() * a.n.length) | 0], b = g[bi], dx = b.x - a.x, dz = b.z - a.z, l = hyp(dx, dz) || 1, t = Math.random();
  return { x: a.x + dx * t - dz / l * off, z: a.z + dz * t + dx / l * off, yaw: Math.atan2(dx, dz), a, bi };
}
function newCar(parked, near) {
  for (let k = 0; k < 25; k++) {
    const p = edgePos(W.drive, parked ? 3.4 : 1.9); if (!p) return null;
    const d = hyp(p.x - player.x, p.z - player.z);
    if (near && (d < 60 || d > 280)) continue;
    if (hitsBuilding(p.x, p.z, 1.5) || waterAt(p.x, p.z)) continue;
    const m = makeCar(pick(CAR_COLS)); m.g.position.set(p.x, 0, p.z); m.g.rotation.y = p.yaw; scene.add(m.g);
    return { m, x: p.x, z: p.z, yaw: p.yaw, v: 0, steer: 0, ai: parked ? null : { from: p.a, to: p.bi }, parked, wreck: false, speedMax: rnd(8, 12) };
  }
  return null;
}
function newPed(near) {
  for (let k = 0; k < 25; k++) {
    const p = edgePos(W.walk, 2.6 * (Math.random() < .5 ? -1 : 1)); if (!p) return null;
    const d = hyp(p.x - player.x, p.z - player.z);
    if (near && (d < 25 || d > 190)) continue;
    if (blocked(p.x, p.z, .5)) continue;
    const h = makeHuman(pick(['#e63946', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#8d99ae', '#ffffff', '#6a4c93']), pick(['#e8b98a', '#c68642', '#f1c27d', '#8d5524']), pick(['#26324a', '#111111', '#5b3a29', '#5d6b7a']), pick(['#2a1d14', '#111111', '#8a5a2b', '#c9c9c9']));
    h.g.position.set(p.x, 0, p.z); scene.add(h.g);
    return { h, x: p.x, z: p.z, yaw: rnd(0, TAU), to: nearestNode(W.walk, p.x, p.z), hp: 40, dead: false, fear: 0, speed: 0 };
  }
  return null;
}
function newCop() {
  for (let k = 0; k < 20; k++) {
    const a = rnd(0, TAU), d = rnd(55, 95), x = player.x + Math.cos(a) * d, z = player.z + Math.sin(a) * d;
    if (blocked(x, z, .6)) continue;
    const h = makeHuman('#1d3a8a', '#e8b98a', '#15204a', '#111111'); showGun(h, 'pistol'); h.g.position.set(x, 0, z); scene.add(h.g);
    return { h, x, z, yaw: 0, hp: 70, dead: false, cop: true, cd: rnd(1, 2), speed: 0 };
  }
  return null;
}
function clearEntities() {
  [...cars.map(c => c.m.g), ...peds.map(p => p.h.g), ...cops.map(c => c.h.g), ...pickups.map(p => p.mesh)].forEach(g => g && scene.remove(g));
  cars = []; peds = []; cops = []; pickups = [];
}
function spawnAll() {
  clearEntities();
  const low = settings.quality === 'baja', nCars = low ? 10 : 16, nPark = low ? 14 : 26, nPed = low ? 18 : 32;
  for (let i = 0; i < nPark; i++) { const c = newCar(true, false); if (c) cars.push(c); }
  for (let i = 0; i < nCars; i++) { const c = newCar(false, false); if (c) cars.push(c); }
  for (let i = 0; i < nPed; i++) { const p = newPed(false); if (p) peds.push(p); }
  const near = newCar(true, false);
  if (near) {
    const sy = Math.sin(W.spawn.yaw), cy = Math.cos(W.spawn.yaw); let placed = false;
    for (const f of [8, 12, -8, 16]) for (const sd of [3.4, -3.4, 2, -2]) {
      const x = W.spawn.x + sy * f - cy * sd, z = W.spawn.z + cy * f + sy * sd;
      if (!blocked(x, z, 1.6) && !blocked(x + sy * 2, z + cy * 2, 1.2) && !blocked(x - sy * 2, z - cy * 2, 1.2)) { near.x = x; near.z = z; placed = true; break; }
    }
    near.yaw = W.spawn.yaw; near.parked = true; near.ai = null; near.m.g.position.set(near.x, 0, near.z); near.m.g.rotation.y = near.yaw; cars.push(near);
    if (!placed) near.x = W.spawn.x + sy * 8, near.z = W.spawn.z + cy * 8, near.m.g.position.set(near.x, 0, near.z);
  }
  const defs = [['shotgun', '#ffcc33', 24], ['smg', '#ffcc33', 90], ['health', '#e63946', 0], ['health', '#e63946', 0]];
  defs.forEach((d, i) => {
    const a = i / defs.length * TAU + .6, r = 18 + i * 10; let x = W.spawn.x + Math.cos(a) * r, z = W.spawn.z + Math.sin(a) * r;
    const ni = nearestNode(W.walk, x, z); if (ni >= 0) { x = W.walk[ni].x; z = W.walk[ni].z; }
    const m = new THREE.Mesh(GM(.7, .7, .7), new THREE.MeshBasicMaterial({ color: d[1] })); m.position.set(x, 1, z); scene.add(m);
    pickups.push({ kind: d[0], ammo: d[2], x, z, mesh: m, on: true, tm: 0 });
  });
}

/* ================= MISIONES ================= */
function buildMissions() {
  const lm = W.landmarks.slice().sort((a, b) => hyp(a.x - W.spawn.x, a.z - W.spawn.z) - hyp(b.x - W.spawn.x, b.z - W.spawn.z));
  const tg = [];
  ['place_of_worship', 'school', 'named'].forEach(k => { const l = lm.find(o => o.kind === k && !tg.includes(o) && hyp(o.x - W.spawn.x, o.z - W.spawn.z) > 60); if (l) tg.push(l); });
  const br = W.D.roads.find(r => r.bridge); if (br) { const m = br.pts[(br.pts.length / 2) | 0]; tg.push({ x: m[0], z: m[1], name: br.name || 'el puente', kind: 'bridge' }); }
  const far = W.walk.filter(n => { const d = hyp(n.x - W.spawn.x, n.z - W.spawn.z); return d > 400 && d < 1100; });
  const fn = far.length ? far[(far.length / 2) | 0] : W.walk[(W.walk.length * .8) | 0]; tg.push({ x: fn.x, z: fn.z, name: 'la entrada del pueblo', kind: 'edge' });
  while (tg.length < 4) { const n = W.walk[(Math.random() * W.walk.length) | 0]; tg.push({ x: n.x, z: n.z, name: 'Funes', kind: 'x' }); }
  const t = tg.slice(0, 5);
  MISSIONS = [
    { t: 'Bienvenido a Funes', d: 'Ve a pie hasta ' + t[0].name + '.', x: t[0].x, z: t[0].z, reward: 200 },
    { t: 'Coche robado', d: 'Roba un coche (F) y llévalo a ' + t[1].name + '.', x: t[1].x, z: t[1].z, reward: 300, car: true },
    { t: 'Al otro lado', d: 'Ve hasta ' + t[2].name + '.', x: t[2].x, z: t[2].z, reward: 250 },
    { t: 'Contrarreloj', d: 'Llega a ' + t[3].name + ' en coche antes de que se acabe el tiempo.', x: t[3].x, z: t[3].z, reward: 500, car: true, time: Math.max(45, Math.round(hyp(t[3].x - t[2].x, t[3].z - t[2].z) / 11) + 35) }
  ];
  if (t[4]) MISSIONS.push({ t: 'Despedida', d: 'Llega hasta ' + t[4].name + '.', x: t[4].x, z: t[4].z, reward: 400 });
}
function setMarker() {
  if (marker) { scene.remove(marker); marker = null; markerRing = null; }
  const m = MISSIONS[missionIdx]; if (!m) return;
  marker = new THREE.Group();
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 80, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: .3, side: THREE.DoubleSide, depthWrite: false }));
  cyl.position.y = 40; const ring = new THREE.Mesh(new THREE.TorusGeometry(2.6, .15, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffd23f })); ring.rotation.x = Math.PI / 2; ring.position.y = .4;
  marker.add(cyl, ring); markerRing = ring; marker.position.set(m.x, 0, m.z); scene.add(marker);
}

/* ================= SONIDO ================= */
let actx = null;
function beep(type) {
  if (!settings.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime, o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    const P = { shot: ['square', 190, 55, .1, .1], shotgun: ['sawtooth', 140, 40, .2, .16], hit: ['sawtooth', 120, 50, .1, .08], pick: ['triangle', 520, 880, .12, .1], mission: ['triangle', 440, 990, .35, .14], horn: ['square', 330, 330, .3, .07] }[type] || ['sine', 300, 300, .1, .08];
    o.type = P[0]; o.frequency.setValueAtTime(P[1], t); o.frequency.exponentialRampToValueAtTime(P[2], t + P[3]);
    g.gain.setValueAtTime(P[4], t); g.gain.exponentialRampToValueAtTime(.001, t + P[3]);
    o.start(t); o.stop(t + P[3] + .02);
  } catch (e) {}
}

/* ================= ENTRADA ================= */
addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return; keys[e.code] = true;
  if (state === 'menu') { if (e.code === 'Enter' && $('#panel').classList.contains('hidden')) startGame(); }
  else if (state === 'play') {
    if (e.code === 'Escape' || e.code === 'KeyP') setPause(true);
    else if (e.code === 'KeyF' || e.code === 'Enter') useAction();
    else if (e.code === 'KeyM') toggleMap();
    else if (e.code === 'KeyE') cycleWeapon(1);
    else if (e.code === 'KeyQ') cycleWeapon(-1);
    else if (e.code === 'KeyH' && player.car) beep('horn');
    else if (/^Digit[1-4]$/.test(e.code)) selectWeapon(['fist', 'pistol', 'shotgun', 'smg'][+e.code.slice(5) - 1]);
  } else if (state === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) setPause(false);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('mousedown', e => {
  if (state !== 'play' || usingTouch) return;
  if (!noLock && document.pointerLockElement !== cv) { try { cv.requestPointerLock(); } catch (er) { noLock = true; } return; }
  if (e.button === 0) mouse.down = true;
  if (e.button === 2) mouse.rdown = true;
});
addEventListener('mouseup', e => { if (e.button === 0) mouse.down = false; if (e.button === 2) mouse.rdown = false; });
document.addEventListener('pointerlockerror', () => { noLock = true; });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== cv && state === 'play' && !noLock && !usingTouch) setPause(true); });
const look = (dx, dy) => { camYaw -= dx * .0026 * settings.sens; camPitch = clamp(camPitch + dy * .0022 * settings.sens, -.45, 1.15); lastLook = gameTime; };
addEventListener('mousemove', e => { if (state !== 'play' || usingTouch) return; if (document.pointerLockElement === cv || (noLock && (e.buttons & 2))) look(e.movementX || 0, e.movementY || 0); });
cv.addEventListener('wheel', e => { if (state === 'play') cycleWeapon(e.deltaY > 0 ? 1 : -1); }, { passive: true });
const stickEl = $('#stick'), knob = $('#knob');
stickEl.addEventListener('pointerdown', e => { usingTouch = true; stick.id = e.pointerId; stickEl.setPointerCapture(e.pointerId); moveStick(e); });
stickEl.addEventListener('pointermove', e => { if (e.pointerId === stick.id) moveStick(e); });
const endStick = e => { if (e.pointerId === stick.id) { stick.id = null; stick.x = stick.y = 0; knob.style.transform = 'translate(0,0)'; } };
stickEl.addEventListener('pointerup', endStick); stickEl.addEventListener('pointercancel', endStick);
function moveStick(e) {
  const r = stickEl.getBoundingClientRect(); let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2), dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2); const m = hyp(dx, dy);
  if (m > 1) { dx /= m; dy /= m; } stick.x = Math.abs(dx) < .12 ? 0 : dx; stick.y = Math.abs(dy) < .12 ? 0 : dy; knob.style.transform = `translate(${dx * 35}px,${dy * 35}px)`;
}
let lookId = null, lx = 0, ly = 0;
cv.addEventListener('pointerdown', e => { if (e.pointerType === 'touch' && state === 'play') { usingTouch = true; lookId = e.pointerId; lx = e.clientX; ly = e.clientY; cv.setPointerCapture(e.pointerId); } });
cv.addEventListener('pointermove', e => { if (e.pointerId === lookId) { look((e.clientX - lx) * 1.4, (e.clientY - ly) * 1.4); lx = e.clientX; ly = e.clientY; } });
const endLook = e => { if (e.pointerId === lookId) lookId = null; };
cv.addEventListener('pointerup', endLook); cv.addEventListener('pointercancel', endLook);
document.querySelectorAll('#tbtns button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); usingTouch = true; if (k === 'fire') tf.fire = true; else if (k === 'jump') tf.brake = true; else if (k === 'use') useAction(); else if (k === 'weap') cycleWeapon(1); else if (k === 'map') toggleMap(); });
  const up = () => { if (k === 'fire') tf.fire = false; if (k === 'jump') tf.brake = false; };
  b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
});
$('#tpause').addEventListener('pointerdown', () => setPause(true));
$('#minimap').addEventListener('pointerdown', () => toggleMap());
$('#bigmap').addEventListener('pointerdown', () => toggleMap());

/* ================= ACCIONES ================= */
let toastT = 0;
function toast(msg, ms = 2400) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); toastT = ms / 1000; }
function selectWeapon(w) { if (save.weapons.includes(w)) player.w = w; }
function cycleWeapon(d) { const l = save.weapons; const i = l.indexOf(player.w); player.w = l[(i + d + l.length) % l.length]; }
function crime(n = 1) { if (!settings.police) return; stars = Math.min(3, stars + n); lastCrime = gameTime; }
function useAction() {
  if (player.car) {
    const c = player.car; player.car = null; c.ai = null; c.parked = false;
    let ok = false;
    for (const s of [2.4, -2.4, 4]) { const nx = c.x + Math.cos(c.yaw) * s, nz = c.z - Math.sin(c.yaw) * s; if (!blocked(nx, nz, .5)) { player.x = nx; player.z = nz; ok = true; break; } }
    if (!ok) { player.x = c.x; player.z = c.z; }
    player.h.g.visible = true; return;
  }
  let best = null, bd = 4.2;
  for (const c of cars) { const d = hyp(c.x - player.x, c.z - player.z); if (d < bd && !c.wreck) { bd = d; best = c; } }
  if (best) { if (best.ai) { crime(1); toast('¡Has robado un coche!'); } best.ai = null; best.parked = false; player.car = best; player.h.g.visible = false; beep('pick'); }
}
function toggleMap() { const m = $('#bigmap'); if (!m.classList.contains('hidden')) { m.classList.add('hidden'); return; } if (state !== 'play') return; m.classList.remove('hidden'); drawBigMap(); }
function setPause(on) {
  if (on && state === 'play') { state = 'pause'; $('#pause').classList.remove('hidden'); mouse.down = mouse.rdown = false; if (document.pointerLockElement) document.exitPointerLock(); }
  else if (!on && state === 'pause') { state = 'play'; $('#pause').classList.add('hidden'); last = performance.now(); if (!usingTouch && !noLock) { try { cv.requestPointerLock(); } catch (e) {} } }
}

/* ================= DISPARO ================= */
const camDir = () => { const cp = Math.cos(camPitch); return [Math.sin(camYaw) * cp, -Math.sin(camPitch), Math.cos(camYaw) * cp]; };
function addTracer(ax, ay, az, bx, by, bz, col) {
  let t = tracers.find(o => o.life <= 0);
  if (!t) { t = { m: new THREE.Mesh(GM(.04, .04, 1), new THREE.MeshBasicMaterial({ color: 0xffee99 })), life: 0 }; scene.add(t.m); tracers.push(t); }
  const l = hyp(bx - ax, by - ay, bz - az) || 1;
  t.m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); t.m.scale.set(1, 1, l); t.m.lookAt(bx, by, bz); t.m.material.color.setHex(col || 0xffee99); t.m.visible = true; t.life = .06;
}
function hitTargets(ox, oy, oz, d, range, who) {
  let hitT = null, hx = ox + d[0] * range, hy = oy + d[1] * range, hz = oz + d[2] * range;
  for (let t = 1; t < range; t += .8) {
    const x = ox + d[0] * t, y = oy + d[1] * t, z = oz + d[2] * t;
    if (y < 0) { hx = x; hy = 0; hz = z; break; }
    if (y < 14 && hitsBuilding(x, z, 0)) { hx = x; hy = y; hz = z; break; }
    if (who === 'player') {
      for (const p of peds) if (!p.dead && y < 1.95 && hyp(p.x - x, p.z - z) < .5) { hitT = p; break; }
      if (!hitT) for (const p of cops) if (!p.dead && y < 1.95 && hyp(p.x - x, p.z - z) < .5) { hitT = p; break; }
    } else if (!player.car && y < 1.95 && hyp(player.x - x, player.z - z) < .55) hitT = player;
    else if (player.car && y < 1.7 && hyp(player.car.x - x, player.car.z - z) < 1.1) hitT = player;
    if (hitT) { hx = x; hy = y; hz = z; break; }
  }
  return { hitT, hx, hy, hz };
}
function shoot() {
  const w = WEAPONS[player.w]; if (player.cd > 0 || player.car) return;
  if (!w.melee) { if (save.ammo[player.w] <= 0) { toast('Sin munición'); player.cd = .5; return; } save.ammo[player.w]--; }
  player.cd = w.rate; player.aimT = 1.6;
  if (w.melee) {
    const fx = Math.sin(player.yaw), fz = Math.cos(player.yaw);
    [...peds, ...cops].forEach(p => { if (!p.dead && hyp(p.x - (player.x + fx), p.z - (player.z + fz)) < 1.3) damage(p, w.dmg); });
    beep('hit'); return;
  }
  const cd = camDir(), ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  const mx = player.x + Math.sin(player.yaw) * .6, my = 1.45 + player.y, mz = player.z + Math.cos(player.yaw) * .6;
  for (let i = 0; i < w.pellets; i++) {
    const d = [cd[0] + (Math.random() - .5) * 2 * w.spread, cd[1] + (Math.random() - .5) * 2 * w.spread, cd[2] + (Math.random() - .5) * 2 * w.spread], l = hyp(d[0], d[1], d[2]); d[0] /= l; d[1] /= l; d[2] /= l;
    const r = hitTargets(ox + d[0] * 3, oy + d[1] * 3, oz + d[2] * 3, d, w.range, 'player');
    if (r.hitT) damage(r.hitT, w.dmg);
    addTracer(mx, my, mz, r.hx, r.hy, r.hz);
  }
  camPitch = Math.max(-.45, camPitch - (player.w === 'shotgun' ? .06 : .012));
  beep(player.w === 'shotgun' ? 'shotgun' : 'shot');
}
function damage(t, d) {
  if (t === player) { player.hp -= d; return; }
  if (t.dead) return; t.hp -= d; t.fear = 6;
  if (t.hp <= 0) { t.dead = true; t.dt = 14; t.h.g.rotation.x = -Math.PI / 2; t.h.g.position.y = .18; if (t.cop) money += 50; crime(t.cop ? 2 : 1); }
}

/* ================= ACTUALIZACIÓN ================= */
function updateCar(c, dt, drv) {
  if (drv) {
    const up = keys.KeyW || keys.ArrowUp || stick.y < -.3, dn = keys.KeyS || keys.ArrowDown || stick.y > .3;
    const st = clamp((keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0) - stick.x, -1, 1);
    if (up) c.v += (c.v < 0 ? 26 : 14) * dt; else if (dn) c.v -= (c.v > 1 ? 26 : 9) * dt; else c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 4 * dt);
    if (keys.Space || tf.brake) c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 30 * dt);
    c.v = clamp(c.v, -8, 34);
    c.steer += (st * (.55 - Math.min(.38, Math.abs(c.v) / 70)) - c.steer) * Math.min(1, dt * 8);
  } else c.v -= Math.sign(c.v) * Math.min(Math.abs(c.v), 6 * dt);
  c.yaw += c.v / 2.7 * Math.tan(c.steer) * dt;
  const nx = c.x + Math.sin(c.yaw) * c.v * dt, nz = c.z + Math.cos(c.yaw) * c.v * dt, fx = Math.sin(c.yaw) * 2, fz = Math.cos(c.yaw) * 2, sgn = Math.sign(c.v) || 1;
  if (blocked(nx + fx * sgn, nz + fz * sgn, .9) || blocked(nx, nz, 1)) { if (drv && Math.abs(c.v) > 12) { player.hp -= (Math.abs(c.v) - 10) * .6; beep('hit'); } c.v *= -.3; }
  else { c.x = nx; c.z = nz; }
  c.m.g.position.set(c.x, 0, c.z); c.m.g.rotation.y = c.yaw;
  c.m.wheels.forEach(w => { w.rotation.x += c.v * dt * 2.9; });
}
function update(dt) {
  gameTime += dt; player.cd = Math.max(0, player.cd - dt); player.aimT = Math.max(0, player.aimT - dt);
  if (toastT > 0) { toastT -= dt; if (toastT <= 0) $('#toast').classList.remove('on'); }
  const fx = Math.sin(camYaw), fz = Math.cos(camYaw), rx = -fz, rz = fx;
  const aiming = mouse.rdown || player.aimT > 0 || (usingTouch && tf.fire);

  if (player.car) {
    const c = player.car; updateCar(c, dt, true);
    player.x = c.x; player.z = c.z; player.yaw = c.yaw;
    if (gameTime - lastLook > 1.2 && Math.abs(c.v) > 2) camYaw += angDiff(camYaw, c.yaw + (c.v < 0 ? Math.PI : 0)) * Math.min(1, dt * 2.2);
  } else {
    const mf = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) - stick.y, mr = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + stick.x;
    let dx = fx * mf + rx * mr, dz = fz * mf + rz * mr; const m = hyp(dx, dz);
    const sprint = keys.ShiftLeft || keys.ShiftRight || (usingTouch && m > 1.2);
    const spd = (sprint ? 7.4 : 4.1) * (aiming ? .75 : 1);
    if (m > .05) { dx /= m; dz /= m; tryMove(player, dx * spd * dt, dz * spd * dt, .4); player.speed = spd; } else player.speed *= .8;
    if (aiming) player.yaw += angDiff(player.yaw, camYaw) * Math.min(1, dt * 16);
    else if (m > .05) player.yaw += angDiff(player.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
    if (keys.Space && player.y <= 0) player.vy = 6;
    player.vy -= 18 * dt; player.y = Math.max(0, player.y + player.vy * dt); if (player.y === 0) player.vy = 0;
    const w = WEAPONS[player.w], want = mouse.down || tf.fire || keys.KeyJ;
    if (want && (w.auto || !player.fired)) { shoot(); player.fired = !w.auto; }
    if (!want) player.fired = false;
    showGun(player.h, w.melee ? null : player.w);
    player.h.g.position.set(player.x, player.y, player.z); player.h.g.rotation.y = player.yaw;
    animHuman(player.h, player.y > 0 ? 0 : player.speed, dt, !w.melee && (aiming || player.cd > 0), -camPitch);
  }

  for (const c of cars) {
    if (c === player.car) continue;
    const d = hyp(c.x - player.x, c.z - player.z); c.m.g.visible = d < 420;
    if (d > 330 && !c.parked) { const n = newCar(false, true); if (n) { scene.remove(c.m.g); Object.assign(c, n); } continue; }
    if (c.ai && d < 300) {
      const A = c.ai, to = W.drive[A.to]; if (!to) { c.ai = null; continue; }
      const dx = to.x - A.from.x, dz = to.z - A.from.z, l = hyp(dx, dz) || 1, tx = to.x - dz / l * 1.9, tz = to.z + dx / l * 1.9;
      const want = Math.atan2(tx - c.x, tz - c.z), df = angDiff(c.yaw, want);
      c.steer += (clamp(df, -.5, .5) - c.steer) * Math.min(1, dt * 5);
      let tv = c.speedMax;
      const fwx = Math.sin(c.yaw), fwz = Math.cos(c.yaw);
      const chk = (ox, oz) => { const ax = ox - c.x, az = oz - c.z, f = ax * fwx + az * fwz; return f > 0 && f < 14 && Math.abs(ax * fwz - az * fwx) < 2.4; };
      if (chk(player.x, player.z) || cars.some(o => o !== c && chk(o.x, o.z)) || peds.some(p => !p.dead && chk(p.x, p.z))) tv = 0;
      c.v += clamp(tv - c.v, -22 * dt, 6 * dt);
      c.yaw += c.v / 2.7 * Math.tan(clamp(c.steer, -.6, .6)) * dt;
      c.x += Math.sin(c.yaw) * c.v * dt; c.z += Math.cos(c.yaw) * c.v * dt;
      c.m.g.position.set(c.x, 0, c.z); c.m.g.rotation.y = c.yaw; c.m.wheels.forEach(w => { w.rotation.x += c.v * dt * 2.9; });
      if (hyp(to.x - c.x, to.z - c.z) < 5) { const opts = to.n.filter(i => W.drive[i] !== A.from); A.from = to; A.to = opts.length ? opts[(Math.random() * opts.length) | 0] : to.n[0]; }
    } else if (!c.ai && Math.abs(c.v) > .3) updateCar(c, dt, false);
  }
  const pc = player.car;
  for (const p of peds) {
    if (p.dead) { p.dt -= dt; continue; }
    const d = hyp(p.x - player.x, p.z - player.z); p.h.g.visible = d < 300;
    if (d > 260) { const n = newPed(true); if (n) { scene.remove(p.h.g); Object.assign(p, n); } continue; }
    if (d > 200) continue;
    p.fear = Math.max(0, p.fear - dt);
    let sp = 1.3, dx, dz;
    const scary = (pc && Math.abs(pc.v) > 9 && d < 14) || (player.aimT > 0 && d < 25);
    if (p.fear > 0 || scary) { if (scary) p.fear = Math.max(p.fear, 2); dx = p.x - player.x; dz = p.z - player.z; sp = 5.5; }
    else {
      const to = W.walk[p.to]; if (!to) { p.to = nearestNode(W.walk, p.x, p.z); continue; }
      dx = to.x - p.x; dz = to.z - p.z; if (hyp(dx, dz) < 2.5) { const o = to.n; if (o.length) p.to = o[(Math.random() * o.length) | 0]; }
    }
    const l = hyp(dx, dz) || 1; dx /= l; dz /= l;
    p.yaw += angDiff(p.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
    if (tryMove(p, dx * sp * dt, dz * sp * dt, .35)) { p.to = nearestNode(W.walk, p.x, p.z); p.fear = 0; }
    p.h.g.position.set(p.x, 0, p.z); p.h.g.rotation.y = p.yaw; p.speed = sp; animHuman(p.h, sp, dt, false);
    for (const c of cars) if (Math.abs(c.v) > 5 && hyp(c.x - p.x, c.z - p.z) < 2.2) { damage(p, 200); if (c === player.car) crime(1); beep('hit'); break; }
  }
  for (let i = peds.length - 1; i >= 0; i--) if (peds[i].dead && peds[i].dt <= 0) { scene.remove(peds[i].h.g); peds.splice(i, 1); const n = newPed(true); if (n) peds.push(n); }

  if (stars > 0 && gameTime - lastCrime > 24) { stars--; lastCrime = gameTime; if (!stars) toast('Ya no te buscan'); }
  const want = settings.police ? stars * 2 : 0;
  if (cops.filter(c => !c.dead).length < want && Math.random() < dt * 1.5) { const c = newCop(); if (c) cops.push(c); }
  for (const c of cops) {
    if (c.dead) { c.dt -= dt; continue; }
    const dx = player.x - c.x, dz = player.z - c.z, d = hyp(dx, dz) || 1; c.yaw += angDiff(c.yaw, Math.atan2(dx, dz)) * Math.min(1, dt * 10);
    let sp = 0; if (d > 14) { sp = 5; tryMove(c, dx / d * sp * dt, dz / d * sp * dt, .4); }
    c.h.g.position.set(c.x, 0, c.z); c.h.g.rotation.y = c.yaw; animHuman(c.h, sp, dt, d < 40, 0);
    c.cd -= dt;
    if (d < 40 && c.cd <= 0 && stars > 0) {
      c.cd = rnd(.9, 1.7); const dir = [dx / d + rnd(-.04, .04), -.01, dz / d + rnd(-.04, .04)];
      const r = hitTargets(c.x, 1.3, c.z, dir, 50, 'cop');
      if (r.hitT && Math.random() < .55) { player.hp -= 6; beep('hit'); }
      addTracer(c.x, 1.3, c.z, r.hx, r.hy, r.hz, 0xff8c8c);
    }
    if (d > 260) { c.dead = true; c.dt = 0; }
  }
  for (let i = cops.length - 1; i >= 0; i--) if (cops[i].dead && cops[i].dt <= 0) { scene.remove(cops[i].h.g); cops.splice(i, 1); }
  tracers.forEach(t => { if (t.life > 0) { t.life -= dt; if (t.life <= 0) t.m.visible = false; } });

  pickups.forEach(p => {
    p.mesh.rotation.y += dt * 2; p.mesh.position.y = 1 + Math.sin(gameTime * 3) * .15; p.mesh.visible = p.on;
    if (!p.on) { p.tm -= dt; if (p.tm <= 0) p.on = true; return; }
    if (player.car || hyp(p.x - player.x, p.z - player.z) > 1.8) return;
    if (p.kind === 'health') { if (player.hp >= 100) return; player.hp = Math.min(100, player.hp + 50); toast('+50 de salud'); }
    else { if (!save.weapons.includes(p.kind)) { save.weapons.push(p.kind); toast('Nueva arma: ' + WEAPONS[p.kind].n); player.w = p.kind; } else toast('+' + p.ammo + ' munición'); save.ammo[p.kind] += p.ammo; }
    p.on = false; p.tm = 60; beep('pick');
  });

  const m = MISSIONS[missionIdx];
  if (m) {
    if (m.time && !missionStart) missionStart = gameTime;
    if (hyp(player.x - m.x, player.z - m.z) < 7 && (!m.car || player.car)) {
      money += m.reward; toast('Misión completada: ' + m.t + '  +$' + m.reward); beep('mission');
      missionIdx++; missionStart = 0; save.mission = missionIdx; save.money = money; saveAll(); setMarker();
      if (missionIdx >= MISSIONS.length) setTimeout(() => toast('¡Has completado Funes! Sigue explorando.', 4200), 2600);
    } else if (m.time && gameTime - missionStart > m.time) { toast('Tiempo agotado. Inténtalo otra vez'); missionStart = gameTime; }
    if (markerRing) { const k = 1 + Math.sin(gameTime * 5) * .12; markerRing.scale.set(k, k, k); }
  }
  if (player.hp <= 0 && state === 'play') { state = 'dead'; $('#dead').classList.remove('hidden'); stars = 0; mouse.down = false; if (document.pointerLockElement) document.exitPointerLock(); if (player.car) { player.car = null; player.h.g.visible = true; } }
}

/* ================= CÁMARA ================= */
function updateCamera(dt) {
  const d = player.car ? 8.5 : (player.aimT > 0 || mouse.rdown ? 2.6 : 3.8);
  const cd = camDir(), sh = player.car ? 0 : .55;
  const tx = player.x + Math.cos(camYaw) * sh, ty = (player.car ? 1.7 : 1.65) + player.y, tz = player.z - Math.sin(camYaw) * sh;
  let cx = tx - cd[0] * d, cy = ty - cd[1] * d, cz = tz - cd[2] * d;
  for (let k = 1; k <= 6; k++) { const t = k / 6, px = tx - cd[0] * d * t, pz = tz - cd[2] * d * t; if (hitsBuilding(px, pz, .2) && ty - cd[1] * d * t < 12) { const s = Math.max(0, t - .17); cx = tx - cd[0] * d * s; cy = ty - cd[1] * d * s; cz = tz - cd[2] * d * s; break; } }
  cy = Math.max(.6, cy);
  const k = Math.min(1, dt * 18);
  camera.position.x += (cx - camera.position.x) * k; camera.position.y += (cy - camera.position.y) * k; camera.position.z += (cz - camera.position.z) * k;
  camera.lookAt(tx + cd[0] * 12, ty + cd[1] * 12, tz + cd[2] * 12);
  if (skyMesh) skyMesh.position.copy(camera.position);
  sun.position.set(player.x + todCur.dir[0] * 90, todCur.dir[1] * 90, player.z + todCur.dir[2] * 90); sun.target.position.set(player.x, 0, player.z); sun.target.updateMatrixWorld();
  camera.fov += ((player.car ? 68 + Math.min(14, Math.abs(player.car.v) * .4) : 64) - camera.fov) * .1; camera.updateProjectionMatrix();
}

/* ================= HUD / MAPAS ================= */
const el = { money: $('#hudMoney'), stars: $('#hudStars'), hp: $('#hudHp'), weap: $('#hudWeapon'), mt: $('#mTitle'), md: $('#mDesc'), mdist: $('#mDist'), zone: $('#hudZone') };
const mini = $('#minimap'), mctx = mini.getContext('2d');
function zoneName() {
  let best = null, bd = 50;
  for (const l of W.landmarks) { const d = hyp(l.x - player.x, l.z - player.z); if (d < bd) { bd = d; best = l; } }
  if (best) return best.name;
  let nm = '', md = 12;
  for (const r of W.D.roads) { if (!r.name) continue; for (let i = 0; i < r.pts.length - 1; i++) { const d = segDist(player.x, player.z, r.pts[i], r.pts[i + 1]); if (d < md) { md = d; nm = r.name; } } }
  return nm || 'Funes';
}
let hudT = 0, zoneT = 0, zoneTxt = 'Funes';
function updateHud(dt) {
  hudT -= dt; if (hudT > 0) return; hudT = .1;
  el.money.textContent = '$' + money; el.stars.textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
  el.hp.style.width = clamp(player.hp, 0, 100) + '%';
  const w = WEAPONS[player.w]; el.weap.textContent = w.melee ? w.n : w.n + ' · ' + save.ammo[player.w];
  const m = MISSIONS[missionIdx];
  if (m) { el.mt.textContent = 'Misión ' + (missionIdx + 1) + '/' + MISSIONS.length + ' · ' + m.t; el.md.textContent = m.d; el.mdist.textContent = (m.time && missionStart ? '⏱ ' + Math.max(0, Math.ceil(m.time - (gameTime - missionStart))) + ' s · ' : '') + Math.round(hyp(player.x - m.x, player.z - m.z)) + ' m'; }
  else { el.mt.textContent = 'Funes es tuyo'; el.md.textContent = 'Misiones completadas. Explora el pueblo.'; el.mdist.textContent = ''; }
  zoneT -= .1; if (zoneT <= 0) { zoneT = .5; zoneTxt = zoneName(); } el.zone.textContent = zoneTxt;
  drawMini();
}
function marks(g, k, ox, oz, big) {
  const P = (x, z, c, r) => { g.fillStyle = c; g.beginPath(); g.arc((x - ox) * k, (z - oz) * k, r, 0, TAU); g.fill(); };
  cops.forEach(c => !c.dead && P(c.x, c.z, '#3b6cff', big ? 4 : 3));
  pickups.forEach(p => p.on && P(p.x, p.z, p.kind === 'health' ? '#e63946' : '#ffd23f', big ? 4 : 2.5));
  const m = MISSIONS[missionIdx]; if (m) P(m.x, m.z, '#ffd23f', big ? 8 : 5);
  g.save(); g.translate((player.x - ox) * k, (player.z - oz) * k); g.rotate(-player.yaw + Math.PI); g.fillStyle = '#fff'; g.strokeStyle = '#e63946'; g.lineWidth = 2; g.beginPath(); const s = big ? 9 : 6; g.moveTo(0, s); g.lineTo(s * .7, -s * .8); g.lineTo(0, -s * .3); g.lineTo(-s * .7, -s * .8); g.closePath(); g.fill(); g.stroke(); g.restore();
}
function drawMini() {
  if (!W.miniCv) return; const S = 240, M = W.mini, k = mini.width / S, ox = player.x - S / 2, oz = player.z - S / 2;
  mctx.fillStyle = '#1b2a14'; mctx.fillRect(0, 0, mini.width, mini.height);
  mctx.drawImage(W.miniCv, (ox - M.x0) * M.sc, (oz - M.z0) * M.sc, S * M.sc, S * M.sc, 0, 0, mini.width, mini.height);
  marks(mctx, k, ox, oz, false);
}
function drawBigMap() {
  const c = $('#bigmapCv'), g = c.getContext('2d'), B = W.bounds, w = B.x1 - B.x0, h = B.z1 - B.z0, k = Math.min(900 / w, 675 / h);
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  g.drawImage(W.miniCv, 0, 0, W.miniCv.width, W.miniCv.height, 0, 0, c.width, c.height);
  marks(g, k, B.x0, B.z0, true);
  g.font = '700 12px system-ui'; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 3;
  W.landmarks.slice(0, 20).forEach(l => { const x = (l.x - B.x0) * k, y = (l.z - B.z0) * k; g.strokeText(l.name, x, y); g.fillText(l.name, x, y); });
}

/* ================= PANELES ================= */
const panel = $('#panel'), panelBody = $('#panelBody');
const SKINS = ['#f1c27d', '#e8b98a', '#c68642', '#8d5524'], SHIRTS = ['#e63946', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#8d5fd3', '#ffffff', '#111111'], PANTS = ['#26324a', '#111111', '#5b3a29', '#5d6b7a', '#2e6b3a'];
function applyChar() {
  if (!player.h) return; scene.remove(player.h.g);
  const h = makeHuman(save.char.shirt, save.char.skin, save.char.pants, '#2a1d14'); player.h = h; scene.add(h.g); h.g.visible = !player.car;
}
function openPanel(name) {
  const P = {
    char: () => `<h2>Creador de personaje</h2>
      <div class="row"><label>Nombre</label><input id="cName" type="text" maxlength="14" value="${save.char.name.replace(/"/g, '')}"></div>
      <div class="row"><label>Piel</label>${SKINS.map(c => `<span class="sw ${save.char.skin === c ? 'on' : ''}" data-f="skin" data-c="${c}" style="background:${c}"></span>`).join('')}</div>
      <div class="row"><label>Camiseta</label>${SHIRTS.map(c => `<span class="sw ${save.char.shirt === c ? 'on' : ''}" data-f="shirt" data-c="${c}" style="background:${c}"></span>`).join('')}</div>
      <div class="row"><label>Pantalón</label>${PANTS.map(c => `<span class="sw ${save.char.pants === c ? 'on' : ''}" data-f="pants" data-c="${c}" style="background:${c}"></span>`).join('')}</div>
      <p>Los cambios se ven al empezar la partida.</p>`,
    missions: () => `<h2>Misiones</h2>${MISSIONS.length ? MISSIONS.map((m, i) => `<div class="mi ${i < missionIdx ? 'done' : ''}"><span class="n">${String(i + 1).padStart(2, '0')}</span><div><b>${m.t}</b><br>${m.d}<br><small>Recompensa: $${m.reward}${i < missionIdx ? ' · ✔ completada' : ''}</small></div></div>`).join('') : '<p>Se generan al terminar de cargar el mapa.</p>'}<p>Busca la columna <b style="color:#ffd23f">amarilla</b> (tecla <kbd>M</kbd> para el mapa).</p>`,
    controls: () => `<h2>Controles</h2><h3>Teclado y ratón</h3><ul>
      <li><kbd>W A S D</kbd> — Andar · conducir</li><li><kbd>Ratón</kbd> — Mirar (haz clic para capturar el ratón)</li><li><kbd>Clic izq.</kbd> — Disparar · golpear · <kbd>Clic der.</kbd> apuntar</li>
      <li><kbd>Mayús</kbd> — Correr · <kbd>Espacio</kbd> — Saltar / freno de mano</li><li><kbd>F</kbd> — Subir / bajar del coche</li>
      <li><kbd>1</kbd>–<kbd>4</kbd> · <kbd>Q</kbd> <kbd>E</kbd> · rueda — Cambiar de arma</li><li><kbd>H</kbd> — Claxon · <kbd>M</kbd> — Mapa · <kbd>Esc</kbd> — Pausa</li></ul>
      <h3>Móvil</h3><ul><li>Palanca izquierda: moverte o conducir · arrastra la pantalla para mirar</li><li>🔫 disparar · 🚗 subir/bajar · 🔁 arma · 🗺️ mapa · ⏹ freno</li></ul>`,
    settings: () => `<h2>Ajustes</h2>
      <div class="row"><label>Calidad gráfica</label><select id="sQ"><option value="alta" ${settings.quality === 'alta' ? 'selected' : ''}>Alta (sombras)</option><option value="baja" ${settings.quality === 'baja' ? 'selected' : ''}>Baja (más rápida)</option></select></div>
      <div class="row"><label>Hora del día</label><select id="sD"><option value="tarde" ${settings.tod === 'tarde' ? 'selected' : ''}>Atardecer</option><option value="mediodia" ${settings.tod === 'mediodia' ? 'selected' : ''}>Mediodía</option><option value="noche" ${settings.tod === 'noche' ? 'selected' : ''}>Noche</option></select></div>
      <div class="row"><label>Sensibilidad</label><select id="sSe">${[.5, .75, 1, 1.5, 2].map(v => `<option value="${v}" ${settings.sens === v ? 'selected' : ''}>x${v}</option>`).join('')}</select></div>
      <div class="row"><label>Sonido</label><select id="sS"><option value="1" ${settings.sound ? 'selected' : ''}>Activado</option><option value="0" ${!settings.sound ? 'selected' : ''}>Silencio</option></select></div>
      <div class="row"><label>Policía</label><select id="sP"><option value="1" ${settings.police ? 'selected' : ''}>Persigue</option><option value="0" ${!settings.police ? 'selected' : ''}>No persigue (para pasear)</option></select></div>
      <div class="row"><button id="sReset">Borrar partida guardada</button></div><div class="row"><button id="sMap">Volver a descargar el mapa</button></div>`,
    about: () => `<h2>Acerca de Funes</h2><p>Funes es un municipio de Navarra (España) a orillas del río Arga. El mundo se genera en tu navegador con los edificios, calles, ríos y parques reales de OpenStreetMap: puedes recorrer el pueblo a pie o en coche.</p><p>Las alturas y colores de los edificios son aproximados.</p>`,
    credits: () => `<h2>Créditos</h2><p><b>EL MAPA DE FUNES</b></p><p>CREATED BY <b style="color:#ffd23f">DEV-HUNTERS</b></p><p>Logo y portada de carga: ilustraciones del autor del proyecto.</p><p>Datos del mapa: © colaboradores de OpenStreetMap (ODbL). Motor 3D: three.js (MIT).</p><p>Proyecto de fans sin ánimo de lucro, sin relación con Rockstar Games ni Take-Two Interactive.</p>`
  };
  panelBody.innerHTML = P[name](); panel.classList.remove('hidden');
  if (name === 'char') {
    panelBody.querySelectorAll('.sw').forEach(s => s.onclick = () => { save.char[s.dataset.f] = s.dataset.c; panelBody.querySelectorAll(`.sw[data-f="${s.dataset.f}"]`).forEach(o => o.classList.remove('on')); s.classList.add('on'); saveAll(); });
    $('#cName').oninput = e => { save.char.name = e.target.value.slice(0, 14) || 'Issa'; saveAll(); };
  }
  if (name === 'settings') {
    $('#sQ').onchange = e => { settings.quality = e.target.value; saveSettings(); applyQuality(); };
    $('#sD').onchange = e => { settings.tod = e.target.value; saveSettings(); applyTOD(); };
    $('#sSe').onchange = e => { settings.sens = +e.target.value; saveSettings(); };
    $('#sS').onchange = e => { settings.sound = e.target.value === '1'; saveSettings(); };
    $('#sP').onchange = e => { settings.police = e.target.value === '1'; saveSettings(); };
    $('#sReset').onclick = () => { if (confirm('¿Borrar la partida guardada?')) { try { localStorage.removeItem('funes-save3d'); } catch (e) {} location.reload(); } };
    $('#sMap').onclick = () => { try { localStorage.removeItem('funes-osm-v1'); } catch (e) {} location.reload(); };
  }
}
const closePanel = () => panel.classList.add('hidden');
$('#panelClose').onclick = closePanel;
panel.addEventListener('pointerdown', e => { if (e.target === panel) closePanel(); });
document.querySelectorAll('#menuNav [data-panel]').forEach(b => b.onclick = () => openPanel(b.dataset.panel));

/* ================= FLUJO ================= */
const bPlay = $('#bPlay'), worldMsg = $('#worldMsg');
let worldProg = 0;
function refreshPlay() { bPlay.disabled = !W.ready; bPlay.textContent = W.ready ? 'Empezar partida' : 'Cargando Funes… ' + Math.round(worldProg) + '%'; }
function showMenu() {
  if (state !== 'loading') return; state = 'menu';
  $('#menuLogo').src = 'logo.png'; $('#menu').classList.remove('hidden');
  loader.style.opacity = 0; setTimeout(() => loader.style.display = 'none', 380);
  refreshPlay();
}
function startGame() {
  if (state !== 'menu' || !W.ready) return;
  $('#menu').classList.add('hidden'); closePanel();
  money = save.money; missionIdx = Math.min(save.mission, MISSIONS.length);
  if (!player.h) { player.h = makeHuman(save.char.shirt, save.char.skin, save.char.pants, '#2a1d14'); scene.add(player.h.g); } else applyChar();
  Object.assign(player, { x: W.spawn.x, z: W.spawn.z, y: 0, vy: 0, yaw: W.spawn.yaw, hp: 100, car: null, w: save.weapons.includes('pistol') ? 'pistol' : 'fist', speed: 0 });
  camYaw = W.spawn.yaw; camPitch = .25; camera.position.set(player.x - Math.sin(camYaw) * 4, 3, player.z - Math.cos(camYaw) * 4);
  stars = 0; gameTime = 0; missionStart = 0; spawnAll(); setMarker();
  $('#hud').classList.remove('hidden');
  if (usingTouch || matchMedia('(pointer:coarse)').matches) { usingTouch = true; $('#touch').classList.remove('hidden'); }
  $('#cross').classList.toggle('hidden', usingTouch);
  state = 'play'; last = performance.now();
  toast('Bienvenido a Funes · CREATED BY DEV-HUNTERS', 3200);
  if (!usingTouch) setTimeout(() => toast('Haz clic para capturar el ratón', 2200), 3400);
}
bPlay.onclick = startGame;
$('#pResume').onclick = () => setPause(false);
$('#pSave').onclick = () => { save.money = money; save.mission = missionIdx; saveAll(); toast('Partida guardada'); setPause(false); };
$('#pSettings').onclick = () => openPanel('settings');
$('#pMenu').onclick = () => { save.money = money; saveAll(); $('#pause').classList.add('hidden'); $('#hud').classList.add('hidden'); $('#touch').classList.add('hidden'); state = 'menu'; $('#menu').classList.remove('hidden'); if (player.car) { player.car = null; player.h.g.visible = true; } };
$('#bRespawn').onclick = () => { $('#dead').classList.add('hidden'); money = Math.max(0, money - 100); player.hp = 100; player.x = W.spawn.x; player.z = W.spawn.z; player.car = null; player.h.g.visible = true; cops.forEach(c => scene.remove(c.h.g)); cops = []; state = 'play'; last = performance.now(); if (!usingTouch && !noLock) { try { cv.requestPointerLock(); } catch (e) {} } };
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') setPause(true); });

let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (state === 'play') { update(dt); updateHud(dt); updateCamera(dt); }
  else if (state === 'menu' && W.ready) { const t = now / 1000 * .05; camera.position.set(W.spawn.x + Math.sin(t) * 40, 22, W.spawn.z + Math.cos(t) * 40); camera.lookAt(W.spawn.x, 6, W.spawn.z); if (skyMesh) skyMesh.position.copy(camera.position); }
  if (W.ready) renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* ================= ARRANQUE ================= */
resize(); applyTOD();
const worldP = p => { worldProg = Math.max(worldProg, p); if (state === 'menu') refreshPlay(); };
(async () => {
  imgsReady.then(() => { setProg(100); loadMsg.textContent = '¡Listo!'; setTimeout(showMenu, Math.max(0, 600 - (performance.now() - T0))); });
  let osm, real = true;
  try { osm = await fetchOSM(worldP); } catch (e) { real = false; osm = fallbackData(); }
  await new Promise(r => setTimeout(r, 20));
  let D = parseOSM(osm);
  if (D.buildings.length < 30 || D.roads.length < 5) { real = false; D = parseOSM(fallbackData()); }
  buildWorld(D, worldP); buildMissions();
  worldP(100); refreshPlay();
  worldMsg.textContent = real ? 'Mapa real de Funes (OpenStreetMap)' : 'Sin conexión con OpenStreetMap: se usa un Funes de ejemplo';
})().catch(err => { console.error(err); worldMsg.textContent = 'Error al construir el mundo'; });
requestAnimationFrame(loop);
window.__funes = { player, W, get cars() { return cars; }, get state() { return state; }, startGame, scene, camera };
})();
