import{test}from'node:test';import assert from'node:assert/strict';
import{createFirestoreBucket}from'../server/firestore-bucket.js';
import{accountIdentity,accountRoute}from'../worker/accounts.js';
import{authRoute}from'../api/index.js';
import{cachedPublished}from'../worker/published-cache.js';
import{calendarRoute,parseJsonLdEvents,parseICalendar,parseFastF1Schedule,normalizeOfficialEvents,refreshCalendarSource}from'../worker/calendar-refresh.js';
import{calendarReviewedAt}from'../worker/race-calendar-data.js';

function database(){
 const rows=new Map();let tail=Promise.resolve(),fail=false;
 const ref=id=>({id,get:async()=>({exists:rows.has(id),data:()=>rows.get(id)}),delete:async()=>rows.delete(id)});
 return{rows,failNext(){fail=true;},collection:()=>({doc:ref,where(){return this;},orderBy(){return this;},limit(){return this;},get:async()=>({docs:[...rows].map(([id,data])=>({id,data:()=>data})).filter(doc=>doc.data().key.startsWith('website-auth/google/session/'))})}),runTransaction(callback){
  const run=tail.then(async()=>{const writes=new Map();const value=await callback({get:target=>target.get(),set:(target,data)=>writes.set(target.id,data),delete:target=>writes.set(target.id,null)});if(fail){fail=false;throw Error('fixture commit failed');}for(const[id,data]of writes){if(data===null)rows.delete(id);else rows.set(id,data);}return value;});tail=run.catch(()=>{});return run;
 }};
}
const origin='https://kongboda-motorsports.vercel.app';
const google={provider:'google',sub:'fixture-google',email:'fixture@example.invalid'};
const request=(path,values={})=>new Request(origin+path,{method:'POST',headers:{origin},body:new URLSearchParams(values)});

test('buffered multi-document transactions roll back errors, conditional writes and deletions together',async()=>{
 const bucket=createFirestoreBucket(database());await bucket.put('a','{"name":"before"}');await bucket.put('b','{}');
 await assert.rejects(bucket.atomic(async tx=>{await tx.put('a','{"name":"after"}');await tx.delete('b');throw Error('stop');}),/stop/);
 assert.equal((await(await bucket.get('a')).json()).name,'before');assert.ok(await bucket.get('b'));
 await bucket.atomic(async tx=>{const old=await tx.get('a');assert.equal(await tx.put('a','{}',{onlyIf:{etagMatches:'wrong'}}),null);await tx.put('a','{"ok":true}',{onlyIf:{etagMatches:old.etag}});assert.equal((await(await tx.get('a')).json()).ok,true);await tx.delete('b');});
 assert.equal((await(await bucket.get('a')).json()).ok,true);assert.equal(await bucket.get('b'),null);
});

test('concurrent preference changes preserve other fields and crew access under the actual transaction adapter',async()=>{
 const bucket=createFirestoreBucket(database()),env={APP_ORIGIN:origin,BUCKET:bucket};
 const before=await accountIdentity(new Request(origin+'/account'),env,google,{create:true});
 const key='website-accounts/account/'+before.account.id+'.json';await bucket.put(key,JSON.stringify({...before.account,liveAnalysisAccess:{revision:'unchanged',activatedAt:123},preferences:{drivers:[]}}));
 await Promise.all([accountRoute(request('/account/preferences',{team:'Mercedes'}),env,google),accountRoute(request('/account/wec-preference',{manufacturer:'Genesis'}),env,google)]);
 const after=await(await bucket.get(key)).json();assert.equal(after.preferences.team,'Mercedes');assert.equal(after.preferences.wecHypercarManufacturer,'Genesis');assert.deepEqual(after.liveAnalysisAccess,{revision:'unchanged',activatedAt:123});
});

test('account link failure leaves both accounts and identity mappings intact',async()=>{
 const db=database(),bucket=createFirestoreBucket(db),env={APP_ORIGIN:origin,BUCKET:bucket};
 const platformRequest=new Request(origin+'/account',{headers:{'oai-authenticated-user-id':'fixture-platform','oai-authenticated-user-email':google.email}});
 await accountIdentity(platformRequest,env,null,{create:true});await accountIdentity(new Request(origin+'/account'),env,google,{create:true});
 const old=[...db.rows].sort();db.failNext();
 await assert.rejects(accountIdentity(platformRequest,env,google,{create:true}),/commit failed/);
 assert.deepEqual([...db.rows].sort(),old);
});

test('shared published cache survives another worker, labels failed updates and expires exactly after 24 hours',async()=>{
 const bucket=createFirestoreBucket(database()),env={BUCKET:bucket};let now=1000,calls=0;
 const first=await cachedPublished(env,'fixture',async()=>{calls++;return{rows:[1],retrieved_at:'original'};},{now:()=>now});assert.equal(first.stale,false);
 const second=await cachedPublished({BUCKET:bucket},'fixture',async()=>{throw Error('no second fetch');},{now:()=>now});assert.equal(second.cached,true);assert.equal(calls,1);
 now=1000+600000;const stale=await cachedPublished(env,'fixture',async()=>{throw Error('offline');},{now:()=>now});assert.equal(stale.stale,true);assert.equal(stale.retrieved_at,'original');
 now=1000+86400000;await assert.rejects(cachedPublished(env,'fixture',async()=>{throw Error('expired');},{now:()=>now}),/expired/);
});

test('this-device logout does not revoke other devices; all-device logout verifies identity and revokes only that user',async()=>{
 const bucket=createFirestoreBucket(database()),env={BUCKET:bucket};let revocations=[];
 const admin=()=>({auth:{verifySessionCookie:async()=>({uid:'fixture-uid',email_verified:true,firebase:{identities:{'google.com':[google.sub]}}}),revokeRefreshTokens:async uid=>revocations.push(uid)}});
 const one=await authRoute(request('/auth/google/logout'),env,{admin});assert.equal(one.status,303);assert.deepEqual(revocations,[]);
 const req=new Request(origin+'/auth/google/logout-all',{method:'POST',headers:{origin,cookie:'__Host-kongboda-firebase=fixture'}});
 const all=await authRoute(req,env,{admin});assert.equal(all.status,303);assert.deepEqual(revocations,['fixture-uid']);assert.ok(all.headers.getSetCookie().some(c=>c.startsWith('__Host-kongboda-firebase=;')));
 assert.equal((await authRoute(new Request(origin+'/auth/google/logout-all',{method:'POST',headers:{origin:'https://evil.invalid'}}),env,{admin})).status,403);
});

test('calendar parsers reject ambiguous times, keep source identity and clear stale sessions after date changes',()=>{
 const records=parseJsonLdEvents('<script type="application/ld+json">'+JSON.stringify({'@graph':[{'@type':'SportsEvent',name:'Fixture Race',startDate:'2026-11-08'}]})+'</script>');assert.equal(records.length,1);
 const ics=parseICalendar('BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Fixture\\, Race\r\nDTSTART;VALUE=DATE:20261108\r\nDTEND;VALUE=DATE:20261110\r\nEND:VEVENT\r\nEND:VCALENDAR');assert.equal(ics[0].name,'Fixture, Race');assert.equal(ics[0].endDate,'2026-11-09');
 const old=[{id:'same',series:'wec',nameEn:'Fixture Race',name:'기존 이름',start:'2026-11-07',end:'2026-11-07',sessions:[{name:'Race',start:'2026-11-07T10:00:00Z'}]}];
 const normalized=normalizeOfficialEvents(records,'wec','https://official.invalid/',old);assert.equal(normalized[0].id,'same');assert.deepEqual(normalized[0].sessions,[]);
 const f1=parseFastF1Schedule([{round_number:1,event_name:'Fixture GP',event_date:'2026-11-08',session1_date:'2026-11-06T18:00:00',session1:'Practice 1',session1_date_utc:'2026-11-07T02:00:00'}]);assert.equal(f1[0].startDate,'2026-11-06');assert.equal(f1[0].sessions[0].start,'2026-11-07T02:00:00Z');
});

test('automatic calendar refresh persists verified updates and refuses expired or unverified data',async t=>{
 const bucket=createFirestoreBucket(database()),env={BUCKET:bucket},now=Date.parse(calendarReviewedAt+'T00:00:00Z')+3600000;
 t.mock.method(globalThis,'fetch',async()=>Response.json([{round_number:1,event_name:'Fixture GP',event_date:'2026-11-08',session1:'Race',session1_date:'2026-11-08T14:00:00',session1_date_utc:'2026-11-08T14:00:00Z'}]));
 const refreshed=await refreshCalendarSource(env,'f1',now);assert.equal(refreshed.events[0].nameEn,'Fixture GP');
 const response=await calendarRoute(new Request(origin+'/api/race-calendar'),env,{},now);const data=await response.json();assert.ok(data.events.some(e=>e.nameEn==='Fixture GP'));assert.equal(data.maximumStaleSeconds,86400);
 const expired=await(await calendarRoute(new Request(origin+'/api/race-calendar'),env,{},now+86400000)).json();assert.equal(expired.unavailable,true);assert.deepEqual(expired.events,[]);
 assert.equal((await calendarRoute(new Request(origin+'/api/race-calendar?series=https://evil.invalid'),env)).status,400);
});
