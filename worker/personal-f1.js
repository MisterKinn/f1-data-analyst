import {accountIdentity,sharedLiveAllowed} from './accounts.js';

// Scope is derived from verified identity only, never a request field.
// Every signed-in Kongboda account reads the same shared F1 data (recorded by the
// GitHub Actions collector). Crew additionally keep collector controls.
export async function f1Access(request,env,google=null){
 if(await sharedLiveAllowed(request,env,google))return {mode:'crew',env};
 const account=(await accountIdentity(request,env,google,{create:true}))?.account;
 if(!account||account.deleted)return null;
 return {mode:'member',accountId:account.id,env};
}
// Legacy per-account isolation, kept only for cleanup of previously stored data.
export async function personalF1Access(request,env,google=null){
 const account=(await accountIdentity(request,env,google,{create:true}))?.account;
 if(!account||account.deleted)return null;
 const prefix=`personal-f1/${account.id}/`;
 const bucket=env.BUCKET;
 const scoped={get:key=>bucket.get(prefix+key),put:(key,value,options)=>bucket.put(prefix+key,value,options),delete:key=>bucket.delete(prefix+key)};
 return {mode:'personal',accountId:account.id,env:{...env,BUCKET:scoped,F1_PERSONAL_ACCOUNT:account.id}};
}
export async function clearPersonalF1(env,id){
 if(!env.BUCKET?.list)return;
 const prefix=`personal-f1/${id}/`;
 let cursor;
 do {const page=await env.BUCKET.list({prefix,...(cursor?{cursor}:{})});for(const item of page.objects)await env.BUCKET.delete(item.key);cursor=page.truncated?page.cursor:null;}while(cursor);
}
