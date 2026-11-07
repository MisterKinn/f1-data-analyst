import test from 'node:test';
import assert from 'node:assert/strict';
import {openf1Call,openf1Get,clearOpenf1Cache,openf1CacheStats,CACHE_POLICY,telemetryRows,OPENF1_TOOLS} from '../worker/openf1.js';

// Shapes copied from real OpenF1 answers (2026 Mexico City GP race, session 11404, Russell #63).
const lap1={meeting_key:1298,session_key:11404,driver_number:63,lap_number:1,date_start:'2026-11-01T20:03:25.510000+00:00',duration_sector_1:33.161,duration_sector_2:33.747,duration_sector_3:21.358,is_pit_out_lap:true,lap_duration:88.266,st_speed:292};
const lap2={...lap1,lap_number:2,date_start:'2026-11-01T20:04:53.776000+00:00',duration_sector_1:27.997,duration_sector_2:32.543,duration_sector_3:21.281,is_pit_out_lap:false,lap_duration:81.821,st_speed:352};
const car=[['20:03:25.409',0,30,0,1,12031],['20:03:25.969',0,29,0,1,11038],['20:03:26.249',10,29,0,1,9078],['20:03:26.529',21,29,0,1,7118],['20:03:28.809',110,79,0,1,11159],['20:03:29.729',153,100,0,3,11252],['20:03:39.729',292,92,100,7,11209]]
 .map(([t,speed,throttle,brake,n_gear,rpm])=>({date:'2026-11-01T'+t+'000+00:00',session_key:11404,driver_number:63,speed,throttle,brake,n_gear,rpm,drs:null}));
const stints=[{session_key:11404,driver_number:63,stint_number:1,lap_start:1,lap_end:20,compound:'SOFT',tyre_age_at_start:3}];

function fakeFetch(calls){
 return async url=>{calls.push(url);const u=new URL(url),p=u.pathname.split('/').pop();
  const body=p==='laps'?[lap1,lap2]:p==='stints'?stints:p==='car_data'?car:p==='drivers'?[{driver_number:63,name_acronym:'RUS',team_name:'Mercedes'}]:p==='sessions'?[{session_key:11404,meeting_key:1298,session_name:'Race',session_type:'Race',country_name:'Mexico',location:'Mexico City',date_start:'2026-11-01T20:00:00+00:00'}]:[];
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});};
}
const parse=r=>JSON.parse(r.content[0].text);

test('tools are read-only and named for post-session use',()=>{
 assert.deepEqual(OPENF1_TOOLS.map(t=>t.name),['f1_sessions','f1_laps','f1_lap_telemetry']);
 assert.ok(OPENF1_TOOLS.every(t=>t.annotations.readOnlyHint));
});

test('race start: lap 1 with seconds starts 3 s early and asks OpenF1 only for that window',async()=>{
 clearOpenf1Cache();const calls=[];
 const out=parse(await openf1Call('f1_lap_telemetry',{session_key:11404,driver_number:'63',lap_number:1,seconds:15},{fetchImpl:fakeFetch(calls)}));
 assert.equal(out.state,'ready');
 const lap=out.laps[0];
 assert.equal(lap.lap_number,1);assert.equal(lap.tyre.compound,'SOFT');assert.equal(lap.tyre.tyre_age,3);
 assert.equal(lap.window.seconds_before_lap_start,3);
 const q=decodeURIComponent(calls.find(c=>c.includes('car_data')));
 assert.match(q,/date>=2026-11-01T20:03:22\.510Z/);assert.match(q,/date<=2026-11-01T20:03:40\.510Z/);
 assert.equal(lap.samples[0][2],0);assert.equal(lap.samples.at(-1)[4],1,'brake as on/off');
 assert.ok(lap.samples.at(-1)[1]>30,'speed-integrated distance grows');assert.equal(lap.gaps_seconds.length,2,'holes in the fixture are reported, not bridged');
 assert.match(out.source,/OpenF1/);
});

test('default lap is the best timed lap (pit-out laps never count)',async()=>{
 clearOpenf1Cache();
 const out=parse(await openf1Call('f1_laps',{session_key:11404,driver_number:'63'},{fetchImpl:fakeFetch([])}));
 assert.equal(out.best_lap.lap_number,2);assert.equal(out.best_lap.lap_time,'1:21.821');assert.equal(out.driver,'RUS');
 assert.equal(out.laps[0].pit_out_lap,true);
});

test('sessions are found by place',async()=>{
 clearOpenf1Cache();
 const out=parse(await openf1Call('f1_sessions',{year:2026,place:'mexico',session_name:'Race'},{fetchImpl:fakeFetch([])}));
 assert.equal(out.sessions[0].session_key,11404);
});

test('cache: a repeated question does not call OpenF1 again; 429 is retried then reported',async()=>{
 clearOpenf1Cache();const calls=[];const io={fetchImpl:fakeFetch(calls)};
 await openf1Get('laps',{session_key:11404,driver_number:63},io);await openf1Get('laps',{session_key:11404,driver_number:63},io);
 assert.equal(calls.length,1);
 let n=0;const busy={fetchImpl:async()=>{n++;return new Response('{}',{status:429});},wait:async()=>{}};
 await assert.rejects(openf1Get('laps',{session_key:1},busy),/rate-limiting/);assert.equal(n,3);
});

// Session metadata as OpenF1 returns it; date_end is the scheduled end.
function sessionFetch(calls,dateEnd){
 const base=fakeFetch(calls);
 return async url=>new URL(url).pathname.endsWith('/sessions')&&url.includes('session_key=')?(calls.push(url),new Response(JSON.stringify([{session_key:11404,date_end:dateEnd}]),{status:200})):base(url);
}
const END=Date.parse('2026-11-01T22:00:00Z');

test('settled session: one driver question fills the cache for every driver for 30 min',async()=>{
 clearOpenf1Cache();const calls=[];const io={fetchImpl:sessionFetch(calls,'2026-11-01T22:00:00+00:00'),now:END+3*3600_000};
 const first=parse(await openf1Call('f1_laps',{session_key:11404,driver_number:'63'},io));
 assert.equal(first.cache.policy,'settled session: kept up to 30 min');
 const n=calls.length;
 const second=parse(await openf1Call('f1_laps',{session_key:11404,driver_number:'44'},{...io,now:io.now+20*60_000}));
 assert.equal(calls.length,n,'another driver in the same session needs no new OpenF1 request');
 assert.equal(second.cache.fetched_from_openf1,0);assert.ok(second.cache.served_from_memory>0);
 assert.ok(!calls.some(c=>c.includes('/laps?')&&c.includes('driver_number')),'laps are fetched for the whole session');
 await openf1Call('f1_laps',{session_key:11404,driver_number:'63'},{...io,now:io.now+31*60_000});
 assert.ok(calls.length>n,'after 30 min the data is fetched again');
});

test('running or just-finished session is kept only 1 min',async()=>{
 clearOpenf1Cache();const calls=[];const io={fetchImpl:sessionFetch(calls,'2026-11-01T22:00:00+00:00'),now:END+30*60_000};
 const out=parse(await openf1Call('f1_laps',{session_key:11404,driver_number:'63'},io));
 assert.equal(out.cache.policy,'running or just-finished session: kept up to 1 min');
 const n=calls.length;
 await openf1Call('f1_laps',{session_key:11404,driver_number:'63'},{...io,now:io.now+30_000});
 assert.equal(calls.length,n,'a burst within a minute is served from memory');
 await openf1Call('f1_laps',{session_key:11404,driver_number:'63'},{...io,now:io.now+90_000});
 assert.ok(calls.length>n,'late corrections are picked up after a minute');
});

test('cache is capped by size; oversized answers are not kept',async()=>{
 clearOpenf1Cache();const calls=[];
 const huge='['+'1,'.repeat(4*1024*1024)+'1]';
 const io={fetchImpl:async u=>{calls.push(u);return new Response(huge,{status:200});}};
 await openf1Get('car_data',{session_key:1},io,60_000);await openf1Get('car_data',{session_key:1},io,60_000);
 assert.equal(calls.length,2,'a single answer over a quarter of the cap is never cached');
 assert.equal(openf1CacheStats().entries,0);
 const small={fetchImpl:fakeFetch([])};
 for(let i=0;i<CACHE_POLICY.MAX_ENTRIES+5;i++)await openf1Get('laps',{session_key:i},small,60_000);
 assert.equal(openf1CacheStats().entries,CACHE_POLICY.MAX_ENTRIES);
 assert.ok(openf1CacheStats().bytes<=CACHE_POLICY.MAX_BYTES);
});

test('bad driver numbers are refused',async()=>{
 await assert.rejects(openf1Call('f1_laps',{session_key:1,driver_number:'RUS'}),/racing number/);
});

test('telemetry rows integrate distance from speed',()=>{
 const rows=telemetryRows([{date:'2026-01-01T00:00:00Z',speed:0},{date:'2026-01-01T00:00:01Z',speed:36}],Date.parse('2026-01-01T00:00:00Z'));
 assert.equal(rows[1][1],5);
});
