import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTimetableText,parseTimetableJson,eventSessions,refreshCalendarSource,calendarRoute} from '../worker/calendar-refresh.js';
import {calendarEvents} from '../worker/race-calendar-data.js';

// Markup copied from supertaikyu.com/race/round_07.html (checked 2026-11-14), shortened.
const taikyu=`<div class="Race_Detail_Middle_TXT"> 15 - 25m</div><!-- <div class="RaceSchedule_Time"> 01:00 - 02:00</div><div>old</div> -->
<div class="RaceSchedule_Left"><div class="RaceSchedule_Date"> 2026.11.14 </div><div class="RaceSchedule_Day"> SAT </div><div class="RaceSchedule_TTL">QUALIFYING DAY</div>
<div class="RaceSchedule_Inn"><div class="RaceSchedule_Time"> 09:05 - 09:45</div><div class="RaceSchedule_TXT"> S耐フリー走行</div></div>
<div class="RaceSchedule_Inn"><div class="RaceSchedule_Time"> 09:55 - 10:10</div><div class="RaceSchedule_TXT">S耐チャレンジ予選（Aドライバー）</div></div>
<div class="RaceSchedule_Inn"><div class="RaceSchedule_Time"> 11:00 - 11:45</div><div class="RaceSchedule_TXT"> PIT WALK</div></div>
<div class="RaceSchedule_Inn"><div class="RaceSchedule_Time"> 14:15 - 15:05</div><div class="RaceSchedule_TXT"> 公式予選（Aドライバー）</div></div></div>
<div class="RaceSchedule_Right"><div class="RaceSchedule_Date"> 2026.11.15 </div><div class="RaceSchedule_Day"> SUN </div>
<div class="RaceSchedule_Inn"><div class="RaceSchedule_Time">08:50 - 09:50</div><div class="RaceSchedule_TXT">S耐チャレンジ 決勝</div></div>
<div class="RaceSchedule_Inn"><div class="RaceSchedule_Time"> 11:25 - 12:30</div><div class="RaceSchedule_TXT"><p>S耐スタート進行</p><p>・カウントダウンセレモニー</p><p>・グリッドウォーク</p></div></div>
<div class="RaceSchedule_Inn"><div class="RaceSchedule_Time"> 12:30 - 16:30</div><div class="RaceSchedule_TXT">S耐FINAL 4H</div></div></div>`;
// Text order of rally-saudiarabia.com/event-programme (checked 2026-11-14).
const saudi=`<h4>November 11–14, 2026</h4><h4>KSA Time (UTC +3)</h4><h4>Thursday, 12 November</h4><p>10:56 – 11:01 • Shakedown</p><p>📍 <strong>Service Park</strong></p>
<h4>Friday, 13 November</h4><p>09:10 • Out</p><p>📍 <strong>Parc Ferme</strong></p><p>10:00 • SS1 – Bryman 1</p><p>10:23</p><p>• SS2 – Wadi Al Matwi 1</p><p>17:31 • In</p>
<h4>Saturday, 14 November</h4><p>15:29 • SS 12 – Asfan 2</p>`;
// Shape of macau.grandprix.gov.mo/api/game/event_day (checked 2026-11-14).
const macau=JSON.stringify({code:0,message:'',data:[
 {date:'19/11',day:'Thursday',is_game_day:true,ticket:'<div>09:00 ~ 10:00</div>',list:[{id:550,time:'06:00',title:'Circuit Closed'},{id:551,time:'06:30 ~ 07:00',title:'Circuit Inspection'},{id:552,time:'07:45 ~ 08:15',title:'Macau Motorcycle Grand Prix - 58th Edition - Free Practice 1'}]},
 {date:'22/11',day:'Sunday',list:[{time:'15:15 ~ 15:20',title:'Lion Dance'},{time:'15:30 ~ 16:35',title:'Macau Grand Prix - FIA FR World Cup (15 laps)'},{time:'18:00',title:'** Circuit Opened'}]}]});
const event=(series,circuit)=>calendarEvents.find(e=>e.series===series&&e.circuit===circuit&&e.start.startsWith('2026-11'));

test('Super Taikyu page text becomes sessions; paddock items and commented-out markup are ignored',()=>{
 const sessions=eventSessions(parseTimetableText(taikyu),event('super-taikyu','fuji'));
 assert.deepEqual(sessions.map(s=>s.nameEn),['S-Tai FP','S-Tai Challenge Qualifying (A driver)','Qualifying (A driver)','S-Tai Challenge Race','S-Tai FINAL 4H']);
 assert.equal(sessions[0].start,'2026-11-14T09:05:00+09:00');assert.equal(sessions[0].end,'2026-11-14T09:45:00+09:00');
 assert.equal(sessions.at(-1).start,'2026-11-15T12:30:00+09:00');assert.equal(sessions[3].name,'S-Tai Challenge 레이스');
});

test('Rally Saudi Arabia programme text becomes the shakedown and stages, without parc ferme rows',()=>{
 const sessions=eventSessions(parseTimetableText(saudi),event('wrc','rally-saudi'));
 assert.deepEqual(sessions.map(s=>s.nameEn),['Shakedown','SS1 – Bryman 1','SS2 – Wadi Al Matwi 1','SS 12 – Asfan 2']);
 assert.deepEqual(sessions.map(s=>s.start),['2026-11-12T10:56:00+03:00','2026-11-13T10:00:00+03:00','2026-11-13T10:23:00+03:00','2026-11-14T15:29:00+03:00']);
 assert.equal(sessions[0].name,'셰이크다운');
});

test('the Macau programme feed becomes sessions; circuit open/close and ceremonies are ignored',()=>{
 const sessions=eventSessions(parseTimetableJson(macau),event('macau','guia'));
 assert.deepEqual(sessions.map(s=>s.start),['2026-11-19T07:45:00+08:00','2026-11-22T15:30:00+08:00']);
 assert.equal(sessions[1].end,'2026-11-22T16:35:00+08:00');assert.equal(sessions[0].name,'Macau Motorcycle Grand Prix - 58th Edition - FP 1');
});

test('each of the three series fills its event automatically on refresh',async t=>{
 const pages={'supertaikyu.com':taikyu,'rally-saudiarabia.com':saudi,'www.macau.grandprix.gov.mo':macau};
 t.mock.method(globalThis,'fetch',async url=>new Response(pages[new URL(url).hostname]??'<html>season page without a schedule</html>',{status:200}));
 const saved=new Map(),env={BUCKET:{get:async key=>saved.has(key)?{json:async()=>JSON.parse(saved.get(key))}:null,put:async(key,value)=>{saved.set(key,value);}}};
 const now=Date.parse('2026-11-10T00:00:00Z');
 // Assert on what the refresh read, not on the merged card: a longer hand-entered timetable may still win there.
 const read={};for(const series of ['super-taikyu','wrc','macau']){const result=await refreshCalendarSource(env,series,now);assert.equal(result.error,null,series);read[series]=result.events[0].sessions.length;}
 assert.deepEqual(read,{'super-taikyu':5,wrc:4,macau:2});
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),env,{},now)).json();
 const count=(series,circuit)=>data.events.find(e=>e.series===series&&e.circuit===circuit&&e.start.startsWith('2026-11')).sessions.length;
 assert.ok(count('super-taikyu','fuji')>=5);assert.ok(count('wrc','rally-saudi')>=4);assert.ok(count('macau','guia')>=2);
 for(const series of ['super-taikyu','wrc','macau'])assert.equal(data.sourceStatus.find(s=>s.series===series).available,true);
});

test('time ranges written with HTML entities or other dashes still split into start, end and title',()=>{
 const saudiEvent=event('wrc','rally-saudi');
 for(const dash of ['&#8211;','&ndash;','&#x2013;','—','−']){
  const [shakedown,stage]=eventSessions(parseTimetableText(`<h4>Thursday, 12 November</h4><p>10:56 ${dash} 11:01 &bull; Shakedown</p><h4>Friday, 13 November</h4><p>10:00 &#8226; SS1 &#8211; Bryman 1</p>`),saudiEvent);
  assert.equal(shakedown.nameEn,'Shakedown',dash);assert.equal(shakedown.start,'2026-11-12T10:56:00+03:00');assert.equal(shakedown.end,'2026-11-12T11:01:00+03:00');
  assert.equal(stage.nameEn,'SS1 – Bryman 1');
 }
});
