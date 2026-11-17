#!/usr/bin/env node
/**
 * The tie-break rule, pinned down.
 *
 * Each case below is a mistake the rule could make and did make in a draft:
 * a T1 promoted over a T0, a blocked family promoted, a 6-point gap treated as noise.
 *
 *   node test/tiebreak.mjs
 *
 * Exits 1 on the first failed assertion.
 */

import { breakTie } from '../scripts/rank.mjs';

let passed = 0;
const fail = (msg) => {
  console.error(`FAIL  ${msg}`);
  process.exit(1);
};
const eq = (actual, expected, label) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label}\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`);
  }
  passed += 1;
  console.log(`ok    ${label}`);
};

const f = (id, tier, fit, states, extra = {}) => ({
  id, tier, fit, states, eligible: true, modifier: false, blocked: false, primaryOnly: false, ...extra,
});

// 1. A close, same-tier candidate with more states takes the slot.
{
  const ranking = [f('dot', 'T1', 92, 3), f('state-label', 'T1', 90.5, 4)];
  const tie = breakTie(ranking);
  eq(tie.kept, 'state-label', 'same tier, 1.5-point gap, more states → promoted');
  eq(ranking.map((r) => r.id), ['state-label', 'dot'], 'the ranking is reordered, not just annotated');
  eq(tie.fitGap, 1.5, 'the gap is reported so the report can quote it');
}

// 2. A gap outside the band is a real preference.
{
  const ranking = [f('dot', 'T1', 92, 3), f('state-label', 'T1', 88, 4)];
  eq(breakTie(ranking), null, 'same tier, 4-point gap → no swap');
  eq(ranking.map((r) => r.id), ['dot', 'state-label'], 'the order is untouched');
}

// 3. A T1 never leapfrogs a T0, even with more states and equal fit.
{
  const ranking = [f('css-static', 'T0', 100, 0), f('dot', 'T1', 100, 3)];
  eq(breakTie(ranking), null, 'T0 against T1 → no swap');
}

// 4. Blocked families are not candidates, and a blocked leader is skipped.
{
  const ranking = [
    f('shader-ripple', 'T3', 99, 4, { eligible: false, blocked: true }),
    f('dot', 'T1', 92, 3),
    f('state-label', 'T1', 90, 4),
  ];
  const tie = breakTie(ranking);
  eq(tie.kept, 'state-label', 'a blocked family at the top does not lead; the first eligible one does');
  eq(ranking[0].id, 'shader-ripple', 'the blocked family keeps its display position');
}

// 5. A blocked candidate inside the band is never promoted.
{
  const ranking = [f('dot', 'T1', 92, 3), f('state-label', 'T1', 91, 4, { eligible: false, blocked: true })];
  eq(breakTie(ranking), null, 'blocked candidate → no swap');
}

// 6. Alternative-only families cannot take the primary slot.
{
  const ranking = [f('dot', 'T1', 92, 3), f('blend-difference', 'T1', 91, 4, { primaryOnly: true })];
  eq(breakTie(ranking), null, 'primaryOnly candidate → no swap');
}

// 7. Fewer states never wins a tie.
{
  const ranking = [f('state-label', 'T1', 92, 4), f('dot', 'T1', 91, 3)];
  eq(breakTie(ranking), null, 'fewer states → no swap');
}

// 8. Equal states keeps the original order, which is the higher fit.
{
  const ranking = [f('dot-ring', 'T1', 92, 3), f('dot', 'T1', 91, 3)];
  eq(breakTie(ranking), null, 'equal states → no swap');
}

// 9. Empty and all-blocked rankings are not errors.
{
  eq(breakTie([]), null, 'empty ranking → null');
  eq(breakTie([f('shader-ripple', 'T3', 90, 3, { eligible: false, blocked: true })]), null, 'no eligible family → null');
}

console.log(`\n${passed} assertions passed`);
