#!/usr/bin/env node
/**
 * The selection rules, pinned down.
 *
 * 0.2.0 replaced the ranking. Each case below is a mistake the old model made, or that a draft
 * of the new one made:
 *
 *   - a family judged on two axes out-scored one judged on five for identical quality;
 *   - a low-confidence axis was scored as a pass, so an unreadable site looked quiet;
 *   - fit was used as the ranker, and ties fell through to array order;
 *   - the "ambitious" offer was chosen on floor alone, so it could fit worse than the alternative;
 *   - a T3 shader could be offered as the safe pick at equal fit.
 *
 *   node test/selection.mjs
 *
 * Exits 1 on the first failed assertion.
 */

import {
  AXES,
  FIT_FLOOR,
  REACH_FIT_SLACK,
  REACH_TIER_MAX,
  fitFamily,
  isEligible,
  decide,
  brief,
} from '../scripts/rank.mjs';

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

// --- fixtures -------------------------------------------------------------------

const mk = (value, level = 'high') => ({ value, confidence: { level } });
const scores = (o) => Object.fromEntries(AXES.map((a) => [a, mk(o[a] ?? 50)]));

const TIER_RANK = { T0: 0, T1: 1, T2: 2, T3: 3 };
const fam = (id, tier, fit, opts = {}) => ({
  id,
  tier,
  tierRank: TIER_RANK[tier],
  floor: opts.floor ?? 50,
  fit,
  states: opts.states ?? 2,
  jsLines: opts.jsLines ?? 30,
  eligible: opts.eligible ?? true,
  primaryOnly: opts.primaryOnly ?? false,
});

const band = (lo, hi) => [lo, hi];
const wide = band(0, 100);

// --- 1. geometric mean, normalised by active axes ---------------------------------

{
  // Same per-axis quality, different number of opinions. Both must land on 85.
  const site = scores({ expressive: 70, organic: 70, airy: 70, energy: 70, editorial: 70 });

  const two = fitFamily(site, {
    id: 'two',
    bands: { expressive: band(0, 60), organic: wide, airy: wide, energy: band(0, 60), editorial: wide },
  });
  const five = fitFamily(site, {
    id: 'five',
    bands: {
      expressive: band(0, 60),
      organic: band(0, 60),
      airy: band(0, 60),
      energy: band(0, 60),
      editorial: band(0, 60),
    },
  });

  eq([two.active, two.fit], [2, 85], 'two active axes, each 10 over the band, scores 85');
  eq([five.active, five.fit], [5, 85], 'five active axes at the same distance score the same 85');
}

// --- 2. a low-confidence axis is skipped, not counted as a pass --------------------

{
  const family = {
    id: 'pair',
    bands: { expressive: band(0, 60), organic: wide, airy: wide, energy: band(0, 60), editorial: wide },
  };

  const unsure = fitFamily(
    { ...scores({ expressive: 90 }), energy: mk(10, 'low') },
    family,
  );
  eq(unsure.active, 1, 'a low-confidence axis does not count towards the active total');
  eq(unsure.fit, 55, 'a 30-point miss on the one readable axis scores 55, not 74');
  eq(unsure.skipped, ['energy'], 'the skipped axis is named for --explain');

  const read = fitFamily({ ...scores({ expressive: 90 }), energy: mk(10) }, family);
  eq(read.active, 2, 'the same axis counts once it is readable');
  eq(read.fit, 74.2, 'scoring the unreadable axis as in-band would have inflated 55 to 74.2');

  const blind = fitFamily(
    { ...scores({}), expressive: mk(90, 'low'), energy: mk(70, 'low') },
    family,
  );
  eq(blind.fit, null, 'no readable active axis means no fit, not a default score');
}

// --- 3. the floor -----------------------------------------------------------------

{
  eq(FIT_FLOOR, 80, 'the floor is 80');
  eq(isEligible(null, { id: 'dot' }), false, 'no evidence is not eligible');
  eq(isEligible(79.9, { id: 'dot' }), false, '79.9 is under the floor');
  eq(isEligible(80, { id: 'dot' }), true, '80 is exactly the floor and passes');
  eq(isEligible(100, { id: 'dot' }, true), false, 'a blocked family is never eligible');
  eq(isEligible(100, { id: 'magnetic' }), false, 'a modifier can never be the answer');
}

// --- 4. css-static is never a safe or reach offer ---------------------------------

{
  const ranking = [
    fam('css-static', 'T0', 100, { jsLines: 0 }),
    fam('dot', 'T1', 95, { jsLines: 25 }),
  ];
  const d = decide(ranking);
  eq(d.safe.id, 'dot', 'the zero-JS family does not take the safe slot even at fit 100');
  eq(d.fallback.id, 'css-static', 'it is offered as the fallback instead');
}

// --- 5. a tie goes to the cheaper family ------------------------------------------

{
  const ranking = [
    fam('trail', 'T2', 100, { floor: 70, jsLines: 90 }),
    fam('dot-ring', 'T1', 100, { floor: 30, jsLines: 45 }),
  ];
  const d = decide(ranking);
  eq(d.safe.id, 'dot-ring', 'at equal fit the T1 beats the T2; safe means low risk');
}

// --- 6. the reach may give up fit, but not all of it ------------------------------

{
  const ranking = [
    fam('dot', 'T1', 100, { floor: 0, jsLines: 25 }),
    fam('near', 'T1', 100 - (REACH_FIT_SLACK - 1), { floor: 55, jsLines: 45 }),
    fam('far', 'T1', 100 - (REACH_FIT_SLACK + 1), { floor: 70, jsLines: 45 }),
  ];
  const d = decide(ranking);
  eq(d.safe.id, 'dot', 'the best fit is safe');
  eq(d.reach.id, 'near', 'a family inside the slack is offered even though a higher-floor one exists outside it');
}

{
  const ranking = [
    fam('dot', 'T1', 100, { floor: 0, jsLines: 25 }),
    fam('cheap-floor', 'T1', 96, { floor: 40, jsLines: 30 }),
    fam('high-floor', 'T1', 94, { floor: 60, jsLines: 45 }),
  ];
  const d = decide(ranking);
  eq(d.reach.id, 'high-floor', 'among families inside the slack, the one with the most expressive floor wins');
}

// --- 7. a reach is at most one tier above safe ------------------------------------

{
  const ranking = [
    fam('dot', 'T1', 100, { floor: 0, jsLines: 25 }),
    fam('two-up', 'T3', 100, { floor: 90, jsLines: 150 }),
    fam('one-up', 'T2', 95, { floor: 40, jsLines: 90 }),
  ];
  const d = decide(ranking);
  eq(d.reach.id, 'one-up', `REACH_TIER_MAX is ${REACH_TIER_MAX}, so a T3 is out when safe is T1`);
}

// --- 8. the degenerate pools ------------------------------------------------------

{
  const d = decide([fam('css-static', 'T0', 100, { jsLines: 0 })], scores({}));
  eq([d.safe.id, d.reach, d.fallback], ['css-static', null, null], 'zero-JS alone is still an offer');
  eq(/zero-JS/.test(d.reason), true, 'and the reason says why');
}

{
  const d = decide([fam('dot', 'T1', 60), fam('trail', 'T2', 55)], scores({}));
  eq([d.safe, d.reach, d.fallback], [null, null, null], 'nothing over the floor means no offer');
  eq(/fit floor/.test(d.reason), true, 'and the reason names the floor');
}

// --- 9. the brief is the published projection -------------------------------------

{
  const r = fam('dot', 'T1', 97.4, { floor: 0, jsLines: 25, states: 3 });
  eq(brief(r), {
    id: 'dot',
    tier: 'T1',
    fit: 97.4,
    jsLines: 25,
    states: 3,
    floor: 0,
    eligible: true,
    primaryOnly: false,
  }, 'brief keeps exactly the fields the report and the golden set read');
  eq(brief(null), null, 'brief of nothing is null');
}

console.log(`\n${passed} assertions passed`);
