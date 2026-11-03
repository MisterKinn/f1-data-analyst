import {test} from 'node:test';
import assert from 'node:assert/strict';
import {durationSeconds,normalizeF1Race,tyreStrategies,selectWecRaces,normalizeWecRace,wecPitTotals,raceResultsRoute} from '../worker/race-results.js';
import {websiteRoute} from '../worker/website.js';

test('F1 classification preserves published penalty order, time gaps, laps and retirement status',()=>{
 const rows=[{position:'1',number:'12',laps:'71',status:'Finished',Driver:{givenName:'Kimi',familyName:'Antonelli'},Constructor:{name:'Mercedes'},Time:{time:'1:30:00.000',millis:'5400000'}},
 {position:'2',number:'63',laps:'71',status:'Finished',Driver:{givenName:'George',familyName:'Russell'},Constructor:{name:'Mercedes'},Time:{time:'+10.123',millis:'10123'}},
 {position:'3',number:'44',laps:'70',status:'+1 Lap',Driver:{givenName:'Lewis',familyName:'Hamilton'},Constructor:{name:'Ferrari'}},
 {position:'4',number:'16',laps:'25',status:'Retired',Driver:{givenName:'Charles',familyName:'Leclerc'},Constructor:{name:'Ferrari'}}];
 const raw={MRData:{total:'4',RaceTable:{Races:[{season:'2026',round:'19',raceName:'Mexico City Grand Prix',date:'2026-11-01',Results:rows}]}}};
 assert.deepEqual(normalizeF1Race(raw,2026,19).rows.map(r=>r.gap),['Leader','+10.123','+1 lap','Retired']);
 assert.throws(()=>normalizeF1Race(raw,2026,18));raw.MRData.total='5';assert.throws(()=>normalizeF1Race(raw,2026,19));
});
test('stints count race laps, retain same-compound changes and use FreshTyre rather than tyre lifetime',()=>{
 const laps={lap:[1,2,3,4,5,6],stint:[1,1,2,2,3,3],compound:['SOFT','SOFT','SOFT','SOFT','MEDIUM','MEDIUM'],fresh:[false,false,true,true,null,null],dNum:['63','63','63','63','63','63'],life:[4,5,1,2,7,8],del:[true,false,false,false,false,false]};
 const stints=tyreStrategies(laps,[{number:'63',laps:6}]).get('63');
 assert.deepEqual(stints.map(s=>[s.compound,s.fresh,s.laps]),[['SOFT',false,2],['SOFT',true,2],['MEDIUM',null,2]]);
 assert.equal(tyreStrategies(laps,[{number:'63',laps:7}]).size,0);
 const conflict=structuredClone(laps);for(const k of ['lap','stint','compound','fresh','dNum'])conflict[k].push(conflict[k][0]);conflict.compound[6]='HARD';assert.throws(()=>tyreStrategies(conflict,[{number:'63',laps:6}]));
});
const file=(round,title,folder='Hour 6',date='2026-11-02')=>({format:'csv',title,url:`https://files.alkamelcloud.com/wec/results/15_2026/${round}_TEST/1_FIA%20WEC/202610181200_Race/06_Hour%206/${encodeURIComponent(title)}`,folders:['TEST','FIA WEC','Race',folder],published_at:date});
test('WEC race selection excludes live Hour N snapshots and support races, keeps amended classifications',()=>{
 const final=file('07','Classification_Race_Hour 6_Final.CSV'),amended=file('07','Classification_Race_Hour 6_Final_Amended.CSV');
 const races=selectWecRaces([file('06','Classification_Race_Hour 6_Final.CSV'),final,amended,file('08','Classification_Race_Hour 1.CSV','Hour 1'),{...final,folders:['TEST','FRJC','Race','Hour 6']}],2026);
 assert.deepEqual(races.map(r=>r.id),['7','6']);assert.equal(races[0].file.title,amended.title);
});
test('WEC class gaps are relative to the selected class, with leading-zero numbers and retired cars retained',()=>{
 const row=(POSITION,NUMBER,CLASS,LAPS,TOTAL_TIME,STATUS='Classified')=>({POSITION,NUMBER,CLASS,LAPS,TOTAL_TIME,STATUS,TEAM:'Team '+NUMBER,VEHICLE:'Car',DRIVER_1:'Driver',GAP_FIRST:'8 Laps'});
 const result=normalizeWecRace([row('1','8','HYPERCAR','198',"6:01'20.906"),row('2','007','HYPERCAR','198',"6:01'21.489"),row('20','92','LMGT3','190',"6:02'00.000"),row('21','85','LMGT3','190',"6:02'04.500"),row('22','33','LMGT3','189',"6:03'00.000"),row('23','78','LMGT3','50',"2:00'00.000",'Retired')],'LMGT3');
 assert.deepEqual(result.rows.map(r=>r.gap),['Leader','+4.500','+1 lap','Retired']);assert.equal(result.rows[0].overall_position,20);assert.equal(result.rows[0].position,1);
 assert.equal(normalizeWecRace([row('1','007','HYPERCAR','198',"6:01'20.906")]).rows[0].number,'007');
 assert.equal(durationSeconds('0:01:27.059'),87.059);assert.equal(durationSeconds("6:01'20.906"),21680.906);assert.equal(durationSeconds('1:60.000'),null);assert.equal(durationSeconds(''),null);
});
test('WEC totals deduplicate analysis rows, count visits once and withhold incomplete pit times',()=>{
 const lap=(NUMBER,LAP_NUMBER,entry='',time='')=>({NUMBER,LAP_NUMBER:String(LAP_NUMBER),CROSSING_FINISH_LINE_IN_PIT:entry,PIT_TIME:time});
 const records=[lap('007',1),lap('007',2,'B'),lap('007',3,'','0:01:27.059'),lap('007',4),lap('007',4),lap('7',1),lap('7',2,'B')];
 const totals=wecPitTotals(records,[{number:'007',laps:4},{number:'7',laps:2},{number:'8',laps:3}]);
 assert.deepEqual(totals.get('007'),{pit_stops:1,pit_time_seconds:87.059});assert.deepEqual(totals.get('7'),{pit_stops:1,pit_time_seconds:null});assert.equal(totals.has('8'),false);
});
test('race panels sit between calendar and championship points on F1 and WEC only; scripts parse in both languages',async()=>{
 for(const series of ['f1','wec'])for(const lang of ['en','ko']){
  const html=await websiteRoute(new Request('https://test/championships/'+series,{headers:{cookie:'kongboda_lang='+lang}})).text();
  assert.ok(html.indexOf('data-race-results="'+series+'"')>html.indexOf('data-race-calendar="'+series+'"'));
  assert.ok(html.indexOf('data-race-results="'+series+'"')<html.indexOf('data-championship="'+series+'"'));
  if(lang==='en')assert.match(html,/Race results/);
 }
 assert.doesNotMatch(await websiteRoute(new Request('https://test/championships/formula-e')).text(),/data-race-results=/);
 new Function(await websiteRoute(new Request('https://test/assets/website.js')).text());
});
test('race results rejects foreign sources, invalid seasons, arbitrary classes and methods before fetching',async()=>{
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error('must not fetch');};
 try{
  for(const query of ['series=imsa','series=f1&event=https://evil.test','series=wec&season=2000','series=f1&category=drivers','series=wec&category=%3Cscript%3E'])assert.equal((await raceResultsRoute(new Request('https://test/api/race-results?'+query))).status,400);
  assert.equal((await raceResultsRoute(new Request('https://test/api/race-results?series=f1',{method:'POST'}))).status,405);
 }finally{globalThis.fetch=original;}
});
test('missing optional tyre archives do not prevent a complete F1 classification from loading',async()=>{
 const original=globalThis.fetch;const year=2025;
 globalThis.fetch=async url=>{
  if(String(url).includes('raw.githubusercontent'))return new Response('',{status:404});
  const result={season:String(year),round:'1',raceName:'Australian Grand Prix',date:'2025-03-16',Results:[{position:'1',number:'4',laps:'57',status:'Finished',Driver:{givenName:'Lando',familyName:'Norris'},Constructor:{name:'McLaren'},Time:{time:'1:42:06.304'}}]};
  return Response.json({MRData:{total:'1',RaceTable:{Races:[result]}}});
 };
 try{const r=await raceResultsRoute(new Request('https://test/api/race-results?series=f1&season='+year));assert.equal(r.status,200);const d=await r.json();assert.equal(d.strategy_state,'unavailable');assert.equal(d.rows.length,1);assert.equal(d.rows[0].gap,'Leader');assert.equal(d.rows[0].stints,null);}finally{globalThis.fetch=original;}
});
