// Reads the FIA "Circuit Map" competition notes of every F1 event of this year and the next (2027 notes are picked up as soon as the
// FIA publishes them) and stores their zone text rows in scripts/sim/data/learn/f1-zones-raw.json, the input of scripts/sim/f1-zones.mjs.
// Owner rule 2026-11-16: zones of the remaining races update themselves when the Race Director's notes come out; the low-grip (Alt)
// activation column is kept. Runs in GitHub Actions (lapsim-learn.yml, f1-zones-refresh.yml): a Claude session's shell cannot reach fia.com.
import {readFile, writeFile} from 'node:fs/promises';
import {lapsimTracks} from '../../../worker/lapsim/tracks-data.js';
import {eventDocuments, fiaCall} from '../../../worker/fia.js';
import {eventFor} from '../../../worker/lapsim/names.js';

// LAPSIM_ZONE_YEARS=2022 LAPSIM_ZONES_RAW_OUT=<file> (step 3 unseen-season gate): those seasons into a separate raw file
const FILE = process.env.LAPSIM_ZONES_RAW_OUT || 'scripts/sim/data/learn/f1-zones-raw.json';
const raw = process.env.LAPSIM_ZONES_RAW_OUT ? {source: 'FIA event documents (circuit map)', events: []} : JSON.parse(await readFile(FILE, 'utf8'));
const now = new Date().getUTCFullYear(), years = process.env.LAPSIM_ZONE_YEARS ? process.env.LAPSIM_ZONE_YEARS.split(',').map(Number) : [now, now + 1].filter(y => y >= 2026);
let changed = 0;
for (const year of years) for (const id of Object.keys(lapsimTracks)) {
  const name = id === 'madring' ? 'Spanish Grand Prix' : eventFor(id, year); if (!name) continue;
  try {
    const ev = await eventDocuments(year, name); if (!ev?.records?.length) continue;
    const doc = ev.records.filter(r => /circuit map/i.test(r.title) && !r.recalled).sort((a, b) => Number(b.document_number || 0) - Number(a.document_number || 0))[0];
    if (!doc) continue;
    const lines = [];
    for (let p = 1; p <= 3; p++) {
      const r = JSON.parse((await fiaCall('fia_read_document', {url: doc.url, start_page: p, page_count: 1, limit: 16000})).content[0].text);
      for (const pg of r.pages || []) if (/STRAIGHT MODE|DRS|OVERTAKE/i.test(pg.text || '')) for (const row of pg.rows || []) lines.push({page: pg.page, y: row.y, text: row.cells.map(c => c.text).join(' '), cells: row.cells});
      if (!r.next_page) break;
    }
    if (!lines.length) { console.log(`${year} ${id}: ${doc.title} has no zone text (map picture only)`); continue; }
    const e = {year, event: ev.event || name, track: id, docs: [{title: doc.title, url: doc.url, published: doc.published || null, lines}]};
    const i = raw.events.findIndex(x => x.year === year && x.track === id && !x.docs?.[0]?.title?.includes('(read from the map picture)'));
    if (i >= 0 && raw.events[i].docs[0].url === doc.url && raw.events[i].docs[0].lines.length === lines.length) continue;
    if (i >= 0) raw.events[i] = e; else raw.events.push(e);
    changed++; console.log(`${year} ${id}: ${doc.title} (${lines.length} rows)`);
  } catch (err) { console.log(`${year} ${id}: ${err.message}`); }
}
if (changed || process.env.LAPSIM_ZONES_RAW_OUT) await writeFile(FILE, JSON.stringify(raw) + '\n');
console.log(`${changed} event(s) updated`);
