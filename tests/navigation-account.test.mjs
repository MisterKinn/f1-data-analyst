import {test} from 'node:test';
import assert from 'node:assert/strict';
import {websiteRoute,safeReturnPath,raceDescriptions} from '../worker/website.js';
import {teamLogoFor} from '../worker/team-logos.js';
const page=async(path,headers={})=>websiteRoute(new Request('https://test'+path,{headers})).text();
test('both groups remain visible and each series has its own explanation',async()=>{
 const home=await page('/');assert.doesNotMatch(home,/role="tablist"|data-series-tab/);
 assert.match(home,/compact-series/);assert.ok(home.indexOf('href="/championships/wec"')<home.indexOf('href="/championships/imsa"'));
 for(const [series,description] of Object.entries(raceDescriptions)){
  const html=await page('/championships/'+series);assert.ok(html.includes(description));
  if(series!=='f1')assert.doesNotMatch(html,/FastF1 경기 데이터/);
 }
});
test('account controls use platform top-level auth and never accept an external return path',async()=>{
 for(const path of ['//evil.test','https://evil.test','/\\\\evil.test','/callback','/signin-with-chatgpt'])assert.equal(safeReturnPath(path),'/');
 assert.equal(safeReturnPath('/championships/imsa?x=1'),'/championships/imsa?x=1');
 const anonymous=await page('/account?return_to=%2Fchampionships%2Fimsa');
 assert.match(anonymous,/target="_top" href="\/signin-with-chatgpt\?return_to=%2Faccount/);
 assert.doesNotMatch(anonymous,/로그인되어 있습니다/);
 const signed=await page('/account',{'oai-authenticated-user-id':'u1','oai-authenticated-user-email':'a<b@example.com'});
 assert.match(signed,/내 계정/);assert.doesNotMatch(signed,/a&lt;b@example.com/);assert.match(signed,/signout-with-chatgpt/);
 assert.equal(websiteRoute(new Request('https://test/account')).headers.get('cache-control'),'private, no-store');
});
test('team marks follow explicit affiliations and preserve unknown driver identities',async()=>{
 assert.equal(teamLogoFor('f1','drivers',{name:'Andrea Kimi Antonelli',team:'Mercedes'}),'mercedes');
 assert.equal(teamLogoFor('wec','hypercar-manufacturers',{name:'Ferrari'}),'ferrari');
 assert.equal(teamLogoFor('imsa','gtp-teams',{name:'Porsche Penske Motorsport'}),'porsche');
 assert.equal(teamLogoFor('formula-e','teams',{name:'Jaguar TCS Racing'}),'jaguar');
 assert.equal(teamLogoFor('f1','drivers',{name:'Andrea Kimi Antonelli'}),null);
 assert.equal(teamLogoFor('alms','teams',{name:'Unknown'}),null);
 for(const key of ['mercedes','ferrari','porsche','jaguar','genesis','alpine','cupra']){
  const r=websiteRoute(new Request('https://test/assets/team/'+key+'.svg'));assert.equal(r.status,200);assert.match(await r.text(),/<svg/);
 }
});
test('all published IMSA manufacturer marks and distinct F1 teams have local assets',async()=>{
 const names=['Cadillac','Porsche','Acura','BMW','Aston Martin','Chevrolet','Ford','Lamborghini','Lexus','McLaren','Ferrari','Mercedes-AMG'];
 for(const category of ['iwsc-03-gtp-manufacturers','iwsc-10-gtdpro-manufacturers','iwsc-13-gtd-manufacturers'])for(const name of names){const key=teamLogoFor('imsa',category,{name});assert.ok(key,name);const r=websiteRoute(new Request('https://test/assets/team/'+key+'.svg'));assert.match(await r.text(),/<svg/);}
 assert.equal(teamLogoFor('f1','drivers',{team:'RB F1 Team, Red Bull'}),'racingbulls');
 assert.equal(teamLogoFor('f1','drivers',{team:'Red Bull Racing'}),'redbull');
 for(const team of ['Haas','Williams'])assert.equal(teamLogoFor('f1','drivers',{team}),team.toLowerCase());
 const script=await page('/assets/website.js');assert.match(script,/team-logo-slot/);assert.match(script,/wrapper.append\(slot\)/);
});
test('Google availability is explicit and website identities never masquerade as platform login',async()=>{
 const req=new Request('https://test/account');
 assert.match(await websiteRoute(req).text(),/Google 로그인 · 준비 중/);
 const ready=await websiteRoute(req,{googleReady:true,firebaseConfig:{apiKey:'public-key',authDomain:'test.firebaseapp.com',projectId:'test',appId:'app'},firebaseCsrf:'csrf'}).text();
 assert.match(ready,/id="google-login"/);assert.match(ready,/signInWithPopup/);assert.doesNotMatch(ready,/signInWithRedirect|href="\/auth\/google\/start/);
 const html=await websiteRoute(req,{google:{email:'a<b@example.com'},googleReady:true}).text();assert.match(html,/내 계정/);assert.match(html,/method="post" action="\/auth\/google\/logout"/);assert.doesNotMatch(html,/signout-with-chatgpt/);assert.doesNotMatch(html,/>ChatGPT로 로그인</);
});
