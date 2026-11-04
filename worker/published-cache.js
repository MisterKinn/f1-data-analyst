// Shared read-through cache: last verified values expire after 24 hours on failure.
export const PUBLISHED_TTL=300000,MAX_STALE=86400000;
const pending=new Map();
export async function cachedPublished(env,key,load,{ttl=PUBLISHED_TTL,maxStale=MAX_STALE,now=Date.now}={}){
 const storage='published-cache/v1/'+key;
 let old;try{const object=await env.BUCKET?.get(storage);old=object?await object.json():null;}catch{}
 const age=old?now()-old.checkedAt:Infinity;
 const valid=old&&Number.isFinite(old.checkedAt)&&age>=0&&old.data&&typeof old.data==='object';
 if(valid&&age<ttl)return {...old.data,cached:true,stale:false,cache_age_seconds:Math.floor(age/1000)};
 // Coalesce only for the same storage binding; never combine tenant/account caches.
 let tasks=pending.get(env.BUCKET||env);if(!tasks){tasks=new Map();pending.set(env.BUCKET||env,tasks);}
 try{
  let task=tasks.get(storage);
  if(!task){task=(async()=>{const data=await load();if(env.BUCKET)try{const body=JSON.stringify({checkedAt:now(),data});if(new TextEncoder().encode(body).length<=840000)await env.BUCKET.put(storage,body);}catch{}return data;})();tasks.set(storage,task);task.finally(()=>{if(tasks.get(storage)===task)tasks.delete(storage);if(!tasks.size)pending.delete(env.BUCKET||env);}).catch(()=>{});}
  return {...await task,cached:false,stale:false,cache_age_seconds:0};
 }catch(error){
  if(valid&&age<maxStale)return {...old.data,cached:true,stale:true,cache_age_seconds:Math.floor(age/1000)};
  throw error;
 }
}
