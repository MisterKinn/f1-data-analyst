// rerun 2026-11-15
// What the SRO result sites publish (structure only, for the GT3 reader): result list pages and one session page per site.
import {writeFileSync} from 'node:fs';
const SITES = ['gt-world-challenge-europe.com', 'gt-world-challenge-america.com', 'gt-world-challenge-asia.com', 'gt-world-challenge-australia.com', 'intercontinentalgtchallenge.com', 'britishgt.com', 'fanatec-gt-world-challenge-europe.com'];
const UA = {headers: {'user-agent': 'Mozilla/5.0 (kongboda-motorsports lap simulator)'}};
const get = async u => { try { const r = await fetch(u, {...UA, redirect: 'follow', signal: AbortSignal.timeout(30000)}); return {status: r.status, url: r.url, type: r.headers.get('content-type'), text: await r.text()}; } catch (e) { return {error: String(e.message)}; } };
const out = {};
for (const s of SITES) for (const u of [`https://api.${s}/results`, `https://www.${s}/results`, `https://api.${s}/results?season=2025`]) {
  const r = await get(u), t = r.text || '';
  const links = [...new Set([...t.matchAll(/href="([^"]+)"/g)].map(m => m[1]))].filter(l => /result|session|race|season|\.pdf|\.csv|json|api/i.test(l)).slice(0, 200);
  const selects = [...t.matchAll(/<select[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)].map(m => ({name: m[1], options: [...m[2].matchAll(/<option[^>]*value="([^"]*)"[^>]*>([^<]*)/g)].map(o => [o[1], o[2].trim()]).slice(0, 80)}));
  out[u] = {status: r.status, error: r.error, url: r.url, type: r.type, bytes: t.length, selects, links, text: t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000),
    scripts: [...t.matchAll(/(?:fetch|axios\.get|url:)\s*\(?\s*["'`]([^"'`]+)/g)].map(m => m[1]).slice(0, 40)};
  // first result-session link: its structure too
  const first = links.find(l => /results?\/[^?#]+\d/.test(l)); if (first) { const v = await get(new URL(first, r.url || u).href); out[u].sample = {url: first, status: v.status, text: (v.text || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 6000), links: [...new Set([...(v.text || '').matchAll(/href="([^"]+)"/g)].map(m => m[1]))].filter(l => /\.pdf|\.csv|json|download|lap|chart/i.test(l)).slice(0, 80)}; }
}
writeFileSync('scripts/sim/data/learn/probe-sro.json', JSON.stringify(out, null, 1));
console.log(Object.entries(out).map(([u, o]) => `${o.status ?? o.error} ${o.bytes ?? ''} ${u}`).join('\n'));
