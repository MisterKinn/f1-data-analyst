import {randomBytes} from 'node:crypto';
import {waitUntil} from '@vercel/functions';
import worker from '../worker/index.js';
import {websiteRoute} from '../worker/website.js';
import {firebaseAdmin} from '../server/firebase-admin.js';
import {createFirestoreBucket} from '../server/firestore-bucket.js';
import {authenticateMcpBearer,mcpOAuthRoute} from '../server/mcp-oauth.js';
import {sampleRequestMeasurement,saveRequestMeasurement} from '../server/request-diagnostics.js';

import {SESSION,CSRF,cookie,readCookie,authRoute,sessionCheck,firebaseGoogleSubject,firebaseSessionFailure} from '../server/firebase-session.js';
export {authRoute,sessionCheck,crossSiteGoogleLoginAllowed,firebaseGoogleSubject,firebaseSessionFailure} from '../server/firebase-session.js';
import {webRequest,send} from '../server/http-transport.js';
export {send} from '../server/http-transport.js';

// A signed-in page read fails when the account store does (2026-11-18: database reads failing, every page 500 for signed-in
// visitors only). The page is then served signed out instead of an error; other methods still fail.
export async function signedOutFallback(run,request,signedIn){
 try{return await run(request);}catch(error){
  if(!signedIn||request.method!=='GET')throw error;
  console.error('signed-in-request-failed',error?.code||error?.name||'unknown');
  const headers=new Headers(request.headers);for(const k of [...headers.keys()])if(k.startsWith('x-kongboda-firebase-user'))headers.delete(k);
  return run(new Request(request,{headers}));
 }
}
let sharedBucket=null;
export default async function handler(req,res){
 const measurement=sampleRequestMeasurement(process.env.REQUEST_DIAGNOSTICS_SAMPLE_RATE);let diagnosticsBucket=null,measure=false;
 try{
  let request=await webRequest(req);
  // Generated assets are served by Vercel's filesystem. Dynamic legacy asset
  // aliases that miss that filesystem must not initialize Firebase either.
  const path=new URL(request.url).pathname;
  if(['GET','HEAD'].includes(request.method)&&(path.startsWith('/assets/')||path==='/favicon.ico')){
   const asset=websiteRoute(request);
   return send(asset||Response.json({error:'Not found'},{status:404,headers:{'cache-control':'no-store'}}),res);
  }
  const firebaseReady=['FIREBASE_WEB_API_KEY','FIREBASE_WEB_AUTH_DOMAIN','FIREBASE_PROJECT_ID','FIREBASE_WEB_APP_ID'].every(key=>process.env[key]);
  const runtimeEnv={...process.env,APP_ORIGIN:new URL(request.url).origin,FIREBASE_AUTH_CONFIGURED:String(firebaseReady)};
  // One store per warm instance, so per-store caches (rules index, calendar refresh) last across requests.
  runtimeEnv.BUCKET=sharedBucket||=createFirestoreBucket(firebaseAdmin().firestore);
  diagnosticsBucket=runtimeEnv.BUCKET;
  const direct=await authRoute(request,runtimeEnv);if(direct)return send(direct,res);
  const headers=new Headers(request.headers),requestUrl=new URL(request.url),accountCsrf=firebaseReady&&request.method==='GET'&&requestUrl.pathname==='/account'?randomBytes(32).toString('base64url'):null,session=readCookie(headers.get('cookie'),SESSION);let firebaseUser=null;
  if(accountCsrf)headers.set('x-kongboda-firebase-csrf',accountCsrf);
  const check=sessionCheck(request.method,requestUrl.pathname);
  if(session&&check!=='skip'){try{const user=await firebaseAdmin().auth.verifySessionCookie(session,check==='revocation'),subject=firebaseGoogleSubject(user);if(user.email&&user.email_verified&&subject){firebaseUser={sub:subject,email:user.email,name:user.name||''};headers.set('x-kongboda-firebase-user-id',subject);headers.set('x-kongboda-firebase-user-email',user.email);headers.set('x-kongboda-firebase-user-name',encodeURIComponent(user.name||''));headers.set('x-kongboda-firebase-user-name-encoding','percent-encoded-utf-8');}}catch{/* Invalid sessions are anonymous. */}}
  request=new Request(request,{headers});
  const oauth=await mcpOAuthRoute(request,runtimeEnv,firebaseUser);if(oauth)return send(oauth,res);
  if(new URL(request.url).pathname==='/mcp'){
   const profile=await authenticateMcpBearer(request,runtimeEnv);
   if(profile){headers.set('oai-authenticated-user-id','oauth:'+profile.sub);headers.set('oai-authenticated-user-email',profile.email);headers.set('oai-authenticated-user-full-name',encodeURIComponent(profile.name||''));headers.set('oai-authenticated-user-full-name-encoding','percent-encoded-utf-8');headers.set('x-kongboda-firebase-user-id',profile.sub);headers.set('x-kongboda-firebase-user-email',profile.email);headers.set('x-kongboda-firebase-user-name',encodeURIComponent(profile.name||''));headers.set('x-kongboda-firebase-user-name-encoding','percent-encoded-utf-8');request=new Request(request,{headers});}
  }
  const measuredPath=new URL(request.url).pathname;
  measure=(firebaseUser||headers.has('oai-authenticated-user-id'))&&(measuredPath==='/mcp'||measuredPath.startsWith('/api/live/'));
  const response=await signedOutFallback(r=>worker.fetch(r,runtimeEnv,{waitUntil}),request,!!firebaseUser);
  if(accountCsrf){const responseHeaders=new Headers(response.headers);responseHeaders.append('set-cookie',cookie(CSRF,accountCsrf,600));return send(new Response(response.body,{status:response.status,statusText:response.statusText,headers:responseHeaders}),res);}
  return send(response,res);
 }catch(error){
  console.error('request-failed',error?.code||error?.name||'unknown');
  const incoming=new URL(req.url,'https://kongboda.invalid'),path=incoming.searchParams.get('__path')||incoming.pathname;
  if(path==='/auth/firebase/session')return send(firebaseSessionFailure('auth/session-internal-error',500),res);
  return send(new Response('Internal Server Error',{status:500}),res);
 }finally{
  if(measure&&measurement&&diagnosticsBucket)waitUntil(saveRequestMeasurement(diagnosticsBucket,measurement,process.env.VERCEL_GIT_COMMIT_SHA).catch(()=>{console.error('live-diagnostics persistence-failed');}));
 }
}
