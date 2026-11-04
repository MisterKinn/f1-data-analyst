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
test('sign-in is Google only on every host; no ChatGPT sign-in or account-link buttons',async()=>{
 for(const host of ['https://kongboda-motorsports.vercel.app','https://kongboda.nuttycabin128.chatgpt.site']){
  const page=await html(host+'/account');
  assert.doesNotMatch(page,/signin-with-chatgpt|ChatGPT로 로그인|Google · ChatGPT 계정 연결/);
 }
});
test('the MCP address is shown on the guide only after Google sign-in; the home links to the guide only',async()=>{
 const home=await html('https://kongboda-motorsports.vercel.app/');
 assert.doesNotMatch(home.slice(home.indexOf('class="connect-section"'),home.indexOf('id="championships"')),/data-copy=/);
 assert.match(home,/<a class="button primary" href="\/guide">연결 방법 보기<\/a>/);
 for(const path of ['/guide']){
  const page=await html('https://kongboda-motorsports.vercel.app'+path);
  assert.doesNotMatch(page,/kongboda-motorsports\.vercel\.app\/mcp/,path);assert.match(page,/auth\/google\/start\?return_to=%2Fguide/);
  assert.doesNotMatch(page,/로그인 후 연결 주소 복사/,path);
 }
});
test('the guide is a four-step setup with a detailed Claude custom connector card, shows the same example cards as the home, and drops clutter',async()=>{
 const guide=await html('https://kongboda-motorsports.vercel.app/guide');
 const steps=guide.slice(guide.indexOf('<ol class="guide-steps">'),guide.indexOf('</section>',guide.indexOf('<ol class="guide-steps">')));assert.equal((steps.match(/<li><h3>/g)||[]).length,4);assert.match(guide,/‘커스텀 커넥터’를 만들어/);{const card=guide.slice(guide.indexOf('client-guide-claude'),guide.indexOf('</div>',guide.indexOf('client-guide-claude')));assert.doesNotMatch(card.replace(/Kongboda Motorsports|MCP|URL|OAuth|claude\.ai|Google|Claude|Team·Enterprise/g,''),/‘[^’]*[A-Za-z][^’]*’/,'Korean guide must use the Korean Claude UI labels');assert.match(card,/‘지금 로그인’/);assert.match(card,/‘자동으로 등록’/);}assert.equal((guide.match(/<ol class="connector-steps">[\s\S]*?<\/ol>/)[0].match(/<li>/g)||[]).length,6);assert.match(guide,/본인의 F1 TV 계정/);
 assert.match(guide,/id="kb-recorded"/);
 assert.match(guide,/묻지 않아도 먼저/);
 assert.doesNotMatch(guide,/인터랙티브 카드 읽는 법|첫 질문 복사|대회·연도·세션을 함께 말하면/);
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

test('the public calendar response can be cached by the CDN for a few minutes',async()=>{
 const response=await calendarRoute(new Request('https://site.test/api/race-calendar'),{},{});
 assert.match(response.headers.get('cache-control'),/public/);
 assert.match(response.headers.get('cache-control'),/s-maxage=300/);
});

import {readFileSync} from 'node:fs';
test('the daily refresh also pre-loads standings for official-record series',()=>{
 const script=readFileSync(new URL('../scripts/refresh-published-calendars.mjs',import.meta.url),'utf8');
 for(const series of ['imsa','formula-e','nls','elms','alms','lemanscup'])assert.match(script,new RegExp("'"+series+"'"));
 assert.match(script,/\/api\/championship-standings\?series=/);
});
test('the PC collector guide points at the current site',()=>{
 const guide=readFileSync(new URL('../collector/README_KO.txt',import.meta.url),'utf8');
 assert.doesNotMatch(guide,/chatgpt\.site/);
 assert.match(guide,/https:\/\/kongboda-motorsports\.vercel\.app\/live/);
});

test('signed-in users see the MCP address; crew are told they connect automatically',async()=>{
 const {websiteRoute}=await import('../worker/website.js');
 const google={sub:'g',email:'g@example.invalid',name:'G'};
 const account={id:'a',name:'G',identities:[{provider:'google'}]};
 const member=await websiteRoute(new Request('https://kongboda-motorsports.vercel.app/guide'),{google,accountInfo:{account}}).text();
 assert.match(member,/data-copy="https:\/\/kongboda-motorsports\.vercel\.app\/mcp"/);assert.match(member,/본인의 F1 TV 계정/);
 const crew=await websiteRoute(new Request('https://kongboda-motorsports.vercel.app/guide'),{google,accountInfo:{account},crewRegistered:true}).text();
 assert.match(crew,/운영자 계정의 실시간 수집에 자동으로 연결/);assert.doesNotMatch(crew,/본인의 F1 TV 계정/);
});

test('home post-race cards drop the support label; a standalone qualifying is spelled out',async()=>{
 const home=await html('https://kongboda-motorsports.vercel.app/');
 const post=home.slice(home.indexOf('class="compact-series"'),home.indexOf('</div>',home.indexOf('class="compact-series"')));
 assert.doesNotMatch(post,/공식 기록으로 사후 분석/);
 const {compactSessionName}=await import('../worker/race-features.js');
 assert.equal(compactSessionName('퀄리파잉'),'퀄리파잉');assert.equal(compactSessionName('Qualifying','en'),'Qualifying');assert.equal(compactSessionName('Qualifying','ko'),'퀄리파잉');for(const n of ['Sprint Qualifying','Sprint Shootout','스프린트 퀄리파잉'])assert.equal(compactSessionName(n),'SQ');assert.equal(compactSessionName('Sprint'),'스프린트');assert.equal(compactSessionName('Sprint','en'),'Sprint');assert.equal(compactSessionName('스프린트 레이스'),'스프린트');assert.equal(compactSessionName('Practice 1'),'FP1');assert.equal(compactSessionName('Race'),'레이스');assert.equal(compactSessionName('LMGT3 Qualifying'),'LMGT3 Q');
});

test('WEC manufacturer marks use their own colours while F1 colours stay',async()=>{
 const {readFile}=await import('node:fs/promises');
 for(const file of ['worker/website.js','worker/race-results-ui.js']){
  const source=await readFile(new URL('../'+file,import.meta.url),'utf8');
  assert.match(source,/wecColors=\{genesis:'#ff7a1a',peugeot:'#b5e61d',alpine:'#3b82f6',astonmartin:'#00806f',cadillac:'#d4a72c',toyota:'#ffffff'\}/,file);
  assert.match(source,/cadillac:'#d4c6ff'/,file+' keeps the F1 Cadillac colour');
 }
});
