#!/usr/bin/env node
/* Capture screenshots of the deployed v0.63 site at the same zoom levels
 * as the harness uses, for ground-truth comparison. */
'use strict';

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const SHOTS = path.resolve(__dirname, 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
const ZOOMS = [0.4, 0.7, 1.0, 1.3, 1.5];
const URL = 'https://southportlandmetroapa.github.io/breakout/';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('[pageerror]', e.message));

  try {
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('.match').length >= 51,
      { timeout: 30000 });
    await new Promise(r => setTimeout(r, 1500));
    for (const z of ZOOMS) {
      await page.evaluate((zz) => {
        window.setZoom && window.setZoom(zz);
        document.documentElement.style.setProperty('--zoom', String(zz));
      }, z);
      await new Promise(r => setTimeout(r, 600));
      await page.screenshot({ path: path.join(SHOTS, `truth-z${Math.round(z*100)}.png`),
        fullPage: true });
      console.log('  captured truth-z' + Math.round(z*100));
    }
  } catch (e) {
    console.error('Failed:', e.message);
  } finally {
    await browser.close();
  }
})();
