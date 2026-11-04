import test from 'node:test';
import assert from 'node:assert/strict';
import {mergeCalendarEvents,missingSessionCoverage,calendarRoute} from '../worker/calendar-refresh.js';
import {calendarEvents,calendarReviewedAt} from '../worker/race-calendar-data.js';
import {sessionSchedule} from '../worker/session-schedule.js';

const base=()=>calendarEvents.map(e=>({...e,sessions:sessionSchedule[e.id]||[]}));

test('a stale or partial refresh record never drops checked-in events or sessions',()=>{
 const sp=base().find(e=>e.id==='f1-2026-11-06-interlagos');
 // Old saved refresh: same weekend, race only, and only one event of the season.
 const saved=[{...sp,id:'f1-official-sao-paulo-grand-prix-2026-11-06',nameEn:'São Paulo Grand Prix',sessions:[],raceStart:'2026-11-08T14:00:00-03:00'}];
 const merged=mergeCalendarEvents(base().filter(e=>e.series==='f1'),saved);
 assert.equal(merged.length,base().filter(e=>e.series==='f1').length);
 const result=merged.find(e=>e.id==='f1-2026-11-06-interlagos');
 assert.equal(result.sessions.length,5);
 assert.equal(result.raceStart,'2026-11-08T14:00:00-03:00');
});

test('a more complete refreshed timetable replaces a shorter checked-in one',()=>{
 const event={id:'x-2026-12-01-a',series:'x',name:'A',nameEn:'A',start:'2026-12-01',end:'2026-12-02',sessions:[{name:'Race',nameEn:'Race',start:'2026-12-02T10:00:00Z'}]};
 const fresh={...event,id:'x-official-a',sessions:[{name:'FP',nameEn:'FP',start:'2026-12-01T10:00:00Z'},{name:'Race',nameEn:'Race',start:'2026-12-02T10:00:00Z'}]};
 const [merged]=mergeCalendarEvents([event],[fresh]);
 assert.equal(merged.id,event.id);assert.equal(merged.sessions.length,2);
});

test('every event in the week after the calendar review has a session timetable',()=>{
 // Updating calendarReviewedAt requires filling session-schedule.js for the coming week.
 const missing=missingSessionCoverage(base(),Date.parse(calendarReviewedAt+'T00:00:00Z'),7);
 assert.deepEqual(missing,[],'Add official sessions to worker/session-schedule.js for: '+missing.map(m=>m.id).join(', '));
});

test('the public calendar keeps São Paulo and Homestead sessions even with an old saved record',async()=>{
 const sp=base().find(e=>e.id==='f1-2026-11-06-interlagos');
 const now=Date.parse('2026-11-04T05:00:00Z');
 const record={events:[{...sp,sessions:[],id:'old'}],checkedAt:now-3*86400000,attemptedAt:now,error:'Official schedule refresh unavailable',source:'x'};
 const env={BUCKET:{get:async key=>key.endsWith('/f1.json')?{json:async()=>record}:null}};
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),env,{},now)).json();
 assert.equal(data.events.find(e=>e.id==='f1-2026-11-06-interlagos').sessions.length,5);
 assert.ok(data.events.find(e=>e.id==='nascar-2026-11-06-homestead').sessions.length>=9);
 assert.deepEqual(missingSessionCoverage(data.events,now,6),[]);
});
