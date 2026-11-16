// ELMS BoP decision PDFs (LMGT3 and LMP3) from the ELMS notice board, 2024-2026, for the BoP simulator (owner 2026-11-16).
// The notice board (elms.alkamelsystems.com/noticeBoard.php, the address printed on every ELMS committee decision) lists the
// committee documents of a season; every link whose name says BOP is downloaded and turned into layout text with pdftotext.
// Only the text is kept (scripts/sim/data/learn/elms-bop-docs/<season>/<file>.txt); parsed by scripts/sim/elms-bop-estimate.mjs.
// Runs in GitHub Actions (lapsim-learn.yml): the shell of a Claude session cannot reach Al Kamel.
import {mkdir, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const SITE = 'https://elms.alkamelsystems.com/', OUT = 'scripts/sim/data/learn/elms-bop-docs';
const get = async (url, buf) => { const r = await fetch(url, {headers: {'user-agent': 'Mozilla/5.0 kongboda-learn'}}); if (!r.ok) throw Error(`${r.status} ${url}`); return buf ? Buffer.from(await r.arrayBuffer()) : r.text(); };
const log = {generated: new Date().toISOString(), seasons: {}, files: []};
let seasons = [];
try { const html = await get(SITE + 'noticeBoard.php'); seasons = [...html.matchAll(/<option[^>]*value="([^"]+)"[^>]*>([^<]*)</g)].map(m => ({id: m[1], name: m[2].trim()})).filter(s => /202[4-6]/.test(s.id + s.name)); log.page = html.length; }
catch (e) { log.error = e.message; }
if (!seasons.length) seasons = ['13_2024', '14_2025', '15_2026'].map(id => ({id, name: id}));
for (const s of seasons) {
  const links = new Set();
  for (const q of [`noticeBoard.php?season=${s.id}`, `noticeBoard.php?season=${s.id}&evvent=committee`]) {
    let html; try { html = await get(SITE + q); } catch (e) { log.seasons[s.id] = e.message; continue; }
    for (const m of html.matchAll(/href="([^"]+\.pdf)"/gi)) if (/BOP|Balance/i.test(decodeURIComponent(m[1]))) links.add(new URL(m[1], SITE).href);
  }
  log.seasons[s.id] = links.size;
  for (const url of links) {
    const base = decodeURIComponent(url.split('/').pop()).replace(/\.pdf$/i, '').replace(/[^\w.\-]+/g, '_');
    try { await mkdir('/tmp/elms', {recursive: true}); await writeFile(`/tmp/elms/${base}.pdf`, await get(url, true));
      const text = execFileSync('pdftotext', ['-layout', `/tmp/elms/${base}.pdf`, '-'], {encoding: 'utf8'});
      await mkdir(`${OUT}/${s.id}`, {recursive: true}); await writeFile(`${OUT}/${s.id}/${base}.txt`, text); log.files.push({season: s.id, base, url}); }
    catch (e) { log.files.push({season: s.id, base, url, error: e.message}); }
  }
}
await mkdir(OUT, {recursive: true}); await writeFile(`${OUT}/index.json`, JSON.stringify(log, null, 1));
console.log(JSON.stringify(log.seasons), log.files.length, 'files');
