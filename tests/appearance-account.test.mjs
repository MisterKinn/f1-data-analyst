import assert from 'node:assert/strict';
import {test} from 'node:test';
import {websiteRoute} from '../worker/website.js';
import {accountRoute} from '../worker/accounts.js';

const boot=html=>html.match(/<script>\(function appearanceBoot[\s\S]*?\}\)\(([^)]*)\);<\/script>/)?.[1];
const account=appearance=>({google:{name:'Kim',email:'k@test',sub:'g-1'},accountInfo:{account:{id:'a1',name:'Kim',preferences:{},identities:[{provider:'google'}],...(appearance?{appearance}:{})}}});

test('visitors who are not signed in always follow the device setting',async()=>{
 const html=await websiteRoute(new Request('https://kongboda-motorsports.vercel.app/')).text();
 assert.equal(boot(html),'null');
 assert.doesNotMatch(html,/id="appearance"/,'no theme control outside account settings');
});

test('a signed-in account mode is applied on every page before paint',async()=>{
 for(const path of ['/','/guide','/championships/f1','/account']){
  const html=await websiteRoute(new Request('https://kongboda-motorsports.vercel.app'+path),account('light')).text();
  assert.equal(boot(html),'"light"',path);
 }
 const system=await websiteRoute(new Request('https://kongboda-motorsports.vercel.app/'),account('system')).text();
 assert.equal(boot(system),'null');
 const page=await websiteRoute(new Request('https://kongboda-motorsports.vercel.app/account'),account()).text();
 assert.match(page,/id="appearance"/);
 assert.match(page,/로그인한 모든 기기에 적용됩니다/);
});

test('the account stores the chosen mode and rejects unknown values',async()=>{
 const store=new Map();
 const bucket={get:async k=>store.has(k)?{json:async()=>JSON.parse(store.get(k))}:null,put:async(k,v,o)=>{if(o?.onlyIf?.etagDoesNotMatch==='*'&&store.has(k))return null;store.set(k,typeof v==='string'?v:JSON.stringify(v));return {};},delete:async k=>store.delete(k)};
 const env={BUCKET:bucket,APP_ORIGIN:'https://site.test'};
 const google={provider:'google',sub:'g-1',email:'k@test',name:'Kim'};
 const post=value=>{const body=new FormData();body.set('appearance',value);return accountRoute(new Request('https://site.test/account/appearance',{method:'POST',body,headers:{origin:'https://site.test',accept:'application/json'}}),env,google);};
 const saved=await post('dark');
 assert.equal(saved.status,200);
 assert.deepEqual(await saved.json(),{saved:true,appearance:'dark'});
 const stored=[...store.entries()].map(([,v])=>JSON.parse(v)).find(v=>v.identities);
 assert.equal(stored.appearance,'dark');
 assert.equal((await post('neon')).status,400);
});
