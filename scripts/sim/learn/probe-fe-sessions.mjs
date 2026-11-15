// Formula E qualifying: which Al Kamel sessions hold the duels (350 kW) next to the groups (300 kW)? Lists the session folders
// and their CSV files of the first events of seasons 9-12. Out: scripts/sim/data/learn/probe-fe-sessions.json (names only).
import {writeFileSync} from 'node:fs';
import {officialArchive} from '../../../worker/official.js';
const list = async id => { for (let i = 0; ; i++) { try { return await officialArchive('formula-e', id); } catch (e) { if (i >= 2) return {catalogs: [], files: [], error: e.message}; await new Promise(r => setTimeout(r, 2000 * (i + 1))); } } };
const out = [];
for (const s of (await list()).catalogs.filter(c => +(c.name.match(/Season (\d+)/) || [])[1] >= 9)) for (const ev of (await list(s.id)).catalogs.slice(0, 2)) {
  const e = {season: s.name, event: ev.name, folders: []};
  for (const c of (await list(ev.id)).catalogs) { const f = {name: c.name, sessions: []};
    if (/formula e/i.test(c.name)) for (const se of (await list(c.id)).catalogs) { const l = await list(se.id); f.sessions.push({name: se.name, files: l.files.map(x => x.title).slice(0, 30), sub: l.catalogs.map(x => x.name)}); }
    e.folders.push(f); }
  out.push(e); console.log(JSON.stringify(e).slice(0, 2000));
}
writeFileSync('scripts/sim/data/learn/probe-fe-sessions.json', JSON.stringify(out, null, 1));
