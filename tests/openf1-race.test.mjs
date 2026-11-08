import test from 'node:test';
import assert from 'node:assert/strict';
import {openf1RaceCall,neutralisations,crossings,cleanPace,OPENF1_RACE_TOOLS} from '../worker/openf1-race.js';
import {clearOpenf1Cache,lapSummary} from '../worker/openf1.js';

// A 30-lap race with OpenF1 field names. Car 63 laps 86.0 s; car 12 laps 86.5 s on hards,
// pits under the VSC on lap 28 and then laps 85.0 s on mediums. Red flag on laps 3-4.
const T0=Date.parse('2026-09-06T13:03:30.936Z'),iso=t=>new Date(t).toISOString();
function laps(n,time,{pitLap=null}={}){const out=[];let t=T0;for(let k=1;k<=30;k++){const d=time(k);out.push({session_key:1,driver_number:n,lap_number:k,date_start:iso(t),lap_duration:d,is_pit_out_lap:pitLap!==null&&k===pitLap+1,duration_sector_1:null,duration_sector_2:null,duration_sector_3:null,st_speed:null});t+=d*1000;}return out;}
const slow=k=>k===3||k===4?120:k===28?105:k===29?98:null;
const L63=laps(63,k=>slow(k)??86.0);
const L12=laps(12,k=>k===28?108:k===29?109:slow(k)??(k<28?86.5:85.0),{pitLap:28});
const at=(n,k)=>Date.parse((n===63?L63:L12)[k-1].date_start);
const rc=[
 {date:iso(at(63,3)+20000),lap_number:3,category:'SafetyCar',flag:null,scope:null,driver_number:null,message:'SAFETY CAR DEPLOYED'},
 {date:iso(at(63,3)+60000),lap_number:3,category:'SessionStatus',flag:null,scope:null,driver_number:null,message:'SESSION ABORTED'},
 {date:iso(at(63,3)+61000),lap_number:3,category:'Other',flag:null,scope:null,driver_number:null,message:'RED FLAG - RACE SUSPENDED'},
 {date:iso(at(63,4)+30000),lap_number:4,category:'SessionStatus',flag:null,scope:null,driver_number:null,message:'SESSION STARTED'},
 {date:iso(at(63,11)),lap_number:11,category:'Other',flag:null,scope:null,driver_number:null,message:'CAR 63 (RUS) TIME 1:26.495 DELETED - TRACK LIMITS AT TURN 1 LAP 9 15:50:18'},
 {date:iso(at(63,28)+5000),lap_number:28,category:'SafetyCar',flag:null,scope:null,driver_number:null,message:'VSC DEPLOYED'},
 {date:iso(at(63,29)+20000),lap_number:29,category:'SafetyCar',flag:null,scope:null,driver_number:null,message:'VSC ENDING'},
 {date:iso(at(63,29)+30000),lap_number:29,category:'Flag',flag:'BLUE',scope:'Driver',driver_number:77,message:'WAVED BLUE FLAG FOR CAR 77 (BOT) TIMED AT 16:19:41'},
 {date:iso(at(63,30)),lap_number:30,category:'Other',flag:null,scope:null,driver_number:null,message:'FIA STEWARDS: 5 SECOND TIME PENALTY FOR CAR 11 (PER) - FAILING TO FOLLOW RACE DIRECTORS INSTRUCTIONS'},
 {date:iso(at(63,30)+1000),lap_number:30,category:'Other',flag:null,scope:null,driver_number:null,message:'INCIDENT INVOLVING CAR 63 (RUS) NOTED - YELLOW FLAG INFRINGEMENT (16:17:30)'}
];
const pit=[
 {session_key:1,driver_number:63,lap_number:3,date:iso(at(63,4)+10000),lane_duration:1846.2,pit_duration:1846.2,stop_duration:null},
 {session_key:1,driver_number:12,lap_number:3,date:iso(at(12,4)+10000),lane_duration:1842.6,pit_duration:1842.6,stop_duration:null},
 {session_key:1,driver_number:12,lap_number:28,date:iso(at(63,28)+60000),lane_duration:24.963,pit_duration:24.963,stop_duration:2.7}
];
const stints=[{driver_number:63,stint_number:1,lap_start:1,lap_end:30,compound:'HARD',tyre_age_at_start:0},{driver_number:12,stint_number:1,lap_start:1,lap_end:28,compound:'HARD',tyre_age_at_start:0},{driver_number:12,stint_number:2,lap_start:29,lap_end:30,compound:'MEDIUM',tyre_age_at_start:0}];
const tables={laps:[...L63,...L12],stints,pit,race_control:rc,drivers:[{driver_number:63,name_acronym:'RUS',team_name:'Mercedes'},{driver_number:12,name_acronym:'ANT',team_name:'Mercedes'}],
 sessions:[{session_key:1,meeting_key:1293,session_type:'Race',session_name:'Race',date_end:'2026-09-06T15:00:00+00:00'}],
 session_result:[{position:1,driver_number:12,number_of_laps:30,points:25,dnf:false,dns:false,dsq:false,duration:2600.1,gap_to_leader:0},{position:2,driver_number:63,number_of_laps:30,points:18,dnf:false,dns:false,dsq:false,duration:2603.9,gap_to_leader:3.857},{position:null,driver_number:16,number_of_laps:1,points:0,dnf:true,dns:false,dsq:false,duration:null,gap_to_leader:null}],
 starting_grid:[{position:2,driver_number:63,meeting_key:1293},{position:19,driver_number:12,meeting_key:1293}],
 overtakes:[{overtaking_driver_number:12,overtaken_driver_number:63,date:iso(at(12,30)+30000),position:1}],
 weather:Array.from({length:25},(_,i)=>({date:iso(T0+i*60000),air_temperature:32+i*0.02,track_temperature:54-i*0.03,humidity:37,pressure:1000.1,wind_speed:1.5,rainfall:i>=10&&i<13?1:0})),
 team_radio:[{driver_number:63,date:iso(at(63,29)+5000),recording_url:'https://livetiming.formula1.com/static/x/RUS_63.mp3'}]};
function fake(calls=[]){
 return async url=>{calls.push(url);const u=new URL(url),p=u.pathname.split('/').pop(),q=Object.fromEntries(u.searchParams);let rows=tables[p]||[];
  if(q.driver_number)rows=rows.filter(r=>String(r.driver_number)===q.driver_number);
  return new Response(JSON.stringify(rows),{status:200});};
}
const NOW=Date.parse('2026-11-06T00:00:00Z'),call=async(name,args)=>JSON.parse((await openf1RaceCall(name,{session_key:1,...args},{fetchImpl:fake(),now:NOW})).content[0].text);

test('six read-only race tools',()=>{
 assert.deepEqual(OPENF1_RACE_TOOLS.map(t=>t.name),['f1_race_control','f1_race_gaps','f1_strategy','f1_result','f1_weather','f1_team_radio']);
 assert.ok(OPENF1_RACE_TOOLS.every(t=>t.annotations.readOnlyHint));
});

test('race control: SC, red flag and VSC periods with laps; penalties and track limits',async()=>{
 const p=neutralisations(rc);
 assert.deepEqual(p.map(x=>[x.type,x.lap_start,x.lap_end]),[['SC',3,3],['RED FLAG',3,4],['VSC',28,29]]);
 clearOpenf1Cache();const out=await call('f1_race_control',{});
 assert.equal(out.neutralisations[2].type,'VSC');assert.ok(out.neutralisations[2].duration_s>0);
 assert.deepEqual(out.track_limit_deletions[0],{driver_number:'63',driver:'RUS',team:'Mercedes',count:1,laps:[9]});
 assert.equal(out.penalties_and_investigations.length,2);assert.equal(out.blue_flags[0].driver_number,'77');
 const rus=await call('f1_race_control',{driver_number:'63',category:'penalties'});
 assert.equal(rus.penalties_and_investigations.length,1);assert.match(rus.penalties_and_investigations[0].message,/YELLOW FLAG/);assert.equal(rus.neutralisations,undefined);
});

test('gaps are measured at the line; the pair view finds the pass',async()=>{
 const c=crossings(tables.laps);assert.equal((c.get('12').get(1)-c.get('63').get(1))/1000,0.5);
 clearOpenf1Cache();const out=await call('f1_race_gaps',{driver_numbers:['63','12']});
 const lap2=out.laps.find(r=>r.lap===2);assert.equal(lap2.cars['12'].gap_to_leader_s,1);assert.equal(lap2.cars['12'].position,2);
 assert.equal(out.pair.per_lap.find(p=>p.lap===27).gap_s,12.5,'25 green laps x 0.5 s; laps 3-4 equal under the red flag');
 assert.ok(out.pair.per_lap.find(p=>p.lap===28).neutralised&&out.pair.per_lap.find(p=>p.lap===28).pit);
 assert.equal(out.overtakes.length,1);assert.equal(out.overtakes[0].overtaking.driver,'ANT');assert.equal(out.overtakes[0].lap,30);
 const def=await call('f1_race_gaps',{include_overtakes:false});assert.deepEqual(def.drivers.map(d=>d.driver_number),['12','63'],'default: top finishers');
});

test('strategy: stops under VSC and red flag are labelled; clean pace and head-to-head',async()=>{
 clearOpenf1Cache();const out=await call('f1_strategy',{driver_numbers:['63','12']});
 const ant=out.drivers.find(d=>d.driver_number==='12');
 assert.deepEqual(ant.pit_stops.map(p=>p.under),['red_flag','VSC']);assert.equal(ant.racing_pit_stops,1);
 const s1=ant.stints[0];assert.equal(s1.clean_pace.mean_s,86.5);assert.deepEqual(s1.excluded_laps,{lap_1:1,pit_out:0,pit_in:1,neutralised:2,no_time:0,outlier:0});
 assert.equal(out.drivers[0].stints[0].clean_pace.n,25);
 const seg=out.head_to_head.segments[0];assert.equal(seg.mean_delta_s,0.5);assert.deepEqual(seg.laps,[2,27]);
 const p=cleanPace([{lap_number:2,lap_duration:80},{lap_number:3,lap_duration:80.2},{lap_number:4,lap_duration:95}]);assert.equal(p.excluded.outlier,1);
});

test('result: classification with grid and places gained',async()=>{
 clearOpenf1Cache();const out=await call('f1_result',{});
 assert.equal(out.classification[0].driver,'ANT');assert.equal(out.classification[0].grid,19);assert.equal(out.classification[0].places_gained,18);
 assert.equal(out.classification[2].status,'DNF');assert.equal(out.classification[1].gap_to_leader_s,3.857);
});

test('weather summary and radio links',async()=>{
 clearOpenf1Cache();const w=await call('f1_weather',{});
 assert.equal(w.rain_periods.length,1);assert.equal(w.track_temperature_c.max,54);assert.equal(w.samples.length,3);
 const r=await call('f1_team_radio',{driver_number:'63'});
 assert.equal(r.messages[0].lap,29);assert.match(r.limitations[0],/no transcripts/);
});

test('telemetry summary finds corners and braking points',()=>{
 const rows=[];let d=0,t=0;const push=(speed,thr,brake)=>{rows.push([t,d,speed,thr,brake,7,11000]);d+=speed/3.6*0.27;t+=0.27;};
 for(let s=200;s<=320;s+=10)push(s,100,0);for(let s=320;s>=90;s-=20)push(s,0,1);push(90,10,0);push(92,40,0);for(let s=100;s<=280;s+=15)push(s,100,0);for(let s=280;s>=150;s-=20)push(s,0,1);push(150,30,0);for(let s=160;s<=250;s+=15)push(s,100,0);
 const sum=lapSummary(rows);
 assert.equal(sum.corners.length,2);assert.equal(sum.corners[0].min_speed_kmh,90);assert.equal(sum.corners[1].min_speed_kmh,150);
 assert.ok(sum.corners[0].brake_start_m<sum.corners[0].distance_m);assert.equal(sum.top_speed_kmh,320);
});
