import {oauthAccountState,oauthGrantActive} from '../worker/oauth-account-state.js';
import {createHash,randomBytes} from 'node:crypto';

const CSRF='__Host-kongboda-oauth-csrf';
const ACCESS_AGE=60*60;
const REFRESH_AGE=30*24*60*60;
const CODE_AGE=5*60;
const SCOPES=new Set(['mcp:read','offline_access']);
const CLIENT_REDIRECT_HOSTS=['chatgpt.com','openai.com','claude.ai','claude.com'];
const hash=value=>createHash('sha256').update(value).digest('hex');
const random=(prefix,bytes=32)=>prefix+randomBytes(bytes).toString('base64url');
const key=(type,value)=>`website-auth/oauth/${type}/${hash(value)}.json`;
const read=async(env,type,value)=>{const item=await env.BUCKET.get(key(type,value));return item?item.json():null;};
const write=(env,type,value,data,options)=>env.BUCKET.put(key(type,value),JSON.stringify(data),options);
const remove=(env,type,value)=>env.BUCKET.delete(key(type,value));
const cookie=(value,age)=>`${CSRF}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${age}`;
const readCookie=(header,name)=>(header||'').split(';').map(value=>value.trim()).find(value=>value.startsWith(name+'='))?.slice(name.length+1)||'';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const issuer=(request,env)=>env.APP_ORIGIN||new URL(request.url).origin;
const oauthHeaders={'cache-control':'no-store','pragma':'no-cache','content-type':'application/json; charset=utf-8'};
const oauthError=(error,status=400,description)=>new Response(JSON.stringify({error,...(description?{error_description:description}:{})}),{status,headers:oauthHeaders});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:oauthHeaders});

function validRedirect(value){
 try{const url=new URL(value);return url.protocol==='https:'&&CLIENT_REDIRECT_HOSTS.some(host=>url.hostname===host||url.hostname.endsWith('.'+host))&&!url.username&&!url.password&&!url.hash;}catch{return false;}
}
function scopeValue(raw='mcp:read'){
 const values=String(raw).trim().split(/\s+/).filter(Boolean);
 if(!values.length||values.some(value=>!SCOPES.has(value)))return null;
 return [...new Set(values)].join(' ');
}
function addAuthorizationResult(redirect,params,iss){
 const url=new URL(redirect);for(const [name,value] of Object.entries({...params,iss}))if(value!==undefined&&value!==null)url.searchParams.set(name,String(value));return url.toString();
}
function formField(name,value){return `<input type="hidden" name="${escape(name)}" value="${escape(value)}">`;}

async function client(env,clientId){
 if(typeof clientId!=='string'||clientId.length<16||clientId.length>200)return null;
 const record=await read(env,'client',clientId);return record?.clientId===clientId?record:null;
}
async function authorizationParams(values,request,env){
 const source=name=>String(values.get(name)||'');
 const record=await client(env,source('client_id'));
 if(!record)return {error:'invalid_client'};
 const redirectUri=source('redirect_uri');
 if(!record.redirectUris.includes(redirectUri))return {error:'invalid_request',description:'redirect_uri is not registered'};
 const state=source('state');
 if(state.length>1024)return {error:'invalid_request',description:'state is too long',redirectUri};
 const resource=source('resource');
 if(resource!==issuer(request,env))return {error:'invalid_target',description:'resource does not match this MCP server',redirectUri,state};
 const challenge=source('code_challenge');
 if(source('response_type')!=='code'||source('code_challenge_method')!=='S256'||!/^[A-Za-z0-9_-]{43,128}$/.test(challenge))return {error:'invalid_request',description:'authorization_code with PKCE S256 is required',redirectUri,state};
 const scope=scopeValue(source('scope'));
 if(!scope)return {error:'invalid_scope',description:'unsupported scope',redirectUri,state};
 return {client:record,clientId:record.clientId,redirectUri,state,resource,challenge,scope};
}

async function register(request,env){
 if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return oauthError('invalid_client_metadata',400,'JSON is required');
 const body=await request.json().catch(()=>null),redirectUris=body?.redirect_uris;
 if(!Array.isArray(redirectUris)||redirectUris.length<1||redirectUris.length>5||new Set(redirectUris).size!==redirectUris.length||redirectUris.some(uri=>typeof uri!=='string'||uri.length>2048||!validRedirect(uri)))return oauthError('invalid_redirect_uri',400,'Only registered HTTPS callbacks for supported MCP clients are accepted');
 if(body.token_endpoint_auth_method&&body.token_endpoint_auth_method!=='none')return oauthError('invalid_client_metadata',400,'This public client must use token_endpoint_auth_method none');
 if(body.grant_types&&(!Array.isArray(body.grant_types)||body.grant_types.some(value=>!['authorization_code','refresh_token'].includes(value))))return oauthError('invalid_client_metadata');
 if(body.response_types&&(!Array.isArray(body.response_types)||body.response_types.some(value=>value!=='code')))return oauthError('invalid_client_metadata');
 const clientId=random('kbc_'),now=Math.floor(Date.now()/1000),record={clientId,redirectUris,clientName:typeof body.client_name==='string'?body.client_name.slice(0,120):'MCP client',createdAt:Date.now()};
 await write(env,'client',clientId,record);
 return json({client_id:clientId,client_id_issued_at:now,redirect_uris:redirectUris,client_name:record.clientName,token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']},201);
}

function consentPage(params,identity,csrf){
 const fields=['clientId','redirectUri','state','resource','challenge','scope'].map(name=>formField(name,params[name])).join('');
 return new Response(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Kongboda 연결 승인</title><style>body{font:16px system-ui;background:#0b0d12;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0}main{max-width:520px;padding:36px}section{background:#151923;border:1px solid #2c3342;border-radius:14px;padding:26px}p,li{color:#c4cad5;line-height:1.6}.actions{display:flex;gap:10px;margin-top:24px}button{font:inherit;padding:11px 16px;border:0;border-radius:8px;cursor:pointer}.approve{background:#df1738;color:#fff}</style><main><section><h1>Kongboda Motorsports 연결</h1><p><b>${escape(identity.email)}</b> 계정으로 <b>${escape(params.client.clientName)}</b>의 MCP 연결을 승인합니다.</p><ul><li>모터스포츠 기록·문서·라이브 분석 조회</li><li>이 계정의 개인 설정 조회 및 본인이 요청한 설정 저장</li><li>언제든 계정에서 연결을 해제할 수 있습니다</li></ul><form method="post" action="/oauth/authorize">${fields}${formField('csrf',csrf)}<div class="actions"><button class="approve" name="decision" value="approve">연결 승인</button><button name="decision" value="deny">취소</button></div></form></section></main>`,{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'set-cookie':cookie(csrf,600),'x-frame-options':'DENY'}});
}

async function authorize(request,env,identity){
 const url=new URL(request.url),isPost=request.method==='POST';
 let values,decision='';
 if(isPost){
  if(request.headers.get('origin')!==url.origin)return oauthError('access_denied',403,'Invalid request origin');
  const form=await request.formData();
  decision=String(form.get('decision')||'');
  if(!readCookie(request.headers.get('cookie'),CSRF)||form.get('csrf')!==readCookie(request.headers.get('cookie'),CSRF))return oauthError('access_denied',403,'Authorization confirmation expired');
  values=new URLSearchParams({client_id:String(form.get('clientId')||''),redirect_uri:String(form.get('redirectUri')||''),state:String(form.get('state')||''),resource:String(form.get('resource')||''),code_challenge:String(form.get('challenge')||''),code_challenge_method:'S256',scope:String(form.get('scope')||''),response_type:'code'});
 }else values=url.searchParams;
 const params=await authorizationParams(values,request,env),iss=issuer(request,env);
 if(params.error){
  if(params.redirectUri)return new Response(null,{status:303,headers:{location:addAuthorizationResult(params.redirectUri,{error:params.error,error_description:params.description,state:params.state},iss),'cache-control':'no-store'}});
  return oauthError(params.error,400,params.description);
 }
 if(!identity){
  if(isPost)return oauthError('access_denied',401,'Google login is required');
  const back=url.pathname+url.search;return new Response(null,{status:303,headers:{location:'/auth/google/start?return_to='+encodeURIComponent(back),'cache-control':'no-store'}});
 }
 const accountState=await oauthAccountState(env,identity.sub);
 if(!accountState.active)return oauthError('access_denied',403,'This account was deleted. Rejoin from the account page before connecting.');
 if(!isPost)return consentPage(params,identity,random('csrf_'));
 if(decision!=='approve')return new Response(null,{status:303,headers:{location:addAuthorizationResult(params.redirectUri,{error:'access_denied',error_description:'The user declined the connection',state:params.state},iss),'cache-control':'no-store','set-cookie':cookie('',0)}});
 const code=random('kbo_code_');
 await write(env,'code',code,{clientId:params.clientId,redirectUri:params.redirectUri,resource:params.resource,scope:params.scope,challenge:params.challenge,accountGeneration:accountState.generation,profile:{sub:identity.sub,email:identity.email,name:identity.name||''},issuer:iss,expiresAt:Date.now()+CODE_AGE*1000});
 return new Response(null,{status:303,headers:{location:addAuthorizationResult(params.redirectUri,{code,state:params.state},iss),'cache-control':'no-store','set-cookie':cookie('',0)}});
}

async function claim(env,type,value,expiresAt){return write(env,type+'-used',value,{expiresAt},{onlyIf:{etagDoesNotMatch:'*'}});}
async function issueTokens(env,record,{refresh=true}={}){
 const accessToken=random('kbo_access_'),now=Date.now();
 await write(env,'access',accessToken,{...record,issuedAt:now,expiresAt:now+ACCESS_AGE*1000});
 const result={access_token:accessToken,token_type:'Bearer',expires_in:ACCESS_AGE,scope:record.scope};
 if(refresh){const refreshToken=random('kbo_refresh_');await write(env,'refresh',refreshToken,{...record,issuedAt:now,expiresAt:now+REFRESH_AGE*1000});result.refresh_token=refreshToken;}
 return result;
}
async function token(request,env){
 if(!request.headers.get('content-type')?.toLowerCase().includes('application/x-www-form-urlencoded'))return oauthError('invalid_request',400,'Form encoding is required');
 const form=await request.formData(),grant=String(form.get('grant_type')||''),clientId=String(form.get('client_id')||''),resource=String(form.get('resource')||''),expectedIssuer=issuer(request,env);
 const registered=await client(env,clientId);if(!registered)return oauthError('invalid_client',401);
 if(resource&&resource!==expectedIssuer)return oauthError('invalid_target');
 if(grant==='authorization_code'){
  if(resource!==expectedIssuer)return oauthError('invalid_target');
  const code=String(form.get('code')||''),record=code?await read(env,'code',code):null;
  const verifier=String(form.get('code_verifier')||''),challenge=createHash('sha256').update(verifier).digest('base64url');
  if(!record||record.expiresAt<=Date.now()||record.clientId!==clientId||record.redirectUri!==String(form.get('redirect_uri')||'')||record.resource!==resource||record.issuer!==expectedIssuer||challenge!==record.challenge)return oauthError('invalid_grant');
  if(!await oauthGrantActive(env,record))return oauthError('invalid_grant');
  if(!await claim(env,'code',code,record.expiresAt))return oauthError('invalid_grant');
  await remove(env,'code',code);
  return json(await issueTokens(env,record,{refresh:record.scope.split(' ').includes('offline_access')}));
 }
 if(grant==='refresh_token'){
  const refreshToken=String(form.get('refresh_token')||''),record=refreshToken?await read(env,'refresh',refreshToken):null;
  if(!record||record.expiresAt<=Date.now()||record.clientId!==clientId||record.resource!==(resource||expectedIssuer)||record.issuer!==expectedIssuer)return oauthError('invalid_grant');
  if(!await oauthGrantActive(env,record))return oauthError('invalid_grant');
  if(!await claim(env,'refresh',refreshToken,record.expiresAt))return oauthError('invalid_grant');
  await remove(env,'refresh',refreshToken);
  return json(await issueTokens(env,record));
 }
 return oauthError('unsupported_grant_type');
}

async function revoke(request,env){
 const form=await request.formData().catch(()=>null),value=String(form?.get('token')||'');
 if(value){await Promise.all([remove(env,'access',value),remove(env,'refresh',value)]);}
 return new Response(null,{status:200,headers:{'cache-control':'no-store'}});
}

export function oauthMetadata(request,env){
 const base=issuer(request,env);
 return {issuer:base,authorization_response_iss_parameter_supported:true,authorization_endpoint:base+'/oauth/authorize',token_endpoint:base+'/oauth/token',registration_endpoint:base+'/oauth/register',revocation_endpoint:base+'/oauth/revoke',token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],grant_types_supported:['authorization_code','refresh_token'],response_types_supported:['code'],scopes_supported:['mcp:read','offline_access']};
}
export function protectedResourceMetadata(request,env){const base=issuer(request,env);return {resource:base,authorization_servers:[base],scopes_supported:['mcp:read'],bearer_methods_supported:['header'],resource_documentation:base+'/guide'};}

export async function mcpOAuthRoute(request,env,identity=null){
 const url=new URL(request.url),path=url.pathname;
 if(path==='/.well-known/oauth-protected-resource'||path==='/.well-known/oauth-protected-resource/mcp')return request.method==='GET'?json(protectedResourceMetadata(request,env)):oauthError('invalid_request',405);
 if(path==='/.well-known/oauth-authorization-server')return request.method==='GET'?json(oauthMetadata(request,env)):oauthError('invalid_request',405);
 if(!env.BUCKET)return path.startsWith('/oauth/')?oauthError('temporarily_unavailable',503):null;
 if(path==='/oauth/register')return request.method==='POST'?register(request,env):oauthError('invalid_request',405);
 if(path==='/oauth/authorize')return ['GET','POST'].includes(request.method)?authorize(request,env,identity):oauthError('invalid_request',405);
 if(path==='/oauth/token')return request.method==='POST'?token(request,env):oauthError('invalid_request',405);
 if(path==='/oauth/revoke')return request.method==='POST'?revoke(request,env):oauthError('invalid_request',405);
 return null;
}

export async function authenticateMcpBearer(request,env){
 const match=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/);if(!match||!env.BUCKET)return null;
 const record=await read(env,'access',match[1]),base=issuer(request,env);
 if(!record||record.expiresAt<=Date.now()||record.issuer!==base||record.resource!==base||!record.scope?.split(' ').includes('mcp:read')||!record.profile?.sub||!record.profile?.email){if(record)await remove(env,'access',match[1]);return null;}
 if(!await oauthGrantActive(env,record))return null;
 return record.profile;
}

export function mcpAuthChallenge(request,description='You need to sign in to continue'){
 const metadata=new URL('/.well-known/oauth-protected-resource',request.url).toString();
 return `Bearer resource_metadata="${metadata}", scope="mcp:read", error="insufficient_scope", error_description="${description.replace(/["\\]/g,'')}"`;
}
