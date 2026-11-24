// FIA circuit maps -> scripts/sim/data/fia-docs/f1-low-drag-zones-2022-2026.csv (method: handoff-f1-low-drag-zones.md).
// 2026: the STRAIGHT MODE table on the map page ("normal - ZONE An - low"). 2022-25: the DRS legend, when the page has a text layer.
// Image-only map pages are not parsed (central decision 2026-11-24: no OCR; those rows stay as checked by eye).
//   node scripts/sim/fia-docs/low-drag-zones.mjs --check   rebuild the maps already in the CSV and list the rows that differ (CSV untouched)
//   node scripts/sim/fia-docs/low-drag-zones.mjs           add the zones of 2026+ maps that are not in the CSV yet
import {fiaCall, eventDocuments} from '../../../worker/fia.js';
import {pdfPages, lines, readCsv, writeCsv, diffRows, report} from './lib.mjs';

export const FILE = 'scripts/sim/data/fia-docs/f1-low-drag-zones-2022-2026.csv';
const END = 'not found in published circuit map.';
const pos = s => s.replace(/(\d)\s*m\b/g, '$1 m').replace(/\s+/g, ' ').trim();
const turns = s => [...s.matchAll(/\bT(?:urn\s*)?(\d+[A-Z]?)\b/gi)].map(m => 'T' + m[1]);

// 2026 Straight Mode: rows of the table at the foot of the map
export function straightMode(page) {
  const out = [];
  for (const l of lines(page)) {
    const z = l.items.find(t => /^ZONE\s*A\s*\d+$/i.test(t.s.trim())); if (!z) continue;
    const zone = z.s.replace(/\s|ZONE/gi, ''), val = t => t && !/^-$/.test(t.s.trim()) ? t.s.trim() : '';
    const normal = val(l.items.filter(t => t.x < z.x && t.x > z.x - 130 && t.s.trim() !== '-').at(-1)), low = val(l.items.find(t => t.x > z.x && t.s.trim() !== '-'));
    const na = v => /^n\/?a$/i.test(v);
    if (na(normal) && na(low)) continue; // zone number printed but unused
    for (const [grip, v] of [['normal', normal], ['low', low]]) if (na(v)) out.push({zone, grip, start: 'N/A', end: 'N/A', ref: `FIA marks this activation N/A in ${grip} grip.`});
    else if (v) {
      const at = pos(v).replace(/\/\s*Pit Exit/i, '/ Pit Exit');
      out.push({zone, grip, start: at, ref: `Start: ${turns(at).join(' / ')}${/pit exit/i.test(at) ? ' / pit exit' : ''}. Fixed end: ${END}`});
    }
  }
  return out;
}

// 2022-25 DRS legend: "DRS Detection1 (160m before T1)", "DRS Activation 2 [40m after Turn 19]"
export function drsLegend(page) {
  const text = lines(page).map(l => l.text).join('\n'), det = {}, act = {};
  for (const m of text.matchAll(/DRS\s*(Detection|Activation)\s*(\d*)\s*[([]([^)\]]+)[)\]]/gi)) (/^d/i.test(m[1]) ? det : act)[m[2] || '1'] = pos(m[3]).replace(/\bT(\d)/g, 'Turn $1').replace(/\bturn\b/g, 'Turn');
  return Object.keys(act).sort().map(z => ({zone: z, det: det[Object.keys(det).filter(k => +k <= +z).sort((a, b) => b - a)[0]] || '', act: act[z]})); // no own detector: the previous zone's
}

const point = s => turns(s)[0]?.replace('T', 'Turn ') || s.match(/(?:control|finish|start) line|safety car line \d+/i)?.[0] || s;
const KEY = r => [r.source_url, r.zone, r.session_scope.split(' | ')[1] || ''].join('|');
export async function rowsFor(src) {
  const d = await pdfPages(src.source_url), page = d.pages[(+src.page || 2) - 1];
  if (!page || page.items.length < 20) return null; // image-only page
  const base = {year: src.year, event: src.event, source_url: src.source_url, page: src.page, status: 'document'};
  if (+src.year >= 2026) {
    const z = straightMode(page);
    if (!z.length && page.items.some(t => t.s.trim() === 'N/A'))
      return [{...base, session_scope: 'event map', zone: '', kind: 'straight_mode', start_or_detection: 'N/A', end_or_activation: 'N/A', reference: 'FIA Straight Mode field reads N/A; zero zones.'}];
    return z.map(z => ({...base, session_scope: `event map | ${z.grip} grip`, zone: z.zone, kind: 'straight_mode', start_or_detection: z.start, end_or_activation: z.end || 'not found', reference: z.ref}));
  }
  const drs = drsLegend(page); if (!drs.length) return null; // legend drawn in the picture
  return drs.map(z => ({...base, session_scope: 'event map', zone: z.zone, kind: 'DRS', start_or_detection: z.det, end_or_activation: z.act,
    reference: `Detection: ${point(z.det)}; activation: ${point(z.act)}.`}));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const {head, rows: old} = readCsv(FILE);
  const docs = [...new Map(old.filter(r => /^https:.*\.pdf/i.test(r.source_url)).map(r => [r.source_url, r])).values()];
  if (process.argv.includes('--check')) {
    const rebuilt = [], image = [];
    for (const d of docs) { const r = await rowsFor(d); if (r) rebuilt.push(...r); else image.push(d.source_url); }
    const imageSet = new Set(image), comparable = old.filter(r => !imageSet.has(r.source_url) && /^https:.*\.pdf/i.test(r.source_url));
    console.log(`low-drag zones: ${image.length} map page(s) are images (not parsed, ${old.length - comparable.length - old.filter(r => !/^https:.*\.pdf/i.test(r.source_url)).length} rows): ${image.join(' ')}`);
    console.log(`low-drag zones: ${old.filter(r => !/^https:.*\.pdf/i.test(r.source_url)).length} row(s) cite no PDF (pending events): not rebuilt`);
    process.exitCode = report('low-drag zones', diffRows(comparable, rebuilt.map(r => Object.fromEntries(head.map(h => [h, String(r[h] ?? '')]))), KEY, head));
  } else {
    // weekly: 2026+ maps not in the CSV (an event's circuit map, newest version)
    const known = new Set(docs.map(d => d.source_url)), year = new Date().getUTCFullYear(), add = [];
    for (const y of [...new Set([2026, year])]) {
      const index = JSON.parse((await fiaCall('fia_list_archive', {year: y})).content[0].text);
      for (const e of index.records || []) {
        const ev = await eventDocuments(y, e.event).catch(() => null);
        const map = (ev?.records || []).filter(d => /circuit\s+map/i.test(d.title) && !d.recalled && d.url).sort((a, b) => +(b.document_number || 0) - +(a.document_number || 0))[0];
        if (!map || known.has(map.url)) continue;
        const r = await rowsFor({year: String(y), event: ev.event, source_url: map.url, page: '2'});
        if (r?.length) add.push(...r); else console.log(`${y} ${ev.event}: ${map.url} has no readable Straight Mode table (image?); check it by eye`);
      }
    }
    if (!add.length) { console.log('low-drag zones: no new maps'); process.exit(0); }
    // a new map replaces the "scheduled"/pending row of its event
    const events = new Set(add.map(r => r.year + r.event)), keep = old.filter(r => !(events.has(r.year + r.event) && r.status === 'not found'));
    writeCsv(FILE, head, [...keep, ...add].map(r => Object.fromEntries(head.map(h => [h, String(r[h] ?? '')]))), {bom: true});
    console.log(`low-drag zones: ${add.length} row(s) from ${new Set(add.map(r => r.source_url)).size} new map(s)`);
  }
}
