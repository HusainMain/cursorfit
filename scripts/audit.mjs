#!/usr/bin/env node
/**
 * cursorfit audit — read a repo, describe its design character, rank cursor families.
 *
 * Static only. No browser, no network, no writes outside --out.
 *
 *   node scripts/audit.mjs <repo-or-css-path> [--out cursorfit.json] [--json] [--explain]
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, extname, basename, resolve, relative } from 'node:path';
import { FAMILIES, MODIFIERS, STATES, FIT_FLOOR, fitFamily, isEligible, decide, brief } from './rank.mjs';

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.svelte-kit', 'out',
  'coverage', 'vendor', '.cache', '.vercel', '.turbo', '.output', 'public/build',
  // test and tooling artifacts: they duplicate real components and inflate every count
  '.playwright-mcp', 'playwright-report', 'test-results', 'storybook-static', 'cypress',
  '.nyc_output', '.parcel-cache',
]);

const CODE_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte', '.astro']);
const MARKUP_EXT = new Set(['.html', '.htm', '.tsx', '.jsx', '.vue', '.svelte', '.astro']);
const STYLE_EXT = new Set(['.css', '.scss', '.sass', '.pcss', '.less']);

const MAX_FILE_BYTES = 2_000_000;
const MAX_FILES = 6000;

// ----------------------------------------------------------------------------- args

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const rootArg = positional[0] || '.';
const outIdx = argv.indexOf('--out');
const outFile = outIdx >= 0 ? argv[outIdx + 1] : null;

const root = resolve(rootArg);
const notes = [];

// ----------------------------------------------------------------------------- read

function walk(dir, acc = []) {
  if (acc.length >= MAX_FILES) return acc;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    notes.push(`unreadable directory: ${dir}`);
    return acc;
  }
  for (const e of entries) {
    if (acc.length >= MAX_FILES) break;
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(join(dir, e.name), acc);
    } else {
      const p = join(dir, e.name);
      try {
        if (statSync(p).size <= MAX_FILE_BYTES) acc.push(p);
      } catch {
        /* ignore */
      }
    }
  }
  return acc;
}

const isFile = (() => {
  try {
    return statSync(root).isFile();
  } catch {
    return false;
  }
})();

const allFiles = isFile ? [root] : walk(root);
const files = allFiles.filter((f) => {
  const ext = extname(f).toLowerCase();
  return STYLE_EXT.has(ext) || CODE_EXT.has(ext) || ext === '.html' || ext === '.htm' || basename(f) === 'package.json';
});

const read = (f) => {
  try {
    return readFileSync(f, 'utf8');
  } catch {
    return '';
  }
};

const styleFiles = files.filter((f) => STYLE_EXT.has(extname(f).toLowerCase()));
const markupFiles = files.filter((f) => MARKUP_EXT.has(extname(f).toLowerCase()));
const codeFiles = files.filter((f) => CODE_EXT.has(extname(f).toLowerCase()));
const pkgFile = files.find((f) => basename(f) === 'package.json');
const htmlFiles = files.filter((f) => /\.html?$/i.test(f));

const cssText = styleFiles.map(read).join('\n');
const markupText = markupFiles.map(read).join('\n');
const codeText = codeFiles.map(read).join('\n');
const allText = `${cssText}\n${markupText}\n${codeText}`;

// ----------------------------------------------------------------------------- helpers

const count = (text, re) => (text.match(re) || []).length;
const uniq = (arr) => [...new Set(arr)];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const norm = (v, lo, hi) => clamp((v - lo) / (hi - lo || 1), 0, 1);
const round = (n, d = 0) => Number(n.toFixed(d));
const median = (nums) => {
  if (!nums.length) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length === 8) h = h.slice(0, 6);
  if (h.length !== 6) return null;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

const parseColour = (value) => {
  const v = String(value).trim().toLowerCase();
  if (v.startsWith('#')) {
    const rgb = hexToRgb(v);
    return rgb ? { ...rgbToHsl(rgb), rgb } : null;
  }
  const m = v.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (m) {
    const rgb = { r: +m[1], g: +m[2], b: +m[3] };
    return { ...rgbToHsl(rgb), rgb };
  }
  return null;
};

// ----------------------------------------------------------------------------- package

let pkg = {};
if (pkgFile) {
  try {
    pkg = JSON.parse(read(pkgFile));
  } catch {
    notes.push('package.json could not be parsed');
  }
}
const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
const depNames = Object.keys(deps);

const FRAMEWORKS = [
  ['next', 'Next.js'], ['nuxt', 'Nuxt'], ['@sveltejs/kit', 'SvelteKit'],
  ['svelte', 'Svelte'], ['vue', 'Vue'], ['astro', 'Astro'], ['solid-js', 'Solid'],
  ['@remix-run/react', 'Remix'], ['gatsby', 'Gatsby'], ['react', 'React'],
];
const frameworkHits = FRAMEWORKS.filter(([d]) => depNames.includes(d)).map(([, n]) => n);
const framework = frameworkHits[0] || (htmlFiles.length ? 'Static HTML' : 'Unknown');

const NOTABLE_DEPS = [
  'gsap', 'framer-motion', 'motion', 'three', '@react-three/fiber', 'ogl', 'lenis',
  '@studio-freight/lenis', 'animejs', 'anime.js', '@react-spring/web', 'popmotion',
  'swiper', 'embla-carousel', 'react-fast-marquee', 'locomotive-scroll',
];
const notable = depNames.filter((d) => NOTABLE_DEPS.includes(d));

// A dependency in package.json is not a dependency in the bundle. `three` is a common
// leftover, and offering a shader because of an unimported package is exactly the kind of
// upgrade this skill is supposed to refuse.
const gpuDeps = depNames.filter((d) => ['three', 'ogl', '@react-three/fiber', 'pixi.js', 'regl'].includes(d));
const gpuImported =
  /from\s+['"]three['"]|from\s+['"]three\/|require\(['"]three|from\s+['"]ogl|WebGPURenderer|navigator\.gpu|@react-three\/fiber/.test(codeText);
const hasGpu = gpuDeps.length > 0 && gpuImported;

// ----------------------------------------------------------------------------- colour

const tokens = [];
const tokenRe = /(--[a-z0-9-_]+)\s*:\s*([^;{}]+);/gi;
for (const m of cssText.matchAll(tokenRe)) {
  const colour = parseColour(m[2]);
  const raw = m[2].trim();
  if (colour) {
    tokens.push({
      name: m[1],
      value: raw,
      hexKey: /^#[0-9a-f]{3,8}$/i.test(raw) ? raw.toLowerCase() : null,
      ...pickHsl(colour),
    });
  }
}

// How often each token is *referenced*. A token used 40 times in `var(--x)` is the site's real
// accent, even when its literal hex appears only once.
const tokenRefs = new Map();
for (const m of cssText.matchAll(/var\(\s*(--[a-z0-9-_]+)/gi)) {
  tokenRefs.set(m[1], (tokenRefs.get(m[1]) || 0) + 1);
}

function pickHsl(c) {
  return { h: round(c.h), s: round(c.s, 2), l: round(c.l, 2) };
}

const hexRe = /#[0-9a-fA-F]{3,8}\b/g;
const hexCounts = new Map();
for (const m of cssText.matchAll(hexRe)) {
  const hex = m[0].toLowerCase();
  const c = parseColour(hex);
  if (!c) continue;
  const prev = hexCounts.get(hex) || { count: 0, ...pickHsl(c), rgb: c.rgb };
  prev.count += 1;
  hexCounts.set(hex, prev);
}

const allColours = [...hexCounts.entries()].map(([hex, d]) => ({ hex, ...d }));

// Fold token usage into the hex counts so `var(--neon-cyan)` × 40 outranks a stray hex.
for (const t of tokens) {
  if (!t.hexKey) continue;
  const entry = hexCounts.get(t.hexKey);
  if (!entry) continue;
  const refs = tokenRefs.get(t.name) || 0;
  entry.count += refs;
  entry.refs = (entry.refs || 0) + refs;
}

const accentCandidates = [...hexCounts.entries()]
  .map(([hex, c]) => ({ hex, ...c }))
  .filter((c) => c.s >= 0.45 && c.l >= 0.25 && c.l <= 0.9)
  .sort((a, b) => b.count * b.s - a.count * a.s)
  .slice(0, 6)
  .map((c) => ({ hex: c.hex, count: c.count, refs: c.refs || 0, hue: c.h, saturation: c.s, lightness: c.l }));

const hueBuckets = uniq(accentCandidates.map((c) => Math.round(c.hue / 30)));

const neutrals = allColours.filter((c) => c.s < 0.15).sort((a, b) => b.count - a.count);

// Background colour: trust a named token before a statistical guess. Averaging neutral
// lightness is wrong on any site that uses `rgba(255,255,255,0.07)` borders.
const bgTokens = tokens
  .filter((t) => /(bg|background|base|surface|paper|canvas)/i.test(t.name) && t.hexKey)
  .sort((a, b) => (tokenRefs.get(b.name) || 0) - (tokenRefs.get(a.name) || 0));

const bgLum = bgTokens.length
  ? bgTokens[0].l
  : neutrals.length
    ? neutrals[0].l
    : null;
const bgToken = bgTokens.length ? bgTokens[0].name : null;

const hasGradientText = /background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text/.test(cssText);
const hasGlass = /backdrop-filter\s*:\s*blur/.test(cssText);
const hasBlend = /mix-blend-mode\s*:\s*(?!normal)/.test(cssText);

// tailwind tokens (best effort)
const twFile = files.find((f) => /tailwind\.config\.(js|ts|cjs|mjs)$/.test(f));
let twColours = [];
let twFonts = [];
let twKeyframes = [];
if (twFile) {
  const tw = read(twFile);
  const coloursBlock = tw.match(/colou?rs\s*:\s*\{([\s\S]*?)\n\s*\}/);
  if (coloursBlock) {
    for (const m of coloursBlock[1].matchAll(/['"]?([\w-]+)['"]?\s*:\s*['"](#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))['"]/g)) {
      const c = parseColour(m[2]);
      if (c) twColours.push({ name: m[1], value: m[2], ...pickHsl(c) });
    }
  }
  const fontsBlock = tw.match(/fontFamily\s*:\s*\{([\s\S]*?)\n\s*\}/);
  if (fontsBlock) {
    for (const m of fontsBlock[1].matchAll(/['"]?([\w-]+)['"]?\s*:\s*\[([^\]]*)\]/g)) {
      twFonts.push({ role: m[1], stack: m[2] });
    }
  }
  const kfBlock = tw.match(/keyframes\s*:\s*\{([\s\S]*?)\n\s*\}\s*,?\s*\n\s*\}/);
  if (kfBlock) {
    for (const m of kfBlock[1].matchAll(/^\s*['"]?([\w-]+)['"]?\s*:\s*\{/gm)) twKeyframes.push(m[1]);
  }
}

// ----------------------------------------------------------------------------- type

const googleFonts = uniq(
  [...allText.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/g)]
    .flatMap((m) => [...m[1].matchAll(/family=([^&:]+)/g)].map((x) => decodeURIComponent(x[1].replace(/\+/g, ' '))))
    .concat([...allText.matchAll(/@font-face\s*\{[^}]*font-family\s*:\s*['"]?([^'";]+)/g)].map((m) => m[1].trim()))
);

const declaredFamilies = uniq(
  [...cssText.matchAll(/font-family\s*:\s*([^;}]+)/g)].map((m) => m[1].trim())
);

const serifNames = /(playfair|georgia|times|garamond|freight|tiempos|canela|recoleta|instrument serif|lora|merriweather|dm serif|source serif|serif)/i;
const serifDeclared = declaredFamilies.some((f) => serifNames.test(f)) || twFonts.some((f) => /serif/i.test(f.role + f.stack));

const fontSizes = [...cssText.matchAll(/font-size\s*:\s*(?:clamp\(([^)]+)\)|([\d.]+)(rem|px))/g)].map((m) => {
  if (m[1]) {
    const vals = m[1].split(',').map((s) => s.trim());
    const last = vals[vals.length - 1];
    const n = parseFloat(last);
    return /px/.test(last) ? n / 16 : n;
  }
  const n = parseFloat(m[2]);
  return m[3] === 'px' ? n / 16 : n;
}).filter((n) => Number.isFinite(n) && n > 0);

const maxDisplayRem = fontSizes.length ? Math.max(...fontSizes) : 0;
const serifDisplay = serifDeclared && maxDisplayRem >= 2;

const measures = [...cssText.matchAll(/max-width\s*:\s*([\d.]+)ch/g)].map((m) => parseFloat(m[1]));
const measureCh = measures.length ? Math.max(...measures) : 0;
const mono = declaredFamilies.some((f) => /mono|consolas|menlo|courier/i.test(f));
const tightTracking = /letter-spacing\s*:\s*-/.test(cssText);

// ----------------------------------------------------------------------------- motion

const keyframes = uniq([
  ...[...cssText.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]),
  ...twKeyframes,
]);

const animationCount = count(cssText, /animation\s*:/g) + count(markupText, /animate-[\w-]+/g);

const easings = uniq([...cssText.matchAll(/cubic-bezier\([^)]*\)/g)].map((m) => m[0].replace(/\s+/g, '')));
const easeKeywords = uniq([...cssText.matchAll(/\b(ease-in-out|ease-in|ease-out|ease|linear)\b/g)].map((m) => m[1]));

const overshoot = easings.filter((e) => {
  const nums = e.match(/cubic-bezier\(([^)]*)\)/);
  if (!nums) return false;
  const v = nums[1].split(',').map(Number);
  return v.length === 4 && (v[1] < 0 || v[1] > 1 || v[3] < 0 || v[3] > 1);
});
const overshootRatio = easings.length ? overshoot.length / easings.length : 0;

const timeRe = /(\d*\.?\d+)(ms|s)\b/g;
const transitionDurations = [];
for (const m of cssText.matchAll(/transition\s*:\s*([^;}]+)[;}]/g)) {
  for (const t of m[1].matchAll(timeRe)) {
    const ms = t[2] === 's' ? parseFloat(t[1]) * 1000 : parseFloat(t[1]);
    if (ms > 0 && ms <= 3000) transitionDurations.push(ms);
  }
}
const animationDurations = [];
for (const m of cssText.matchAll(/animation\s*:\s*([^;}]+)[;}]/g)) {
  for (const t of m[1].matchAll(timeRe)) {
    const ms = t[2] === 's' ? parseFloat(t[1]) * 1000 : parseFloat(t[1]);
    if (ms > 0 && ms <= 30000) animationDurations.push(ms);
  }
}

const medianTransitionMs = median(transitionDurations) ?? 300;
const shortestTransitionMs = transitionDurations.length ? Math.min(...transitionDurations) : 200;
const transitionCount = count(cssText, /transition\s*:/g);

const sticky = count(cssText, /position\s*:\s*sticky/g);
const fullHeightSections = count(cssText, /(?:min-)?height\s*:\s*(?:100|1\d\d)(?:vh|dvh|svh)/g);
const scrollDriven =
  (sticky > 0 && fullHeightSections > 0) ||
  /useScroll|IntersectionObserver|scroll-timeline|ScrollTrigger/.test(allText);

const hasReducedMotion = /prefers-reduced-motion/.test(cssText + markupText);
const hasCoarseGuard = /pointer\s*:\s*coarse|hover\s*:\s*none/.test(cssText + markupText);

// ----------------------------------------------------------------------------- layout

const containerWidths = [...cssText.matchAll(/max-width\s*:\s*(\d{3,4})px/g)].map((m) => parseInt(m[1], 10));
for (const m of cssText.matchAll(/(--[\w-]*(?:max|container|width)[\w-]*)\s*:\s*(\d{3,4})px/gi)) {
  containerWidths.push(parseInt(m[2], 10));
}
const containerWidth = containerWidths.length ? Math.max(...containerWidths) : 0;

const radii = [...cssText.matchAll(/border-radius\s*:\s*([\d.]+)px/g)].map((m) => parseFloat(m[1]));
const medianRadius = median(radii);

const paddings = [...cssText.matchAll(/padding\s*:\s*([^;}]+)/g)]
  .flatMap((m) => [...m[1].matchAll(/([\d.]+)(px|rem)/g)].map((x) => (x[2] === 'rem' ? parseFloat(x[1]) * 16 : parseFloat(x[1]))))
  .filter((n) => n > 0 && n < 400);
const medianPadding = median(paddings);

const blurLayers = count(cssText, /backdrop-filter|filter\s*:\s*blur/g);
const grain = /noise|grain|texture/i.test(cssText);

// ----------------------------------------------------------------------------- controls

// Element names are not always lowercase. A Next app writes <Image>, a design system writes
// <Button>, a router writes <Link>. Counting only `<button` reports zero controls on exactly
// the modern projects this skill is most likely to meet, so count both spellings and record
// which one was found — the report can then say how much of the page it actually saw.

const tally = (re) => count(markupText, re);

const nativeTags = {
  buttons: tally(/<button[\s>]/g),
  links: tally(/<a[\s>]/g),
  inputs: tally(/<input[\s>]/g),
  textareas: tally(/<textarea[\s>]/g),
};

const componentTags = {
  buttons: tally(/<(?:Button|Btn|CTA)[\s>]/g),
  links: tally(/<(?:Link|NavLink|RouterLink)[\s>]/g),
  inputs: tally(/<(?:Input|TextField|TextInput)[\s>]/g),
  textareas: tally(/<(?:TextArea|Textarea)[\s>]/g),
  images: tally(/<(?:Image|Img|NextImage)[\s>]/g),
};

const controlCounts = {
  buttons: nativeTags.buttons + componentTags.buttons,
  links: nativeTags.links + componentTags.links,
  inputs: nativeTags.inputs + componentTags.inputs,
  textareas: nativeTags.textareas + componentTags.textareas,
  images: tally(/<img[\s>]/g) + componentTags.images + tally(/<picture[\s>]/g),
  canvases: tally(/<canvas[\s>]/g),
  videos: tally(/<video[\s>]/g),
  paragraphs: tally(/<p[\s>]/g),
};
const controlTotal = controlCounts.buttons + controlCounts.links + controlCounts.inputs + controlCounts.textareas;
const formRatio = controlTotal ? (controlCounts.inputs + controlCounts.textareas) / controlTotal : 0;

// A background-image is media for the purpose of a reveal, but it never appears in the markup.
const cssBackgroundImages = count(cssText, /background(?:-image)?\s*:[^;}]*url\(\s*['"]?(?!data:)/g);
const mediaCount = controlCounts.images + controlCounts.videos + controlCounts.canvases;

// ----------------------------------------------------------------------------- existing cursor

const cursorSignals = [
  ['cursor: none', /cursor\s*:\s*none/g],
  ['cursor: url()', /cursor\s*:\s*url\(/g],
  ['data-cursor', /data-cursor/g],
  ['custom-cursor class', /custom-cursor|cursor-follower|cf-cursor/g],
  ['mousemove listener', /mousemove/g],
  ['custom cursor library', /cursor-follower|cursor\.js|followmouse|mouse-follow/g],
].map(([name, re]) => ({ name, count: count(allText, re) }));

const existingCursor = cursorSignals.filter((s) => s.count > 0);
const hasCustomCursor = existingCursor.some((s) =>
  ['cursor: none', 'cursor: url()', 'custom-cursor class', 'custom cursor library'].includes(s.name)
);

// ----------------------------------------------------------------------------- scores

const scores = {};

{
  const terms = [
    [0.30, norm(keyframes.length, 0, 24), `${keyframes.length} keyframes`],
    [0.20, norm(animationCount, 0, 40), `${animationCount} animation declarations`],
    [0.20, norm(accentCandidates.length, 0, 4), `${accentCandidates.length} vivid accent colours`],
    [0.15, norm(maxDisplayRem, 1.5, 6), `max type ${round(maxDisplayRem, 1)}rem`],
    [0.15, (hasGradientText ? 1 : 0) * 0.5 + (hasGlass ? 1 : 0) * 0.3 + (hasBlend ? 1 : 0) * 0.2, [
      hasGradientText && 'gradient text', hasGlass && 'glass blur', hasBlend && 'blend modes',
    ].filter(Boolean).join(' + ') || 'flat surfaces'],
  ];
  scores.expressive = { value: round(terms.reduce((a, [w, v]) => a + w * v, 0) * 100), evidence: terms.map((t) => t[2]) };
}

{
  const terms = [
    [0.30, norm(medianRadius ?? 0, 0, 20), `median radius ${round(medianRadius ?? 0)}px`],
    [0.25, overshootRatio, `${overshoot.length}/${easings.length} overshoot easings`],
    [0.25, serifDeclared ? 1 : 0, serifDeclared ? 'serif in the type stack' : 'no serif'],
    [0.20, grain ? 1 : 0, grain ? 'texture/grain tokens' : 'no texture'],
  ];
  scores.organic = { value: round(terms.reduce((a, [w, v]) => a + w * v, 0) * 100), evidence: terms.map((t) => t[2]) };
}

{
  const terms = [
    [0.35, norm(medianPadding ?? 0, 24, 160), `median padding ${round(medianPadding ?? 0)}px`],
    [0.25, norm(containerWidth, 720, 1440), `container ${containerWidth || '?'}px`],
    [0.20, fullHeightSections > 0 ? 1 : 0, `${fullHeightSections} full-height sections`],
    [0.20, 1 - norm(controlTotal, 2, 20), `${controlTotal} interactive controls`],
  ];
  scores.airy = { value: round(terms.reduce((a, [w, v]) => a + w * v, 0) * 100), evidence: terms.map((t) => t[2]) };
}

{
  const terms = [
    [0.40, 1 - norm(medianTransitionMs, 120, 700), `median transition ${round(medianTransitionMs)}ms`],
    [0.25, norm(animationCount, 0, 12), `${animationCount} animations`],
    [0.20, scrollDriven ? 1 : 0, scrollDriven ? 'scroll-driven sections' : 'static scroll'],
    [0.15, 1 - norm(shortestTransitionMs, 80, 400), `fastest transition ${round(shortestTransitionMs)}ms`],
  ];
  scores.energy = { value: round(terms.reduce((a, [w, v]) => a + w * v, 0) * 100), evidence: terms.map((t) => t[2]) };
}

{
  const terms = [
    [0.30, serifDisplay ? 1 : 0, serifDisplay ? `display serif at ${round(maxDisplayRem, 1)}rem` : 'no display serif'],
    [0.25, norm(maxDisplayRem, 2, 6), `max type ${round(maxDisplayRem, 1)}rem`],
    [0.20, norm(measureCh, 45, 75), measureCh ? `${round(measureCh)}ch measure` : 'no ch measure'],
    [0.15, 1 - norm(controlTotal, 2, 40), `${controlTotal} controls`],
    [0.10, controlCounts.paragraphs >= 8 ? 1 : 0, `${controlCounts.paragraphs} paragraphs`],
  ];
  scores.editorial = { value: round(terms.reduce((a, [w, v]) => a + w * v, 0) * 100), evidence: terms.map((t) => t[2]) };
}

// ----------------------------------------------------------------------------- coverage
//
// The audit reads source. Source is not the render, and on a modern project it is not even the
// whole source: styles can live in inline objects, in utility classes resolved at build time,
// or in a CSS-in-JS runtime. Whatever could not be read is recorded here, and every axis that
// depended on it loses confidence. A score must never look certain when half the styling was
// invisible.

const inlineStyles = tally(/\bstyle=/g);

const classLists = [...markupText.matchAll(/className\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map((m) => m[1] ?? m[2]);
const UTILITY = /^(?:flex|grid|block|inline|inline-flex|hidden|absolute|relative|fixed|sticky|p[xytblr]?-|m[xytblr]?-|gap-|w-|h-|min-h-|max-w-|text-|bg-|border|rounded|shadow|opacity-|z-|items-|justify-|space-)/;
const utilityClassLists = classLists.filter((s) => s.split(/\s+/).filter((t) => UTILITY.test(t)).length >= 2).length;

const cssInJsFiles = markupFiles
  .filter((f) => /\.(jsx?|tsx?|vue|svelte)$/i.test(f))
  .filter((f) => /styled\.[a-zA-Z]|styled\(|createGlobalStyle|@emotion\/|from ['"]styled-components|css`/.test(read(f))).length;

const componentTotal = Object.values(componentTags).reduce((a, b) => a + b, 0);

// Naming the files is the difference between "coverage is partial" and something an agent can
// act on. These are the five files most likely to hold the styling the audit could not read.
const hotspots = markupFiles
  .map((f) => {
    const t = read(f);
    return { file: relative(root, f), inlineStyles: count(t, /\bstyle=/g), classLists: count(t, /className\s*=/g) };
  })
  .filter((h) => h.inlineStyles > 5 || h.classLists > 15)
  .sort((a, b) => b.inlineStyles - a.inlineStyles || b.classLists - a.classLists)
  .slice(0, 5);

const blindSpots = [];
if (!styleFiles.length) blindSpots.push('no stylesheet found - every CSS-derived value is a guess');
if (inlineStyles > 20) blindSpots.push(`${inlineStyles} inline style attributes - set in markup, invisible to the stylesheet scan`);
if (utilityClassLists > 20) blindSpots.push(`${utilityClassLists} utility-class lists - values are resolved at build time, not in a stylesheet`);
if (cssInJsFiles) blindSpots.push(`CSS-in-JS in ${cssInJsFiles} files - rules are generated at runtime`);
if (componentTotal) blindSpots.push(`${componentTotal} PascalCase component tags - counted at the call site, internals unseen`);

const coverage = {
  stylesheets: styleFiles.length,
  markupFiles: markupFiles.length,
  inlineStyles,
  utilityClassLists,
  cssInJsFiles,
  componentTags,
  cssBackgroundImages,
  hotspots,
  blindSpots,
};

const depthRank = { none: 0, partial: 1, full: 2 };
const cssDepth = !styleFiles.length
  ? 'none'
  : cssInJsFiles || utilityClassLists > 40 || inlineStyles > 60
    ? 'partial'
    : 'full';
const markupDepth = !markupFiles.length ? 'none' : componentTotal > Math.max(3, controlTotal * 0.3) ? 'partial' : 'full';
const worstDepth = (...d) => d.reduce((a, b) => (depthRank[a] <= depthRank[b] ? a : b));
const LEVEL = { full: 'high', partial: 'medium', none: 'low' };

const axisDepth = {
  expressive: worstDepth(cssDepth),
  organic: worstDepth(cssDepth),
  airy: worstDepth(cssDepth, markupDepth),
  energy: worstDepth(cssDepth),
  editorial: worstDepth(cssDepth, markupDepth),
};

for (const [axis, d] of Object.entries(axisDepth)) {
  scores[axis].confidence = {
    level: LEVEL[d],
    basis: 'static',
    note:
      d === 'full'
        ? `${styleFiles.length} stylesheet(s), ${markupFiles.length} markup file(s), no blind spots`
        : d === 'partial'
          ? blindSpots.slice(0, 2).join('; ') || 'partial coverage'
          : 'nothing readable for this axis',
  };
}

// ----------------------------------------------------------------------------- families

const siteSupports = {
  link: controlCounts.links > 0,
  button: controlCounts.buttons > 0,
  text: controlCounts.inputs + controlCounts.textareas > 0,
  label: controlCounts.links + controlCounts.buttons > 0,
  media: mediaCount + cssBackgroundImages > 0,
};

const stateCount = (id) => (STATES[id] || []).filter((s) => siteSupports[s]).length;

const gateNotes = [];
const blocked = new Set();
const restricted = new Map();

const block = (id, gate, reason) => {
  if (blocked.has(id)) return;
  blocked.add(id);
  gateNotes.push({ gate, appliesTo: [id], reason, severity: 'blocked' });
};
const restrict = (id, gate, reason) => {
  if (blocked.has(id) || restricted.has(id)) return;
  restricted.set(id, reason);
  gateNotes.push({ gate, appliesTo: [id], reason, severity: 'primary-only' });
};

const hoverTargets = controlCounts.buttons + controlCounts.links;

if (!hasGpu) {
  block('shader-ripple', 'gpu-pipeline',
    'no imported GPU/shader pipeline — a package.json entry without an import does not count');
}
if (mediaCount + cssBackgroundImages < 4) {
  block('mask-reveal', 'media-count', `only ${mediaCount} images/media and ${cssBackgroundImages} CSS background images to reveal`);
}
if (hoverTargets < 3) {
  block('state-label', 'hover-groups', `only ${hoverTargets} hoverable controls to label`);
}
if (formRatio >= 0.6) {
  for (const id of ['trail', 'mask-reveal', 'blend-difference']) {
    block(id, 'form-first', `${round(formRatio * 100)}% of controls are form fields`);
  }
}
if (hasGpu && controlCounts.canvases > 0) {
  restrict('trail', 'hero-canvas', 'a GPU canvas already runs in the hero — two effects would compete');
}
if (hasGlass) {
  restrict('blend-difference', 'stacking-context',
    'backdrop-filter creates a stacking context; difference blending will not reach the surface behind it');
}

const ranking = FAMILIES.map((f) => {
  const { fit, active, skipped, misses, missDistance } = fitFamily(scores, f);
  return {
    id: f.id,
    tier: f.tier,
    tierRank: f.tierRank,
    floor: f.floor,
    jsLines: f.js,
    fit,
    active,
    skipped,
    missDistance,
    states: stateCount(f.id),
    modifier: MODIFIERS.has(f.id),
    blocked: blocked.has(f.id),
    primaryOnly: restricted.has(f.id),
    restrictedBecause: restricted.get(f.id) || null,
    misses,
    eligible: isEligible(fit, f, blocked.has(f.id)),
  };
}).sort((a, b) => {
  const rank = (r) => (r.blocked ? 3 : r.modifier ? 2 : r.eligible ? 0 : 1);
  return rank(a) - rank(b) || (b.fit ?? -1) - (a.fit ?? -1) || a.id.localeCompare(b.id);
});

// Fit is a floor, not a ranker (0.2.0). `safe` is the best fit among eligible families;
// `reach` is the most ambitious one at most a tier above it. The rule lives in
// scripts/rank.mjs so test/selection.mjs can pin each condition down.
const decision = decide(ranking);

// ----------------------------------------------------------------------------- signature

const signature =
  `${keyframes.length} keyframes · median transition ${round(medianTransitionMs)}ms · ` +
  `${overshoot.length} overshoot curve${overshoot.length === 1 ? '' : 's'} · ` +
  `scroll-driven: ${scrollDriven ? 'yes' : 'no'} · ` +
  `reduced-motion: ${hasReducedMotion ? 'present' : 'absent'} · ` +
  `touch guard: ${hasCoarseGuard ? 'present' : 'absent'}`;

// ----------------------------------------------------------------------------- gaps

const gaps = [];
if (!accentCandidates.length) {
  gaps.push('no saturated accent — use the text colour for the cursor (never invent a brand colour)');
}
if (!serifDeclared && maxDisplayRem === 0) gaps.push('type scale unclear — ask what the site should feel like');
if (!controlCounts.buttons && !controlCounts.links) gaps.push('no interactive targets found — confirm this is the right directory');
if (!hasReducedMotion) gaps.push('no prefers-reduced-motion block — one must be added with the cursor');
if (!hasCoarseGuard) gaps.push('no coarse-pointer guard — one must be added with the cursor');
if (hasCustomCursor) gaps.push('existing cursor code found — run the repair checklist before replacing');

const notHigh = Object.entries(scores).filter(([, s]) => s.confidence.level !== 'high').map(([k]) => k);
if (notHigh.length) {
  gaps.push(`confidence below high on ${notHigh.join(', ')} — read the named components and inline styles before trusting the score`);
}
if (Object.values(scores).some((s) => s.confidence.level === 'low')) {
  gaps.push('at least one axis is a guess — ask the user before building on it');
}
if (!hasCustomCursor && /mousemove/.test(codeText)) {
  notes.push('pointer tracking exists in the codebase but no cursor element was found — check it is not a half-built cursor');
}

// ----------------------------------------------------------------------------- output

const profile = {
  tool: 'cursorfit',
  version: '0.1.2',
  generatedAt: new Date().toISOString(),
  root,
  scanned: { files: files.length, styles: styleFiles.length, markup: markupFiles.length, code: codeFiles.length },
  framework,
  deps: { total: depNames.length, notable, hasGpu },
  colour: {
    colorMode: bgLum === null ? 'unknown' : bgLum < 0.25 ? 'dark' : 'light',
    backgroundToken: bgToken,
    tokens: tokens.slice(0, 40),
    tailwindColours: twColours,
    accentCandidates,
    distinctAccentHues: hueBuckets.length,
    hasGradientText, hasGlass, hasBlend,
  },
  type: {
    googleFonts,
    declaredFamilies: declaredFamilies.slice(0, 30),
    serifDeclared, serifDisplay, mono, tightTracking,
    maxDisplayRem: round(maxDisplayRem, 2),
    measureCh,
  },
  motion: {
    keyframes,
    animationCount,
    easings,
    easeKeywords,
    overshoot,
    medianTransitionMs: round(medianTransitionMs),
    shortestTransitionMs: round(shortestTransitionMs),
    transitionCount,
    animationDurations: animationDurations.slice(0, 20),
    scrollDriven,
    hasReducedMotion,
    hasCoarseGuard,
  },
  layout: {
    containerWidth,
    fullHeightSections,
    medianRadius: medianRadius === null ? null : round(medianRadius),
    medianPadding: medianPadding === null ? null : round(medianPadding),
    blurLayers,
    grain,
  },
  controls: { ...controlCounts, total: controlTotal, formRatio: round(formRatio, 2), mediaCount },
  coverage,
  existingCursor: { found: hasCustomCursor, signals: existingCursor },
  scores,
  motionSignature: signature,
  ranking,
  decision: {
    reason: decision.reason,
    safe: brief(decision.safe),
    reach: brief(decision.reach),
    fallback: brief(decision.fallback),
  },
  fitFloor: FIT_FLOOR,
  gates: gateNotes,
  gaps,
  notes,
};

const json = JSON.stringify(profile, null, 2);
if (outFile) writeFileSync(outFile, json, 'utf8');

// ----------------------------------------------------------------------------- terminal

const bar = (v) => {
  const filled = Math.round(clamp(v, 0, 100) / 5);
  return `${'▓'.repeat(filled)}${'░'.repeat(20 - filled)}`;
};

if (!flags.has('--json')) {
  const lines = [];
  lines.push('');
  lines.push(`cursorfit — ${basename(root) || root}`);
  lines.push(`${framework} · ${files.length} files scanned · ${depNames.length} deps${hasGpu ? ' · GPU deps present' : ''}`);
  lines.push('');
  lines.push('PROFILE');
  const axes = [
    ['RESTRAINED', 'EXPRESSIVE', 'expressive'],
    ['PRECISE', 'ORGANIC', 'organic'],
    ['DENSE', 'AIRY', 'airy'],
    ['CALM', 'ENERGETIC', 'energy'],
    ['PRODUCT', 'EDITORIAL', 'editorial'],
  ];
  for (const [lo, hi, key] of axes) {
    const s = scores[key];
    lines.push(`${lo.padEnd(11)} ${bar(s.value)} ${String(s.value).padStart(3)}  ${hi}`);
    lines.push(`            ${s.evidence.slice(0, 3).join(' · ')}`);
  }
  lines.push('');
  lines.push(`MOTION      ${signature}`);
  lines.push('');
  lines.push('FAMILIES');
  lines.push('            own layer only; every JS family also ships the ~100-line shared core');
  for (const r of ranking) {
    const tag = r.blocked ? 'BLOCKED' : r.modifier ? 'MODIFIER' : r.primaryOnly ? 'RESTRICTED' : r.fit === null ? 'NO EVIDENCE' : '';
    const fit = (r.fit === null ? '--' : String(r.fit)).padStart(3);
    lines.push(`${fit}  ${r.id.padEnd(17)} ${r.tier}  ${String(r.jsLines).padStart(3)}js  ${r.states} state${r.states === 1 ? '' : 's'}  ${tag}`);
    if (flags.has('--explain')) {
      if (r.misses.length) lines.push(`     misses: ${r.misses.join(' · ')}`);
      if (r.skipped.length) lines.push(`     skipped: ${r.skipped.join(', ')} (low confidence)`);
    }
  }
  if (gateNotes.length) {
    lines.push('');
    lines.push('GATES');
    for (const g of gateNotes) lines.push(`  ${g.severity === 'blocked' ? '✕' : '!'} ${g.gate}: ${g.reason}`);
  }
  if (decision.safe) {
    const cell = (label, r) => {
      if (!r) return `${label.padEnd(9)} none`;
      const bits = [`${r.id}`, `${r.tier}`, `fit ${r.fit}`, `~${r.jsLines} own lines`, `${r.states} state${r.states === 1 ? '' : 's'}`];
      return `${label.padEnd(9)} ${bits.join(' · ')}`;
    };
    lines.push('');
    const ask = decision.reach
      ? 'ask which slot before writing files'
      : 'no reach clears the bar · ask before writing files';
    lines.push(`DECISION    fit is a floor (80) · ${ask}`);
    lines.push(cell('SAFE', decision.safe));
    lines.push(cell('REACH', decision.reach));
    lines.push(cell('FALLBACK', decision.fallback));
    lines.push(`          ${decision.reason}`);
  }
  if (gaps.length) {
    lines.push('');
    lines.push('GAPS');
    for (const g of gaps) lines.push(`  · ${g}`);
  }
  if (notes.length) {
    lines.push('');
    lines.push('NOTES');
    for (const n of notes) lines.push(`  · ${n}`);
  }
  lines.push('');
  lines.push(outFile ? `written: ${outFile}` : 'pass --out <file> to save the JSON');
  lines.push('');
  console.log(lines.join('\n'));
}
