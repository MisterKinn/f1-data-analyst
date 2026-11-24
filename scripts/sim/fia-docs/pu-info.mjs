// FIA "Power Unit Information" sheets (2026+) -> scripts/sim/data/fia-docs/f1-2026-power-unit-information.csv.
// Method: handoff-f1-2026-power-unit-information.md. Page 1 = cover (document, date, time, V2), page 2 = the values, read by position.
//   node scripts/sim/fia-docs/pu-info.mjs --check   rebuild every sheet already in the CSV and list the rows that differ (CSV untouched)
//   node scripts/sim/fia-docs/pu-info.mjs           find new sheets in the FIA event listings, add their rows (rows of other rounds untouched)
import {fiaCall, eventDocuments} from '../../../worker/fia.js';
import {calendarEvents} from '../../../worker/race-calendar-data.js';
import {pdfPages, lines, readCsv, writeCsv, diffRows, report} from './lib.mjs';

export const FILE = 'scripts/sim/data/fia-docs/f1-2026-power-unit-information.csv';
const ISS16 = 'https://api.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_c_technical_-_iss_16_-_2026-02-27.pdf';
const SPORTING = 'https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_05_-_2026-02-27.pdf';
const ISS17 = 'https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_c_technical_-_iss_17_-_2026-04-28.pdf';
const PLOTTED = 'Knots read from the event plot; approximate.';
// Base/Alt 1 from the C5.2.7-8 equations; Rev 1/Alt 2 digitised from the Monaco/Singapore plots (handoff section 3)
const CURVES = {
  'Base - Standard': {knots: [[290, 350], [340, 100], [345, 0]]},
  'Base - Overtake': {knots: [[337.5, 350], [355, 0]]},
  'Alt 1': {knots: [[310, 250], [340, 100], [345, 0]]},
  'Rev 1 - Standard': {knots: [[200, 350], [300, 0]], plotted: PLOTTED},
  'Rev 1 - Overtake': {knots: [[200, 350], [300, 150], [310, 0]], plotted: PLOTTED},
  'Alt 2': {knots: [[228.6, 250], [300, 0]], plotted: PLOTTED + ' 250 kW plateau meets Rev 1 Standard near 229 km/h; 228.6 is the interpolated intersection.'},
};
const EARLY = 'Early sheet labels modes only; B7.2.3(b) normally activates Overtake when enabled during practice or qualifying.';
const SESSIONS = {Standard: ['FP1', 'FP2', 'FP3', 'Q', 'Race'], Alternative: ['FP1', 'SQ', 'Sprint', 'Q', 'Race']};
const DAY = {FP1: -2, FP2: -2, SQ: -2, FP3: -1, Q: -1, Sprint: -1, Race: 0}; // relative to race day
const MONTHS = 'january february march april may june july august september october november december'.split(' ');

const COLS = [['sector', /^Identification of$/i], ['window', /^Lap distance window$/i], ['kw', /^Maximum PU power$/i], ['speed', /^Speed threshold$/i],
  ['gap', /^Detection Gap$/i], ['det', /^Detection Line$/i], ['act', /^Activation Line$/i]];
const DATA = /^-$|^\[?\s*(?:T\d|Exit|Entry|Pit)|\d+\s*[-–]\s*\d+|kW|km\s*\/\s*h|^\d+(?:\.\d+)?\s*(?:s|m)\b|^\d{3,5}$|TBC|^\(?L\d/i;
const num = s => s.match(/\d+(?:\.\d+)?/)?.[0] ?? '';
const clean = s => String(+s); // "9.0" -> "9", as in the CSV

// one sheet -> {cover, info, recharge, curves, tables, b72}
export function parseSheet(doc) {
  // positions scaled to an A4 width of 595 pt (Barcelona and Austria are 916 pt wide)
  const [p1, raw] = doc.pages, k = 595.32 / raw.width, p2 = {items: raw.items.map(t => ({...t, x: t.x * k, y: t.y * k}))}, cov = lines(p1), L = lines(p2);
  const after = (rows, re) => { for (const l of rows) { const i = l.items.findIndex(t => re.test(t.s)); if (i >= 0 && l.items[i + 1]) return l.items.slice(i + 1).map(t => t.s).join(' '); } return ''; };
  const cover = {doc: after(cov, /^Document$/), date: after(cov, /^Date$/), time: after(cov, /^Time$/), title: after(cov, /^Title$/)};
  cover.revision = +(cover.title.match(/\bV\s*0*(\d+)\b/i)?.[1] || 1);
  const info = {round: +after(L, /^ROUND No\.$/).replace(/\D/g, ''), venue: after(L, /^VENUE$/), centreline: num(after(L, /^CENTRELINE$/)), format: after(L, /^FORMAT$/)};
  const items = p2.items, mj = L.find(l => l.items.filter(t => /^[\d.]+\s*MJ$/.test(t.s)).length >= 5);
  if (!info.round || !mj) throw Error(`${doc.url}: page 2 is not a Power Unit Information sheet`);
  const [raceOff, raceOn, quali, fp, outLap] = mj.items.filter(t => /MJ$/.test(t.s)).map(t => clean(num(t.s)));
  const recharge = {raceOff, raceOn, quali, fp, outLap, distance: num(mj.items.find(t => /^\d+\s*m$/.test(t.s))?.s || ''), rate: num(mj.items.find(t => /kW\/s/.test(t.s))?.s || '')};
  // curve labels under the C5.2.8 table (x < 330; the legend sits right of the plot)
  const cl = L.find(l => l.items.filter(t => t.x < 330 && CURVE_RE.test(t.s)).length >= 2);
  const curves = {};
  for (const t of cl.items.filter(t => t.x < 330 && CURVE_RE.test(t.s))) curves[t.x < 160 ? (curves.off ? 'on' : 'off') : t.x < 245 ? 'other' : 'practice'] = t.s.replace(/\s+/g, ' ');
  curves.noOther = items.some(t => /^No such sectors/i.test(t.s));
  // tables: header columns grouped by height, data items assigned to the nearest column to their left
  const heads = items.flatMap(t => COLS.filter(([, re]) => re.test(t.s.trim())).map(([k]) => ({k, x: t.x, y: t.y}))).sort((a, b) => a.y - b.y);
  const groups = []; for (const h of heads) { const g = groups.at(-1); if (g && h.y - g.at(-1).y < 40) g.push(h); else groups.push([h]); }
  const tables = {}, b72 = {gap: [], det: [], act: []};
  groups.forEach((g, gi) => {
    const y0 = Math.max(...g.map(h => h.y)), y1 = groups[gi + 1] ? Math.min(...groups[gi + 1].map(h => h.y)) - 30 : 1e9;
    const cols = g.sort((a, b) => a.x - b.x).map(h => ({...h, vals: []}));
    for (const t of items) if (t.y > y0 && t.y < y1 && DATA.test(t.s.trim())) { const c = cols.filter(c => c.x <= t.x + 12).at(-1); if (c) c.vals.push(t); }
    const arts = items.filter(t => /^Article C5\.(2\.8iii|12\.[457])$/.test(t.s.trim()) && t.y < Math.min(...g.map(h => h.y)) && t.y > Math.min(...g.map(h => h.y)) - 70).sort((a, b) => a.x - b.x).map(t => t.s.trim().replace('Article ', ''));
    let tab = null, n = 0;
    for (const c of cols) {
      c.vals.sort((a, b) => a.y - b.y || a.x - b.x);
      if (c.k in b72) { b72[c.k].push(...c.vals.map(t => t.s.trim())); continue; }
      if (c.k === 'sector') tables[arts[n++]] = tab = {};
      if (tab) tab[c.k] = c.vals.map(t => t.s.trim());
    }
  });
  return {url: doc.url, cover, info, recharge, curves, tables, b72};
}
const CURVE_RE = /^(?:(?:Base|Rev\s*1)\s*-\s*(?:Standard|Overtake)|Alt\s*[12])$/;

const entries = tab => tab && (tab.sector || []).filter(s => s !== '-').map((s, i) => {
  const w = tab.window?.filter(x => x !== '-')[i] || '', v = (tab.kw || tab.speed)?.filter(x => x !== '-')[i] || '', m = w.match(/(\d+)\s*[-–]\s*(\d+)/);
  return {sector: s, start: m?.[1] || '', end: m?.[2] || '', star: /\*/.test(w), q: /^\[/.test(s), value: num(v)};
});

// cover "11 September 2026" + "22:05" -> first day this revision is in force (shortcut: issues after noon local start the next day; use session times when a timetable source exists)
function effective(cover) {
  const [, d, mon, y] = cover.date.match(/(\d+)\s+([A-Za-z]+)\s+(\d{4})/) || [];
  if (!d) return '0000-00-00';
  const t = new Date(Date.UTC(+y, MONTHS.indexOf(mon.toLowerCase()), +d + (+cover.time.slice(0, 2) >= 12 ? 1 : 0)));
  return t.toISOString().slice(0, 10);
}
const shift = (date, n) => new Date(Date.parse(date) + n * 864e5).toISOString().slice(0, 10);

// rows of one sheet for every session; meta = listing/calendar fields that are not printed in the PDF
export function rowsFor(s, meta) {
  const {info, recharge: r, curves: c, tables: t, b72} = s, out = [], fmt = info.format;
  const base = {round: info.round, event: meta.event, venue: info.venue, event_date: meta.event_date, official_doc: num(s.cover.doc), revision: s.cover.revision,
    published_as_listed: meta.published_as_listed, centreline_km: info.centreline, format: fmt, source: s.url + '#page=2', page: 2, status: 'document'};
  const early = !c.practice, iss = effective(s.cover) < '2026-04-28' ? ISS16 : ISS17;
  for (const session of SESSIONS[fmt] || []) {
    const race = session === 'Race' || session === 'Sprint', q = session === 'Q' || session === 'SQ';
    const row = (clause, item, o = {}) => out.push({...base, session, session_date: shift(meta.event_date, DAY[session]), clause, item, value_state: 'specified', basis: 'table', ...o});
    const curve = (overtake, lap_scope, name, note = '') => {
      const k = CURVES[name]; if (!k) console.warn(`${s.url}: curve "${name}" has no knots yet; digitise it from the plot (handoff section 3)`);
      row('C5.2.8', 'ERS-K DC power curve', {overtake, lap_scope, unit: 'km/h,kW', curve: name, knots_kmh_kw: k ? JSON.stringify(k.knots) : '',
        basis: k?.plotted ? 'table + plotted knots' : 'table + regulation breakpoints', supporting_source: k?.plotted ? '' : note ? `${iss} | ${SPORTING}` : iss, note: [k?.plotted, note].filter(Boolean).join(' ')});
    };
    if (race) { row('C5.2.10', 'recharge', {overtake: 'off', lap_scope: 'per lap', value: r.raceOff, unit: 'MJ/lap'}); row('C5.2.10', 'recharge', {overtake: 'on', lap_scope: 'per lap', value: r.raceOn, unit: 'MJ/lap'}); }
    else { row('C5.2.10', 'recharge', {overtake: 'single cap', lap_scope: 'ordinary lap', value: q ? r.quali : r.fp, unit: 'MJ/lap'}); row('C5.2.10', 'out_lap_recharge', {overtake: 'single cap', lap_scope: 'out lap', value: r.outLap, unit: 'MJ/lap'}); }
    if (!race && !early) curve('practice curve', 'whole lap', c.practice);
    else { const zone = c.other ? 'main overtaking zones' : 'whole lap', n = race ? '' : EARLY; curve('off', zone, c.off, n); curve('on', zone, c.on, n); if (race && c.other) curve('either', 'C5.2.8iii sectors', c.other); }
    const table = (clause, item, unit, value, sessions = true) => {
      if (!sessions) return;
      if (!t[clause]) return row(clause, item, {value_state: 'not_on_sheet'});
      const all = entries(t[clause]), use = all.filter(e => q || !e.q);
      if (!use.length) return row(clause, item, {value_state: all.length ? 'qualifying_only_entries' : 'none_listed'});
      for (const e of use) row(clause, item, {lap_scope: clause === 'C5.2.8iii' ? 'Sprint/Race' : e.q ? 'SQ/Q only' : 'all sessions', sector: e.sector, start_m: e.start, end_m: e.end,
        value: value(e), unit: value(e) && unit, note: e.star ? 'FIA appends an asterisk to this distance window.' : ''});
    };
    if (race) table('C5.2.8iii', 'alternative curve sector', '', () => c.other || '');
    table('C5.12.4', 'initial PU power drop', 'kW', e => e.value);
    table('C5.12.5', 'MGU-K reduction reset', '', () => 'permitted');
    table('C5.12.7', 'higher speed threshold', 'km/h', e => e.value);
    row('C5.12.8', 'power limited distance', {value: r.distance, unit: 'm'});
    row('C5.12.8', 'PU power reduction rate limit', {value: r.rate, unit: 'kW/s'});
    if (race) {
      row('B7.2', 'detection gap', {value: clean(num(b72.gap[0] || '')), unit: 's'});
      for (const [k, item] of [['det', 'detection line'], ['act', 'activation line']]) {
        const v = b72[k], m = v.find(x => /^\d{3,5}\b/.test(x)) || '';
        row('B7.2', item, {value: num(m), unit: 'm', loop: (v.find(x => /^\(?L\d/.test(x)) || '').replace(/[()]/g, ''), value_state: v.some(x => /TBC/.test(x)) ? 'TBC' : 'specified'});
      }
    }
  }
  return out;
}

// revision flags across the sheets of one round
function flag(rows, sheets) {
  const byRound = Object.groupBy(sheets, s => s.info.round);
  for (const r of rows) {
    const revs = byRound[r.round].sort((a, b) => a.cover.revision - b.cover.revision);
    r.latest_event_revision = +(r.revision === revs.at(-1).cover.revision);
    const live = revs.filter(s => effective(s.cover) <= r.session_date).at(-1) || revs[0];
    r.applies_to_session = +(r.revision === live.cover.revision);
  }
  return rows;
}

const ORDER = ['FP1', 'FP2', 'SQ', 'FP3', 'Sprint', 'Q', 'Race'];
const key = r => [r.source, r.session, r.clause, r.item, r.overtake, r.lap_scope, r.sector].join('|');
export async function build(sources, metaOf) {
  const sheets = [];
  for (const u of sources) sheets.push(parseSheet(await pdfPages(u)));
  const rows = flag(sheets.flatMap(s => rowsFor(s, metaOf(s))), sheets);
  return rows.sort((a, b) => a.round - b.round || ORDER.indexOf(a.session) - ORDER.indexOf(b.session) || a.revision - b.revision);
}

// listing + calendar fields for a sheet that is not in the CSV yet
function newMeta(listed) {
  return s => {
    const ev = calendarEvents.find(e => e.series === 'f1' && e.nameEn === listed.event && e.end.startsWith('20' + listed.year.toString().slice(2)));
    return {event: listed.event, event_date: ev?.end || '', published_as_listed: listed.published ? `${listed.published} CET` : ''}; // shortcut: the listing prints CET without a zone field
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const {head, rows: old, format} = readCsv(FILE);
  const known = [...new Set(old.map(r => r.source.split('#')[0]))], metaFrom = new Map(old.map(r => [r.source.split('#')[0], r]));
  const fromCsv = s => metaFrom.get(s.url);
  if (process.argv.includes('--check')) {
    const rows = await build(known, fromCsv);
    report('PU information', diffRows(old, rows.map(r => Object.fromEntries(head.map(h => [h, String(r[h] ?? '')]))), key, head));
  } else {
    const found = [], year = new Date().getUTCFullYear();
    for (const y of [...new Set([2026, year])]) {
      const index = JSON.parse((await fiaCall('fia_list_archive', {year: y})).content[0].text);
      for (const e of index.records || []) {
        const ev = await eventDocuments(y, e.event).catch(() => null);
        for (const d of ev?.records || []) if (/power unit information/i.test(d.title) && !d.recalled && d.url && !known.includes(d.url)) found.push({url: d.url, event: ev.event, published: d.published, year: y});
      }
    }
    if (!found.length) { console.log('PU information: no new sheets'); process.exit(0); }
    const sheets = await Promise.all(found.map(async f => ({f, s: parseSheet(await pdfPages(f.url))})));
    const rounds = new Set(sheets.map(x => x.s.info.round));
    const sources = [...known.filter(u => rounds.has(+fromCsv({url: u}).round)), ...found.map(f => f.url)];
    const meta = s => fromCsv(s) || newMeta(found.find(f => f.url === s.url))(s);
    const rebuilt = await build(sources, meta);
    const rows = [...old.filter(r => !rounds.has(+r.round)), ...rebuilt.map(r => Object.fromEntries(head.map(h => [h, String(r[h] ?? '')])))].sort((a, b) => a.round - b.round);
    writeCsv(FILE, head, rows, format);
    console.log(`PU information: ${found.length} new sheet(s): ${found.map(f => f.url).join(', ')}`);
  }
}
