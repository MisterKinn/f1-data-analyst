import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshCalendarSource,calendarRoute} from '../worker/calendar-refresh.js';

const store=()=>{const saved=new Map();return {BUCKET:{get:async key=>saved.has(key)?{json:async()=>JSON.parse(saved.get(key))}:null,put:async(key,value)=>{saved.set(key,value);}}};};
// 2026-11-14: no WEC event within three weeks, home page has no dates or timetable.
const now=Date.parse('2026-11-14T03:00:00Z');

test('a reachable organiser page with nothing published yet is not a refresh error',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('<html><a href="/en/news/x">news</a></html>',{status:200}));
 const env=store(),result=await refreshCalendarSource(env,'wec',now);
 assert.equal(result.error,null);
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),env,{},now)).json();
 const status=data.sourceStatus.find(s=>s.series==='wec');
 assert.equal(status.available,true);assert.equal(status.error,null);assert.equal(status.note,'Nothing new published yet');
 assert.ok(data.events.some(e=>e.series==='wec'&&e.start>='2027'),'checked-in events stay');
});

test('an organiser page that does not answer is still an error',async t=>{
 t.mock.method(globalThis,'fetch',async()=>new Response('down',{status:503}));
 const result=await refreshCalendarSource(store(),'wec',now);
 assert.equal(result.error,'Official schedule refresh unavailable');
});

// fia.com / wrc.com, 17 Sep 2026: Rally Saudi Arabia left the WRC; it runs as the FIA MERC final.
test('Rally Saudi Arabia is labelled as the FIA Middle East Rally Championship, not WRC',async()=>{
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),{},{},now)).json();
 const saudi=data.events.find(e=>e.circuit==='rally-saudi');
 assert.equal(saudi.seriesLabel,'FIA MERC');assert.match(saudi.nameEn,/Middle East Rally Championship/);
 assert.ok(saudi.sessions.length>=4,'timetable still attached');
});
