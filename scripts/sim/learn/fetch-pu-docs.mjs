// Reads every 2026 F1 "Power Unit Information" event document (FIA) and stores what it sets per event: recharge per lap by session,
// round, power-limited distance, power reduction rate, the exception sector tables and the overtake lines (worker/lapsim/pu-info.js).
// Runs in GitHub Actions (lapsim-learn.yml): the shell of a Claude session cannot reach fia.com. Out: scripts/sim/data/learn/pu-docs.json.
import {writeFile} from 'node:fs/promises';
import {lapsimTracks} from '../../../worker/lapsim/tracks-data.js';
import {eventDocuments, fiaCall} from '../../../worker/fia.js';
import {eventFor} from '../../../worker/lapsim/names.js';
import {parsePuInfo, parsePuSectors} from '../../../worker/lapsim/pu-info.js';

const out = {source: 'FIA F1 event documents "Power Unit Information" (2026)', generatedAt: new Date().toISOString(), events: {}};
for (const id of Object.keys(lapsimTracks)) {
  const name = eventFor(id, 2026); if (!name) continue;
  try {
    const ev = await eventDocuments(2026, name);
    const doc = ev?.records.filter(r => /power unit information/i.test(r.title) && !r.recalled).sort((a, b) => Number(b.document_number || 0) - Number(a.document_number || 0))[0];
    if (!doc) { console.log(`${id}: no Power Unit Information`); continue; }
    const r = JSON.parse((await fiaCall('fia_read_document', {url: doc.url, start_page: 1, page_count: 4, limit: 16000})).content[0].text);
    const limits = parsePuInfo(r.pages), sectors = parsePuSectors(r.pages);
    out.events[id] = {event: ev.event, ...limits, ...sectors, document: {title: doc.title, url: doc.url, published: doc.published || null}};
    console.log(`${id}: R${sectors?.round} alt ${sectors?.alt.length ?? '-'} bigCut ${sectors?.bigCut.length ?? '-'} reset ${sectors?.reset.length ?? '-'} speed ${sectors?.speed.length ?? '-'} limited ${sectors?.powerLimitedDistanceM ?? '-'} m`);
  } catch (e) { console.log(`${id}: ${e.message}`); }
}
await writeFile('scripts/sim/data/learn/pu-docs.json', JSON.stringify(out, null, 1) + '\n');
