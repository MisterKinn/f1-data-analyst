import {test} from 'node:test';import assert from 'node:assert/strict';
import {accountIdentity,accountRoute,googleAccountDeleted,displayName,localizedAccountName} from '../worker/accounts.js';
const origin='https://kongboda-motorsports.jeongmin480.chatgpt.site';
function env(){const data=new Map();return {data,BUCKET:{get:async k=>data.has(k)?{json:async()=>JSON.parse(data.get(k))}:null,put:async(k,v)=>data.set(k,v),delete:async k=>data.delete(k),list:async({prefix})=>({objects:[...data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false})}};}
const headers={'oai-authenticated-user-id':'chat-id','oai-authenticated-user-email':'a@example.com',origin};
const req=(path,body,hs=headers)=>new Request(origin+path,{method:'POST',headers:hs,body:new URLSearchParams(body)});
const google={sub:'google-id',email:'a@example.com',provider:'google'};
test('verified dual identities link to the existing ChatGPT site account; unlink keeps current login',async()=>{
 const e=env(),r=new Request(origin+'/account',{headers});const before=await accountIdentity(r,e,null,{create:true});
 await accountIdentity(r,e,google,{create:true});
 assert.equal((await accountRoute(req('/account/link'),e,{...google,email:'different@example.com'})).status,409);
 assert.equal((await accountRoute(req('/account/link',{}, {...headers,origin:'https://evil.test'}),e,google)).status,403);
 assert.equal((await accountRoute(req('/account/link'),e,google)).status,303);
 const after=await accountIdentity(new Request(origin+'/account'),e,google);assert.equal(after.account.id,before.account.id);assert.equal(after.account.identities.length,2);
 assert.equal((await accountRoute(req('/account/unlink',{provider:'google'}),e,google)).status,409);
 assert.equal((await accountRoute(req('/account/unlink',{provider:'chatgpt'}),e,google)).status,303);assert.equal((await accountIdentity(r,e,google)).account.identities.length,1);
});
test('deletion requires confirmation, deletes only linked personal records and revokes old Google sessions',async()=>{
 const e=env();e.data.set('race-data/shared','untouched');const r=new Request(origin+'/account',{headers});
 await accountIdentity(r,e,null,{create:true});await accountRoute(req('/account/link'),e,google);
 e.data.set('website-auth/google/session/ours.json',JSON.stringify({sub:google.sub,email:google.email}));e.data.set('website-auth/google/session/other.json',JSON.stringify({sub:'other'}));
 assert.equal((await accountRoute(req('/account/delete',{confirmation:'no'}),e,google)).status,400);
 const response=await accountRoute(req('/account/delete',{confirmation:'탈퇴'}),e,google);assert.equal(response.status,303);
 assert.equal(await googleAccountDeleted(e,google.sub,1),true);assert.equal(e.data.has('website-auth/google/session/ours.json'),false);assert.ok(e.data.has('website-auth/google/session/other.json'));assert.equal(e.data.get('race-data/shared'),'untouched');
 assert.equal((await accountIdentity(r,e,null,{create:true})).account.deleted,true);assert.equal((await accountRoute(req('/account/link'),e,google)).status,403);
 assert.equal((await accountRoute(req('/account/rejoin'),e,null)).status,303);assert.ok((await accountIdentity(r,e,null)).account.id);
 assert.equal((await accountRoute(req('/account/delete',{confirmation:'탈퇴'},{origin}),e,null)).status,401);
});
test('later single-provider logins reuse the linked account without a second simultaneous session',async()=>{
 const e=env(),platform=new Request(origin+'/account',{headers});
 const original=await accountIdentity(platform,e,null,{create:true});
 await accountIdentity(platform,e,google,{create:true});
 for(let n=0;n<3;n++){
  assert.equal((await accountIdentity(new Request(origin+'/'),e,google,{create:true})).account.id,original.account.id);
  assert.equal((await accountIdentity(platform,e,null,{create:true})).account.id,original.account.id);
 }
});
test('preferences enforce one team AND up to two distinct drivers and persist across linked logins',async()=>{
 const e=env(),r=new Request(origin+'/account',{headers});await accountIdentity(r,e,null,{create:true});
 const post=entries=>accountRoute(new Request(origin+'/account/preferences',{method:'POST',headers,body:new URLSearchParams(entries)}),e,null);
 assert.equal((await post([['mode','team'],['team','Mercedes']])).status,303);
 await accountIdentity(r,e,google,{create:true});
 assert.equal((await accountIdentity(new Request(origin+'/account'),e,google)).account.preferences.team,'Mercedes');
 assert.equal((await post([['mode','drivers'],['driver','A'],['driver','B'],['driver','C']])).status,400);
 assert.equal((await post([['mode','drivers'],['driver','A'],['driver','A']])).status,400);
 assert.equal((await post([['driver','A'],['driver','B'],['team','Mercedes']])).status,303);
 const both=(await accountIdentity(r,e,null)).account.preferences;assert.equal(both.team,'Mercedes');assert.deepEqual(both.drivers,['A','B']);
 assert.equal((await post([['team','Mercedes'],['team','Ferrari']])).status,400);
 assert.equal((await post([['mode','drivers'],['driver','A'],['driver','B']])).status,303);
 assert.deepEqual((await accountIdentity(r,e,null)).account.preferences.drivers,['A','B']);
 assert.equal((await post([['mode','none']])).status,303);
 assert.equal((await accountIdentity(r,e,null)).account.preferences.team,null);
});
test('one WEC manufacturer can coexist with F1 preferences and survives subsequent F1 changes',async()=>{
 const e=env(),r=new Request(origin+'/account',{headers});await accountIdentity(r,e,null,{create:true});
 assert.equal((await accountRoute(req('/account/preferences',{mode:'team',team:'Mercedes'}),e,null)).status,303);
 assert.equal((await accountRoute(req('/account/wec-preference',{manufacturer:'Genesis'}),e,null)).status,303);
 let p=(await accountIdentity(r,e,null)).account.preferences;assert.equal(p.team,'Mercedes');assert.equal(p.wecHypercarManufacturer,'Genesis');
 assert.equal((await accountRoute(req('/account/preferences',{mode:'none'}),e,null)).status,303);
 assert.equal((await accountIdentity(r,e,null)).account.preferences.wecHypercarManufacturer,'Genesis');
 const bad=new Request(origin+'/account/wec-preference',{method:'POST',headers,body:new URLSearchParams([['manufacturer','Genesis'],['manufacturer','Toyota']])});assert.equal((await accountRoute(bad,e,null)).status,400);
 assert.equal((await accountRoute(req('/account/wec-preference',{manufacturer:''}),e,null)).status,303);
 assert.equal((await accountIdentity(r,e,null)).account.preferences.wecHypercarManufacturer,null);
});

test('F1 and WEC preferences save together; invalid WEC leaves both unchanged',async()=>{
 const e=env(),r=new Request(origin+'/account',{headers});
 await accountIdentity(r,e,null,{create:true});
 const post=entries=>accountRoute(new Request(origin+'/account/preferences',{method:'POST',headers,body:new URLSearchParams(entries)}),e,null);
 assert.equal((await post([['team','Mercedes'],['driver','Antonelli'],['driver','Russell'],['manufacturer','Genesis']])).status,303);
 let pref=(await accountIdentity(r,e,null)).account.preferences;
 assert.equal(pref.team,'Mercedes');assert.equal(pref.wecHypercarManufacturer,'Genesis');assert.deepEqual(pref.drivers,['Antonelli','Russell']);
 assert.equal((await post([['team','Ferrari'],['manufacturer','Toyota'],['manufacturer','Genesis']])).status,400);
 pref=(await accountIdentity(r,e,null)).account.preferences;assert.equal(pref.team,'Mercedes');assert.equal(pref.wecHypercarManufacturer,'Genesis');
 assert.equal((await post([['team','Mercedes'],['manufacturer','']])).status,303);
 assert.equal((await accountIdentity(r,e,null)).account.preferences.wecHypercarManufacturer,null);
});
test('Korean display names use family-first order without rewriting ambiguous or foreign names',()=>{
 assert.equal(displayName('정민 강'),'강정민');assert.equal(displayName('강 정민'),'강정민');assert.equal(displayName('강정민'),'강정민');assert.equal(displayName('Lewis Hamilton'),'Lewis Hamilton');assert.equal(displayName('민 지'),'민 지');
});

test('localized profile names prefer available real Latin names without romanizing Hangul',()=>{
 assert.equal(localizedAccountName('en',{name:'강정민'},{nameEn:'Jeong Min Kang'}),'Jeong Min Kang');
 assert.equal(localizedAccountName('ko',{name:'Jeong Min Kang'},{name:'정민 강'}),'강정민');
 assert.equal(localizedAccountName('en',{name:'강정민'}),'강정민');
});
test('linked profiles preserve Latin name when a later login supplies Hangul',async()=>{
 const e=env(),r=new Request(origin+'/account',{headers:{...headers,'oai-authenticated-user-full-name':'Jeong Min Kang'}});
 await accountIdentity(r,e,null,{create:true});
 await accountIdentity(r,e,{...google,name:'강정민'},{create:true});
 const later=await accountIdentity(new Request(origin+'/account'),e,{...google,name:'강정민'},{create:true});
 assert.equal(later.account.nameEn,'Jeong Min Kang');
 assert.equal(localizedAccountName('en',later.google,later.account),'Jeong Min Kang');
});

test('preference save returns JSON then independently reloads all fields for the same account',async()=>{
 const e=env(),r=new Request(origin+'/account',{headers});await accountIdentity(r,e,null,{create:true});
 const post=new Request(origin+'/account/preferences',{method:'POST',headers:{...headers,Accept:'application/json'},body:new URLSearchParams([['team','Mercedes'],['driver','George Russell'],['driver','Kimi Antonelli'],['manufacturer','Genesis']])});
 const saved=await accountRoute(post,e,null);assert.equal(saved.status,200);assert.equal((await saved.json()).saved,true);
 const get=new Request(origin+'/account/preferences',{headers});const verified=await accountRoute(get,e,null);assert.equal(verified.status,200);
 const data=await verified.json();assert.equal(data.preferences.team,'Mercedes');assert.deepEqual(data.preferences.drivers,['George Russell','Kimi Antonelli']);assert.equal(data.preferences.wecHypercarManufacturer,'Genesis');
 assert.equal((await accountRoute(new Request(origin+'/account/preferences'),e,null)).status,401);
 const other=new Request(origin+'/account/preferences',{headers:{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.test'}});assert.equal((await accountRoute(other,e,null)).status,401);
});
test('live key is server-verified, rate limited, scoped to account and preserved across linking',async()=>{
 const {sharedLiveAllowed}=await import('../worker/accounts.js');const e=env();
 e.LIVE_ANALYSIS_KEY_HASH=Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('test-only-key'))).toString('hex');
 const r=new Request(origin+'/account',{headers});
 assert.equal(await sharedLiveAllowed(r,e),false);
 assert.equal((await accountRoute(req('/account/live-access',{access_key:'wrong'}),e,google)).status,403);
 assert.equal((await accountRoute(req('/account/live-access',{access_key:'test-only-key'}),e,google)).status,303);
 assert.equal(await sharedLiveAllowed(r,e),true);
 assert.equal(await sharedLiveAllowed(new Request(origin+'/mcp',{headers:{'oai-authenticated-user-id':'other','oai-authenticated-user-email':'other@example.com'}}),e),false);
 assert.ok(![...e.data.values()].join('').includes('test-only-key'));
 e.LIVE_ANALYSIS_KEY_REVISION='2';assert.equal(await sharedLiveAllowed(r,e),false);
 for(let i=0;i<5;i++)assert.equal((await accountRoute(req('/account/live-access',{access_key:'bad'}),e,google)).status,403);
 assert.equal((await accountRoute(req('/account/live-access',{access_key:'test-only-key'}),e,google)).status,429);
 assert.equal((await accountRoute(req('/account/live-access',{access_key:'test-only-key'},{origin}),e,null)).status,401);
});
