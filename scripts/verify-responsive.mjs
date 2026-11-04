// Read-only browser verification against the generated, offline worker previews.
// Requires Playwright and a local Chromium executable; never calls production.
import{mkdir,readFile,writeFile}from'node:fs/promises';
import{resolve}from'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=resolve(process.argv[2]||'../preview-updated'),out=resolve(process.argv[3]||'../verification');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'],headless:true});
const context=await browser.newContext({viewport:{width:1280,height:900}});const page=await context.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const rows=[],checks=[];const check=(name,ok,detail)=>checks.push({name,ok,...detail&&{detail}});
const wait=()=>page.waitForTimeout(260);
async function open(file,width){await page.setViewportSize({width,height:900});await page.goto('file://'+resolve(root,file));await page.evaluate(()=>document.fonts.ready);await wait();}
async function layout(file,width){const result=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,bodyWidth:document.body.scrollWidth,heading:parseFloat(getComputedStyle(document.querySelector('h1')).fontSize)}));rows.push({file,...result});check('no page overflow: '+file+' @'+width,result.scrollWidth<=width+1,result);}
try{
 const manifest=JSON.parse(await readFile(resolve(root,'manifest.json'),'utf8'));
 for(const item of manifest.pages)for(const width of [390,1280]){await open(item.file,width);await layout(item.file,width);}
 for(const file of ['index.html','index.en.html']){
  await open(file,1440);
  // Retain the same document while crossing every menu/card/layout boundary.
  for(const width of [1920,1440,1280,1101,1100,1000,999,860,801,800,701,700,500,390,360,320,1440]){await page.setViewportSize({width,height:900});await wait();await layout(file,width);}
  for(const width of [390,1280]){
   await page.setViewportSize({width,height:900});await wait();
   for(const mode of ['live','post']){
    await page.locator('#record-'+mode+'-tab').click();await wait();let heights=[];
    for(let i=0;i<10;i++){
     const info=await page.locator('#record-'+mode+' [data-card]:visible').evaluate(card=>({height:card.getBoundingClientRect().height,scrollHeight:card.scrollHeight,clientHeight:card.clientHeight}));
     heights.push(info.height);check('card content fits '+file+' '+mode+' '+width+' #'+i,info.scrollHeight<=info.clientHeight+1,info);
     await page.locator('[data-nav="'+mode+'"][data-dir="1"]').click();await wait();
    }
    if(width>700)check('shared desktop card height '+file+' '+mode,Math.max(...heights)-Math.min(...heights)<1,{heights});
   }
  }
 }
 await open('index.html',390);const menu=page.locator('.menu');await menu.click();check('mobile menu opens',await menu.getAttribute('aria-expanded')==='true');await page.keyboard.press('Escape');check('Escape closes menu and restores focus',await menu.getAttribute('aria-expanded')==='false'&&await menu.evaluate(el=>el===document.activeElement));
 await menu.click();await page.setViewportSize({width:1280,height:900});await wait();await page.setViewportSize({width:390,height:900});await wait();check('resizing to mobile resets the menu',await menu.getAttribute('aria-expanded')==='false'&&await page.locator('#navigation').evaluate(el=>el.inert));
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-nav="live"][data-dir="1"]').click();await wait();check('reduced motion suppresses card animations',await page.evaluate(()=>document.getAnimations().filter(a=>a.playState==='running').length)===0);
 await page.emulateMedia({reducedMotion:'no-preference'});
 // SVG DOM mutations should settle once width stops changing, including height-only notifications.
 await open('index.html',1280);await page.locator('#record-post-tab').click();await page.locator('[data-nav="post"][data-dir="1"]').click();await wait();
 await page.evaluate(()=>{window.chartChanges=0;new MutationObserver(records=>window.chartChanges+=records.length).observe(document.querySelector('#kb-recorded'),{childList:true,subtree:true});});
 await page.waitForTimeout(400);check('no idle chart redraw loop',await page.evaluate(()=>window.chartChanges)===0);
 await page.evaluate(()=>document.querySelector('#kb-recorded').style.paddingBottom='1px');await wait();check('height-only changes do not redraw charts',await page.evaluate(()=>window.chartChanges)===0);
 for(const [name,file,width,mode]of [['home-desktop','index.html',1440,'live'],['home-mobile','index.html',390,'live'],['post-desktop','index.html',1280,'post'],['home-en-tablet','index.en.html',900,'live']]){
  await open(file,width);await page.locator('#record-'+mode+'-tab').click();await wait();await page.screenshot({path:resolve(out,name+'.png'),fullPage:true});
 }
 check('no JavaScript page errors',errors.length===0,{errors});
}finally{
 await writeFile(resolve(out,'responsive-results.json'),JSON.stringify({browser:await browser.version(),node:process.version,rows,checks,errors,failed:checks.filter(x=>!x.ok)},null,2));await browser.close();
}
console.log(JSON.stringify({checks:checks.length,failed:checks.filter(x=>!x.ok)},null,2));if(checks.some(x=>!x.ok))process.exitCode=1;
