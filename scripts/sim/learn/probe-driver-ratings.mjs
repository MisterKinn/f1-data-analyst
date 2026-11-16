// Probe (task P1, driver ratings): which official SRO entry lists exist as PDF and whether they print a category per driver, and how
// the FIA Drivers' Categorisation public list is laid out. Runs in GitHub Actions (network, poppler). Writes a small probe file only.
import {writeFileSync, mkdtempSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const SITES = ['https://www.gt-world-challenge-europe.com', 'https://www.gt-world-challenge-america.com', 'https://www.gt-world-challenge-asia.com', 'https://www.britishgt.com', 'https://www.intercontinentalgtchallenge.com', 'https://www.gt-world-challenge-australia.com'];
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}}, TMP = mkdtempSync(join(tmpdir(), 'probe-dr-'));
const get = async (u, bin) => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(60000)}); if (r.ok) return bin ? Buffer.from(await r.arrayBuffer()) : await r.text(); if (r.status === 404) return null; } catch {} await new Promise(s => setTimeout(s, 2000)); } return null; };
const links = (t, re) => [...new Set([...t.matchAll(/href="([^"]+)"/g)].map(m => m[1]).filter(h => re.test(h)))];
const text = async (u, args = ['-layout']) => { const b = await get(u, true); if (!b) return null; const p = join(TMP, 'x.pdf'); writeFileSync(p, b); try { return execFileSync('pdftotext', [...args, p, '-'], {maxBuffer: 1 << 26}).toString(); } catch (e) { return 'ERR ' + e.message; } };
const out = {sro: [], samples: [], fia: {}};
for (const site of SITES) {
  const idx = await get(site + '/results') || '', sel = idx.match(/name="filter_season_id"[^>]*>([\s\S]*?)<\/select>/)?.[1] || '';
  const seasons = [...sel.matchAll(/value="(\d+)"[^>]*>\s*(\d{4})/g)].map(m => [m[1], +m[2]]).filter(([, y]) => [2019, 2025].includes(y));
  for (const [sid, year] of seasons) {
    const list = await get(`${site}/results?filter_season_id=${sid}&filter_meeting_id=0`) || '';
    for (const m of links(list, new RegExp(`^(https?://[^/]+)?/results/${year}/[^/?#]+$`)).slice(0, 3)) {
      const page = await get(m.startsWith('http') ? m : site + m) || '', pdfs = links(page, /\.pdf$/i);
      out.sro.push({site, year, meeting: m, pdfs: pdfs.map(decodeURIComponent)});
      const e = pdfs.filter(f => /entr/i.test(decodeURIComponent(f)))[0];
      if (e && out.samples.filter(s => s.site === site).length < 2) { const u = e.startsWith('http') ? e : site + e, t = await text(u); out.samples.push({site, year, url: u, head: (t || '').split('\n').filter(l => l.trim()).slice(0, 45)}); }
    }
    // entry-list pages (HTML) too
    const el = await get(`${site}/entry-lists`) || ''; out.sro.push({site, entryListLinks: links(el, /entry-list\//).slice(0, 30)});
  }
}
// FIA public list
for (const u of ['https://www.fia.com/driver-categorisation', 'https://www.fia.com/node/1406', 'https://www.fia.com/fia-driver-categorisation']) {
  const p = await get(u); if (!p) continue; out.fia[u] = links(p, /\.pdf|categoris/i).slice(0, 40);
}
const L = 'https://www.fia.com/sites/default/files/fia_2024_reviewed_categorisations_list_0.pdf';
const t = await text(L), b = await text(L, ['-bbox-layout', '-f', '2', '-l', '2']);
out.fia.sample = {url: L, head: (t || '').split('\n').filter(l => l.trim()).slice(0, 40), bbox: (b || '').slice(0, 6000)};
try { const buf = await get(L, true); const p = join(TMP, 'f.pdf'); writeFileSync(p, buf); out.fia.images = execFileSync('pdfimages', ['-list', '-f', '2', '-l', '2', p]).toString().split('\n').slice(0, 25); } catch (e) { out.fia.images = 'ERR ' + e.message; }
writeFileSync('scripts/sim/data/learn/probe-driver-ratings.json', JSON.stringify(out, null, 1));
console.log('sro meetings', out.sro.length, 'samples', out.samples.length);
