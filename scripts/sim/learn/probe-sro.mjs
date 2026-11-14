// What one SRO meeting page holds (structure for the GT3 reader): tables, session selector, result files.
import {writeFileSync} from 'node:fs';
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
const get = async u => { try { const r = await fetch(u, {...UA, redirect: 'follow', signal: AbortSignal.timeout(30000)}); return {status: r.status, url: r.url, text: await r.text()}; } catch (e) { return {error: String(e.message)}; } };
const strip = t => t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
const out = {};
for (const u of ['https://www.gt-world-challenge-europe.com/results/2025/brands-hatch', 'https://www.gt-world-challenge-europe.com/results?filter_season_id=25&filter_meeting_id=0', 'https://www.gt-world-challenge-asia.com/results/2025/shanghai-international-circuit', 'https://www.intercontinentalgtchallenge.com/results/2025/suzuka-1000km', 'https://www.britishgt.com/results/2025/brands-hatch']) {
  const r = await get(u), t = r.text || '';
  const tables = [...t.matchAll(/<table[\s\S]*?<\/table>/g)].map(m => [...m[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].slice(0, 12).map(x => strip(x[0]).trim()));
  const selects = [...t.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)].map(m => ({name: m[1], options: [...m[2].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)].map(o => [o[1], o[2].trim()]).slice(0, 60)}));
  const files = [...new Set([...t.matchAll(/href="([^"]+\.(?:pdf|csv|json|xml)[^"]*)"/gi)].map(m => m[1]))].slice(0, 120);
  const api = [...new Set([...t.matchAll(/["'`](\/?(?:api|ajax|results)[^"'`\s]{3,120})["'`]/g)].map(m => m[1]))].slice(0, 60);
  out[u] = {status: r.status, error: r.error, bytes: t.length, tables, selects, files, api, text: strip(t).slice(0, 4000)};
}
writeFileSync('scripts/sim/data/learn/probe-sro.json', JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([u, o]) => `${o.status ?? o.error} ${o.bytes} tables ${o.tables?.length} files ${o.files?.length} ${u}`).join('\n'));
