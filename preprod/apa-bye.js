/* ════════════════════════════════════════════════════════════════════════
   apa-bye.js — helper for applying APA's BYE placement chart.

   The chart data lives in apa-bye-chart.json (verbatim from APA). This
   module is the runtime consumer: given a chart size and a team count,
   it returns which slot positions get a BYE, in priority order.

   Usage (after fetching apa-bye-chart.json into APA_BYE_CHART):
     applyByes(32, 24, APA_BYE_CHART)
       => { byeSlots: [32, 16, 24, 8, 28, 12, 20, 4], teamSlots: [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15, 17, 18, 19, 21, 23, 25, 26, 27, 29, 31] }

   Notes:
     - Slot numbers are 1-based to match APA's published charts.
     - "Modified" chart sizes (12, 24, 48, 96) reuse the BYE list of their
       base size (4, 8, 16, 32). The chart JSON already represents this.
     - If team_count >= chart_size, no BYEs are awarded (returns empty).
     - If team_count < chart_size - (BYE list length), there are more BYEs
       than the chart's published positions can accommodate — that's a
       structural mismatch with APA's tables; we throw rather than guess.

   No external deps. Safe to load directly in browser or import in Node.
   ════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';

  function applyByes(chartSize, teamCount, chart) {
    if (!chart) throw new Error('apa-bye: chart data missing');
    const key = String(chartSize);
    const byeOrder = chart[key];
    if (!Array.isArray(byeOrder)) {
      throw new Error('apa-bye: chart size ' + chartSize + ' not in chart data');
    }
    if (teamCount > chartSize) {
      throw new Error('apa-bye: teamCount ' + teamCount + ' > chartSize ' + chartSize);
    }
    const byeCount = chartSize - teamCount;
    if (byeCount < 0) {
      return { byeSlots: [], teamSlots: range1(chartSize) };
    }
    if (byeCount > byeOrder.length) {
      throw new Error('apa-bye: need ' + byeCount + ' BYEs but chart only lists '
        + byeOrder.length + ' positions for size ' + chartSize);
    }
    const byeSlots = byeOrder.slice(0, byeCount);
    const byeSet = new Set(byeSlots);
    const teamSlots = [];
    for (let i = 1; i <= chartSize; i++) {
      if (!byeSet.has(i)) teamSlots.push(i);
    }
    return { byeSlots, teamSlots };
  }

  function range1(n) {
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = i + 1;
    return out;
  }

  /* Convenience: load the chart JSON from the same origin. Returns the
     parsed object. Used by browser callers; Node callers should fs-read
     the JSON themselves. */
  function loadChart(url) {
    url = url || 'apa-bye-chart.json';
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('apa-bye: fetch ' + r.status);
      return r.json();
    });
  }

  const api = { applyByes, loadChart };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    global.APA_BYE = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
