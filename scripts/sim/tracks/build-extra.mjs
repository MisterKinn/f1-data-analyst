// Step 3 of new-track geometry: accepted map laps → candidate simulator tracks with elevation.
// Input: .cache/lapsim/osm/accepted-lines.json (laps within 0.5 % of the FIA lap distance) and loops-summary.json.
// Height: Mapzen/Tilezen "terrarium" tiles (open data on AWS; built from SRTM, NED, EU-DEM and others, about 30 m ground grid).
// Output: extra-tracks.json in the format of worker/lapsim/tracks-data.js (kappa ×1e5 1/m, grade ×1e4 rad).
// CANDIDATE DATA: nothing in the simulator reads this file. Evidence layer: map centre line, not a driven line.
import {inflateSync} from 'node:zlib';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resampleClosed, movingAverageClosed, headingCurvature, lonLatToLocal} from '../../../worker/lapsim/geometry.js';
const DIR = '.cache/lapsim/osm', DS = 5, Z = 14;
const POS_SMOOTH_M = Number(process.env.EXTRA_POS_SMOOTH_M || 9), CURV_SMOOTH_M = 6, ELEV_SMOOTH_M = Number(process.env.EXTRA_ELEV_SMOOTH_M || 150);

// minimal PNG reader: 8-bit RGB or RGBA, not interlaced
export function decodePng(buf) {
  let p = 8, w = 0, h = 0, ct = 2; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12] !== 0 || ![2, 6].includes(ct)) throw new Error('unsupported PNG'); }
    else if (type === 'IDAT') idat.push(d); p += 12 + len; }
  const bpp = ct === 6 ? 4 : 3, raw = inflateSync(Buffer.concat(idat)), row = w * bpp, out = Buffer.alloc(h * row);
  for (let y = 0; y < h; y++) { const f = raw[y * (row + 1)], src = y * (row + 1) + 1, o = y * row;
    for (let x = 0; x < row; x++) { const a = x >= bpp ? out[o + x - bpp] : 0, b = y ? out[o - row + x] : 0, c = x >= bpp && y ? out[o - row + x - bpp] : 0, v = raw[src + x];
      let pr = 0; if (f === 1) pr = a; else if (f === 2) pr = b; else if (f === 3) pr = (a + b) >> 1; else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[o + x] = (v + pr) & 255; } }
  return {w, h, bpp, data: out};
}
const tiles = new Map();
async function tile(x, y) {
  const k = `${Z}/${x}/${y}`; if (tiles.has(k)) return tiles.get(k);
  let t = null; for (let n = 0; n < 3 && !t; n++) try { const r = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${k}.png`, {signal: AbortSignal.timeout(30000)}); if (!r.ok) throw new Error(r.status); t = decodePng(Buffer.from(await r.arrayBuffer())); } catch (e) { if (n === 2) throw new Error(`elevation tile ${k}: ${e.message}`); }
  tiles.set(k, t); return t;
}
async function heightAt(lat, lon) {
  const n = 2 ** Z, fx = (lon + 180) / 360 * n, r = lat * Math.PI / 180, fy = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
  const px = fx * 256 - 0.5, py = fy * 256 - 0.5, x0 = Math.floor(px), y0 = Math.floor(py), ax = px - x0, ay = py - y0;
  const at = async (X, Y) => { const t = await tile(Math.floor(X / 256), Math.floor(Y / 256)), i = ((Y % 256) * 256 + (X % 256)) * t.bpp; return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768; };
  const [a, b, c, d] = [await at(x0, y0), await at(x0 + 1, y0), await at(x0, y0 + 1), await at(x0 + 1, y0 + 1)];
  return a * (1 - ax) * (1 - ay) + b * ax * (1 - ay) + c * (1 - ax) * ay + d * ax * ay;
}

if (process.argv[1]?.endsWith('build-extra.mjs')) {
  const lines = JSON.parse(readFileSync(`${DIR}/accepted-lines.json`, 'utf8')), sum = JSON.parse(readFileSync(`${DIR}/loops-summary.json`, 'utf8')).tracks;
  const out = {note: 'Candidate tracks. Not read by the simulator. Evidence: map centre line (OpenStreetMap, ODbL) accepted within 0.5 % of the FIA lap distance; height from terrarium elevation tiles (about 30 m grid). Start point and direction are as mapped, not verified.', tracks: {}}, report = [];
  for (const [key, ll] of Object.entries(lines)) {
    const [venue, fiaName] = key.split(' | '), acc = (sum[venue]?.accepted || []).find(a => a.id === key) || {};
    try {
      const pts = ll[0][0] === ll[ll.length - 1][0] && ll[0][1] === ll[ll.length - 1][1] ? ll.slice(0, -1) : ll;
      const loc = lonLatToLocal(pts.map(p => [p[1], p[0]]));
      let g = resampleClosed(loc.x, loc.y, DS); const w = Math.max(1, Math.round(POS_SMOOTH_M / g.ds) | 1);
      g = resampleClosed(Array.from(movingAverageClosed(g.x, w)), Array.from(movingAverageClosed(g.y, w)), DS);
      // smoothing cuts corners, so the smoothed line is a little short: keep its shape, restore the mapped lap length
      const shrink = g.length / (acc.loopM || g.length), {kappa: k0} = headingCurvature(g.x, g.y, g.ds, CURV_SMOOTH_M), n = g.x.length;
      const kappa = Float64Array.from(k0, v => v * shrink), lapM = g.length / shrink, ds = g.ds / shrink;
      // height at every grid point (back to lat/lon), smoothed over the DEM grid size, then grade
      const lat0 = pts.reduce((a, p) => a + p[0], 0) / pts.length * Math.PI / 180, R = 6371008.8, z = new Float64Array(n);
      for (let i = 0; i < n; i++) z[i] = await heightAt(pts[0][0] + g.y[i] / R * 180 / Math.PI, pts[0][1] + g.x[i] / (R * Math.cos(lat0)) * 180 / Math.PI);
      const zs = movingAverageClosed(movingAverageClosed(z, Math.max(1, Math.round(ELEV_SMOOTH_M / g.ds) | 1)), Math.max(1, Math.round(ELEV_SMOOTH_M / g.ds) | 1)), grade = new Float64Array(n);
      for (let i = 0; i < n; i++) grade[i] = Math.atan((zs[(i + 1) % n] - zs[(i - 1 + n) % n]) / (2 * ds));
      const step = Math.max(1, Math.floor(n / 360)), map = {x: [], y: []}; for (let i = 0; i < n; i += step) { map.x.push(Math.round(g.x[i])); map.y.push(Math.round(g.y[i])); }
      const zmin = Math.min(...zs), zmax = Math.max(...zs), turn = kappa.reduce((a, k) => a + k * ds, 0), maxGrade = Math.max(...Array.from(grade, Math.abs));
      const id = (venue + '--' + fiaName).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      out.tracks[id] = {id, venue, name: fiaName, ds, length: Math.round(lapM), officialLengthM: acc.officialM ?? null, lengthSource: acc.source ?? null, fiaGrade: acc.grade ?? null, pole: acc.pole ?? null, widthM: acc.widthM ?? null,
        sectors: [], corners: [], kappa: Array.from(kappa, v => Math.round(v * 1e5)), grade: Array.from(grade, v => Math.round(v * 1e4)), heading: null, map,
        elevation: {minM: Math.round(zmin), maxM: Math.round(zmax), rangeM: +(zmax - zmin).toFixed(1), maxGradePct: +(Math.tan(maxGrade) * 100).toFixed(1), everyM: 50, m: Array.from({length: Math.ceil(n / 10)}, (_, i) => Math.round(zs[i * 10] * 10) / 10)},
        centre: [+pts[0][0].toFixed(4), +pts[0][1].toFixed(4)], quality: {evidence: 'map centre line', mapPoints: pts.length, loopM: acc.loopM, lengthErrorPct: acc.errorPct, smoothedLengthM: Math.round(g.length), smoothingShrinkPct: +((1 - shrink) * 100).toFixed(2), rawHeightRangeM: +(Math.max(...z) - Math.min(...z)).toFixed(1), totalTurnDeg: Math.round(turn * 180 / Math.PI), direction: turn < 0 ? 'clockwise as mapped' : 'anti-clockwise as mapped', startVerified: false},
        sources: ['OpenStreetMap raceway ways (© OpenStreetMap contributors, ODbL)', acc.source, 'Terrarium elevation tiles (Mapzen/Tilezen open data)'].filter(Boolean)};
      report.push(`${id}: ${Math.round(lapM)} m (official ${acc.officialM}, smoothing shrink ${((1 - shrink) * 100).toFixed(2)} %), raw height range ${(Math.max(...z) - Math.min(...z)).toFixed(0)} m, height ${Math.round(zmin)}–${Math.round(zmax)} m, max grade ${(Math.tan(maxGrade) * 100).toFixed(1)} %, turn ${Math.round(turn * 180 / Math.PI)}°`);
    } catch (e) { report.push(`${key}: ERROR ${String(e).slice(0, 160)}`); out.errors = [...(out.errors || []), `${key}: ${String(e).slice(0, 160)}`]; }
  }
  writeFileSync(`${DIR}/extra-tracks.json`, JSON.stringify(out)); writeFileSync(`${DIR}/extra-tracks-report.txt`, report.join('\n') + '\n'); console.log(report.join('\n'));
}
