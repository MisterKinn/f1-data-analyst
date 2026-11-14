// Every car of every session of the Al Kamel CSV archive (IMSA, WEC, ELMS, Asian LMS, 2021-2026) -> one row per car and session.
//   node scripts/sim/learn/build-endurance.mjs <path to a clone of github.com/tobi/imsa_data> [out.csv]
// The archive holds the published Al Kamel "Analysis" (laps), "Classification" (results) and weather CSV files.
// Raw laps stay out of git (rule 2.9); this writes the derived table (commit it gzipped: scripts/sim/data/learn/endurance-cars.csv.gz).
// Clean lap = timed, not in/out of the pit, green flag at the line (when the file has the column), sectors add up.
import {readdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';

export function parseCsv(text) { // quoted fields, comma or semicolon (one 2021 IMSA file uses ';')
  text = text.replace(/^﻿/, ''); const nl = text.indexOf('\n'), head = text.slice(0, nl < 0 ? text.length : nl), d = head.split(';').length > head.split(',').length ? ';' : ',';
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === d) { row.push(f); f = ''; } else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  const cols = rows.shift().map(s => s.trim()); return rows.filter(r => r.length > 1).map(r => Object.fromEntries(cols.map((k, i) => [k, (r[i] ?? '').trim()])));
}
export const secs = t => { const p = String(t || '').split(':').map(Number); return !p.length || p.some(x => !Number.isFinite(x)) ? NaN : p.reduce((a, x) => a * 60 + x, 0); };
const num = x => { const s = String(x ?? '').trim().replace(',', '.'); const v = Number(s); return s !== '' && Number.isFinite(v) ? v : null; };
const mean = a => a.length ? a.reduce((p, q) => p + q, 0) / a.length : null, med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
export const sessionType = n => /race-hour|-hour-\d/.test(n) ? null : /qualifying-race|quali-race/.test(n) ? 'R' : /hyperpole|qualif|shootout|superpole/.test(n) ? 'Q' : /practice|session|test|warm|bronze|collective/.test(n) ? 'P' : /race/.test(n) ? 'R' : 'other';
// Weather units differ by file: IMSA is °F and inHg; the others are °C and hPa in some seasons and °F in others. The unit column
// decides when the file has one; otherwise a session mean of air or track temperature above 55 can only be °F.
const wx = rows => { const c = k => rows.map(r => num(r[k])).filter(v => v != null), air = mean(c('AIR_TEMP')), trk = mean(c('TRACK_TEMP')), p = mean(c('PRESSURE')), unit = rows.find(r => r.AIR_TEMP_UNIT)?.AIR_TEMP_UNIT;
  const isF = unit ? /F/i.test(unit) : Math.max(air ?? 0, trk ?? 0) > 55, t = v => v == null ? null : isF ? (v - 32) / 1.8 : v;
  return {airC: t(air), trackC: t(trk), hum: mean(c('HUMIDITY')), hpa: p == null ? null : p < 40 ? p * 33.8639 : p, rainShare: rows.length ? c('RAIN').filter(v => v > 0).length / rows.length : null}; };

// One session -> one row per car: [cls, entry, vehicle, manufacturer, team, tyres, best, s1, s2, s3, ideal, trapKph, lenKm, laps, clean, median, airC, trackC, hum, hpa, rainShare]
export function sessionCars(laps, res, w) {
  const out = [];
  const info = new Map(res.map(r => [String(r.NUMBER), r])), W = wx(w), cars = new Map(); let prevPit = new Map();
  for (const r of laps) {
        const e = String(r.NUMBER), c = cars.get(e) || cars.set(e, {r, laps: 0, clean: [], trap: 0, bs: [Infinity, Infinity, Infinity], best: null}).get(e);
        const t = secs(r.LAP_TIME), sx = [r.S1_SECONDS ?? r.S1, r.S2_SECONDS ?? r.S2, r.S3_SECONDS ?? r.S3].map(v => num(v) ?? secs(v)), flag = r.FLAG_AT_FL;
        const pitIn = !!r.CROSSING_FINISH_LINE_IN_PIT, pitOut = prevPit.get(e) || secs(r.PIT_TIME) > 0; prevPit.set(e, pitIn); c.laps++;
        const ok = t > 30 && !pitIn && !pitOut && (flag == null || flag === '' || flag === 'GF' || flag === 'FF') && sx.every(Number.isFinite) && Math.abs(sx[0] + sx[1] + sx[2] - t) < 0.005;
        if (!ok) continue;
        c.clean.push(t); sx.forEach((v, i) => { if (v < c.bs[i]) c.bs[i] = v; }); const tp = num(r.TOP_SPEED); if (tp > 150 && tp < 400 && tp > c.trap) c.trap = tp;
        if (!c.best || t < c.best.t) c.best = {t, sx, kph: num(r.KPH)};
      }
      for (const [e, c] of cars) { if (!c.best) continue; const i = info.get(e) || {}, b = c.best, near = c.clean.filter(t => t <= b.t * 1.07);
        out.push([(c.r.CLASS || i.CLASS || '').toUpperCase(), e, i.VEHICLE || '', c.r.MANUFACTURER || '', c.r.TEAM || i.TEAM || '', i.TIRES || i.TYRES || '',
          b.t.toFixed(3), ...b.sx.map(v => v.toFixed(3)), (c.bs[0] + c.bs[1] + c.bs[2]).toFixed(3), c.trap || '', b.kph ? (b.kph * b.t / 3600).toFixed(3) : '', c.laps, c.clean.length, med(near).toFixed(3),
          ...[W.airC, W.trackC, W.hum, W.hpa].map(v => v == null ? '' : v.toFixed(1)), W.rainShare == null ? '' : W.rainShare.toFixed(3)]); }
  return out;
}

export const COLS = ['series', 'season', 'event', 'session', 'type', 'cls', 'entry', 'vehicle', 'manufacturer', 'team', 'tyres', 'best', 's1', 's2', 's3', 'ideal', 'trapKph', 'lenKm', 'laps', 'clean', 'median', 'airC', 'trackC', 'hum', 'hpa', 'rainShare'];
export const csvLine = r => r.map(v => /[",\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : v).join(',');
if (process.argv[1]?.endsWith('build-endurance.mjs')) {
  const SRC = process.argv[2], OUT = process.argv[3] || 'scripts/sim/data/learn/endurance-cars.csv', out = [], log = [];
  for (const series of ['imsa', 'wec', 'elms', 'alms']) for (const season of readdirSync(join(SRC, 'data', series)).filter(y => /^20\d\d$/.test(y))) for (const event of readdirSync(join(SRC, 'data', series, season)).filter(e => !e.endsWith('.json'))) {
    const dir = join(SRC, 'data', series, season, event), files = readdirSync(dir);
    for (const lf of files.filter(f => f.endsWith('-laps.csv'))) {
      const session = lf.slice(0, -9), type = sessionType(session.replace(/^\d+-/, '')); if (!type) continue;
      let laps, res = [], w = []; try { laps = parseCsv(readFileSync(join(dir, lf), 'utf8')); } catch (e) { log.push(`${dir}/${lf}: ${e.message}`); continue; }
      if (existsSync(join(dir, session + '-results.csv'))) res = parseCsv(readFileSync(join(dir, session + '-results.csv'), 'utf8'));
      if (existsSync(join(dir, session + '-weather.csv'))) w = parseCsv(readFileSync(join(dir, session + '-weather.csv'), 'utf8'));
      for (const c of sessionCars(laps, res, w)) out.push([series, season, event.replace(/^\d+-/, ''), session, type, ...c]);
    }
  }
  writeFileSync(OUT, COLS.join(',') + '\n' + out.map(csvLine).join('\n') + '\n');
  console.log(out.length, 'car-session rows', 'log', log.length, log.slice(0, 5));
}
