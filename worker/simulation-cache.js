// /simulation page cache (speed job 2026-11-18): simulationPage() is a pure function of its inputs (track, car, evo, language and the
// live energy limit) and the data shipped with this build, so a warm server instance returns the same HTML without redoing the laps.
// In memory only, per instance; least recently used pages go first once the pages hold about 40 MB of text. No CDN caching here:
// the page around it carries the user's navigation.
import {simulationPage} from './simulation.js';

const pages = new Map(), MAX_CHARS = 20e6;
let chars = 0;
export function simulationPageCached(query, lang, liveEnergy) {
  const key = JSON.stringify([query.track ?? null, query.car ?? null, query.evo ?? null, lang, liveEnergy ?? null]);
  const hit = pages.get(key);
  if (hit !== undefined) { pages.delete(key); pages.set(key, hit); return hit; }
  const html = simulationPage(query, lang, liveEnergy);
  pages.set(key, html); chars += html.length;
  for (const [k, h] of pages) { if (chars <= MAX_CHARS || k === key) break; pages.delete(k); chars -= h.length; }
  return html;
}
