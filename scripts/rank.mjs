/**
 * Family catalogue and selection rules.
 *
 * 0.2.0 replaced the ranking. Up to 0.1.2 a family was scored by a compounded product of
 * per-axis penalties, and that number was used both as an eligibility test and as the ranking
 * key. It could not do both:
 *
 *   - the product is a conjunction, so a family judged on five axes scored lower than one
 *     judged on two, for identical per-axis quality (css-static had 2 active axes, dot 3,
 *     everything else 5);
 *   - `fit 100` means "no axis rules it out", which is a pass, not a quality signal, so
 *     ranking on it ranked band geometry rather than suitability;
 *   - ties fell through to array order, which is why `dot` beat `dot-ring` at equal fit.
 *
 * The rules now are:
 *   1. A family's fit is the geometric mean of its per-axis factors, normalised by the number
 *      of axes it was actually judged on. That makes the number comparable across families.
 *   2. An axis whose confidence is `low` is skipped, not scored as zero. A site the reader
 *      could not parse must not look like a restrained site.
 *   3. Fit is a floor (FIT_FLOOR), never a ranker. Eligible families are ranked by payoff.
 *   4. `safe` is the best-fitting eligible family; `reach` is the most ambitious eligible
 *      family at most one tier up. Both are offered; only one runs at a time.
 *
 * Everything here is pure so test/selection.mjs can pin it down without running an audit.
 */

export const AXES = ['expressive', 'organic', 'airy', 'energy', 'editorial'];

/** A family below this fit is not offered as a safe or reach pick. */
export const FIT_FLOOR = 80;

/** How far above the safe family's tier a reach may go. */
export const REACH_TIER_MAX = 1;

/**
 * How much fit a reach may give up for ambition.
 *
 * Without a bound the reach was chosen on floor alone, so a family that fitted the site at 83.7
 * with three missed axes was offered while one at 95.8 with a single small miss was skipped —
 * merely because the first had a higher expressive floor. Ambition is allowed to cost fit; it is
 * not allowed to cost all of it.
 */
export const REACH_FIT_SLACK = 10;

const TIER_RANK = { T0: 0, T1: 1, T2: 2, T3: 3 };

const range = (lo, hi) => [lo, hi];
const any = () => range(0, 100);

export const FAMILIES = [
  {
    id: 'css-static', tier: 'T0', js: 0,
    bands: { expressive: range(0, 45), organic: any(), airy: any(), energy: range(0, 55), editorial: any() },
  },
  {
    id: 'dot', tier: 'T1', js: 25,
    bands: { expressive: range(0, 60), organic: any(), airy: any(), energy: range(0, 65), editorial: range(0, 60) },
  },
  {
    id: 'dot-ring', tier: 'T1', js: 45,
    bands: { expressive: range(30, 80), organic: range(0, 70), airy: range(30, 100), energy: range(25, 80), editorial: range(0, 75) },
  },
  {
    id: 'state-label', tier: 'T1', js: 85,
    bands: { expressive: range(55, 100), organic: range(0, 85), airy: range(40, 100), energy: range(40, 100), editorial: range(50, 100) },
  },
  {
    id: 'magnetic', tier: 'T1', js: 60,
    bands: { expressive: range(40, 90), organic: any(), airy: any(), energy: range(40, 100), editorial: range(0, 65) },
  },
  {
    id: 'blend-difference', tier: 'T1', js: 40,
    bands: { expressive: range(60, 100), organic: range(30, 85), airy: range(20, 100), energy: range(30, 90), editorial: range(55, 100) },
  },
  {
    id: 'trail', tier: 'T2', js: 90,
    bands: { expressive: range(70, 100), organic: range(30, 100), airy: range(55, 100), energy: range(65, 100), editorial: range(40, 100) },
  },
  {
    id: 'mask-reveal', tier: 'T2', js: 110,
    bands: { expressive: range(75, 100), organic: range(20, 100), airy: range(50, 100), energy: range(40, 95), editorial: range(65, 100) },
  },
  {
    id: 'shader-ripple', tier: 'T3', js: 150,
    bands: { expressive: range(80, 100), organic: range(30, 100), airy: range(40, 100), energy: range(60, 100), editorial: range(50, 100) },
  },
].map((f) => ({ ...f, tierRank: TIER_RANK[f.tier], floor: f.bands.expressive[0] }));

/** A modifier is applied on top of another family; it can never be the answer on its own. */
export const MODIFIERS = new Set(['magnetic']);

/**
 * What each family can do at a control. The base state layer makes link/button/text
 * mandatory for every JS family; `label` and `media` are the extras a family adds.
 */
export const STATES = {
  'css-static': [],
  dot: ['link', 'button', 'text'],
  'dot-ring': ['link', 'button', 'text'],
  'state-label': ['link', 'button', 'text', 'label'],
  magnetic: ['link', 'button', 'text'],
  'blend-difference': ['link', 'button', 'text'],
  trail: ['link', 'button', 'text'],
  'mask-reveal': ['link', 'button', 'text', 'media'],
  'shader-ripple': ['link', 'button', 'text'],
};

const round = (n, d = 0) => Number(n.toFixed(d));

/**
 * Score one family against the profile.
 *
 * Fit is a geometric mean over the axes the family actually declares an opinion on, so a
 * family judged on two axes and a family judged on five land on the same scale. Low-confidence
 * axes are dropped rather than counted as zero — "we could not read this" is not "this is
 * quiet".
 *
 * Returns `fit: null` when every active axis was skipped, which means there is no evidence to
 * justify an offer. The caller must treat null as ineligible.
 */
export function fitFamily(scores, family) {
  let product = 1;
  let active = 0;
  let missDistance = 0;
  const skipped = [];
  const misses = [];

  for (const axis of AXES) {
    const [lo, hi] = family.bands[axis];
    if (lo <= 0 && hi >= 100) continue; // no preference on this axis
    if (scores[axis]?.confidence?.level === 'low') {
      skipped.push(axis);
      continue;
    }

    active += 1;
    const value = scores[axis].value;
    const distance = Math.max(0, lo - value, value - hi);
    if (distance === 0) continue;

    missDistance = Math.max(missDistance, distance);
    misses.push(`${axis} ${value} vs ${lo}–${hi}`);
    product *= 1 - 0.45 * Math.min(1, distance / 30);
  }

  if (!active) return { fit: null, active: 0, skipped, misses, missDistance: 0 };
  return { fit: round(100 * product ** (1 / active), 1), active, skipped, misses, missDistance };
}

/**
 * Highest fit first, then the cheaper family.
 *
 * Fit saturates: on a mid-profile site six families score 100 at once, because their bands
 * overlap and a band that covers the value costs nothing. The old order broke that tie on
 * `states`, which meant a T3 shader could be offered as the *safe* pick — the opposite of what
 * safe means. Cost comes before capability here for that reason.
 */
const byFit = (a, b) =>
  b.fit - a.fit || a.tierRank - b.tierRank || b.states - a.states || a.id.localeCompare(b.id);

const byPayoff = (a, b) =>
  b.floor - a.floor || b.fit - a.fit || b.states - a.states || a.tierRank - b.tierRank || a.id.localeCompare(b.id);

const byCost = (a, b) =>
  a.tierRank - b.tierRank || a.jsLines - b.jsLines || b.fit - a.fit || a.id.localeCompare(b.id);

/**
 * The floor. A family is only offered when the reader has evidence for it (`fit !== null`),
 * it clears FIT_FLOOR, no gate blocked it, and it is not a modifier.
 */
export const isEligible = (fit, family, blocked = false) =>
  fit !== null && fit >= FIT_FLOOR && !blocked && !MODIFIERS.has(family.id);

/**
 * Choose the two offers.
 *
 * `safe` is the highest-fit eligible family. `reach` is the highest-payoff eligible family at
 * most one tier above it that gives up no more than REACH_FIT_SLACK fit points — the thing the
 * site could carry if the owner wants more. `fallback` is the cheapest eligible family that is
 * neither, so the report can always name a conservative third option.
 *
 * `css-static` is deliberately not a safe candidate. Its bands are a strict subset of `dot`'s
 * (expressive 0–45 vs 0–60, energy 0–55 vs 0–65), so it can never out-fit the dot; and since
 * 0.1.2 every JS family ships the base state layer, which the bitmap cursor cannot. Its honest
 * niche is "the buyer forbids JavaScript", which is a constraint the repo cannot reveal. It is
 * offered as the fallback instead, and named as the answer when that constraint is stated.
 */
export function decide(ranking) {
  // `eligible` already encodes the gates, but the floor is decide's own invariant, so it is
  // re-checked here rather than trusted. Callers that forget still get no offer.
  const compliant = ranking.filter(
    (r) => r.eligible && !r.primaryOnly && r.fit !== null && r.fit >= FIT_FLOOR,
  );
  const pool = compliant.filter((r) => r.id !== 'css-static');

  if (!pool.length) {
    const only = compliant[0] || null;
    return {
      safe: only,
      reach: null,
      fallback: null,
      reason: only
        ? 'only the zero-JS family clears the floor — the site has no JS budget to build on'
        : 'no family clears the fit floor after the gates',
    };
  }

  const safe = [...pool].sort(byFit)[0];
  const cap = safe.tierRank + REACH_TIER_MAX;
  const floor = Math.max(FIT_FLOOR, safe.fit - REACH_FIT_SLACK);
  const reachPool = pool.filter((r) => r.id !== safe.id && r.tierRank <= cap && r.fit >= floor);
  const reach = reachPool.length ? [...reachPool].sort(byPayoff)[0] : null;

  const used = new Set([safe.id, reach && reach.id].filter(Boolean));
  const cheapest = [...pool].filter((r) => !used.has(r.id)).sort(byCost)[0] || null;
  const zeroJs = compliant.find((r) => r.id === 'css-static') || null;
  const fallback = zeroJs && !used.has(zeroJs.id) ? zeroJs : cheapest;

  const total = compliant.length;
  const reason = `highest fit of ${total} eligible famil${total === 1 ? 'y' : 'ies'}`;

  return { safe, reach, fallback, reason };
}

/** Compact projection used by the audit's JSON and by the golden-set runner. */
export const brief = (r) =>
  r
    ? {
        id: r.id,
        tier: r.tier,
        fit: r.fit,
        jsLines: r.jsLines,
        states: r.states,
        floor: r.floor,
        eligible: r.eligible,
        primaryOnly: r.primaryOnly,
      }
    : null;
