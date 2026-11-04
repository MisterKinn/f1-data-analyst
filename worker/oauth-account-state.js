// Account deletion invalidates OAuth grants, independently of crew/collector policy.
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
const read=async(env,key)=>{const object=await env.BUCKET.get(key);return object?object.json():null;};
export async function oauthAccountState(env,sub){
 const id=await digest('google:'+sub);
 const [identity,revocation]=await Promise.all([read(env,'website-accounts/identity/'+id+'.json'),read(env,'website-auth/oauth/account-generation/'+id+'.json')]);
 return {active:identity?.deleted!==true,generation:revocation?.generation||'0'};
}
export async function invalidateAccountOAuth(env,sub){
 const id=await digest('google:'+sub);
 await env.BUCKET.put('website-auth/oauth/account-generation/'+id+'.json',JSON.stringify({generation:crypto.randomUUID(),revokedAt:Date.now()}));
}
export async function oauthGrantActive(env,record){
 if(!record?.profile?.sub)return false;
 const state=await oauthAccountState(env,record.profile.sub);
 return state.active&&(record.accountGeneration||'0')===state.generation;
}
