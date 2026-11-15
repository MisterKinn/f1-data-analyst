// Formula E qualifying duels (350 kW Gen3, 250 kW Season 8): the Al Kamel tree publishes the duels only as PDF classifications
// ("Classification Practice With Analysis_Qualifying Duel ..."), not as Analysis CSV, so fe-cars.csv has the groups only.
// This reads the best lap of each car in each duel from the PDF text (pdftotext -layout) and the duel weather CSV.
// Out: scripts/sim/data/learn/fe-duels.csv (derived; PDFs not stored, rule 2.9). Needs network and poppler-utils: Actions.
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {officialArchive, officialSource, textOf} from '../../../worker/official.js';
import {parseCsv, wx} from './build-endurance.mjs';
const TMP = mkdtempSync(join(tmpdir(), 'fe-duels-')), out = [], log = []; let shown = 0;
const list = async id => { for (let i = 0; ; i++) { try { return await officialArchive('formula-e', id); } catch (e) { if (i >= 2) { log.push(`${id}: ${e.message}`); return {catalogs: [], files: []}; } await new Promise(r => setTimeout(r, 2000 * (i + 1))); } } };
const sec = t => { const m = /^(\d+):(\d\d\.\d{3})$/.exec(t); return m ? +m[1] * 60 + +m[2] : null; };
// a classification row: position, car number, driver ... first lap time on the line = the car's best lap of the duel
export function duelRows(text) { const rows = [];
  for (const l of text.split('\n')) { const m = /^\s*(\d{1,2})\s+(\d{1,3})\s+(\S.*?)\s{2,}.*?(\d:\d\d\.\d{3})/.exec(l); if (m && !rows.some(r => r.entry === m[2])) rows.push({entry: m[2], driver: m[3].trim(), best: sec(m[4])}); }
  return rows.filter(r => r.best); }
const seasons = (await list()).catalogs.filter(c => +(c.name.match(/Season (\d+)/) || [])[1] >= 8);
for (const s of seasons) { const year = +('20' + s.name.match(/-(\d\d)\s*$/)[1]);
  for (const ev of (await list(s.id)).catalogs) for (const champ of (await list(ev.id)).catalogs.filter(c => /formula e world championship|formula e championship/i.test(c.name)))
    for (const se of (await list(champ.id)).catalogs.filter(c => /duel/i.test(c.name) && !/merge/i.test(c.name))) {
      const files = (await list(se.id)).files, pdf = files.find(f => /classification/i.test(f.title) && f.format === 'pdf'), wf = files.find(f => /weather/i.test(f.title) && (f.format === 'csv' || /\.csv$/i.test(f.url)));
      if (!pdf) { log.push(`${s.name} ${ev.name} ${se.name}: no classification PDF`); continue; }
      try { const p = join(TMP, 'd.pdf'); writeFileSync(p, Buffer.from((await officialSource(pdf.url)).bytes)); const text = execFileSync('pdftotext', ['-layout', p, '-']).toString();
        if (shown++ < 3) console.log(`--- ${s.name} ${ev.name} ${se.name}\n` + text.split('\n').slice(0, 40).join('\n'));
        const w = wf ? wx(parseCsv(textOf(await officialSource(wf.url))), 'fe') : {}, rows = duelRows(text);
        if (!rows.length) log.push(`${s.name} ${ev.name} ${se.name}: no row read`);
        for (const r of rows) out.push(['fe', year, ev.name.replace(/^R\d+\s*/, ''), se.name, 'Q', r.entry, JSON.stringify(r.driver), r.best, w.airC ?? '', w.trackC ?? '', w.hum ?? '', w.hpa ?? '', w.rainShare ?? ''].join(','));
      } catch (e) { log.push(`${s.name} ${ev.name} ${se.name}: ${String(e.message).slice(0, 160)}`); }
    }
  console.log(s.name, 'duel rows so far', out.length);
}
writeFileSync('scripts/sim/data/learn/fe-duels.csv', 'series,season,event,session,type,entry,driver,best,airC,trackC,hum,hpa,rainShare\n' + out.join('\n') + '\n');
console.log(out.length, 'duel rows;', log.length, 'log lines', log.slice(0, 20));
