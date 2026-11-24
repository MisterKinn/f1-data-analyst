// Step 5a (Project claude/gate-track-state-prereg-2026-11-23.md): track-state registry per track and year (2019–2026).
// Read-only use of the FIA parser (worker/lapsim/track-changes.js) and of the stored notes (track-changes-data.js).
//   node scripts/sim/track-state.mjs fia 2019,2020,2021,2022   FIA notes → .cache/track-state/fia-notes.json (needs fia.com)
//   node scripts/sim/track-state.mjs ti 2018,...,2026          TI qualifying corner minima → .cache/track-state/corners.json
//   node scripts/sim/track-state.mjs build                     registry, effects, docs (no network)
import {mkdirSync, readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join, dirname} from 'node:path';

const CACHE = process.env.TRACK_STATE_CACHE || '.cache/track-state';
const [cmd, arg] = process.argv.slice(2);
const save = (f, x) => { mkdirSync(dirname(f), {recursive: true}); writeFileSync(f, JSON.stringify(x)); };

// FIA archive event names of each simulator track (all seasons). The first event of a season at a track carries the changes;
// a second event the same year (Styrian, 70th Anniversary) is read too and merged. Sakhir GP 2020 is the outer loop: another track.
export const FIA_EVENTS = {
  melbourne: ['Australian Grand Prix'], shanghai: ['Chinese Grand Prix'], suzuka: ['Japanese Grand Prix'], sakhir: ['Bahrain Grand Prix'],
  jeddah: ['Saudi Arabian Grand Prix'], miami: ['Miami Grand Prix'], montreal: ['Canadian Grand Prix'], 'monte-carlo': ['Monaco Grand Prix'],
  catalunya: ['Spanish Grand Prix', 'Barcelona-Catalunya Grand Prix'], spielberg: ['Austrian Grand Prix', 'Styrian Grand Prix'],
  silverstone: ['British Grand Prix', '70th Anniversary Grand Prix'], 'spa-francorchamps': ['Belgian Grand Prix'], hungaroring: ['Hungarian Grand Prix'],
  zandvoort: ['Dutch Grand Prix'], monza: ['Italian Grand Prix'], madring: ['Spanish Grand Prix'], baku: ['Azerbaijan Grand Prix'],
  singapore: ['Singapore Grand Prix'], austin: ['United States Grand Prix'], 'mexico-city': ['Mexican Grand Prix', 'Mexico City Grand Prix'],
  interlagos: ['Brazilian Grand Prix', 'São Paulo Grand Prix'], 'las-vegas': ['Las Vegas Grand Prix'], lusail: ['Qatar Grand Prix'],
  'yas-marina-circuit': ['Abu Dhabi Grand Prix'], imola: ['Emilia Romagna Grand Prix'], 'kuala-lumpur': ['Bahrain Grand Prix'],
};
// which track an event name means in a year (Spanish GP: Catalunya until 2025, Madring from 2026; Bahrain GP 2026 ran at Sepang)
export function eventsOf(id, year) {
  if (id === 'madring') return year >= 2026 ? FIA_EVENTS.madring : [];
  if (id === 'catalunya') return year >= 2026 ? ['Barcelona-Catalunya Grand Prix'] : ['Spanish Grand Prix'];
  if (id === 'kuala-lumpur') return year === 2026 ? FIA_EVENTS[id] : [];
  if (id === 'sakhir' && year === 2026) return [];
  return FIA_EVENTS[id] || [];
}

// worker/fia.js reads hrefs up to the first quote of either kind, so a 2019–2021 file name with an apostrophe ("Race Directors' Event
// Notes") comes back cut; this reads the event page's double-quoted hrefs itself and keeps the FIA reader for the PDFs.
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fiaHtml(url) {
  for (let k = 0; k < 6; k++) {
    const r = await fetch(url, {headers: {Accept: 'text/html'}, signal: AbortSignal.timeout(30000)});
    if (r.status === 429 || r.status >= 500) { await sleep(15000 * (k + 1)); continue; }
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.text();
  }
  throw new Error('HTTP 429 (gave up)');
}
const decodeHtml = s => s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'");
function eventDocs(html) {
  return [...html.matchAll(/<li\b[^>]*class="[^"]*\bdocument-row\b[^"]*"[^>]*>([\s\S]*?)<\/li>/gi)].map(m => {
    const href = m[1].match(/<a\b[^>]*href="([^"]+)"/i)?.[1], title = decodeHtml((m[1].match(/class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    const published = (m[1].match(/class="[^"]*\bpublished\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || null;
    return href ? {title, url: new URL(decodeHtml(href), 'https://www.fia.com').href.replace(/'/g, '%27'), published, recalled: /recall/i.test(m[0].slice(0, 300) + title)} : null;
  }).filter(Boolean);
}
// the Race Director's own notes (not a summons that cites them, not the Pirelli preview); highest version
export function pickNotes(docs) {
  const ok = docs.filter(r => /race director/i.test(r.title) && /event notes|competition notes/i.test(r.title) && !r.recalled
    && !/summons|decision|offence|infringement|penalt|reprimand|SC1|SC2|times/i.test(r.title));
  const v = t => Number(t.match(/\bV(\d+)\b/)?.[1] || 1);
  return ok.sort((a, b) => v(b.title) - v(a.title) || (Number(b.title.match(/Doc\s*(\d+)/i)?.[1] || 0) - Number(a.title.match(/Doc\s*(\d+)/i)?.[1] || 0)))[0] || null;
}

async function fetchFia(years) {
  const {fiaCall} = await import('../../worker/fia.js');
  const {parseTrackChanges} = await import('../../worker/lapsim/track-changes.js');
  const call = async (name, args) => {
    for (let k = 0; k < 6; k++) {
      try { return JSON.parse((await fiaCall(name, args)).content[0].text); }
      catch (e) { if (!/429|50\d/.test(e.message) || k === 5) throw e; await sleep(15000 * (k + 1)); }
    }
  };
  const readAll = async url => {
    const pages = [];
    for (let start = 1; start < 60;) {
      await sleep(1500);
      const r = await call('fia_read_document', {url, start_page: start, page_count: 5, limit: 16000});
      if (!r.pages?.length) break;
      pages.push(...r.pages.map(p => p.text));
      if (!r.next_page) break;
      start = r.next_page;
    }
    return pages.join('\n');
  };
  const f = join(CACHE, 'fia-notes.json'), out = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  for (const year of years) {
    let index;
    try { index = (await call('fia_list_archive', {year})).records; }
    catch (e) { console.log(`${year}: archive ${e.message}`); continue; }
    for (const id of Object.keys(FIA_EVENTS)) {
      if (out[id]?.[year]?.every(x => !x.error)) continue;
      const list = [];
      for (const ev of index.filter(r => eventsOf(id, year).includes(r.event))) {
        try {
          await sleep(1500);
          const doc = pickNotes(eventDocs(await fiaHtml(ev.url)));
          if (!doc) { console.log(`${id} ${year} ${ev.event}: no notes`); list.push({event: ev.event, document: null, sectionFound: false, changes: []}); continue; }
          const parsed = parseTrackChanges(await readAll(doc.url));
          list.push({event: ev.event, document: {title: doc.title, url: doc.url, published: doc.published}, sectionFound: parsed.sectionFound,
            changes: parsed.changes.map(({source, effect, ...c}) => c)});
          console.log(`${id} ${year} ${ev.event}: ${parsed.changes.length} changes (section ${parsed.sectionFound}) ${doc.title}`);
        } catch (e) { console.log(`${id} ${year} ${ev.event}: ${e.message}`); list.push({event: ev.event, error: e.message, changes: []}); }
      }
      if (list.length) (out[id] ||= {})[year] = list;
      save(f, out);
    }
  }
}

if (cmd === 'fia') await fetchFia(String(arg || '2019,2020,2021,2022').split(',').map(Number));

// ---- TracingInsights qualifying corner minima (one source for every year, prereg section 3) ----
const TI_RAW = join(CACHE, 'ti');
const num = v => v === 'None' || v == null || !Number.isFinite(+v) ? null : +v;
const median = a => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? (s[(s.length - 1) >> 1] + s[s.length >> 1]) / 2 : NaN; };
async function tiGet(year, path) {
  const f = join(TI_RAW, String(year), path);
  if (existsSync(f)) return JSON.parse(readFileSync(f, 'utf8'));
  for (let k = 0; k < 3; k++) {
    try {
      const r = await fetch(`https://raw.githubusercontent.com/TracingInsights/${year}/main/${path.split('/').map(encodeURIComponent).join('/')}`, {signal: AbortSignal.timeout(60000)});
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const t = await r.text(); mkdirSync(dirname(f), {recursive: true}); writeFileSync(f, t); return JSON.parse(t);
    } catch (e) { if (k === 2) throw e; }
  }
}
const SLICK = new Set(['SOFT', 'MEDIUM', 'HARD', 'ULTRASOFT', 'SUPERSOFT', 'HYPERSOFT']);
// Fastest clean dry lap of each of the top 5 drivers; corner minimum speed ±40 m around each corner of that session's corner map
async function tiSession(year, event) {
  const dir = `${event}/Qualifying`, dj = await tiGet(year, `${dir}/drivers.json`), cj = await tiGet(year, `${dir}/corners.json`);
  if (!dj || !cj?.Distance) return null;
  const best = [];
  let rain = 0;
  for (const d of dj.drivers) {
    const lt = await tiGet(year, `${dir}/${d.driver}/laptimes.json`).catch(() => null); if (!lt) continue;
    let b = null;
    lt.time.forEach((t, i) => {
      if (lt.wR?.[i] === true) rain++;
      const lap = num(t);
      if (lap == null || lt.del?.[i] === true || lt.wR?.[i] === true || !SLICK.has(lt.compound?.[i])) return;
      if (!b || lap < b.lap) b = {driver: d.driver, n: lt.lap[i], lap};
    });
    if (b) best.push(b);
  }
  best.sort((a, b) => a.lap - b.lap);
  const refLen = Math.max(...cj.SectionEndDistance || [0]) || null, labels = cj.CornerNumber.map((n, i) => n + (cj.CornerLetter?.[i] || ''));
  const per = {}; let used = 0;
  for (const b of best.slice(0, 5)) {
    const tel = (await tiGet(year, `${dir}/${b.driver}/${b.n}_tel.json`).catch(() => null))?.tel; if (!tel?.distance?.length) continue;
    const L = tel.distance.at(-1), scale = refLen ? L / refLen : 1; used++;
    labels.forEach((k, i) => {
      const c = cj.Distance[i] * scale; let v = Infinity;
      for (let j = 0; j < tel.distance.length; j++) if (Math.abs(tel.distance[j] - c) <= 40 && Number.isFinite(tel.speed[j])) v = Math.min(v, tel.speed[j]);
      if (Number.isFinite(v)) (per[k] ||= []).push(v);
    });
  }
  return {event, layoutYear: cj.LayoutYear ?? null, laps: used, poleLap: best[0]?.lap ?? null, rainLaps: rain,
    corners: Object.fromEntries(Object.entries(per).map(([k, a]) => [k, {v: median(a), n: a.length, spread: median(a.map(x => Math.abs(x - median(a))))}]))};
}
async function fetchTi(years) {
  const f = join(CACHE, 'corners.json'), out = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
  for (const year of years) {
    for (const id of Object.keys(FIA_EVENTS)) {
      if (out[id]?.[year]) continue;
      for (const name of eventsOf(id, year)) {
        const s = await tiSession(year, name).catch(e => (console.log(`${id} ${year} ${name}: ${e.message}`), null));
        if (s?.laps) { (out[id] ||= {})[year] = s; console.log(`${id} ${year} ${name}: ${s.laps} laps, ${Object.keys(s.corners).length} corners, layout ${s.layoutYear}`); break; }
      }
    }
    save(f, out);
  }
}
if (cmd === 'ti') await fetchTi(String(arg || '2018,2019,2020,2021,2022,2023,2024,2025,2026').split(',').map(Number));

// ---- altitude: Open-Meteo elevation API (Copernicus DEM GLO-90) at the track coordinates of track-coords.js ----
async function fetchAltitude() {
  const {TRACK_LL} = await import('../../worker/lapsim/track-coords.js');
  const ids = Object.keys(TRACK_LL), out = {};
  for (let i = 0; i < ids.length; i += 50) {
    const part = ids.slice(i, i + 50), q = part.map(id => TRACK_LL[id]);
    const url = `https://api.open-meteo.com/v1/elevation?latitude=${q.map(x => x[0]).join(',')}&longitude=${q.map(x => x[1]).join(',')}`;
    const r = await (await fetch(url, {signal: AbortSignal.timeout(30000)})).json();
    part.forEach((id, k) => { out[id] = {m: r.elevation[k], lat: TRACK_LL[id][0], lon: TRACK_LL[id][1]}; });
  }
  save(join(CACHE, 'altitude.json'), {source: 'Open-Meteo elevation API (Copernicus DEM GLO-90, 90 m), at worker/lapsim/track-coords.js', url: 'https://open-meteo.com/en/docs/elevation-api', retrieved: new Date().toISOString().slice(0, 10), tracks: out});
  console.log(Object.keys(out).length, 'altitudes');
}
if (cmd === 'alt') await fetchAltitude();

// ---- hand-entered events (official FIA, series or circuit pages only; each with URL and the date it was read) ----
// year = the first event run on the new layout or surface.
const READ = '2026-11-23';
const src = (url, published, note) => ({url, published, read: READ, note});
export const LAYOUT = {
  catalunya: [{year: 2021, ...src('https://www.formula1.com/en/latest/article/circuit-de-barcelona-catalunya-complete-remodelling-of-turn-10.giY8HxbKVmtub2ZjyvI1B', '2021-01', 'Turn 10 remodelled')},
    {year: 2023, ...src('https://www.fia.com/news/fia-homologates-updated-layout-2023-fia-formula-1-spanish-grand-prix', '2023-02-27', 'final chicane (T14–T15) removed')}],
  melbourne: [{year: 2022, ...src('https://www.grandprix.com.au/community/circuit-modifications', null, 'geometric circuit modifications (AGPC)')}],
  'yas-marina-circuit': [{year: 2021, ...src('https://www.formula1.com/en/latest/article/revealed-the-track-changes-aimed-at-improving-overtaking-at-abu-dhabis-yas.rejS8Xxbgoom5yPUInsek', '2021-06-24', 'reconfigured (hairpin, T17–T20 radii)')}],
  // step 25 (2026-11-24): FIA Race Director's notes, "Changes to the Circuit"; the geometry (2025/2026 positions) is the later layout
  jeddah: [{year: 2023, ...src("https://www.fia.com/sites/default/files/decision-document/2023%20Saudi%20Arabian%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V3.pdf", null, 'T22 starts ~10 m later, T23 moved ~5 m ("the only layout modification", p6)'), read: '2026-11-24'}],
  miami: [{year: 2023, ...src("https://www.fia.com/sites/default/files/decision-document/2023%20Miami%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes%20V2.pdf", null, '"Adjusted layout of Turn 15" (p6)'), read: '2026-11-24'}],
  singapore: [{year: 2023, ...src('https://www.formula1.com/en/latest/article/singapore-grand-prix-set-to-feature-revised-track-layout-in-2023.6KsrU6hQw3hxrVJ6zKeJ74', '2022-10', 'T16–T19 replaced by a straight')}],
};
export const FULL = {
  catalunya: [{year: 2018, ...src('https://www.formula1.com/en/latest/article/re-laid-surface-brings-unknown-factor-to-silverstone-weekend.28wPQFNnViY78S1PZarW9j', '2019-07', 'Barcelona resurfaced in 2018 (named in the article)')}],
  silverstone: [{year: 2019, ...src('https://www.formula1.com/en/latest/article/re-laid-surface-brings-unknown-factor-to-silverstone-weekend.28wPQFNnViY78S1PZarW9j', '2019-07', 'entire track resurfaced again')}],
  melbourne: [{year: 2022, ...src('https://www.grandprix.com.au/community/circuit-modifications', null, 'first resurfacing since 1995, part of the modifications project')}],
  lusail: [{year: 2023, ...src('https://www.motogp.com/en/news/2023/08/24/ein-blick-auf-das-renovierte-lusail/476496', '2023-08-24', 'resurfaced track (series page)')}],
  miami: [{year: 2023, ...src('https://www.formula1.com/en/latest/article.track-to-be-resurfaced-and-paddock-moved-inside-hard-rock-stadium-for-2023.1Oei1J5s4KM2IDWY1YhTdC.html', '2023-01-18', 'track to be resurfaced for 2023')}],
  monza: [{year: 2024, ...src('https://www.formula1.com/en/latest/article/need-to-know-the-most-important-facts-stats-trivia-2024-italian-grand-prix.1aWNaICxFMmzFSmKBuOZBg', '2024-08-29', 'new asphalt (Pirelli preview quoted by F1)')}],
  shanghai: [{year: 2025, ...src('https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-the-shanghai-international.1b0f0ghbsPMRsHJoHTt6eB', null, 'resurfaced ahead of the 2025 event (2024: sealant only)')}],
  'laguna-seca': [{year: 2024, ...src('https://imsa.com/news/2024/may/06/when-old-becomes-new-imsa-approaching-spate-of-new-track-surfaces', '2024-05-06', 'full resurfacing after the 2023 IMSA weekend, first since 2006/07')}],
  'road-america': [{year: 2023, ...src('https://www.indycar.com/news/2022/11/11-15-ra-repave', '2022-11-15', 'entire 4.048-mile course repaved Oct–Nov 2022')}],
  'mid-ohio': [{year: 2024, ...src('https://www.midohio.com/news-m/938-full-repave-of-racing-surface-completed-at-mid-ohio-sports-car-course', '2023-10-31', 'full repave of the racing surface, Oct 2023')}],
};
// street circuit (public roads or a temporary street-type track): one team page lists them; others unknown
const STREET_SRC = 'https://www.williamsf1.com/articles/b0625f34-0ae6-4aec-a00a-34d327bce4b6/explained-why-f1-has-more-street-circuits-than-ever-before';
export const STREET = {jeddah: 1, melbourne: 1, baku: 1, miami: 1, 'monte-carlo': 1, singapore: 1, 'las-vegas': 1};
export const SELECTABLE_TYPES = ['layout', 'full_resurfacing'];

// FIA full-lap resurfacing: a resurfacing item with no corner reference that says the whole circuit
const FULL_RE = /\b(?:entire|whole|full|complete)(?:ly)?\s+(?:circuit|track|lap|racing surface)|(?:circuit|track)\s+(?:has been\s+|was\s+)?(?:completely|fully|entirely)\s+re-?surfaced/i;
export const isFullResurfacing = c => c.type === 'resurfacing' && !(c.corners || []).length && FULL_RE.test(c.text);
const lapTypes = ['kerb_raised', 'kerb_lowered', 'kerb_changed', 'resurfacing', 'bump_removal'];

function notesFor(id, year, fetched, stored) {
  const s = stored[id]?.[year];
  if (s?.sectionFound) return {source: 'track-changes-data.js', sectionFound: true, document: s.document, changes: s.changes || []};
  const f = (fetched[id]?.[year] || []).filter(x => !x.error);
  if (f.some(x => x.sectionFound)) {
    const seen = new Set(), changes = [];
    for (const x of f) for (const c of x.changes) if (!seen.has(c.text)) { seen.add(c.text); changes.push({...c, document: x.document?.url}); }
    return {source: 'fia (2019–2026 read, step 5a)', sectionFound: true, document: f.find(x => x.sectionFound).document, changes};
  }
  if (s || f.length) return {source: s ? 'track-changes-data.js' : 'fia (step 5a)', sectionFound: false, document: s?.document || f[0]?.document || null, changes: []};
  return null;
}

export function buildRegistry({fetched = {}, stored = {}, ti = {}, ids, years = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]}) {
  const reg = {};
  for (const id of ids) {
    const tr = {years: {}, coverage: 'no-history', layoutEras: [], fullResurfacings: FULL[id] || []};
    for (const y of years) {
      // raced = a TI qualifying exists; notes alone only for tracks TI never covers (2020 Melbourne notes were issued, the event was cancelled)
      const notes = notesFor(id, y, fetched, stored), raced = ti[id] ? !!ti[id][y] : !!notes;
      const lay = (LAYOUT[id] || []).find(e => e.year === y), full = (FULL[id] || []).find(e => e.year === y);
      const fiaFull = (notes?.changes || []).find(isFullResurfacing);
      if (!raced && !lay && !full) continue;
      tr.years[y] = {
        raced,
        layoutChange: lay ? {value: true, source: lay} : {value: false, source: notes?.sectionFound ? 'FIA notes list no layout change' : null},
        fullResurfacing: full ? {value: true, source: full} : fiaFull ? {value: true, source: {url: notes.document?.url || null, note: fiaFull.text, read: READ}} : {value: false, source: null},
        partialChanges: (notes?.changes || []).filter(c => !isFullResurfacing(c)).map(c => ({type: c.type, corners: c.corners, text: c.text})),
        notes: notes ? {source: notes.source, sectionFound: notes.sectionFound, url: notes.document?.url || null} : null,
        coverage: notes?.sectionFound ? 'fia-documented' : lay || full ? 'hand-entered' : 'no-history',
      };
    }
    const ys = Object.values(tr.years);
    tr.coverage = ys.some(x => x.coverage === 'fia-documented') ? 'fia-documented' : ys.some(x => x.coverage === 'hand-entered') || FULL[id] || LAYOUT[id] ? 'hand-entered' : 'no-history';
    tr.layoutEras = [...new Set([0, ...(LAYOUT[id] || []).map(e => e.year)])].sort((a, b) => a - b);
    reg[id] = tr;
  }
  return reg;
}
export const eraOf = (reg, id, year) => (reg[id]?.layoutEras || [0]).filter(e => e <= year).at(-1) ?? 0;

// year pairs: consecutive raced years (F1) or the hand-entered change years (other series); selectable only with a layout change
// or a full resurfacing that has a source
export function yearPairs(reg) {
  const out = [];
  for (const [id, tr] of Object.entries(reg)) {
    const raced = Object.entries(tr.years).filter(([, e]) => e.raced).map(([y]) => +y).sort((a, b) => a - b);
    const pairs = raced.slice(1).map((y, i) => [raced[i], y]);
    for (const e of [...(LAYOUT[id] || []), ...(FULL[id] || [])]) if (!raced.includes(e.year)) pairs.push([null, e.year]);
    for (const [a, b] of pairs) {
      const e = tr.years[b], why = [];
      if (e?.layoutChange.value) why.push('layout');
      if (e?.fullResurfacing.value) why.push('full_resurfacing');
      out.push({track: id, from: a, to: b, selectable: why.length > 0 && why.every(w => w === 'layout' ? !!e.layoutChange.source?.url : !!e.fullResurfacing.source?.url), why, info: e?.partialChanges.length || 0});
    }
  }
  return out;
}

// ---- change effects with the extended years (read-only copy of the change-effects.mjs logic on TI corner minima) ----
const lcg = seed => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
// same resampling as gate.mjs clusterBootstrap (circuits, then cases inside), statistic = median (prereg section 2)
export function clusterMedianCI(rows, {iters = 4000, seed = 1} = {}) {
  const by = new Map(); for (const r of rows) { if (!by.has(r.id)) by.set(r.id, []); by.get(r.id).push(r.lnr); }
  const G = [...by.values()], rand = lcg(seed), b = [];
  for (let k = 0; k < iters && G.length; k++) { const pick = []; for (let i = 0; i < G.length; i++) { const g = G[Math.floor(rand() * G.length)]; for (let j = 0; j < g.length; j++) pick.push(g[Math.floor(rand() * g.length)]); } b.push(median(pick)); }
  b.sort((x, y) => x - y);
  return {n: rows.length, circuits: G.length, median: median(rows.map(r => r.lnr)), ci90: b.length ? [b[Math.floor(0.05 * b.length)], b[Math.floor(0.95 * b.length) - 1]] : [NaN, NaN]};
}
export function changeCases(reg, ti) {
  const cases = [], skipped = [];
  const dry = s => s && s.laps >= 2 && !s.rainLaps;
  for (const [id, tr] of Object.entries(reg)) {
    const years = Object.keys(tr.years).map(Number).sort((a, b) => a - b);
    for (const y of years) {
      const ch = tr.years[y].partialChanges.filter(c => lapTypes.includes(c.type) && c.corners?.length);
      if (!ch.length) continue;
      const now = ti[id]?.[y], era = eraOf(reg, id, y);
      const prevY = Object.keys(ti[id] || {}).map(Number).filter(p => p < y).sort((a, b) => b - a)[0];
      const before = prevY && ti[id][prevY];
      const why = !now ? 'no TI session' : !prevY ? 'no earlier TI session' : eraOf(reg, id, prevY) !== era ? 'layout change between years'
        : !dry(now) || !dry(before) ? 'wet or < 2 clean laps' : (now.layoutYear && eraOf(reg, id, now.layoutYear) !== era) || (before.layoutYear && eraOf(reg, id, before.layoutYear) !== era) ? 'corner map from another layout' : null;
      if (why) { skipped.push({id, year: y, n: ch.length, why}); continue; }
      const touched = new Set(tr.years[y].partialChanges.flatMap(c => c.corners || []));
      const ratio = k => now.corners[k] && before.corners[k] ? now.corners[k].v / before.corners[k].v : NaN;
      const control = median(Object.keys(now.corners).filter(k => !touched.has(k)).map(ratio));
      const mad = median(Object.keys(now.corners).filter(k => !touched.has(k)).map(k => Math.abs(ratio(k) - control)));
      if (!Number.isFinite(control)) { skipped.push({id, year: y, n: ch.length, why: 'no control corners'}); continue; }
      for (const c of ch) {
        const r = median(c.corners.map(ratio)) / control;
        if (Number.isFinite(r) && Math.abs(r - 1) < 0.1) cases.push({id, year: y, prev: prevY, type: c.type, corners: c.corners, r, lnr: Math.log(r), floor: mad, text: c.text});
        else skipped.push({id, year: y, n: 1, why: Number.isFinite(r) ? '|r − 1| ≥ 0.1' : 'corner not in TI map'});
      }
    }
  }
  return {cases, skipped};
}
export const DEFAULTS = {resurfacing: {kind: 'grip', factor: 1.02}, bump_removal: {kind: 'grip', factor: 1.01}, kerb_lowered: {kind: 'cornerSpeed', factor: 1.005}, kerb_raised: {kind: 'cornerSpeed', factor: 0.995}};
export function effectTable(cases) {
  const out = {};
  for (const t of lapTypes) {
    const rows = cases.filter(c => c.type === t); if (!rows.length) { out[t] = {n: 0}; continue; }
    const ci = clusterMedianCI(rows), d = DEFAULTS[t], dSpeed = d ? Math.log(d.kind === 'grip' ? Math.sqrt(d.factor) : d.factor) : null;
    const enters = ci.n >= 10 && (ci.ci90[0] > 0 || ci.ci90[1] < 0);
    out[t] = {...ci, medianPct: (Math.exp(ci.median) - 1) * 100, ci90Pct: ci.ci90.map(x => (Math.exp(x) - 1) * 100), floorPct: median(rows.map(r => r.floor)) * 100,
      defaultSpeedPct: dSpeed == null ? null : (Math.exp(dSpeed) - 1) * 100,
      defaultSignContradicts: dSpeed != null && Math.sign(dSpeed) !== Math.sign(ci.median) && ci.median !== 0,
      rule: enters ? 'enters (n ≥ 10, interval excludes 0)' : ci.n < 10 ? 'strength 0 (n < 10)' : 'strength 0 (interval includes 0)'};
  }
  return out;
}

// ---- build: registry, pairs, effects, covariates, docs ----
const pct = (x, d = 2) => Number.isFinite(x) ? (x >= 0 ? '+' : '') + x.toFixed(d) + ' %' : '–';
async function build() {
  const {lapsimAllTracks} = await import('../../worker/lapsim/tracks.js');
  const {lapsimTrackChanges: stored} = await import('../../worker/lapsim/track-changes-data.js');
  const rd = (f, d) => existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : d;
  const fetched = rd(process.env.TRACK_STATE_FIA || join(CACHE, 'fia-notes.json'), {}), ti = rd(join(CACHE, 'corners.json'), {}), alt = rd(process.env.TRACK_STATE_ALT || join(CACHE, 'altitude.json'), null);
  const ids = [...new Set([...Object.keys(lapsimAllTracks), ...Object.keys(FULL), ...Object.keys(LAYOUT)])].sort();
  const reg = buildRegistry({fetched, stored, ti, ids}), pairs = yearPairs(reg);
  const {cases, skipped} = changeCases(reg, ti), effects = effectTable(cases);
  // covariates: one row per F1 track and raced season
  const rows = [];
  for (const [id, tr] of Object.entries(reg)) for (const [y, e] of Object.entries(tr.years)) {
    if (!e.raced) continue;
    const fulls = [...(FULL[id] || []).map(f => ({year: f.year, url: f.url})), ...Object.entries(tr.years).filter(([, x]) => x.fullResurfacing.value && x.fullResurfacing.source?.url).map(([yy, x]) => ({year: +yy, url: x.fullResurfacing.source.url}))]
      .filter(f => f.year <= +y).sort((a, b) => b.year - a.year);
    const last = fulls[0] || null, on2023 = ti[id]?.[2023] || stored[id]?.[2023] || fetched[id]?.[2023];
    rows.push({track: id, season: +y,
      lastFullResurfacing: last?.year ?? 'unknown', surfaceAgeYears: last ? +y - last.year : 'unknown', firstYearOnNewSurface: last ? last.year === +y : 'unknown', surfaceSrc: last?.url ?? null,
      street: STREET[id] ? 1 : on2023 ? 0 : 'unknown', streetSrc: STREET[id] || on2023 ? STREET_SRC : null,
      altitudeM: alt?.tracks?.[id]?.m ?? 'unknown', altitudeSrc: alt?.tracks?.[id] ? `${alt.url} (${alt.source}; read ${alt.retrieved})` : null,
      layoutEra: eraOf(reg, id, +y) || 'first in range', coverage: e.coverage});
  }
  rows.sort((a, b) => a.track.localeCompare(b.track) || a.season - b.season);
  writeFileSync('scripts/sim/data/track-covariates.json', JSON.stringify({generated: READ, prereg: 'Project claude/gate-track-state-prereg-2026-11-23.md',
    notes: 'One row per F1 track and raced season 2019–2026. Unknown = "unknown"; every known cell has its source URL. Surface age counts from the first event on the last full resurfacing found (FIA notes or an official page); no source found = unknown, not "opening year". street = listed as a street circuit in the source; 0 = on the 2023 calendar and not listed (definition of that source; Montreal counted 0).',
    rows}, null, 1) + '\n');
  // registry for the worker: compact
  const compact = Object.fromEntries(Object.entries(reg).map(([id, tr]) => [id, {coverage: tr.coverage, layoutEras: tr.layoutEras.filter(Boolean), years: Object.fromEntries(Object.entries(tr.years).map(([y, e]) => [y, {
    raced: e.raced, layoutChange: e.layoutChange.value, layoutSrc: e.layoutChange.source?.url || null, fullResurfacing: e.fullResurfacing.value, fullSrc: e.fullResurfacing.source?.url || null,
    partialChanges: e.partialChanges, notes: e.notes?.url || null, coverage: e.coverage}]))}]));
  const effOut = Object.fromEntries(Object.entries(effects).map(([t, v]) => [t, v.n ? {n: v.n, circuits: v.circuits, medianSpeedPct: +v.medianPct.toFixed(3), ci90SpeedPct: v.ci90Pct.map(x => +x.toFixed(3)), defaultSpeedPct: v.defaultSpeedPct == null ? null : +v.defaultSpeedPct.toFixed(3), defaultSignContradicts: v.defaultSignContradicts, rule: v.rule} : {n: 0, rule: 'strength 0 (n < 10)'}]));
  writeFileSync('worker/lapsim/track-state-data.js', `// Generated by scripts/sim/track-state.mjs (step 5a, Project claude/gate-track-state-prereg-2026-11-23.md). Do not edit by hand.\n// Registry of track state per year (2019–2026): layout change, full resurfacing (with source), partial changes from the FIA notes, coverage.\n// selectablePairs: year pairs worth a year selector (layout change or full resurfacing with a source); every other pair is information only.\n// effects: descriptive corner-speed effects per change type (TI qualifying top 5); not used in any lap. The gate runs in step 5b.\nexport const lapsimTrackState=${JSON.stringify({generated: READ, tracks: compact, selectablePairs: pairs.filter(p => p.selectable).map(({track, from, to, why}) => ({track, from, to, why})), effects: effOut})};\n`);
  // doc
  const cov = {}; for (const tr of Object.values(reg)) cov[tr.coverage] = (cov[tr.coverage] || 0) + 1;
  const f1 = Object.entries(reg).filter(([, tr]) => Object.values(tr.years).some(e => e.raced));
  const covF1 = {}; for (const [, tr] of f1) covF1[tr.coverage] = (covF1[tr.coverage] || 0) + 1;
  const sel = pairs.filter(p => p.selectable), info = pairs.filter(p => !p.selectable);
  const L = [];
  L.push('# Track-state registry (step 5a, 2026-11-23)', '',
    'Generated by `node scripts/sim/track-state.mjs build` → `worker/lapsim/track-state-data.js`, `scripts/sim/data/track-covariates.json`.',
    'Pre-registration: Project `claude/gate-track-state-prereg-2026-11-23.md` (ledger row "2026-11-23 | 5a"). No lap changes: nothing reads the registry yet.', '',
    '## Sources', '',
    '- FIA Race Director\'s Event / Competition Notes, "Changes to the circuit", 2019–2026: the stored list (`track-changes-data.js`, read-only) where it found the section, otherwise the notes read by this script (same parser, `parseTrackChanges`, read-only). The 2019–2021 file names contain an apostrophe, which `worker/fia.js` cuts from the link; this script reads the event page itself.',
    '- Layout changes and full resurfacings: FIA, series (formula1.com, motogp.com, imsa.com, indycar.com) or circuit pages only, each with URL and date read (`LAYOUT`, `FULL` in the script). Nothing from memory.',
    '- A full resurfacing in the FIA notes counts only when the item names no corner and says the whole circuit or track.',
    '- Corner minimum speeds: TracingInsights qualifying (FastF1), the fastest clean dry lap of the top 5, corners from that session\'s `corners.json`.', '',
    '## Coverage', '', '| Label | All tracks | F1 tracks (raced 2019–2026) |', '|---|---|---|');
  for (const k of ['fia-documented', 'hand-entered', 'no-history']) L.push(`| ${k} | ${cov[k] || 0} | ${covF1[k] || 0} |`);
  L.push('', `Per track: ${Object.entries(reg).filter(([, t]) => t.coverage !== 'no-history').map(([id, t]) => `${id} (${t.coverage})`).join(', ')}. Every other track: no-history.`, '',
    '## Year pairs worth a year selector', '', 'A pair is selectable only with a layout change or a full resurfacing that has a source. Default year rule: see the spec below.', '',
    '| Track | From | To | Why | Source |', '|---|---|---|---|---|');
  for (const p of sel) { const e = reg[p.track].years[p.to]; L.push(`| ${p.track} | ${p.from ?? '–'} | ${p.to} | ${p.why.join(', ')} | ${[e.layoutChange.source?.url, e.fullResurfacing.source?.url].filter(x => typeof x === 'string').map(u => `[link](${u})`).join(' ')} |`); }
  L.push('', `Information only: every other pair (${info.length} pairs, ${info.filter(p => p.info).length} with partial FIA changes: kerbs, patches, run-off). They are listed in \`track-state-data.js\` (\`tracks.<id>.years\`).`, '',
    '## Change effects with 2019–2026 (descriptive, prereg section 2 rule)', '',
    `${cases.length} cases on ${new Set(cases.map(c => c.id)).size} circuits; ${skipped.length} change-years skipped (${Object.entries(skipped.reduce((m, s) => (m[s.why] = (m[s.why] || 0) + 1, m), {})).map(([k, v]) => `${k} ${v}`).join(', ')}).`,
    'Corner-speed effect = median over cases of v_min(changed)/v_min(prev) ÷ control corners; 90 % interval: cluster bootstrap by circuit (4000 draws, seed 1). Floor = median absolute deviation of the control corners.', '',
    '| Type | n | Circuits | Median corner speed | 90 % interval | Floor | Default (as corner speed) | Default sign wrong | Rule |', '|---|---|---|---|---|---|---|---|---|');
  for (const [t, v] of Object.entries(effects)) L.push(v.n ? `| ${t} | ${v.n} | ${v.circuits} | ${pct(v.medianPct)} | ${pct(v.ci90Pct[0])} … ${pct(v.ci90Pct[1])} | ±${v.floorPct.toFixed(2)} % | ${v.defaultSpeedPct == null ? '–' : pct(v.defaultSpeedPct)} | ${v.defaultSpeedPct == null ? '–' : v.defaultSignContradicts ? 'yes' : 'no'} | ${v.rule} |` : `| ${t} | 0 | – | – | – | – | – | – | strength 0 |`);
  L.push('', 'These numbers decide nothing: the gate (candidates C1–C3 against strength 0, leave-one-track-out) runs in step 5b after step 1 merges.', '',
    '## Default-year rule for /simulation (spec only, owner)', '',
    '1. The track state shown is the selected car\'s own season (a 2025 car runs on the 2025 track; a car with no season on this track uses the latest raced year).',
    '2. Another year is selectable only for the pairs in the table above (layout change or sourced full resurfacing). The selector lists those years only.',
    '3. Every other change (kerbs, patches, bumps, run-off) is information only: listed with its FIA line, no lap effect, until a type passes the step-5b gate.',
    '4. A layout year changes the geometry (step 3 owns it). A full-resurfacing year changes only grip, through the change hook, and only with a gated factor; until then it is labelled "information only".',
    '5. Labels: coverage per track (fia-documented / hand-entered / no-history) shown next to the selector; no-history tracks show "no recorded changes", never "no changes".', '');
  writeFileSync('docs/lapsim-track-state.md', L.join('\n'));
  console.log(JSON.stringify({coverage: cov, coverageF1: covF1, selectable: sel.map(p => `${p.track} ${p.from ?? '–'}→${p.to} (${p.why.join('+')})`), effects: effOut, cases: cases.length, skipped: skipped.length}, null, 1));
}
if (cmd === 'build') await build();
