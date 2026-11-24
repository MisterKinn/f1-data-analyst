// Step 15-prep: WEC first push lap after a pit-out, measured from Al Kamel lap-by-lap Analysis files.
// Self-contained (no repo imports) so it runs where files.alkamelcloud.com is reachable (owner's PC or CI).
// Rules: Project doc claude/gate-wec-warmup-evolution-prereg-2026-11-23.md (run definition, filters).
//   node scripts/sim/wec-warmup-measure.mjs 2023,2024,2025 > runs.json   (then gzip into data/learn)
// Output: one row per pit-out run (columns below), raw Al Kamel files are not stored.
const ORIGIN = 'https://files.alkamelcloud.com/';
const YEARS = String(process.argv[2] || '2023,2024,2025').split(',').map(Number);
const TRACK = {'LOSAIL': 'lusail', 'QATAR': 'lusail', 'IMOLA': 'imola', 'SPA FRANCORCHAMPS': 'spa-francorchamps', 'SAO PAULO': 'interlagos',
  'CIRCUIT OF THE AMERICAS': 'austin', 'BAHRAIN INTERNATIONAL CIRCUIT': 'sakhir', 'BARCELONA-CATALUNYA': 'catalunya', 'AUTODROMO NAZIONALE DI MONZA': 'monza',
  'MONZA': 'monza', 'SEBRING': 'sebring', 'AUTODROMO DO ALGARVE': 'portimao', 'ALGARVE': 'portimao', 'LE MANS': 'le-mans', 'FUJI SPEEDWAY': 'fuji', 'FUJI': 'fuji'};
const CLS = c => { const s = String(c).toUpperCase(); return s === 'HYPERCAR' ? 'hypercar' : /^LMP2/.test(s) ? 'lmp2' : s === 'LMGT3' ? 'lmgt3' : /LMGTE/.test(s) ? 'lmgte' : null; };
const typeOf = s => /practice/i.test(s) ? 'practice' : /qualif|hyperpole/i.test(s) ? 'qualifying' : /race/i.test(s) ? 'race' : null;
const secs = t => { const p = String(t || '').trim().split(':').map(Number); return !p.length || p.some(x => !Number.isFinite(x)) ? NaN : p.reduce((a, x) => a * 60 + x, 0); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(u) {
  for (let a = 0; ; a++) {
    try { const r = await fetch(new URL(u, ORIGIN).href, {signal: AbortSignal.timeout(90000)}); if (r.ok) return r; if (a > 3 || r.status === 404) throw Error(r.status + ' ' + u); }
    catch (e) { if (a > 3) throw e; }
    await sleep(3000 * (a + 1));
  }
}
const csv = txt => { const L = txt.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim()); const h = L.shift().split(';').map(s => s.trim());
  return L.map(l => { const v = l.split(';'); return Object.fromEntries(h.map((k, i) => [k, (v[i] ?? '').trim()])); }); };

const idx = await (await get('wec/manifests/results.json')).json();
const columns = ['year', 'track', 'type', 'session', 'cls', 'car', 'k1', 'k2', 'k3', 'k4', 'k5', 'k6', 'best', 'trackC', 'airC', 'pitS', 'minute', 'first'];
const runs = [], log = [];
for (const year of YEARS) {
  const season = idx.seasons.find(s => String(s.name) === String(year)); if (!season) { log.push(`${year}: no season`); continue; }
  const m = await (await get(season.manifestUrl)).json(), files = [];
  const flat = (ns, f = []) => { for (const n of ns || []) { if (n.url) files.push({t: n.name, u: n.url, f}); else flat(n.children, [...f, n.name].filter(Boolean)); } };
  flat(m.folders);
  for (const ev of [...new Set(files.map(x => x.f[0]))]) {
    const track = TRACK[ev.replace(/^\d+_/, '').toUpperCase()]; if (!track) { log.push(`${year} ${ev}: unmapped`); continue; }
    const F = files.filter(x => x.f[0] === ev && x.f[1] === 'FIA WEC' && /\.csv$/i.test(x.u));
    // one Analysis file per session folder; races are published per hour (cumulative): take the last hour
    const bySes = {};
    for (const x of F.filter(x => /Analysis_/i.test(x.t))) {
      const ses = x.f[2] || x.t, type = typeOf(ses); if (!type) continue;
      const hour = Number((x.f.slice(3).join(' ') + ' ' + x.t).match(/Hour (\d+)/i)?.[1] ?? 1e6);
      if (!bySes[ses] || hour > bySes[ses].hour) bySes[ses] = {x, hour, type};
    }
    for (const [ses, {x, type}] of Object.entries(bySes)) {
      try {
        const recs = csv(await (await get(x.u)).text());
        const w = F.find(y => y.f[2] === x.f[2] && y.f.slice(3).join('/') === x.f.slice(3).join('/') && /Weather_/i.test(y.t));
        const W = w ? csv(await (await get(w.u)).text()).map(r => ({tr: Number(r.TRACK_TEMP), air: Number(r.AIR_TEMP), rain: Number(r.RAIN)})).filter(r => Number.isFinite(r.tr)) : [];
        const lapsOf = {}; let elMax = 0;
        for (const r of recs) {
          const t = secs(r.LAP_TIME), el = secs(r.ELAPSED); if (!(t > 30) || !Number.isFinite(el)) continue;
          elMax = Math.max(elMax, el);
          (lapsOf[r.NUMBER] ||= []).push({lap: Number(r.LAP_NUMBER), t, el, pit: !!r.CROSSING_FINISH_LINE_IN_PIT, flag: r.FLAG_AT_FL, pitS: secs(r.PIT_TIME), cls: CLS(r.CLASS)});
        }
        let n0 = runs.length;
        for (const [car, L] of Object.entries(lapsOf)) {
          L.sort((a, b) => a.lap - b.lap);
          const cls = L[0].cls; if (!cls) continue;
          const green = L.filter((l, i) => !l.pit && !(i > 0 && L[i - 1].pit) && l.flag === 'GF');
          if (!green.length) continue;
          const best = Math.min(...green.map(l => l.t));
          for (let i = 0; i < L.length; i++) {
            const o = L[i], first = i === 0 && type !== 'race';
            if (!(first || (i > 0 && L[i - 1].pit && L[i - 1].lap === o.lap - 1))) continue;   // o = out-lap
            if (o.pit || o.flag !== 'GF') continue;
            const k = [];
            for (let j = 1; j <= 6; j++) { const l = L[i + j]; if (!l || l.lap !== o.lap + j || l.pit || l.flag !== 'GF') break; k.push(l.t); }
            if (k.length < 3) continue;
            const wi = W.length ? Math.min(W.length - 1, Math.max(0, Math.round((L[i + 1].el / Math.max(1, elMax)) * (W.length - 1)))) : -1;
            if (wi >= 0 && W[Math.max(0, wi - 2)]?.rain > 0 || W[wi]?.rain > 0) continue;   // rain near the run: out
            const pitS = Number.isFinite(o.pitS) ? o.pitS : (i > 0 && Number.isFinite(L[i - 1].pitS) ? L[i - 1].pitS : null);
            runs.push([year, track, type, ses, cls, car, ...[0, 1, 2, 3, 4, 5].map(j => k[j] ?? null), best,
              wi >= 0 ? W[wi].tr : null, wi >= 0 ? W[wi].air : null, pitS, Math.round((L[i + 1].el - L[i + 1].t) / 0.6) / 100, first ? 1 : 0]);
          }
        }
        log.push(`${year} ${track} ${ses}: ${recs.length} laps, ${runs.length - n0} runs, weather ${W.length}`);
      } catch (e) { log.push(`${year} ${track} ${ses}: ${e.message}`); }
    }
  }
}
console.error(log.join('\n'));
console.log(JSON.stringify({source: 'Al Kamel FIA WEC Analysis + Weather CSV (files.alkamelcloud.com), fetched ' + new Date().toISOString().slice(0, 10),
  rule: 'claude/gate-wec-warmup-evolution-prereg-2026-11-23.md', columns, runs}));
