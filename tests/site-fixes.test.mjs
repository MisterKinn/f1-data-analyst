import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseFastF1Schedule,normalizeOfficialEvents,calendarRoute} from '../worker/calendar-refresh.js';
import {calendarEvents} from '../worker/race-calendar-data.js';

test('F1 schedule rows without *_date_utc use the local time plus gmt_offset',()=>{
 const [event]=parseFastF1Schedule({round_number:{'0':20},event_name:{'0':'São Paulo Grand Prix'},event_date:{'0':'2026-11-08T16:00:00'},gmt_offset:{'0':'-03:00'},
  session1:{'0':'Practice 1'},session1_date:{'0':'2026-11-06T12:30:00'},session5:{'0':'Race'},session5_date:{'0':'2026-11-08T14:00:00'}});
 assert.deepEqual(event.sessions.map(s=>[s.name,s.start]),[['Practice 1','2026-11-06T12:30:00-03:00'],['Race','2026-11-08T14:00:00-03:00']]);
});

test('an official refresh without session times keeps the checked-in sessions',()=>{
 const old=calendarEvents.find(e=>e.id==='f1-2026-11-06-interlagos');
 const [event]=normalizeOfficialEvents([{name:'São Paulo Grand Prix',startDate:'2026-11-06',endDate:'2026-11-08',sessions:[]}],'f1','https://example.test',calendarEvents);
 assert.equal(event.id,old.id);
 assert.ok(event.sessions.length>=5,'FP1..Race kept');
});

test('series whose official refresh failed still show the checked-in schedule, marked unverified',async()=>{
 const now=Date.parse('2026-11-04T03:00:00Z');
 const store=new Map([['calendar-refresh/v1/wec.json',JSON.stringify({checkedAt:Date.parse('2026-10-20T00:00:00Z'),attemptedAt:now-1000,error:'Official schedule refresh unavailable',events:[]})]]);
 const env={BUCKET:{get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k))}:null,put:async()=>{}}};
 const data=await (await calendarRoute(new Request('https://site.test/api/race-calendar?series=wec'),env,{},now)).json();
 const monza=data.events.find(e=>e.id==='wec-2026-11-06-monza');
 assert.ok(monza,'Monza 6 Hours is listed');
 assert.equal(monza.verified,false);
 assert.equal(data.unavailable,false);
});

import {calendarStatusText} from '../worker/race-features.js';
test('calendar status uses a readable local time, not a raw ISO stamp',()=>{
 const data={checkedAt:'2026-11-04T02:32:39.984Z',stale:true};
 const ko=calendarStatusText(data,{lang:'ko',zone:'Asia/Seoul'});
 assert.equal(ko,'한국시간 기준 · 11월 4일 11:32 확인 · 일부 대회는 공식 확인 대기');
 assert.doesNotMatch(ko,/T\d\d:|Z$/);
 assert.equal(calendarStatusText({checkedAt:'2026-11-04T02:32:39.984Z',stale:false},{lang:'en',zone:'Europe/London'}),'Your local time · checked 4 Nov, 02:32');
 assert.equal(calendarStatusText({checkedAt:null,stale:true},{lang:'ko',zone:'Asia/Seoul'}),'한국시간 기준 · 공식 확인 대기');
});

import {websiteRoute} from '../worker/website.js';
const html=async(url,headers={})=>websiteRoute(new Request(url,{headers})).text();
test('ChatGPT sign-in button only appears where the ChatGPT platform serves it',async()=>{
 assert.doesNotMatch(await html('https://kongboda-motorsports.vercel.app/account'),/signin-with-chatgpt/);
 assert.match(await html('https://kongboda.nuttycabin128.chatgpt.site/account'),/href="\/signin-with-chatgpt\?return_to=%2Faccount"/);
});
test('the MCP address can be copied without signing in',async()=>{
 for(const path of ['/','/guide']){
  const page=await html('https://kongboda-motorsports.vercel.app'+path);
  assert.match(page,/data-copy="https:\/\/kongboda-motorsports\.vercel\.app\/mcp"/,path);
  assert.doesNotMatch(page,/로그인 후 연결 주소 복사/,path);
 }
});
test('the guide numbers its MCP steps from 01 and does not repeat the homepage examples',async()=>{
 const guide=await html('https://kongboda-motorsports.vercel.app/guide');
 const section=guide.slice(guide.indexOf('id="mcp-guide"'),guide.indexOf('</section>',guide.indexOf('id="mcp-guide"')));
 assert.deepEqual([...section.matchAll(/step-number">(\d\d)\//g)].map(m=>m[1]),['01','02']);
 assert.doesNotMatch(guide,/id="kb-recorded"/);
 assert.match(guide,/href="\/#kb-recorded"/,'links to the examples on the homepage instead');
 assert.match(await html('https://kongboda-motorsports.vercel.app/'),/id="kb-recorded"/);
});

import {imsaCategoryLabel} from '../worker/series_standings.js';
test('IMSA categories read as class and kind, not Al Kamel file names',()=>{
 assert.equal(imsaCategoryLabel('IWSC 01 GTP Drivers'),'GTP · 드라이버');
 assert.equal(imsaCategoryLabel('IWSC 10 GTDPRO Manufacturers'),'GTD PRO · 매뉴팩처러');
 assert.equal(imsaCategoryLabel('IWSC 04 LMP2 Teams'),'LMP2 · 팀');
 assert.equal(imsaCategoryLabel('08 IMEC GT Daytona PRO Drivers Standings Overall'),'엔듀런스컵 · GTD PRO · 드라이버');
 assert.equal(imsaCategoryLabel('11 IMEC GT Daytona Drivers Standings Overall'),'엔듀런스컵 · GTD · 드라이버');
 assert.equal(imsaCategoryLabel('VP Fuels Front Runner Award - IWSC 02 LMP2'),'VP Fuels 프런트러너 상 · LMP2');
 assert.equal(imsaCategoryLabel('S01 Jim Trueman Award'),'Jim Trueman 상');
});
