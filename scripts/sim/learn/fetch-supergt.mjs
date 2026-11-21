// SUPER GT best laps from the series' own result pages (supergt.net/en/result?series=<year>&gt_class=gt500|gt300&round=RoundN
// &race_num=<session>; robots.txt only closes /wp-admin/). Each session table lists per car: position, machine (team, car, base model
// in brackets for GT300), drivers, laps, best lap (qualifying: one time per driver), tyre and success weight.
// One derived row per car and session in scripts/sim/data/learn/supergt-laps.json.gz. No lap charts are published as pages.
//   node scripts/sim/learn/fetch-supergt.mjs [--years=2024,2025,2026]
import {writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';

const SITE = 'https://supergt.net/en/result', UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
const text = h => h.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&#0?38;|&amp;/g, '&').replace(/&nbsp;/g, ' ');
const squeeze = s => s.replace(/\s+/g, ' ').trim();
export const lapTime = s => { const m = /(\d{1,2})'(\d{2})\.(\d{3})/.exec(s || ''); return m ? +(+m[1] * 60 + +(m[2] + '.' + m[3])).toFixed(3) : null; };
export const kindOf = s => /race/i.test(s) ? 'race' : /qualif/i.test(s) ? 'qualifying' : 'practice';

// one session page -> rows; columns found by their header (Best Lap / Best Time, Laps, Tire, SW)
export function sessionRows(html) {
  const table = /<table class="common races">([\s\S]*?)<\/table>/.exec(html)?.[1]; if (!table) return [];
  const trs = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map(m => m[1]);
  const head = [...(trs.shift() || '').matchAll(/<th>([\s\S]*?)<\/th>/g)].map(m => squeeze(text(m[1])).toLowerCase());
  const col = re => head.findIndex(h => re.test(h));
  const iBest = col(/best/), iLaps = col(/^laps?$/), iTire = col(/tire|tyre/), iSw = col(/^sw$/);
  return trs.map(tr => {
    const td = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m => m[1]); if (td.length < 4) return null;
    const dd = [...(td[2] || '').matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map(m => squeeze(text(m[1])));
    const times = squeeze(text(td[iBest] || '')).split(' ').map(lapTime).filter(Number.isFinite);
    const laps = /(\d+)(?:\/(\d+))?/.exec(text(td[iLaps] || ''));
    return {pos: +squeeze(text(td[0])) || null, car: squeeze(text(td[1])), team: dd[0] || null, machine: dd[1] || null, model: (dd[2] || '').replace(/^\(|\)$/g, '') || null,
      drivers: [...(td[3] || '').matchAll(/<a[^>]*>([^<]+)<\/a>/g)].map(m => squeeze(m[1])), laps: laps ? +laps[1] : null,
      best: times.length ? Math.min(...times) : null, driverTimes: times.length > 1 ? times : undefined,
      tyre: /alt="([^"]+)"/.exec(td[iTire] || '')?.[1] || null, successWeightKg: iSw >= 0 && /\d/.test(text(td[iSw] || '')) ? +squeeze(text(td[iSw])) : null};
  }).filter(r => r && r.car);
}

const get = async u => { for (let i = 0; i < 3; i++) { try { const r = await fetch(u, {...UA, signal: AbortSignal.timeout(45000)}); if (r.ok) return await r.text(); if (r.status === 404) return ''; } catch {} await new Promise(s => setTimeout(s, 3000)); } return ''; };
const wait = ms => new Promise(r => setTimeout(r, ms));

if (process.argv[1]?.endsWith('fetch-supergt.mjs')) {
  const years = (process.argv.find(a => a.startsWith('--years='))?.slice(8) || '2024,2025,2026').split(','), out = [];
  for (const year of years) for (const cls of ['gt500', 'gt300']) for (let n = 1; n <= 9; n++) {
    const q = o => SITE + '?' + new URLSearchParams({series: year, gt_class: cls, ...o, round: 'Round' + n}), base = await get(q({})); await wait(500);
    const sessions = [...new Map([...base.matchAll(/href="[^"]*result\?[^"]*race_num=(\d+)[^"]*"[^>]*>([^<]+)</g)].map(m => [m[1], squeeze(m[2]).replace(/^\d+-\d+\([A-Za-z]+\)\s*/, '')])).entries()];
    if (!sessions.length) continue;
    const event = squeeze(text(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(base)?.[1] || '')) || `Round${n}`;
    for (const [num, session] of sessions) {
      const rows = sessionRows(await get(q({race_num: num}))); await wait(500);
      if (rows.length && !rows.some(r => r.best != null)) { console.log(`${year} ${cls} Round${n} ${session}: no lap times (combined qualifying table), skipped`); continue; }
      for (const r of rows) out.push({series: 'super-gt', season: +year, cls: cls.toUpperCase(), round: n, event, session, kind: kindOf(session), ...r});
      console.log(`${year} ${cls} Round${n} ${session}: ${rows.length} cars, with a best lap ${rows.filter(r => r.best != null).length}`);
    }
  }
  writeFileSync('scripts/sim/data/learn/supergt-laps.json.gz', gzipSync(JSON.stringify({
    source: 'SUPER GT official result pages (supergt.net/en/result). Derived rows only, one per car and session.',
    fields: 'best = best lap (s; qualifying: quicker of the two drivers, driverTimes keeps both); laps; tyre; successWeightKg (SW column); model = base car for GT300',
    fetched: new Date().toISOString().slice(0, 10), rows: out})));
  console.log('rows', out.length);
}
