import test from 'node:test';
import assert from 'node:assert/strict';
import {parseICalendar,loadEventSessions,refreshCalendarSource,calendarRoute} from '../worker/calendar-refresh.js';

// Shape of the organiser file at asianlemansseries.com/en/race/calendar/<id> (checked 2026-11-14).
const vevent=(summary,from,to)=>['BEGIN:VEVENT','SUMMARY:'+summary,'DTSTART;TZID=Europe/Madrid:'+from,'DTEND;TZID=Europe/Madrid:'+to,'END:VEVENT'].join('\r\n');
const ics=['BEGIN:VCALENDAR','VERSION:2.0',
 vevent('4 Hours of Jerez by ALMS - Free Practice 1','20270115T101000','20270115T114000'),
 vevent('4 Hours of Jerez by ALMS - Qualifications 1 - Hypercar & LMP\r\n 2','20270115T165000','20270115T170500'),
 vevent('4 Hours of Jerez by ALMS - Race 1','20270116T131500','20270116T171500'),
 vevent('4 Hours of Jerez by ALMS - Race 2','20270117T131500','20270117T171500'),
 vevent('Some other weekend - Race','20270301T120000','20270301T160000'),
 'END:VCALENDAR'].join('\r\n');
const page='<a href="/en/race/calendar/5074">Add to my calendar</a>';
const site='https://www.asianlemansseries.com';

test('a TZID wall-clock time becomes an explicit-offset stamp, across DST',()=>{
 const rows=parseICalendar(['BEGIN:VCALENDAR',vevent('A','20270115T101000','20270115T114000'),vevent('B','20270715T101000','20270715T114000'),'END:VCALENDAR'].join('\r\n'));
 assert.deepEqual(rows.map(r=>r.startDate),['2027-01-15T10:10:00+01:00','2027-07-15T10:10:00+02:00']);
 assert.equal(rows[0].endDate,'2027-01-15T11:40:00+01:00');
});

test('an event page that links a session calendar yields that event\'s sessions only',async()=>{
 const events=[{id:'alms-2027-01-15-jerez',series:'alms',name:'헤레스',nameEn:'Jerez',start:'2027-01-15',end:'2027-01-17',url:site+'/en/race/4-hours-of-jerez-by-alms-2027'}];
 const seen=[];const get=async url=>{seen.push(url);return url.includes('/race/calendar/')?ics:page;};
 const [record]=await loadEventSessions('alms',new Set(['www.asianlemansseries.com']),Date.parse('2027-01-10T00:00:00Z'),events,get);
 assert.deepEqual(seen,[site+'/en/race/4-hours-of-jerez-by-alms-2027',site+'/en/race/calendar/5074']);
 assert.deepEqual(record.sessions.map(s=>s.nameEn),['FP1','Qualifying 1 - Hypercar & LMP2','Race 1','Race 2']);
 assert.equal(record.sessions[2].name,'레이스 1');
 assert.equal(record.sessions[3].start,'2027-01-17T13:15:00+01:00');assert.equal(record.sessions[3].end,'2027-01-17T17:15:00+01:00');
 // Too far ahead: no request at all.
 seen.length=0;assert.deepEqual(await loadEventSessions('alms',new Set(['www.asianlemansseries.com']),Date.parse('2026-11-20T00:00:00Z'),events,get),[]);assert.deepEqual(seen,[]);
});

test('the ALMS refresh fills Jerez sessions automatically even though the season page has no schedule',async t=>{
 const now=Date.parse('2027-01-10T00:00:00Z');const saved=new Map();
 const env={BUCKET:{get:async key=>saved.has(key)?{json:async()=>JSON.parse(saved.get(key))}:null,put:async(key,value)=>{saved.set(key,value);}}};
 t.mock.method(globalThis,'fetch',async url=>{
  const body=String(url).includes('/race/calendar/')?ics:String(url).includes('/race/4-hours-of-jerez')?page:'<html>news article, no schedule</html>';
  return new Response(body,{status:200});
 });
 const result=await refreshCalendarSource(env,'alms',now);
 assert.equal(result.error,null);
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),env,{},now)).json();
 const jerez=data.events.find(e=>e.id==='alms-2027-01-15-jerez');
 assert.equal(jerez.sessions.length,4);assert.equal(jerez.sessions[0].start,'2027-01-15T10:10:00+01:00');
 assert.equal(data.sourceStatus.find(s=>s.series==='alms').available,true);
 // Every other checked-in ALMS event is still listed.
 assert.ok(data.events.some(e=>e.id==='alms-2027-02-19-portimao'));
});
