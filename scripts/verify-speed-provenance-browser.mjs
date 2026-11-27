// Compare production's shipped script and the candidate on identical local page data.
// No credentials, production writes or telemetry changes.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const base = process.argv[2] || 'http://127.0.0.1:5178';
const production = 'https://kongboda-motorsports.vercel.app';
const htmlResponse = await fetch(production + '/simulation?track=monza&car=2025');
assert.equal(htmlResponse.status, 200);
const html = await htmlResponse.text();
const asset = html.match(/src="(\/assets\/lapsim\.js[^\"]*)"/)[1];
const response = await fetch(production + asset);
assert.equal(response.status, 200);
const shipped = await response.text();
const baselineHasModel = shipped.includes('speedModel');
const hash = value => createHash('sha256').update(value).digest('hex');
const browser = await chromium.launch({executablePath: process.env.CHROMIUM_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true});
const snapshots = [], errors = [];
try {
  for (const candidate of [false, true]) {
    const context = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: 'reduce', acceptDownloads: true});
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      const u = new URL(route.request().url());
      if (u.origin !== new URL(base).origin) return route.abort();
      if (!candidate && u.pathname === '/assets/lapsim.js') return route.fulfill({body: shipped, contentType: 'application/javascript'});
      return route.continue();
    });
    const states = [];
    for (const [track, lang, mobile] of [['monza', 'en', false], ['silverstone', 'ko', false], ['monza', 'ko', true]]) {
      await page.setViewportSize(mobile ? {width: 390, height: 844} : {width: 1280, height: 900});
      await page.goto(`${base}/simulation?track=${track}&car=2025&lang=${lang}`);
      await page.waitForFunction(() => document.querySelector('[data-ls=chans]')?.dataset.keys?.includes('speed'));
      await page.waitForTimeout(800); // finish the site's numeric entrance animation
      const model = page.locator('[data-lane=speedModel]');
      if (candidate) {
        await model.waitFor({state: 'visible'});
        await page.locator('[data-ls=chans] input[value=speedModel]').uncheck();
        await model.waitFor({state: 'hidden'});
        assert.equal(await model.isVisible(), false);
        await page.locator('[data-ls=chans] input[value=speedModel]').check();
        await model.waitFor({state: 'visible'});
        assert.equal(await model.isVisible(), true);
        const svg = model.locator('svg');
        await svg.hover({position: {x: 100, y: 40}});
        assert.match(await page.locator('[data-ls=cursor]').innerText(), lang === 'en' ? /Model speed/ : /모델 속도/);
      } else if (!baselineHasModel) {
        // The local SSR contains the candidate; wait for the shipped browser script to replace it.
        await page.waitForFunction(() => !document.querySelector('[data-lane=speedModel]'));
        assert.equal(await model.count(), 0);
      }
      const snapshot = async label => {
        const state = await page.evaluate(() => ({
          lap: document.querySelector('[data-ls=lap]').textContent,
          facts: document.querySelector('[data-ls=facts]').textContent,
          map: document.querySelector('[data-ls=map]').innerHTML,
          lanes: [...document.querySelectorAll('[data-lane]')].filter(e => e.dataset.lane !== 'speedModel').map(e => {
            const copy = e.cloneNode(true);
            // Cursor position depends on the preceding interaction, not the computed telemetry.
            copy.querySelectorAll('.ls-cursor').forEach(cursor => cursor.remove());
            return [e.dataset.lane, copy.innerHTML];
          }),
        }));
        return {track, lang, mobile, label, ...state, map: hash(state.map), lanes: state.lanes.map(([key, markup]) => [key, hash(markup)])};
      };
      states.push(await snapshot('default'));
      const downloadPromise = page.waitForEvent('download');
      await page.locator('[data-ls=telCsv]').click();
      const download = await downloadPromise;
      const csv = await readFile(await download.path(), 'utf8');
      const rows = csv.trim().split(/\r?\n/).map(row => row.split(','));
      const modelCol = rows[0].findIndex(cell => /Model speed|모델 속도/.test(cell));
      assert.equal(modelCol >= 0, candidate || baselineHasModel);
      states.push({track, csv: hash(rows.map(row => row.filter((_, i) => i !== modelCol).join(',')).join('\n'))});
      await page.locator('[data-ls=drs]').selectOption('0');
      await page.waitForTimeout(800); // requestAnimationFrame update and displayed-value animation
      states.push(await snapshot('drs-off'));
      await page.locator('[data-ls=mode]').selectOption('manual');
      await page.waitForFunction(() => !/measured|실측/.test(document.querySelector('[data-lane=speed] h3').textContent));
      await page.waitForTimeout(800);
      states.push(await snapshot('manual'));
      if (candidate && process.env.BROWSER_SCREENSHOT) {
        await page.locator('[data-ls=mode]').selectOption('real');
        await model.waitFor({state: 'visible'});
        await model.screenshot({path: `${process.env.BROWSER_SCREENSHOT}-${track}-${lang}-${mobile ? 'mobile' : 'desktop'}.png`});
      }
    }
    snapshots.push(states);
    await context.close();
  }
  for (let i = 0; i < snapshots[0].length; i++) {
    const a = snapshots[1][i], b = snapshots[0][i];
    for (const key of Object.keys(b)) assert.deepEqual(a[key], b[key], `existing output parity: scenario ${i}, ${key}`);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({status: 'PASS', baselineAsset: production + asset, baselineSHA256: hash(shipped), scenarios: 9, csvComparisons: 3, checks: ['existing output parity', 'model lane labels', 'hide/show', 'shared cursor', 'CSV', 'manual fallback', 'desktop/mobile'], browserErrors: errors}));
} finally { await browser.close(); }
