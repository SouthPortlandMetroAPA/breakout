#!/usr/bin/env node
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer');
const fixture = require('./fixture');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 38213;

function startServer() {
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.join(ROOT, rel);
    fs.readFile(file, (err, buf) => {
      if (err) { res.statusCode = 404; res.end(''); return; }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : 'text/html');
      res.end(buf);
    });
  });
  return new Promise(r => srv.listen(PORT, '127.0.0.1', () => r(srv)));
}
function installInterceptors(page) {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' };
  return page.setRequestInterception(true).then(() => {
    const teams = JSON.stringify(fixture.buildTeams());
    const row = fixture.buildTournamentRow();
    page.on('request', req => {
      const url = req.url();
      if (url.includes('supabase.co')) {
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: corsHeaders, body: '' });
        if (url.includes('/teams'))     return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: teams });
        if (url.includes('/tournaments')) {
          if (url.includes('updated_at')) return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify([{ id: row.id, updated_at: row.updated_at }]) });
          return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify([row]) });
        }
        if (url.includes('/apps'))      return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify([{ version: '0.63' }]) });
        return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: '[]' });
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
  await installInterceptors(page);
  await page.goto('http://127.0.0.1:' + PORT + '/index.html?t=test', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelectorAll('[data-match-id]').length === 51, { timeout: 15000 });
  await new Promise(r => setTimeout(r, 500));

  const html = await page.evaluate(() => {
    const m = document.querySelector('.match[data-global-no="2"]');
    return m ? m.outerHTML : 'not found';
  });
  console.log('=== Match M2 outerHTML ===');
  console.log(html);

  const bye = await page.evaluate(() => {
    const m = document.querySelector('.match.bye');
    return m ? m.outerHTML : 'no bye';
  });
  console.log('\n=== Bye match outerHTML ===');
  console.log(bye);

  // Get computed styles for a card to see if the stripe is showing
  const stripeStyle = await page.evaluate(() => {
    const stripe = document.querySelector('.match[data-global-no="2"] .match-stripe');
    if (!stripe) return 'no stripe';
    const cs = getComputedStyle(stripe);
    return { background: cs.backgroundColor, width: cs.width, position: cs.position };
  });
  console.log('\nStripe styles:', stripeStyle);

  const bbox = await page.evaluate(() => {
    const card = document.querySelector('.match[data-global-no="2"]');
    if (!card) return null;
    const r = card.getBoundingClientRect();
    return { w: r.width, h: r.height, top: r.top, left: r.left };
  });
  console.log('\nCard bbox:', bbox);

  await browser.close();
  srv.close();
})();
