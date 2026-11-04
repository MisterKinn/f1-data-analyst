import {test} from 'node:test';
import assert from 'node:assert/strict';
import {websiteRoute,championships} from '../worker/website.js';

const page=(path,identity={})=>websiteRoute(new Request('https://kongboda.example'+path,{headers:{'accept-language':'ko'}}),identity);

test('homepage offers a direct setup path before examples and separates the calendar',async()=>{
 const html=await page('/').text();
 assert.match(html,/<a class="button primary" href="\/auth\/google\/start\?return_to=%2F">Google로 로그인<\/a>/);
 assert.doesNotMatch(html,/class="nav-start"|>분석 예시 보기</);
 // The home keeps one connection action (the guide); the public MCP address is copied there.
 assert.match(html,/href="\/guide">연결 방법 보기/);
 const signedIn=await page('/',{google:{sub:'verified',email:'verified@example.invalid'}}).text();
 assert.doesNotMatch(signedIn,/account-dot|>계정 설정<\/a><\/div>/);
 const deleted=await page('/guide',{google:{sub:'verified'},accountInfo:{account:{deleted:true}}}).text();
 assert.doesNotMatch(deleted,/data-copy="https:\/\/kongboda-motorsports.vercel.app\/mcp"/);
 assert.ok(html.indexOf('hero-actions')<html.indexOf('id="kb-recorded"'));
 assert.ok(html.indexOf('id="championships"')<html.indexOf('class="home-calendar"'));
 assert.match(html,/분석 예시 · 현재 라이브 아님/);
 assert.equal((html.match(/data-copy="[^\"]+"/g)||[]).length>=10,true);
 assert.match(html,/class="skip-link" href="#main-content"/);
});

test('public pages render championship names without third-party logo image requests',async()=>{
 for(const path of ['/',...championships.map(c=>'/championships/'+c.slug)]){
  const html=await page(path).text();
  assert.doesNotMatch(html,/<img\b[^>]*src="(?:https:\/\/upload\.wikimedia\.org|\/assets\/(?:team\/|schedule\/|[^"\/]+-official))/);
 }
 const asset=page('/assets/f1-official.svg');
 assert.match(asset.headers.get('content-type'),/svg/);
 assert.match(await asset.text(),/<text[^>]*>Formula 1<\/text>/);
});

test('public static assets can be cached but personalized HTML remains private',()=>{
 assert.match(page('/assets/website.js').headers.get('cache-control'),/^public,/);
 assert.match(page('/account').headers.get('cache-control'),/private, no-store/);
});

test('large recorded telemetry is loaded only on pages that display examples',async()=>{
 const common=await page('/assets/website.js').text();
 const examples=await page('/assets/examples.js').text();
 assert.doesNotMatch(common,/"integrated_distance_m"|"sample_count":269/);
 assert.match(examples,/"sample_count":269/);
 assert.match(await page('/').text(),/src="\/assets\/examples.js"/);
 assert.doesNotMatch(await page('/resources').text(),/src="\/assets\/examples.js"/);
});

test('bad public URLs have a usable 404 page without intercepting APIs',async()=>{
 const response=page('/missing-page');assert.equal(response.status,404);
 assert.match(await response.text(),/홈으로 돌아가기/);
 assert.equal(page('/api/not-a-route'),null);
 assert.equal(page('/assets/missing.js'),null);
});

test('initial load avoids a same-URL reload and account names are translation-protected',async()=>{
 const html=await page('/').text();assert.doesNotMatch(html,/location\.reload\(\)/);
 const response=websiteRoute(new Request('https://kongboda.example/account',{headers:{'accept-language':'en'}}),{google:{sub:'test',email:'test@example.invalid',name:'팀'}});
 const account=await response.text();
 assert.match(account,/data-no-translate[^>]*>팀<\/a>|data-no-translate>팀<\/p>/);
});
