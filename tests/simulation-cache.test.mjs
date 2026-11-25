import test from 'node:test';
import assert from 'node:assert/strict';
import {simulationPage, lapsimScript} from '../worker/simulation.js';
import {simulationPageCached, simulationFirstView, createFirstViewCache, simulationRequestKey} from '../worker/simulation-cache.js';
import {canonJson, firstViewState} from '../worker/lapsim/view-keys.js';

test('descriptor cache avoids preparation and coalesces concurrent misses; expiry retries only fetching', async()=>{
 let renders=0,fetches=0;
 const data={cars:{'2026':{}},conds:{},carId:'2026'};
 const view=createFirstViewCache({render:(q,l,e,probe)=>{renders++;probe(data,'2026');},version:()=> 'fixture'});
 const fetchImpl=async url=>{fetches++;await new Promise(resolve=>setTimeout(resolve,10));return Response.json({build:url.split('/').at(-2),state:canonJson(firstViewState(data,'2026')),v:{lap:1}});};
 const options={fetchImpl,now:100};
 const values=await Promise.all(Array.from({length:20},()=>view({track:'monza'},'ko',null,options)));
 assert.ok(values.every(v=>v?.v.lap===1));assert.equal(renders,1);assert.equal(fetches,1);
 await view({track:'monza',evo:'1',race:'any'},undefined,null,options);
 assert.equal(renders,1);assert.equal(fetches,1);
 await view({track:'monza'},'ko',null,{fetchImpl,now:3600101});
 assert.equal(renders,1);assert.equal(fetches,2);
});

test('descriptor LRU is bounded and failed fetches expire without repeating preparation', async()=>{
 let renders=0,fetches=0;
 const view=createFirstViewCache({capacity:2,version:()=> 'fixture',render:(q,l,e,probe)=>{renders++;probe({cars:{'2026':{}},conds:{},id:q.track},'2026');}});
 const fetchImpl=async()=>{fetches++;throw Error('offline');};
 for(const now of [1,2,60002])assert.equal(await view({track:'a'},'ko',null,{fetchImpl,now}),null);
 assert.equal(renders,1);assert.equal(fetches,2);
 for(const track of ['b','c','a'])await view({track},'ko',null,{fetchImpl,now:1});
 assert.equal(renders,4);
 assert.notEqual(simulationRequestKey({race:'a'}),simulationRequestKey({race:'b'}));
});

test('normalized variants and race inputs retain exact uncached HTML',()=>{
 for(const [q,lang,energy] of [
  [{track:'invalid',car:'invalid',evo:'yes'},'invalid',{limit:3}],
  [{track:'monza',car:'2025',evo:'1',race:'2025'},'en',null],
  [{track:'monza',car:'2025',evo:'0',race:'2026'},'en',null],
 ])assert.equal(simulationPageCached(q,lang,energy),simulationPage(q,lang,energy));
});

// speed job 2026-11-18: the /simulation page is cached per instance by its inputs; the cached page is the same text
test('cached /simulation page equals a fresh render, and a repeat view is served from memory', () => {
  for (const [q, lang] of [[{track: 'monza'}, 'ko'], [{track: 'monza', car: '2025'}, 'en'], [{track: 'spa-francorchamps', car: 'wec-lmh', evo: '0'}, 'en']]) {
    const a = simulationPageCached(q, lang, null);
    assert.equal(a, simulationPage(q, lang, null));
    const t0 = performance.now(), b = simulationPageCached(q, lang, null);
    assert.equal(b, a); assert.ok(performance.now() - t0 < 50);
  }
  assert.notEqual(simulationPageCached({track: 'monza'}, 'en', null), simulationPageCached({track: 'monza'}, 'ko', null));
});

// first-view job, stage 4: the server draws the stored first view; a missing, wrong or slow view keeps today's page
test('stored first view: used only when build and state match, and the page arrives as the browser draws it', async () => {
  const q = {track: 'suzuka', car: '2025'}, lang = 'en', html = simulationPage(q, lang), data = JSON.parse(html.match(/id="lapsim-data">([\s\S]*?)<\/script>/)[1]);
  let posted = null; const was = globalThis.self; globalThis.self = {postMessage: m => { posted = structuredClone(m); }};
  try { (0, eval)(lapsimScript()); self.onmessage({data: {data}}); self.onmessage({data: {id: 1, state: firstViewState(data, data.carId)}}); } finally { globalThis.self = was; }
  const urls = [], serve = body => async u => { urls.push(u); return new Response(JSON.stringify(body(u))); };
  const good = await simulationFirstView(q, lang, null, {fetchImpl: serve(u => ({build: u.split('/').at(-2), state: canonJson(firstViewState(data, data.carId)), v: posted.v})), now: 1});
  assert.ok(good && good.v); assert.match(urls[0], /^https:\/\/misterkinn\.github\.io\/f1-data-analyst\/views\/[\w-]+\/\w+\.json$/);
  const drawn = simulationPageCached(q, lang, null, good);
  assert.match(drawn, /<output data-out="airTempC">\d+\.\d<\/output>/); assert.match(drawn, /<label class="ls-chan">/);
  assert.equal(await simulationFirstView({track: 'monza'}, lang, null, {fetchImpl: serve(() => ({build: 'other', state: '{}', v: {}})), now: 1}), null);
  assert.equal(await simulationFirstView({track: 'spa-francorchamps'}, lang, null, {fetchImpl: () => new Promise(() => {}), timeoutMs: 20, now: 1}).catch(() => 'threw'), null);
});

// first-view job, stage 4 step 2: the simulator part is one swappable block and the track menu switches without a reload when the
// page script is running (plain form submit otherwise)
test('simulator page is one swappable part with a no-reload track switch', () => {
  const html = simulationPage({track: 'monza'}, 'en');
  assert.match(html, /^<div data-ls-page style="display:contents">/); assert.match(html, /<\/script><\/div>$/);
  assert.match(html, /<select name="track"[^>]*onchange="window\.kbLapsimGo\?kbLapsimGo\(this\.form\):this\.form\.submit\(\)"/);
  assert.match(lapsimScript(), /kbLapsimGo/);
});
