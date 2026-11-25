// Real browser parity against two running servers. No credentials or writes to production.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';

const [baseline,candidate]=process.argv.slice(2);
if(!baseline||!candidate)throw new Error('Usage: node scripts/verify-runtime-browser.mjs BASELINE_URL CANDIDATE_URL');
const output='.cache/refactor/browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const results=[];
const hash=value=>createHash('sha256').update(value).digest('hex');
try{
 for(const [label,base] of [['baseline',baseline],['candidate',candidate]]){
  const context=await browser.newContext({viewport:{width:1280,height:900},locale:'en-US',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  const errors=[],badAssets=[],states=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('response',response=>{if(new URL(response.url()).origin===new URL(base).origin&&new URL(response.url()).pathname.startsWith('/assets/')&&response.status()>=400)badAssets.push([response.url(),response.status()]);});
  // Isolate third-party availability from application parity; live hosting is checked separately.
  await page.route('**/*',route=>new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort());
  const snapshot=async name=>{
   await page.waitForFunction(()=>/\d+:\d/.test(document.querySelector('[data-ls=lap]')?.textContent||''));
   await page.waitForTimeout(700);
   states.push({name,...await page.evaluate(()=>Object.fromEntries(['lap','facts','cmpTable','air','carLabel'].map(key=>[key,document.querySelector(`[data-ls=${key}]`)?.textContent||''])))});
  };
  await page.goto(base+'/?lang=en');
  await page.locator('#navigation a[href="/simulation"]').click();
  await page.goto(base+'/simulation?track=monza&car=2025&lang=en');
  await snapshot('monza-2025');
  await page.screenshot({path:`${output}/${label}-desktop.png`});
  const previous=await page.locator('[data-ls=lap]').innerText();
  await page.locator('select[name=track]').selectOption('suzuka');
  await page.waitForFunction(old=>document.querySelector('[data-ls=lap]').textContent!==old,previous);
  await snapshot('suzuka-2025');
  const series=await page.locator('[data-ls=series] option').evaluateAll(options=>options.find(o=>o.textContent.includes('2026')).value);
  await page.locator('[data-ls=series]').selectOption(series);
  await snapshot('suzuka-2026');
  await page.locator('#kb-tab-compare').click();
  await page.locator('[data-ls=compare]').selectOption('2025');
  await snapshot('comparison');
  await page.locator('#kb-tab-lap').click();
  await page.locator('[data-ls=mode]').selectOption('manual');
  const slider=page.locator('[data-ls=manual] input[type=range]').first();
  await slider.focus();await page.keyboard.press('ArrowRight');
  await snapshot('manual-condition');
  const downloadPromise=page.waitForEvent('download');
  await page.locator('[data-ls=telCsv]').click();
  const download=await downloadPromise;
  const csvHash=hash(await readFile(await download.path()));
  await page.locator('.account-icon').click();
  assert.equal(new URL(page.url()).pathname,'/account');
  assert.match(await page.locator('body').innerText(),/Google/);
  for(const path of ['/setup','/bop','/ai','/privacy']){
   const response=await page.goto(base+path);assert.equal(response.status(),200,path);
   assert.ok((await page.title()).length>0,path);
  }
  await page.goto(base+'/?lang=en');await page.locator('#language').selectOption('ko');
  await page.waitForFunction(()=>document.documentElement.lang==='ko');
  await page.setViewportSize({width:390,height:844});
  await page.locator('button.menu').click();
  assert.equal(await page.locator('button.menu').getAttribute('aria-expanded'),'true');
  await page.locator('#navigation a[href="/simulation"]').click();
  await page.waitForURL('**/simulation*');await snapshot('mobile-navigation');
  await page.screenshot({path:`${output}/${label}-mobile.png`});
  assert.deepEqual(errors,[],label+' browser JS errors');assert.deepEqual(badAssets,[],label+' asset failures');
  results.push({label,states,csvHash,errors,badAssets});await context.close();
 }
 assert.deepEqual(results[1].states,results[0].states,'interactive outputs must match');
 assert.equal(results[1].csvHash,results[0].csvHash,'downloaded telemetry CSV must match');
 console.log(JSON.stringify({status:'PASS',scenarios:results[0].states.map(s=>s.name),csvHash:results[0].csvHash}));
}finally{await writeFile(`${output}/results.json`,JSON.stringify(results,null,2));await browser.close();}
