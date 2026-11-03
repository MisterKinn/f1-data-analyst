// Additive website identity only. Never grants Sites/MCP, owner, or collector permissions.
import {googleAccountDeleted,accountIdentity,displayName} from './accounts.js';
import * as oauth from 'oauth4webapi';
const ORIGIN='https://kongboda-motorsports.jeongmin480.chatgpt.site';
const CALLBACK=ORIGIN+'/auth/google/callback';
const FLOW='__Host-kongboda-google-flow',SESSION='__Host-kongboda-google';
const FLOW_AGE=600,SESSION_AGE=30*86400;
const metadata={issuer:'https://accounts.google.com',authorization_endpoint:'https://accounts.google.com/o/oauth2/v2/auth',token_endpoint:'https://oauth2.googleapis.com/token',jwks_uri:'https://www.googleapis.com/oauth2/v3/certs',id_token_signing_alg_values_supported:['RS256']};
export const googleConfigured=env=>!!(env.GOOGLE_CLIENT_ID&&env.GOOGLE_CLIENT_SECRET&&env.BUCKET);
const cookie=(name,value,age)=>`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
function readCookie(request,name){const values=(request.headers.get('cookie')||'').split(';').map(s=>s.trim()).filter(s=>s.startsWith(name+'='));if(values.length!==1)return null;const value=values[0].slice(name.length+1);return /^[A-Za-z0-9_-]{43}$/.test(value)?value:null;}
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
const key=async(type,value)=>'website-auth/google/'+type+'/'+await hash(value)+'.json';
function safeBack(value){try{const u=new URL(value||'/',ORIGIN);return value?.startsWith('/')&&u.origin===ORIGIN&&!/^\/(?:auth|account|callback|signin-with-chatgpt|signout-with-chatgpt)(?:\/|$)/.test(u.pathname)?u.pathname+u.search+u.hash:'/';}catch{return '/';}}
function response(body,status=400,cookies=[]){const h=new Headers({'content-type':'text/plain; charset=utf-8','cache-control':'no-store','referrer-policy':'no-referrer','x-content-type-options':'nosniff'});for(const c of cookies)h.append('set-cookie',c);return new Response(body,{status,headers:h});}
function redirect(path,cookies=[]){const r=response(null,303,cookies);r.headers.set('location',path);return r;}
async function load(env,type,token){if(!token)return null;const k=await key(type,token),object=await env.BUCKET.get(k);if(!object)return null;const data=await object.json();if(!Number.isFinite(data.expires)||data.expires<=Date.now()){await env.BUCKET.delete(k);return null;}return data;}
export async function googleIdentity(request,env){
 if(!googleConfigured(env)||new URL(request.url).origin!==ORIGIN)return null;
 try{const session=await load(env,'session',readCookie(request,SESSION));return session?.provider==='google'&&typeof session.sub==='string'&&typeof session.email==='string'&&!await googleAccountDeleted(env,session.sub,session.issuedAt)?{email:session.email,provider:'google',sub:session.sub,...(displayName(session.name)?{name:displayName(session.name)}:{})}:null;}catch{return null;}
}
export async function googleAuthRoute(request,env){
 const u=new URL(request.url);if(!u.pathname.startsWith('/auth/google/'))return null;
 if(u.origin!==ORIGIN)return response('올바른 사이트 주소에서 다시 시도하세요.',400);
 if(!googleConfigured(env))return response('Google 로그인 설정이 아직 완료되지 않았습니다. 기존 ChatGPT 로그인을 이용해 주세요.',503);
 const client={client_id:env.GOOGLE_CLIENT_ID,id_token_signed_response_alg:'RS256'};
 const clearFlow=cookie(FLOW,'',0);
 try{
  if(u.pathname==='/auth/google/start'&&request.method==='GET'){
   // Prevent other sites from initiating an unwanted sign-in when Fetch Metadata is available.
   if(request.headers.get('sec-fetch-site')==='cross-site')return response('사이트의 로그인 버튼을 이용하세요.',403);
   const old=readCookie(request,FLOW);if(old)await env.BUCKET.delete(await key('flow',old));
   const token=oauth.generateRandomState(),state=oauth.generateRandomState(),nonce=oauth.generateRandomNonce(),verifier=oauth.generateRandomCodeVerifier();
   await env.BUCKET.put(await key('flow',token),JSON.stringify({state,nonce,verifier,back:u.searchParams.get('return_to')==='/account'?'/account':safeBack(u.searchParams.get('return_to')),expires:Date.now()+FLOW_AGE*1000}));
   const auth=new URL(metadata.authorization_endpoint);auth.search=new URLSearchParams({client_id:client.client_id,redirect_uri:CALLBACK,response_type:'code',scope:'openid email profile',state,nonce,code_challenge:await oauth.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256',prompt:'select_account'}).toString();
   return redirect(auth.href,[cookie(FLOW,token,FLOW_AGE)]);
  }
  if(u.pathname==='/auth/google/callback'&&request.method==='GET'){
   const token=readCookie(request,FLOW),flow=await load(env,'flow',token);if(!flow)return response('로그인 요청이 만료되었습니다. 사이트에서 다시 로그인해 주세요.',400,[clearFlow]);
   await env.BUCKET.delete(await key('flow',token));
   const params=oauth.validateAuthResponse(metadata,client,u,flow.state);
   const tokenResponse=await oauth.authorizationCodeGrantRequest(metadata,client,oauth.ClientSecretPost(env.GOOGLE_CLIENT_SECRET),params,CALLBACK,flow.verifier);
   const result=await oauth.processAuthorizationCodeResponse(metadata,client,tokenResponse,{expectedNonce:flow.nonce,requireIdToken:true});
   await oauth.validateApplicationLevelSignature(metadata,tokenResponse);
   const claims=oauth.getValidatedIdTokenClaims(result);
   if(!claims?.sub||claims.email_verified!==true||typeof claims.email!=='string')throw Error('Verified identity required');
   await accountIdentity(request,env,{provider:'google',sub:claims.sub,email:claims.email,name:displayName(claims.name)},{create:true});
   const old=readCookie(request,SESSION);if(old)await env.BUCKET.delete(await key('session',old));
   const session=oauth.generateRandomState();
   // No Google access/refresh/ID tokens are persisted, returned, or forwarded to MCP.
   const issuedAt=Date.now();
   await env.BUCKET.put(await key('session',session),JSON.stringify({provider:'google',sub:claims.sub,email:claims.email,name:displayName(claims.name),issuedAt,expires:issuedAt+SESSION_AGE*1000}));
   return redirect(flow.back,[clearFlow,cookie(SESSION,session,SESSION_AGE)]);
  }
  if(u.pathname==='/auth/google/logout'&&request.method==='POST'){
   if(request.headers.get('origin')!==ORIGIN)return response('허용되지 않은 요청입니다.',403);
   const token=readCookie(request,SESSION);if(token)await env.BUCKET.delete(await key('session',token));
   return redirect(request.headers.get('oai-authenticated-user-id')?'/signout-with-chatgpt?return_to=%2Faccount':'/account',[cookie(SESSION,'',0),clearFlow]);
  }
  return response('지원하지 않는 로그인 요청입니다.',405);
 }catch{return response('Google 로그인을 완료하지 못했습니다. 사이트의 로그인 버튼에서 다시 시도해 주세요.',400,[clearFlow]);}
}
