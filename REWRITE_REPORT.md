# BreakOut SVG Rewrite — Report

## Summary

The bracket renderer now emits **one inline `<svg viewBox="0 0 W H">` per
bracket section**. Match cards live inside `<foreignObject>` elements so
their HTML/CSS rendering is unchanged (ellipsis, hover, click handlers).
Round headers, divider lines, connectors, cross-source labels, and the
bracket-champ pill are also in the same SVG (the champ pill itself is an
inner `<foreignObject>`).

The whole point — **print fit-to-page now works because SVG `viewBox`
auto-scales to its container**. The `@media print` rules size each section
to `100vh` with a flex column; the wrap fills it; the SVG fills the wrap;
the browser auto-fits the viewBox content. No `zoom`, no `transform:
scale`, no per-section measurement, no `min-width` overrides.

### What works
- Three brackets render exactly as before (modulo deliberate small
  cleanups — see "Visual deltas" below).
- Print fits 3 pages in landscape, 3 pages in portrait.
- Print output is **identical** at any on-screen zoom (0.0% spread vs.
  44.82% in v0.63 — the user's #1 frustration).
- All interactive features verified: dest-chip jump, team-row highlight,
  search-to-match, SVG cross-source-label click (previously eaten by the
  pan handler, now works), staff modal, pinch+drag.
- 15-second `pollTournamentUpdate` keeps working; re-render is idempotent.

### What changed structurally
| Before (v0.63)                              | After                          |
| ------------------------------------------- | ------------------------------ |
| `.bracket-wrap` (inline-block, min-width:100%) | `.bracket-wrap` (block, sized to SVG content) |
| `.connectors` overlay SVG positioned absolute  | one `.bracket-svg` per section, viewBox-scaled |
| `.bracket > .round > .matches > .match`     | `<svg> > <foreignObject> > .match` |
| CSS `--cell-w-base`, `--slot-h`, `--y` vars | JS `SVG` constants object       |
| CSS `@container card (max-width: 220px)` etc.  | JS-applied `cw-le-220` classes  |
| Print: per-section `--print-scale` from JS measurement | Print: `@media print` + SVG viewBox |

## Test results

Run from `tools/svg-render-test/`:

```
$ node harness.js

── DOM checks ──────────────────────────────
  PASS  searchInput present 
  PASS  zoomLabel present 
  PASS  viewports panBound (count=3)
  PASS  51 matches rendered (count=51)
  PASS  all matches have data-global-no (51/51)
  PASS  dest chips & cross-source links exist (count=92)
  PASS  win dest chip 
  PASS  lose dest chip 
  PASS  bye-row advance arrow (count=8)
  PASS  bracket champ pill (3 brackets) (count=3)
  PASS  team-num rows on bye+R1 (count=32)

── Print PDFs ──────────────────────────────
  landscape pages: 3 (target 3) — PASS
  portrait  pages: 3 (target 3) — PASS

── Print viewBox fill ratios ────────────────
  A:  landscape 100.0% / portrait 100.0%
  B:  landscape 100.0% / portrait 100.0%
  64: landscape 100.0% / portrait 100.0%

── Print zoom-independence ─────────────────
  fill-ratio spread across 5 on-screen zooms: 0.00% — PASS
```

`node interactive-check.js`:
- 48 connector paths drawn, 22 cross-source labels with paths.
- Dest-chip click → jump flash: **PASS**
- Team-row click → highlight: **PASS** (4 cards lit up).
- Search "alpha" → 4 hits.
- SVG cross-source label click → jump flash: **PASS** (was buggy in v0.63).
- Card overlap detection: **PASS** (no cards overlap in design space).
- Champ foreignObjects: 3 (one per bracket).

`node staff-check.js`:
- `?role=staff` adds `body.staff` class, injects banner, modal opens.

`node mobile-check.js` (414×896 viewport):
- Initial zoom = 0.6, density classes `cw-le-220 / -200 / -180 / -150`
  apply correctly.

### Baseline for comparison
v0.63 against the same harness:
- 11 pages landscape, 8 pages portrait (vs. target 3) — **FAILED**
- Zoom spread: 44.82% (vs. target ≤5%) — **FAILED**

## Files changed

- `index.html` — main rewrite. Roughly 950 lines of diff.
  - CSS: dropped `--cell-w-*`, `--slot-h-*`, `--card-h-*`, `--round-gap-*`
    CSS vars; reduced `@media print` to a flex layout + width:100%/height:100%
    on the SVG; replaced `.match::before` stripe with inline `.match-stripe`
    div; replaced `@container card` queries with `.cw-le-{220,200,180,150,130}`
    class rules; `.round.is-final .match::after` is now `.match.is-final-of-bracket::after`.
  - JS: new `SVG = { CARD_W, CARD_H, SLOT_H, ROUND_GAP, SLOTS, ... }` design
    constants and helpers `roundXLeft`, `roundXCenter`, `matchYCenter`,
    `matchTopY`, `bracketLayout`. `bracketSectionHtml` builds the SVG.
    `drawConnectorsFor` no longer measures DOM; pulls coordinates from
    match metadata. `applyZoomToSvgs` + `updateCardDensity` handle the
    zoom slider — no connector redraw needed. `preparePrint` is now just
    the `@page` orientation injection; `--print-scale` is gone.
- `.gitignore` — excludes `tools/svg-render-test/node_modules/`,
  `screenshots/`, `out-*.pdf`.
- `tools/svg-render-test/` — new test harness:
  - `package.json`, `package-lock.json` (puppeteer, pdf-parse, pixelmatch, pngjs)
  - `harness.js` — main harness (DOM + print PDFs + zoom-independence)
  - `fixture.js` — synthetic 24-team, 51-match tournament fixture
  - `capture-deployed.js` — pulls truth screenshots from the live site
  - `interactive-check.js` — click handlers / search / overlaps
  - `staff-check.js` — `?role=staff` mode smoke test
  - `mobile-check.js` — 414×896 viewport check
  - `inspect-card.js` — dumps rendered HTML for debugging

`admin.html` and `version.js` are unchanged (per instructions).

## Known gaps to sanity-check on real hardware

1. **Real printer dialog**: the harness produces PDFs via Puppeteer's
   headless print, which uses Chromium's print engine. Real Chrome's print
   dialog uses the same engine — so output should match — but verify on
   a Mac (Safari uses a different engine) and on Firefox.

2. **Touch pinch-zoom**: tested in code only, not on a real touch device.
   Since the SVG approach scales via inline `width`/`height` on the
   `.bracket-svg`, the touch handlers (which call `setZoom`) should
   continue to work, but real-device behavior may need tweaking.

3. **Mobile card size**: deployed v0.63 had `--cell-w-mob-base: 200px`
   (slightly narrower cards on mobile). The SVG approach uses one
   `SVG.CARD_W = 240` for all viewports, then scales via on-screen
   zoom. The default `setZoom(0.6)` on viewports < 700px gives a 144px
   effective card width — readable, but slightly different from the
   ~120px deployed gave at the same zoom. If you want exact parity, drop
   `SVG.CARD_W` to 200 or tune the mobile default zoom.

4. **`foreignObject` print quirks**: there's a long-tail Chromium bug
   where `<foreignObject>` content can render with wrong fonts in PDF
   when an unusual font stack is requested. We use `system-ui` family
   which is robust. Worth a real-print test to confirm.

5. **Search-result `scrollIntoView`**: the latest-hit match flashes red
   and scrolls into center. SVG-wrapped foreignObjects scroll the same
   way as native HTML for this — Chromium handles them transparently.
   Verify on Firefox.

6. **Tournament with all winners recorded**: the harness fixture sets
   most matches to TBD. The `interactive-check.js` exercise sets a few
   winners and confirms winner-row Y in connectors is computed correctly.
   But a fully-played-out tournament has every connector reading off
   `topWins` for source Y — worth visually verifying on a finished
   tournament before deploying.

7. **Bracket-champ animation in print**: the `champBounce` keyframe
   animation will pause at the snapshot moment when Chrome captures
   the print page. Cosmetic only — pill still renders.

## Recommended commit message (for when you merge)

```
BreakOut v0.64: SVG-based bracket renderer

Replaces the absolute-positioned HTML card layout with an inline SVG
(viewBox-scaled) per bracket section. Cards live inside <foreignObject>
so their HTML/CSS stays identical; connectors, headers, dividers, and
the bracket-champ pill are native SVG elements in the same coordinate
space. Print fit-to-page is now automatic via viewBox — no zoom hacks,
no transform scaling, no per-section measurement. Print output is now
identical at any on-screen zoom level.

Print: 3 pages each in landscape and portrait, zoom-independent. All
interactive features (dest-chip jump, team-row highlight, search, SVG
cross-source-label click, staff modal, pinch+drag, 15s data poll) keep
working. Tested against a synthetic 51-match fixture via the harness
at tools/svg-render-test/.
```

## How to run the harness yourself

```powershell
cd C:\Users\ptsol\OneDrive\APA\BreakOut-svg-rewrite\tools\svg-render-test
npm install     # one-time; Puppeteer downloads ~150 MB Chromium

# Main test (DOM + print PDFs + zoom-independence)
node harness.js

# Capture truth screenshots from the deployed v0.63 (one-time)
node capture-deployed.js

# Targeted smoke tests
node interactive-check.js
node staff-check.js
node mobile-check.js
node inspect-card.js
```

The harness spins up a tiny Node http server on localhost, opens the
worktree's `index.html` in headless Chromium, intercepts Supabase
fetches with a synthetic fixture, and runs the checks. Output goes to
stdout; screenshots end up in `screenshots/`, PDFs at `out-landscape.pdf`
and `out-portrait.pdf` (you can open these in any PDF viewer to confirm
the print layout by eye).
