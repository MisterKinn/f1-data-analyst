// Read-only deployment smoke test; Google popup is opened but no user signs in.
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
const base=process.argv[2];if(!base)throw Error('Deployment URL required');
const output=process.env.BROWSER_REPORT_DIR||'.cache/refactor/hosted';await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext({viewport:{width:1280,height:900}}),checks=[];
try{
 if(process.env.BROWSER_COOKIE_JAR){
  const jar=await readFile(process.env.BROWSER_COOKIE_JAR,'utf8');
  await context.addCookies(jar.split('\n').filter(l=>l.includes('\t')).map(l=>{
   const [domain,,path,secure,,name,value]=l.replace(/^#HttpOnly_/,'').split('\t');
   return {domain,path,secure:secure==='TRUE',httpOnly:true,name,value};
  }));
 }
 const assets=JSON.parse(await readFile('dist/static-assets.json','utf8')),queue=[...assets];
 await Promise.all(Array.from({length:6},async()=>{while(queue.length){
  const asset=queue.shift(),r=await context.request.get(base+asset.path);
  assert.equal(r.status(),200,asset.path);
  assert.equal(createHash('sha256').update(await r.body()).digest('hex'),asset.sha256,asset.path);
  const mime=r.headers()['content-type']?.split(';')[0];
  const expected=asset.contentType.split(';')[0];
  assert.ok(mime===expected||[mime,expected].every(t=>['application/javascript','text/javascript'].includes(t)),`${asset.path} MIME ${mime} != ${expected}`);
  assert.equal(r.headers()['x-content-type-options'],'nosniff',asset.path);
  assert.ok(!r.headers()['set-cookie'],asset.path+' must not set session cookies');
 }}));checks.push({name:'all public asset bytes, MIME, nosniff, no cookies',count:assets.length});
 const cached=await context.request.get(base+assets[0].path);
 checks.push({name:'asset caching',cache:cached.headers()['x-vercel-cache'],cacheControl:cached.headers()['cache-control'],etag:cached.headers().etag});
 for(const path of ['/server/index.js','/.openai/hosting.json','/static-assets.json','/assets/nonexistent-refactor.js']){
  const r=await context.request.get(base+path);assert.equal(r.status(),404,path);
 }checks.push({name:'private build files and missing assets return 404'});
 const auth=await context.request.get(base+'/__/auth/iframe');assert.equal(auth.status(),200);assert.match(auth.headers()['content-type'],/text\/html/);
 const metadata=await context.request.get(base+'/.well-known/oauth-authorization-server');assert.equal(metadata.status(),200);assert.ok((await metadata.json()).authorization_endpoint);
 const mcp=await context.request.post(base+'/mcp',{headers:{'content-type':'application/json',accept:'application/json, text/event-stream'},data:{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'release-readonly-check',version:'1'}}}});
 assert.ok([200,401].includes(mcp.status()));if(mcp.status()===200)assert.ok((await mcp.json()).result);else assert.ok(mcp.headers()['www-authenticate']);
 checks.push({name:'Firebase auth proxy, OAuth metadata, MCP',mcpStatus:mcp.status()});
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 const account=await page.goto(base+'/account');assert.equal(account.status(),200);
 assert.match(account.headers()['cache-control'],/no-store/);
 const button=page.getByRole('button',{name:/Google/}).first();await button.waitFor();assert.ok(await button.isEnabled());
 const popupPromise=page.waitForEvent('popup');await button.click();const popup=await popupPromise;
 try{
  await popup.waitForURL(url=>url.hostname==='accounts.google.com',{timeout:30000});
  checks.push({name:'Google button opens Google account authentication',host:new URL(popup.url()).hostname});await popup.close();
 }catch(error){
  // Preview domains are deliberately not added to Firebase's authorized domains.
  if(process.env.EXPECT_PREVIEW_AUTH_BLOCK!=='1')throw error;
  await page.waitForFunction(()=>document.body.textContent.includes('auth/unauthorized-domain'));
  checks.push({name:'Preview domain remains unauthorized for Google login; verify canonical production separately'});
 }
 assert.deepEqual(errors,[]);await page.screenshot({path:output+'/account.png'});
 console.log(JSON.stringify({status:'PASS',base,checks}));
}finally{await writeFile(output+'/checks.json',JSON.stringify({base,checks},null,2));await browser.close();}
