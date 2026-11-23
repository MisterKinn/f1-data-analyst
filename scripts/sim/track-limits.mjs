// Track-limit catalogue (step 4a, data only): reads the "Track limits" text in the FIA F1 Race Director's
// Event / Competition Notes and stores, per track and year, the corners where track limits apply and how they
// are judged (white line, kerb edge, detection loop, other). No lap uses this yet (step 4b).
// Run: node scripts/sim/track-limits.mjs            fetch 2019–2026 from fia.com (needs network)
//      node scripts/sim/track-limits.mjs --reparse  re-parse the stored raw section text only
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {cornerRefs} from '../../worker/lapsim/track-changes.js';

// "17. | Track Limits", "9.4 | Track limits at Turn 4" or an unnumbered "Track Limits" line
const HEAD = /^\s*(?:(\d{1,2})(\.\d{1,2})?[.)]?\s+[^\n]{0,40}\btrack[- ]limits?\b[^\n]{0,60}|Track[- ]limits?\b[^\n.]{0,50})$/i;
const SUB = /^\s*\d{1,2}\.\d{1,2}\.?\s*\|?\s*[A-Z]/;
const NEXT = /^\s*(\d{1,2})[.)]\s*\|?\s*[A-Z“"][^\n]{2,90}$/;
const ALL = /\ball (?:the )?(?:corners|turns)\b|\bentire (?:circuit|track)\b|\bthroughout the (?:circuit|lap)\b|\bat every corner\b/i;
const EDGES = /\b(?:white|yellow) lines?\b[^.]{0,40}\b(?:define|are)\b[^.]{0,20}\btrack edges?\b/i;
const PLACE = /\b(?:corner|kerb|curb|exit|entry|apex|bollard|chicane|hairpin|loop|sausage)\b/i;

const RANK = {loop: 0, kerb: 1, line: 2, other: 3};
const KERB_CUT = /\b(?:passes|cut(?:ting)?|goes)\b[^.]{0,30}\b(?:completely\s+)?(?:behind|to the (?:left|right) of|outside)\b[^.]{0,40}\bkerb/i;
const REJOIN = /bollard|\bblock\b|polystyrene|re-?join|escape road|\broad\b|leads? back/i;
// rule type of one sentence; a loop or kerb edge is more specific than "white line"
export function ruleOf(s) {
  // "passes completely behind / to the left of the ... kerb, must re-join ...": the kerb is the limit, the rejoin is the procedure
  if (/\bloops?\b|timing line|detection (?:line|system)/i.test(s)) return 'loop';
  if (KERB_CUT.test(s)) return 'kerb';
  // where to rejoin after missing a corner (bollards, blocks, escape roads) is a procedure, not an edge
  if (REJOIN.test(s)) return 'other';
  if (/\bkerbs?\b|\bcurbs?\b/i.test(s) && !/\bwhite lines?\b[^.]*\bnot\b[^.]*\bkerb/i.test(s)) return 'kerb';
  if (/\b(?:white|yellow) lines?\b|\btrack edge|\bedges? of the track/i.test(s)) return 'line';
  return 'other';
}

// Track-limit sections of one notes text (pages joined with newlines, cells joined with " | ").
export function trackLimitSections(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.replace(/\s*\|\s*/g, ' ')), out = [];
  for (let i = 0; i < lines.length; i++) {
    const h = lines[i].match(HEAD);
    // a heading is short and is not a sentence ending in a full stop
    if (!h || lines[i].length > 110 || /\.\s*$/.test(lines[i])) continue;
    const own = Number(h[1] || 0), sub = !!h[2], body = [lines[i].replace(/\s*\|\s*/g, ' ').trim()];
    let j = i + 1;
    for (; j < lines.length; j++) {
      const n = lines[j].match(NEXT);
      if (n && (!own || Number(n[1]) !== own)) break;
      if (sub && SUB.test(lines[j])) break;
      if (/^\s*(?:\d{1,3}|\[page \d+\])\s*$/.test(lines[j])) continue; // page number or page marker
      body.push(lines[j].replace(/\s*\|\s*/g, ' ').trim());
    }
    out.push(body.filter(Boolean).join(' '));
    i = j - 1;
  }
  return out;
}

// Corners, rules and unparsed lines from the sections' text.
export function parseTrackLimits(sections) {
  const corners = [], unparsed = [], seen = new Map();
  let allCorners = false;
  // "the white lines define the track edges" (Article 33.3 SR) is the rule for every corner without its own mechanism
  const general = sections.some(s => EDGES.test(s)) ? 'line' : null;
  const sentences = sections.map(s => s.replace(/\s*\[page \d+\]\s*/g, ' ')).flatMap(s => s.split(/(?<=[a-z0-9)”"])\.\s+(?=[A-Z“"(])|\s+(?=\d{1,2}\.\d{1,2}\.?\s+[A-Z])|\s+(?=[a-h]\)\s)/)).map(s => s.trim()).filter(Boolean);
  for (const s of sentences) {
    if (ALL.test(s) || EDGES.test(s)) allCorners = true;
    // "turns 18 or and 19": cornerRefs joins lists with "and", not "or"
    const refs = cornerRefs(s.replace(/(\d)\s+or(?:\s+and)?\s+(?=\d)/gi, '$1 and '));
    if (!refs.length) { if (PLACE.test(s) && !ALL.test(s)) unparsed.push(s); continue; }
    if (s.length < 40 && !PLACE.test(s.replace(/\bexit\b/i, ''))) continue; // sub-heading such as "21.1 Turn 9 – Exit"
    let rule = ruleOf(s);
    if (rule === 'other' && general && !REJOIN.test(s)) rule = general;
    // in "Run-off in Turn 1-2-3 Any driver who fails to negotiate Turn 2 ... passes behind the kerb ... re-join at
    // Turn 3" the kerb belongs to the turns named between "driver" and the cut; the others are rejoin points or headings
    const cut = rule === 'kerb' && REJOIN.test(s) ? s.search(KERB_CUT) : -1;
    const from = cut >= 0 ? s.slice(0, cut).search(/\bdrivers?\b(?!.*\bdrivers?\b)/i) : -1;
    const owners = cut >= 0 ? refs.filter(r => r.index > from && r.index < cut) : [];
    // one record per corner: the most specific mechanism named for it wins (loop > kerb > line > other)
    for (const r of refs) {
      const key = r.turn + r.letter, had = seen.get(key), rr = owners.length && !owners.includes(r) ? 'other' : rule;
      if (had && RANK[had.rule] <= RANK[rr]) continue;
      const c = {turn: r.turn, ...(r.letter ? {letter: r.letter} : {}), rule: rr, text: s.slice(0, 400)};
      if (had) Object.assign(had, c); else { seen.set(key, c); corners.push(c); }
    }
  }
  corners.sort((a, b) => a.turn - b.turn || (a.letter || '').localeCompare(b.letter || ''));
  return {corners, allCorners, generalRule: general, unparsed};
}

// lines around "track limit" mentions, kept when no section was found so the format can be checked by hand
export function limitHits(text) {
  const lines = String(text || '').split(/\r?\n/);
  return lines.flatMap((l, i) => /track[- ]limit/i.test(l) ? [lines.slice(Math.max(0, i - 1), i + 3).join(' / ')] : []).slice(0, 8).map(x => x.slice(0, 400));
}

export function entryFrom(meta, sections) {
  const p = parseTrackLimits(sections);
  const status = !meta.doc ? 'no document' : p.corners.length || p.allCorners ? 'parsed' : 'unparsed';
  return {track: meta.track, year: meta.year, series: 'f1', event: meta.event || null, status, ...p,
    doc: meta.doc || null, sectionFound: sections.length > 0, raw: sections.join('\n').slice(0, 6000), ...(meta.hits?.length ? {hits: meta.hits} : {})};
}

// Simulator track → FIA event names (2019–2026). Sakhir GP 2020 used the outer loop: kept, flagged by its name.
export const EVENTS = {
  sakhir: [/^Bahrain Grand Prix$/i, /^Sakhir Grand Prix$/i], jeddah: [/^Saudi Arabian Grand Prix$/i],
  imola: [/^Emilia Romagna Grand Prix$/i], interlagos: [/^(?:Brazilian|S[aã]o Paulo) Grand Prix$/i],
  'las-vegas': [/^Las Vegas Grand Prix$/i], lusail: [/^Qatar Grand Prix$/i], 'yas-marina-circuit': [/^Abu Dhabi Grand Prix$/i],
  melbourne: [/^Australian Grand Prix$/i], shanghai: [/^Chinese Grand Prix$/i], suzuka: [/^Japanese Grand Prix$/i],
  miami: [/^Miami Grand Prix$/i], montreal: [/^Canadian Grand Prix$/i], 'monte-carlo': [/^Monaco Grand Prix$/i],
  catalunya: [/^Spanish Grand Prix$/i, /^Barcelona-Catalunya Grand Prix$/i], spielberg: [/^Austrian Grand Prix$/i, /^Styrian Grand Prix$/i],
  silverstone: [/^British Grand Prix$/i, /^70th Anniversary Grand Prix$/i], 'spa-francorchamps': [/^Belgian Grand Prix$/i],
  hungaroring: [/^Hungarian Grand Prix$/i], zandvoort: [/^Dutch Grand Prix$/i], monza: [/^Italian Grand Prix$/i],
  madring: [/^Spanish Grand Prix$/i], baku: [/^Azerbaijan Grand Prix$/i], 'kuala-lumpur': [/^Bahrain Grand Prix$/i],
  singapore: [/^Singapore Grand Prix$/i], austin: [/^United States Grand Prix$/i], 'mexico-city': [/^Mexic(?:an|o City) Grand Prix$/i],
};
// 2026: the Spanish GP moved to Madring and the Bahrain GP ran at Sepang (worker/lapsim/names.js)
export function tracksFor(event, year) {
  return Object.entries(EVENTS).filter(([id, res]) => res.some(r => r.test(event))
    && !(id === 'madring' && year !== 2026) && !(id === 'catalunya' && year === 2026 && /^Spanish/i.test(event))
    && !(id === 'kuala-lumpur' && year !== 2026) && !(id === 'sakhir' && year === 2026)).map(([id]) => id);
}

const NOTES = /race director[’'s]*\s+(?:event|competition) notes|^(?:doc \d+ - )?(?:event|competition) notes(?: v\d+)?$|track limits?/i;
const rank = d => (/race director/i.test(d.title) ? 0 : /track limit/i.test(d.title) ? 1 : 2) * 100 - Number(d.title.match(/\b(?:V|Version\s*)(\d+)\b/i)?.[1] || 1);

// shortcut: worker/fia.js parseDocuments cuts a double-quoted href at an apostrophe ("Race Director's ..."),
// so the event page is read again here with quote-paired hrefs; drop this when fia.js is fixed.
export function docLinks(html, base) {
  return [...html.matchAll(/<li\b[^>]*class=["'][^"']*\bdocument-row\b[^>]*>([\s\S]*?)<\/li>/gi)].flatMap(m => {
    const h = m[1].match(/<a\b[^>]*\bhref=(?:"([^"]*)"|'([^']*)')/i), t = m[1].match(/class=["'][^"']*\btitle\b[^>]*>([\s\S]*?)<\/div>/i);
    return h ? [{title: (t?.[1] || '').replace(/<[^>]+>/g, '').replace(/&#0?39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim(), url: new URL(h[1] ?? h[2], base).href}] : [];
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
// fia.com answers 429 when read fast: wait and retry
async function polite(fn) {
  for (let i = 0; ; i++) {
    await sleep(1500);
    try { return await fn(); } catch (e) { if (!/429/.test(e.message) || i >= 4) throw e; await sleep(30000 * (i + 1)); }
  }
}

async function fetchAll(years) {
  const fia = await import('../../worker/fia.js'), {officialUrl} = fia;
  const fiaCall = (...a) => polite(() => fia.fiaCall(...a)), eventDocuments = (...a) => polite(() => fia.eventDocuments(...a));
  const fiaDocumentText = (...a) => polite(() => fia.fiaDocumentText(...a));
  const page = url => polite(async () => { const r = await fetch(officialUrl(url), {signal: AbortSignal.timeout(20000)}); if (!r.ok) throw Error('FIA source HTTP ' + r.status); return r.text(); });
  const out = [];
  for (const year of years) {
    let events;
    try { events = JSON.parse((await fiaCall('fia_list_archive', {year})).content[0].text).records.map(r => r.event); }
    catch (e) { console.log(`${year}: archive ${e.message}`); continue; }
    for (const event of events) for (const track of tracksFor(event, year)) {
      const meta = {track, year, event};
      try {
        const ev = await eventDocuments(year, event);
        const fixed = ev ? docLinks(await page(ev.url), ev.url) : [];
        const docs = (ev?.records || []).map((d, i) => ({...d, url: (fixed.length === ev.records.length ? fixed[i] : fixed.find(f => f.title === d.title))?.url || d.url}))
          .filter(d => d.url && !d.recalled && NOTES.test(d.title) && !/pirelli|pit lane|circuit map|red zone|times|sc[12]\b|offence|summons|decision|infringement|deletion/i.test(d.title)).sort((a, b) => rank(a) - rank(b));
        let sections = [];
        for (const d of docs.slice(0, 3)) {
          meta.doc = {title: d.title, url: d.url, published: d.published || null};
          let text = await fiaDocumentText(d.url, 30);
          // a throttled read can come back as a short page without the notes: read once more
          if (!/track[- ]limit/i.test(text)) { await sleep(20000); text = await fiaDocumentText(d.url, 30); }
          sections = trackLimitSections(text);
          meta.hits = sections.length ? [] : limitHits(text);
          if (sections.length) break;
        }
        const e = entryFrom(meta, sections);
        out.push(e);
        console.log(`${track} ${year} ${event}: ${e.status}, ${e.corners.length} corners${e.allCorners ? ' + all' : ''}, ${e.unparsed.length} unparsed`);
      } catch (err) { out.push({...entryFrom(meta, []), error: err.message}); console.log(`${track} ${year}: ${err.message}`); }
    }
  }
  return out;
}

// docs table: one row per track, one cell per year (P n = parsed with n named corners, + = all-corners rule,
// U = document found but nothing parsed, N = event held but no document found, – = no event at this track that year)
export function coverageTable(rows, years) {
  const tracks = [...new Set(rows.map(r => r.track))].sort();
  const cell = (t, y) => {
    const rs = rows.filter(r => r.track === t && r.year === y);
    if (!rs.length) return '–';
    return rs.map(r => r.status === 'parsed' ? `P ${r.corners.length}${r.allCorners ? '+' : ''}` : r.status === 'unparsed' ? 'U' : 'N').join(' / ');
  };
  return ['| Track | ' + years.join(' | ') + ' |', '|---|' + years.map(() => '---').join('|') + '|',
    ...tracks.map(t => `| ${t} | ${years.map(y => cell(t, y)).join(' | ')} |`)].join('\n');
}

// IMSA WeatherTech: driver-briefing slides on the Al Kamel notice board ("TRACK LIMITS – TURN 1" slide titles and
// a general bullet such as "Two wheels must remain on racing surface, including painted curbing").
export function parseImsaBriefing(text) {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const body = lines.join(' ');
  // only a stated limit counts: "two wheels ... including painted curbing" (kerb usable) or "white lines define the track edges"
  const generalRule = /two wheels[^•]{0,80}curb/i.test(body) ? 'kerb' : EDGES.test(body) ? 'line' : null;
  const corners = [], unparsed = [], seen = new Set();
  for (const l of lines) {
    if (!/track limits?|short ?cut/i.test(l) || l.length > 120) continue;
    const refs = cornerRefs(l);
    if (!refs.length) { if (/[–-]/.test(l) && !/^track limits?$/i.test(l)) unparsed.push(l); continue; }
    const rule = /short ?cut/i.test(l) ? 'other' : generalRule || ruleOf(l);
    for (const r of refs) {
      if (seen.has(r.turn + r.letter + rule)) continue;
      seen.add(r.turn + r.letter + rule);
      corners.push({turn: r.turn, ...(r.letter ? {letter: r.letter} : {}), rule, text: l});
    }
  }
  corners.sort((a, b) => a.turn - b.turn);
  return {corners, allCorners: /two wheels must remain|(?:must remain|minimum) two wheels|track limits (?:will be|are) enforced/i.test(body), generalRule, unparsed};
}

export const IMSA_TRACKS = [['daytona', /Daytona International/i], ['sebring', /Sebring/i], ['long-beach', /Long Beach/i],
  ['laguna-seca', /Laguna Seca/i], ['watkins-glen', /Watkins Glen/i], ['mosport', /Canadian Tire|Mosport/i], ['road-america', /Road America/i],
  ['vir', /VIRginia|Virginia International/i], ['indianapolis', /Indianapolis/i], ['road-atlanta', /Road Atlanta|Petit Le Mans/i],
  ['mid-ohio', /Mid-Ohio/i], ['lime-rock', /Lime Rock/i], ['detroit', /Detroit/i], ['austin', /Circuit of the Americas/i]];

async function fetchImsa(years) {
  const {extractText, getDocumentProxy} = await import('unpdf');
  const ROOT = 'https://imsa.results.alkamelcloud.com/Results_NoticeBoard/';
  const get = async (url, bin) => { await sleep(500); const r = await fetch(url, {signal: AbortSignal.timeout(30000)}); if (!r.ok) throw Error('IMSA HTTP ' + r.status); return bin ? new Uint8Array(await r.arrayBuffer()) : r.text(); };
  const dir = async url => [...(await get(url)).matchAll(/<a href="([^"?/][^"]*)">[^<]*<\/a><\/td><td[^>]*>([^<]*)</g)].map(m => ({href: m[1], name: decodeURIComponent(m[1]).replace(/\/$/, ''), url: new URL(m[1], url).href, modified: m[2].trim(), isDir: m[1].endsWith('/')}));
  const out = [];
  for (const year of years) {
    const season = (await dir(ROOT).catch(() => [])).find(d => d.isDir && d.name.endsWith('_' + year));
    if (!season) { console.log(`imsa ${year}: no notice-board season`); continue; }
    for (const ev of (await dir(season.url)).filter(d => d.isDir && !/roar|test/i.test(d.name))) {
      const track = IMSA_TRACKS.find(([, re]) => re.test(ev.name))?.[0];
      if (!track) continue;
      try {
        const top = await dir(ev.url), folders = top.filter(d => d.isDir && /brief/i.test(d.name));
        const files = [...top.filter(d => !d.isDir), ...(await Promise.all(folders.map(f => dir(f.url)))).flat()];
        const doc = files.filter(f => /\.pdf$/i.test(f.name) && /brief/i.test(f.name) && /iwsc|weathertech|wtsc/i.test(f.name)).sort((a, b) => b.modified.localeCompare(a.modified))[0];
        const meta = {track, year, event: ev.name.replace(/^\d+_/, ''), doc: doc ? {title: doc.name, url: doc.url, published: doc.modified || null} : null};
        if (!doc && !top.some(d => /iwsc|weathertech/i.test(d.name)) && !files.some(f => /iwsc|weathertech/i.test(f.name))) continue; // not a WeatherTech event
        let p = {corners: [], allCorners: false, generalRule: null, unparsed: []}, raw = '';
        if (doc) {
          const {text} = await extractText(await getDocumentProxy(await get(doc.url, true)), {mergePages: false});
          raw = text.join('\n');
          p = parseImsaBriefing(raw);
        }
        const status = !doc ? 'no document' : p.corners.length || p.allCorners ? 'parsed' : 'unparsed';
        out.push({track, year, series: 'imsa', event: meta.event, status, ...p, doc: meta.doc, sectionFound: /track limits?/i.test(raw),
          raw: raw.split('\n').filter(l => /track limit|short ?cut|two wheels|curb|white line/i.test(l)).join('\n').slice(0, 3000)});
        console.log(`imsa ${track} ${year} ${meta.event}: ${status}, ${p.corners.length} corners`);
      } catch (e) { console.log(`imsa ${track} ${year}: ${e.message}`); }
    }
  }
  return out;
}

const write = rows => writeFile('worker/lapsim/track-limits-data.js', `// Generated by scripts/sim/track-limits.mjs from FIA Race Director's Event / Competition Notes ("Track limits").\n// Data only (step 4a): not used by any lap. raw = the section text the corners were read from.\nexport const lapsimTrackLimits=${JSON.stringify(rows)};\n`);

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  if (process.argv.includes('--reparse')) {
    const {lapsimTrackLimits} = await import('../../worker/lapsim/track-limits-data.js');
    await write(lapsimTrackLimits.map(r => r.series !== 'f1' ? r : {...entryFrom(r, r.raw ? r.raw.split('\n') : []), ...(r.error ? {error: r.error} : {})}));
  } else {
    const years = (process.env.TL_YEARS || '2019,2020,2021,2022,2023,2024,2025,2026').split(',').map(Number);
    const series = (process.env.TL_SERIES || 'f1,imsa').split(',');
    const {lapsimTrackLimits: old = []} = await import('../../worker/lapsim/track-limits-data.js').catch(() => ({}));
    const rows = [];
    for (const s of ['f1', 'imsa']) rows.push(...(series.includes(s) ? await (s === 'f1' ? fetchAll : fetchImsa)(years) : old.filter(r => r.series === s)));
    await write(rows);
  }
}
