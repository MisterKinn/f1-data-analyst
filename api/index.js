import {randomBytes} from 'node:crypto';
import {waitUntil} from '@vercel/functions';
import worker from '../worker/index.js';
import {firebaseAdmin} from '../server/firebase-admin.js';
import {createFirestoreBucket} from '../server/firestore-bucket.js';
import {authenticateMcpBearer,mcpOAuthRoute} from '../server/mcp-oauth.js';

const SESSION='__Host-kongboda-firebase',CSRF='__Host-kongboda-csrf',SESSION_AGE=5*24*60*60;
const cookie=(name,value,age,httpOnly=true)=>`${name}=${value}; Path=/; Secure; ${httpOnly?'HttpOnly; ':''}SameSite=Lax; Max-Age=${age}`;
const readCookie=(header,name)=>(header||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';
const safeBack=value=>typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!/^\/(?:auth|api)(?:\/|$)/.test(value)?value:'/account';
export const crossSiteGoogleLoginAllowed=back=>{
 try{const base='https://kongboda.invalid',url=new URL(back,base);return url.origin===base&&url.pathname==='/oauth/authorize';}catch{return false;}
};
export const firebaseGoogleSubject=claims=>{
 const values=claims?.firebase?.identities?.['google.com'];
 return Array.isArray(values)&&typeof values[0]==='string'&&values[0]?values[0]:null;
};
export const firebaseSessionFailure=(code,status)=>Response.json({error:code},{status,headers:{'cache-control':'no-store'}});

function loginPage(env,csrf,back){
 const config={apiKey:env.FIREBASE_WEB_API_KEY,authDomain:env.FIREBASE_WEB_AUTH_DOMAIN,projectId:env.FIREBASE_PROJECT_ID,appId:env.FIREBASE_WEB_APP_ID};
 if(Object.values(config).some(v=>!v))return new Response('Firebase 웹 로그인이 아직 설정되지 않았습니다.',{status:503});
 const data=JSON.stringify({config,csrf,back}).replace(/</g,'\\u003c');
 return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Google 로그인</title><style>body{font:16px system-ui;background:#0b0d12;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:420px;padding:32px;text-align:center}button{font:inherit;padding:12px 18px;border:0;border-radius:8px;cursor:pointer}p{color:#b8bfcc}</style><main><h1>Google로 로그인</h1><p>계속하려면 아래 버튼을 눌러 주세요.</p><button id="login">Google로 로그인</button><p id="status" role="status" aria-live="polite"></p></main><script type="module">
import{initializeApp}from'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import{getAuth,GoogleAuthProvider,signInWithPopup}from'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
const d=${data},s=document.querySelector('#status'),button=document.querySelector('#login');
const auth=getAuth(initializeApp(d.config)),provider=new GoogleAuthProvider();
const codeOf=e=>typeof e?.code==='string'?e.code:'auth/session-failed';
const showError=e=>{const code=codeOf(e);s.textContent='로그인을 완료하지 못했습니다. ('+code+')';button.disabled=false;console.error(e)};
const finish=async result=>{if(!result)return false;const token=await result.user.getIdToken();const q=await fetch('/auth/firebase/session',{method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-csrf-token':d.csrf},body:JSON.stringify({token,csrf:d.csrf,returnTo:d.back})});const payload=await q.json().catch(()=>({}));if(!q.ok)throw Object.assign(Error(payload.error||'auth/session-failed'),{code:payload.error||'auth/session-failed'});location.assign(payload.location);return true};
button.onclick=async()=>{button.disabled=true;s.textContent='Google 로그인 중…';try{const pending=signInWithPopup(auth,provider);await finish(await pending)}catch(error){showError(error)}};
</script></html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'unsafe-inline' https://www.gstatic.com https://apis.google.com; connect-src https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com; frame-src https://accounts.google.com https://apis.google.com https://*.firebaseapp.com; style-src 'unsafe-inline'; img-src data: https:; base-uri 'none'; form-action 'self'",'set-cookie':cookie(CSRF,csrf,600)}});
}

async function authRoute(request,env){
 const url=new URL(request.url);
 if(url.pathname==='/auth/google/start'&&request.method==='GET'){
  const back=safeBack(url.searchParams.get('return_to'));
  if(request.headers.get('sec-fetch-site')==='cross-site'&&!crossSiteGoogleLoginAllowed(back))return new Response('사이트의 로그인 버튼을 이용해 주세요.',{status:403});
  const csrf=randomBytes(32).toString('base64url');return loginPage(env,csrf,back);
 }
 if(url.pathname==='/auth/firebase/session'&&request.method==='POST'){
  const body=await request.json().catch(()=>null),expected=readCookie(request.headers.get('cookie'),CSRF);
  if(!body||!expected||body.csrf!==expected||request.headers.get('x-csrf-token')!==expected||request.headers.get('origin')!==url.origin)return firebaseSessionFailure('auth/request-validation-failed',403);
  const {auth}=firebaseAdmin();let decoded;
  try{decoded=await auth.verifyIdToken(body.token,true);}catch(error){console.error('firebase-session token-verification-failed',error?.code||error?.name||'unknown');return firebaseSessionFailure('auth/token-verification-failed',401);}
  if(!decoded.email||decoded.email_verified!==true||decoded.firebase?.sign_in_provider!=='google.com'||!firebaseGoogleSubject(decoded))return firebaseSessionFailure('auth/google-claims-invalid',403);
  const issued=Number(decoded.auth_time)*1000;if(!Number.isFinite(issued)||Date.now()-issued>5*60*1000)return firebaseSessionFailure('auth/login-too-old',401);
  let session;
  try{session=await auth.createSessionCookie(body.token,{expiresIn:SESSION_AGE*1000});}catch(error){console.error('firebase-session cookie-creation-failed',error?.code||error?.name||'unknown');return firebaseSessionFailure('auth/session-cookie-failed',500);}
  const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store'});headers.append('set-cookie',cookie(SESSION,session,SESSION_AGE));headers.append('set-cookie',cookie(CSRF,'',0));
  return new Response(JSON.stringify({location:safeBack(body.returnTo)}),{headers});
 }
 if(url.pathname==='/auth/google/logout'&&request.method==='POST'){
  if(request.headers.get('origin')!==url.origin)return new Response('허용되지 않은 요청입니다.',{status:403});
  const headers=new Headers({location:'/account','cache-control':'no-store'});headers.append('set-cookie',cookie(SESSION,'',0));headers.append('set-cookie',cookie(CSRF,'',0));return new Response(null,{status:303,headers});
 }
 return null;
}

async function webRequest(req){
 const proto=req.headers['x-forwarded-proto']||'https',host=req.headers['x-forwarded-host']||req.headers.host;
 const incoming=new URL(req.url,`${proto}://${host}`),path=incoming.searchParams.get('__path');
 const url=new URL(path===null?incoming.pathname:`/${path}`,`${proto}://${host}`);for(const [key,value] of incoming.searchParams)if(key!=='__path')url.searchParams.append(key,value);
 const headers=new Headers();for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value);
 for(const key of [...headers.keys()])if(key.startsWith('oai-authenticated-user-')||key.startsWith('x-kongboda-'))headers.delete(key);
 const init={method:req.method,headers};if(!['GET','HEAD'].includes(req.method)){const chunks=[];for await(const chunk of req)chunks.push(chunk);init.body=Buffer.concat(chunks);init.duplex='half';}
 return new Request(url,init);
}

async function send(response,res){res.statusCode=response.status;for(const [key,value] of response.headers){if(key==='set-cookie'&&response.headers.getSetCookie)continue;res.setHeader(key,value);}if(response.headers.getSetCookie){const values=response.headers.getSetCookie();if(values.length)res.setHeader('set-cookie',values);}res.end(Buffer.from(await response.arrayBuffer()));}

export default async function handler(req,res){
 try{
  let request=await webRequest(req);const firebaseReady=['FIREBASE_WEB_API_KEY','FIREBASE_WEB_AUTH_DOMAIN','FIREBASE_PROJECT_ID','FIREBASE_WEB_APP_ID'].every(key=>process.env[key]);
  const runtimeEnv={...process.env,APP_ORIGIN:new URL(request.url).origin,FIREBASE_AUTH_CONFIGURED:String(firebaseReady)};
  runtimeEnv.BUCKET=createFirestoreBucket(firebaseAdmin().firestore);
  const direct=await authRoute(request,runtimeEnv);if(direct)return send(direct,res);
  const headers=new Headers(request.headers),requestUrl=new URL(request.url),accountCsrf=firebaseReady&&request.method==='GET'&&requestUrl.pathname==='/account'?randomBytes(32).toString('base64url'):null,session=readCookie(headers.get('cookie'),SESSION);let firebaseUser=null;
  if(accountCsrf)headers.set('x-kongboda-firebase-csrf',accountCsrf);
  if(session){try{const user=await firebaseAdmin().auth.verifySessionCookie(session,true),subject=firebaseGoogleSubject(user);if(user.email&&user.email_verified&&subject){firebaseUser={sub:subject,email:user.email,name:user.name||''};headers.set('x-kongboda-firebase-user-id',subject);headers.set('x-kongboda-firebase-user-email',user.email);headers.set('x-kongboda-firebase-user-name',encodeURIComponent(user.name||''));headers.set('x-kongboda-firebase-user-name-encoding','percent-encoded-utf-8');}}catch{/* Invalid sessions are anonymous. */}}
  request=new Request(request,{headers});
  const oauth=await mcpOAuthRoute(request,runtimeEnv,firebaseUser);if(oauth)return send(oauth,res);
  if(new URL(request.url).pathname==='/mcp'){
   const profile=await authenticateMcpBearer(request,runtimeEnv);
   if(profile){headers.set('oai-authenticated-user-id','oauth:'+profile.sub);headers.set('oai-authenticated-user-email',profile.email);headers.set('oai-authenticated-user-full-name',encodeURIComponent(profile.name||''));headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');headers.set('x-kongboda-firebase-user-id',profile.sub);headers.set('x-kongboda-firebase-user-email',profile.email);headers.set('x-kongboda-firebase-user-name',encodeURIComponent(profile.name||''));headers.set('x-kongboda-firebase-user-name-encoding','percent-encoded-utf-8');request=new Request(request,{headers});}
  }
  const response=await worker.fetch(request,runtimeEnv,{waitUntil});
  if(accountCsrf){const responseHeaders=new Headers(response.headers);responseHeaders.append('set-cookie',cookie(CSRF,accountCsrf,600));return send(new Response(response.body,{status:response.status,statusText:response.statusText,headers:responseHeaders}),res);}
  return send(response,res);
 }catch(error){
  console.error('request-failed',error?.code||error?.name||'unknown');
  const incoming=new URL(req.url,'https://kongboda.invalid'),path=incoming.searchParams.get('__path')||incoming.pathname;
  if(path==='/auth/firebase/session')return send(firebaseSessionFailure('auth/session-internal-error',500),res);
  return send(new Response('Internal Server Error',{status:500}),res);
 }
}
