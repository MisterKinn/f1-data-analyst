import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chooseLanguage,translateHtml} from '../worker/localization.js';
import {weekBounds,weeklyEventVisible,compactSessionName} from '../worker/race-features.js';
import {websiteRoute} from '../worker/website.js';
import {calendarEvents,circuitInfo} from '../worker/race-calendar-data.js';
test('compact session labels preserve class and round while shortening qualifying and hyperpole',()=>{
 for(const [full,short] of [['LMGT3 퀄리파잉','LMGT3 Q'],['LMGT3 Hyperpole','LMGT3 HP'],['Rd.3 GT300 퀄리파잉','Rd.3 GT300 Q'],['Hypercar Qualifying','Hypercar Q'],['퀄리파잉 2','Q2'],['Pre-qualifying','Pre-Q'],['FP3','FP3'],['Rd.8 GT500 레이스','Rd.8 GT500 레이스']])assert.equal(compactSessionName(full),short);
});
test('saved language overrides country; country overrides browser language',()=>{
 const make=(country,headers={})=>{const r=new Request('https://test',{headers});r.cf={country};return r;};
 assert.equal(chooseLanguage(make('KR',{'accept-language':'en-US'})),'ko');
 assert.equal(chooseLanguage(make('US',{'accept-language':'ko-KR'})),'en');
 assert.equal(chooseLanguage(make('US',{cookie:'other=x; kongboda_lang=ko'})),'ko');
 assert.equal(chooseLanguage(make('KR',{cookie:'kongboda_lang=en'})),'en');
 assert.equal(chooseLanguage(make(undefined,{'accept-language':'en-GB'})),'en');
 assert.equal(chooseLanguage(make(undefined,{'cf-ipcountry':'KR','accept-language':'en-US'})),'ko');
 assert.equal(chooseLanguage(make('US',{cookie:'kongboda_tz=Asia%2FSeoul','accept-language':'en-US'})),'ko');
 assert.equal(chooseLanguage(make('US',{cookie:'kongboda_tz=Asia%2FSeoul; kongboda_lang=en'})),'en');
});
test('English pages preserve URLs and expose the English mark; calendar sits between hero and championships',async()=>{
 const html=await websiteRoute(new Request('https://test/',{headers:{cookie:'kongboda_lang=en'}})).text();
 assert.match(html,/<html lang="en">/);assert.match(html,/brand-mark-en.svg/);
 assert.ok(html.indexOf('<section class="race-section" data-race-calendar="week"')>html.indexOf('class="hero"'));
 assert.ok(html.indexOf('<section class="race-section" data-race-calendar="week"')<html.indexOf('id="championships"'));
 const champ=await websiteRoute(new Request('https://test/championships/f1')).text();
 assert.ok(champ.indexOf('<section class="race-section" data-race-calendar="f1"')<champ.indexOf('data-championship="f1"'));
 assert.equal(translateHtml('<a href="/guide">이용 방법</a>','en'),'<a href="/guide">How to use</a>');
 for(const path of ['/assets/website.js','/assets/race-features.js'])new Function(await websiteRoute(new Request('https://test'+path)).text());
});
test('week boundaries use Monday inclusive and next Monday exclusive, across month/year',()=>{
 for(const [day,start,end] of [['2026-11-01T23:00:00','2026-10-26','2026-11-02'],['2027-01-01T12:00:00','2026-12-28','2027-01-04']]){
  const w=weekBounds(new Date(day));const local=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
  assert.equal(local(w.start),start);assert.equal(local(w.end),end);
 }
});
test('calendar records are sourced and event-level with safe optional measurements',async()=>{
 assert.equal(new Set(calendarEvents.map(e=>e.id)).size,calendarEvents.length);
 for(const e of calendarEvents){assert.ok(e.start<=e.end);assert.ok(e.url.startsWith('https://'));assert.ok(circuitInfo[e.circuit]);assert.equal(e.precision,'date');new Intl.DateTimeFormat('en',{timeZone:e.timezone});}
 for(const series of ['igtc','british-gt','super-gt','macau','nascar'])assert.ok(calendarEvents.some(e=>e.series===series));
 assert.equal(calendarEvents.filter(e=>e.series==='macau').length,1);
 const data=await websiteRoute(new Request('https://test/api/race-calendar')).json();assert.ok(data.events.length>100);assert.ok(data.supported.includes('imsa'));
});


test('weekly schedule excludes completed events but preserves a Sunday race running into Monday',async()=>{
 const {sessionState}=await import('../worker/session-state.js');
 const data=await websiteRoute(new Request('https://test/api/race-calendar')).json();
 const visible=(e,time)=>weeklyEventVisible(e,new Date(time),weekBounds,sessionState);
 const mexico=data.events.find(e=>e.id==='f1-2026-10-30-mexico'),nascar=data.events.find(e=>e.id==='nascar-2026-10-30-martinsville');
 for(const e of [mexico,nascar])assert.equal(visible(e,'2026-11-03T09:00:00+09:00'),false);
 assert.equal(visible(mexico,'2026-11-02T05:30:00+09:00'),true);
 assert.equal(visible(mexico,'2026-11-02T07:00:00+09:00'),false);
 const homestead=data.events.find(e=>e.id==='nascar-2026-11-06-homestead');
 assert.equal(visible(homestead,'2026-11-03T09:00:00+09:00'),true);
 const monza=data.events.find(e=>e.id==='wec-2026-11-06-monza');
 assert.equal(visible(monza,'2026-11-03T09:00:00+09:00'),true);
 assert.equal(visible(monza,'2026-11-09T01:00:00+09:00'),false);
});
test('Monza and both Motegi rounds expose complete sourced sessions with explicit timezone and end',async()=>{
 const {sessionState}=await import('../worker/session-state.js');
 const data=await websiteRoute(new Request('https://test/api/race-calendar')).json();
 const monza=data.events.find(e=>e.id==='wec-2026-11-06-monza'),motegi=data.events.find(e=>e.id==='super-gt-2026-11-06-motegi');
 assert.equal(monza.sessions.length,8);assert.equal(motegi.sessions.length,9);
 assert.deepEqual(monza.sessions.slice(0,3).map(s=>s.name),['FP1','FP2','FP3']);
 assert.equal(new Date(monza.sessions[0].start).toISOString(),'2026-11-06T09:30:00.000Z');
 assert.equal(motegi.sessions.filter(s=>/Race/.test(s.nameEn)).length,2);
 for(const e of [monza,motegi])for(const s of e.sessions){assert.ok(Date.parse(s.end)>Date.parse(s.start));assert.ok(s.source.startsWith('https://'));assert.equal(sessionState(s,e,Date.parse(s.end)).phase,'finished');}
});
