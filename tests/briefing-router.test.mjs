import test from 'node:test';
import assert from 'node:assert/strict';
import {pickSeries,buildWecBriefing,buildF1Card,routedBriefingText,buildIdleBriefing,inScheduledF1Window,BRIEFING_ROUTER_INSTRUCTIONS} from '../worker/briefing-router.js';
import {buildLiveBriefing} from '../worker/live-briefing.js';
import {LIVE_APP_TOOL,readAppResource,LIVE_APP_URI} from '../worker/mcp-app.js';
import worker from '../worker/index.js';

test('a WEC window routes to WEC, an F1 session to F1, otherwise nothing live',()=>{
 assert.equal(pickSeries('auto',Date.parse('2026-11-06T10:00:00Z')).series,'wec');
 assert.equal(pickSeries('auto',Date.parse('2026-11-06T15:45:00Z')).series,'f1');
 const idle=pickSeries('auto',Date.parse('2026-11-04T00:00:00Z'));
 assert.equal(idle.series,'none');assert.ok(idle.next.f1&&idle.next.wec);
 assert.match(buildIdleBriefing(idle).briefing,/진행 중인 F1·WEC 세션이 없습니다/);
});
test('WEC login needed gives a two-option choice box with the FIAWEC+ login page',()=>{
 const route=pickSeries('auto',Date.parse('2026-11-06T10:00:00Z'));
 const card=buildWecBriefing({state:'human_verification_required',next_step:'x'},route,{preferences:{wecHypercarManufacturer:'Ferrari'}},Date.parse('2026-11-06T10:00:00Z'));
 assert.deepEqual(card.access_choice.options.map(o=>o.id),['login','link']);
 assert.equal(card.access_choice.login_url,'https://plus.fiawec.com/en');
 assert.equal(card.header.time_left,'1:00');assert.equal(card.available,false);
 assert.match(card.sections.favourite.note,/Ferrari/);
});
test('WEC card explains flags with their reasons from the race log',()=>{
 const route=pickSeries('auto',Date.parse('2026-11-06T10:00:00Z'));
 const card=buildWecBriefing({state:'reading',live:true,records:[{t:'09:41',m:'RED FLAG - car 51 stopped at T1'},{t:'09:50',m:'Car 7 under investigation - track limits'}]},route,null,Date.parse('2026-11-06T10:00:00Z'));
 assert.equal(card.sections.flags[0].code,'red');assert.match(card.sections.flags[0].text,/car 51/);
 assert.ok(card.buttons.some(b=>b.id==='decision'));assert.equal(card.access_choice,null);
});
test('off-schedule F1 data (failover drill) is never a session result',()=>{
 assert.equal(inScheduledF1Window('2026-11-05T10:00:00Z'),false);
 const at='2026-11-05T10:00:00Z';
 const drill=buildLiveBriefing({available:true,connected:false,received_at:at,freshness:{live:false},topics:{SessionInfo:{Key:1,Name:'Race'},SessionStatus:{Status:'Finalised'},DriverList:{'3':{Tla:'VER'}},TimingData:{Lines:{'3':{Position:'1'}}}}},{now:Date.parse('2026-11-06T10:00:00Z')});
 assert.equal(drill.final_leaderboard.length,0);assert.equal(drill.record_kind,'off_schedule_record');
 assert.match(drill.briefing,/실제 세션 결과로 표시하지 않습니다/);
});
test('connector tells the model: card first, no F1 during WEC, choice box, login page',async()=>{
 for(const part of ['series "auto" FIRST','do not call fastf1_live_snapshot','write no summary before it','choice box','Signed in to FIAWEC+','off_schedule_record','KEEP BRIEFING FOR THE WHOLE SESSION','follow_up.until'])assert.ok(BRIEFING_ROUTER_INSTRUCTIONS.includes(part),part);
 assert.deepEqual(LIVE_APP_TOOL.inputSchema.properties.series.enum,['auto','f1','wec']);
 const html=readAppResource(LIVE_APP_URI).contents[0].text;
 assert.match(html,/renderRouted/);assert.match(html,/ui\/message/);
 const init=await (await worker.fetch(new Request('https://k.test/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}})}),{})).json();
 assert.ok(init.result.instructions.indexOf('LIVE BRIEFING')<init.result.instructions.indexOf('WEC BRIEFING FORMAT'));
});
test('setup prompt books one calendar-timed task per series that re-books itself',async()=>{
 const {SETUP_PROMPTS}=await import('../worker/briefing-guide.js');
 for(const key of ['claude','chatgpt']){const t=SETUP_PROMPTS[key];
  for(const part of ['꽁보다 F1 실시간 브리핑','꽁보다 WEC 실시간 브리핑','딱 하나씩','캘린더','시작 5분 뒤','다음 F1 세션','다음 WEC 세션','follow_up','10분마다','기존 예약 작업'])assert.ok(t.includes(part),key+' '+part);
  assert.ok(!t.includes('매시간 실행,'),key+' no hourly task');}
});
test('F1 card follows the WEC order: situation, flag reasons, pace, favourite drivers; standings on request',()=>{
 const now=Date.parse('2026-11-06T15:45:00Z'),route=pickSeries('auto',now);
 assert.equal(route.series,'f1');
 const p={series:'f1',status:'LIVE',briefing:'x',freshness:{live:true},track_status:{label:'옐로'},weather:{track_temperature:'31°C'},
  leaderboard:[{position:1,number:'1',code:'VER',name:'Max Verstappen',team:'Red Bull',best_lap:'1:11.200',gap:'LEADER'},{position:4,number:'63',code:'RUS',name:'George Russell',team:'Mercedes',best_lap:'1:11.600',gap:'+3.1',compound:'MEDIUM',tyre_laps:5}],final_leaderboard:[]};
 const snap={topics:{TrackStatus:{Status:'2'},RaceControlMessages:{Messages:[{Utc:'2026-11-06T15:40:00',Category:'Flag',Flag:'YELLOW',Message:'YELLOW IN TRACK SECTOR 7'},{Utc:'2026-11-06T15:41:00',Category:'Other',Message:'CAR 63 (RUS) TRACK LIMITS NOTED - UNDER INVESTIGATION'}]}}};
 const c=buildF1Card(p,snap,route,{preferences:{f1Team:'Mercedes',f1Drivers:['George Russell','Andrea Kimi Antonelli']}},now);
 assert.equal(c.header.track_status,'yellow');assert.match(c.sections.right_now,/옐로/);
 assert.equal(c.sections.flags[0].code,'yellow');assert.match(c.sections.flags[0].text,/SECTOR 7/);
 assert.match(c.sections.pace,/단일 랩/);assert.match(c.sections.pace,/롱런/);
 assert.match(c.sections.favourite.note,/RUS P4/);assert.match(c.sections.favourite.note,/\+0\.400s/);assert.match(c.sections.favourite.note,/조사/);
 assert.ok(c.buttons.some(b=>b.id==='standings'));assert.ok(c.buttons.some(b=>b.id==='decision'));
 assert.match(routedBriefingText(c),/응원 팀/);
});
test('already registered users get quick setup: briefing and scheduled tasks without questions',async()=>{
 const {SETUP_PROMPTS}=await import('../worker/briefing-guide.js');
 for(const key of ['claude','chatgpt'])for(const part of ['[빠른 설정]','kongboda_my_preferences','묻지 말고'])assert.ok(SETUP_PROMPTS[key].includes(part),key+' '+part);
});
