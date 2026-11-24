// FIA event / competition notes -> scripts/sim/data/fia-docs/f1-circuit-changes-track-limits-2022-2026.csv
// (method: handoff-f1-circuit-changes-track-limits.md). The notes are numbered prose, so the script extracts the items of the
// "Changes to the Circuit" and track-limits sections, types them by keyword and reads their turn numbers.
// The CSV rows group and paraphrase those items, so --check compares what a parser can rebuild: per cited page, the item types and
// the turns. Descriptions are not compared (curated wording).
//   node scripts/sim/fia-docs/circuit-changes.mjs --check   list every CSV row whose type or turns the cited page does not support,
//                                                          and every extracted item no CSV row covers (CSV untouched)
//   node scripts/sim/fia-docs/circuit-changes.mjs           add rows (official wording) for event notes not in the CSV yet
import {fiaCall, eventDocuments} from '../../../worker/fia.js';
import {pdfPages, lines, readCsv, writeCsv} from './lib.mjs';

export const FILE = 'scripts/sim/data/fia-docs/f1-circuit-changes-track-limits-2022-2026.csv';
const CHANGES = /changes to the circuit|circuit changes/i;
const LIMITS = /track limits|escape road|cutting the chicane|leaving the track|rejoin|track edge|lap times in all|pit (?:lane )?(?:entry|exit)/i;
const TYPES = [['kerb', /kerb|bollard|sausage|deterrent/i], ['barrier', /fenc|barrier|tecpro|guard ?rail|gate|wall|debris|concrete block|opening/i],
  ['resurfacing', /resurfac|asphalt|repav|grind|surface|bump/i], ['track_limits', /track limit|(?:white|yellow|blue) (?:line|lane)|track edge|lap time|rejoin|invalidat/i]];
export const typeOf = t => TYPES.find(([, re]) => re.test(t))?.[0] || 'layout';
// turn numbers of a text: "T4-5", "Turn 12 and 13", "turns 4, 5 and 6"
export const turnsIn = t => new Set([...(t.match(/\bturns?\s*:\s*([^.]*)/i)?.[1].match(/\b\d+\b/g) || []).map(Number), ...[...t.matchAll(/\b(?:T|turns?\s*)(\d+)[A-Z]?((?:\s*(?:[-–—/]|and|or|&|to|,)\s*(?:T|turns?\s*)?\d+)*)/gi)].flatMap(m => [m[1], ...(m[2].match(/\d+/g) || [])]).map(Number)]);

// numbered sections of the notes, with their items (bullets, dashes, sub-clauses); page = physical PDF page
export function sections(doc) {
  const out = []; let sec = null, item = null;
  for (const p of doc.pages) for (const l of lines(p)) {
    const h = l.text.match(/^(\d{1,2})[.)]\s+(\S.*)$/);
    if (h && l.x < 70) { sec = {no: +h[1], title: h[2], page: p.page, items: []}; out.push(sec); item = null; continue; }
    if (!sec || /^\d{1,3}$/.test(l.text)) continue; // page number
    for (const part of l.text.split(/\s*[]\s*/).filter(Boolean)) // private-use bullet glyphs can sit inside one line
      if (/^(?:[-•–]|\d+\.\d+|[a-z]\))\s*/.test(part) || !item || part !== l.text) { item = {page: p.page, text: part.replace(/^[-•–]\s*/, '')}; sec.items.push(item); }
      else item.text += ' ' + part;
  }
  return out;
}

// items of the change and track-limit sections
export function items(doc) {
  return sections(doc).filter(s => CHANGES.test(s.title) || LIMITS.test(s.title)).flatMap(s => s.items.map(i => ({...i, section: `${s.no}. ${s.title}`,
    type: CHANGES.test(s.title) ? typeOf(i.text) : 'track_limits', turns: turnsIn(i.text)})));
}

const pagesOf = p => { const [a, b = a] = p.split(/[–-]/).map(Number); return Array.from({length: b - a + 1}, (_, i) => a + i); };
const rowTurns = c => turnsIn(c.replace(/T?(\d+)[–-](\d+)/g, 'T$1-$2'));

export async function check(rows) {
  const bad = [], uncovered = [], bySource = Object.groupBy(rows, r => r.source_url);
  for (const [src, rs] of Object.entries(bySource)) {
    const doc = await pdfPages(src);
    if (rs[0].status === 'regulation') { // season rule: the cited page must carry the white-line definition
      for (const r of rs) if (!lines(doc.pages[+r.page - 1] || {items: []}).some(l => /white lines/i.test(l.text))) bad.push({r, why: 'regulation page has no "white lines" definition'});
      continue;
    }
    const its = items(doc);
    for (const r of rs) {
      if (r.status !== 'document' && r.status !== 'document_diagram') continue; // no_change / first_visit / not_stated: statements about absence
      const on = its.filter(i => pagesOf(r.page).includes(i.page)), want = rowTurns(r.corners);
      if (!on.length) { bad.push({r, why: 'no change or track-limit section item on the cited page(s)'}); continue; }
      const text = on.map(i => i.text).join(' '), have = turnsIn(text), miss = [...want].filter(t => !have.has(t));
      const re = TYPES.find(([k]) => k === r.item_type)?.[1], same = on.filter(i => i.type === r.item_type || re?.test(i.text)); // an item can describe several works
      if (miss.length) bad.push({r, why: `turn(s) ${miss.join(', ')} not in the section items of the cited page(s)`});
      else if (!same.length && r.item_type !== 'layout') bad.push({r, why: `no "${r.item_type}" item on the cited page(s) (types found: ${[...new Set(on.map(i => i.type))].join(', ')})`});
    }
    // extracted change items whose turns no CSV row of this source names
    const named = new Set(rs.flatMap(r => [...rowTurns(r.corners)]));
    for (const i of its) if (i.turns.size && ![...i.turns].some(t => named.has(t))) uncovered.push({src, i});
  }
  return {bad, uncovered};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const {head, rows, format} = readCsv(FILE);
  if (process.argv.includes('--check')) {
    const {bad, uncovered} = await check(rows);
    console.log(`circuit changes: ${bad.length} of ${rows.length} row(s) not supported by the cited page as parsed`);
    for (const {r, why} of bad) console.log(`  row: ${r.year} ${r.event} | ${r.item_type} | ${r.corners} | p. ${r.page} | ${why}`);
    console.log(`circuit changes: ${uncovered.length} extracted item(s) with turns that no CSV row of the same document names`);
    for (const {src, i} of uncovered) console.log(`  item: ${src} p. ${i.page} | ${i.section} | ${i.type} | ${i.text.slice(0, 140)}`);
    process.exitCode = bad.length + uncovered.length;
  } else {
    const known = new Set(rows.map(r => r.source_url)), seen = new Set(rows.map(r => r.year + r.event)), year = new Date().getUTCFullYear(), add = [];
    for (const y of [...new Set([2026, year])]) {
      const index = JSON.parse((await fiaCall('fia_list_archive', {year: y})).content[0].text);
      for (const e of index.records || []) {
        if (seen.has(y + e.event)) continue; // events already in the CSV keep their curated rows
        const ev = await eventDocuments(y, e.event).catch(() => null);
        const doc = (ev?.records || []).filter(d => /race director.{0,3}s?\s+(event|competition)\s+notes/i.test(d.title) && !d.recalled && d.url && !known.has(d.url))
          .sort((a, b) => +(b.document_number || 0) - +(a.document_number || 0))[0]; // newest edition
        if (!doc) continue;
        const its = items(await pdfPages(doc.url));
        for (const i of its) add.push({year: String(y), event: ev.event, item_type: i.type, corners: [...i.turns].map(t => 'T' + t).join('; ') || 'circuit-wide',
          description: i.text, source_url: doc.url, page: String(i.page), status: 'document'});
        if (!its.length) console.log(`${y} ${ev.event}: no change or track-limit section found in ${doc.url}; check it by hand`);
      }
    }
    if (!add.length) { console.log('circuit changes: no new event notes'); process.exit(0); }
    writeCsv(FILE, head, [...rows, ...add], format);
    console.log(`circuit changes: ${add.length} row(s) (official wording; review before merge) from ${new Set(add.map(r => r.source_url)).size} document(s)`);
  }
}
