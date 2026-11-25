import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {websiteRoute,staticAssetPaths} from '../worker/website.js';
import worker from '../worker/index.js';
import {buildStaticAssets} from '../scripts/build-static-assets.mjs';
import {storageDomain} from '../worker/storage-domains.js';
import {cachedPublished} from '../worker/published-cache.js';

test('published cache coalesces requests even without a storage binding',async()=>{
 const env={};let loads=0;
 const load=async()=>{loads++;await new Promise(resolve=>setTimeout(resolve,10));return {ok:true};};
 await Promise.all([cachedPublished(env,'fixture',load),cachedPublished(env,'fixture',load)]);
 assert.equal(loads,1);
});

test('purpose repositories preserve storage contracts and prohibit cross-purpose keys',async()=>{
 const writes=[],bucket={get:async key=>key,put:async(...args)=>{writes.push(args);return {etag:'same'};},delete:async()=>{},list:async options=>options,atomic:async callback=>callback(bucket)};
 const accounts=storageDomain(bucket,'accounts');
 assert.equal(storageDomain(bucket,'accounts'),accounts);
 assert.equal(storageDomain(accounts,'accounts'),accounts);
 assert.throws(()=>accounts.get('live/diagnostics/x'),/boundary/);
 assert.throws(()=>accounts.list({prefix:''}),/boundary/);
 assert.deepEqual(await accounts.list(),{prefix:'website-accounts/'});
 const options={onlyIf:{etagMatches:'old'}};
 assert.deepEqual(await accounts.atomic(tx=>tx.put('website-accounts/account/x','{}',options)),{etag:'same'});
 assert.deepEqual(writes,[['website-accounts/account/x','{}',options]]);
 assert.equal(storageDomain(undefined,'accounts'),undefined);
 const minimal=storageDomain({get:async()=>null},'accounts');
 assert.equal(minimal.list,undefined);assert.equal(minimal.atomic,undefined);assert.equal(minimal.put,undefined);
});

test('build emits only public assets, with byte-for-byte runtime parity',async()=>{
 const root=await mkdtemp(join(tmpdir(),'kongboda-assets-'));
 try{
  const manifest=await buildStaticAssets(root);
  assert.equal(manifest.length,staticAssetPaths().length);
  for(const asset of manifest){
   assert.ok(asset.path.startsWith('/assets/')||asset.path==='/favicon.ico');
   const body=await readFile(join(root,asset.path));
   const response=websiteRoute(new Request('https://fixture.invalid'+asset.path));
   assert.equal(createHash('sha256').update(body).digest('hex'),asset.sha256);
   assert.deepEqual(body,Buffer.from(await response.arrayBuffer()),asset.path);
   assert.equal(response.headers.get('content-type'),asset.contentType);
  }
  const config=JSON.parse(await readFile(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(config.outputDirectory,'dist/public');
  assert.ok(!manifest.some(a=>/server\/|\.openai|static-assets\.json/.test(a.path)));
 }finally{await rm(root,{recursive:true,force:true});}
});

const baseline=process.env.REFACTOR_BASELINE_ROOT;
test('baseline parity: public/personal HTML, all asset bodies and MCP protocol responses', {skip:!baseline},async()=>{
 const original=(await import(pathToFileURL(resolve(baseline,'worker/website.js'))));
 const originalWorker=(await import(pathToFileURL(resolve(baseline,'worker/index.js')))).default;
 const was=Math.random;Math.random=()=>0.5;
 const compare=async(a,b,label)=>{
  assert.equal(a?.status,b?.status,label);
  assert.deepEqual([...a.headers],[...b.headers],label+' headers');
  assert.deepEqual(Buffer.from(await a.arrayBuffer()),Buffer.from(await b.arrayBuffer()),label+' body');
 };
 try{
  const identities=[{}, {google:{sub:'fixture',email:'fixture@example.invalid',name:'Fixture'},accountInfo:{account:{id:'fixture',name:'Fixture',nameEn:'Fixture',appearance:'dark',identities:[{provider:'google',sub:'fixture'}],preferences:{drivers:[]}}}}, {google:{sub:'fixture',email:'fixture@example.invalid',name:'Fixture'},accountInfo:{account:{id:'fixture',name:'Fixture',deleted:true}}}];
  for(const identity of identities)for(const lang of ['ko','en'])for(const path of ['/','/account','/resources','/privacy','/guide','/missing']){
   const request=new Request('https://fixture.invalid'+path+'?lang='+lang);
   await compare(websiteRoute(request,identity),original.websiteRoute(request,identity),`${path}/${lang}`);
  }
  for(const path of staticAssetPaths()){
   const request=new Request('https://fixture.invalid'+path);
   await compare(websiteRoute(request),original.websiteRoute(request),path);
  }
  for(const method of ['initialize','ping','tools/list','resources/list','server/discover','invalid']){
   const make=()=>new Request('https://fixture.invalid/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method})});
   await compare(await worker.fetch(make(),{}),await originalWorker.fetch(make(),{}),method);
  }
 }finally{Math.random=was;}
});
