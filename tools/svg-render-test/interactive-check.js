#!/usr/bin/env node
/* Extra interactive checks: click handlers, jump-to-match, highlight. */
'use strict';

const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer');
const fixture = require('./fixture');

const ROOT = path.resolve(__dirname, '..', '..');
const PORT = 38212;

function mime(p) {
  if (p.endsWith('.html')) return 'text/html; charset=utf-8';
  if (p.endsWith('.js'))   return 'application/javascript; charset=utf-8';
  return 'application/octet-stream';
}
function startServer() {
  const srv = http.createServer((req, res) => {
    let rel = decodeURIComponent(req.url.split('?')[0]);
    if (rel === '/' || rel === '') rel = '/index.html';
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.statusCode = 403; res.end('forbidden'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.statusCode = 404; res.end(rel); return; }
      res.setHeader('Content-Type', mime(file));
      res.end(buf);
    });
  });
  return new Promise(r => srv.listen(PORT, '127.0.0.1', () => r(srv)));
}
function installInterceptors(page) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*'
  };
  return page.setRequestInterception(true).then(() => {
    const teamsJson = JSON.stringify(fixture.buildTeams());
    const row = fixture.buildTournamentRow();
    // Mark a couple of winners so winner-side connectors are exercised.
    const wins = [
      { id: 'A-R1-M1', side: 'top' },
      { id: 'A-R2-M1', side: 'top' },
      { id: 'A-R3-M1', side: 'top' },
      { id: 'A-R4-M1', side: 'bot' },
      { id: 'B-R1-M1', side: 'bot' }
    ];
    for (const w of wins) {
      const m = row.matches.find(x => x.id === w.id);
      if (m) m.winner_side = w.side;
    }
    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('supabase.co')) {
        if (req.method() === 'OPTIONS') return req.respond({ status: 204, headers: corsHeaders, body: '' });
        if (url.includes('/teams')) return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: teamsJson });
        if (url.includes('/tournaments')) {
          if (url.includes('updated_at')) return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify([{ id: row.id, updated_at: row.updated_at }]) });
          return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify([row]) });
        }
        if (url.includes('/apps')) return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: JSON.stringify([{ version: '0.63' }]) });
        return req.respond({ status: 200, headers: corsHeaders, contentType: 'application/json', body: '[]' });
      }
      return req.continue();
    });
  });
}

(async () => {
  const srv = await startServer();
  let exit = 0;
  try {
    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await installInterceptors(page);
    page.on('pageerror', e => console.error('[pageerror]', e.message));
    page.on('console', msg => {
      if (msg.type() === 'error') console.log('[console.error]', msg.text());
    });
    await page.goto('http://127.0.0.1:' + PORT + '/index.html?t=test-fixture', { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.querySelectorAll('[data-match-id]').length === 51, { timeout: 20000 });
    await new Promise(r => setTimeout(r, 600));

    // 1. Connectors are drawn: count <path> in connectors-layer.
    const stats = await page.evaluate(() => {
      const conn = Array.from(document.querySelectorAll('.connectors-layer path')).length;
      const cross = Array.from(document.querySelectorAll('.cross-source-layer text')).length;
      const crossPaths = Array.from(document.querySelectorAll('.cross-source-layer path')).length;
      return { conn, cross, crossPaths };
    });
    console.log('Connector paths:', stats.conn,
      '\nCross-source labels:', stats.cross,
      '\nCross-source paths:', stats.crossPaths);

    // 2. Click on a dest chip — jumps to target match (scroll + flash class)
    await page.evaluate(() => {
      const chip = document.querySelector('.dest-chip.win[data-jump]');
      chip && chip.click();
    });
    await new Promise(r => setTimeout(r, 600));
    const flashed = await page.evaluate(() =>
      document.querySelectorAll('.match.match-jump-flash').length);
    console.log('Dest-chip click → jump flash:', flashed > 0 ? 'PASS' : 'FAIL', '(' + flashed + ')');

    // 3. Click on a team row — should add highlight-* class to match cards
    await page.evaluate(() => {
      const row = document.querySelector('.match-row[data-team-num]');
      row && row.click();
    });
    await new Promise(r => setTimeout(r, 300));
    const highlightCount = await page.evaluate(() =>
      document.querySelectorAll('.match.highlight-win, .match.highlight-loss, .match.highlight-pending').length);
    console.log('Team-row click → highlight:', highlightCount > 0 ? 'PASS' : 'FAIL', '(' + highlightCount + ')');

    // 4. Search — types into searchInput and checks for .match-hit-latest
    await page.evaluate(() => {
      const si = document.getElementById('searchInput');
      si.value = 'alpha';
      si.dispatchEvent(new Event('input'));
    });
    await new Promise(r => setTimeout(r, 400));
    const searchHits = await page.evaluate(() =>
      document.querySelectorAll('.match.match-hit, .match.match-hit-latest').length);
    console.log('Search "alpha":', searchHits > 0 ? 'PASS' : 'FAIL', '(' + searchHits + ' hits)');

    // 5. SVG cross-source link — click should also jump
    await page.evaluate(() => {
      const txt = document.querySelector('.cross-source-link[data-jump]');
      if (txt) {
        // SVG <text> needs a real click — synthesize via dispatching
        const evt = new MouseEvent('click', { bubbles: true, cancelable: true });
        txt.dispatchEvent(evt);
      }
    });
    await new Promise(r => setTimeout(r, 400));
    const flashed2 = await page.evaluate(() =>
      document.querySelectorAll('.match.match-jump-flash').length);
    console.log('Cross-source-label click → jump flash:', flashed2 > 0 ? 'PASS' : 'FAIL');

    // 6. Inspect a card's bounding rect to make sure they don't overlap.
    const overlaps = await page.evaluate(() => {
      const rects = Array.from(document.querySelectorAll('foreignObject.card-fo')).map(f => {
        const m = f.getAttribute('data-match-fo');
        const x = parseFloat(f.getAttribute('x'));
        const y = parseFloat(f.getAttribute('y'));
        const w = parseFloat(f.getAttribute('width'));
        const h = parseFloat(f.getAttribute('height'));
        return { m, x, y, w, h };
      });
      // Bucket by bracket prefix
      const buckets = {};
      for (const r of rects) {
        const k = r.m.split('-')[0];
        (buckets[k] = buckets[k] || []).push(r);
      }
      const overlaps = [];
      for (const bucket of Object.values(buckets)) {
        for (let i = 0; i < bucket.length; i++) {
          for (let j = i + 1; j < bucket.length; j++) {
            const a = bucket[i], b = bucket[j];
            const xOver = !(a.x + a.w <= b.x || b.x + b.w <= a.x);
            const yOver = !(a.y + a.h <= b.y || b.y + b.h <= a.y);
            if (xOver && yOver) overlaps.push(a.m + ' <> ' + b.m);
          }
        }
      }
      return overlaps;
    });
    console.log('Card overlaps:', overlaps.length === 0 ? 'PASS' : 'FAIL', overlaps.slice(0, 5));

    // 7. Verify foreignObject champ rendering
    const champCount = await page.evaluate(() =>
      document.querySelectorAll('foreignObject.champ-fo').length);
    console.log('Champ foreignObjects (target 3):', champCount === 3 ? 'PASS' : 'FAIL', '(' + champCount + ')');

    await browser.close();
  } catch (e) {
    console.error('Failure:', e.stack);
    exit = 1;
  } finally {
    srv.close();
    process.exit(exit);
  }
})();
