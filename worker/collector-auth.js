// Home-host authentication for collector uploads (/api/live/actions-push, /actions-history).
// The GitHub workflow keeps using "Bearer <OIDC token>" (worker/github-oidc.js). A home host
// sends "KongbodaHost name=<host>,ts=<unix seconds>,sig=<base64url Ed25519 signature>".
// The signature covers the method, path+query, timestamp and the SHA-256 of the body, so a
// captured header cannot be reused for another request body or after 5 minutes.
import {COLLECTOR_HOSTS} from './collector-hosts.js';

export const HOST_CLOCK_SKEW_SECONDS=300;
const b64u=s=>Uint8Array.from(atob(String(s).replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(String(s).length/4)*4,'=')),c=>c.charCodeAt(0));
const hex=buffer=>[...new Uint8Array(buffer)].map(b=>b.toString(16).padStart(2,'0')).join('');

export function hostMessage(method,pathAndQuery,ts,bodyHash){return `${method}\n${pathAndQuery}\n${ts}\n${bodyHash}`;}

const reject=(reason,message)=>Object.assign(Error(message),{reason});
// Hosting rewrites can add their own query parameters, so a host also sends the query it
// signed (q=<base64url>). Every signed parameter must match the request exactly; extra
// parameters added in transit are not signed and are ignored by the handlers.
export function signedPath(fields,url){
 if(fields.q===undefined)return url.pathname+url.search;
 const query=new TextDecoder().decode(b64u(fields.q)),signed=new URLSearchParams(query);
 for(const name of new Set(signed.keys())){const a=signed.getAll(name),b=url.searchParams.getAll(name);if(a.length!==b.length||a.some((v,i)=>v!==b[i]))throw reject('query_mismatch','Signed query does not match the request');}
 return url.pathname+(query?'?'+query:'');
}
export async function verifyHostSignature(header,{method,pathAndQuery,url,body='',hosts=COLLECTOR_HOSTS,now=Date.now()}){
 const fields=Object.fromEntries(String(header).replace(/^KongbodaHost\s+/,'').split(',').map(p=>p.trim().split('=')).filter(p=>p.length===2));
 const host=hosts.find(h=>h&&h.name===fields.name);
 if(!host)throw reject('unknown_host','Unknown collector host');
 const ts=Number(fields.ts);
 if(!Number.isInteger(ts)||Math.abs(Math.floor(now/1000)-ts)>HOST_CLOCK_SKEW_SECONDS)throw reject('stale','Stale host signature');
 const path=url?signedPath(fields,url):pathAndQuery;
 const bodyHash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)));
 let key;try{key=await crypto.subtle.importKey('raw',b64u(host.key),{name:'Ed25519'},false,['verify']);}catch{throw reject('ed25519_unavailable','Ed25519 is not available');}
 if(!await crypto.subtle.verify({name:'Ed25519'},key,b64u(fields.sig||''),new TextEncoder().encode(hostMessage(method,path,fields.ts,bodyHash))))throw reject('bad_signature','Bad host signature');
 return {host:host.name};
}

// Home-host uploads use the same endpoints as the GitHub collector. A signed request is
// verified here (with its exact body), then handed to the existing handler as trusted.
// Hosts also send heartbeats (/api/live/host-beat) and register themselves
// (/api/live/host-register); see collector-fleet.js for the baton rules.
const HOST_PATHS=new Set(['/api/live/actions-push','/api/live/actions-history','/api/live/host-beat','/api/live/host-register']);
export async function hostCollectorRoute(request,env,{hosts,now=Date.now(),handlers,fleet}={}){
 const url=new URL(request.url);
 if(!HOST_PATHS.has(url.pathname)||!(request.headers.get('authorization')||'').startsWith('KongbodaHost '))return null;
 const json=(value,status)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 const isBeat=url.pathname==='/api/live/host-beat',isRegister=url.pathname==='/api/live/host-register';
 if(!['GET','POST'].includes(request.method)||((isBeat||isRegister)&&request.method!=='POST'))return json({error:'Method not allowed'},405);
 const body=request.method==='POST'?await request.text():'';
 if(body.length>1000000)return json({error:'Payload too large'},413);
 const header=request.headers.get('authorization');
 const F=fleet||await import('./collector-fleet.js');
 if(isRegister){
  if(!env.BUCKET)return json({error:'Live storage unavailable'},503);
  const [status,value]=await F.hostRegister(env,body,list=>verifyHostSignature(header,{method:'POST',url,body,hosts:list,now}),{origin:url.origin,now});
  return json(value,status);
 }
 // Built-in hosts always work; hosts the owner approved on the site are added when storage is up.
 let allowed=hosts||COLLECTOR_HOSTS;
 if(!hosts&&env.BUCKET){try{allowed=await F.uploadHosts(env);}catch{}}
 let signer;
 try{signer=(await verifyHostSignature(header,{method:request.method,url,body,hosts:allowed,now})).host;}
 catch(e){return json({error:'Collector token rejected',reason:e.reason||'invalid'},401);}
 if(!env.BUCKET)return json({error:'Live storage unavailable'},503);
 if(isBeat){const [status,value]=await F.hostBeat(env,signer,body,now);return json(value,status);}
 const isPush=url.pathname==='/api/live/actions-push',windowId=url.searchParams.get('window');
 const host=allowed.find(h=>h.name===signer);
 if(request.method==='POST'&&host?.enabled===false)return json({error:'Host paused by the owner',standby:true},409);
 // Only the baton holder publishes live snapshots. Hosts that send no heartbeat (older
 // collector code) are not gated, so an update can roll out one computer at a time.
 if(isPush&&request.method==='POST'&&windowId){
  const refused=await F.hostBatonGate(env,signer,'f1',windowId);
  if(refused)return json(refused,409);
 }
 const {actionsPush,actionsHistory}=handlers||await import('./live.js');
 const forwarded=new Request(request.url,{method:request.method,headers:request.headers,...(request.method==='POST'?{body}:{})});
 const trusted={verify:async()=>({host:true})};
 const response=await (isPush?actionsPush:actionsHistory)(forwarded,env,trusted);
 if(!isPush||request.method!=='GET'||response.status!==200)return response;
 const current=await env.BUCKET.get('live/current.json'),saved=current?await current.json():null;
 return json({...await response.json(),latest_received_at:saved?.received_at??null},200);
}
