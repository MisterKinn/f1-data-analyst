import test from 'node:test';
import assert from 'node:assert/strict';
import {openf1Call,openf1Get,clearOpenf1Cache} from '../worker/openf1.js';
import {clearTiCache,tiEvents} from '../worker/tracinginsights.js';

// Shapes copied from TracingInsights/2026 "São Paulo Grand Prix/Qualifying" (session 11408).
const NOW=Date.parse('2026-11-08T00:00:00Z');
const info={session_info:{Meeting:{Key:1299,Name:'São Paulo Grand Prix',Location:'São Paulo',Country:{Name:'Brazil'},Circuit:{ShortName:'Interlagos'}},Key:11408,Type:'Qualifying',Name:'Qualifying',StartDate:'2026-11-07T15:00:00',EndDate:'2026-11-07T16:00:00',GmtOffset:'-03:00:00'}};
// NOR: Q2 1:29.207 (lap 15), Q3 1:27.470 (lap 23), one deleted faster lap (lap 24). RUS: Q2 1:26.745 (lap 18), Q3 1:27.674 (lap 21).
const rows=[
 ['NOR','1',15,89.207,'Q2',false,'2026-11-07T19:59:00.000000000'],['NOR','1',23,87.47,'Q3',false,'2026-11-07T20:17:25.587000000'],['NOR','1',24,87.0,'Q3',true,'2026-11-07T20:19:00.000000000'],
 ['RUS','63',18,86.745,'Q2',false,'2026-11-07T20:00:25.151000000'],['RUS','63',21,87.674,'Q3',false,'2026-11-07T20:16:14.081000000']];
const laptimes={time:rows.map(r=>r[3]),lap:rows.map(r=>r[2]),drv:rows.map(r=>r[0]),dNum:rows.map(r=>r[1]),qs:rows.map(r=>r[4]),del:rows.map(r=>r[5]),delR:rows.map(r=>r[5]?'TRACK LIMITS':'None'),lSD:rows.map(r=>r[6]),
 s1:rows.map(()=>22.5),s2:rows.map(()=>45.8),s3:rows.map(()=>19.1),compound:rows.map(()=>'INTERMEDIATE'),stint:rows.map(()=>4),life:rows.map(()=>3),pout:rows.map(()=>'None'),pin:rows.map(()=>'None'),vst:rows.map(()=>245),pos:rows.map(()=>'None')};
const drivers={drivers:[{driver:'NOR',team:'McLaren',dn:'1'},{driver:'RUS',team:'Mercedes',dn:'63'}]};
// A straight-line lap: the file time ends 0.3 s short of the official time, distance ends short too.
// Speeds match the lap length, because distance is integrated from speed.
const tel=(lapS,lenM,end)=>{const n=120,time=[],distance=[],speed=[];for(let i=0;i<=n;i++){time.push(end*i/n);distance.push(lenM*i/n);speed.push(i%30===15?90:Math.round(lenM/end*3.6*1.03));}
 return {tel:{time,distance,speed,throttle:time.map(()=>100),brake:time.map((_,i)=>i%30===14),gear:time.map(()=>7),rpm:time.map(()=>11000)}};};
const files={
 'São Paulo Grand Prix/Qualifying/session_info.json':info,
 'São Paulo Grand Prix/Qualifying/session_laptimes.json':laptimes,
 'São Paulo Grand Prix/Qualifying/drivers.json':drivers,
 'São Paulo Grand Prix/Qualifying/corners.json':{CornerNumber:[1,2,3],Distance:[531.4,1594.2,2657.1]},
 'São Paulo Grand Prix/Qualifying/NOR/23_tel.json':tel(87.47,4251,87.17),
 'São Paulo Grand Prix/Qualifying/RUS/21_tel.json':tel(87.674,4231,87.674)};
function tiFetch(calls){return async url=>{calls.push(url);const p=decodeURIComponent(url.replace('https://raw.githubusercontent.com/TracingInsights/2026/main/',''));
 return p in files?new Response(JSON.stringify(files[p]),{status:200}):new Response('404: Not Found',{status:404});};}
const openf1Locked=async()=>new Response(JSON.stringify({detail:'Live F1 session in progress.'}),{status:401});
const parse=r=>JSON.parse(r.content[0].text);
const io=calls=>({tiFetch:tiFetch(calls),fetchImpl:openf1Locked,now:NOW});

test('calendar names map to TracingInsights folders',()=>{
 const names=tiEvents(2026,NOW).map(e=>e.folder);
 assert.ok(names.includes('São Paulo Grand Prix'));assert.ok(names.includes('Barcelona Grand Prix'));assert.ok(!names.includes('Las Vegas Grand Prix'),'future events are not listed');
});

test('sessions: "Brazil" finds São Paulo qualifying while OpenF1 is locked',async()=>{
 clearOpenf1Cache();clearTiCache();
 const out=parse(await openf1Call('f1_sessions',{year:2026,place:'Brazil',session_name:'Qualifying'},io([])));
 assert.match(out.source,/TracingInsights/);
 assert.equal(out.sessions[0].session_key,11408);assert.equal(out.sessions[0].date_start,'2026-11-07T18:00:00.000Z');
});

test('laps: best lap skips deleted laps and carries the qualifying segment',async()=>{
 clearOpenf1Cache();clearTiCache();
 const out=parse(await openf1Call('f1_laps',{session_key:11408,driver_number:'1'},io([])));
 assert.equal(out.state,'ready');assert.equal(out.driver,'NOR');
 assert.equal(out.best_lap.lap_number,23,'lap 24 is deleted');assert.equal(out.best_lap.qualifying_segment,'Q3');
 assert.equal(out.laps.find(l=>l.lap_number===24).deleted,true);
 assert.equal(out.best_lap.tyre.compound,'INTERMEDIATE');
});

test('telemetry: unknown session key is found by scanning events; time axis is scaled to the official lap',async()=>{
 clearOpenf1Cache();clearTiCache();
 const out=parse(await openf1Call('f1_lap_telemetry',{session_key:11408,driver_number:'1',lap_number:23,compare_driver_number:'63',compare_lap_number:21},io([])));
 assert.equal(out.state,'ready');assert.match(out.source,/TracingInsights/);
 const [nor,rus]=out.laps;
 assert.equal(nor.time_axis_scaled.official_lap_s,87.47);assert.equal(nor.samples.at(-1)[0],87.47);
 assert.equal(rus.time_axis_scaled,undefined,'already matching');
 assert.equal(nor.samples[14][4],1,'brake as on/off');
 const end=out.delta.points.filter(p=>Number.isFinite(p[1])).at(-1)[1];
 assert.ok(Math.abs(end-0.204)<0.02,'delta ends at the real lap-time gap, not a drift from different lap lengths: '+end);
});

test('falls back to OpenF1 when TracingInsights has not published the session',async()=>{
 clearOpenf1Cache();clearTiCache();
 const lap={session_key:11408,driver_number:1,lap_number:2,date_start:'2026-11-07T20:00:00+00:00',lap_duration:88.1,is_pit_out_lap:false};
 const openf1=async url=>new Response(JSON.stringify(url.includes('/laps')?[lap]:[]),{status:200});
 const empty=async()=>new Response('404: Not Found',{status:404});
 const out=parse(await openf1Call('f1_laps',{session_key:99999,driver_number:'1'},{tiFetch:empty,fetchImpl:openf1,now:NOW}));
 assert.equal(out.best_lap.lap_number,2);assert.match(out.source,/OpenF1/);
});

test('OpenF1 401 (live lock) says what to use instead',async()=>{
 clearOpenf1Cache();
 await assert.rejects(openf1Get('laps',{session_key:1},{fetchImpl:openf1Locked}),/locked for free users.*TracingInsights.*FIA/);
});

test('telemetry: official turn numbers come with the samples and label the corner summary',async()=>{
 clearOpenf1Cache();clearTiCache();
 const args={session_key:11408,driver_number:'1',lap_number:23,compare_driver_number:'63',compare_lap_number:21};
 const raw=parse(await openf1Call('f1_lap_telemetry',args,io([])));
 assert.deepEqual(raw.official_turns,[{turn:'T1',distance_m:531},{turn:'T2',distance_m:1594},{turn:'T3',distance_m:2657}]);
 assert.match(raw.response_format,/official turn/);
 const sum=parse(await openf1Call('f1_lap_telemetry',{...args,summary:true},io([])));
 const turns=sum.laps[0].summary.corners.map(c=>c.turn||null);
 assert.ok(turns.includes('T1'),'speed minimum near 531 m is T1: '+JSON.stringify(sum.laps[0].summary.corners));
 assert.ok(sum.corner_comparison.corners.every(c=>!c.turn||/^T\d+$/.test(c.turn)));
});

test('telemetry from OpenF1 says when official turns are missing',async()=>{
 clearOpenf1Cache();clearTiCache();
 const lap={session_key:99999,driver_number:1,lap_number:2,date_start:'2026-11-07T20:00:00+00:00',lap_duration:88.1,is_pit_out_lap:false};
 const openf1=async url=>new Response(JSON.stringify(url.includes('/laps')?[lap]:[]),{status:200});
 const out=parse(await openf1Call('f1_lap_telemetry',{session_key:99999,driver_number:'1'},{tiFetch:async()=>new Response('',{status:404}),fetchImpl:openf1,now:NOW}));
 assert.equal(out.official_turns,null);assert.match(out.official_turns_note,/not available/);
});

// RUS 2026 São Paulo Q3 lap 21, T1 braking: the file skips 1.0 s (243.8 -> 178 km/h). The file's distance
// column counts that second at 178 km/h (~50 m); the car really covered ~59 m. Distance must be re-integrated.
test('telemetry distance is trapezoid-integrated from speed, not the file distance column, and holes are listed',async()=>{
 clearOpenf1Cache();clearTiCache();
 const time=[],speed=[],distance=[],brake=[];let d=0;
 const push=(t,v,b)=>{if(time.length)d+=v/3.6*(t-time.at(-1));time.push(t);speed.push(v);distance.push(d);brake.push(b);};
 for(let t=0;t<2.25;t+=0.25)push(Number(t.toFixed(2)),294,false);
 push(2.469,243.8,true);push(3.478,178,true);push(3.75,150,true);push(4.0,120,false);push(4.25,90,false);push(4.5,95,false);push(4.75,130,false);
 for(let t=5;t<87.5;t+=0.25)push(Number(t.toFixed(3)),280,false);push(87.674,280,false);
 const lap={tel:{time,distance,speed,throttle:time.map(()=>100),brake,gear:time.map(()=>7),rpm:time.map(()=>11000)}};
 const saved=files['São Paulo Grand Prix/Qualifying/RUS/21_tel.json'];files['São Paulo Grand Prix/Qualifying/RUS/21_tel.json']=lap;
 try{
  const out=parse(await openf1Call('f1_lap_telemetry',{session_key:11408,driver_number:'63',lap_number:21},io([])));
  const rows=out.laps[0].samples,i=rows.findIndex(r=>r[0]===3.478),j=rows.findIndex(r=>r[0]===2.469);
  const covered=rows[i][1]-rows[j][1],trapezoid=(243.8+178)/2/3.6*(3.478-2.469);
  assert.ok(Math.abs(covered-trapezoid)<0.05,`hole step ${covered} m, trapezoid ${trapezoid} m`);
  assert.ok(covered-178/3.6*(3.478-2.469)>8,'not the end-speed (file) value');
  assert.deepEqual(out.laps[0].sample_holes.map(h=>[h.from_s,h.to_s]),[[2.469,3.478]]);
  assert.match(out.limitations.join(' '),/trapezoid/);
  const sum=parse(await openf1Call('f1_lap_telemetry',{session_key:11408,driver_number:'63',lap_number:21,summary:true},io([])));
  const c=sum.laps[0].summary.corners[0];
  assert.equal(c.min_speed_kmh,90);assert.ok(c.brake_start_m>0&&c.brake_start_m<c.distance_m,'brake point found though the brake is off at the apex: '+JSON.stringify(c));
 }finally{files['São Paulo Grand Prix/Qualifying/RUS/21_tel.json']=saved;clearTiCache();}
});

test('shared rule: telemetry gap uses trapezoid distance and checks sample holes',async()=>{
 const {OPENF1_INSTRUCTIONS}=await import('../worker/openf1.js');const {ANSWER_POLICY}=await import('../worker/answer-policy.js');
 assert.match(OPENF1_INSTRUCTIONS,/TELEMETRY DISTANCE AND GAP:.*trapezoid.*sample_holes.*sector times/);
 assert.match(ANSWER_POLICY,/사다리꼴 적분/);assert.match(ANSWER_POLICY,/sample_holes/);
});
