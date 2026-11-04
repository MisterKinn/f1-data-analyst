export const BEST_LAPS_TOOL = {
 name:'fastf1_best_laps',
 description:'Read each driver\'s published best lap with its own preserved S1/S2/S3, validation, timestamps and matched tyre stint. Choose Q1/Q2/Q3 or session. Use ONLY status=complete sectors; unavailable/deleted records must not be inferred from rolling TimingData.Sectors. A saved completed session is historical, not live. No corner telemetry or ideal-sector composites. Optional session_key reads a previously saved session; resolve it from SessionInfo first.',
 inputSchema:{type:'object',properties:{session_part:{type:'string',enum:['Q1','Q2','Q3','session'],description:'Qualifying segment, or session for practice.'},session_key:{type:'integer',minimum:1,maximum:999999999999},driver_number:{type:'string',description:'Optional racing number from DriverList; omit for all drivers.'}},required:['session_part'],additionalProperties:false},
 annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}
};

function ms(value){
 if(typeof value!=='string'||! /^(?:\d+:)?\d{1,3}\.\d{3}$/.test(value))return null;
 const parts=value.split(':'),seconds=parts.at(-1).split('.');
 return (parts.length===2?Number(parts[0])*60000:0)+Number(seconds[0])*1000+Number(seconds[1]);
}

export function validateArchive(archive,sessionKey){
 if(archive==null)return null;
 if(archive.version!==1||archive.session_key!==sessionKey||!archive.best_laps||typeof archive.best_laps!=='object'||Array.isArray(archive.best_laps))throw Error('Invalid lap archive identity');
 if(!Array.isArray(archive.records)||archive.records.length>600)throw Error('Invalid lap archive records');
 for(const [part,rows] of Object.entries(archive.best_laps)){
  if(!['Q1','Q2','Q3','session'].includes(part)||!rows||typeof rows!=='object'||Array.isArray(rows)||Object.keys(rows).length>30)throw Error('Invalid lap archive segment');
  for(const [driver,r] of Object.entries(rows)){
   if(!/^\d{1,3}$/.test(driver)||r.driver_number!==driver||!['complete','unavailable','deleted','deletion_unresolved'].includes(r.status))throw Error('Invalid lap archive row');
   if(r.status==='complete'&&!complete(r))throw Error('Unverified sector sum');
  }
 }
 return archive;
}

function complete(r){
 const values=['S1','S2','S3'].map(k=>ms(r.sectors?.[k]));
 const total=ms(r.lap_time);
 return r.validation==='complete'&&total>0&&values.every(x=>x>0)&&Math.abs(values.reduce((a,b)=>a+b,0)-total)<=3
   &&Array.isArray(r.sector_source_times)&&r.sector_source_times.length===3
   &&r.sector_source_times.every(t=>Number.isFinite(Date.parse(t)))
   &&Date.parse(r.sector_source_times[0])<Date.parse(r.sector_source_times[1])&&Date.parse(r.sector_source_times[1])<Date.parse(r.sector_source_times[2]);
}

function deletionState(snapshot,driver,value){
 let deleted=false,unresolved=false;
 for(const m of Object.values(snapshot.topics.RaceControlMessages?.Messages??{})){
  const text=m?.Message??'',car=text.match(/CAR (\d+)\b/);
  if(car?.[1]!==driver||! /DELETED|REINSTATED/.test(text))continue;
  const time=text.match(/\bTIME\s+((?:\d+:)?\d+\.\d{3})/);
  if(time?.[1]===value)deleted=text.includes('DELETED');
  else if(!time&&text.includes('DELETED')&&!text.includes('(PIT)'))unresolved=true;
 }
 return deleted?'deleted':unresolved?'deletion_unresolved':null;
}

// Preserve proven records across reconnects/redeploys only when the current
// feed still identifies the exact same best lap. Never retain a superseded lap.
export function preserveBestLaps(snapshot,previous){
 const archive=snapshot.lap_archive;
 const prior=previous?.topics?.SessionInfo?.Key===snapshot.topics.SessionInfo?.Key?previous.lap_archive:null;
 if(!archive&&!prior)return snapshot;
 const merged={version:1,session_key:snapshot.topics.SessionInfo?.Key,best_laps:{},records:archive?.records??[],
  completed_laps_count:archive?.completed_laps_count??0,recovery:archive?.recovery??null,best_lap_coverage:archive?.best_lap_coverage??null,rejected_sequences:archive?.rejected_sequences??0,coverage:archive?.coverage??'Preserved records only; no historical reconstruction.'};
 for(const [driver,line] of Object.entries(snapshot.topics.TimingData?.Lines??{})){
  const refs=line.BestLapTimes&&Object.keys(line.BestLapTimes).length?line.BestLapTimes:{session:line.BestLapTime};
  for(const [index,ref] of Object.entries(refs)){
   if(!ref?.Value)continue;
   const part=index==='session'?'session':`Q${Number(index)+1}`;
   const current=archive?.best_laps?.[part]?.[driver],old=prior?.best_laps?.[part]?.[driver];
   const matches=r=>r?.lap_time===ref.Value&&r?.timing_lap_reference===ref.Lap;
   let r=matches(current)?structuredClone(current):null;
   if(r?.status!=='complete'&&matches(old)&&old.status==='complete'&&complete(old))r={...structuredClone(old),preserved_from_previous_upload:true};
   if(!r)r={driver_number:driver,driver:snapshot.topics.DriverList?.[driver]?.Tla,team:snapshot.topics.DriverList?.[driver]?.TeamName,lap_time:ref.Value,timing_lap_reference:ref.Lap,status:'unavailable',sectors:null,reason:'Best lap was not fully observed by the sector archiver.'};
   const invalid=deletionState(snapshot,driver,ref.Value);
   if(invalid){r.status=invalid;r.sectors=null;r.reason='Race-control deletion requires reconciliation.';}
   (merged.best_laps[part]??={})[driver]=r;
  }
 }
 return {...snapshot,lap_archive:merged};
}

export async function bestLapsRead(env,args,freshness){
 if(!env.BUCKET)throw Error('Live storage is not configured');
 if(args.driver_number!==undefined&&!/^\d{1,3}$/.test(args.driver_number))throw Error('Use a driver racing number from DriverList');
 const key=args.session_key===undefined?'live/current.json':`live/sessions/${args.session_key}.json`;
 const object=await env.BUCKET.get(key);
 if(!object)return {available:false,reason:'No saved snapshot for this session.'};
 const stored=await object.json(),snapshot=stored.snapshot;
 if(args.session_key!==undefined&&snapshot.topics?.SessionInfo?.Key!==args.session_key)throw Error('Saved session identity mismatch');
 const archive=snapshot.lap_archive;
 const lines=snapshot.topics.TimingData?.Lines??{};
 const index={Q1:'0',Q2:'1',Q3:'2'}[args.session_part];
 const rows=[];
 for(const [driver,line] of Object.entries(lines)){
  if(args.driver_number!==undefined&&driver!==args.driver_number)continue;
  const ref=index===undefined?line.BestLapTime:line.BestLapTimes?.[index];
  if(!ref?.Value)continue;
  const saved=archive?.best_laps?.[args.session_part]?.[driver];
  const usable=saved?.status==='complete'&&saved.lap_time===ref.Value&&saved.timing_lap_reference===ref.Lap&&complete(saved)&&!deletionState(snapshot,driver,ref.Value);
  rows.push(usable?saved:{driver_number:driver,driver:snapshot.topics.DriverList?.[driver]?.Tla,team:snapshot.topics.DriverList?.[driver]?.TeamName,lap_time:ref.Value,timing_lap_reference:ref.Lap,status:deletionState(snapshot,driver,ref.Value)??'unavailable',sectors:null,reason:saved?.reason??'No verified sectors for this published best lap. Older collector or incomplete lap coverage.'});
 }
 return {available:true,source:stored.source??'FastF1 collector',received_at:stored.received_at,session:snapshot.topics.SessionInfo,session_part:args.session_part,
  freshness:freshness(snapshot,stored.received_at),archive_supported:!!archive,finalisation:sessionFinalisation(snapshot,stored.received_at),best_laps:rows,
  limitations:['Only each driver\'s actual published best lap; no ideal-sector sums.','Compare tyres and run conditions. No corner telemetry.','Completed saved laps remain usable as historical records even when the feed is no longer live.']};
}

// A collector that stops early (PC asleep, crash) never records the terminal session
// status, so saved sessions kept showing "Started"/"Generating" and recovery
// "pending" forever. Label such records as ended instead of in progress.
const TERMINAL=new Set(['Finished','Finalised','Ends','Aborted']);
export const STALE_SESSION_MS=6*60*60*1000;
export function sessionFinalisation(snapshot,receivedAt,now=Date.now()){
 const status=snapshot?.topics?.SessionStatus?.Status??snapshot?.topics?.SessionInfo?.SessionStatus??null;
 const archive=snapshot?.topics?.SessionInfo?.ArchiveStatus?.Status??null;
 const recovery=snapshot?.lap_archive?.recovery?.state??null;
 const age=now-Date.parse(receivedAt||0);
 if(TERMINAL.has(status)&&archive!=='Generating')return {state:'final',session_status:status,archive_status:archive,recovery:recovery??'not_run'};
 if(!(age>STALE_SESSION_MS))return {state:'in_progress',session_status:status,archive_status:archive,recovery:recovery??'pending'};
 return {state:'ended_without_final_status',session_status:status,archive_status:archive,recovery:recovery&&recovery!=='running'?recovery:'not_run',
  note:'The collector stopped before this session finished. Status fields are the last values it saw, not the current state. Saved laps remain usable; results after the last upload are missing. Use official classification documents for the final result.'};
}
