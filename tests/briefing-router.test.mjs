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
 assert.match(buildIdleBriefing(idle).briefing,/진행 중인 F1·WEC 세션 없음/);
});
test('WEC login needed gives a two-option choice box with the FIAWEC+ login page',()=>{
 const route=pickSeries('auto',Date.parse('2026-11-06T10:00:00Z'));
 const card=buildWecBriefing({state:'authentication_action_required',next_step:'x'},route,{preferences:{wecHypercarManufacturer:'Ferrari'}},Date.parse('2026-11-06T10:00:00Z'));
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
 for(const part of ['series "auto" FIRST','do not call fastf1_live_snapshot','write no summary before it','choice box','ALWAYS a choice box','requires_local_device','Signed in to FIAWEC+','off_schedule_record','KEEP BRIEFING FOR THE WHOLE SESSION','follow_up.until'])assert.ok(BRIEFING_ROUTER_INSTRUCTIONS.includes(part),part);
 assert.deepEqual(LIVE_APP_TOOL.inputSchema.properties.series.enum,['auto','f1','wec']);
 const html=readAppResource(LIVE_APP_URI).contents[0].text;
 assert.match(html,/renderRouted/);assert.match(html,/ui\/message/);
 const init=await (await worker.fetch(new Request('https://k.test/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18'}})}),{})).json();
 assert.ok(init.result.instructions.indexOf('LIVE BRIEFING')<init.result.instructions.indexOf('WEC BRIEFING FORMAT'));
});
test('setup prompt books one calendar-timed task per series that re-books itself',async()=>{
 const {SETUP_PROMPTS}=await import('../worker/briefing-guide.js');
 for(const key of ['claude','chatgpt']){const t=SETUP_PROMPTS[key];
  for(const part of ['꽁보다 F1 실시간 브리핑','꽁보다 WEC 실시간 브리핑','딱 하나씩','캘린더','시작 5분 전','선택 박스','requires_local_device','다음 F1 세션','다음 WEC 세션','follow_up','10분마다','기존 예약 작업'])assert.ok(t.includes(part),key+' '+part);
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
 assert.equal(c.sections.pace_title,'프랙티스 분석');
 assert.match(c.sections.favourite.note,/RUS P4/);assert.match(c.sections.favourite.note,/최고랩 \+0\.400/);assert.match(c.sections.favourite.note,/조사/);
 assert.ok(c.buttons.some(b=>b.id==='standings'));assert.ok(c.buttons.some(b=>b.id==='decision'));
 assert.match(routedBriefingText(c),/응원 팀/);
});
test('already registered users get quick setup: briefing and scheduled tasks without questions',async()=>{
 const {SETUP_PROMPTS}=await import('../worker/briefing-guide.js');
 for(const key of ['claude','chatgpt'])for(const part of ['[빠른 설정]','kongboda_my_preferences','묻지 말고'])assert.ok(SETUP_PROMPTS[key].includes(part),key+' '+part);
});

test('the analysis section follows the session: qualifying sectors, practice sims and long runs, race vs car ahead',async()=>{
 const {buildSessionAnalysis,sessionKind}=await import('../worker/session-analysis.js');
 assert.equal(sessionKind('Qualifying'),'qualifying');assert.equal(sessionKind('Sprint Qualifying'),'qualifying');assert.equal(sessionKind('Practice 2'),'practice');assert.equal(sessionKind('Sprint'),'race');assert.equal(sessionKind('하이퍼카 하이퍼폴'),'qualifying');
 const rows=[{number:'1',code:'VER',position:1},{number:'4',code:'NOR',position:2,interval:'+1.2'},{number:'63',code:'RUS',position:3,interval:'+0.8',compound:'HARD',tyre_laps:12}];
 const bl=(n,t,s1,s2,s3,c)=>({driver_number:n,lap_time:t,status:'complete',sectors:{S1:s1,S2:s2,S3:s3},tyre:c?{compound:c}:undefined});
 const q=buildSessionAnalysis({sessionName:'Qualifying',live:true,rows,mine:['63'],snapshot:{topics:{TimingData:{SessionPart:3}},lap_archive:{best_laps:{Q3:{'1':bl('1','1:10.000','20.000','30.000','20.000'),'4':bl('4','1:10.100','19.950','30.150','20.000'),'63':bl('63','1:10.300','20.050','30.200','20.050')}},records:[]}}});
 assert.equal(q.title,'퀄리파잉 페이스');assert.match(q.lines.join('|'),/S1 NOR 19\.950/);assert.match(q.lines.join('|'),/RUS P3 \+0\.300.*S2 \+0\.200.*S2 최대 손실/);
 const rec=(n,i,t)=>({driver_number:n,lap_number:i,lap_time_ms:t,completed_at:`2026-11-06T16:${String(i).padStart(2,'0')}:00Z`,track_status_at_completion:'1'});
 const records=[...[1,2,3,4,5].map(i=>rec('4',i,74000+i*50)),...[1,2,3,4,5].map(i=>rec('63',i,74400+i*80)),...[1,2,3,4].map(i=>rec('1',i,73900)),...[1,2,3,4].map(i=>rec('16',i,74100))];
 const pr=buildSessionAnalysis({sessionName:'Practice 2',live:true,rows:[...rows,{number:'16',code:'LEC',position:4}],mine:['63'],snapshot:{topics:{},lap_archive:{best_laps:{session:{'1':bl('1','1:09.900','20.0','29.9','20.0','SOFT'),'63':bl('63','1:10.200','20.1','30.0','20.1','SOFT')}},records}}});
 const t=pr.lines.join('|');assert.match(t,/퀄리 시뮬/);assert.match(t,/VER 1:09\.900 · RUS \+0\.300/);assert.match(t,/롱런/);assert.match(t,/RUS 롱런/);assert.match(t,/추세 \+0\.080\/랩/);
 const ra=buildSessionAnalysis({sessionName:'Race',live:true,rows,mine:['63'],snapshot:{topics:{},lap_archive:{best_laps:{},records}}});
 assert.equal(ra.title,'레이스 페이스');assert.match(ra.lines.join('|'),/앞차 NOR\(\+0\.8\) 대비 \+0\.\d{3}\/랩 → 멀어짐/);
 const none=buildSessionAnalysis({sessionName:'Race',live:false,rows,mine:[],snapshot:{}});assert.match(none.lines[0],/판단 보류/);
});

test('setup offers both sign-ins early with a skip option',async()=>{
 const {SETUP_PROMPTS}=await import('../worker/briefing-guide.js');
 for(const key of ['claude','chatgpt']){const t=SETUP_PROMPTS[key];
  for(const part of ['미리 로그인','지금 로그인','나중에(건너뛰기)','/live','plus.fiawec.com/en → Account','로그인만 해','건너뛰기 가능'])assert.ok(t.includes(part),key+' '+part);}
});
test('a card outside a live session never shows an old lap count as the headline',()=>{
 const p={series:'f1',status:'점검 기록',briefing:'x',freshness:{live:false},track_status:{},weather:{},leaderboard:[],final_leaderboard:[]};
 const c=buildF1Card(p,{topics:{LapCount:{CurrentLap:30,TotalLaps:30}}},{series:'f1'},null,Date.parse('2026-11-06T11:00:00Z'));
 assert.equal(c.header.time_left,null);
});
