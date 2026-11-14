import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTimetableText,eventSessions,eventPageLinks,refreshCalendarSource,calendarRoute} from '../worker/calendar-refresh.js';
import {calendarEvents} from '../worker/race-calendar-data.js';

// Markup copied from gt-world-challenge-asia.com/event/90/shanghai-international-circuit (checked 2026-11-14), shortened.
const table=(dayLabel,rows)=>`<table class="timetable__table"><caption class="timetable__caption"><span>${dayLabel}</span></caption><thead><tr><th>Session</th><th>Local Time</th><th>GMT</th></tr></thead><tbody>${rows.map(([n,l,g])=>`<tr>\n<td>${n}</td>\n<td>${l}</td>\n<td>${g}</td>\n</tr>`).join('')}</tbody></table>`;
const sro=table('Friday, 30 October',[['Test Session 1','08:30','00:30'],['Official Practice','10:48','02:48']])+table('Saturday, 31 October',[['Qualifying 1','09:35','01:35'],['Race 1','12:50','04:50']])+table('Sunday, 1 November',[['Race 2','13:05','05:05']])+'<h2>Timetable</h2>';
const store=()=>{const saved=new Map();return {BUCKET:{get:async key=>saved.has(key)?{json:async()=>JSON.parse(saved.get(key))}:null,put:async(key,value)=>{saved.set(key,value);}}};};

test('an SRO timetable table (session, local time, GMT) becomes local-time sessions',()=>{
 const shanghai=calendarEvents.find(e=>e.id==='gtwc-asia-2026-10-30-shanghai');
 const sessions=eventSessions(parseTimetableText(sro),shanghai);
 assert.deepEqual(sessions.map(s=>s.nameEn),['Test Session 1','Official Practice','Qualifying 1','Race 1','Race 2']);
 assert.deepEqual(sessions.map(s=>s.start),['2026-10-30T08:30:00+08:00','2026-10-30T10:48:00+08:00','2026-10-31T09:35:00+08:00','2026-10-31T12:50:00+08:00','2026-11-01T13:05:00+08:00']);
});

test('event page links come from the season page: same host, no calendar files, no duplicates',()=>{
 const html='<a href="/en/race/qatar-1812km-2027">a</a><a href="/en/race/qatar-1812km-2027">again</a><a href="/en/race/calendar/5073">ics</a><a href="https://evil.example/race/x">x</a><a href="/event/28/adelaide-grand-final">b</a>';
 assert.deepEqual(eventPageLinks(html,'https://www.fiawec.com/en/page/home',new Set(['www.fiawec.com'])),['https://www.fiawec.com/en/race/qatar-1812km-2027','https://www.fiawec.com/event/28/adelaide-grand-final']);
});

test('WEC finds the right race page from the home page by itself and fills the sessions',async t=>{
 const vevent=(summary,from,to)=>['BEGIN:VEVENT','SUMMARY:'+summary,'DTSTART;TZID=Asia/Qatar:'+from,'DTEND;TZID=Asia/Qatar:'+to,'END:VEVENT'].join('\r\n');
 const ics=rows=>['BEGIN:VCALENDAR',...rows,'END:VCALENDAR'].join('\r\n');
 const pages={
  '/en/page/homepage-world-endurance-championship/1':'<a href="/en/race/6-hours-of-imola-2027">Imola</a><a href="/en/race/qatar-1812km-2027">Qatar</a>',
  '/en/race/6-hours-of-imola-2027':'<a href="/en/race/calendar/11">Add to my calendar</a>','/en/race/qatar-1812km-2027':'<a href="/en/race/calendar/10">Add to my calendar</a>',
  '/en/race/calendar/11':ics([vevent('6 Hours of Imola - Free Practice 1','20270409T110000','20270409T123000'),vevent('6 Hours of Imola - Race','20270411T130000','20270411T190000')]),
  '/en/race/calendar/10':ics([vevent('Qatar 1812 KM - Free Practice 1','20270325T120000','20270325T133000'),vevent('Qatar 1812 KM - Qualifications - Hypercar','20270326T170000','20270326T171200'),vevent('Qatar 1812 KM - Race','20270327T140000','20270328T000000')])};
 t.mock.method(globalThis,'fetch',async url=>new Response(pages[new URL(url).pathname]??'',{status:200}));
 const env=store(),now=Date.parse('2027-03-20T00:00:00Z');
 assert.equal((await refreshCalendarSource(env,'wec',now)).error,null);
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),env,{},now)).json();
 const qatar=data.events.find(e=>e.id==='wec-2027-03-25-lusail');
 assert.deepEqual(qatar.sessions.map(s=>s.nameEn),['FP1','Qualifying - Hypercar','Race']);assert.equal(qatar.sessions[2].start,'2027-03-27T14:00:00+03:00');
 assert.equal(data.events.find(e=>e.id==='wec-2027-04-09-imola').sessions.length,0);
});

test('GTWC Australia reads the Adelaide timetable from its own event page once it is published',async t=>{
 const adelaide=table('Friday, 27 November',[['Practice 1','10:05','23:35'],['Qualifying 1','15:20','04:50']])+table('Sunday, 29 November',[['Race 2','11:30','01:00']]);
 t.mock.method(globalThis,'fetch',async url=>new Response(String(url).includes('/event/28/')?adelaide:'<html>calendar</html>',{status:200}));
 const env=store(),now=Date.parse('2026-11-20T00:00:00Z');
 assert.equal((await refreshCalendarSource(env,'gtwc-australia',now)).error,null);
 const data=await (await calendarRoute(new Request('https://test/api/race-calendar'),env,{},now)).json();
 const event=data.events.find(e=>e.id==='gtwc-australia-2026-11-26-adelaide');
 assert.equal(event.sessions.length,3);assert.equal(event.sessions[0].start,'2026-11-27T10:05:00+10:30');
});
