// FIAWEC+ 연결: the remote sign-in browser, run on the site (see api/wec-signin.js).
// A person signs in to FIAWEC+ through screenshots of this headless Chromium; their taps and
// typing arrive through the control record (worker/wec_connect.js relayRoute). The person
// types the password and solves any CAPTCHA; nothing here fills a form or solves a check.
// Once the FIAWEC+ account menu shows, the cookies are saved encrypted for the account and
// the browser closes. One function run lasts at most ~4.5 min; a longer sign-in continues
// in a fresh run with the same cookies and page (chain), up to 15 min in all.
import {saveSignIn,readControl,newCommands,writeView,endControl,seal,unseal,chainKey,startRunner} from '../worker/wec_connect.js';
import {cloudConfigured,cloudRequest} from '../worker/live.js';

export const HOME='https://plus.fiawec.com/en',WIDTH=390,HEIGHT=740;
export const PAGE_HOSTS=new Set(['plus.fiawec.com','auth.staylive.io']);
const RUN_MS=270_000,IDLE_MS=600_000,TOTAL_MS=900_000,REFRESH_MS=2500;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const hostOf=u=>{try{return new URL(u).hostname;}catch{return '';}};

export async function signedIn(page){
 if(hostOf(page.url())!=='plus.fiawec.com')return false;
 try{return await page.locator('[id^="headlessui-menu-button-"]').count()>0&&await page.locator('a[href*="/login"]').count()===0;}catch{return false;}
}

async function launch(){
 const [{default:chromium},{chromium:pw}]=await Promise.all([import('@sparticuz/chromium'),import('playwright-core')]);
 return pw.launch({executablePath:await chromium.executablePath(),args:chromium.args,headless:true});
}

async function openLogin(page){
 try{
  await page.goto(HOME,{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('[id^="headlessui-menu-button-"],a[href*="/login"]').first().waitFor({state:'visible',timeout:15000});
  const login=page.locator('a[href*="/login"]');
  if(await login.count()){
   await login.first().click();
   const button=page.getByRole('button',{name:/^Sign in\b/});
   await button.waitFor({state:'visible',timeout:10000});await button.click();
   await page.waitForURL('https://auth.staylive.io/**',{timeout:20000});
  }
 }catch{} // the person can still go on from whatever page is showing
}

export async function runSignIn(env,{key,run,chain=false,after=0,started=Date.now()},{launchBrowser=launch,now=Date.now}={}){
 const begun=now(),stopAt=begun+RUN_MS;
 let ctl=await readControl(env,key);if(!ctl||ctl.run!==run||ctl.cancel)return 'stale';
 const resume=chain?await unseal(env,key,(await (await env.BUCKET.get(chainKey(key)))?.text?.())||''):null;
 if(chain)await env.BUCKET.delete?.(chainKey(key));
 const browser=await launchBrowser();
 let outcome='closed',seq=after,lastFrame=0,active=resume?.active||begun;
 try{
  const context=await browser.newContext({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1,isMobile:true,hasTouch:true,acceptDownloads:false,locale:'en-GB',...(resume?.state?{storageState:resume.state}:{})});
  const page=await context.newPage();
  await context.route('**/*',route=>{
   const req=route.request();
   if(req.resourceType()==='media')return route.abort();
   let top=false;try{top=req.isNavigationRequest()&&req.frame()===page.mainFrame();}catch{}
   return top&&!PAGE_HOSTS.has(hostOf(req.url()))?route.abort():route.continue();
  });
  if(resume?.url&&PAGE_HOSTS.has(hostOf(resume.url)))await page.goto(resume.url,{waitUntil:'domcontentloaded',timeout:30000}).catch(()=>{});
  else await openLogin(page);
  const frame=async()=>{
   if(await signedIn(page)){
    await saveSignIn(env,key,await context.storageState(),{notify:ctl.notify||null});
    if(ctl.mode==='personal'&&cloudConfigured(env))await cloudRequest(env,'/personal/'+encodeURIComponent(key)+'/wec/restore','POST',{storage_state:await context.storageState()}).catch(()=>null);
    await writeView(env,key,{run,seq,state:'signed_in'});return 'signed_in';
   }
   const image=(await page.screenshot({type:'jpeg',quality:60,timeout:10000})).toString('base64');
   await writeView(env,key,{run,seq,state:'signing_in',host:hostOf(page.url()),image,width:WIDTH,height:HEIGHT});lastFrame=now();return 'signing_in';
  };
  if(await frame()==='signed_in')return outcome='signed_in';
  for(;;){
   ctl=await readControl(env,key);
   if(!ctl||ctl.run!==run||ctl.cancel){outcome='cancelled';break;}
   const commands=await newCommands(env,key,ctl,seq);
   for(const {id,cmd} of commands){
    try{
     if(cmd?.op==='click')await page.mouse.click(cmd.x,cmd.y);
     else if(cmd?.op==='type')await page.keyboard.type(cmd.text,{delay:20});
     else if(cmd?.op==='key')await page.keyboard.press(cmd.key);
     else if(cmd?.op==='scroll')await page.mouse.wheel(0,cmd.dy);
    }catch{}
    seq=id;active=now();
   }
   if(commands.length)await page.waitForTimeout(900);
   if(commands.length||now()-lastFrame>=REFRESH_MS){try{if(await frame()==='signed_in')return outcome='signed_in';}catch{}}
   if(now()-active>IDLE_MS||now()-started>TOTAL_MS){outcome='closed';break;}
   if(now()>=stopAt){
    // Out of time for this run: hand the page and cookies to a fresh run.
    await env.BUCKET.put(chainKey(key),await seal(env,key,{state:await context.storageState(),url:page.url(),active}));
    await browser.close().catch(()=>{});
    await startRunner(env,env.APP_ORIGIN,key,run,{chain:true,after:seq,started});
    return outcome='continued';
   }
   await sleep(commands.length?100:400);
  }
 }finally{
  await browser.close().catch(()=>{});
  if(outcome==='signed_in'||outcome==='closed'||outcome==='cancelled'){
   if(outcome!=='signed_in')await writeView(env,key,{run,seq,state:outcome}).catch(()=>{});
   await endControl(env,key,run).catch(()=>{});
  }
 }
 return outcome;
}
