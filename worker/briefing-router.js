import {calendarEvents} from './race-calendar-data.js';
import {sessionSchedule} from './session-schedule.js';
import {sessionState} from './session-state.js';

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

export const WEC_LOGIN_URL='https://plus.fiawec.com/en';
export const ACCESS_CHOICE={
 question:'FIAWEC+ 라이브 타이밍을 어떻게 열까요?',
 options:[
  {id:'login',label:'직접 로그인할게요',description:'Claude가 FIAWEC+ 로그인 화면(plus.fiawec.com/en → Account)까지 엽니다. 비밀번호와 CAPTCHA만 직접 입력하세요.'},
  {id:'link',label:'링크를 붙여 넣을게요',description:'plus.fiawec.com/en/livestream/s-... 세션 링크를 주면 그 화면의 Live timing을 읽습니다.'}
 ],
 login_url:WEC_LOGIN_URL,
 navigation:['plus.fiawec.com/en → LIVE 표시 카드','/en/livestream/<세션> → Live timing','탭: Map(순위)·RaceLog(All/Race Control/Flags/Drivers Status)·Charts·Analysis(Pace/Consistency)','RaceLog의 Sky·Track Temperature 항목이 날씨, 제목 옆 초록 상자가 남은 시간'],
 signed_in_hint:'Account 화면에 "Signed in to FIAWEC+"가 보이면 로그인을 건너뛰고 바로 Live timing으로 갑니다.'
};

// One WEC card from wec_live_status. Sections follow the briefing order; anything the reader
// did not observe is left empty and named, never filled in.
export function buildWecBriefing(status={},route={},prefs=null,now=Date.now()){
 const a=route.active||null, live=status.live===true, records=Array.isArray(status.records)?status.records:[];
 const lines=records.map(text);
 const flags=lines.filter(t=>FLAG.test(t)).slice(-8).map(t=>({code:flagCode(t),text:t.slice(0,200)}));
 const investigations=lines.filter(t=>INVESTIGATION.test(t)).slice(-5);
 const weather=lines.filter(t=>WEATHER.test(t)).slice(-2);
 const current=flags.at(-1)?.code||null;
 const left=a?.end&&now<a.end?Math.max(0,Math.round((a.end-now)/60000)):null;
 const needsAccess=!!status.next_step;
 const fav=prefs?.preferences?.wecHypercarManufacturer||null;
 const header={series:'WEC',event:a?.event_ko||status.event||null,session:a?.session||status.session||null,
  status:live?'LIVE':a?.phase==='starting-soon'?'곧 시작':a?'세션 시간(수신 미확인)':'라이브 아님',
  time_left_minutes:left,time_left:left==null?null:`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`,
  clock:kst(now,{hour:'2-digit',minute:'2-digit'})+' KST',track_status:current||(live?'green':'unknown')};
 const right_now=needsAccess?'FIAWEC+ 로그인(CAPTCHA 포함)이 필요해 타이밍을 아직 읽지 못했습니다. 아래에서 방법을 골라 주세요.':
  live?[weather.at(-1),flags.at(-1)?.text].filter(Boolean).join(' / ')||'타이밍 표가 갱신 중입니다. 특이 사항은 RaceLog에 아직 없습니다.':
  `타이밍이 실시간으로 확인되지 않았습니다 (상태: ${status.state||'unknown'}). 오래된 표는 현재 상황으로 쓰지 않습니다.`;
 const pace=live?'단일 랩과 롱런을 나눠 봅니다. 토우·저연료 랩은 기준에서 뺍니다. 연속 스틴트가 짧거나 플래그·비가 있으면 레이스 페이스는 아직 판단하지 않습니다.':'라이브 타이밍이 없어 페이스를 판단하지 않습니다.';
 return {schema_version:5,series:'wec',route:{series:'wec',reason:route.reason||'schedule'},available:live,status:header.status,header,
  briefing:`${header.event||'WEC'} ${header.session||''} · ${right_now}`.trim(),
  sections:{right_now,flags:flags.length?flags:[],flags_note:flags.length?null:(live?'RaceLog에 플래그 기록이 없습니다.':'아직 읽지 못했습니다.'),investigations,pace,
   favourite:{manufacturer:fav,note:fav?(live?`${fav} 차량의 순위·격차와 관련 사건을 먼저 봅니다.`:`${fav}: 타이밍을 읽은 뒤 설명합니다.`):'계정 설정에 응원 제조사가 없습니다.'},personal_instructions:prefs?.personalInstructions?.text||null},
  access_choice:needsAccess?ACCESS_CHOICE:null,
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
  briefing:`지금 진행 중인 F1·WEC 세션이 없습니다.${rows.length?' 다음: '+rows.join(' / '):''}`,
  sections:{right_now:'지금 진행 중인 F1·WEC 세션이 없습니다.'},next_sessions:n,buttons:[{id:'refresh',label:'새로고침'}],freshness:{live:false}};
}

export function routedBriefingText(p){
 const s=p.sections||{};
 return [p.briefing,p.header?.time_left?`남은 시간 ${p.header.time_left}`:null,
  s.flags?.length?'플래그: '+s.flags.map(f=>f.text).join(' | '):s.flags_note?'플래그: '+s.flags_note:null,
  s.pace?'페이스: '+s.pace:null,s.favourite?'응원 팀: '+s.favourite.note:null,
  p.access_choice?'선택: '+p.access_choice.options.map(o=>o.label).join(' / '):null].filter(Boolean).join('\n');
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

export const BRIEFING_ROUTER_INSTRUCTIONS=' LIVE BRIEFING ("꽁보다 브리핑", "꽁보다 실시간브리핑", "live briefing"): call kongboda_live_briefing with series "auto" FIRST and ONLY. The server picks the series from the published schedule: route.series "wec" means a WEC window is open, so do not call fastf1_live_snapshot or any F1 tool; "f1" means the F1 flow; "none" means nothing is live, so say that and give next_sessions for each series. The returned card IS the briefing: it renders automatically as the first output; write no summary before it and at most one short line after it. Never present record_kind "off_schedule_record", a failover drill, a test or a stale snapshot as a live or real session result. CARD ORDER: header (series, event, session, live or not, time left, track status), right now (what is happening this moment), why the flags (each yellow, double yellow, red, FCY, SC with time, corner, race-control reason and investigations or penalties; say when no reason is published), race pace (single lap apart from long runs; exclude tow and low-fuel outliers; say plainly when pace is not readable yet and why), your team or drivers (favourite and personal_instructions from the card; position, gap to the real pack, incidents), standings only on request. WEC ACCESS: when the card has access_choice, show it as a choice box with exactly its two options (use the host\'s multiple-choice question tool when available; the card buttons are the fallback), never as a plain-text question. If the user picks login, open access_choice.login_url in the browser yourself and go to Account; if it already shows "Signed in to FIAWEC+" skip sign-in, otherwise leave only the password and CAPTCHA to the user and detect the finished sign-in yourself. Then open the LIVE card, /en/livestream/<session>, Live timing, and read Map, RaceLog (Race Control, Flags) and Analysis (Pace). If the user picks link, open that plus.fiawec.com link and read Live timing the same way. Then call kongboda_live_briefing again or render the same card order from what you read. KEEP BRIEFING FOR THE WHOLE SESSION: when the card has follow_up, the user wants a new card every follow_up.every_minutes until follow_up.until. After each card, schedule the next briefing back into this same conversation (send_later or the host equivalent, message: 꽁보다 실시간브리핑) unless one is already pending; each run posts a new card (never edit the old one). Stop scheduling when follow_up is null, the time passes follow_up.until, route.series changes, or the user says stop. If the host cannot schedule into this conversation, create one-time scheduled tasks every 15 minutes until follow_up.until instead, and say so in one line.';
