#!/usr/bin/env node
/* Verify staff mode opens the score modal on match click. */
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer');
const fixture = require('./fixture');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 38214;

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
        if (url.includes('/tournaments')) {
          if (url.includes('updated_at')) return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([{ id: row.id, updated_at: row.updated_at }]) });
          return req.respond({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify([row]) });
        }
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
  await page.setViewport({ width: 1440, height: 900 });
  await intercept(page);
  page.on('pageerror', e => console.error('[pageerror]', e.message));
  await page.goto('http://127.0.0.1:' + PORT + '/index.html?role=staff&key=fake-staff-key&t=test', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('[data-match-id]').length === 51, { timeout: 20000 });
  await new Promise(r => setTimeout(r, 600));

  const bodyClass = await page.evaluate(() => document.body.classList.contains('staff'));
  console.log('body.staff class:', bodyClass ? 'PASS' : 'FAIL');

  const bannerVisible = await page.evaluate(() => !!document.querySelector('.staff-banner'));
  console.log('staff banner present:', bannerVisible ? 'PASS' : 'FAIL');

  // Click on a non-bye match (M2 — a real round-1 with teams)
  await page.evaluate(() => {
    const m = document.querySelector('.match[data-global-no="2"]:not(.bye)');
    if (m) m.click();
  });
  await new Promise(r => setTimeout(r, 400));
  const modalShown = await page.evaluate(() =>
    document.getElementById('staffModal').classList.contains('shown'));
  console.log('Click match → staff modal:', modalShown ? 'PASS' : 'FAIL');

  const modalTitle = await page.evaluate(() =>
    document.getElementById('staffModalMno').textContent);
  console.log('Modal title:', modalTitle);

  await browser.close();
  srv.close();
})();
