import {invalidateAccountOAuth} from '../worker/oauth-account-state.js';
import {randomBytes} from 'node:crypto';
import {firebaseAuthDomain} from '../worker/firebase-auth-domain.js';
import {googleLoginScript} from '../worker/google-login-script.js';
import {firebaseAdmin} from './firebase-admin.js';

export const SESSION='__Host-kongboda-firebase',CSRF='__Host-kongboda-csrf',SESSION_AGE=5*24*60*60;
export const cookie=(name,value,age,httpOnly=true)=>`${name}=${value}; Path=/; Secure; ${httpOnly?'HttpOnly; ':''}SameSite=Lax; Max-Age=${age}`;
export const readCookie=(header,name)=>(header||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(name+'='))?.slice(name.length+1)||'';
const safeBack=value=>typeof value==='string'&&value.startsWith('/')&&!value.startsWith('//')&&!/^\/(?:auth|api)(?:\/|$)/.test(value)?value:'/account';
export const crossSiteGoogleLoginAllowed=back=>{
 try{const base='https://kongboda.invalid',url=new URL(back,base);return url.origin===base&&url.pathname==='/oauth/authorize';}catch{return false;}
};
// Session check strength per request. Static assets never use the login, so they
// skip verification. Public page views (GET/HEAD) verify the cookie signature
// locally. Account, OAuth, MCP and live-data routes, and every non-GET request,
// keep the full check that also asks Firebase whether the session was revoked.
const STRICT_SESSION_PATHS=/^\/(?:account|oauth|auth|mcp|api\/live|api\/status|live|download)(?:\/|$)/;
export const sessionCheck=(method,path)=>path.startsWith('/assets/')?'skip':['GET','HEAD'].includes(method)&&!STRICT_SESSION_PATHS.test(path)?'signature':'revocation';
export const firebaseGoogleSubject=claims=>{
 const values=claims?.firebase?.identities?.['google.com'];
 return Array.isArray(values)&&typeof values[0]==='string'&&values[0]?values[0]:null;
};
export const firebaseSessionFailure=(code,status)=>Response.json({error:code},{status,headers:{'cache-control':'no-store'}});

function loginPage(env,csrf,back,host=''){
 const config={apiKey:env.FIREBASE_WEB_API_KEY,authDomain:firebaseAuthDomain(env,host),projectId:env.FIREBASE_PROJECT_ID,appId:env.FIREBASE_WEB_APP_ID};
 if(Object.values(config).some(v=>!v))return new Response('Firebase 웹 로그인이 아직 설정되지 않았습니다.',{status:503});
 const data=JSON.stringify({config,csrf,back}).replace(/</g,'\\u003c');
 return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Google 로그인</title><style>body{font:16px system-ui;background:#0b0d12;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:420px;padding:32px;text-align:center}button{font:inherit;padding:12px 18px;border:0;border-radius:8px;cursor:pointer}p{color:#b8bfcc}</style><main><h1>Google로 로그인</h1><p>계속하려면 아래 버튼을 눌러 주세요.</p><button id="login">Google로 로그인</button><p id="status" role="status" aria-live="polite"></p></main>${googleLoginScript(data,{button:'#login',status:'#status'})}</html>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; script-src 'unsafe-inline' https://www.gstatic.com https://apis.google.com; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://*.firebaseio.com; frame-src 'self' https://accounts.google.com https://apis.google.com https://*.firebaseapp.com; style-src 'unsafe-inline'; img-src data: https:; base-uri 'none'; form-action 'self'",'set-cookie':cookie(CSRF,csrf,600)}});
}

export async function authRoute(request,env,{admin=firebaseAdmin}={}){
 const url=new URL(request.url);
 if(url.pathname==='/auth/google/start'&&request.method==='GET'){
  const back=safeBack(url.searchParams.get('return_to'));
  if(request.headers.get('sec-fetch-site')==='cross-site'&&!crossSiteGoogleLoginAllowed(back))return new Response('사이트의 로그인 버튼을 이용해 주세요.',{status:403});
  const csrf=randomBytes(32).toString('base64url');return loginPage(env,csrf,back,url.host);
 }
 if(url.pathname==='/auth/firebase/session'&&request.method==='POST'){
  const body=await request.json().catch(()=>null),expected=readCookie(request.headers.get('cookie'),CSRF);
  if(!body||!expected||body.csrf!==expected||request.headers.get('x-csrf-token')!==expected||request.headers.get('origin')!==url.origin)return firebaseSessionFailure('auth/request-validation-failed',403);
  const {auth}=admin();let decoded;
  try{decoded=await auth.verifyIdToken(body.token,true);}catch(error){console.error('firebase-session token-verification-failed',error?.code||error?.name||'unknown');return firebaseSessionFailure('auth/token-verification-failed',401);}
  if(!decoded.email||decoded.email_verified!==true||decoded.firebase?.sign_in_provider!=='google.com'||!firebaseGoogleSubject(decoded))return firebaseSessionFailure('auth/google-claims-invalid',403);
  const issued=Number(decoded.auth_time)*1000;if(!Number.isFinite(issued)||Date.now()-issued>5*60*1000)return firebaseSessionFailure('auth/login-too-old',401);
  let session;
  try{session=await auth.createSessionCookie(body.token,{expiresIn:SESSION_AGE*1000});}catch(error){console.error('firebase-session cookie-creation-failed',error?.code||error?.name||'unknown');return firebaseSessionFailure('auth/session-cookie-failed',500);}
  const headers=new Headers({'content-type':'application/json; charset=utf-8','cache-control':'no-store'});headers.append('set-cookie',cookie(SESSION,session,SESSION_AGE));headers.append('set-cookie',cookie(CSRF,'',0));
  return new Response(JSON.stringify({location:safeBack(body.returnTo)}),{headers});
 }
 if(url.pathname==='/auth/google/logout-all'&&request.method==='POST'){
  if(request.headers.get('origin')!==url.origin)return firebaseSessionFailure('auth/request-validation-failed',403);
  const session=readCookie(request.headers.get('cookie'),SESSION);if(!session)return firebaseSessionFailure('auth/login-required',401);
  const {auth}=admin();let identity;
  try{identity=await auth.verifySessionCookie(session,true);}catch{return firebaseSessionFailure('auth/login-required',401);}
  const sub=firebaseGoogleSubject(identity);if(!sub||!identity.uid||!identity.email_verified)return firebaseSessionFailure('auth/google-claims-invalid',403);
  // Revoke this app's Firebase sessions and OAuth grants, never crew permission.
  await auth.revokeRefreshTokens(identity.uid);await invalidateAccountOAuth(env,sub);
  if(env.BUCKET?.list){let cursor;do{const page=await env.BUCKET.list({prefix:'website-auth/google/session/',...(cursor?{cursor}:{})});for(const item of page.objects){const object=await env.BUCKET.get(item.key);if(object&&(await object.json()).sub===sub)await env.BUCKET.delete(item.key);}cursor=page.truncated?page.cursor:null;}while(cursor);}
  const headers=new Headers({location:'/account?logged_out=all','cache-control':'no-store'});
  for(const name of [SESSION,CSRF,'__Host-kongboda-google'])headers.append('set-cookie',cookie(name,'',0));
  return new Response(null,{status:303,headers});
 }
 if(url.pathname==='/auth/google/logout'&&request.method==='POST'){
  if(request.headers.get('origin')!==url.origin)return new Response('허용되지 않은 요청입니다.',{status:403});
  const headers=new Headers({location:'/account','cache-control':'no-store'});headers.append('set-cookie',cookie(SESSION,'',0));headers.append('set-cookie',cookie(CSRF,'',0));return new Response(null,{status:303,headers});
 }
 return null;
}
