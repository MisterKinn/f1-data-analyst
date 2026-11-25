// Step 16: the full Al Kamel lap files (every lap with sectors, pit lane, driver, flag; weather), stored for later analysis.
// Sources (the same official hosts the other fetchers read): FIA WEC (files.alkamelcloud.com manifests), ELMS (elms.alkamelsystems.com),
// IMSA Daytona 24 (imsa.results.alkamelcloud.com). Per session: the lap file (WEC Analysis_*, ELMS 23_Analysis*, IMSA Time Cards) and
// the weather file; endurance races keep the last "Hour N" folder (it holds every lap). Spa 24 Hours is SRO timing, not Al Kamel.
// Raw files stay out of git (physics rule 9): each is gzipped into .cache/alkamel-full-laps/ and the workflow uploads the folder as a
// draft release asset. Committed: the manifest (URL, fetch date, checksum, rows, columns, laps per car) and the coverage table.
// Polite: robots.txt is read per host, one request at a time, at least GAP ms apart; files already in the manifest are not fetched again.
//   node scripts/sim/learn/fetch-alkamel-full-laps.mjs [--years=2023,2024,2025] [--series=wec,elms,imsa]
import {mkdirSync, writeFileSync, readFileSync, existsSync} from 'node:fs';
import {gzipSync, gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dirname, join} from 'node:path';
import {archive, alkamelUrl} from '../../../worker/wec.js';
import {officialArchive, officialUrl} from '../../../worker/official.js';
import {sessionFile, sessionKind} from './fetch-alkamel-laps.mjs';
import {MANIFEST, STORE, csvRows, fileStats, readManifest, coverageMarkdown} from './alkamel-full-laps.mjs';

const GAP = +(process.env.ALKAMEL_GAP_MS || 1500), UA = 'kongboda-motorsports lap simulator (official results reader; github.com/MisterKinn/f1-data-analyst)';
const arg = (k, d) => (process.argv.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3) || d).split(',');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// robots.txt rules for "*" (or our agent); a missing file allows everything
const robots = new Map();
export function disallowed(text, path) {
  let applies = false; const rules = [];
  for (const line of String(text).split(/\r?\n/)) { const [k, ...v] = line.replace(/#.*/, '').split(':'), val = v.join(':').trim(), key = k.trim().toLowerCase();
    if (key === 'user-agent') applies = val === '*' || /kongboda/i.test(val); else if (applies && key === 'disallow' && val) rules.push(val); }
  return rules.some(r => path.startsWith(r));
}
let last = 0;
async function get(url) {
  const u = new URL(url);
  if (!robots.has(u.host)) { await sleep(Math.max(0, last + GAP - Date.now())); last = Date.now();
    const r = await fetch(`${u.origin}/robots.txt`, {headers: {'user-agent': UA}, signal: AbortSignal.timeout(30000)}).catch(() => null);
    robots.set(u.host, r?.ok && !/html/i.test(r.headers.get('content-type') || '') ? await r.text() : ''); }
  if (disallowed(robots.get(u.host), decodeURIComponent(u.pathname))) throw Error(`robots.txt disallows ${u.pathname}`);
  for (let i = 0; i < 4; i++) {
    await sleep(Math.max(0, last + GAP - Date.now())); last = Date.now();
    try {
      const r = await fetch(url, {headers: {'user-agent': UA}, signal: AbortSignal.timeout(120000)});
      if (r.ok) { const b = Buffer.from(await r.arrayBuffer()); return {bytes: b[0] === 0x1f && b[1] === 0x8b ? gunzipSync(b) : b, lastModified: r.headers.get('last-modified'), etag: r.headers.get('etag')}; }
      if (r.status === 404) throw Error('HTTP 404');
      await sleep((+r.headers.get('retry-after') || 10) * 1000);
    } catch (e) { if (/404|robots/.test(e.message)) throw e; await sleep(5000 * (i + 1)); }
  }
  throw Error('unreachable after 4 tries');
}

// one candidate file per (series, season, event, session, kind of file): the last hour of the session
export function pickFiles(files) {
  const best = new Map();
  for (const f of files) {
    const sf = sessionFile(new URL(f.url).pathname); if (!sf) continue;
    const name = sf.file, kind = /^(\d+_)?(Analysis|Time ?Cards)/i.test(name) || /time.?cards/i.test(f.title || '') ? 'analysis' : /^(\d+_)?Weather/i.test(name) ? 'weather' : null;
    if (!kind || !/\.csv$/i.test(name) || /ByLap|Sequence/i.test(name)) continue;
    const pref = /AnalysisEnduranceWithSections/i.test(name) ? 1 : 0, k = [f.series, f.season, f.event, sf.session, kind].join('|'), prev = best.get(k);
    if (!prev || sf.hour > prev.hour || (sf.hour === prev.hour && pref > prev.pref)) best.set(k, {...f, session: sf.session.replace(/^\d{12}_/, ''), start: sf.session.slice(0, 12), champ: sf.champ.replace(/^\d+_/, ''), hour: sf.hour, file: kind, pref});
  }
  return [...best.values()];
}

// candidate files per series, with the event name and the season as a number
async function* candidates(series, years) {
  const inYears = name => years.find(y => String(name).includes(y));
  if (series === 'wec') {
    for (const s of (await archive()).records) { const y = inYears(s.name); if (!y || /-/.test(s.name)) continue;
      const a = await archive(s.season_id);
      yield a.files.filter(f => f.folders[1] === 'FIA WEC' && f.format === 'csv').map(f => ({series, season: +y, event: f.folders[0], title: f.title, url: alkamelUrl(f.url)})); }
    return;
  }
  // IMSA: Daytona 24 only by default; --imsa=all adds every other WeatherTech event, practice and qualifying files only (step 36: σ_meas
  // needs qualifying laps; race files of every event are large and not needed)
  const champ = series === 'elms' ? /European Le Mans Series/i : /WeatherTech/i, allImsa = arg('imsa', 'daytona')[0] === 'all',
    event = series === 'elms' ? () => true : n => !/roar|test/i.test(n) && (allImsa || /daytona/i.test(n));
  for (const s of (await officialArchive(series)).seasons) { const y = inYears(s.id + ' ' + s.name); if (!y) continue;
    for (const ev of (await officialArchive(series, s.id)).events.filter(e => event(e.name))) {
      const {files} = await officialArchive(series, s.id, ev.id);
      const short = series === 'imsa' && !/daytona/i.test(ev.name), keep = f => !short || /practice|qualif/i.test(sessionKind(sessionFile(new URL(officialUrl(f.url)).pathname)?.session || '') || '');
      yield files.filter(f => f.format === 'csv' && champ.test(f.folders[1] || '') && keep(f)).map(f => ({series, season: +y, event: ev.name.replace(/^\d+_/, ''), title: f.title, url: officialUrl(f.url)}));
    } }
}

if (process.argv[1]?.endsWith('fetch-alkamel-full-laps.mjs')) {
  const years = arg('years', '2023,2024,2025'), list = arg('series', 'wec,imsa,elms'), manifest = readManifest(), log = [];
  manifest.files = manifest.files.filter(f => existsSync(join(STORE, f.path)));   // a file whose stored copy was not restored is fetched again
  const have = new Set(manifest.files.map(f => f.url));
  for (const series of list) {
    try {
      for await (const batch of candidates(series, years)) for (const f of pickFiles(batch)) {
        if (have.has(f.url)) continue;
        try {
          const {bytes, lastModified, etag} = await get(f.url), rows = csvRows(bytes.toString('utf8'));
          const path = [f.series, f.season, f.event, f.start + '_' + f.session, f.file + '.csv.gz'].join('/').replace(/[^\w./ -]/g, '_');
          mkdirSync(dirname(join(STORE, path)), {recursive: true}); writeFileSync(join(STORE, path), gzipSync(bytes));
          const st = fileStats(rows);
          manifest.files.push({series: f.series, season: f.season, event: f.event, championship: f.champ, session: f.session, kind: sessionKind(f.session), start: f.start,
            hour: f.hour || null, file: f.file, url: f.url, fetchedAt: new Date().toISOString(), lastModified, etag,
            sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, path, ...(f.file === 'weather' ? {rows: st.rows, columns: st.columns} : st)});
          have.add(f.url); log.push(`${f.series} ${f.season} ${f.event} ${f.session} ${f.file}: ${st.rows} rows, ${st.cars} cars`);
        } catch (e) { log.push(`${f.series} ${f.season} ${f.event} ${f.session} ${f.file}: ${e.message} (${f.url})`); }
      }
    } catch (e) { log.push(`${series}: ${e.message}`); }
  }
  manifest.files.sort((a, b) => a.series.localeCompare(b.series) || a.season - b.season || a.start.localeCompare(b.start) || a.file.localeCompare(b.file));
  Object.assign(manifest, {source: 'Al Kamel Systems official published timing: FIA WEC (files.alkamelcloud.com), ELMS (elms.alkamelsystems.com), IMSA (imsa.results.alkamelcloud.com). Raw files are not in git: draft release asset data-alkamel-full-laps (alkamel-full-laps.tar). Loader: scripts/sim/learn/alkamel-full-laps.mjs.',
    generated: new Date().toISOString().slice(0, 10)});
  mkdirSync(dirname(MANIFEST), {recursive: true}); writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1) + '\n');
  // coverage table between the markers of the doc
  const doc = 'docs/lapsim-alkamel-laps.md', text = readFileSync(doc, 'utf8'), table = coverageMarkdown(manifest);
  writeFileSync(doc, text.replace(/(<!-- coverage:start -->\n)[\s\S]*?(\n<!-- coverage:end -->)/, `$1${manifest.files.length} files (manifest: ${MANIFEST}).\n\n${table}$2`));
  console.log(log.join('\n')); console.log('files', manifest.files.length, 'new', log.filter(l => / rows, /.test(l)).length, 'errors', log.filter(l => !/ rows, /.test(l)).length);
}
