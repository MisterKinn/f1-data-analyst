// Formula E track geometry, step 1: the official "Circuit Map" PDF of every event (Event Information folder of the Al Kamel
// results tree, results.fiaformulae.com). The map is vector graphics: `pdftocairo -svg` turns it into paths, `pdftotext -bbox`
// gives the printed words (turn numbers, lap length). The PDF itself is not stored (physics rule 2.9); this writes a derived
// summary: the longest drawn paths with their points (decimated), and the words with their positions.
// Out: scripts/sim/data/learn/fe-maps.json. Needs network and poppler-utils: run in Actions (lapsim-learn.yml).
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {officialArchive, officialSource} from '../../../worker/official.js';
import {svgPaths, polyLen} from './svg-paths.mjs';

const FROM = Number(process.env.FE_MAPS_FROM_SEASON || 9), TMP = mkdtempSync(join(tmpdir(), 'fe-maps-')), log = [], events = [];
const list = async id => { for (let i = 0; ; i++) { try { return await officialArchive('formula-e', id); } catch (e) { if (i >= 2) { log.push(`${id}: ${e.message}`); return {catalogs: [], files: []}; } await new Promise(r => setTimeout(r, 2000 * (i + 1))); } } };
const dec = (p, n) => { if (p.length <= n) return p; const k = p.length / n; return Array.from({length: n}, (_, i) => p[Math.floor(i * k)]); };
const r1 = v => Math.round(v * 10) / 10;
export function summarise(svg, words, page) {
  const P = svgPaths(svg).map(p => { const s = p.subpaths.map(q => ({q, L: polyLen(q)})).sort((a, b) => b.L - a.L)[0], bb = s.q.reduce((b, [x, y]) => [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)], [Infinity, Infinity, -Infinity, -Infinity]);
    return {stroke: p.stroke, fill: p.fill, width: p.width && r1(p.width), dash: p.dash, subpaths: p.subpaths.length, closed: !!s.q.closed || Math.hypot(s.q[0][0] - s.q.at(-1)[0], s.q[0][1] - s.q.at(-1)[1]) < 2,
      length: r1(s.L), bbox: bb.map(r1), points: dec(s.q, 700).map(([a, b]) => [r1(a), r1(b)])}; });
  const big = Math.max(page.w, page.h) * 1.2; // a lap drawn on the page is longer than one page side
  return {page, paths: P.filter(p => p.length > big).sort((a, b) => b.length - a.length).slice(0, 20), words: words.slice(0, 500)};
}
if (process.argv[1]?.endsWith('fetch-fe-maps.mjs')) {
  const seasons = (await list()).catalogs.filter(c => +(c.name.match(/Season (\d+)/) || [])[1] >= FROM);
  for (const s of seasons) for (const ev of (await list(s.id)).catalogs) {
    const info = (await list(ev.id)).catalogs.find(c => /event information/i.test(c.name)); if (!info) { log.push(`${s.name} ${ev.name}: no Event Information`); continue; }
    const maps = (await list(info.id)).files.filter(f => /circuit ?map/i.test(f.title) && f.format === 'pdf').sort((a, b) => (+(b.title.match(/V(\d+)/i) || [])[1] || 0) - (+(a.title.match(/V(\d+)/i) || [])[1] || 0));
    if (!maps.length) { log.push(`${s.name} ${ev.name}: no circuit map`); continue; }
    try { const src = await officialSource(maps[0].url), pdf = join(TMP, 'map.pdf'); writeFileSync(pdf, Buffer.from(src.bytes));
      execFileSync('pdftocairo', ['-svg', '-f', '1', '-l', '1', pdf, join(TMP, 'map.svg')]);
      const html = execFileSync('pdftotext', ['-bbox', '-f', '1', '-l', '1', pdf, '-']).toString(), pg = html.match(/<page width="([\d.]+)" height="([\d.]+)"/);
      const words = [...html.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)].map(m => ({t: m[5].replace(/&amp;/g, '&'), x: r1((+m[1] + +m[3]) / 2), y: r1((+m[2] + +m[4]) / 2), h: r1(+m[4] - +m[2])}));
      events.push({season: s.name, event: ev.name, file: maps[0].title, url: maps[0].url, ...summarise(readFileSync(join(TMP, 'map.svg'), 'utf8'), words, {w: +pg[1], h: +pg[2]})});
      console.log(s.name, ev.name, events.at(-1).paths.length, 'paths', words.length, 'words');
    } catch (e) { log.push(`${s.name} ${ev.name} ${maps[0].title}: ${String(e.message).slice(0, 200)}`); }
  }
  writeFileSync('scripts/sim/data/learn/fe-maps.json', JSON.stringify({source: 'FIA Formula E official circuit maps (results.fiaformulae.com, Al Kamel Systems). Derived: drawn paths (points in PDF points, y down) and printed words. PDFs not stored.', fetched: new Date().toISOString().slice(0, 10), log, events}));
  console.log(events.length, 'maps', log.length, 'log', log.slice(0, 20));
}
