const ROOT='live/diagnostics/';
const ID=/^[0-9]{1,12}$/,RUN=/^[a-f0-9-]{36}$/i;
export const METRICS=['process_cpu_percent_one_core','cgroup_cpu_percent_of_quota','cpu_quota_cores','cgroup_throttled_seconds','rss_bytes','callback_count','callback_mean_ms','callback_max_ms','timing_source_lag_seconds','clock_source_lag_seconds','out_of_order_packets','telemetry_write_errors','diagnostics_write_errors'];
export function validateDiagnostics(value,sessionKey){
 if(value==null)return null;
 if(value.version!==1||value.session_key!==sessionKey||!ID.test(String(sessionKey))||!RUN.test(value.run_id)||value.interval_seconds!==10||!Array.isArray(value.samples)||value.samples.length>720)throw Error('Invalid collector diagnostics');
 let last=-1;
 const samples=value.samples.map(sample=>{
  if(!Number.isSafeInteger(sample.sequence)||sample.sequence<=last||!Number.isFinite(Date.parse(sample.at)))throw Error('Invalid diagnostic sample');
  last=sample.sequence;
  const row={sequence:sample.sequence,at:sample.at};
  for(const key of METRICS){const n=sample[key];if(n!==null&&(!Number.isFinite(n)||Math.abs(n)>1e15))throw Error('Invalid diagnostic measurement');row[key]=n;}
  return row;
 });
 return {version:1,session_key:sessionKey,run_id:value.run_id,interval_seconds:10,samples,
  scope:'Python collector process and its cgroup; unavailable measurements are null',
  history_limit_samples:720};
}
export async function saveDiagnostics(env,value){
 const key=`${ROOT}${value.session_key}/${value.run_id}.json`;
 for(let attempt=0;attempt<4;attempt++){
  const object=await env.BUCKET.get(key),previous=object?await object.json():null;
  if((previous?.samples?.at(-1)?.sequence??-1)>=(value.samples.at(-1)?.sequence??-1))return;
  const body=JSON.stringify(value);
  if(new TextEncoder().encode(body).length>840000)throw Error('Diagnostics exceed storage limit');
  const result=await env.BUCKET.put(key,body,{onlyIf:object?.etag?{etagMatches:object.etag}:object?undefined:{etagDoesNotMatch:'*'}});
  if(result!==null)return;
 }
 throw Error('Concurrent diagnostics update; retry synchronization');
}
export async function readDiagnostics(env,params){
 if(params.get('scope')==='vercel'){
  const date=params.get('date');
  if(!/^20\d\d-\d\d-\d\d$/.test(date??''))return {available:false,reason:'Provide the UTC date as YYYY-MM-DD.'};
  const page=await env.BUCKET.list({prefix:`${ROOT}vercel/${date}/`,limit:100,cursor:params.get('cursor')||undefined});
  const samples=await Promise.all(page.objects.map(async item=>{const object=await env.BUCKET.get(item.key);return object?await object.json():null;}));
  return {available:samples.some(Boolean),scope:'Vercel process during requests; not host saturation or collector CPU',samples:samples.filter(Boolean).sort((a,b)=>a.at.localeCompare(b.at)),next_cursor:page.truncated?page.cursor:null};
 }
 const session=params.get('session_key'),run=params.get('run_id');
 if(!ID.test(session??''))return {available:false,reason:'Provide a verified numeric session_key.'};
 let selected=run;
 if(selected!==null&&!RUN.test(selected))return {available:false,reason:'Invalid run_id.'};
 if(!selected){const object=await env.BUCKET.get(`live/sessions/${session}.json`);selected=object?(await object.json()).snapshot?.diagnostics?.run_id:null;}
 if(!RUN.test(selected??''))return {available:false,reason:'No collector CPU history has been synchronized for this session.'};
 const object=await env.BUCKET.get(`${ROOT}${session}/${selected}.json`);
 return object?{available:true,...await object.json(),durability:'Stored in the website bucket at the last successful snapshot synchronization. Local collector JSONL also records between synchronizations.'}:{available:false,reason:'No saved measurements for this collector run.'};
}
