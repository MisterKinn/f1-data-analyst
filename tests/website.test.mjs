import assert from 'node:assert/strict';
import {test} from 'node:test';
import worker from '../worker/index.js';
import {championships} from '../worker/website.js';
const get=(path,method='GET')=>worker.fetch(new Request('https://test'+path,{method}),{});
test('each registered championship card reaches its working page and unknown routes stay 404',async()=>{
 const home=await (await get('/')).text();
 assert.match(home,/라이브타이밍은/);assert.match(home,/당신은 화면 속 휠투휠에 집중하세요/);
 for(const c of championships){
  const url='/championships/'+c.slug;
  if(c.group!=='reference')assert.ok(home.includes('href="'+url+'"'));
  const r=await get(url);assert.equal(r.status,200);
  const html=await r.text();assert.ok(html.includes(c.name));
  assert.ok(html.includes((c.mode.startsWith('gtwc-')?'data-race-calendar':'data-championship')+'="'+c.mode+'"'));
  const renderedHome=home.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/g,'');
  assert.ok(!renderedHome.includes('src="'+c.logo+'"'),'championship cards use plain names rather than third-party marks');
  const logo=await get(c.logo);assert.equal(logo.status,200);
  assert.match(logo.headers.get('content-type'),/^image\//);
  assert.match(await logo.text(),/<text\b/,'legacy image URLs remain compatible as plain text labels');
 }
 assert.doesNotMatch(await (await get('/championships/f1')).text(),/href="\/live"/);
 assert.match(await (await get('/championships/wec')).text(),/href="\/guide"/);
 assert.equal((await get('/championships/unlisted')).status,404);
 assert.equal((await get('/championships/f1','POST')).status,404);
});
test('introduction and local logo/script work without changing data authentication',async()=>{
 const about=await (await get('/about')).text();
 assert.match(about,/꽁 — 알아가는 수고를 덜다/);assert.match(about,/보다 — 알고 보면 더 보이는 레이스/);
 const guide=await (await get('/guide')).text();
 assert.match(guide,/https:\/\/chatgpt.com\/plugins/);
 assert.match(guide,/이렇게 알려 드립니다/);assert.match(guide,/레이스 중에는 짧게/);assert.match(guide,/경기가 끝나면 자세히/);
 assert.doesNotMatch(guide,/kongboda-motorsports\.vercel\.app\/mcp/);assert.match(guide,/커스텀 커넥터 추가/);assert.match(guide,/사용자 지정 MCP 서버 추가/);
 assert.ok(!about.includes('01 / INSTALL'));assert.ok(guide.includes('<ol class="guide-steps">'));assert.ok(!guide.includes('HOW TO USE'));assert.ok(!guide.includes('01 / INSTALL'));
 assert.match(about,/Kongboda Motorsports/);
 const svg=await get('/assets/brand-mark.svg');assert.match(svg.headers.get('content-type'),/image\/svg/);assert.match(await svg.text(),/viewBox="250 230 1250 440"/);
 const icon=await get('/assets/brand-icon.png');assert.equal(icon.status,200);assert.equal(icon.headers.get('content-type'),'image/png');assert.equal((await icon.arrayBuffer()).byteLength,283770);
 const script=await get('/assets/website.js');assert.match(script.headers.get('content-type'),/javascript/);new Function(await script.text());
 const head=await get('/','HEAD');assert.equal(head.status,200);assert.equal(await head.text(),'');
 const r=await worker.fetch(new Request('https://test/mcp',{method:'POST',body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'wec_list_archive',arguments:{}}})}),{});
 assert.equal(r.status,200);const challenge=await r.json();assert.equal(challenge.result.isError,true);assert.ok(challenge.result._meta['mcp/www_authenticate']);
});
