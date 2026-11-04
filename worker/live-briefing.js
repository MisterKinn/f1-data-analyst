import {calendarEvents} from './race-calendar-data.js';
import {sessionSchedule} from './session-schedule.js';

const kst=(ms,options)=>new Date(ms).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false,...options});
const sessionLabel=name=>({'Sprint Qualifying':'스프린트 퀄리파잉','Sprint Shootout':'스프린트 퀄리파잉','Sprint':'스프린트','Qualifying':'퀄리파잉','Race':'레이스'})[name]||name;
// Next official F1 session from the checked-in schedule (Korean time).
export function nextF1Session(now=Date.now()){
 for(const event of calendarEvents.filter(e=>e.series==='f1')){
  for(const session of sessionSchedule[event.id]||[]){
   const at=Date.parse(session.start);
   if(Number.isFinite(at)&&at>now)return {event:event.name,session:sessionLabel(session.nameEn||session.name),start:session.start,
    text:`${event.name} ${sessionLabel(session.nameEn||session.name)} · ${kst(at,{month:'numeric',day:'numeric'})} ${kst(at,{hour:'2-digit',minute:'2-digit'})} (한국시간)`};
  }
 }
 return null;
}
// "3일 전 (11. 2. 07:05)" — how old the saved data is, with its date.
export function dataAgeText(receivedAt,now=Date.now()){
 const at=Date.parse(receivedAt);if(!Number.isFinite(at))return null;
 const s=Math.max(0,(now-at)/1000);
 const ago=s<90?`${Math.round(s)}초 전`:s<5400?`${Math.round(s/60)}분 전`:s<172800?`${Math.round(s/3600)}시간 전`:`${Math.round(s/86400)}일 전`;
 return `${ago} (${kst(at,{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})})`;
}

const valueOf=value=>{
 if(value==null)return null;
 if(typeof value==='object')return value.Value??value.DisplayValue??null;
 return value;
};

const clean=(value,max=80)=>{
 const text=String(valueOf(value)??'').trim();
 return text?text.slice(0,max):null;
};

const finite=value=>Number.isFinite(Number(value))?Number(value):null;

const topicAge=(snapshot,topic,limit)=>{
 const stamp=snapshot?.topic_times?.[topic];
 const candidate=[stamp?.source_time,stamp?.received_at].find(value=>Number.isFinite(Date.parse(value)));
 const received=snapshot?.received_at;
 const age=candidate&&Number.isFinite(Date.parse(received))?(Date.parse(received)-Date.parse(candidate))/1000:NaN;
 return {age:Number.isFinite(age)?age:null,fresh:stamp?.initial_snapshot!==true&&Number.isFinite(age)&&age>=-5&&age<=limit};
};

const trackStatusLabel=status=>({
 '1':'정상','2':'옐로','4':'세이프티카','5':'레드 플래그','6':'VSC','7':'VSC 종료 중'
})[String(status??'')]||clean(status)||'미확인';

const weatherValue=(weather,key,unit='')=>{
 const value=finite(weather?.[key]);
 return value==null?null:`${value}${unit}`;
};

const latestMessage=messages=>{
 const rows=Array.isArray(messages)?messages:Object.values(messages||{});
 const item=rows.filter(row=>row&&typeof row==='object').at(-1);
 if(!item)return null;
 return {category:clean(item.Category||item.Flag||item.Scope,32),message:clean(item.Message,240),time:clean(item.Utc||item.Time,40)};
};

const currentStint=(timingApp,number)=>{
 const stints=Object.entries(timingApp?.Lines?.[number]?.Stints||{}).sort((a,b)=>Number(a[0])-Number(b[0]));
 const stint=stints.at(-1)?.[1];
 if(!stint||typeof stint!=='object')return null;
 return {
  compound:clean(stint.Compound,20),
  laps:finite(stint.TotalLaps),
  new:stint.New===true||String(stint.New).toLowerCase()==='true'
 };
};

export function buildLiveBriefing(snapshot,{now=Date.now(),accessMode=null}={}){
 const topics=snapshot?.topics||{}, info=topics.SessionInfo||{}, f=snapshot?.freshness||{}, collector=snapshot?.synchronization?.collector||{};
 const sessionName=[info.Meeting?.Name,info.Name].filter(Boolean).join(' · ');
 const feedAge=typeof f.feed_age_seconds==='number'?f.feed_age_seconds:NaN;
 const limit=typeof f.stale_after_seconds==='number'?f.stale_after_seconds:45;
 const timing=topicAge(snapshot,'TimingData',limit);
 const sessionStatus=topics.SessionStatus?.Status||info.SessionStatus||f.session_status||null;
 const live=Boolean(timing.fresh&&snapshot?.available&&snapshot?.connected===true&&f.live===true&&info.Key&&['Started','Resumed'].includes(sessionStatus)&&Number.isFinite(feedAge)&&feedAge<=limit);
 const status=live?'LIVE':(timing.age!=null&&timing.age>limit?'데이터 지연':(snapshot?.available===false?'자료 없음':['Finished','Finalised','Ends'].includes(sessionStatus)?'종료':'LIVE 미확인'));
 const lines=topics.TimingData?.Lines||{}, drivers=topics.DriverList||{}, timingApp=topics.TimingAppData||{};
 const observedLeaderboard=Object.entries(lines).map(([number,line])=>{
  const position=finite(line?.Position);
  if(position==null||position<1)return null;
  const driver=drivers[number]||{}, stint=currentStint(timingApp,number);
  return {
   position,number:String(number).slice(0,4),code:clean(driver.Tla||driver.RacingNumber||number,5),
   name:clean(driver.FullName||driver.BroadcastName||driver.LastName,60),team:clean(driver.TeamName,60),
   gap:position===1?'LEADER':clean(line.GapToLeader||line.TimeDiffToFastest,24),
   interval:clean(line.IntervalToPositionAhead,24),last_lap:clean(line.LastLapTime,24),best_lap:clean(line.BestLapTime,24),
   laps:finite(line.NumberOfLaps),in_pit:line.InPit===true,pit_out:line.PitOut===true,retired:line.Retired===true||line.Stopped===true,
   compound:stint?.compound||null,tyre_laps:stint?.laps??null,new_tyre:stint?.new??null
  };
 }).filter(Boolean).sort((a,b)=>a.position-b.position).slice(0,20);
 const leaderboard=live?observedLeaderboard:[];
 // After the session ends, the last received order is shown as a final record, never as live.
 const ended=['Finished','Finalised','Ends'].includes(sessionStatus);
 const finalLeaderboard=!live&&ended&&snapshot?.available?observedLeaderboard:[];
 const age=snapshot?.available?dataAgeText(snapshot?.received_at,now):null;
 const next=nextF1Session(now);
 const leaders=leaderboard.slice(0,3).map(row=>`${row.position}위 ${row.code}`);
 const count=topics.LapCount||{}, lap=finite(count.CurrentLap), total=finite(count.TotalLaps);
 const validLap=Number.isInteger(lap)&&lap>0&&Number.isInteger(total)&&total>=lap;
 const lapText=validLap?`랩 ${lap}/${total}`:null;
 const details=[
  {label:'세션',value:sessionName||'세션 정보 미확인'},
  {label:'랩 진행',value:lapText||'미확인'},
  {label:'트랙 상태',value:trackStatusLabel(topics.TrackStatus?.Status)},
  {label:'수집 상태',value:clean(collector.state)||'미확인'},
  live?{label:'원본 지연',value:timing.age!=null?`${Math.round(timing.age)}초`:'미확인'}:{label:'자료 시각',value:age||'저장된 자료 없음'},
  live?{label:'순위 수신',value:`${leaderboard.length}대`}:{label:'다음 세션',value:next?.text||'일정 확인 필요'}
 ];
 const weather={
  air_temperature:weatherValue(topics.WeatherData,'AirTemp','°C'),track_temperature:weatherValue(topics.WeatherData,'TrackTemp','°C'),
  humidity:weatherValue(topics.WeatherData,'Humidity','%'),rainfall:clean(topics.WeatherData?.Rainfall,12),
  wind_speed:weatherValue(topics.WeatherData,'WindSpeed',' m/s'),wind_direction:weatherValue(topics.WeatherData,'WindDirection','°')
 };
 const raceControl=latestMessage(topics.RaceControlMessages?.Messages);
 const tyre=topicAge(snapshot,'TimingAppData',limit);
 const strategy=[];
 if(live&&tyre.fresh){
  for(const row of leaderboard.slice(0,6))if(row.compound)strategy.push({driver:row.code,compound:row.compound,tyre_laps:row.tyre_laps,signal:row.in_pit?'피트 진입':row.pit_out?'피트 아웃':'주행 중'});
 }
 const analysis=[];
 if(!live)analysis.push('최신 원본 타이밍이 검증되지 않아 현재 순위와 전략 예측을 보류합니다.');
 else if(!strategy.length)analysis.push('최신 타이어 스틴트가 확인되지 않아 교체 전략 판단을 보류합니다.');
 else analysis.push('상위권 타이어와 간격 변화를 함께 비교하세요. 피트 손실과 잔여 세트가 없어 최적 교체 랩은 확정하지 않습니다.');
 if(raceControl?.message)analysis.push(`레이스 컨트롤: ${raceControl.message}`);
 const briefing=live?
  [sessionName||'F1 세션',lapText,leaders.length?`실시간 순위 ${leaders.join(' · ')}`:null,'원본 타이밍 수신 확인'].filter(Boolean).join(' / '):
  snapshot?.available===false&&accessMode==='personal'?'공용 라이브 데이터는 등록된 선원만 볼 수 있습니다. 사이트의 /live에서 본인 F1 계정을 연결하거나 운영자에게 선원 등록을 요청하세요.':
  snapshot?.available===false?`아직 수집된 세션이 없습니다.${next?` 다음 세션은 ${next.text}입니다.`:''}`:
  ended?`${sessionName?sessionName+' 세션이':'이 세션은'} 끝났습니다. 지금은 라이브 중계가 아닙니다.${next?` 다음 세션: ${next.text}.`:''}`:
  (timing.age!=null&&timing.age>limit?`원본 타이밍이 ${Math.round(timing.age)}초 지연됐습니다. 현재 경기로 표시하지 않습니다.`:'최신 레이스 수신이 검증되지 않았습니다. 연결 상태만으로 LIVE를 표시하지 않습니다.');
 const topic_times={};
 for(const key of ['TimingData','TimingAppData','RaceControlMessages','TrackStatus','WeatherData'])if(snapshot?.topic_times?.[key])topic_times[key]=snapshot.topic_times[key].received_at;
 return {
  schema_version:4,available:!!snapshot?.available,status,briefing,analysis,details,leaderboard,final_leaderboard:finalLeaderboard,next_session:next,data_age:age,reason:snapshot?.reason||null,strategy,weather,race_control:raceControl,
  track_status:{code:clean(topics.TrackStatus?.Status,12),label:trackStatusLabel(topics.TrackStatus?.Status)},
  session:{key:info.Key??null,name:sessionName||null,session_status:sessionStatus},
  freshness:{live,source_age_seconds:timing.age,feed_age_seconds:Number.isFinite(feedAge)?feedAge:null,stale_after_seconds:limit},
  received_at:snapshot?.received_at||null,connected:snapshot?.connected===true,
  collector:{state:clean(collector.state),collector_running:collector.collector_running===true},topic_times,source:snapshot?.source||'FastF1 collector',
  limitations:['화면은 도구 호출 시점의 스냅샷이며 자동 중계 화면이 아닙니다.','원시 타이밍 패치는 확정된 랩 이력과 다릅니다.','연료량·타이어 온도·잔여 세트·확정 피트 손실은 포함되지 않습니다.']
 };
}

export function liveBriefingText(payload){
 const final=!payload.leaderboard.length&&payload.final_leaderboard?.length;
 const rows=(final?payload.final_leaderboard:payload.leaderboard).slice(0,10).map(row=>`${row.position}. ${row.code}${row.gap?` ${row.gap}`:''}${row.compound?` · ${row.compound}${row.tyre_laps!=null?` ${row.tyre_laps}랩`:''}`:''}`);
 return [payload.briefing,...payload.analysis,rows.length?(final?'최종 기록 (실시간 아님)\n':'순위\n')+rows.join('\n'):null,payload.details.map(item=>`${item.label}: ${item.value}`).join(' / ')].filter(Boolean).join('\n');
}
