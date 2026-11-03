import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sessionState} from '../worker/session-state.js';
import {sessionSchedule} from '../worker/session-schedule.js';
import {websiteRoute} from '../worker/website.js';

test('Mexico FP1 badge begins ten minutes before scheduled start and ends on time, independent of device timezone',()=>{
 const sessions=sessionSchedule['f1-2026-10-30-mexico'],event={series:'f1',sessions};
 assert.equal(sessionState(sessions[0],event,Date.parse('2026-10-31T03:19:59+09:00')).phase,'upcoming'
 );
 assert.equal(sessionState(sessions[0],event,Date.parse('2026-10-31T03:20:00+09:00')).phase,'starting-soon');
 assert.equal(sessionState(sessions[0],event,Date.parse('2026-10-31T03:30:00+09:00')).phase,'live');
 assert.equal(sessionState(sessions[0],event,Date.parse('2026-10-31T03:51:00+09:00')).phase,'live');
 assert.equal(sessionState(sessions[0],event,Date.parse('2026-10-31T04:30:00+09:00')).phase,'finished');
 assert.equal(sessionState(sessions[1],event,Date.parse('2026-10-31T04:30:00+09:00')).phase,'upcoming');
});
test('published ends override standard duration; WEC races span midnight; unknown starts are not invented LIVE windows',()=>{
 const s={name:'FP1',start:'2026-10-30T18:30:00Z',end:'2026-10-30T19:45:00Z'};
 assert.equal(sessionState(s,{series:'f1'},Date.parse('2026-10-30T19:31:00Z')).phase,'live');
 assert.equal(sessionState(s,{series:'f1'},Date.parse(s.end)).phase,'finished');
 const race={nameEn:'Race',start:'2026-11-08T22:00:00Z'};
 assert.equal(sessionState(race,{series:'wec',nameEn:'6 Hours of Monza'},Date.parse('2026-11-09T03:59:00Z')).phase,'live');
 assert.equal(sessionState(race,{series:'wec',nameEn:'6 Hours of Monza'},Date.parse('2026-11-09T04:00:00Z')).phase,'finished');
 const unknown={name:'Practice',start:'2026-10-30T10:00:00Z'},event={series:'unknown',sessions:[unknown,{start:'2026-10-30T12:00:00Z'}]};
 assert.equal(sessionState(unknown,event,Date.parse('2026-10-30T11:00:00Z')).phase,'unknown');
 assert.equal(sessionState(unknown,event,Date.parse('2026-10-30T12:00:00Z')).phase,'finished');
 assert.equal(sessionState({start:'invalid'},event).phase,'unknown');
});
test('home exposes independent F1/WEC badge anchors and client updates row states without rebuilding cards',async()=>{
 const html=await websiteRoute(new Request('https://test/',{headers:{cookie:'kongboda_lang=ko'}})).text();
 assert.match(html,/data-live-series="f1"/);assert.match(html,/data-live-series="wec"/);
 assert.match(html,/session-time\.session-finished time/);assert.match(html,/prefers-reduced-motion/);
 const script=await websiteRoute(new Request('https://test/assets/race-features.js')).text();
 new Function(script);
 assert.match(script,/refreshSessionStates/);assert.match(script,/visibilitychange/);assert.match(script,/15000/);
});
