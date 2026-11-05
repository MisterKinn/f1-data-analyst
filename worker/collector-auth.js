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

export async function verifyHostSignature(header,{method,pathAndQuery,body='',hosts=COLLECTOR_HOSTS,now=Date.now()}){
 const fields=Object.fromEntries(String(header).replace(/^KongbodaHost\s+/,'').split(',').map(p=>p.trim().split('=')).filter(p=>p.length===2));
 const host=hosts.find(h=>h&&h.name===fields.name);
 if(!host)throw Error('Unknown collector host');
 const ts=Number(fields.ts);
 if(!Number.isInteger(ts)||Math.abs(Math.floor(now/1000)-ts)>HOST_CLOCK_SKEW_SECONDS)throw Error('Stale host signature');
 const bodyHash=hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)));
 const key=await crypto.subtle.importKey('raw',b64u(host.key),{name:'Ed25519'},false,['verify']);
 if(!await crypto.subtle.verify({name:'Ed25519'},key,b64u(fields.sig||''),new TextEncoder().encode(hostMessage(method,pathAndQuery,fields.ts,bodyHash))))throw Error('Bad host signature');
 return {host:host.name};
}

// Home-host uploads use the same endpoints as the GitHub collector. A signed request is
// verified here (with its exact body), then handed to the existing handler as trusted.
const HOST_PATHS=new Set(['/api/live/actions-push','/api/live/actions-history']);
export async function hostCollectorRoute(request,env,{hosts=COLLECTOR_HOSTS,now=Date.now(),handlers}={}){
 const url=new URL(request.url);
 if(!HOST_PATHS.has(url.pathname)||!(request.headers.get('authorization')||'').startsWith('KongbodaHost '))return null;
 const json=(value,status)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 if(!['GET','POST'].includes(request.method))return json({error:'Method not allowed'},405);
 const body=request.method==='POST'?await request.text():'';
 if(body.length>1000000)return json({error:'Payload too large'},413);
 try{await verifyHostSignature(request.headers.get('authorization'),{method:request.method,pathAndQuery:url.pathname+url.search,body,hosts,now});}
 catch{return json({error:'Collector token rejected'},401);}
 const {actionsPush,actionsHistory}=handlers||await import('./live.js');
 const forwarded=new Request(request.url,{method:request.method,headers:request.headers,...(request.method==='POST'?{body}:{})});
 const trusted={verify:async()=>({host:true})};
 const response=await (url.pathname==='/api/live/actions-push'?actionsPush:actionsHistory)(forwarded,env,trusted);
 if(url.pathname!=='/api/live/actions-push'||request.method!=='GET'||response.status!==200||!env.BUCKET)return response;
 // A backup host checks whether another host is already pushing.
 const current=await env.BUCKET.get('live/current.json'),saved=current?await current.json():null;
 return json({...await response.json(),latest_received_at:saved?.received_at??null},200);
}
