// FIA WEC Balance of Performance decisions (Hypercar, LMGT3) -> scripts/sim/data/fia-docs/wec-bop-2023-2026.csv (method: handoff-wec-bop.md).
// Each decision page holds one table per race heading ("IMOLA", "PORTIMAO / SPA / LE MANS"); the "current" column of each group is read
// by position. 2023 Hypercar power curves come from TABLE 1 of the same decision.
// Rows the script does not build: entry-list model rows (bop_not_found_public) and the per-race map / track-limit records (curated).
//   node scripts/sim/fia-docs/wec-bop.mjs --check   rebuild the published rows of every decision in the CSV and list the rows that differ
//   node scripts/sim/fia-docs/wec-bop.mjs           add the rows of decisions in the Al Kamel committee folders that are not in the CSV yet
import {pdfPages, lines, readCsv, writeCsv, diffRows, report} from './lib.mjs';

export const FILE = 'scripts/sim/data/fia-docs/wec-bop-2023-2026.csv';
const VENUES = [[/SEBRING/, '1000 Miles of Sebring'], [/PORTIM|ALGARVE/, '6 Hours of Portimao'], [/SPA/, '6 Hours of Spa'], [/LE\s*MANS(?!.*LONE)/, '24 Hours of Le Mans'],
  [/MONZA/, '6 Hours of Monza'], [/FUJI/, '6 Hours of Fuji'], [/BAHRAIN|SAKHIR/, '8 Hours of Bahrain'], [/QATAR|LOSAIL|LUSAIL/, '1812 km of Qatar'],
  [/IMOLA/, '6 Hours of Imola'], [/S[AÃ]O\s*PAULO|INTERLAGOS/, '6 Hours of Sao Paulo'], [/COTA|AUSTIN|LONE\s*STAR|AMERICAS/, 'Lone Star Le Mans'], [/BARCELONA/, '6 Hours of Barcelona']];
const events = h => h.toUpperCase().split(/\s*\/\s*|\s+-\s+/).map(v => VENUES.find(([re]) => re.test(v))?.[1]).filter(Boolean);
const n = s => s.replace(',', '.').replace(/[^\d.+-]/g, '');
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const HEAD = /Vehicles|MANUFACTURER|COMPETITOR|Min\.|Max\.|Power|Energy|Refuelling|\(K[Gg]\)|\(KW\)|\(MJ\)|adj|current|Adjustments|value that|WET =|see table/i;

// one decision -> [{event, class, model, weight, power, energy, dry, wet, other}] (page = physical page)
export function parseDecision(doc, cls) {
  const out = [], cover = lines(doc.pages[0]).map(l => l.text).join(' ').toUpperCase();
  let curve = null, ctx = null;
  for (const p of doc.pages) {
    const L = lines(p), vh = L.filter(l => /^Vehicles\b/.test(l.text)), blocks = [];
    // a table can run on from the previous page (2023 D0054 Fuji): rows above this page's first table keep the previous context
    if (ctx) blocks.push({ctx, y0: 0, y1: Math.min((vh[0]?.y ?? 1e9) - 60, L.find(l => /^TABLE\s*\d/.test(l.text))?.y ?? 1e9)});
    for (const [bi, v] of vh.entries()) {
      const end = Math.min(vh[bi + 1]?.y ?? 1e9, L.find(l => l.y > v.y && /^COMPETITOR\b/.test(l.text))?.y ?? 1e9), heading = L.filter(l => l.y < v.y && l.y > v.y - 60 && /^[A-Z][A-Za-z\s/'-]+$/.test(l.text) && !HEAD.test(l.text)).at(-1)?.text || '';
      const cur = L.find(l => l.y > v.y && /\bcurrent\b/.test(l.text)), hdr = L.filter(l => l.y >= v.y && l.y <= cur.y), labels = hdr.flatMap(l => l.items).filter(t => /Weight|Max\. Power|Power gain|Stint Energy/i.test(t.s));
      const cols = hdr.flatMap(l => l.items).flatMap(t => {
        if (/^(prev|adj\.?|current)$/.test(t.s.trim())) { const g = labels.filter(g => g.x <= t.x + 8).sort((a, b) => b.x - a.x)[0]; return [{x: t.x, k: t.s.trim() === 'current' ? g?.s : null}]; }
        if (/kph in DRY/i.test(t.s)) return [{x: t.x + 12, k: 'dry'}];
        if (/kph in WET/i.test(t.s)) return [{x: t.x + 12, k: 'wet'}];
        if (/^Weight$/.test(t.s)) return [{x: t.x, k: 'base weight'}];
        return [];
      });
      ctx = {cols, heading, man: hdr.flatMap(l => l.items).find(t => /^MANUFACTURER$/i.test(t.s.trim())) || {x: 50},
        brk: +(hdr.map(l => l.text).join(' ').match(/below\s*(\d+)\s*kph/i)?.[1] || 0),
        // no race heading above the table (2023 D0049, D0060): the race named on the cover page
        events: heading ? events(heading) : VENUES.filter(([re]) => re.test(cover)).map(([, e]) => e),
        curveRef: /see table 1 in this decision/i.test(L.filter(l => l.y > v.y && l.y < end).map(l => l.text).join(' '))};
      blocks.push({ctx, y0: cur.y, y1: end});
    }
    for (const {ctx: c, y0, y1} of blocks) {
      const {cols, man, brk} = c;
      for (const l of L.filter(l => l.y > y0 && l.y < y1 && !/^(?:\(|Adjustments|COMPETITOR)/.test(l.text) && l.items.length >= 4)) {
        if (/^\d{1,3}\s/.test(l.text) && cls === 'LMGT3' && l.items[0].x > 90) continue; // competitor weight table
        const at = new Map(); // column -> the value nearest to it
        for (const t of l.items.filter(t => t.x > man.x + 20 && !(t.x < 160 && /[A-Za-z]/.test(t.s)) || cls === 'LMGT3' && t.x < man.x)) { const k = cols.reduce((a, k) => Math.abs(t.x - k.x) < Math.abs(t.x - a.x) ? k : a, cols[0]); if (k && Math.abs(t.x - k.x) < 30 && !at.has(k)) at.set(k, t.s.trim()); }
        const get = re => { const k = cols.find(k => k.k && re.test(k.k) && at.has(k)); const v = k ? at.get(k) : ''; return v === '-' ? '' : v; };
        const right = Math.min(...cols.filter(k => k.x > man.x + 20).map(k => k.x)) - 25;
        const names = l.items.filter(t => t.x >= man.x - 5 && t.x < right).map(t => t.s.trim());
        if (!names.length || !/^[A-Z]/.test(names[0])) continue;
        const r = {events: c.events, heading: c.heading, page: p.page, model: names.join(' '), weight: n(get(/Weight/i)), power: '', energy: n(get(/Stint Energy/i)),
          dry: n(get(/^dry$/)), wet: n(get(/^wet$/)), other: {}, curveRef: c.curveRef};
        if (!r.energy) continue; // not a vehicle row
        if (cls === 'LMGT3') Object.assign(r.other, {curve_id: get(/Max\. Power/i), speed_break_kmh: brk, power_gain_above_pct: +n(get(/Power gain/i)), weight_basis: 'without success ballast'});
        else {
          r.power = n(get(/Max\. Power/i));
          if (r.wet) r.other.front_axle_wet_kmh = +r.wet;
          if (brk) Object.assign(r.other, {speed_break_kmh: brk, power_gain_above_pct: +n(get(/Power gain/i))});
        }
        out.push(r);
      }
    }
    // 2023 TABLE 1: power (kW) rows over N/Nmax
    if (L.some(l => /TABLE 1/.test(l.text))) {
      const ax = L.find(l => /^Power\b/.test(l.text)), rows = {};
      for (const l of L.filter(l => l.y > ax.y && /^\d{3}\b/.test(l.text))) rows[l.items[0].s] = l.items.slice(1).map(t => +t.s);
      curve = {page: p.page, axis: ax.items.slice(1).map(t => +t.s), rows};
    }
  }
  for (const r of out) if (r.curveRef && curve?.rows[r.power]) Object.assign(r.other, {curve_page: curve.page, curve_axis: curve.axis, curve_kw: curve.rows[r.power]});
  return out;
}

// a later decision replaces an earlier one for the races it names (2023: D0049 replaces the Le Mans block of D0031)
const decision = u => +(u.match(/_d0*(\d+)_/i)?.[1] || 0);
export const latest = rows => { const best = {}; for (const r of rows) { const k = r.year + r.event + r.class; best[k] = Math.max(best[k] || 0, decision(r.source_url)); } return rows.filter(r => decision(r.source_url) === best[r.year + r.event + r.class]); };
// LMGT3 tables print the make in capitals; the CSV writes it as the make is spelt
const MAKES = {'ASTON MARTIN': 'Aston Martin', ASTON: 'Aston Martin', CORVETTE: 'Corvette', FERRARI: 'Ferrari', FORD: 'Ford', LAMBORGHINI: 'Lamborghini', LEXUS: 'Lexus', 'MC LAREN': 'McLaren', MCLAREN: 'McLaren', PORSCHE: 'Porsche', 'MERCEDES-AMG': 'Mercedes-AMG', MERCEDES: 'Mercedes-AMG', BMW: 'BMW', GENESIS: 'Genesis'};
const make = (cls, m) => cls !== 'LMGT3' ? m : m.replace(/^(ASTON MARTIN|MC ?LAREN|MERCEDES-AMG|[A-Z]+)\b/i, k => MAKES[k.toUpperCase()] || k).replace('Mercedes-AMG AMG ', 'Mercedes-AMG ');
const toRows = (src, year, cls, recs) => recs.flatMap(r => r.events.map(event => ({year, event, class: cls, car_model: make(cls, r.model), min_weight_kg: r.weight, max_power_kw: r.power,
  energy_per_stint_mj: r.energy, front_axle_threshold_kmh: r.dry, other: JSON.stringify(r.other), source_url: src, page: String(r.page), status: cls === 'LMGT3' ? 'published_curve_id' : 'published'})));

if (import.meta.url === `file://${process.argv[1]}`) {
  const {head, rows: old, format} = readCsv(FILE);
  const pub = old.filter(r => r.status.startsWith('published'));
  const docs = [...new Map(pub.map(r => [r.source_url, r])).values()];
  if (process.argv.includes('--check')) {
    const rebuilt = [];
    for (const d of docs) rebuilt.push(...toRows(d.source_url, d.year, d.class, parseDecision(await pdfPages(d.source_url), d.class)));
    console.log(`WEC BoP: ${old.length - pub.length} row(s) not rebuilt (entry-list models with no public BoP, and per-race map / track-limit records)`);
    // other is compared as JSON (key order is not data)
    const key = r => [r.source_url, r.event, norm(r.car_model)].join('|'), canon = r => ({...r, other: JSON.stringify(Object.fromEntries(Object.entries(JSON.parse(r.other || '{}')).sort()))});
    report('WEC BoP', diffRows(pub.map(canon), latest(rebuilt).map(canon), key, head));
  } else {
    // weekly: committee BoP decisions in the Al Kamel noticeboard manifests (the season index of worker/wec.js names the season manifests;
    // shortcut: the noticeboard manifest is assumed to sit next to the results one as results_noticeboard_<season>.json, as the CSV URLs do)
    const known = new Set(old.map(r => r.source_url)), year = new Date().getUTCFullYear(), add = [], O = 'https://files.alkamelcloud.com/';
    const index = await fetch(O + 'wec/manifests/results.json').then(r => r.json());
    for (const season of index.seasons.filter(x => [year - 1, year].some(y => String(x.name).includes(y)))) {
      const y = String(season.name).match(/20\d\d/)[0], m = await fetch(new URL(season.manifestUrl.replace(/results_(?!noticeboard)/, 'results_noticeboard_'), O)).then(r => r.ok ? r.json() : null).catch(() => null);
      if (!m) { console.log(`WEC BoP: no noticeboard manifest for ${season.name}`); continue; }
      for (const f of new Set(JSON.stringify(m).match(/[^"\\]*committee[^"\\]*BOP[^"\\]*\.pdf/gi) || [])) {
        const url = new URL(f, O + 'wec/results_noticeboard/').href, cls = /LMGT3/i.test(f) ? 'LMGT3' : /hypercar/i.test(f) ? 'Hypercar' : null;
        if (!cls || known.has(url)) continue;
        const recs = parseDecision(await pdfPages(url), cls);
        if (!recs.length) { console.log(`${url}: no BoP table read (image?); check it by hand`); continue; }
        add.push(...toRows(url, y, cls, recs));
      }
    }
    if (!add.length) { console.log('WEC BoP: no new decisions'); process.exit(0); }
    writeCsv(FILE, head, [...old, ...add], format);
    console.log(`WEC BoP: ${add.length} row(s) from ${new Set(add.map(r => r.source_url)).size} new decision(s)`);
  }
}
