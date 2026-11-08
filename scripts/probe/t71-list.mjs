// Probe: find the Timing71 replay archive API in the site bundle, then list series and replays.
import {writeFileSync, mkdirSync} from 'node:fs';
const get = async u => { const r = await fetch(u, {headers: {'user-agent': 'kongboda-probe'}}); if (!r.ok) throw new Error(u + ' ' + r.status); return r; };
const html = await (await get('https://www.timing71.org/archive')).text();
const srcs = [...html.matchAll(/src="([^"]+\.js)"/g)].map(m => new URL(m[1], 'https://www.timing71.org/').href);
let root = null;
for (const s of srcs) { const js = await (await get(s)).text(); const m = js.match(/"(https:\/\/[a-z0-9.\-]+(?:\/[a-z0-9_\-]+)*)"[^"]{0,80}replays\/series|ARCHIVE_API_ROOT[^"]{0,20}"(https:[^"]+)"/i) || js.match(/https:\/\/[a-z0-9.\-]*timing71\.org[a-z0-9\/_\-]*/gi); console.log(s, m && (m[1] || m[2] || [...new Set(m)].join(' '))); if (m) root ||= m[1] || m[2]; if (!root && Array.isArray(m)) root = [...new Set(m)].find(u => /api|archive/i.test(u)); }
const out = {root, srcs};
if (root) {
  out.series = await (await get(`${root}/replays/series`)).json();
  out.replays = [];
  for (let skip = 0; skip < 20000; skip += 500) { const page = await (await get(`${root}/replays?filter[order]=startTime%20DESC&filter[limit]=500&filter[skip]=${skip}`)).json(); out.replays.push(...page.map(({series, description, startTime, duration, filename, analysisFilename}) => ({series, description, startTime, duration, filename, analysisFilename}))); if (page.length < 500) break; }
}
mkdirSync('probe-out', {recursive: true}); writeFileSync('probe-out/t71.json', JSON.stringify(out, null, 1));
console.log(root, out.series?.length, out.replays?.length);
