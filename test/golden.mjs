#!/usr/bin/env node
/**
 * Golden set — the instrument that was missing.
 *
 * The fit bands are hand-written. Without a fixed set of sites and a fixed set of expected
 * picks, every band edit is an unmeasured guess, and a `dot` that wins everywhere looks like a
 * bug in one review and like correct conservatism in the next.
 *
 * Each fixture is a small but characteristic repo under test/golden/<name>/. The expectation
 * was written as a product judgement, not derived from the current ranker, so a mismatch means
 * either the ranker or the expectation has to change — and the reason has to be written down.
 *
 * A mismatch listed under `knownGaps` in expected.json does not fail the run. Those are
 * findings the model is known to get wrong, recorded so each run shows them and so a fix has
 * something to turn green. A mismatch that is *not* listed fails, so a regression cannot hide
 * behind the gap list.
 *
 *   node test/golden.mjs           # table + exit 1 on an unrecorded mismatch
 *   node test/golden.mjs --verbose # also print fallback, fit and the rationale
 */

import { readFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const golden = join(here, 'golden');
const outFile = join(golden, '.result.json');

const spec = JSON.parse(readFileSync(join(golden, 'expected.json'), 'utf8'));
const expected = spec.fixtures;
const gaps = spec.knownGaps || [];
const verbose = process.argv.includes('--verbose');

const gapFor = (name) => gaps.find((g) => g.fixtures.includes(name)) || null;

const names = readdirSync(golden, { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

let failed = 0;
let gapFixtures = 0;
const hit = new Set();

console.log('');
console.log('cursorfit golden set');
console.log('');

for (const name of names) {
  const want = expected[name];
  if (!want) {
    console.log(`??    ${name.padEnd(18)} no expectation`);
    failed += 1;
    continue;
  }

  execFileSync(process.execPath, [join(root, 'scripts', 'audit.mjs'), join(golden, name), '--json', '--out', outFile], {
    stdio: 'pipe',
  });

  const profile = JSON.parse(readFileSync(outFile, 'utf8'));
  const { safe, reach, fallback } = profile.decision;

  const gotSafe = safe && safe.id;
  const gotReach = reach && reach.id;
  const marks = [];
  if (gotSafe !== want.safe) marks.push(`safe ${gotSafe || 'none'}, expected ${want.safe}`);
  if ('reach' in want && (gotReach ?? null) !== (want.reach ?? null)) {
    marks.push(`reach ${gotReach || 'none'}, expected ${want.reach || 'none'}`);
  }

  const ok = marks.length === 0;
  const gap = !ok ? gapFor(name) : null;
  if (gap) hit.add(gap.id);

  const status = ok ? 'ok' : gap ? 'GAP' : 'FAIL';

  console.log(
    [
      status.padEnd(4),
      name.padEnd(18),
      String(gotSafe || 'none').padEnd(17),
      safe ? `${safe.tier} fit ${safe.fit}` : '',
      reach ? `reach ${gotReach}` : 'reach none',
    ].join(' '),
  );

  if (verbose) {
    console.log(`     fallback ${fallback ? `${fallback.id} (${fallback.tier}, fit ${fallback.fit})` : 'none'}`);
    console.log(`     expected ${want.safe} / ${want.reach || 'no reach'}`);
    console.log(`     ${want.rationale}`);
  }

  if (ok) continue;
  if (gap) {
    gapFixtures += 1;
    for (const m of marks) console.log(`     ${m}`);
    continue;
  }
  failed += 1;
  for (const m of marks) console.log(`     ${m}`);
}

try {
  rmSync(outFile);
} catch {
  /* already gone */
}

console.log('');
if (hit.size) {
  console.log(`${names.length - failed - gapFixtures} fixtures match · ${gapFixtures} known gap${gapFixtures === 1 ? '' : 's'}`);
  for (const g of gaps) {
    if (!hit.has(g.id)) continue;
    console.log(`  ${g.id} (${g.fixtures.filter((f) => expected[f]).join(', ')})`);
    console.log(`    ${g.statement}`);
  }
  console.log('');
}

if (failed) {
  console.error(`${failed} of ${names.length} fixtures do not match and are not recorded as known gaps`);
  process.exit(1);
}
console.log(`no unrecorded mismatches`);
