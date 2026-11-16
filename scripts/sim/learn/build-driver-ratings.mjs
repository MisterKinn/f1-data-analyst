// Driver ratings (FIA driver categorisation: Platinum / Gold / Silver / Bronze) of the GT3 and LMP2 rows that fit-endurance.mjs learns
// from, and the line-up rating of every car at every event (task P1, owner 2026-11-16). Data only: no fit, no flag.
//   node scripts/sim/learn/build-driver-ratings.mjs <folder with the Al Kamel files of github.com/tobi/imsa_data (data/...)> [extra.json ...]
// Evidence layer 1 ("Known"): a rating is only taken from an official published document, never guessed. Sources, in this order:
//   1. Al Kamel results CSVs (WEC, ELMS, Asian LMS, IMSA): DRIVERn_LICENSE is the category printed by the organiser for that session
//      (IMSA prints its own driver rating, which uses the same four FIA names).
//   2. extra.json files (same shape as `lineups` below) from other official entry lists (SRO, Le Mans Cup, FIA list), when present.
// The driver of the car's best lap comes from the Al Kamel lap file of that session (DRIVER_NAME of the lap with the learned time).
// Raw files stay out of git (physics rule 2.9): this writes the derived table scripts/sim/data/learn/driver-ratings.json.
import {readFileSync, writeFileSync, existsSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {parseCsv, sessionType} from './build-endurance.mjs';
import {nameParts} from './drivers.mjs';
import {modelOf} from './models.mjs';
import {groupOf, loadRows} from './fit-endurance.mjs';

export const OUT = 'scripts/sim/data/learn/driver-ratings.json';
const ARCHIVE = 'https://github.com/tobi/imsa_data (Al Kamel published CSV files)';
const SITE = {wec: 'http://fiawec.alkamelsystems.com/', elms: 'http://elms.alkamelsystems.com/', alms: 'http://alms.alkamelsystems.com/', imsa: 'https://imsa.results.alkamelcloud.com/'};
// printed value -> P/G/S/B. Anything else ("S*", "S-B", empty) is not a plain FIA category: kept as raw, rating unknown.
const WORD = {p: 'P', platinum: 'P', platinium: 'P', g: 'G', gold: 'G', s: 'S', silver: 'S', b: 'B', bronze: 'B'};
export const ratingOf = v => WORD[String(v ?? '').trim().toLowerCase().replace(/ fia$/, '')] ?? null; // "Bronze FIA" (support-race files)
export const ORDER = 'PGSB';
export const lineupString = rs => rs.every(Boolean) ? [...rs].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join('') : null;
const dateOf = session => { const m = /^(\d{4})(\d\d)(\d\d)/.exec(session); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

// every results file of the archive -> one record per car, session and driver
export function readArchive(root) {
  const recs = [], base = join(root, 'data');
  for (const series of ['wec', 'elms', 'alms', 'imsa']) { if (!existsSync(join(base, series))) continue;
    for (const season of readdirSync(join(base, series)).filter(y => /^20\d\d$/.test(y))) for (const ev of readdirSync(join(base, series, season))) {
      const dir = join(base, series, season, ev); if (!/^\d+-/.test(ev)) continue;
      for (const f of readdirSync(dir).filter(f => /^\d{12}-.*-results\.csv$/.test(f))) {
        let rows; try { rows = parseCsv(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
        const session = f.replace(/-results\.csv$/, ''), file = `data/${series}/${season}/${ev}/${f}`;
        for (const r of rows) {
          const entry = String(r.NUMBER ?? '').trim(), cls = r.CLASS ?? '', vehicle = r.VEHICLE ?? ''; if (!entry) continue;
          const drivers = [];
          for (const i of ['1', '2', '3', '4', '5', '6', '']) { const first = (r[`DRIVER${i}_FIRSTNAME`] || '').trim(), last = (r[`DRIVER${i}_SECONDNAME`] || '').trim(); if (!last) continue; // '' = one-driver files
            const raw = (r[`DRIVER${i}_LICENSE`] ?? '').trim(); drivers.push({name: `${first} ${last}`.trim(), raw, rating: ratingOf(raw), long: (r[`DRIVER${i}_IMSA_DriverRatingLong`] ?? '').trim() || undefined}); }
          recs.push({series, season: +season, event: ev.replace(/^\d+-/, ''), session, type: sessionType(session.replace(/^\d+-/, '')), date: dateOf(session), file, entry, cls, vehicle, team: r.TEAM ?? '', drivers});
        } } } }
  return recs;
}

// best-lap driver: the lap of that car in that session whose time equals the learned best lap (Al Kamel lap file)
const lapSecs = t => { const p = String(t || '').split(':').map(Number); return p.some(x => !Number.isFinite(x)) ? NaN : p.reduce((a, x) => a * 60 + x, 0); };
function bestLapDriver(root, row, lapCache) {
  const dirs = existsSync(join(root, 'data', row.series, String(row.season))) ? readdirSync(join(root, 'data', row.series, String(row.season))).filter(d => d.replace(/^\d+-/, '') === row.event) : [];
  for (const d of dirs) { const f = join(root, 'data', row.series, String(row.season), d, row.session + '-laps.csv'); if (!existsSync(f)) continue;
    if (!lapCache.has(f)) { let L = []; try { L = parseCsv(readFileSync(f, 'utf8')); } catch {} lapCache.set(f, L); }
    const hit = lapCache.get(f).filter(l => String(l.NUMBER).trim() === String(row.entry) && Math.abs(lapSecs(l.LAP_TIME) - row.real) < 0.0006);
    const names = [...new Set(hit.map(l => (l.DRIVER_NAME || '').trim()).filter(Boolean))];
    if (names.length === 1) return {name: names[0], lap: row.real, session: row.session, file: `data/${row.series}/${row.season}/${d}/${row.session}-laps.csv`};
    return {name: null, why: names.length ? 'two drivers with the same lap time' : 'lap not found in the lap file'}; }
  return {name: null, why: 'no lap file'};
}

export function build(root, extras = [], learned = null) {
  const recs = readArchive(root);
  // car of a GT3 / LMP2 group only (the groups fit-endurance.mjs learns: gt3, lmp2)
  const keep = recs.filter(r => { const model = modelOf(r.vehicle, r.season, r.cls); return ['gt3', 'lmp2'].includes(groupOf({cls: r.cls, season: r.season, model, src: 'archive'})); });
  for (const r of keep) r.group = groupOf({cls: r.cls, season: r.season, model: modelOf(r.vehicle, r.season, r.cls), src: 'archive'});
  const extraLineups = extras.flatMap(f => Object.entries(JSON.parse(readFileSync(f, 'utf8')).lineups || {}));
  // identity: the same full name (accents, case and word order ignored). No initials or short first names: a rating must never move
  // to another person (drivers.mjs would join "Mikkel" and "Michael" Jensen).
  const names = new Map(), idOf = n => { const k = nameParts(n).key; if (!k) return null; const id = k.replace(/ /g, '-'); if (!names.has(id)) names.set(id, n); return id; };
  const files = [], fileIx = new Map(), F = f => fileIx.get(f) ?? (fileIx.set(f, files.length), files.push(f), files.length - 1);
  // ratings per driver and season: every dated official value (later files win inside a season; changes are kept)
  const drivers = {}, conflicts = [];
  const note = (id, name, season, rating, source, date, extra = {}) => { const p = drivers[id] ||= {name, seasons: {}}; const s = p.seasons[season];
    if (!s) { p.seasons[season] = {rating, source, date, ...extra}; return; }
    const now = s.changes?.at(-1)?.rating ?? s.rating;
    if (now !== rating) { (s.changes ||= []).push({rating, source, date}); conflicts.push({driver: id, season, from: now, to: rating, date, source}); }
    else if (!s.changes && date > s.date) Object.assign(s, {source, date}); };
  for (const r of keep.sort((a, b) => a.date.localeCompare(b.date))) for (const d of r.drivers) if (d.rating) note(idOf(d.name), d.name, r.season, d.rating, `Al Kamel ${r.series.toUpperCase()} results ${r.file}`, r.date,
    r.series === 'imsa' ? {printedBy: 'IMSA'} : {});
  for (const [ek, cars] of extraLineups) for (const c of Object.values(cars)) for (const d of c.drivers) if (ratingOf(d.rating)) note(idOf(d.name), d.name, +ek.split('|')[1], ratingOf(d.rating), d.source || c.source, d.date || c.date);
  // line-up per event and car: the drivers named for that car in the race classification of the event (else qualifying, else practice:
  // test days before an event list test drivers), rating printed at that event; a driver with no value printed at the event takes his
  // rating of the same season from another official file (marked "season")
  const lineups = {}, ev = new Map(), RANK = {R: 3, Q: 2, P: 1}, rank = r => RANK[r.type] || 0, top = new Map();
  // (only files that list drivers count; inside the best kind, only its last day: a test-day "qualifying" lists test drivers)
  const score = r => rank(r) * 1e9 + +r.date.replace(/-/g, '');
  for (const r of keep) if (r.drivers.length) { const k = `${r.series}|${r.season}|${r.event}|${r.entry}`; top.set(k, Math.max(top.get(k) ?? 0, score(r))); }
  for (const r of keep) { if (!r.drivers.length || score(r) < top.get(`${r.series}|${r.season}|${r.event}|${r.entry}`)) continue; const k = `${r.series}|${r.season}|${r.event}`, m = ev.get(k) || ev.set(k, new Map()).get(k), c = m.get(r.entry) || m.set(r.entry, {r, drivers: new Map(), files: new Set()}).get(r.entry);
    c.files.add(r.file); if (r.date >= c.r.date) c.r = r;
    for (const d of r.drivers) { const id = idOf(d.name), p = c.drivers.get(id); if (!p || (d.rating && (!p.rating || r.date >= p.date))) c.drivers.set(id, {id, name: d.name, rating: d.rating, raw: d.raw, date: r.date, file: r.file}); } }
  for (const [k, m] of ev) { const out = lineups[k] = {};
    for (const [entry, c] of [...m].sort((a, b) => a[0].localeCompare(b[0], 'en', {numeric: true}))) {
      const ds = [...c.drivers.values()].map(d => { if (d.rating) return {id: d.id, rating: d.rating, how: 'event', file: F(d.file)};
        const s = drivers[d.id]?.seasons?.[k.split('|')[1]]; return s ? {id: d.id, rating: s.rating, how: 'season'} : {id: d.id, rating: null, how: 'unknown', ...(d.raw ? {raw: d.raw} : {})}; });
      out[entry] = {group: c.r.group, cls: c.r.cls, vehicle: c.r.vehicle, drivers: ds, lineup: lineupString(ds.map(d => d.rating)), date: c.r.date, source: `Al Kamel ${c.r.series.toUpperCase()} ${SITE[c.r.series]}`}; } }
  const extraBest = new Map();
  for (const [ek, cars] of extraLineups) { const out = lineups[ek] ||= {}; for (const [entry, c] of Object.entries(cars)) { if (out[entry]?.lineup) continue;
    const season = ek.split('|')[1], ds = c.drivers.map(d => { const id = idOf(d.name), r = ratingOf(d.rating), s = drivers[id]?.seasons?.[season];
      return r ? {id, rating: r, how: 'event'} : s ? {id, rating: s.rating, how: 'season'} : {id, rating: null, how: 'unknown'}; });
    const {bestLap, ...rest} = c; out[entry] = {...rest, drivers: ds, lineup: lineupString(ds.map(d => d.rating))}; if (bestLap) extraBest.set(`${ek}|${entry}`, bestLap); } }
  // the learned rows (fit-endurance.mjs): line-up of the car that set the model's best lap, and the driver of that lap when the lap file shows it
  const rows = learned ?? loadRows().rows.filter(r => r.group === 'gt3' || r.group === 'lmp2'), lapCache = new Map(), learnedOut = [];
  for (const r of rows) { const k = `${r.series}|${r.season}|${r.event}`, L = lineups[k]?.[String(r.entry)];
    const xb = extraBest.get(`${k}|${r.entry}`), b = xb && Math.abs(xb.lap - r.real) < 0.0006 ? {name: xb.name, file: xb.source}
      : L && SITE[r.series] ? bestLapDriver(root, r, lapCache) : {name: null, why: 'no Al Kamel lap file for this source'};
    const id = b.name ? idOf(b.name) ?? null : null;
    learnedOut.push({series: r.series, season: r.season, event: r.event, session: r.session, group: r.group, model: r.model, entry: String(r.entry), lap: r.real,
      lineup: L?.lineup ?? null, bestLapDriver: id ? {id, rating: L.drivers.find(d => d.id === id)?.rating ?? drivers[id]?.seasons?.[r.season]?.rating ?? null, file: F(b.file)} : null,
      ...(L ? {} : {why: 'no official line-up found'}), ...(!id && L ? {bestLapWhy: b.why} : {})}); }
  // keep the events the fit learns from (every car of those events), and the drivers of those line-ups
  const evKeep = new Set(learnedOut.map(r => `${r.series}|${r.season}|${r.event}`)), L2 = Object.fromEntries(Object.entries(lineups).filter(([k]) => evKeep.has(k)));
  const ids = new Set(Object.values(L2).flatMap(cars => Object.values(cars).flatMap(c => c.drivers.map(x => x.id))));
  const D2 = Object.fromEntries(Object.entries(drivers).filter(([id]) => ids.has(id)).sort(([a], [b]) => a.localeCompare(b)));
  return {drivers: D2, lineups: L2, learned: learnedOut, changes: conflicts.filter(c => ids.has(c.driver)), files};
}

if (process.argv[1]?.endsWith('build-driver-ratings.mjs')) {
  const [root, ...extras] = process.argv.slice(2); if (!root) { console.error('usage: build-driver-ratings.mjs <imsa_data folder> [extra.json ...]'); process.exit(1); }
  const res = build(root, extras);
  const out = {generated: new Date().toISOString().slice(0, 10),
    note: 'FIA driver categorisation (P Platinum, G Gold, S Silver, B Bronze) as printed in official timing / entry-list documents: evidence layer 1 (Known). '
      + 'drivers: {id: {name, seasons: {season: {rating, source, date}}}} (date = the latest official document of that season with this value; changes = other values printed later). '
      + 'Al Kamel paths (data/...) are files of the archive in sources[0]; file = index into files. '
      + 'lineups: {"series|season|event": {car: {drivers: [{id, rating, how}], lineup}}}; lineup = ratings sorted P>G>S>B, null when any driver is unknown. '
      + 'how: event = printed at that event; season = printed for that driver at another event of the same season; unknown = not found (never guessed). '
      + 'learned: the GT3 and LMP2 rows of fit-endurance.mjs with the line-up of the car that set the time and the driver of that lap. Built by scripts/sim/learn/build-driver-ratings.mjs.',
    sources: [ARCHIVE, ...Object.values(SITE), ...extras], ...res};
  writeFileSync(OUT, JSON.stringify(out, null, 0) + '\n');
  const n = res.learned.length, k = res.learned.filter(r => r.lineup).length;
  console.log(`drivers ${Object.keys(res.drivers).length}, events ${Object.keys(res.lineups).length}, learned rows ${n}, with known line-up ${k}, best-lap driver ${res.learned.filter(r => r.bestLapDriver).length}, rating changes ${res.changes.length}`);
}
