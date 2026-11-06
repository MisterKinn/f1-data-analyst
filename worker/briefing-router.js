import {calendarEvents} from './race-calendar-data.js';
import {sessionSchedule} from './session-schedule.js';
import {sessionState} from './session-state.js';
import {buildSessionAnalysis,sessionKind,ANALYSIS_TITLE} from './session-analysis.js';

// "꽁보다 실시간브리핑" picks the series from the published schedule, never from whichever
// collector happens to have data. A WEC window always wins over an old F1 snapshot.
const SERIES=['wec','f1'];
const kst=(ms,o)=>new Date(ms).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false,...o});
const when=ms=>`${kst(ms,{month:'numeric',day:'numeric'})} ${kst(ms,{hour:'2-digit',minute:'2-digit'})}`;
const label=s=>s.nameEn||s.name;

export function seriesNow(now=Date.now()){
 const active=[],next={};
 for(const event of calendarEvents.filter(e=>SERIES.includes(e.series))){
  for(const session of sessionSchedule[event.id]||[]){
   const st=sessionState(session,event,now);
   if(['live','starting-soon'].includes(st.phase))active.push({series:event.series,event:event.nameEn||event.name,event_ko:event.name,session:label(session),session_ko:session.name,phase:st.phase,start:st.start,end:st.end});
   if(st.phase==='upcoming'&&!next[event.series])next[event.series]={series:event.series,event:event.nameEn||event.name,session:label(session),start:new Date(st.start).toISOString(),text:`${event.name} ${session.name} · ${when(st.start)} (한국시간)`};
  }
 }
 // A live session beats one about to start; WEC beats F1 only when both are equally live.
 active.sort((a,b)=>(a.phase==='live'?0:1)-(b.phase==='live'?0:1)||SERIES.indexOf(a.series)-SERIES.indexOf(b.series));
 return {active:active[0]||null,all_active:active,next};
}

export function pickSeries(requested='auto',now=Date.now()){
 const state=seriesNow(now);
 if(requested==='f1'||requested==='wec')return {...state,series:requested,reason:'requested'};
 return {...state,series:state.active?.series||'none',reason:state.active?'schedule':'nothing_scheduled_now'};
}

const FLAG=/red flag|yellow|double yellow|\bfcy\b|full course|safety car|\bsc\b|slow zone|code 60|chequered|green flag|track clear/i;
const INVESTIGATION=/investigat|penalt|stop and go|drive through|warning|deleted|steward|noted/i;
const WEATHER=/sky:|track temperature|air temperature|humidity|rain/i;
const text=r=>Object.values(r||{}).join(' · ');
const flagCode=t=>/red flag/i.test(t)?'red':/full course|\bfcy\b/i.test(t)?'fcy':/safety car|\bsc\b/i.test(t)?'sc':/double yellow/i.test(t)?'double_yellow':/yellow|slow zone|code 60/i.test(t)?'yellow':/green|track clear/i.test(t)?'green':null;

export const WEC_CONNECT_URL='https://kongboda-motorsports.vercel.app/account#fiawec';
// FIAWEC+ needs a person: one link to the account page's FIAWEC+ 연결 (sign in once there,
// CAPTCHA included); crew who are not the owner just wait for the owner's connection.
export function wecConnect(status={}){
 const c=status.connect&&typeof status.connect==='object'?status.connect:null;
 if(c?.by==='owner')return {by:'owner',label:null,url:null,note:String(c.note||'운영자 FIAWEC+ 연결 대기').slice(0,200)};
 return {by:'self',label:'FIAWEC+ 연결',url:WEC_CONNECT_URL,note:String(c?.note||'꽁보다 계정 설정에서 FIAWEC+에 한 번 직접 로그인하세요(CAPTCHA는 직접 풀기). 다음 세션부터 자동으로 읽습니다.').slice(0,200)};
}

// One WEC card from wec_live_status. Sections follow the briefing order; anything the reader
// did not observe is left empty and named, never filled in.
export function buildWecBriefing(status={},route={},prefs=null,now=Date.now()){
 const a=route.active||null, live=status.live===true, records=Array.isArray(status.records)?status.records:[];
 const lines=records.map(text);
 const flags=lines.filter(t=>FLAG.test(t)).slice(-5).map(t=>({code:flagCode(t),text:t.slice(0,120)}));
 const investigations=lines.filter(t=>INVESTIGATION.test(t)).slice(-3);
 const weather=lines.filter(t=>WEATHER.test(t)).slice(-2);
 const current=flags.at(-1)?.code||null;
 const left=a?.end&&now<a.end?Math.max(0,Math.round((a.end-now)/60000)):null;
 const needsAccess=!!status.next_step;
 const fav=prefs?.preferences?.wecHypercarManufacturer||null;
 const header={series:'WEC',event:a?.event_ko||status.event||null,session:a?.session||status.session||null,
  status:live?'LIVE':a?.phase==='starting-soon'?'곧 시작':a?'세션 시간(수신 미확인)':'라이브 아님',
  time_left_minutes:left,time_left:left==null?null:`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`,
  clock:kst(now,{hour:'2-digit',minute:'2-digit'})+' KST',track_status:current||(live?'green':'unknown')};
 const connect=needsAccess?wecConnect(status):null;
 const right_now=needsAccess?(connect.by==='owner'?'FIAWEC+ 운영자 연결 대기 · 연결되면 자동 수신':status.state==='sign_in_expired'?'FIAWEC+ 연결 만료 · 아래 버튼으로 다시 연결':'FIAWEC+ 연결 필요 · 아래 버튼으로 한 번 로그인'):
  live?[weather.at(-1),flags.at(-1)?.text].filter(Boolean).join(' / ')||'타이밍 갱신 중 · RaceLog 특이사항 없음':
  `실시간 타이밍 미확인(${status.state||'unknown'}) · 지난 표는 안 씀`;
 const pace=live?'단일 랩·롱런 분리, 토우·저연료 랩 제외 · 스틴트가 짧거나 플래그·비면 판단 보류':'라이브 타이밍 없음 · 판단 보류';
 return {schema_version:5,series:'wec',route:{series:'wec',reason:route.reason||'schedule'},available:live,status:header.status,header,
  briefing:`${header.event||'WEC'} ${header.session||''} · ${right_now}`.trim(),
  sections:{right_now,flags:flags.length?flags:[],flags_note:flags.length?null:(live?'RaceLog 플래그 없음':'아직 못 읽음'),investigations,pace,pace_title:ANALYSIS_TITLE[sessionKind(a?.session||status.session||'')],
   favourite:{manufacturer:fav,note:fav?(live?`${fav} 순위·격차·사건 우선`:`${fav}: 타이밍 확인 후 설명`):'응원 제조사 미설정'},personal_instructions:prefs?.personalInstructions?.text||null},
  connect,
  buttons:[...(investigations.length?[{id:'decision',label:'판정 확인'}]:[]),{id:'standings',label:'전체 순위'},{id:'refresh',label:'새로고침'}],
  standings:null,next_sessions:route.next||{},wec_state:status.state||null,checked_at:status.checked_at||null,source:status.source||'FIAWEC+',
  freshness:{live,table_age_seconds:status.table_age_seconds??null}};
}

// Nothing scheduled right now: say so and give the next session of each series.
export function buildIdleBriefing(route={},now=Date.now()){
 const n=route.next||{};
 const rows=['f1','wec'].map(s=>n[s]?`${s.toUpperCase()}: ${n[s].text}`:null).filter(Boolean);
 return {schema_version:5,series:'none',route:{series:'none',reason:route.reason},available:false,status:'라이브 아님',
  header:{series:'—',status:'라이브 아님',clock:kst(now,{hour:'2-digit',minute:'2-digit'})+' KST',track_status:'unknown'},
  briefing:`진행 중인 F1·WEC 세션 없음.${rows.length?' 다음: '+rows.join(' / '):''}`,
  sections:{right_now:'진행 중인 F1·WEC 세션 없음'},next_sessions:n,buttons:[{id:'refresh',label:'새로고침'}],freshness:{live:false}};
}

export function routedBriefingText(p){
 const s=p.sections||{};
 return [p.briefing,p.header?.time_left?`남은 시간 ${p.header.time_left}`:null,
  s.flags?.length?'플래그: '+s.flags.map(f=>f.text).join(' | '):s.flags_note?'플래그: '+s.flags_note:null,
  s.pace?(s.pace_title||'페이스')+': '+s.pace:null,s.favourite?'응원 팀: '+s.favourite.note:null,
  p.connect?.url?`${p.connect.label}: ${p.connect.url}`:p.connect?.note||null].filter(Boolean).join('\n');
}

// True when a timestamp falls inside a published F1 session (30 min before start to 3 h after
// its end). Data outside every window — collector failover drills, tests — is never a result.
export function inScheduledF1Window(at){
 const t=Date.parse(at);if(!Number.isFinite(t))return false;
 for(const event of calendarEvents.filter(e=>e.series==='f1'))for(const session of sessionSchedule[event.id]||[]){
  const st=sessionState(session,event,t);
  if(Number.isFinite(st.start)&&t>=st.start-30*60000&&t<=(Number.isFinite(st.end)?st.end:st.start+2*3600000)+3*3600000)return true;
 }
 return false;
}

export const BRIEFING_ROUTER_INSTRUCTIONS=' LIVE BRIEFING ("꽁보다 브리핑", "꽁보다 실시간브리핑", "live briefing"): call kongboda_live_briefing with series "auto" FIRST and ONLY. The server picks the series from the published schedule: route.series "wec" means a WEC window is open, so do not call fastf1_live_snapshot or any F1 tool; "f1" means the F1 flow; "none" means nothing is live, so say that and give next_sessions for each series. The returned card IS the briefing: it renders automatically as the first output; write no summary before it and at most one short line after it. Never present record_kind "off_schedule_record", a failover drill, a test or a stale snapshot as a live or real session result. CARD ORDER: header (series, event, session, live or not, time left, track status), right now (what is happening this moment), why the flags (each yellow, double yellow, red, FCY, SC with time, corner, race-control reason and investigations or penalties; say when no reason is published), the session analysis titled by sections.pace_title (qualifying: best-lap gaps by sector, who owns each sector, the knockout line and where the favourite loses time; practice: quali sims on soft compared with rivals and long-run averages kept apart; race: recent green-lap pace against the car ahead and the leader; add whatever else the data shows that explains the session, and say plainly when something is not readable yet and why), your team or drivers (favourite and personal_instructions from the card; position, gap to the real pack, incidents), standings only on request. MOBILE BREVITY (F1 and WEC alike): keep every card section short enough for a phone screen, about two-thirds of a full write-up: short phrases rather than full sentences, about one line per item, no repeating the same fact in two sections, no greetings or filler; keep the same sections and facts, cut the words. WEC ACCESS: when the card has connect, FIAWEC+ needs a person. If connect.url is set, give that one link as a button or link ("FIAWEC+ 연결", the Kongboda account page): the user signs in to FIAWEC+ there once, solving any CAPTCHA themselves, and later sessions read timing automatically with no sign-in. Never open plus.fiawec.com, never ask for a session link, never type a password or solve a CAPTCHA. If connect.by is "owner" (crew), say the owner\'s FIAWEC+ connection is being renewed and keep briefing. KEEP BRIEFING FOR THE WHOLE SESSION: when the card has follow_up, the user wants a new card every follow_up.every_minutes until follow_up.until. After each card, schedule the next briefing back into this same conversation (send_later or the host equivalent, message: 꽁보다 실시간브리핑) unless one is already pending; each run posts a new card (never edit the old one). Stop scheduling when follow_up is null, the time passes follow_up.until, route.series changes, or the user says stop. If the host cannot schedule into this conversation, create one-time scheduled tasks every 15 minutes until follow_up.until instead, and say so in one line.';

// F1 card in the same order as the WEC card: right now → why the flags → race pace → your
// team, standings only on request. Built only from what the FastF1 snapshot actually holds.
const lapSeconds=t=>{const m=String(t||'').match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);return m?(Number(m[1]||0)*60+Number(m[2])):null;};
const F1_TRACK={'1':'green','2':'yellow','4':'sc','5':'red','6':'vsc','7':'vsc'};
const sameName=(a,b)=>{const x=String(a||'').toLowerCase(),y=String(b||'').toLowerCase();if(!x||!y)return false;const last=y.split(/\s+/).at(-1);return x.includes(last)||y.includes(x);};
export function buildF1Card(p,snapshot={},route={},prefs=null,now=Date.now()){
 const a=route.active&&route.active.series==='f1'?route.active:null, topics=snapshot?.topics||{}, live=p.freshness?.live===true;
 const rows=(p.leaderboard?.length?p.leaderboard:p.final_leaderboard)||[];
 const msgs=(Array.isArray(topics.RaceControlMessages?.Messages)?topics.RaceControlMessages.Messages:Object.values(topics.RaceControlMessages?.Messages||{})).filter(m=>m&&typeof m==='object');
 const line=m=>[m.Utc?String(m.Utc).slice(11,16)+' UTC':null,m.Lap?`L${m.Lap}`:null,String(m.Message||'').slice(0,120)].filter(Boolean).join(' · ');
 const flags=msgs.filter(m=>FLAG.test(`${m.Category||''} ${m.Flag||''} ${m.Message||''}`)||/flag|safetycar|vsc/i.test(m.Category||'')).slice(-5).map(m=>({code:flagCode(`${m.Flag||''} ${m.Message||''}`)||(/vsc|virtual/i.test(m.Message||'')?'fcy':null),text:line(m)}));
 const investigations=msgs.filter(m=>INVESTIGATION.test(m.Message||'')).slice(-3).map(line);
 const left=a?.end&&now<a.end?Math.max(0,Math.round((a.end-now)/60000)):null;
 const lap=topics.LapCount, lapText=lap?.CurrentLap&&lap?.TotalLaps?`랩 ${lap.CurrentLap}/${lap.TotalLaps}`:null;
 const header={series:'F1',event:a?.event_ko||p.session?.name||null,session:a?.session||null,status:p.status,
  time_left_minutes:left,time_left:(live&&lapText)||(left==null?null:`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`),
  clock:new Date(now).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false,hour:'2-digit',minute:'2-digit'})+' KST',
  track_status:F1_TRACK[String(topics.TrackStatus?.Status??'')]||(live?'green':'unknown')};
 const w=p.weather||{}, wx=[w.track_temperature&&`노면 ${w.track_temperature}`,w.air_temperature&&`기온 ${w.air_temperature}`,w.humidity&&`습도 ${w.humidity}`,/^(1|true)$/i.test(String(w.rainfall||''))?'비 감지':null].filter(Boolean).join(' · ');
 const pits=rows.filter(r=>r.in_pit).map(r=>r.code);
 const right_now=live?[p.track_status?.label&&p.track_status.label!=='정상'?p.track_status.label:'그린 플래그',lapText,wx||null,pits.length?`피트: ${pits.join(', ')}`:null,flags.at(-1)?`RC ${flags.at(-1).text}`:null].filter(Boolean).join(' / '):p.briefing;
 const team=prefs?.preferences?.f1Team||null, drivers=prefs?.preferences?.f1Drivers||[];
 const mine=rows.filter(r=>drivers.some(d=>sameName(r.name,d))||(team&&String(r.team||'').toLowerCase().includes(team.toLowerCase())));
 const timed=rows.map(r=>({...r,best:lapSeconds(r.best_lap)})).filter(r=>r.best), ref=timed.slice().sort((x,y)=>x.best-y.best)[0];
 const analysis=buildSessionAnalysis({sessionName:a?.session||topics.SessionInfo?.Name||'',live,snapshot,rows,mine:mine.map(r=>r.number)});
 const pace=[...analysis.lines,analysis.note].filter(Boolean).join('\n');
 const tele=mine[0]&&ref&&ref.number!==mine[0].number?{id:'telemetry',label:`${mine[0].code} vs ${ref.code} 텔레메트리`,prompt:`꽁보다 브리핑: ${mine[0].code}와 ${ref.code}의 이번 세션 최고 랩 텔레메트리(속도·브레이크·델타, 코너별 우위)를 비교해 줘.`}:null;
 const favNote=!team&&!drivers.length?'응원 팀·드라이버 미설정':!mine.length?`${[team,...drivers].filter(Boolean).join(' · ')}: 타이밍 확인 후 설명`:
  mine.map(r=>{const b=lapSeconds(r.best_lap);const d=b&&ref?` 최고랩 +${(b-ref.best).toFixed(3)}`:'';const inv=investigations.find(t=>t.includes(String(r.number)));return `${r.code} P${r.position}${r.gap&&r.gap!=='LEADER'?` ${r.gap}`:''}${d}${r.compound?` · ${r.compound}${r.tyre_laps!=null?` ${r.tyre_laps}랩`:''}`:''}${r.in_pit?' · 피트':''}${inv?' · 조사 중':''}`;}).join(' / ');
 return {...p,header,sections:{right_now,flags,flags_note:flags.length?null:(live?'플래그 기록 없음':'아직 못 읽음'),investigations,pace,pace_title:analysis.title,analysis,
  favourite:{team,drivers,note:favNote},personal_instructions:prefs?.personalInstructions?.text||null},
  buttons:[...(investigations.length?[{id:'decision',label:'판정 확인'}]:[]),...(tele?[tele]:[]),{id:'standings',label:'전체 순위'},{id:'refresh',label:'새로고침'}]};
}
