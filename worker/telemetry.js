export const TELEMETRY_TOOL={name:'fastf1_lap_telemetry',description:'Load actual best-lap speed, throttle, binary brake, gear and RPM for one or two drivers. During a session use accumulated received telemetry. For post-session analysis set historical=true to reload official session data with FastF1. Local live telemetry is deleted 5 minutes after session end. Historical loading is asynchronous: pending/busy requires retry; never claim ready or invent curves. A verified session key is required. Display independent charts on common observed distance, short sector table, and concise text. Delta is approximate speed-integrated distance alignment, not official timing.',inputSchema:{type:'object',properties:{session_key:{type:'integer',minimum:1,maximum:999999999999},session_part:{type:'string',enum:['session','Q1','Q2','Q3']},driver_number:{type:'string'},compare_driver_number:{type:'string'},historical:{type:'boolean'}},required:['session_key','session_part','driver_number'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}};

export function distanceDelta(laps){
 if(laps.length!==2||laps.some(l=>!l.complete_coverage||!Array.isArray(l.samples)||l.samples.length<3))return null;
 const [a,b]=laps.map(l=>l.samples),max=Math.min(a.at(-1)[1],b.at(-1)[1]);
 const timeAt=(rows,d)=>{let i=rows.findIndex(r=>r[1]>=d);if(i<1)return null;const x=rows[i-1],y=rows[i];if(y[1]<=x[1]||y[0]-x[0]>1.5)return null;return x[0]+(y[0]-x[0])*(d-x[1])/(y[1]-x[1]);};
 const points=[];for(let d=25;d<=max;d+=25){const t=timeAt(a,d),u=timeAt(b,d);points.push([d,t===null||u===null?null:Number((u-t).toFixed(3))]);}
 return {reference_driver:laps[0].driver_number,comparison_driver:laps[1].driver_number,columns:['distance_m','comparison_minus_reference_s'],positive_means:'comparison driver slower',method:'Linear time interpolation within common observed speed-integrated distance only. Approximate; boundary residuals and different paths can shift the curve.',points};
}

export async function telemetryRead(env,args,cloudRequest){
 for(const value of [args.driver_number,args.compare_driver_number].filter(x=>x!==undefined))if(!/^\d{1,3}$/.test(value))throw Error('Use a driver racing number');
 if(args.compare_driver_number===args.driver_number)throw Error('Choose two different drivers');
 if(!env.BUCKET)throw Error('Live storage unavailable');
 const object=await env.BUCKET.get(`live/sessions/${args.session_key}.json`);
 if(!object)return {state:'unavailable',reason:'Resolve the session and synchronize its snapshot first.'};
 const stored=await object.json(),s=stored.snapshot,info=s.topics.SessionInfo;
 if(info.Key!==args.session_key)throw Error('Session identity mismatch');
 const capture=s.telemetry_capture;
 const expired=capture?.purged===true||(Number.isFinite(capture?.ended_at)&&Date.now()/1000>=capture.ended_at+300);
 const historical=args.historical===true||expired||(!capture&&['Finished','Finalised','Ends'].includes(s.topics.SessionStatus?.Status));
 const rows=[];
 for(const driver of [args.driver_number,args.compare_driver_number].filter(Boolean)){
  const row=s.lap_archive?.best_laps?.[args.session_part]?.[driver];
  const line=s.topics.TimingData?.Lines?.[driver];
  const ref=args.session_part==='session'?line?.BestLapTime:line?.BestLapTimes?.[String(Number(args.session_part.slice(1))-1)];
  if(!ref?.Value)return {state:'unavailable',reason:'No published best lap for this driver/segment.'};
  if(row?.status==='deleted'||row?.status==='deletion_unresolved')return {state:'unavailable',reason:'Resolve the lap deletion before comparing telemetry.'};
  if(!historical&&row?.status!=='complete')return {state:'unavailable',reason:'The live best lap does not yet have verified complete sector boundaries.',recovery:s.lap_archive?.recovery};
  rows.push(row?.status==='complete'?row:{id:`${info.Key}:${driver}:${args.session_part}:${ref.Lap??ref.Value}`,driver_number:driver,lap_time:ref.Value,timing_lap_reference:ref.Lap,sectors:null});
 }
 const result=await cloudRequest(env,'/telemetry/laps','POST',{session_info:info,laps:rows,historical});
 return {...result,source_switched_after_expiry:expired||result.source_switched_after_expiry===true,...(result.state==='ready'?{delta:distanceDelta(result.laps)}:{}),response_format:'One conclusion sentence, independent speed/throttle/brake/delta charts or sector table, and 1–2 short observations. Preserve gaps and source/time captions.'};
}
