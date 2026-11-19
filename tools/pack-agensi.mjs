#!/usr/bin/env node
/**
 * pack-agensi.mjs — build the uploadable ZIP for Agensi.
 *
 *   node tools/pack-agensi.mjs
 *
 * Produces:
 *   ../cursorfit-agensi/cursorfit/          the staging folder (single top-level folder)
 *   ../cursorfit-agensi/cursorfit-<ver>.zip the upload
 *
 * Agensi's packaging rules this script enforces:
 *   - one top-level folder with SKILL.md at its root
 *   - no .git, no node_modules, no test fixtures, no binaries that agents cannot read
 *   - each script must run from a temporary file, so scripts/audit.mjs is rebuilt as one
 *     self-contained file (the repo keeps audit.mjs + rank.mjs apart for testing)
 *   - every script is checked with `node --check` and the bundled audit is executed once
 *     from an isolated temp directory, which is the exact way Agensi runs it
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '..');
const outRoot = resolve(repo, '..', 'cursorfit-agensi');
const stage = join(outRoot, 'cursorfit');
const pkg = JSON.parse(readFileSync(join(repo, 'plugin.json'), 'utf8'));
const version = pkg.version;
const zipPath = join(outRoot, `cursorfit-${version}.zip`);

const fail = (msg) => {
  console.error(`pack: ${msg}`);
  process.exit(1);
};

// ---- staging folder --------------------------------------------------------

rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

const files = [
  'SKILL.md',
  'README.md',
  'LICENSE',
  'plugin.json',
  'references/audit.md',
  'references/behaviour.md',
  'references/credits.md',
  'references/families.md',
  'references/gating.md',
  'references/profile.md',
  'references/recipes.md',
  'references/recommendation.md',
  'scripts/verify.mjs',
  'assets/preview.html',
  'assets/shapes.css',
  'assets/cursors/arrow.svg',
  'assets/cursors/crosshair.svg',
  'assets/cursors/dot.svg',
  'assets/cursors/pointer.svg',
];

for (const rel of files) {
  const src = join(repo, rel);
  if (!existsSync(src)) fail(`missing file: ${rel}`);
  const dst = join(stage, rel);
  mkdirSync(dirname(dst), { recursive: true });
  copyFileSync(src, dst);
}

// Two README transforms, because the repo's copy describes the repo and the package is smaller:
//   1. the hero image is a binary Agensi will not deliver
//   2. the file inventory and two test-harness references name files the package does not ship
const readmePath = join(stage, 'README.md');
const packageListing = [
  'SKILL.md                  the pipeline — start here, it is self-contained',
  'references/audit.md       signals to extract, and what each one means',
  'references/profile.md     the five axes, the formulas, the motion signature',
  'references/families.md    the catalogue, fit bands, hard gates',
  'references/recipes.md     working code for all nine families',
  'references/behaviour.md   the 18-state matrix and size defaults',
  'references/gating.md      the nine rules and the repair checklist',
  'references/recommendation.md   the report shape, plus a worked example',
  'references/credits.md     what came from where',
  'scripts/audit.mjs         repo → cursorfit.json, one file with no imports',
  'scripts/verify.mjs        the page → eleven browser checks',
  'assets/shapes.css         seven silhouettes, zero images',
  'assets/cursors/*.svg      four image cursors with hotspots',
  'assets/preview.html       open this to see both sets',
].join('\n');

const readme = readFileSync(readmePath, 'utf8')
  .replace(/^!\[.*?\]\(docs\/shapes\.png\)\n/m, '')
  .replace(/```\nSKILL\.md {2,}the pipeline[\s\S]*?```/, '```\n' + packageListing + '\n```')
  .replace('`test/golden/` records this as a', 'The golden set records this as a')
  .replace(/by\s+`test\/extract\.mjs` and driven/, 'and driven');
writeFileSync(readmePath, readme);

// ---- the single-file audit -------------------------------------------------
// rank.mjs is wrapped in a closure rather than concatenated flat: both files declare
// `round` at top level, and the IIFE keeps them in separate scopes without renaming.

const rankSrc = readFileSync(join(repo, 'scripts/rank.mjs'), 'utf8').replace(/^export /gm, '');
const auditSrc = readFileSync(join(repo, 'scripts/audit.mjs'), 'utf8');

const importLine = auditSrc
  .split('\n')
  .find((l) => l.includes("from './rank.mjs'"));
if (!importLine) fail('could not find the rank.mjs import in scripts/audit.mjs');

const auditBody = auditSrc
  .replace(/^#!.*\n/, '')
  .replace(`${importLine}\n`, '');

const names = importLine.replace(/^import\s*\{|\}\s*from.*$/g, '').split(',').map((s) => s.trim()).filter(Boolean);

const bundled = `#!/usr/bin/env node
/**
 * cursorfit audit - single-file build for the Agensi package.
 *
 * Generated by tools/pack-agensi.mjs from scripts/audit.mjs + scripts/rank.mjs.
 * Edit those two files, not this one.
 *
 * Static only. No browser, no network, no writes outside --out.
 *
 *   node audit.mjs <repo-or-css-path> [--out cursorfit.json] [--json] [--explain]
 */

const __rank = (() => {
${rankSrc}
  return { ${names.join(', ')} };
})();
const { ${names.join(', ')} } = __rank;

${auditBody}`;

const bundledPath = join(stage, 'scripts/audit.mjs');
writeFileSync(bundledPath, bundled);

// ---- checks ----------------------------------------------------------------

for (const script of ['scripts/audit.mjs', 'scripts/verify.mjs']) {
  try {
    execFileSync(process.execPath, ['--check', join(stage, script)], { stdio: 'pipe' });
  } catch (err) {
    fail(`syntax check failed for ${script}\n${err.stderr?.toString() ?? err.message}`);
  }
}

// Agensi runs each script from a temporary file, alone. Copy the bundle somewhere with
// nothing beside it and run it there; if it still resolves rank.mjs, this fails.
const solo = join(tmpdir(), 'cursorfit-agensi-solo');
rmSync(solo, { recursive: true, force: true });
mkdirSync(solo, { recursive: true });
copyFileSync(bundledPath, join(solo, 'audit.mjs'));

const fixture = join(repo, 'test', 'golden', 'form-app');
let auditLine = '';
try {
  const out = execFileSync(process.execPath, [join(solo, 'audit.mjs'), fixture], { encoding: 'utf8' });
  auditLine = out.split('\n').find((l) => l.startsWith('DECISION')) ?? '';
} catch (err) {
  fail(`the bundled audit does not run on its own\n${err.stdout ?? ''}${err.stderr ?? err.message}`);
}
if (!auditLine) fail('the bundled audit ran but printed no DECISION line');

// Every file in the package must be text, because text is all Agensi delivers.
const binary = [];
const walkText = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walkText(p);
    else if (readFileSync(p).includes(0)) binary.push(p.slice(stage.length + 1));
  }
};
walkText(stage);
if (binary.length) fail(`binary files would not be delivered: ${binary.join(', ')}`);

// ---- zip -------------------------------------------------------------------

rmSync(zipPath, { force: true });
try {
  execFileSync('tar', ['-a', '-c', '-f', zipPath, '-C', outRoot, 'cursorfit'], { stdio: 'pipe' });
} catch (err) {
  fail(`zip failed: ${err.message}`);
}

const entries = execFileSync('tar', ['-tf', zipPath], { encoding: 'utf8' }).trim().split('\n').map((n) => n.replace(/\r$/, ''));
const filesOnly = entries.filter((n) => !n.endsWith('/'));
const sizes = filesOnly.map((name) => ({ name, size: readFileSync(join(outRoot, name)).length }));
const total = sizes.reduce((n, f) => n + f.size, 0);

console.log(`cursorfit ${version} -> ${zipPath}`);
console.log(`  ${filesOnly.length} files · ${(total / 1024).toFixed(1)} KB uncompressed`);
console.log(`  ${auditLine.trim()}`);
console.log('');
for (const f of sizes) console.log(`  ${String(f.size).padStart(7)}  ${f.name}`);
