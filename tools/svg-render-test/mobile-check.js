#!/usr/bin/env node
/* Quick mobile-viewport render check. */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer');
const fixture = require('./fixture');
const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 38215;

function startServer() {
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/' || rel === '') rel = '/index.html';
    const f = path.join(ROOT, rel);
    fs.readFile(f, (err, buf) => {
      if (err) { res.statusCode = 404; res.end(''); return; }
      res.setHeader('Content-Type', f.endsWith('.js') ? 'application/javascript' : 'text/html');
      res.end(buf);
    });
  });
  return new Promise(r => srv.listen(PORT, '127.0.0.1', () => r(srv)));
}
function intercept(page) {
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' };
  return page.setRequestInterception(true).then(() => {
    const teams = JSON.stringify(fixture.buildTeams());
    const row = fixture.buildTournamentRow();
    page.on('request', req => {
      const url = req.url();
      if (url.includes('supabase.co')) {
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: cors, body: '' });
        if (url.includes('/teams')) return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: teams });
        if (url.includes('/tournaments')) return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([row]) });
        if (url.includes('/apps')) return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{ version: '0.63' }]) });
        return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: '[]' });
      }
      return req.continue();
    });
  });
}

(async () => {
  const srv = await startServer();
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 414, height: 896, deviceScaleFactor: 2, isMobile: true });
  await intercept(page);
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html?t=test', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('[data-match-id]').length === 51, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 800));
  const SHOTS = path.resolve(__dirname, 'screenshots');
  await page.screenshot({ path: path.join(SHOTS, 'mobile-z60.png'), fullPage: true });

  // Verify default zoom for mobile = 0.6
  const z = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--zoom').trim());
  console.log('Mobile initial --zoom:', z);

  // Check the density classes
  const sample = await page.evaluate(() => {
    const m = document.querySelector('.match');
    return m ? Array.from(m.classList).filter(c => c.startsWith('cw-')) : [];
  });
  console.log('Sample match density classes:', sample);

  await browser.close();
  srv.close();
})();
