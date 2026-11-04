// Controlled fixtures exercise the actual browser scripts; no production requests.
import{writeFile}from'node:fs/promises';
import{websiteRoute}from'../worker/website.js';
const{chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage'],headless:true});
const page=await browser.newPage({viewport:{width:1280,height:900}});const checks=[],errors=[];
page.on('pageerror',e=>errors.push(e.message));let calendarFail=true,standingsFail=false,resultFail=false;const counts={};
const fixture={series:'f1',season:2026,round:20,provider:'TEST FIXTURE',source:'https://example.invalid/published',retrieved_at:new Date().toISOString(),categories:[{id:'drivers',label:'Drivers',rows:[{position:1,name:'Fixture Driver',points:99,team:'Fixture Team',number:'44'}]}]};
await page.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());counts[url.pathname]=(counts[url.pathname]||0)+1;
 if(url.origin!=='https://preview.invalid')return route.abort();
 if(url.pathname==='/api/championship-standings'){
  const fail=standingsFail||url.searchParams.get('series')==='wec';
  const kind=url.searchParams.get('kind')||'drivers';const data={...fixture,categories:[{...fixture.categories[0],id:kind,rows:[{...fixture.categories[0].rows[0],name:kind==='constructors'?'Fixture Team':'Fixture Driver'}]}]};
  return route.fulfill({status:fail?503:200,json:fail?{error:'fixture failed'}:data});
 }
 if(url.pathname==='/account/instructions')return route.fulfill({json:{text:'',revision:0,updatedAt:null}});
 if(url.pathname==='/api/race-results')return route.fulfill({status:resultFail?503:200,json:resultFail?{error:'fixture failed'}:{...fixture,events:[{id:'20',round:20,name:'Fixture GP'}],selected_event:'20',event:'Fixture GP',rows:[{position:1,name:'Fixture Driver',number:'44',team:'Fixture Team',gap:'Leader',stints:null}],strategy_state:'unavailable'}});
 if(url.pathname==='/api/race-calendar'&&calendarFail)return route.fulfill({status:503,json:{error:'fixture failed'}});
 const identity=url.pathname==='/account'?{google:{sub:'fixture-sub',email:'fixture@example.invalid',name:'Fixture'},accountInfo:{account:{id:'fixture',identities:[{provider:'google'}],preferences:{team:'Saved Team',drivers:['Saved Driver'],wecHypercarManufacturer:'Saved Manufacturer'}}}}:{};
 const response=websiteRoute(new Request(url.href),identity);if(!response)return route.abort();
 await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
});
const check=(name,ok)=>checks.push({name,ok});
try{
 await page.clock.install();
 await page.goto('https://preview.invalid/championships/f1');
 await page.locator('#standings table').waitFor();await page.locator('[data-result-table] table').waitFor();
 const retry=page.locator('[data-race-status] button');await retry.waitFor();calendarFail=false;await retry.click();await page.locator('[data-race-cards] .race-card').first().waitFor();check('initial calendar failure can recover without a page reload',true);
 standingsFail=true;resultFail=true;
 await page.clock.fastForward(300001);
 await page.waitForFunction(()=>document.querySelector('#standing-status').textContent.includes('이전 조회 결과'));
 check('failed background standings refresh preserves previous table',await page.locator('#standings table').count()===1);
 check('failed background result refresh preserves previous table',await page.locator('[data-result-table] table').count()===1);
 check('refresh failure is labelled rather than shown as fresh',await page.locator('[data-result-status]').innerText().then(s=>s.includes('이전 조회 결과')));
 check('requests remain bounded during refresh',counts['/api/championship-standings']<=3&&counts['/api/race-results']<=3);
 await page.clock.fastForward(86400000);
 await page.waitForFunction(()=>!document.querySelector('#standings table')&&!document.querySelector('[data-result-table] table'));
 check('failed updates hide standings and results once verification is 24 hours old',await page.locator('#standings table,[data-result-table] table').count()===0);
 standingsFail=false;resultFail=false;
 await page.goto('https://preview.invalid/account');
 await page.locator('#preference-choices select').first().waitFor();
 check('WEC list failure does not block F1 preference controls',await page.locator('#preference-save').isEnabled());
 check('partial list failure preserves saved team and manufacturer',await page.locator('[name=team]').inputValue()==='Saved Team'&&await page.locator('#wec-preference').inputValue()==='Saved Manufacturer');
 check('partial preference lookup failure is visible',await page.locator('#preference-status').innerText().then(s=>s.includes('일부 목록')));
 check('scripts run together without JS errors',errors.length===0);
}catch(e){checks.push({name:'browser fixture completion',ok:false,error:e.message});}
finally{await browser.close();await writeFile('../verification/public-data-results.json',JSON.stringify({checks,counts,errors},null,2));}
console.log(JSON.stringify(checks,null,2));if(checks.some(c=>!c.ok))process.exitCode=1;
