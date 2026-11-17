/**
 * Tie-breaking for the family ranking.
 *
 * Extracted from audit.mjs so the rule can be tested without running a whole audit. It is
 * four conditions and every one of them has been wrong at some point: a blocked family
 * promoted itself, a T1 leapfrogged a T0 on state count, and a 6-point gap was treated as
 * noise. The test in test/tiebreak.mjs pins each of those down.
 */

export const TIE_BAND = 2.5;

/**
 * Promote the richer family over the leader when the fit gap is inside the noise band.
 * Mutates and returns the ranking's new order plus a record of the swap, or null.
 *
 * @param {Array} ranking  sorted families, best fit first
 * @param {number} band    fits closer than this are treated as equal
 */
export function breakTie(ranking, band = TIE_BAND) {
  const leader = ranking.findIndex((r) => r.eligible && !r.primaryOnly);
  if (leader < 0) return null;

  const top = ranking[leader];
  for (let i = leader + 1; i < ranking.length; i++) {
    const r = ranking[i];

    // A blocked or modifier family is never a candidate, and an alternative-only family
    // cannot take the primary slot.
    if (!r.eligible || r.primaryOnly) continue;

    // Same tier only. At equal fit the cheaper family is the safer answer, and "prefer the
    // lower tier" is one of the catalogue's own rules.
    if (r.tier !== top.tier) continue;

    // Outside the band, the fit difference is the decision.
    if (top.fit - r.fit > band) continue;

    // Inside the band, more control states wins. Equal states keeps the original order.
    if (r.states <= top.states) continue;

    ranking.splice(i, 1);
    ranking.splice(leader, 0, r);

    const gap = Number((top.fit - r.fit).toFixed(1));
    return {
      kept: r.id,
      dropped: top.id,
      fitGap: gap,
      states: { [r.id]: r.states, [top.id]: top.states },
      reason:
        `${r.id} reacts to ${r.states} control states, ${top.id} to ${top.states}; ` +
        `a ${gap}-point fit gap is inside the noise band`,
    };
  }

  return null;
}
