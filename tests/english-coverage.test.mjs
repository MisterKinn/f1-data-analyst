// Guard against half-translated English pages: any Korean UI text added without an
// English translation fails here. Names and user content stay in data-no-translate areas.
import test from 'node:test';
import assert from 'node:assert/strict';
import {websiteRoute,championships} from '../worker/website.js';

const ALLOWED=new Set(['한국어']);
const request=path=>new Request('https://example.test'+path,{headers:{cookie:'kongboda_lang=en'}});
const signedIn={google:{name:'Tester',email:'t@example.invalid',sub:'s'},googleReady:true,accountInfo:{account:{id:'a',name:'Tester',preferences:{},identities:[{provider:'google'}]}}};

export function untranslated(html){
 const found=[],stack=[],voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
 const tokens=/<(script|style|textarea)\b[^>]*>[\s\S]*?<\/\1\s*>|<!--[\s\S]*?-->|<(?:"[^"]*"|'[^']*'|[^'">])*>|[^<]+/gi;
 for(const match of html.matchAll(tokens)){
  const part=match[0];if(match[1]||part.startsWith('<!--'))continue;
  if(!part.startsWith('<')){
   const text=part.trim();
   // The deletion form deliberately asks for the Korean word “탈퇴”.
   if(!stack.at(-1)?.skip&&/[가-힣]/.test(text)&&!ALLOWED.has(text)&&!/“탈퇴”/.test(text))found.push(text);
   continue;
  }
  const close=part.match(/^<\/\s*([\w:-]+)/);
  if(close){const tag=close[1].toLowerCase();for(let i=stack.length-1;i>=0;i--)if(stack[i].tag===tag){stack.length=i;break;}continue;}
  const open=part.match(/^<\s*([\w:-]+)/);if(!open)continue;
  const tag=open[1].toLowerCase(),skip=!!stack.at(-1)?.skip||/\bdata-no-translate\b/.test(part)||/\btranslate=["']?no\b/.test(part);
  if(!skip)for(const [,name,value] of part.matchAll(/\b(alt|title|aria-label|placeholder)="([^"]*)"/g))if(/[가-힣]/.test(value))found.push('@'+name+'='+value);
  if(!voids.has(tag)&&!part.endsWith('/>'))stack.push({tag,skip});
 }
 return [...new Set(found)];
}

test('English pages contain no untranslated Korean UI text',async()=>{
 const pages=['/','/guide','/about','/resources','/simulation','/simulation?track=Austin','/status','/account',...championships.map(c=>'/championships/'+c.slug)];
 const problems=[];
 for(const path of pages)for(const identity of [{},signedIn]){
  const html=await websiteRoute(request(path),identity).text();
  for(const text of untranslated(html))problems.push(path+(identity.google?' (signed in)':'')+': '+text.slice(0,120));
 }
 assert.deepEqual(problems,[],'Add English to worker/localization.js (or homepage-examples-en.js):\n'+problems.join('\n'));
});

test('the homepage examples are fully English on the English page, not word-substituted',async()=>{
 const html=await websiteRoute(request('/')).text();
 const start=html.indexOf('<div id="kb-recorded"');
 assert.ok(start>0);
 assert.match(html.slice(start,html.indexOf('>',start)),/lang="en"/);
 const examples=html.slice(start,html.indexOf('<section class="connect-section"',start));
 assert.equal(/[가-힣]/.test(examples.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g,'')),false);
 const korean=await websiteRoute(new Request('https://example.test/',{headers:{cookie:'kongboda_lang=ko'}})).text();
 assert.match(korean,/<div id="kb-recorded"[^>]*lang="ko"/);
});

test('homepage examples open on a random tab and the server marks the chosen tab',async()=>{
 const {analysisDemo}=await import('../worker/homepage-examples.js');
 for(const lang of ['ko','en']){
  const post=analysisDemo(lang,'post'),live=analysisDemo(lang,'live');
  assert.match(post,/data-initial-mode="post"/);assert.match(post,/id="record-live"[^>]*hidden/);assert.doesNotMatch(post,/id="record-post"[^>]*hidden/);
  assert.match(live,/data-initial-mode="live"/);assert.match(live,/id="record-post"[^>]*hidden/);
 }
 const modes=new Set(Array.from({length:40},()=>analysisDemo('ko').match(/data-initial-mode="(\w+)"/)[1]));
 assert.deepEqual([...modes].sort(),['live','post']);
});

test('page scripts are content-versioned so a deploy is never hidden by a cached script',async()=>{
 const html=await websiteRoute(new Request('https://example.test/')).text();
 const urls=[...html.matchAll(/src="(\/assets\/(?:website|race-features|examples)\.js\?v=[a-z0-9]+)"/g)].map(m=>m[1]);
 assert.equal(urls.length,3);
 for(const url of urls){const r=websiteRoute(new Request('https://example.test'+url));assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/immutable/);}
 const stale=websiteRoute(new Request('https://example.test/assets/examples.js?v=old'));assert.doesNotMatch(stale.headers.get('cache-control'),/immutable/);
});
