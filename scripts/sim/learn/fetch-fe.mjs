// Formula E, every car of every session from the published Al Kamel timing (results.fiaformulae.com file tree), seasons 2018-19 on.
// Needs network: run in GitHub Actions (workflow lapsim-learn.yml). Raw files are not stored (rule 2.9).
// Out: scripts/sim/data/learn/fe-cars.csv (same columns as endurance-cars.csv) and fe-files.json (what was found, what failed).
import {writeFileSync} from 'node:fs';
import {officialArchive, officialSource, textOf} from '../../../worker/official.js';
import {parseCsv, sessionCars, sessionType, COLS, csvLine} from './build-endurance.mjs';

const FROM = Number(process.env.FE_FROM_SEASON || 5), out = [], index = [], log = [];
const list = async id => { for (let i = 0; ; i++) { try { return await officialArchive('formula-e', id); } catch (e) { if (i >= 2) { log.push(`${id}: ${e.message}`); return {catalogs: [], files: []}; } await new Promise(r => setTimeout(r, 2000 * (i + 1))); } } };
const csv = async url => parseCsv(textOf(await officialSource(url)));
const seasons = (await list()).catalogs.filter(c => { const n = +(c.name.match(/Season (\d+)/) || [])[1]; return n >= FROM; });
for (const s of seasons) { const year = +('20' + s.name.match(/-(\d\d)\s*$/)[1]);
  for (const ev of (await list(s.id)).catalogs) for (const champ of (await list(ev.id)).catalogs.filter(c => /formula e world championship|formula e championship/i.test(c.name))) for (const se of (await list(champ.id)).catalogs) {
    const type = sessionType(se.name.toLowerCase().replace(/ /g, '-').replace('duel', 'qualifying-duel')), files = (await list(se.id)).files.filter(f => f.format === 'csv' || /\.csv$/i.test(f.url));
    index.push({season: s.name, event: ev.name, session: se.name, type, files: files.map(f => f.title)}); if (!type || type === 'other') continue;
    const pick = re => files.find(f => re.test(f.title)), lf = pick(/analysis/i); if (!lf) continue;
    try { const laps = await csv(lf.url), rf = pick(/classification/i), wf = pick(/weather/i), res = rf ? await csv(rf.url).catch(() => []) : [], w = wf ? await csv(wf.url).catch(() => []) : [];
      for (const c of sessionCars(laps, res, w)) out.push(['fe', year, ev.name.replace(/^R\d+\s*/, ''), se.id.split('/').pop(), type, ...c]);
    } catch (e) { log.push(`${s.name} ${ev.name} ${se.name}: ${e.message}`); }
  }
  console.log(s.name, 'rows so far', out.length);
}
writeFileSync('scripts/sim/data/learn/fe-cars.csv', COLS.join(',') + '\n' + out.map(csvLine).join('\n') + '\n');
writeFileSync('scripts/sim/data/learn/fe-files.json', JSON.stringify({source: 'https://results.fiaformulae.com/ (Al Kamel Systems)', fetched: new Date().toISOString().slice(0, 10), rows: out.length, log, sessions: index}, null, 1));
console.log(out.length, 'rows', log.length, 'errors', log.slice(0, 10));
