// Shared read-through cache: last verified values expire after 24 hours on failure.
import {storageDomain} from './storage-domains.js';
export const PUBLISHED_TTL=300000,MAX_STALE=86400000;
const instances=new WeakMap(),MAX_ENTRIES=64,MAX_BYTES=4*1024*1024;
const valid=(value,time)=>value&&Number.isFinite(value.checkedAt)&&time>=value.checkedAt&&value.data&&typeof value.data==='object';
const response=(value,time,stale=false)=>({...value.data,cached:true,stale,cache_age_seconds:Math.floor((time-value.checkedAt)/1000)});
function remember(state,key,value){
 const body=JSON.stringify(value),bytes=new TextEncoder().encode(body).length;
 const previous=state.values.get(key);if(previous){state.bytes-=previous.bytes;state.values.delete(key);}
 if(bytes>840000)return;
 while(state.values.size>=MAX_ENTRIES||state.bytes+bytes>MAX_BYTES){const first=state.values.keys().next().value;state.bytes-=state.values.get(first).bytes;state.values.delete(first);}
 state.values.set(key,{body,bytes});state.bytes+=bytes;
}
export async function cachedPublished(env,key,load,{ttl=PUBLISHED_TTL,maxStale=MAX_STALE,now=Date.now}={}){
 const binding=env.BUCKET||env,storage='published-cache/v1/'+key;
 const bucket=storageDomain(env.BUCKET,'published');
 let state=instances.get(binding);if(!state){state={values:new Map(),pending:new Map(),bytes:0};instances.set(binding,state);}
 const hit=state.values.get(storage),memory=hit?JSON.parse(hit.body):null,time=now();
 if(valid(memory,time)&&time-memory.checkedAt<ttl){
  state.values.delete(storage);state.values.set(storage,hit);
  return response(memory,time);
 }
 // Share the storage read too, without sharing different freshness policies.
 const taskKey=JSON.stringify([storage,ttl,maxStale]);
 if(state.pending.has(taskKey))return structuredClone(await state.pending.get(taskKey));
 const task=(async()=>{
  let old=memory;
  if(bucket)try{const object=await bucket.get(storage);old=object?await object.json():null;}catch{/* Retain verified memory during storage outages. */}
  const checked=now();
  if(valid(old,checked)&&checked-old.checkedAt<maxStale)remember(state,storage,old);
  if(valid(old,checked)&&checked-old.checkedAt<ttl)return response(old,checked);
  try{
   const data=await load(),value={checkedAt:now(),data},body=JSON.stringify(value);
   if(bucket&&new TextEncoder().encode(body).length<=840000)try{await bucket.put(storage,body);}catch{}
   if(valid(value,now()))remember(state,storage,value);
   return {...data,cached:false,stale:false,cache_age_seconds:0};
  }catch(error){
   const failedAt=now();
   if(valid(old,failedAt)&&failedAt-old.checkedAt<maxStale)return response(old,failedAt,true);
   throw error;
  }
 })();
 const tracked=state.pending.size<128;if(tracked)state.pending.set(taskKey,task);
 try{return structuredClone(await task);}finally{if(tracked&&state.pending.get(taskKey)===task)state.pending.delete(taskKey);}
}
