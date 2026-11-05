export const TELEMETRY_TOOL={name:'fastf1_lap_telemetry',description:'Load actual best-lap speed, throttle, binary brake, gear and RPM for one or two drivers. During a session use accumulated received telemetry. For post-session analysis set historical=true to reload official session data with FastF1. Local live telemetry is deleted 5 minutes after session end. After a session the collector publishes FastF1 telemetry automatically; if it is not published yet, say so and use web search for anything FastF1 does not provide. Never invent curves. A verified session key is required. Display independent charts on common observed distance, short sector table, and concise text. Delta is approximate speed-integrated distance alignment, not official timing.',inputSchema:{type:'object',properties:{session_key:{type:'integer',minimum:1,maximum:999999999999},session_part:{type:'string',enum:['session','Q1','Q2','Q3']},driver_number:{type:'string'},compare_driver_number:{type:'string'},historical:{type:'boolean'}},required:['session_key','session_part','driver_number'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:true}};

export function distanceDelta(laps){
 if(laps.length!==2||laps.some(l=>!l.complete_coverage||!Array.isArray(l.samples)||l.samples.length<3))return null;
 const [a,b]=laps.map(l=>l.samples),max=Math.min(a.at(-1)[1],b.at(-1)[1]);
 const timeAt=(rows,d)=>{let i=rows.findIndex(r=>r[1]>=d);if(i<1)return null;const x=rows[i-1],y=rows[i];if(y[1]<=x[1]||y[0]-x[0]>1.5)return null;return x[0]+(y[0]-x[0])*(d-x[1])/(y[1]-x[1]);};
 const points=[];for(let d=25;d<=max;d+=25){const t=timeAt(a,d),u=timeAt(b,d);points.push([d,t===null||u===null?null:Number((u-t).toFixed(3))]);}
 return {reference_driver:laps[0].driver_number,comparison_driver:laps[1].driver_number,columns:['distance_m','comparison_minus_reference_s'],positive_means:'comparison driver slower',method:'Linear time interpolation within common observed speed-integrated distance only. Approximate; boundary residuals and different paths can shift the curve.',points};
}

const NOT_YET='FastF1 has not published this session yet. The collector loads it automatically after the session and retries every scheduled run (usually 1–2 hours). For anything FastF1 does not provide, use web search and cite it.';
// F1 telemetry comes only from the FastF1 archive the collector publishes after a session.
export async function telemetryRead(env,args){
 for(const value of [args.driver_number,args.compare_driver_number].filter(x=>x!==undefined))if(!/^\d{1,3}$/.test(value))throw Error('Use a driver racing number');
 if(args.compare_driver_number===args.driver_number)throw Error('Choose two different drivers');
 if(!['session','Q1','Q2','Q3'].includes(args.session_part))throw Error('Choose session, Q1, Q2 or Q3');
 if(!env.BUCKET)throw Error('Live storage unavailable');
 const object=await env.BUCKET.get(`live/sessions/${args.session_key}.json`);
 const archive=await env.BUCKET.get(`live/history/${args.session_key}/archive.json`);
 if(!object&&!archive)return {state:'unavailable',reason:'No saved data for this session. '+NOT_YET};
 const s=object?(await object.json()).snapshot:null,info=s?.topics?.SessionInfo;
 if(info&&info.Key!==args.session_key)throw Error('Session identity mismatch');
 const ended=!s||['Finished','Finalised','Ends'].includes(s.topics?.SessionStatus?.Status)||s.connected===false;
 if(!archive)return {state:ended?'not_published_yet':'unavailable',reason:ended?NOT_YET:'Lap telemetry is not collected live; FastF1 telemetry is published automatically after the session. Use the live timing tools meanwhile.'};
 const laps=[];
 for(const driver of [args.driver_number,args.compare_driver_number].filter(Boolean)){
  const doc=await env.BUCKET.get(`live/history/${args.session_key}/telemetry/${args.session_part}-${driver}.json`);
  if(!doc)return {state:'unavailable',reason:`FastF1 has no verified complete best lap with telemetry for car ${driver} in ${args.session_part}. Use web search for anything FastF1 does not provide.`};
  laps.push((await doc.json()).lap);
 }
 const ready=laps.every(l=>l.complete_coverage);
 return {state:ready?'ready':'partial',session_key:args.session_key,laps,source:'FastF1 Session.load / official F1 archived timing and telemetry',source_switched_after_expiry:false,...(ready?{delta:distanceDelta(laps)}:{}),
  limitations:['Historical FastF1 reload, not a live feed.','Do not draw across gaps. Speed-integrated distance and boundary residuals are approximate.'],
  response_format:'One conclusion sentence, independent speed/throttle/brake/delta charts or sector table, and 1–2 short observations. Preserve gaps and source/time captions.'};
}
