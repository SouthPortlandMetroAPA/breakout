// Tests for apa-bye.js — verifies BYE-placement helper against the chart
// data. Run: node test.mjs

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const chartPath = path.resolve(__dirname, '..', '..', 'apa-bye-chart.json');
const chart = JSON.parse(readFileSync(chartPath, 'utf8'));

// Load the helper as a CommonJS module via dynamic require shim.
const helperSrc = readFileSync(path.resolve(__dirname, '..', '..', 'apa-bye.js'), 'utf8');
const sandbox = { module: { exports: {} } };
new Function('module', 'globalThis', helperSrc)(sandbox.module, sandbox);
const { applyByes } = sandbox.module.exports;

let pass = 0, fail = 0;
function assert(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error('  ❌ ' + msg); }
}
function jsonEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

console.log('--- 32-chart, 24 teams (8 BYEs) ---');
{
  const r = applyByes(32, 24, chart);
  assert(jsonEq(r.byeSlots, [32, 16, 24, 8, 28, 12, 20, 4]),
    '32/24 BYE slots wrong: ' + JSON.stringify(r.byeSlots));
  assert(r.teamSlots.length === 24, '32/24 teamSlots length: ' + r.teamSlots.length);
  // Team slots should be all 1..32 minus the BYEs.
  const expectedTeams = [];
  const byeSet = new Set([32, 16, 24, 8, 28, 12, 20, 4]);
  for (let i = 1; i <= 32; i++) if (!byeSet.has(i)) expectedTeams.push(i);
  assert(jsonEq(r.teamSlots, expectedTeams), '32/24 teamSlots content wrong');
}

console.log('--- 32-chart, 32 teams (0 BYEs) ---');
{
  const r = applyByes(32, 32, chart);
  assert(r.byeSlots.length === 0, '32/32 should have 0 BYEs');
  assert(r.teamSlots.length === 32 && r.teamSlots[0] === 1 && r.teamSlots[31] === 32,
    '32/32 teamSlots should be [1..32]');
}

console.log('--- 32-chart, 16 teams (16 BYEs) ---');
{
  const r = applyByes(32, 16, chart);
  assert(r.byeSlots.length === 16, '32/16 should have 16 BYEs');
  // First BYE is 32, last in this prefix is the 16th value in the 32-chart list.
  assert(r.byeSlots[0] === 32 && r.byeSlots[15] === 2,
    '32/16 BYE prefix wrong: ' + JSON.stringify(r.byeSlots));
}

console.log('--- 64-chart, 41 teams (23 BYEs) — matches SPM Tri-Annuals ---');
{
  const r = applyByes(64, 41, chart);
  assert(r.byeSlots.length === 23, '64/41 should have 23 BYEs');
  // First few should be [64, 32, 48, 16, ...]
  assert(r.byeSlots[0] === 64 && r.byeSlots[1] === 32 && r.byeSlots[2] === 48 && r.byeSlots[3] === 16,
    '64/41 BYE prefix wrong: ' + JSON.stringify(r.byeSlots.slice(0, 4)));
}

console.log('--- 16-chart, 9 teams (7 BYEs) ---');
{
  const r = applyByes(16, 9, chart);
  assert(jsonEq(r.byeSlots, [16, 8, 12, 4, 14, 6, 10]),
    '16/9 BYE slots wrong: ' + JSON.stringify(r.byeSlots));
  assert(r.teamSlots.length === 9, '16/9 teamSlots length');
}

console.log('--- Error case: teamCount > chartSize ---');
{
  let threw = false;
  try { applyByes(32, 33, chart); } catch (_) { threw = true; }
  assert(threw, 'should throw when teamCount > chartSize');
}

console.log('--- Error case: chartSize not in chart ---');
{
  let threw = false;
  try { applyByes(100, 50, chart); } catch (_) { threw = true; }
  assert(threw, 'should throw for unknown chartSize 100');
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
