#!/usr/bin/env node
/**
 * cursorfit — browser verification
 *
 * The grep list in references/gating.md proves the code *says* the right things. It cannot
 * prove the cursor behaves. This script opens the page and tries to break it the way a
 * visitor would: it moves the mouse, hovers a control, taps, asks for reduced motion, and
 * clicks through the cursor to see whether the click actually lands.
 *
 *   node scripts/verify.mjs http://localhost:3000
 *   node scripts/verify.mjs http://localhost:3000 --cursor .cf-cursor --hover "a[href], button"
 *   node scripts/verify.mjs http://localhost:3000 --json verify.json --headed
 *
 * Requires Playwright. It is the skill's only optional dependency, and it is only needed for
 * this script — the audit and every recipe stay dependency-free.
 *
 *   npm i -D playwright && npx playwright install chromium
 *
 * Exit code 0 = every check passed, 1 = something failed, 2 = could not run.
 */

import { writeFile } from 'node:fs/promises';

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(name);

const url = argv.find((a) => /^https?:\/\//.test(a));
const selector = flag('--cursor', '.cf-cursor');
const hoverSel = flag('--hover', 'a[href], button, [role="button"]');
const jsonPath = flag('--json');
const headed = has('--headed');

if (!url) {
  console.error('usage: node scripts/verify.mjs <url> [--cursor .cf-cursor] [--hover "a, button"] [--json out.json] [--headed]');
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = await import('playwright-core'));
  } catch {
    console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
    process.exit(2);
  }
}

const results = [];
const record = (name, status, detail) => {
  results.push({ name, status, detail });
  const mark = status === 'pass' ? 'PASS' : status === 'fail' ? 'FAIL' : 'SKIP';
  console.log(`${mark.padEnd(5)} ${name.padEnd(18)} ${detail}`);
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A cursor element's real position on screen. Reading the transform is not enough: the
// recipe uses translate3d + translate(-50%,-50%), and a site may use left/top instead.
const centreOf = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: r.left + r.width / 2,
      y: r.top + r.height / 2,
      w: r.width,
      h: r.height,
      opacity: parseFloat(cs.opacity),
      visibility: cs.visibility,
      display: cs.display,
      pointerEvents: cs.pointerEvents,
      zIndex: cs.zIndex,
    };
  }, sel);

const visible = (c) => c && c.opacity > 0.05 && c.visibility !== 'hidden' && c.display !== 'none' && c.w > 0;

const stateOf = (page, sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    const mark = el.querySelector('[class*="mark"], span, div') || el;
    return {
      dataState: el.getAttribute('data-state'),
      dataVisible: el.getAttribute('data-visible'),
      className: el.className,
      markTransform: getComputedStyle(mark).transform,
      markBackground: getComputedStyle(mark).backgroundColor,
      markOpacity: getComputedStyle(mark).opacity,
    };
  }, sel);

const consoleErrors = [];
const pageErrors = [];

// Bundled Chromium is the default, but it is a 150MB download many people never make. Fall
// back to the browser already on the machine before telling anyone to install anything.
async function launch() {
  const attempts = [
    ['bundled chromium', {}],
    ['Microsoft Edge', { channel: 'msedge' }],
    ['Google Chrome', { channel: 'chrome' }],
  ];
  const errors = [];
  for (const [label, opts] of attempts) {
    try {
      const b = await chromium.launch({ headless: !headed, ...opts });
      if (label !== 'bundled chromium') console.log(`using ${label}\n`);
      return b;
    } catch (e) {
      errors.push(`${label}: ${String(e.message).split('\n')[0]}`);
    }
  }
  console.error('Could not launch a browser.\n' + errors.join('\n'));
  console.error('\nRun: npx playwright install chromium');
  process.exit(2);
}

const browser = await launch();

try {
  // ---------------------------------------------------------------- desktop context
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();

  page.on('console', (m) => {
    // A missing favicon is not a cursor bug. Everything else is.
    const where = m.location()?.url || '';
    if (m.type() === 'error' && !/favicon/.test(m.text() + where)) consoleErrors.push(`${m.text()} ${where}`.trim());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await page.goto(url, { waitUntil: 'load', timeout: 45000 });
  await sleep(400);

  // 1. does the element exist at all
  const first = await centreOf(page, selector);
  if (!first) {
    record('element', 'fail', `no element matches "${selector}" — pass --cursor with the real selector`);
  } else {
    record('element', 'pass', `found, ${Math.round(first.w)}×${Math.round(first.h)}px, z-index ${first.zIndex}`);
  }

  // 2. it must not eat clicks
  if (!first) {
    record('pointer-events', 'skip', 'no element to inspect');
  } else if (first.pointerEvents === 'none') {
    record('pointer-events', 'pass', 'pointer-events: none');
  } else {
    record('pointer-events', 'fail', `pointer-events is "${first.pointerEvents}" — the cursor will swallow every click`);
  }

  // 3. it appears and follows with lag, then converges
  let follows = false;
  if (first) {
    await page.mouse.move(683, 384);
    await sleep(60);
    await page.mouse.move(900, 500);
    await sleep(24);
    const early = await centreOf(page, selector);
    await sleep(700);
    const settled = await centreOf(page, selector);

    if (!visible(settled) && !visible(early)) {
      record('follow', 'fail', 'element never became visible after a mouse move');
    } else {
      const lag = early ? Math.hypot(early.x - 900, early.y - 500) : 999;
      const settle = settled ? Math.hypot(settled.x - 900, settled.y - 500) : 999;
      follows = settle < 4;
      record(
        'follow',
        follows ? 'pass' : 'fail',
        `lag 24ms after a 217px jump: ${Math.round(lag)}px · after 700ms: ${Math.round(settle)}px`
      );
    }
  }

  // 4. hover on a real control changes something
  if (!first) {
    record('hover-state', 'skip', 'no element to inspect');
  } else {
    const target = await page.evaluate((s) => {
      const els = [...document.querySelectorAll(s)].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 4 && r.height > 4 && getComputedStyle(e).visibility !== 'hidden';
      });
      const e = els[0];
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, tag: e.tagName.toLowerCase() };
    }, hoverSel);

    if (!target) {
      record('hover-state', 'skip', `no visible control matches "${hoverSel}"`);
    } else {
      const before = await stateOf(page, selector);
      await page.mouse.move(target.x, target.y);
      await sleep(500);
      const after = await stateOf(page, selector);

      const diffs = [];
      if (before && after) {
        if (before.dataState !== after.dataState) diffs.push(`data-state ${before.dataState || 'none'} → ${after.dataState || 'none'}`);
        if (before.markTransform !== after.markTransform) diffs.push('mark transform changed');
        if (before.markBackground !== after.markBackground) diffs.push('mark colour changed');
        if (before.className !== after.className) diffs.push('class changed');
      }
      const changed = diffs.length > 0;
      record(
        'hover-state',
        changed ? 'pass' : 'fail',
        changed
          ? `on <${target.tag}>: ${diffs.join(', ')}`
          : `nothing changed over <${target.tag}> — no state hook, or the cursor ignores controls`
      );
    }
  }

  // 5. a click under the cursor still reaches the control
  if (!first) {
    record('click-through', 'skip', 'no element to inspect');
  } else {
    const target = await page.evaluate((s) => {
      const e = [...document.querySelectorAll(s)].find((x) => {
        const r = x.getBoundingClientRect();
        return r.width > 4 && r.height > 4;
      });
      if (!e) return null;
      const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, hoverSel);

    if (!target) {
      record('click-through', 'skip', `no visible control matches "${hoverSel}"`);
    } else {
      await page.evaluate(() => {
        window.__cfHits = 0;
        document.addEventListener(
          'click',
          (e) => {
            window.__cfHits += 1;
            e.preventDefault(); // keep the page still; we only need to know the click landed
            e.stopPropagation();
          },
          { capture: true }
        );
      });
      await page.mouse.move(target.x, target.y);
      await sleep(350);
      await page.mouse.down();
      await page.mouse.up();
      await sleep(120);
      const hits = await page.evaluate(() => window.__cfHits);
      record('click-through', hits === 1 ? 'pass' : 'fail', `${hits} click event(s) reached the page`);
    }
  }

  // 6. a route change must not spawn a second cursor
  if (!first) {
    record('route-change', 'skip', 'no element to inspect');
  } else {
    const beforeCount = await page.evaluate((s) => document.querySelectorAll(s).length, selector);
    await page.evaluate(() => {
      history.pushState({}, '', location.pathname + '?cfroute=1');
      history.back();
    });
    await sleep(500);
    const afterCount = await page.evaluate((s) => document.querySelectorAll(s).length, selector);
    record(
      'route-change',
      afterCount === beforeCount ? 'pass' : 'fail',
      `${beforeCount} instance(s) → ${afterCount} after pushState + back`
    );
  }

  // 7. console must stay clean
  record(
    'console',
    consoleErrors.length === 0 && pageErrors.length === 0 ? 'pass' : 'fail',
    consoleErrors.length + pageErrors.length === 0
      ? 'no errors'
      : [...consoleErrors, ...pageErrors].slice(0, 3).join(' | ')
  );

  await ctx.close();

  // ---------------------------------------------------------------- touch context
  const touchCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const touchPage = await touchCtx.newPage();
  await touchPage.goto(url, { waitUntil: 'load', timeout: 45000 });
  await sleep(300);

  const beforeTap = await centreOf(touchPage, selector);
  await touchPage.touchscreen.tap(195, 420);
  await sleep(400);
  const afterTap = await centreOf(touchPage, selector);

  if (!afterTap) {
    record('touch', 'skip', 'no cursor element in the DOM');
  } else if (visible(afterTap) && !visible(beforeTap)) {
    record('touch', 'fail', 'the cursor appeared after a tap — no coarse-pointer guard');
  } else {
    record('touch', 'pass', `element present but ${visible(afterTap) ? 'inert' : 'hidden'} (opacity ${afterTap.opacity})`);
  }
  await touchCtx.close();

  // ---------------------------------------------------------------- reduced motion
  const rmCtx = await browser.newContext({ viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const rmPage = await rmCtx.newPage();
  await rmPage.goto(url, { waitUntil: 'load', timeout: 45000 });
  await sleep(300);

  const rmFirst = await centreOf(rmPage, selector);
  if (!rmFirst) {
    record('reduced-motion', 'skip', 'no cursor element in the DOM');
  } else {
    await rmPage.mouse.move(683, 384);
    await sleep(120);
    const rmStart = await centreOf(rmPage, selector);
    if (!visible(rmStart)) {
      record('reduced-motion', 'skip', 'cursor did not appear at the start point — nothing to measure');
    } else {
      await rmPage.mouse.move(823, 454);
      await sleep(30);
      const rmEarly = await centreOf(rmPage, selector);
      await sleep(400);
      const rmSettled = await centreOf(rmPage, selector);

      if (!visible(rmSettled) && !visible(rmEarly)) {
        record('reduced-motion', 'pass', 'cursor is not drawn at all under prefers-reduced-motion');
      } else if (!visible(rmEarly)) {
        record('reduced-motion', 'skip', 'cursor left its visible area during the move — cannot measure the follow');
      } else {
        const jump = Math.hypot(rmEarly.x - 823, rmEarly.y - 454);
        record(
          'reduced-motion',
          jump < 6 ? 'pass' : 'fail',
          jump < 6
            ? `snaps to the pointer in under 30ms (${Math.round(jump)}px behind)`
            : `still lagging ${Math.round(jump)}px at 30ms — the follow animation is not disabled`
        );
      }
    }
  }
  await rmCtx.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => r.status === 'fail');
const skipped = results.filter((r) => r.status === 'skip');

console.log('');
console.log(`${results.length - failed.length - skipped.length} passed · ${failed.length} failed · ${skipped.length} skipped`);

if (jsonPath) {
  await writeFile(
    jsonPath,
    JSON.stringify(
      { url, selector, generatedAt: new Date().toISOString(), checks: results, failed: failed.length },
      null,
      2
    )
  );
  console.log(`written: ${jsonPath}`);
}

if (failed.length) {
  console.log('');
  console.log('Fix these before shipping. A skipped check is not a pass — it means the page did not');
  console.log('expose enough to test, and the report must say so.');
  process.exit(1);
}
