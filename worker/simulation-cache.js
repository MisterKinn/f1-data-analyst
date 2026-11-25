// /simulation page cache (speed job 2026-11-18): simulationPage() is a pure function of its inputs (track, car, evo, language and the
// live energy limit) and the data shipped with this build, so a warm server instance returns the same HTML without redoing the laps.
// In memory only, per instance; least recently used pages go first once the pages hold about 40 MB of text. No CDN caching here:
// the page around it carries the user's navigation.
import {simulationPage, lapsimScriptVersion} from './simulation.js';
import {viewHash, canonJson, viewBuildKey, firstViewState} from './lapsim/view-keys.js';

const pages = new Map(), MAX_CHARS = 20e6;
let chars = 0;
// Only normalize inputs with identical renderer semantics. In particular, do
// not replace an invalid track: that would change whether liveEnergy is used.
export function simulationRequestKey(query = {}, lang, liveEnergy, {descriptor = false} = {}) {
  return JSON.stringify([query.track ?? null, query.car ?? null, query.evo === '0' ? '0' : null,
    lang === 'en' ? 'en' : 'ko', liveEnergy || null, descriptor ? null : query.race || null]);
}
export function simulationPageCached(query, lang, liveEnergy, stored = null) {
  const key = JSON.stringify([simulationRequestKey(query, lang, liveEnergy), stored ? stored.file : null]);
  const hit = pages.get(key);
  if (hit !== undefined) { pages.delete(key); pages.set(key, hit); return hit; }
  const html = simulationPage(query, lang, liveEnergy, stored ? () => stored.v : null);
  if (html.length > MAX_CHARS) return html;
  pages.set(key, html); chars += html.length;
  for (const [k, h] of pages) { if (chars <= MAX_CHARS || k === key) break; pages.delete(k); chars -= h.length; }
  return html;
}

// First-view job, stage 4: the stored first view (GitHub Pages, scripts/sim/precompute-views.mjs) of the car this URL opens, so the
// server draws the page as the browser will show it. Same keys as the page script; a missing, different or slow (400 ms) view gives
// null and the page is computed here as before. Answers are kept per instance (views for 1 h, misses for 1 min).
const VIEWS = 'https://misterkinn.github.io/f1-data-analyst/views/';
class Probe { constructor(data, carId) { this.data = data; this.carId = carId; } }
export function createFirstViewCache({render = simulationPage, version = lapsimScriptVersion, capacity = 128} = {}) {
 if(!Number.isInteger(capacity)||capacity<1)throw Error('Invalid first-view cache capacity');
 const descriptors = new Map(), found = new Map(), pending = new Map();
 const remember = (map, key, value) => {
  map.delete(key); map.set(key, value);
  while (map.size > capacity) map.delete(map.keys().next().value);
 };
 return async function firstView(query, lang, liveEnergy, {fetchImpl = fetch, timeoutMs = 400, now = Date.now()} = {}) {
  const key = simulationRequestKey(query, lang, liveEnergy, {descriptor:true});
  let descriptor = descriptors.get(key);
  if (!descriptor) {
   let probe;
   try { render(query, lang, liveEnergy, (data, carId) => { throw new Probe(data, carId); }); } catch (e) { if (!(e instanceof Probe)) return null; probe = e; }
   if (!probe) return null;
   const build = viewBuildKey(version(), JSON.stringify(probe.data)), state = canonJson(firstViewState(probe.data, probe.carId));
   descriptor = {build, state, file:build + '/' + viewHash(state) + '.json'};
  }
  remember(descriptors, key, descriptor);
  const {build, state, file} = descriptor, hit = found.get(file);
  if (hit && hit.until > now) { remember(found, file, hit); return hit.view; }
  if (pending.has(file)) return pending.get(file);
  // Bound concurrent misses too. A saturated cache falls back to the existing
  // local renderer rather than retaining an unbounded queue of external fetches.
  if (pending.size >= capacity) return null;
  const task = (async () => {
   let view = null;
   try {
    const ac = new AbortController(); let timer;
    const late = new Promise((_, no) => { timer = setTimeout(() => { ac.abort(); no(Error('slow')); }, timeoutMs); });
    const j = await Promise.race([Promise.resolve().then(() => fetchImpl(VIEWS + file, {signal:ac.signal})).then(r => r.ok ? r.json() : null), late]).finally(() => clearTimeout(timer));
    view = j && j.build === build && j.state === state ? {file, v:j.v} : null;
   } catch { view = null; }
   remember(found, file, {view, until:now + (view ? 3600e3 : 60e3)});
   return view;
  })();
  pending.set(file, task);
  try { return await task; } finally { pending.delete(file); }
 };
}
export const simulationFirstView = createFirstViewCache();
