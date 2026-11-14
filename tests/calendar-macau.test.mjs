import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarRoute,missingSessionCoverage} from '../worker/calendar-refresh.js';

test('the Macau Grand Prix week carries the official programme, so the 10-day gap check is clean',async()=>{
 const now=Date.parse('2026-11-16T00:00:00Z');
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),{},{},now)).json();
 const macau=data.events.find(e=>e.id==='macau-2026-11-19-guia');
 assert.equal(macau.sessions.length,35);
 assert.equal(macau.sessions[0].start,'2026-11-19T07:45:00+08:00');
 const final=macau.sessions.at(-1);assert.equal(final.nameEn,'Macau Grand Prix · FR World Cup');assert.equal(final.start,'2026-11-22T15:30:00+08:00');assert.equal(final.end,'2026-11-22T16:35:00+08:00');
 assert.ok(macau.sessions.every((s,i,all)=>!i||Date.parse(all[i-1].start)<Date.parse(s.start)));
 assert.deepEqual(missingSessionCoverage(data.events,now,10).filter(m=>m.series==='macau'),[]);
});
