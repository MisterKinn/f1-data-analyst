// GitHub CI -> authenticated MCP Events -> one shared Sites deployment.
// Repository edits remain the source of truth; event bodies contain identifiers only.
export const REPOSITORY = 'kangjeongmin1229/f1-data-analyst';
export const REPOSITORY_ID = '1432897498';
export const EVENT_NAME = 'plugin.release_ready';
export const AUDIENCE = 'f1-data-analyst-deploy';
export const EVENT = {
 name: EVENT_NAME,
 description: 'F1 플러그인의 main 변경이 GitHub CI 검사에 통과했습니다. 소유자의 클라우드 배포 작업이 같은 공유 Site에 반영할 때 사용합니다.',
 delivery: ['webhook'],
 inputSchema: {type:'object',properties:{repository:{type:'string',enum:[REPOSITORY]}},required:['repository'],additionalProperties:false},
 payloadSchema: {type:'object',properties:{repository:{type:'string'},commit_sha:{type:'string'},run_id:{type:'string'},run_attempt:{type:'string'},actor:{type:'string'},url:{type:'string'}},required:['repository','commit_sha','run_id','run_attempt','actor','url'],additionalProperties:false}
};
export const CREW_EVENT_NAME='plugin.crew_registered';
export const CREW_EVENT={name:CREW_EVENT_NAME,description:'새 꽁보다 계정이 비밀 키를 등록해 선원이 되었습니다. 소유자에게만 전달되며 최신 전체 명단은 kongboda_list_crew로 확인합니다.',delivery:['webhook'],inputSchema:{type:'object',properties:{},additionalProperties:false},payloadSchema:{type:'object',properties:{account_id:{type:'string'},registered_at:{type:'string'}},required:['account_id','registered_at'],additionalProperties:false}};
const encoder = new TextEncoder();
const json = (value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
const decode = value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')), c=>c.charCodeAt(0));
const base64 = value=>btoa(String.fromCharCode(...new Uint8Array(value)));
const sha256 = async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),x=>x.toString(16).padStart(2,'0')).join('');
export function equal(a,b){a=String(a);b=String(b);let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
function owner(request,env){return !!env.DEPLOY_OWNER_EMAIL && request.headers.get('oai-authenticated-user-id') && request.headers.get('oai-authenticated-user-email')?.toLowerCase()===env.DEPLOY_OWNER_EMAIL.toLowerCase();}
export function callbackURL(value){
 const url=new URL(value);
 // Restrict callbacks to OpenAI-controlled public origins; no arbitrary DNS targets.
 if(url.protocol!=='https:'||url.username||url.password||url.hash||(url.port&&url.port!=='443')||!['chatgpt.com','openai.com'].some(d=>url.hostname===d||url.hostname.endsWith('.'+d)))throw Error('Unsupported callback origin');
 return url.href;
}
function secretBytes(secret){if(typeof secret!=='string'||!secret.startsWith('whsec_'))throw Error('Invalid signing secret');let bytes;try{bytes=decode(secret.slice(6));}catch{throw Error('Invalid signing secret');}if(bytes.length<24||bytes.length>64)throw Error('Invalid signing secret');return bytes;}
async function send(subscription,payload,id){
 const body=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000));
 const signatures=[];
 for(const secret of [subscription.secret,...(subscription.previousSecretUntil>Date.now()?[subscription.previousSecret]:[])].filter(Boolean)){
  const key=await crypto.subtle.importKey('raw',secretBytes(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  signatures.push('v1,'+base64(await crypto.subtle.sign('HMAC',key,encoder.encode(`${id}.${timestamp}.${body}`))));
 }
 return fetch(callbackURL(subscription.url),{method:'POST',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'content-type':'application/json','webhook-id':id,'webhook-timestamp':timestamp,'webhook-signature':signatures.join(' '),'X-MCP-Subscription-Id':subscription.id},body});
}
async function read(bucket,key){const object=await bucket.get(key);return object?object.json():null;}
const subscriptionKey=id=>'deploy-events/subscriptions/'+id+'.json';
export async function eventRPC(request,env,message){
 if(message.method==='events/list')return eventRPCInner(request,env,message);
 console.info('Deployment subscription request',message.method,'owner',!!owner(request,env));
 try{return await eventRPCInner(request,env,message);}catch(e){
  const reasons=['Only the Site owner can manage deployment subscriptions','Event storage unavailable','Unsupported event or filters','Unsupported callback origin','Invalid signing secret','Invalid subscription lifetime','Callback verification failed'];
  console.error('Deployment subscription rejected: '+(reasons.includes(e.message)?e.message:'Invalid subscription request'));throw e;
 }
}
async function eventRPCInner(request,env,message){
 if(message.method==='events/list')return {events:owner(request,env)?[EVENT,CREW_EVENT]:[]};
 if(!owner(request,env))throw Object.assign(Error('Only the Site owner can manage deployment subscriptions'),{code:-32001});
 if(!env.BUCKET)throw Error('Event storage unavailable');
 const p=message.params??{};
 const isCrew=p.name===CREW_EVENT_NAME;
 if((isCrew?Object.keys(p.arguments||{}).length!==0:p.name!==EVENT_NAME||p.arguments?.repository!==REPOSITORY||Object.keys(p.arguments||{}).length!==1)||p.delivery?.mode!=='webhook')throw Error('Unsupported event or filters');
 const url=callbackURL(p.delivery.url);
 const id='sub_'+await sha256(JSON.stringify([request.headers.get('oai-authenticated-user-id'),url,p.name,isCrew?'crew':REPOSITORY]));
 const key=subscriptionKey(id);
 if(message.method==='events/unsubscribe'){await env.BUCKET.delete(key);return {};}
 secretBytes(p.delivery.secret);
 if(p.ttlMs!==undefined&&p.ttlMs!==null&&(!Number.isFinite(p.ttlMs)||p.ttlMs<=0))throw Error('Invalid subscription lifetime');
 const prior=await read(env.BUCKET,key);
 const subscription={id,url,eventName:p.name,secret:p.delivery.secret,owner:env.DEPLOY_OWNER_EMAIL.toLowerCase(),expiresAt:Date.now()+Math.min(p.ttlMs??86400000,86400000)};
 if(prior?.secret!==subscription.secret&&prior?.secret){subscription.previousSecret=prior.secret;subscription.previousSecretUntil=Date.now()+300000;}
 if(!prior||prior.url!==url||prior.secret!==subscription.secret||Date.now()-(prior.verifiedAt??0)>300000){
  let stage='send';
  try{const challenge=crypto.randomUUID();const response=await send(subscription,{type:'verification',challenge},'verify_'+crypto.randomUUID());stage='http_'+response.status;if(!response.ok)throw Error('challenge_failed');stage='response_json';const echo=await response.json();stage='challenge_match';if(!equal(echo.challenge,challenge))throw Error('challenge_failed');}catch(e){console.error('Deployment callback verification failed',stage,e.name);throw Object.assign(Error('Callback verification failed'),{code:-32015,data:{reason:'challenge_failed'}});}
  subscription.verifiedAt=Date.now();
 }else subscription.verifiedAt=prior.verifiedAt;
 await env.BUCKET.put(key,JSON.stringify(subscription));
 if(isCrew)await deliverCrewEvents(env);
 return {id,refreshBefore:new Date(subscription.expiresAt).toISOString(),cursor:null,truncated:false};
}
export async function verifyOIDC(token,now=Date.now()){
 let stage='decode';try{
 if(typeof token!=='string'||token.length>16000)throw Error('Invalid OIDC token');
 const parts=token.split('.');if(parts.length!==3)throw Error('Invalid OIDC token');
 const header=JSON.parse(new TextDecoder().decode(decode(parts[0]))),claims=JSON.parse(new TextDecoder().decode(decode(parts[1])));
 if(header.alg!=='RS256'||typeof header.kid!=='string')throw Error('Unsupported signature');
 stage='jwks_fetch';const response=await fetch('https://token.actions.githubusercontent.com/.well-known/jwks',{redirect:'manual',signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw Error('GitHub key lookup failed');
 stage='jwks_parse';const jwk=(await response.json()).keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.alg==='RS256');if(!jwk)throw Error('Unknown signing key');
 stage='key_import';
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
 stage='signature';if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),encoder.encode(parts[0]+'.'+parts[1])))throw Error('Invalid signature');
 const seconds=Math.floor(now/1000);
 if(claims.iss!=='https://token.actions.githubusercontent.com'||claims.aud!==AUDIENCE||claims.repository!==REPOSITORY||claims.repository_id!==REPOSITORY_ID||claims.ref!=='refs/heads/main'||claims.workflow_ref!==REPOSITORY+'/.github/workflows/deploy.yml@refs/heads/main'||!['push','workflow_dispatch'].includes(claims.event_name)||!Number.isFinite(claims.exp)||claims.exp<=seconds||!Number.isFinite(claims.nbf)||claims.nbf>seconds+30||!Number.isFinite(claims.iat)||claims.iat<seconds-900||claims.iat>seconds+30||!/^[0-9a-f]{40}$/.test(claims.sha)||!/^\d+$/.test(claims.run_id)||!/^\d+$/.test(claims.run_attempt))throw Error('OIDC claims rejected');
 return claims;
 }catch(e){console.warn('Deployment OIDC stage',stage,e.name);throw e;}
}
export async function deployRoute(request,env){
 const path=new URL(request.url).pathname;
 if(!['/api/deploy-events','/api/deploy-events/status'].includes(path))return null;
 if(!env.BUCKET)return json({error:'Event storage unavailable'},503);
 if(request.method!=='POST')return json({error:'Use POST'},405);
 let claims;try{
  const body=await request.text();if(body.length>20000)throw Error('Invalid OIDC token');
  const input=JSON.parse(body);claims=await verifyOIDC(input.oidc);
 }catch(e){
  const reasons=['Invalid OIDC token','Unsupported signature','GitHub key lookup failed','Unknown signing key','Invalid signature','OIDC claims rejected'];
  const reason=reasons.includes(e.message)?e.message:'Token verification failed';
  console.warn('Deployment authentication rejected: '+reason);
  return json({error:'GitHub workflow authentication failed',reason},401);
 }
 const release=typeof __GITHUB_RELEASE__==='undefined'?null:__GITHUB_RELEASE__;
 if(path.endsWith('/status'))return json({deployed_sha:release?.commit_sha??null});
 if(path!=='/api/deploy-events'||request.method!=='POST')return json({error:'Method not allowed'},405);
 if(release?.commit_sha===claims.sha)return json({already_deployed:true,commit_sha:claims.sha});
 const eventId='github_'+claims.run_id+'_'+claims.run_attempt;
 const receiptKey='deploy-events/receipts/'+eventId+'.json';
 const receipt=await read(env.BUCKET,receiptKey);
 if(receipt?.delivered)return json({accepted:true,duplicate:true,event_id:eventId});
 let subscriptions=[];let cursor;
 do{const page=await env.BUCKET.list({prefix:'deploy-events/subscriptions/',limit:100,cursor});for(const item of page.objects){const s=await read(env.BUCKET,item.key);if(s&&(s.eventName||EVENT_NAME)===EVENT_NAME&&s.expiresAt>Date.now()&&s.owner===env.DEPLOY_OWNER_EMAIL?.toLowerCase())subscriptions.push(s);}cursor=page.truncated?page.cursor:undefined;}while(cursor);
 if(!subscriptions.length)return json({error:'No active owner deployment subscription. Configure it in ChatGPT Work.'},409);
 const event={eventId,name:EVENT_NAME,timestamp:new Date(claims.iat*1000).toISOString(),data:{repository:REPOSITORY,commit_sha:claims.sha,run_id:claims.run_id,run_attempt:claims.run_attempt,actor:String(claims.actor??''),url:`https://github.com/${REPOSITORY}/actions/runs/${claims.run_id}`},cursor:null};
 const delivered=new Set(receipt?.subscription_ids??[]);
 for(const s of subscriptions){
  if(delivered.has(s.id))continue;
  let accepted=false;
  for(let attempt=0;attempt<3;attempt++){
   try{const response=await send(s,event,eventId);if(response.ok){accepted=true;break;}if(response.status===410){await env.BUCKET.delete(subscriptionKey(s.id));break;}if(response.status===413||response.status>=400&&response.status<500&&response.status!==429)break;}catch{}
   if(attempt<2)await new Promise(resolve=>setTimeout(resolve,250*2**attempt));
  }
  if(!accepted){await env.BUCKET.put(receiptKey,JSON.stringify({delivered:false,subscription_ids:[...delivered]}));return json({error:'Event delivery failed; retry this workflow',event_id:eventId},502);}
  delivered.add(s.id);
 }
 await env.BUCKET.put(receiptKey,JSON.stringify({delivered:true,subscription_ids:[...delivered],commit_sha:claims.sha}));
 return json({accepted:true,event_id:eventId,commit_sha:claims.sha});
}

// Durable pending notifications are retried when an owner subscription is refreshed.
export async function queueCrewEvent(env,accountId,registeredAt){
 const eventId='crew_'+accountId;
 const key='crew-events/pending/'+eventId+'.json';
 if(await read(env.BUCKET,'crew-events/delivered/'+eventId+'.json'))return;
 await env.BUCKET.put(key,JSON.stringify({eventId,name:CREW_EVENT_NAME,timestamp:new Date(registeredAt).toISOString(),data:{account_id:accountId,registered_at:new Date(registeredAt).toISOString()},cursor:null}));
}
export async function deliverCrewEvents(env){
 if(!env.BUCKET?.list||!env.DEPLOY_OWNER_EMAIL)return;
 const subscriptions=[];let cursor;
 do{const page=await env.BUCKET.list({prefix:'deploy-events/subscriptions/',limit:100,cursor});for(const item of page.objects){const s=await read(env.BUCKET,item.key);if(s?.eventName===CREW_EVENT_NAME&&s.expiresAt>Date.now()&&s.owner===env.DEPLOY_OWNER_EMAIL.toLowerCase())subscriptions.push(s);}cursor=page.truncated?page.cursor:undefined;}while(cursor);
 if(!subscriptions.length)return;
 const pending=await env.BUCKET.list({prefix:'crew-events/pending/',limit:100});
 for(const item of pending.objects){const event=await read(env.BUCKET,item.key);if(!event)continue;let all=true;
  for(const s of subscriptions){let accepted=false;for(let attempt=0;attempt<3;attempt++){try{const r=await send(s,event,event.eventId);if(r.ok){accepted=true;break;}if(r.status===410){await env.BUCKET.delete(subscriptionKey(s.id));break;}if(r.status>=400&&r.status<500&&r.status!==429)break;}catch{}}
   if(!accepted)all=false;
  }
  if(all){await env.BUCKET.put('crew-events/delivered/'+event.eventId+'.json',JSON.stringify({deliveredAt:Date.now()}));await env.BUCKET.delete(item.key);}
 }
}
