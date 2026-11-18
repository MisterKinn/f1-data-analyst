// /simulation page cache (speed job 2026-11-18): simulationPage() is a pure function of its inputs (track, car, evo, language and the
// live energy limit) and the data shipped with this build, so a warm server instance returns the same HTML without redoing the laps.
// In memory only, per instance; least recently used pages go first once the pages hold about 40 MB of text. No CDN caching here:
// the page around it carries the user's navigation.
import {simulationPage, lapsimScriptVersion} from './simulation.js';
import {viewHash, canonJson, viewBuildKey, firstViewState} from './lapsim/view-keys.js';

const pages = new Map(), MAX_CHARS = 20e6;
let chars = 0;
export function simulationPageCached(query, lang, liveEnergy, stored = null) {
  const key = JSON.stringify([query.track ?? null, query.car ?? null, query.evo ?? null, lang, liveEnergy ?? null, stored ? stored.file : null]);
  const hit = pages.get(key);
  if (hit !== undefined) { pages.delete(key); pages.set(key, hit); return hit; }
  const html = simulationPage(query, lang, liveEnergy, stored ? () => stored.v : null);
  pages.set(key, html); chars += html.length;
  for (const [k, h] of pages) { if (chars <= MAX_CHARS || k === key) break; pages.delete(k); chars -= h.length; }
  return html;
}

// First-view job, stage 4: the stored first view (GitHub Pages, scripts/sim/precompute-views.mjs) of the car this URL opens, so the
// server draws the page as the browser will show it. Same keys as the page script; a missing, different or slow (400 ms) view gives
// null and the page is computed here as before. Answers are kept per instance (views for 1 h, misses for 1 min).
const VIEWS = 'https://misterkinn.github.io/f1-data-analyst/views/', found = new Map();
class Probe { constructor(data, carId) { this.data = data; this.carId = carId; } }
export async function simulationFirstView(query, lang, liveEnergy, {fetchImpl = fetch, timeoutMs = 400, now = Date.now()} = {}) {
  let probe;
  try { simulationPage(query, lang, liveEnergy, (data, carId) => { throw new Probe(data, carId); }); } catch (e) { if (!(e instanceof Probe)) return null; probe = e; }
  if (!probe) return null;
  const build = viewBuildKey(lapsimScriptVersion(), JSON.stringify(probe.data)), state = canonJson(firstViewState(probe.data, probe.carId));
  const file = build + '/' + viewHash(state) + '.json', hit = found.get(file);
  if (hit && hit.until > now) return hit.view;
  let view = null;
  try {
    const r = await fetchImpl(VIEWS + file, {signal: AbortSignal.timeout(timeoutMs)}), j = r.ok ? await r.json() : null;
    view = j && j.build === build && j.state === state ? {file, v: j.v} : null;
  } catch { view = null; }
  if (found.size > 500) found.clear();
  found.set(file, {view, until: now + (view ? 3600e3 : 60e3)});
  return view;
}
