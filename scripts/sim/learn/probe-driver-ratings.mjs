// Probe 2 (task P1, driver ratings): FIA public list (category icons: positions and the icon images), the FIA public driver database,
// and whether SRO result PDFs / entry-list pages print a category per driver. Runs in GitHub Actions. Writes a small probe file only.
import {writeFileSync, mkdtempSync, readdirSync, readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}}, TMP = mkdtempSync(join(tmpdir(), 'probe-dr-'));
const get = async (u, bin) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(60000)}); if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.text(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 2000)); } return null; };
const pdf = async (u, name) => { const b = await get(u, true); if (!b) return null; const p = join(TMP, name); writeFileSync(p, b); return p; };
const run = (c, a) => { try { return execFileSync(c, a, {maxBuffer: 1 << 27}).toString(); } catch (e) { return 'ERR ' + e.message.slice(0, 200); } };
const out = {};
// 1. FIA list: page 2 as XML (text and image boxes) and the distinct icons
const F = await pdf('https://www.fia.com/sites/default/files/fia_2024_reviewed_categorisations_list_0.pdf', 'fia.pdf');
if (F) {
  out.fiaXml = run('pdftohtml', ['-xml', '-i', '-f', '2', '-l', '2', '-stdout', F]).slice(0, 4000);
  const dir = join(TMP, 'img'); run('mkdir', ['-p', dir]); run('pdfimages', ['-png', '-f', '2', '-l', '2', '-p', F, join(dir, 'i')]);
  const seen = {}; for (const f of readdirSync(dir).sort()) { const b = readFileSync(join(dir, f)), h = createHash('md5').update(b).digest('hex').slice(0, 8); (seen[h] ||= {n: 0, first: f, png: b.length < 6000 ? b.toString('base64') : null}).n++; }
  out.fiaIcons = seen; out.fiaImgList = run('pdfimages', ['-list', '-f', '2', '-l', '2', F]).split('\n').slice(0, 8);
  // do the images sit on the rows? positions from the content stream (pdftocairo svg of page 2, image tags only)
  out.fiaSvg = run('pdftocairo', ['-svg', '-f', '2', '-l', '2', F, '-']).match(/<(use|image)[^>]{0,200}/g)?.slice(0, 30) || [];
}
// 2. FIA public database
for (const u of ['https://driverscategorisation.fia.com/public/drivers', 'https://driverscategorisation.fia.com']) { const t = await get(u); out[u] = t ? t.replace(/\s+/g, ' ').slice(0, 3000) : null; }
// 3. SRO result PDFs: Spa 24h 2025 race result list, Bathurst 2025 race
for (const [k, u] of [['spa', 'https://www.intercontinentalgtchallenge.com/files/results/GTWCEU_GT3%2024H%20Spa_Q1_ResultList_1.0.PDF'], ['bathurst', 'https://www.intercontinentalgtchallenge.com/files/results/MOUN_02022025_0545_Race_R6_12H_RES_F_1.pdf']]) {
  const page = await get('https://www.intercontinentalgtchallenge.com/results/2025/' + (k === 'spa' ? 'crowdstrike-24-hours-of-spa' : 'bathurst-12-hour')) || '';
  const href = [...page.matchAll(/href="([^"]+\.pdf)"/gi)].map(m => m[1]).find(h => k === 'spa' ? /Q1_ResultList/.test(decodeURIComponent(h)) : /Race_R6/.test(h));
  const url = href ? (href.startsWith('http') ? href : 'https://www.intercontinentalgtchallenge.com' + href) : u, p = await pdf(url, k + '.pdf');
  out['sro_' + k] = {url, head: p ? run('pdftotext', ['-layout', '-l', '1', p, '-']).split('\n').filter(l => l.trim()).slice(0, 40) : null};
}
// 4. GTWC Europe entry-list page raw table row (hidden per-driver attributes?)
const el = await get('https://www.gt-world-challenge-europe.com/entry-list/2025/monza');
out.gtwcEntryRow = el ? (el.match(/<tr[\s\S]*?<\/tr>/g) || []).slice(0, 3).map(x => x.replace(/\s+/g, ' ').slice(0, 2500)) : null;
writeFileSync('scripts/sim/data/learn/probe-driver-ratings.json', JSON.stringify(out, null, 1));
console.log(Object.keys(out));
