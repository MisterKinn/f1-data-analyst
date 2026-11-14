import test from 'node:test';
import assert from 'node:assert/strict';
import {parseImsaSeason,parseImsaSessions,parseNascarFeed,parseSuperGtSeason,parseSuperGtSessions,parseNlsSeason,parseDakarRoute,circuitFor} from '../worker/calendar-season-readers.js';
import {parseTimetableRows,eventSessions,zonedStamp,cityPageLinks,refreshCalendarSource,calendarRoute} from '../worker/calendar-refresh.js';

// Markup below is copied (shortened) from the organisers' pages on 2026-11-14.
const imsaCard=(name,venue,label,slug)=>'<li> <article class="_1pkadjt0"> <header class="_1pkadjt8"> <hgroup> <h3 class="_1pkadjt9">'+name+'</h3> <p class="_1pkadjta"> <svg aria-hidden="true"><use href="#location"></use></svg> '+venue+' </p> </hgroup> </header> <span>24 HRS</span> <p class="_1pkadjt4" aria-label="'+label+'"> <span>Jan</span> </p> <ul> <li><a href="/events/'+slug+'?tab=schedule&amp;series=weathertech" data-variant="imsaGhost"> Schedule </a></li> </ul> </article> </li>';
const imsaSeason=imsaCard('Rolex 24 At Daytona','Daytona International Speedway, Daytona Beach, FL','January 28, 2027 through January 31, 2027','2027-rolex-24-at-daytona')+imsaCard('Acura Grand Prix of Long Beach','Long Beach Street Circuit, Long Beach, CA','April 16, 2027 through April 17, 2027','2027-long-beach-street-circuit');
// imsa.com/events/2027-rolex-24-at-daytona?tab=schedule: only the race slot is announced ("Coming Soon").
const imsaPanel=rows=>'<div id="panel-weathertech" role="tabpanel" data-series-panel data-series-id="weathertech"> <ul>'+rows.map(([n,t])=>'<li class="_1eahyng8"> <div class="_1eahyngb"> <p class="_1eahyngc">'+n+'</p> <time datetime="'+t+'" class="_14xjs641"> x </time> </div> </li>').join('')+'</ul> </div><div id="panel-imsa-michelin-pilot-challenge" role="tabpanel" data-series-panel data-series-id="imsa-michelin-pilot-challenge" hidden> <ul><li> <p class="x">Race</p> <time datetime="2027-01-30T19:00:00Z">x</time></li></ul></div>';

test('IMSA: season cards give name, dates, circuit and the schedule tab',()=>{
 const events=parseImsaSeason(imsaSeason,'https://www.imsa.com/2027/schedule');
 assert.deepEqual(events.map(e=>[e.name,e.startDate,e.endDate]),[['Rolex 24 At Daytona','2027-01-28','2027-01-31'],['Acura Grand Prix of Long Beach','2027-04-16','2027-04-17']]);
 assert.equal(events[0].url,'https://www.imsa.com/events/2027-rolex-24-at-daytona?tab=schedule&series=weathertech');
 assert.deepEqual(circuitFor(events[1].venue,'imsa'),{circuit:'long-beach',timezone:'America/Los_Angeles'});
});

test('IMSA: only the WeatherTech panel is read and unannounced slots are skipped',()=>{
 assert.deepEqual(parseImsaSessions(imsaPanel([['Coming Soon','2027-01-30T14:55:00Z']])),[]);
 const sessions=parseImsaSessions(imsaPanel([['Practice 1','2027-01-29T15:00:00Z'],['Qualifying','2027-01-29T20:15:00Z'],['Race','2027-01-30T14:55:00Z']]));
 assert.deepEqual(sessions.map(s=>[s.nameEn,s.start]),[['Practice 1','2027-01-29T15:00:00Z'],['Qualifying','2027-01-29T20:15:00Z'],['Race','2027-01-30T14:55:00Z']]);
});

test('NASCAR: race feed keeps practice, qualifying and race, not garage items',()=>{
 const feed={series_1:[{race_name:'Cook Out 400',track_name:'Martinsville Speedway',race_date:'2026-03-29T15:30:00',qualifying_date:'2026-03-28T00:00:00',schedule:[{event_name:'Garage Hours',start_time_utc:'2026-03-28T11:00:00',run_type:0},{event_name:'Practice',start_time_utc:'2026-03-28T16:30:00',run_type:1},{event_name:'Qualifying (Impound)',start_time_utc:'2026-03-28T17:40:00',run_type:2},{event_name:'Race',start_time_utc:'2026-03-29T19:30:00',run_type:3}]}]};
 const [race]=parseNascarFeed(feed);
 assert.deepEqual([race.name,race.startDate,race.endDate],['Cook Out 400','2026-03-28','2026-03-29']);
 assert.deepEqual(race.sessions.map(s=>[s.nameEn,s.start]),[['Practice','2026-03-28T16:30:00Z'],['Qualifying (Impound)','2026-03-28T17:40:00Z'],['Race','2026-03-29T19:30:00Z']]);
 assert.equal(circuitFor(race.venue,'nascar').circuit,'martinsville');
});

test('SUPER GT: English menu gives the rounds, the Japanese race page gives SUPER GT sessions only',()=>{
 const menu='<li><a href="https://supergt.net/en/calendar">2026 Calendar</a></li> <li><a href="https://supergt.net/en/races/round7-autopolis-2">Round7 AUTOPOLIS 10/17-18</a></li> <li><a href="https://supergt.net/en/races/round8-motegi-2">Round8 MOBILITY RESORT MOTEGI 11/06-08</a></li>';
 const rounds=parseSuperGtSeason(menu);
 assert.deepEqual(rounds.map(r=>[r.name,r.startDate,r.endDate,r.url]),[['SUPER GT Round7','2026-10-17','2026-10-18','https://supergt.net/races/round7-autopolis-2'],['SUPER GT Round8','2026-11-06','2026-11-08','https://supergt.net/races/round8-motegi-2']]);
 assert.equal(circuitFor(rounds[1].venue,'super-gt').circuit,'motegi');
 const box=(f,t,title,kind='pc520')=>'<div class="race_box schedule_box '+kind+'" data-from="'+f+'" data-to="'+t+'"> <h6>'+f+' - '+t+' '+title+'</h6> <p>'+f+' - '+t+'</p> </div>';
 const page='<div class="table_date_tab"><a href="#" data-target="2026-11-06" class="selected">11/06 予選</a></div><div class="table_date_tab"><a href="#" data-target="2026-11-08">11/08 決勝</a></div>'
  +'<div class="table_box">'+box('08:00','08:30','FIA-F4 : 公式練習 Cクラス')+box('09:30','11:00','SUPER GT : 専有走行')+box('09:30','11:00','SUPER GT : 専有走行','sp520')+box('14:30','15:20','SUPER GT : 公式予選')+'</div>'
  +'<div class="table_box hidden">'+box('11:45','12:15','SUPER GT : ピットウォーク')+box('13:30','15:30','SUPER GT : 決勝レース')+'</div>';
 const sessions=parseSuperGtSessions(page,'Asia/Tokyo',zonedStamp);
 assert.deepEqual(sessions.map(s=>[s.nameEn,s.start]),[['Exclusive practice','2026-11-06T09:30:00+09:00'],['Qualifying','2026-11-06T14:30:00+09:00'],['Race','2026-11-08T13:30:00+09:00']]);
});

test('Formula E: race page session table becomes local-time sessions',()=>{
 const row=(n,d,t)=>'<tr class="schedule_schedule__row__T5DzK"><th scope="row" class="schedule_schedule__sessionName__JM98g">'+n+'</th><td class="schedule_schedule__value__1teCs">'+d+'</td><td class="schedule_schedule__value__1teCs">'+t+'</td></tr>';
 const html='<table><thead><tr><th scope="col">Session</th><th scope="col">Date</th><th scope="col">Track time</th></tr></thead><tbody>'+row('Practice 1','Fri 15 Jan','16:15 – 17:00')+row('Practice 2','Sat 16 Jan','07:30 – 08:15')+row('Qualifying','Sat 16 Jan','10:00 – 11:10')+row('Race','Sat 16 Jan','15:05 – 16:00')+'</tbody></table>';
 const event={start:'2027-01-15',end:'2027-01-16',timezone:'America/Mexico_City'};
 const sessions=eventSessions(parseTimetableRows(html),event);
 assert.deepEqual(sessions.map(s=>[s.nameEn,s.start]),[['Practice 1','2027-01-15T16:15:00-06:00'],['Practice 2','2027-01-16T07:30:00-06:00'],['Qualifying','2027-01-16T10:00:00-06:00'],['Race','2027-01-16T15:05:00-06:00']]);
 assert.deepEqual(cityPageLinks('<a href="https://www.fiaformulae.com/en/mexicocity">x</a><a href="/en/news">n</a>','https://www.fiaformulae.com/en/calendar',new Set(['www.fiaformulae.com']),[{nameEn:'Mexico City E-Prix'}]),['https://www.fiaformulae.com/en/mexicocity']);
});

test('NLS season text and Dakar route table give event dates',()=>{
 const nls=parseNlsSeason('<p>14.03.2026\tNLS1: 71. ADAC Westfalenfahrt (4h)<br>18.-19.04.2026\tADAC 24h Qualifiers (2x4h)</p>');
 assert.deepEqual(nls.map(e=>[e.name,e.startDate,e.endDate]),[['NLS1: 71. ADAC Westfalenfahrt (4h)','2026-03-14','2026-03-14'],['ADAC 24h Qualifiers (2x4h)','2026-04-18','2026-04-19']]);
 const route='<tbody class="underThead"><tr> <td></td> <td></td> <td></td> <td>Total | Special</td> <td></td> </tr></tbody><tbody><tr> <td class=""> P </td> <td>Saturday, january 9, 2027</td> <td>LOULE &gt; LOULE</td> <td>129 km | 29 km</td> <td>Prologue</td> </tr><tr> <td>13</td> <td>Saturday, january 23, 2027</td> <td>X &gt; MARRAKECH</td> <td>1</td> <td>Stage 13</td> </tr></tbody>';
 assert.deepEqual(parseDakarRoute(route).map(e=>[e.startDate,e.endDate]),[['2027-01-09','2027-01-23']]);
});

const store=()=>{const saved=new Map();return {BUCKET:{get:async key=>saved.has(key)?{json:async()=>JSON.parse(saved.get(key))}:null,put:async(key,value)=>{saved.set(key,value);}}};};
test('IMSA refresh: 2027 season is imported and near events get their timetable; no 2027 page yet is not an error',async t=>{
 const pages={'/2027/schedule':imsaSeason,'/events/2027-rolex-24-at-daytona':imsaPanel([['Practice 1','2027-01-29T15:00:00Z'],['Race','2027-01-30T14:55:00Z']])};
 t.mock.method(globalThis,'fetch',async url=>{const p=new URL(url).pathname;return p in pages?new Response(pages[p],{status:200}):new Response('',{status:404});});
 const env=store(),now=Date.parse('2027-01-20T00:00:00Z');
 assert.equal((await refreshCalendarSource(env,'imsa',now)).error,null);
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),env,{},now)).json();
 const rolex=data.events.find(e=>e.series==='imsa'&&e.start==='2027-01-28');
 assert.equal(rolex.circuit,'daytona');assert.equal(rolex.timezone,'America/New_York');
 assert.deepEqual(rolex.sessions.map(s=>s.nameEn),['Practice 1','Race']);
 assert.equal(data.events.find(e=>e.series==='imsa'&&e.start==='2027-04-16').sessions.length,0);
});

test('NASCAR refresh: past races match our cards by circuit and weekend, not by race name',async t=>{
 const feed={series_1:[{race_name:'Xfinity 500',track_name:'Martinsville Speedway',race_date:'2026-11-01T14:00:00',qualifying_date:'2026-10-31T00:00:00',schedule:[{event_name:'Practice',start_time_utc:'2026-10-31T15:35:00',run_type:1},{event_name:'Qualifying',start_time_utc:'2026-10-31T16:45:00',run_type:2},{event_name:'Race',start_time_utc:'2026-11-01T19:00:00',run_type:3}]}]};
 t.mock.method(globalThis,'fetch',async url=>String(url).includes('/2026/')?new Response(JSON.stringify(feed),{status:200}):new Response('<Error>AccessDenied</Error>',{status:403}));
 const env=store(),now=Date.parse('2026-11-14T00:00:00Z');
 assert.equal((await refreshCalendarSource(env,'nascar',now)).error,null);
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),env,{},now)).json();
 const martinsville=data.events.filter(e=>e.series==='nascar'&&e.circuit==='martinsville');
 assert.equal(martinsville.length,1);assert.equal(martinsville[0].id,'nascar-2026-10-30-martinsville');
 // Our hand-entered timetable also lists the support series, so the longer list stays.
 assert.ok(martinsville[0].sessions.length>=3);
});

test('Formula E refresh: the race page linked from the calendar fills the next E-Prix',async t=>{
 const ld='<script type="application/ld+json">'+JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'SportsEvent',name:'R01 Mexico City E-Prix',startDate:'2027-01-15',endDate:'2027-01-16'}]})+'</script>';
 const row=(n,d,tm)=>'<tr><th scope="row">'+n+'</th><td>'+d+'</td><td>'+tm+'</td></tr>';
 const pages={'/en/calendar':ld+'<a href="https://www.fiaformulae.com/en/mexicocity">Mexico City</a>','/en/mexicocity':'<table><tbody>'+row('Practice 1','Fri 15 Jan','16:15 – 17:00')+row('Qualifying','Sat 16 Jan','10:00 – 11:10')+row('Race','Sat 16 Jan','15:05 – 16:00')+'</tbody></table>'};
 t.mock.method(globalThis,'fetch',async url=>{const p=new URL(url).pathname;return p in pages?new Response(pages[p],{status:200}):new Response('',{status:404});});
 const env=store(),now=Date.parse('2027-01-05T00:00:00Z');
 assert.equal((await refreshCalendarSource(env,'formula-e',now)).error,null);
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),env,{},now)).json();
 const mexico=data.events.filter(e=>e.series==='formula-e'&&e.start.startsWith('2027-01'));
 assert.equal(mexico.length,1);
 assert.deepEqual(mexico[0].sessions.map(s=>[s.nameEn,s.start]),[['Practice 1','2027-01-15T16:15:00-06:00'],['Qualifying','2027-01-16T10:00:00-06:00'],['Race','2027-01-16T15:05:00-06:00']]);
});
